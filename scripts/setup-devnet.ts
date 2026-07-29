/**
 * Devnet setup for Passage Protocol.
 * Creates: tUSDY test mint, pUSDY (Token-2022 + transfer hook),
 * identity config, extra-account-meta-list, vault. Verifies the payer wallet
 * and performs a smoke-test wrap.
 *
 * Run:  ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
 *           ANCHOR_WALLET=~/.config/solana/id.json \
 *           npx ts-node scripts/setup-devnet.ts
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ExtensionType,
  createMint, createAssociatedTokenAccountIdempotent,
  createInitializeMintInstruction, createInitializeTransferHookInstruction,
  getAssociatedTokenAddressSync, getMintLen, mintTo,
} from "@solana/spl-token";
import * as fs from "fs";

const BN = (anchor as any).BN ?? (anchor as any).default?.BN;

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  const identityIdl = JSON.parse(fs.readFileSync("target/idl/passage_identity.json", "utf8"));
  const hookIdl = JSON.parse(fs.readFileSync("target/idl/passage_hook.json", "utf8"));
  const wrapperIdl = JSON.parse(fs.readFileSync("target/idl/passage_wrapper.json", "utf8"));
  const identity = new Program(identityIdl, provider);
  const hook = new Program(hookIdl, provider);
  const wrapper = new Program(wrapperIdl, provider);

  const DECIMALS = 6;
  const FEE_BPS = 10;

  console.log("payer:", payer.publicKey.toBase58());

  // 1. tUSDY test mint
  const assetMint = await createMint(connection, payer, payer.publicKey, null, DECIMALS);
  console.log("tUSDY mint:", assetMint.toBase58());
  const userAssetAta = await createAssociatedTokenAccountIdempotent(connection, payer, assetMint, payer.publicKey);
  await mintTo(connection, payer, assetMint, userAssetAta, payer, 1_000_000_000_000); // 1M tUSDY

  // 2. Vault PDA
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), assetMint.toBuffer()], wrapper.programId);

  // 3. pUSDY mint with transfer hook
  const pMintKp = Keypair.generate();
  const mintLen = getMintLen([ExtensionType.TransferHook]);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey, newAccountPubkey: pMintKp.publicKey,
      space: mintLen, lamports, programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeTransferHookInstruction(pMintKp.publicKey, payer.publicKey, hook.programId, TOKEN_2022_PROGRAM_ID),
    createInitializeMintInstruction(pMintKp.publicKey, DECIMALS, vaultPda, null, TOKEN_2022_PROGRAM_ID),
  );
  await sendAndConfirmTransaction(connection, tx, [payer, pMintKp]);
  console.log("pUSDY mint:", pMintKp.publicKey.toBase58());

  // 4. identity: config + verify the payer (idempotent)
  try { await identity.methods.initialize().rpc(); console.log("identity config created"); }
  catch { console.log("identity config already existed"); }
  try { await identity.methods.verifyWallet(payer.publicKey).rpc(); console.log("payer verified"); }
  catch { console.log("payer was already verified"); }

  // 5. meta-list + vault
  await hook.methods.initializeExtraAccountMetaList().accounts({ mint: pMintKp.publicKey }).rpc();
  await wrapper.methods.initializeVault(FEE_BPS).accounts({
    assetMint, pMint: pMintKp.publicKey, assetTokenProgram: TOKEN_PROGRAM_ID,
  }).rpc();
  console.log("vault:", vaultPda.toBase58());

  // 6. smoke-test: wrap 100 tUSDY
  const userPAta = getAssociatedTokenAddressSync(pMintKp.publicKey, payer.publicKey, false, TOKEN_2022_PROGRAM_ID);
  await createAssociatedTokenAccountIdempotent(connection, payer, pMintKp.publicKey, payer.publicKey, undefined, TOKEN_2022_PROGRAM_ID);
  await wrapper.methods.wrap(new BN(100_000_000)).accounts({
    vault: vaultPda, assetMint, pMint: pMintKp.publicKey,
    userAssetAccount: userAssetAta, userPAccount: userPAta,
    assetTokenProgram: TOKEN_PROGRAM_ID, pTokenProgram: TOKEN_2022_PROGRAM_ID,
  }).rpc();
  console.log("smoke-test wrap OK");

  fs.writeFileSync("devnet-addresses.json", JSON.stringify({
    cluster: "devnet",
    identityProgram: identity.programId.toBase58(),
    hookProgram: hook.programId.toBase58(),
    wrapperProgram: wrapper.programId.toBase58(),
    assetMint: assetMint.toBase58(),
    pMint: pMintKp.publicKey.toBase58(),
    vault: vaultPda.toBase58(),
    feeBps: FEE_BPS, decimals: DECIMALS,
  }, null, 2));
  console.log("addresses → devnet-addresses.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
