/**
 * End-to-end check against devnet, using the same raw instruction encoding the
 * browser demo uses (no Anchor client), so a mismatch shows up here rather than
 * in the UI: fresh wallet → claim → wrap → swap pUSDY for tUSDC → swap back.
 *
 * Run:  ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
 *           ANCHOR_WALLET=~/.config/solana/id.json \
 *           npx ts-node scripts/verify-swap.ts
 */
import * as anchor from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram, Connection, Keypair, PublicKey, SystemProgram,
  Transaction, TransactionInstruction, sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAccount,
  createAssociatedTokenAccountIdempotent, getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as fs from "fs";

const DISC = {
  claim: [62, 198, 214, 193, 213, 159, 108, 210],
  wrap: [178, 40, 10, 189, 228, 129, 186, 140],
  swap: [248, 198, 158, 145, 225, 117, 135, 200],
};

const u64 = (n: number | bigint) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
};

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection as Connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  const a = JSON.parse(fs.readFileSync("devnet-addresses.json", "utf8"));
  const P = (k: string) => new PublicKey(a[k]);
  const assetMint = P("assetMint"), pMint = P("pMint"), quoteMint = P("quoteMint");
  const identityProgram = P("identityProgram"), hookProgram = P("hookProgram");
  const faucetProgram = P("faucetProgram"), poolProgram = P("poolProgram");
  const wrapperProgram = P("wrapperProgram");
  const pool = P("pool"), metaList = P("metaList");

  const seed = (...s: (Buffer | Uint8Array)[]) => s;
  const pda = (seeds: any[], program: PublicKey) =>
    PublicKey.findProgramAddressSync(seeds, program)[0];
  const cred = (w: PublicKey) => pda([Buffer.from("credential"), w.toBuffer()], identityProgram);
  const identityConfig = pda([Buffer.from("config")], identityProgram);
  const faucetPda = pda([Buffer.from("faucet")], faucetProgram);
  const faucetSigner = pda([Buffer.from("faucet-signer")], faucetProgram);
  const vault = pda([Buffer.from("vault"), assetMint.toBuffer()], wrapperProgram);

  const visitor = Keypair.generate();
  console.log("fresh visitor:", visitor.publicKey.toBase58());
  await sendAndConfirmTransaction(connection, new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey, toPubkey: visitor.publicKey, lamports: 40_000_000,
    })), [payer]);

  const userAsset = await createAssociatedTokenAccountIdempotent(
    connection, payer, assetMint, visitor.publicKey);
  const userP = await createAssociatedTokenAccountIdempotent(
    connection, payer, pMint, visitor.publicKey, undefined, TOKEN_2022_PROGRAM_ID);
  const userQuote = await createAssociatedTokenAccountIdempotent(
    connection, payer, quoteMint, visitor.publicKey);

  // 1. claim
  await sendAndConfirmTransaction(connection, new Transaction().add(
    new TransactionInstruction({
      programId: faucetProgram,
      keys: [
        { pubkey: faucetPda, isSigner: false, isWritable: false },
        { pubkey: faucetSigner, isSigner: false, isWritable: true },
        { pubkey: identityConfig, isSigner: false, isWritable: true },
        { pubkey: cred(visitor.publicKey), isSigner: false, isWritable: true },
        { pubkey: identityProgram, isSigner: false, isWritable: false },
        { pubkey: assetMint, isSigner: false, isWritable: true },
        { pubkey: userAsset, isSigner: false, isWritable: true },
        { pubkey: visitor.publicKey, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(DISC.claim),
    })), [visitor]);
  console.log("claimed tUSDY:", Number((await getAccount(connection, userAsset)).amount) / 1e6);

  // 2. wrap 200
  await sendAndConfirmTransaction(connection, new Transaction().add(
    new TransactionInstruction({
      programId: wrapperProgram,
      keys: [
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: assetMint, isSigner: false, isWritable: false },
        { pubkey: pMint, isSigner: false, isWritable: true },
        { pubkey: userAsset, isSigner: false, isWritable: true },
        { pubkey: getAssociatedTokenAddressSync(assetMint, vault, true), isSigner: false, isWritable: true },
        { pubkey: userP, isSigner: false, isWritable: true },
        { pubkey: visitor.publicKey, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([Buffer.from(DISC.wrap), u64(200_000_000)]),
    })), [visitor]);
  console.log("pUSDY after wrap:",
    Number((await getAccount(connection, userP, undefined, TOKEN_2022_PROGRAM_ID)).amount) / 1e6);

  const hookRemaining = (destOwner: PublicKey) => [
    { pubkey: hookProgram, isSigner: false, isWritable: false },
    { pubkey: metaList, isSigner: false, isWritable: false },
    { pubkey: identityProgram, isSigner: false, isWritable: false },
    { pubkey: cred(destOwner), isSigner: false, isWritable: false },
  ];

  const swapIx = (amountIn: number, minOut: number, pToQuote: boolean) =>
    new TransactionInstruction({
      programId: poolProgram,
      keys: [
        { pubkey: pool, isSigner: false, isWritable: true },
        { pubkey: pMint, isSigner: false, isWritable: true },
        { pubkey: quoteMint, isSigner: false, isWritable: false },
        { pubkey: getAssociatedTokenAddressSync(pMint, pool, true, TOKEN_2022_PROGRAM_ID), isSigner: false, isWritable: true },
        { pubkey: getAssociatedTokenAddressSync(quoteMint, pool, true), isSigner: false, isWritable: true },
        { pubkey: userP, isSigner: false, isWritable: true },
        { pubkey: userQuote, isSigner: false, isWritable: true },
        { pubkey: visitor.publicKey, isSigner: true, isWritable: true },
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        // pToken destination decides whose credential the hook checks
        ...hookRemaining(pToQuote ? pool : visitor.publicKey),
      ],
      data: Buffer.concat([
        Buffer.from(DISC.swap), u64(amountIn), u64(minOut), Buffer.from([pToQuote ? 1 : 0]),
      ]),
    });

  const cu = ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });

  // 3. sell 100 pUSDY for tUSDC
  await sendAndConfirmTransaction(connection, new Transaction().add(cu, swapIx(100_000_000, 1, true)), [visitor]);
  console.log("tUSDC after selling 100 pUSDY:",
    Number((await getAccount(connection, userQuote)).amount) / 1e6);

  // 4. buy back with 50 tUSDC
  await sendAndConfirmTransaction(connection, new Transaction().add(cu, swapIx(50_000_000, 1, false)), [visitor]);
  console.log("pUSDY after buying back:",
    Number((await getAccount(connection, userP, undefined, TOKEN_2022_PROGRAM_ID)).amount) / 1e6);

  console.log("OK — claim, wrap and both swap directions work for a fresh wallet");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
