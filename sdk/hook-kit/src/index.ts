/**
 * @passage/hook-kit
 *
 * Token-2022 transfer hooks let a program run logic inside every transfer. The
 * catch is on the calling side: the hook usually needs extra accounts, those
 * accounts are described in an on-chain `ExtraAccountMetaList`, and the caller
 * has to resolve and pass them. Get it wrong and the CPI fails with an error
 * that tells you nothing.
 *
 * `@solana/spl-token` handles this for a plain top-level transfer. It does not
 * help when *your own program* performs the transfer via CPI — then you need
 * the same accounts as `remaining_accounts` on your instruction, in the order
 * the on-chain helper expects. That gap is what this package fills.
 *
 * MIT licensed. Extracted from Passage Protocol.
 */

import {
  AccountMeta,
  Commitment,
  Connection,
  PublicKey,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  TokenTransferHookAccountDataNotFound,
  TokenTransferHookAccountNotFound,
  addExtraAccountMetasForExecute,
  getExtraAccountMetaAddress,
  getMint,
  getTransferHook,
} from '@solana/spl-token';

/**
 * Thrown when the hook's accounts cannot be worked out, with the reason spelled
 * out. The underlying SPL errors say only that something was not found.
 */
export class HookResolutionError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'HookResolutionError';
  }
}

/**
 * Hooks commonly derive a PDA from bytes inside the destination token account —
 * its owner, for instance. That read fails if the account does not exist yet,
 * which is easy to hit because the destination ATA is often created in the same
 * transaction. Resolution happens off-chain and beforehand, so the account has
 * to exist first.
 */
function explain(err: unknown, ctx: TransferContext): never {
  if (err instanceof TokenTransferHookAccountDataNotFound ||
      err instanceof TokenTransferHookAccountNotFound) {
    throw new HookResolutionError(
      `Could not resolve the transfer-hook accounts for mint ${ctx.mint.toBase58()}: ` +
      `the hook derives an account from data in one of the transfer accounts, and at ` +
      `least one of them does not exist on-chain yet. This is usually the destination ` +
      `token account (${ctx.destination.toBase58()}). Create it first — in an earlier ` +
      `transaction, or with a create-idempotent instruction that has already been ` +
      `confirmed — then resolve.`,
      err,
    );
  }
  throw err;
}

/** Everything needed to work out which accounts a hook wants for one transfer. */
export interface TransferContext {
  /** The Token-2022 mint carrying the transfer hook. */
  mint: PublicKey;
  /** Source token account. */
  source: PublicKey;
  /** Destination token account. */
  destination: PublicKey;
  /** Owner (or delegate) authorising the transfer. */
  owner: PublicKey;
  /**
   * Amount in base units. Hooks may derive accounts from the instruction data,
   * so this can change the result — pass the real amount, not a placeholder.
   */
  amount: bigint | number;
  /** Defaults to the Token-2022 program. */
  tokenProgramId?: PublicKey;
  commitment?: Commitment;
}

/**
 * Reads the mint and returns the transfer-hook program, or `null` if the mint
 * has no hook. Useful for deciding whether any of this applies at all.
 */
export async function getHookProgramId(
  connection: Connection,
  mint: PublicKey,
  tokenProgramId: PublicKey = TOKEN_2022_PROGRAM_ID,
  commitment?: Commitment,
): Promise<PublicKey | null> {
  const mintInfo = await getMint(connection, mint, commitment, tokenProgramId);
  const hook = getTransferHook(mintInfo);
  if (!hook || hook.programId.equals(PublicKey.default)) return null;
  return hook.programId;
}

/**
 * The `ExtraAccountMetaList` PDA for a mint under a given hook program.
 * Seeds are `["extra-account-metas", mint]`.
 */
export function getMetaListAddress(mint: PublicKey, hookProgramId: PublicKey): PublicKey {
  return getExtraAccountMetaAddress(mint, hookProgramId);
}

/**
 * Resolves only the *extra* accounts the hook asks for — no hook program, no
 * meta-list. Resolution is recursive: an entry can be a fixed address, a PDA
 * derived from seeds, or a PDA of another program derived from bytes read out
 * of one of the other accounts.
 *
 * Returns an empty array when the mint has no hook, so it is safe to call
 * unconditionally.
 */
