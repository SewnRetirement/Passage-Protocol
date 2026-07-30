/**
 * Devnet setup for the gated AMM: creates a tUSDC quote mint, a pUSDY/tUSDC
 * pool, gives the pool PDA a credential (without it the transfer hook would
 * refuse to let pTokens into the pool), and seeds it with liquidity.
 *
 * Idempotent — safe to re-run.
 *
 * Run:  ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
 *           ANCHOR_WALLET=~/.config/solana/id.json \
 *           npx ts-node scripts/setup-pool.ts
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram, Keypair, PublicKey, SystemProgram, Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, createMint, mintTo, getAccount,
  createAssociatedTokenAccountIdempotent, getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import * as fs from "fs";

const BN = (anchor as any).BN ?? (anchor as any).default?.BN;

const SEED_P = new BN(500_000_000);     // 500 pUSDY
const SEED_QUOTE = new BN(500_000_000); // 500 tUSDC → starts at ~1:1

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  const a = JSON.parse(fs.readFileSync("devnet-addresses.json", "utf8"));
  const assetMint = new PublicKey(a.assetMint);
  const pMint = new PublicKey(a.pMint);

  const load = (name: string) => new Program(
    JSON.parse(fs.readFileSync(`target/idl/${name}.json`, "utf8")), provider);
  const identity = load("passage_identity");
  const hook = load("passage_hook");
  const wrapper = load("passage_wrapper");
  const pool = load("passage_pool");
  const faucet = load("passage_demo_faucet");

  const [faucetPda] = PublicKey.findProgramAddressSync([Buffer.from("faucet")], faucet.programId);
  const [faucetSigner] = PublicKey.findProgramAddressSync(
    [Buffer.from("faucet-signer")], faucet.programId);
  const [identityConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")], identity.programId);
  const [metaListPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("extra-account-metas"), pMint.toBuffer()], hook.programId);
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), assetMint.toBuffer()], wrapper.programId);
  const credPda = (w: PublicKey) => PublicKey.findProgramAddressSync(
    [Buffer.from("credential"), w.toBuffer()], identity.programId)[0];

  // 1. quote mint
  let quoteMint: PublicKey;
  if (a.quoteMint) {
    quoteMint = new PublicKey(a.quoteMint);
    console.log("quote mint (existing):", quoteMint.toBase58());
  } else {
    quoteMint = await createMint(connection, payer, payer.publicKey, null, 6);
    console.log("quote mint (new):     ", quoteMint.toBase58());
    // Persist immediately: if a later step fails, a re-run must reuse this mint
    // rather than orphaning it and creating another.
    a.quoteMint = quoteMint.toBase58();
    fs.writeFileSync("devnet-addresses.json", JSON.stringify(a, null, 2));
  }
  const payerQuote = await createAssociatedTokenAccountIdempotent(
    connection, payer, quoteMint, payer.publicKey);
  const quoteBal = Number((await getAccount(connection, payerQuote)).amount);
  if (quoteBal < SEED_QUOTE.toNumber()) {
    await mintTo(connection, payer, quoteMint, payerQuote, payer, 1_000_000_000_000);
    console.log("minted test tUSDC");
  }

  const [poolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), pMint.toBuffer(), quoteMint.toBuffer()], pool.programId);
  console.log("pool:                 ", poolPda.toBase58());

  // 2. pool + LP mint
  const lpMintKp = a.lpMint ? null : Keypair.generate();
  let lpMint = a.lpMint ? new PublicKey(a.lpMint) : lpMintKp!.publicKey;
  const poolAcc = await connection.getAccountInfo(poolPda);
  if (poolAcc) {
    console.log("pool already initialised");
  } else {
    await pool.methods.initializePool().accounts({
      pool: poolPda, pMint, quoteMint, lpMint,
      payer: payer.publicKey,
      pTokenProgram: TOKEN_2022_PROGRAM_ID,
      quoteTokenProgram: TOKEN_PROGRAM_ID,
      lpTokenProgram: TOKEN_PROGRAM_ID,
    }).signers(lpMintKp ? [lpMintKp] : []).rpc();
    console.log("pool initialised, LP mint:", lpMint.toBase58());
  }

  // 3. the pool PDA needs a credential, or the hook blocks pTokens entering it.
  //    The registry authority currently sits with the faucet, so borrow it back.
  if (await connection.getAccountInfo(credPda(poolPda))) {
    console.log("pool already verified");
  } else {
    await faucet.methods.setIdentityAuthority(payer.publicKey).accounts({
      faucet: faucetPda, faucetSigner, identityConfig,
      identityProgram: identity.programId, admin: payer.publicKey,
    }).rpc();
    await identity.methods.verifyWallet(poolPda)
      .accounts({ authority: payer.publicKey }).rpc();
    await identity.methods.setAuthority(faucetSigner)
      .accounts({ authority: payer.publicKey }).rpc();
    console.log("pool verified, registry handed back to the faucet");
  }

  // 4. liquidity — wrap some tUSDY first if we're short on pUSDY
  const payerP = await createAssociatedTokenAccountIdempotent(
    connection, payer, pMint, payer.publicKey, undefined, TOKEN_2022_PROGRAM_ID);
  const payerAsset = getAssociatedTokenAddressSync(assetMint, payer.publicKey);
  const havingP = Number((await getAccount(
    connection, payerP, undefined, TOKEN_2022_PROGRAM_ID)).amount);
  if (havingP < SEED_P.toNumber()) {
    const need = SEED_P.toNumber() - havingP;
    await wrapper.methods.wrap(new BN(Math.ceil(need * 1.01))).accounts({
      vault: vaultPda, assetMint, pMint,
      userAssetAccount: payerAsset,
      vaultAssetAccount: getAssociatedTokenAddressSync(assetMint, vaultPda, true),
      userPAccount: payerP, user: payer.publicKey,
      assetTokenProgram: TOKEN_PROGRAM_ID, pTokenProgram: TOKEN_2022_PROGRAM_ID,
    }).rpc();
    console.log("wrapped tUSDY → pUSDY for liquidity");
  }

  const poolP = getAssociatedTokenAddressSync(pMint, poolPda, true, TOKEN_2022_PROGRAM_ID);
  const reserves = Number((await getAccount(
    connection, poolP, undefined, TOKEN_2022_PROGRAM_ID)).amount);
  if (reserves > 0) {
    console.log("pool already funded:", reserves / 1e6, "pUSDY");
  } else {
    const userLp = await createAssociatedTokenAccountIdempotent(
      connection, payer, lpMint, payer.publicKey);
    const ix = await pool.methods.addLiquidity(SEED_P, SEED_QUOTE).accounts({
      pool: poolPda, pMint, quoteMint, lpMint,
      userPAccount: payerP, userQuoteAccount: payerQuote, userLpAccount: userLp,
      user: payer.publicKey,
      pTokenProgram: TOKEN_2022_PROGRAM_ID,
      quoteTokenProgram: TOKEN_PROGRAM_ID,
      lpTokenProgram: TOKEN_PROGRAM_ID,
    }).remainingAccounts([
      { pubkey: hook.programId, isSigner: false, isWritable: false },
      { pubkey: metaListPda, isSigner: false, isWritable: false },
      { pubkey: identity.programId, isSigner: false, isWritable: false },
      { pubkey: credPda(poolPda), isSigner: false, isWritable: false },
    ]).instruction();
    await sendAndConfirmTransaction(connection, new Transaction().add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), ix), [payer]);
    console.log("liquidity added:", SEED_P.toNumber() / 1e6, "pUSDY +",
      SEED_QUOTE.toNumber() / 1e6, "tUSDC");
  }

  a.quoteMint = quoteMint.toBase58();
  a.poolProgram = pool.programId.toBase58();
  a.pool = poolPda.toBase58();
  a.lpMint = lpMint.toBase58();
  a.metaList = metaListPda.toBase58();
  fs.writeFileSync("devnet-addresses.json", JSON.stringify(a, null, 2));
  console.log("addresses → devnet-addresses.json");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
