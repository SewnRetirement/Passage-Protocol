/**
 * Devnet setup for the demo faucet.
 *
 * Stands the faucet up, funds its signing PDA, and hands that PDA the two
 * authorities it needs: the tUSDY mint authority (to hand out test tokens) and
 * the identity registry authority (to issue credentials). Idempotent — safe to
 * re-run.
 *
 * Run:  ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
 *           ANCHOR_WALLET=~/.config/solana/id.json \
 *           npx ts-node scripts/setup-faucet.ts
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, setAuthority, AuthorityType, getMint } from "@solana/spl-token";
import * as fs from "fs";

const BN = (anchor as any).BN ?? (anchor as any).default?.BN;

const DRIP = new BN(1_000_000_000); // 1,000 tUSDY per claim
const SIGNER_FUNDING = 300_000_000; // 0.3 SOL, pays rent for new credentials

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  const addresses = JSON.parse(fs.readFileSync("devnet-addresses.json", "utf8"));
  const assetMint = new PublicKey(addresses.assetMint);

  const identityIdl = JSON.parse(fs.readFileSync("target/idl/passage_identity.json", "utf8"));
  const faucetIdl = JSON.parse(fs.readFileSync("target/idl/passage_demo_faucet.json", "utf8"));
  const identity = new Program(identityIdl, provider);
  const faucet = new Program(faucetIdl, provider);

  const [faucetPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("faucet")], faucet.programId);
  const [faucetSigner] = PublicKey.findProgramAddressSync(
    [Buffer.from("faucet-signer")], faucet.programId);
  const [identityConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")], identity.programId);

  console.log("faucet:       ", faucetPda.toBase58());
  console.log("faucet signer:", faucetSigner.toBase58());

  // 1. faucet config
  try {
    await faucet.methods.initialize(DRIP).accounts({
      assetMint, admin: payer.publicKey,
    }).rpc();
    console.log("faucet initialised");
  } catch {
    console.log("faucet already initialised");
  }

  // 2. fund the signing PDA so it can pay credential rent
  const signerBalance = await connection.getBalance(faucetSigner);
  if (signerBalance < SIGNER_FUNDING) {
    await sendAndConfirmTransaction(connection, new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: faucetSigner,
        lamports: SIGNER_FUNDING - signerBalance,
      })), [payer]);
    console.log("signer funded");
  } else {
    console.log("signer already funded:", signerBalance / 1e9, "SOL");
  }

  // 3. tUSDY mint authority -> faucet signer
  const mintInfo = await getMint(connection, assetMint, undefined, TOKEN_PROGRAM_ID);
  if (mintInfo.mintAuthority?.equals(faucetSigner)) {
    console.log("mint authority already delegated");
  } else {
    await setAuthority(connection, payer, assetMint, payer,
      AuthorityType.MintTokens, faucetSigner);
    console.log("mint authority -> faucet signer");
  }

  // 4. identity registry authority -> faucet signer
  const config: any = await (identity.account as any).config.fetch(identityConfig);
  if (config.authority.equals(faucetSigner)) {
    console.log("registry authority already delegated");
  } else {
    await identity.methods.setAuthority(faucetSigner)
      .accounts({ authority: payer.publicKey }).rpc();
    console.log("registry authority -> faucet signer");
  }

  addresses.faucetProgram = faucet.programId.toBase58();
  addresses.faucet = faucetPda.toBase58();
  addresses.faucetSigner = faucetSigner.toBase58();
  addresses.dripAmount = DRIP.toString();
  fs.writeFileSync("devnet-addresses.json", JSON.stringify(addresses, null, 2));
  console.log("addresses → devnet-addresses.json");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
