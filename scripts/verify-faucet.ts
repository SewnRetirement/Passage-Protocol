/**
 * End-to-end check against devnet: a brand-new wallet claims from the faucet
 * and then wraps, exactly like a visitor opening the demo would.
 *
 * Run:  ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
 *           ANCHOR_WALLET=~/.config/solana/id.json \
 *           npx ts-node scripts/verify-faucet.ts
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotent, getAccount,
} from "@solana/spl-token";
import * as fs from "fs";

const BN = (anchor as any).BN ?? (anchor as any).default?.BN;

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  const a = JSON.parse(fs.readFileSync("devnet-addresses.json", "utf8"));
  const assetMint = new PublicKey(a.assetMint);
  const pMint = new PublicKey(a.pMint);

  const identity = new Program(
    JSON.parse(fs.readFileSync("target/idl/passage_identity.json", "utf8")), provider);
  const wrapper = new Program(
    JSON.parse(fs.readFileSync("target/idl/passage_wrapper.json", "utf8")), provider);
  const faucet = new Program(
    JSON.parse(fs.readFileSync("target/idl/passage_demo_faucet.json", "utf8")), provider);

  const [faucetPda] = PublicKey.findProgramAddressSync([Buffer.from("faucet")], faucet.programId);
  const [faucetSigner] = PublicKey.findProgramAddressSync(
    [Buffer.from("faucet-signer")], faucet.programId);
  const [identityConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")], identity.programId);
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), assetMint.toBuffer()], wrapper.programId);

  // A wallet nobody has ever seen before.
  const visitor = Keypair.generate();
  console.log("fresh visitor:", visitor.publicKey.toBase58());
  await sendAndConfirmTransaction(connection, new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey, toPubkey: visitor.publicKey, lamports: 30_000_000,
    })), [payer]);

  const [credential] = PublicKey.findProgramAddressSync(
    [Buffer.from("credential"), visitor.publicKey.toBuffer()], identity.programId);
  console.log("verified before claim:",
    (await connection.getAccountInfo(credential)) !== null);

  const userAsset = await createAssociatedTokenAccountIdempotent(
    connection, payer, assetMint, visitor.publicKey);

  await faucet.methods.claim().accounts({
    faucet: faucetPda,
    faucetSigner,
    identityConfig,
    credential,
    identityProgram: identity.programId,
    assetMint,
    userAssetAccount: userAsset,
    user: visitor.publicKey,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  }).signers([visitor]).rpc();

  console.log("verified after claim: ",
    (await connection.getAccountInfo(credential)) !== null);
  console.log("tUSDY balance:        ",
    Number((await getAccount(connection, userAsset)).amount) / 1e6);

  // And the credential actually satisfies the transfer hook.
  const userP = await createAssociatedTokenAccountIdempotent(
    connection, payer, pMint, visitor.publicKey, undefined, TOKEN_2022_PROGRAM_ID);
  const vaultAsset = await createAssociatedTokenAccountIdempotent(
    connection, payer, assetMint, vaultPda, undefined, TOKEN_PROGRAM_ID, undefined, true);

  await wrapper.methods.wrap(new BN(100_000_000)).accounts({
    vault: vaultPda, assetMint, pMint,
    userAssetAccount: userAsset, vaultAssetAccount: vaultAsset, userPAccount: userP,
    user: visitor.publicKey,
    assetTokenProgram: TOKEN_PROGRAM_ID, pTokenProgram: TOKEN_2022_PROGRAM_ID,
  }).signers([visitor]).rpc();

  console.log("pUSDY after wrap:     ",
    Number((await getAccount(connection, userP, undefined, TOKEN_2022_PROGRAM_ID)).amount) / 1e6);
  console.log("OK — claim + wrap works for a fresh wallet");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
