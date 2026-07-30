import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ExtensionType,
  createMint, createAssociatedTokenAccountIdempotent,
  createInitializeMintInstruction, createInitializeTransferHookInstruction,
  getAccount, getMintLen, setAuthority, AuthorityType,
} from "@solana/spl-token";
import { assert } from "chai";

const BN = (anchor as any).BN ?? (anchor as any).default?.BN;

describe("Passage demo faucet", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  const identity = anchor.workspace.PassageIdentity as Program;
  const hook = anchor.workspace.PassageHook as Program;
  const wrapper = anchor.workspace.PassageWrapper as Program;
  const faucet = anchor.workspace.PassageDemoFaucet as Program;

  const DECIMALS = 6;
  const FEE_BPS = 10;
  const DRIP = new BN(1_000_000_000); // 1,000 tUSDY

  // A brand-new visitor: no credential, no tokens, like anyone opening the demo.
  const visitor = Keypair.generate();

  let assetMint: PublicKey;
  const pMintKp = Keypair.generate();
  let vaultPda: PublicKey;
  let faucetPda: PublicKey;
  let faucetSigner: PublicKey;

  const credentialPda = (wallet: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("credential"), wallet.toBuffer()], identity.programId)[0];
  const identityConfig = () =>
    PublicKey.findProgramAddressSync([Buffer.from("config")], identity.programId)[0];
  const ata = (owner: PublicKey, mint: PublicKey, tokenProgram: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [owner.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()],
      new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"))[0];

  before(async () => {
    await connection.confirmTransaction(
      await connection.requestAirdrop(visitor.publicKey, 2_000_000_000), "confirmed");

    [faucetPda] = PublicKey.findProgramAddressSync([Buffer.from("faucet")], faucet.programId);
    [faucetSigner] = PublicKey.findProgramAddressSync(
      [Buffer.from("faucet-signer")], faucet.programId);

    // tUSDY test asset
    assetMint = await createMint(connection, payer, payer.publicKey, null, DECIMALS);

    // pUSDY with the transfer hook
    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), assetMint.toBuffer()], wrapper.programId);
    const mintLen = getMintLen([ExtensionType.TransferHook]);
    await sendAndConfirmTransaction(connection, new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey, newAccountPubkey: pMintKp.publicKey,
        space: mintLen,
        lamports: await connection.getMinimumBalanceForRentExemption(mintLen),
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeTransferHookInstruction(
        pMintKp.publicKey, payer.publicKey, hook.programId, TOKEN_2022_PROGRAM_ID),
      createInitializeMintInstruction(
        pMintKp.publicKey, DECIMALS, vaultPda, null, TOKEN_2022_PROGRAM_ID),
    ), [payer, pMintKp]);

    await identity.methods.initialize().rpc();
    await hook.methods.initializeExtraAccountMetaList()
      .accounts({ mint: pMintKp.publicKey }).rpc();
    await wrapper.methods.initializeVault(FEE_BPS).accounts({
      assetMint, pMint: pMintKp.publicKey, assetTokenProgram: TOKEN_PROGRAM_ID,
    }).rpc();

    // Stand the faucet up, then hand it the two authorities it needs.
    await faucet.methods.initialize(DRIP).accounts({
      assetMint, admin: payer.publicKey,
    }).rpc();

    await setAuthority(connection, payer, assetMint, payer,
      AuthorityType.MintTokens, faucetSigner);
    await identity.methods.setAuthority(faucetSigner).accounts({
      authority: payer.publicKey,
    }).rpc();

    // The signer PDA pays rent for the credentials it creates.
    await sendAndConfirmTransaction(connection, new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey, toPubkey: faucetSigner, lamports: 200_000_000,
      })), [payer]);
  });

  const claim = async (who: Keypair) => {
    const userAta = await createAssociatedTokenAccountIdempotent(
      connection, payer, assetMint, who.publicKey);
    await faucet.methods.claim().accounts({
      faucet: faucetPda,
      faucetSigner,
      identityConfig: identityConfig(),
      credential: credentialPda(who.publicKey),
      identityProgram: identity.programId,
      assetMint,
      userAssetAccount: userAta,
      user: who.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    }).signers([who]).rpc();
    return userAta;
  };

  it("a fresh visitor starts with no credential", async () => {
    const cred = await connection.getAccountInfo(credentialPda(visitor.publicKey));
    assert.isNull(cred, "visitor should not be verified yet");
  });

  it("claim verifies the wallet and mints test tokens", async () => {
    const userAta = await claim(visitor);

    const cred = await connection.getAccountInfo(credentialPda(visitor.publicKey));
    assert.isNotNull(cred, "credential should exist after claiming");
    assert.equal(cred!.owner.toBase58(), identity.programId.toBase58());

    const bal = await getAccount(connection, userAta);
    assert.equal(bal.amount.toString(), DRIP.toString());
  });

  it("claiming again tops up without failing on the existing credential", async () => {
    const userAta = await claim(visitor);
    const bal = await getAccount(connection, userAta);
    assert.equal(bal.amount.toString(), DRIP.muln(2).toString());
  });

  it("a claimed wallet can actually wrap — the credential satisfies the hook", async () => {
    const userAsset = ata(visitor.publicKey, assetMint, TOKEN_PROGRAM_ID);
    const userP = await createAssociatedTokenAccountIdempotent(
      connection, payer, pMintKp.publicKey, visitor.publicKey,
      undefined, TOKEN_2022_PROGRAM_ID);
    const vaultAsset = await createAssociatedTokenAccountIdempotent(
      connection, payer, assetMint, vaultPda, undefined, TOKEN_PROGRAM_ID, undefined, true);

    const amount = new BN(100_000_000); // 100 tUSDY
    await wrapper.methods.wrap(amount).accounts({
      vault: vaultPda,
      assetMint,
      pMint: pMintKp.publicKey,
      userAssetAccount: userAsset,
      vaultAssetAccount: vaultAsset,
      userPAccount: userP,
      user: visitor.publicKey,
      assetTokenProgram: TOKEN_PROGRAM_ID,
      pTokenProgram: TOKEN_2022_PROGRAM_ID,
    }).signers([visitor]).rpc();

    const pBal = await getAccount(connection, userP, undefined, TOKEN_2022_PROGRAM_ID);
    const fee = amount.muln(FEE_BPS).divn(10_000);
    assert.equal(pBal.amount.toString(), amount.sub(fee).toString());
  });

  it("an unverified wallet still cannot receive pTokens", async () => {
    const mallory = Keypair.generate();
    const malloryP = await createAssociatedTokenAccountIdempotent(
      connection, payer, pMintKp.publicKey, mallory.publicKey,
      undefined, TOKEN_2022_PROGRAM_ID);
    const cred = await connection.getAccountInfo(credentialPda(mallory.publicKey));
    assert.isNull(cred, "mallory never claimed, so she has no credential");
    // The hook rejection itself is covered in passage.ts; here we only assert
    // that the faucet did not quietly verify anyone it wasn't asked to.
  });

  it("rejects a drip amount above the cap", async () => {
    try {
      await faucet.methods.setDripAmount(new BN("20000000000")).accounts({
        faucet: faucetPda, admin: payer.publicKey,
      }).rpc();
      assert.fail("should have rejected an oversized drip");
    } catch (e: any) {
      assert.match(e.toString(), /InvalidDripAmount|0x1770/);
    }
  });

  it("only the admin can change the drip amount", async () => {
    try {
      await faucet.methods.setDripAmount(new BN(1)).accounts({
        faucet: faucetPda, admin: visitor.publicKey,
      }).signers([visitor]).rpc();
      assert.fail("a non-admin should not be able to change the drip");
    } catch (e: any) {
      assert.match(e.toString(), /has_one|ConstraintHasOne|2001|unknown signer/i);
    }
  });
});