export async function resolveHookAccounts(
  connection: Connection,
  ctx: TransferContext,
): Promise<AccountMeta[]> {
  const tokenProgramId = ctx.tokenProgramId ?? TOKEN_2022_PROGRAM_ID;
  const hookProgramId = await getHookProgramId(
    connection, ctx.mint, tokenProgramId, ctx.commitment,
  );
  if (!hookProgramId) return [];

  // addExtraAccountMetasForExecute appends, in this order:
  //   [...resolved extras, hookProgramId, metaListAddress]
  // It also insists the four transfer accounts are already present, so we hand
  // it a scratch instruction holding exactly those and read back what it added.
  const scratch = new TransactionInstruction({
    programId: tokenProgramId,
    keys: [ctx.source, ctx.mint, ctx.destination, ctx.owner].map((pubkey) => ({
      pubkey, isSigner: false, isWritable: false,
    })),
    data: Buffer.alloc(0),
  });

  try {
    await addExtraAccountMetasForExecute(
      connection,
      scratch,
      hookProgramId,
      ctx.source,
      ctx.mint,
      ctx.destination,
      ctx.owner,
      ctx.amount,
      ctx.commitment,
    );
  } catch (err) {
    explain(err, ctx);
  }

  // Drop the four we supplied, and the trailing program + meta-list.
  return scratch.keys.slice(4, scratch.keys.length - 2);
}

/**
 * Accounts to pass as `remaining_accounts` when **your program** performs the
 * transfer by CPI — for example via `spl_token_2022::onchain::invoke_transfer_checked`
 * on the Rust side.
 *
 * Order is `[hookProgram, metaList, ...extras]`. The on-chain helper looks these
 * up by key rather than by position, but this order matches what the common
 * implementations expect and keeps instructions readable.
 *
 * Returns an empty array when the mint has no hook.
 */
export async function hookAccountsForCpi(
  connection: Connection,
  ctx: TransferContext,
): Promise<AccountMeta[]> {
  const tokenProgramId = ctx.tokenProgramId ?? TOKEN_2022_PROGRAM_ID;
  const hookProgramId = await getHookProgramId(
    connection, ctx.mint, tokenProgramId, ctx.commitment,
  );
  if (!hookProgramId) return [];

  const extras = await resolveHookAccounts(connection, ctx);
  return [
    { pubkey: hookProgramId, isSigner: false, isWritable: false },
    { pubkey: getMetaListAddress(ctx.mint, hookProgramId), isSigner: false, isWritable: false },
    ...extras,
  ];
}

/**
 * Appends the hook accounts to an existing instruction in the order the
 * Token-2022 program expects for a top-level transfer: `[...extras,
 * hookProgram, metaList]`.
 *
 * The instruction must already contain source, mint, destination and owner.
 * Mutates and returns it. A no-op when the mint has no hook.
 */
export async function appendHookAccounts(
  connection: Connection,
  instruction: TransactionInstruction,
  ctx: TransferContext,
): Promise<TransactionInstruction> {
  const tokenProgramId = ctx.tokenProgramId ?? TOKEN_2022_PROGRAM_ID;
  const hookProgramId = await getHookProgramId(
    connection, ctx.mint, tokenProgramId, ctx.commitment,
  );
  if (!hookProgramId) return instruction;

  try {
    await addExtraAccountMetasForExecute(
      connection,
      instruction,
      hookProgramId,
      ctx.source,
      ctx.mint,
      ctx.destination,
      ctx.owner,
      ctx.amount,
      ctx.commitment,
    );
  } catch (err) {
    explain(err, ctx);
  }
  return instruction;
}

/**
 * True if the mint carries a transfer hook. Convenience for branching in a UI
 * before building a transaction.
 */
export async function hasTransferHook(
  connection: Connection,
  mint: PublicKey,
  tokenProgramId: PublicKey = TOKEN_2022_PROGRAM_ID,
  commitment?: Commitment,
): Promise<boolean> {
  return (await getHookProgramId(connection, mint, tokenProgramId, commitment)) !== null;
}
