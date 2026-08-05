# @passage_protocol/hook-kit

Resolve Token-2022 transfer-hook accounts — including the CPI case the SPL
library does not cover.

## The problem

A Token-2022 mint can carry a **transfer hook**: a program that runs inside
every transfer. Writing the hook is the easy part. The pain is on the calling
side.

A hook usually needs extra accounts — a registry, a PDA derived from the
recipient, a config. Which accounts, and how to derive them, is described in an
on-chain `ExtraAccountMetaList`. The caller has to read that list, resolve each
entry, and pass the results in the right place. Miss one and the transfer fails
with an error that tells you nothing useful.

`@solana/spl-token` solves this for a plain top-level transfer:
`createTransferCheckedWithTransferHookInstruction` does the work for you.

It does not help when **your own program** does the transfer by CPI. Then you
need the same accounts as `remaining_accounts` on *your* instruction, and there
is no helper for that. Every AMM, lending market or vault that wants to touch a
hooked token hits this, and each one solves it again by hand.

That gap is what this package fills.

## Install

Not on npm yet — publishing is tracked as milestone 1 of our Solana Foundation
grant application. Until then, install from the repo:

```bash
npm install github:SewnRetirement/passage-protocol#main --prefix sdk/hook-kit
# or vendor sdk/hook-kit/src/index.ts directly — it is one file with no
# dependencies beyond @solana/web3.js and @solana/spl-token
```

You also need the peers:

```bash
npm install @solana/spl-token @solana/web3.js
```

## Your program does the transfer (the CPI case)

Your Rust program calls `spl_token_2022::onchain::invoke_transfer_checked` and
forwards `remaining_accounts`. Off-chain, build them like this:

```ts
import { hookAccountsForCpi } from '@passage_protocol/hook-kit';

const remaining = await hookAccountsForCpi(connection, {
  mint: pMint,
  source: userTokenAccount,
  destination: poolTokenAccount,
  owner: userWallet,
  amount: 1_000_000n,
});

const ix = await program.methods
  .swap(amountIn, minOut, true)
  .accounts({ /* ... */ })
  .remainingAccounts(remaining)
  .instruction();
```

Returns `[hookProgram, metaList, ...extras]`, or an empty array if the mint has
no hook — so the call is safe whether or not hooks are involved.

## A plain transfer

```ts
import { appendHookAccounts } from '@passage_protocol/hook-kit';

// instruction already has source, mint, destination, owner
await appendHookAccounts(connection, instruction, {
  mint, source, destination, owner, amount: 1_000_000n,
});
```

Appends in the order the Token-2022 program expects: `[...extras, hookProgram,
metaList]`. Mutates and returns the instruction.

## Branching before you build

```ts
import { hasTransferHook, getHookProgramId } from '@passage_protocol/hook-kit';

if (await hasTransferHook(connection, mint)) {
  // this token has rules attached
}

const hookProgram = await getHookProgramId(connection, mint); // or null
```

## The gotcha that costs people an afternoon

**The destination token account must already exist on-chain before you resolve.**

Hooks frequently derive a PDA from bytes *inside* the destination token account
— its owner field, typically, to look up a credential or allowlist entry.
Resolution happens off-chain, ahead of time, by reading that account. If the
destination ATA is created in the same transaction you are building, it does not
exist yet, and resolution fails.

The SPL library reports this as a bare "account data not found". This package
throws a `HookResolutionError` that says which account is missing and why:

```ts
import { HookResolutionError } from '@passage_protocol/hook-kit';

try {
  await hookAccountsForCpi(connection, ctx);
} catch (e) {
  if (e instanceof HookResolutionError) {
    // create the destination ATA in its own confirmed transaction, then retry
  }
}
```

The fix is to create the destination account in an earlier, confirmed
transaction — not in the same one.

## The other gotcha: the receiving *program* may need a credential too

If a hook gates on the recipient, then a pool, vault or lending market receiving
the token is itself a recipient. Its PDA has to satisfy the same rule. A swap
that fails for no obvious reason is often this: the user is allowed to hold the
token, and the pool is not.

## API

| Function | Returns |
|---|---|
| `getHookProgramId(connection, mint, tokenProgramId?, commitment?)` | The hook program, or `null` |
| `hasTransferHook(connection, mint, tokenProgramId?, commitment?)` | `boolean` |
| `getMetaListAddress(mint, hookProgramId)` | The `ExtraAccountMetaList` PDA |
| `resolveHookAccounts(connection, ctx)` | Just the extras |
| `hookAccountsForCpi(connection, ctx)` | `[hookProgram, metaList, ...extras]` |
| `appendHookAccounts(connection, ix, ctx)` | The instruction, extras appended |

`ctx` is `{ mint, source, destination, owner, amount, tokenProgramId?, commitment? }`.
Pass the real `amount` — a hook may derive accounts from the instruction data.

## Where this came from

Extracted from [Passage Protocol](https://github.com/SewnRetirement/passage-protocol),
which uses transfer hooks to keep tokenized real-world assets compliant while
staying tradeable in open DeFi. The `passage_pool` program in that repo is a
working example of an AMM that trades a hooked mint, if you want to see the
Rust side.

MIT.
