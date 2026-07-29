import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  ExtensionType,
  createMint,
  createAssociatedTokenAccountIdempotent,
  createInitializeMintInstruction,
  createInitializeTransferHookInstruction,
  createTransferCheckedWithTransferHookInstruction,
  getAssociatedTokenAddressSync,
  getMintLen,
  getAccount,
  mintTo,
} from "@solana/spl-token";
import { assert, expect } from "chai";

// Resolve BN robustly (works under both CJS and ESM interop)
const BN = (anchor as any).BN ?? (anchor as any).default?.BN;

describe("Passage Protocol MVP", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  const identity = anchor.workspace.PassageIdentity as Program;
  const hook = anchor.workspace.PassageHook as Program;
  const wrapper = anchor.workspace.PassageWrapper as Program;

  // actors
  const user2 = Keypair.generate(); // verified
  const mallory = Keypair.generate(); // NOT verified
  const treasury = Keypair.generate();

  // token state
  let assetMint: PublicKey;
  const pMintKp = Keypair.generate();
  const pMint = pMintKp.publicKey;
  const DECIMALS = 6;
  const FEE_BPS = 10; // 0.10%

  let vaultPda: PublicKey;
  let userAssetAta: PublicKey;
  let userPAta: PublicKey;

  const credentialPda = (wallet: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("credential"), wallet.toBuffer()],
      identity.programId
    )[0];

  before(async () => {
    // SOL for the actors
    for (const kp of [user2, mallory, treasury]) {
      const sig = await connection.requestAirdrop(kp.publicKey, 2e9);
      await connection.confirmTransaction(sig);
    }

    // 1. Underlying RWA test token (classic SPL)
    assetMint = await createMint(
      connection, payer, payer.publicKey, null, DECIMALS
    );
    userAssetAta = await createAssociatedTokenAccountIdempotent(
      connection, payer, assetMint, payer.publicKey
    );
    await mintTo(connection, payer, assetMint, userAssetAta, payer, 1_000_000_000); // 1,000 tokens

    // 2. Precompute the vault PDA
    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), assetMint.toBuffer()],
      wrapper.programId
    );

    // 3. pToken mint (Token-2022) with transfer hook, mint authority = vault PDA
    const mintLen = getMintLen([ExtensionType.TransferHook]);
    const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);
    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: pMint,
        space: mintLen,
        lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeTransferHookInstruction(
        pMint, payer.publicKey, hook.programId, TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMintInstruction(
        pMint, DECIMALS, vaultPda, null, TOKEN_2022_PROGRAM_ID
      )
    );
    await sendAndConfirmTransaction(connection, tx, [payer, pMintKp]);

    userPAta = getAssociatedTokenAddressSync(
      pMint, payer.publicKey, false, TOKEN_2022_PROGRAM_ID
    );
    await createAssociatedTokenAccountIdempotent(
      connection, payer, pMint, payer.publicKey, undefined, TOKEN_2022_PROGRAM_ID
    );
  });

  it("initializes the identity registry and verifies wallets", async () => {
    await identity.methods.initialize().rpc();
    await identity.methods.verifyWallet(payer.publicKey).rpc();
    await identity.methods.verifyWallet(user2.publicKey).rpc();

    const cred = await (identity.account as any).credential.fetch(
      credentialPda(user2.publicKey)
    );
    assert.ok(cred.wallet.equals(user2.publicKey));
  });

  it("initializes the extra-account-meta-list for the pToken", async () => {
    await hook.methods
      .initializeExtraAccountMetaList()
      .accounts({ mint: pMint })
      .rpc();
  });

  it("initializes the vault", async () => {
    await wrapper.methods
      .initializeVault(FEE_BPS)
      .accounts({
        assetMint,
        pMint,
        assetTokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const vault = await (wrapper.account as any).vault.fetch(vaultPda);
    assert.equal(vault.feeBps, FEE_BPS);
    assert.ok(vault.pMint.equals(pMint));
  });

  it("wraps: 100 assets in → 99.9 pTokens out (0.10% fee)", async () => {
    const amount = 100_000_000; // 100 tokens
    const expectedFee = (amount * FEE_BPS) / 10_000; // 100_000
    await wrapper.methods
      .wrap(new BN(amount))
      .accounts({
        vault: vaultPda,
        assetMint,
        pMint,
        userAssetAccount: userAssetAta,
        userPAccount: userPAta,
        assetTokenProgram: TOKEN_PROGRAM_ID,
        pTokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    const pBal = await getAccount(connection, userPAta, undefined, TOKEN_2022_PROGRAM_ID);
    assert.equal(Number(pBal.amount), amount - expectedFee);

    const vault = await (wrapper.account as any).vault.fetch(vaultPda);
    assert.equal(Number(vault.accruedFees), expectedFee);
  });

  it("allows pToken transfer to a VERIFIED wallet", async () => {
    const destAta = await createAssociatedTokenAccountIdempotent(
      connection, payer, pMint, user2.publicKey, undefined, TOKEN_2022_PROGRAM_ID
    );
    const ix = await createTransferCheckedWithTransferHookInstruction(
      connection,
      userPAta, pMint, destAta, payer.publicKey,
      BigInt(10_000_000), DECIMALS, [], undefined, TOKEN_2022_PROGRAM_ID
    );
    await sendAndConfirmTransaction(connection, new Transaction().add(ix), [payer]);

    const bal = await getAccount(connection, destAta, undefined, TOKEN_2022_PROGRAM_ID);
    assert.equal(Number(bal.amount), 10_000_000);
  });

  it("blocks pToken transfer to an UNVERIFIED wallet", async () => {
    const malloryAta = await createAssociatedTokenAccountIdempotent(
      connection, payer, pMint, mallory.publicKey, undefined, TOKEN_2022_PROGRAM_ID
    );
    const ix = await createTransferCheckedWithTransferHookInstruction(
      connection,
      userPAta, pMint, malloryAta, payer.publicKey,
      BigInt(1_000_000), DECIMALS, [], undefined, TOKEN_2022_PROGRAM_ID
    );
    try {
      await sendAndConfirmTransaction(connection, new Transaction().add(ix), [payer]);
      assert.fail("transfer to unverified wallet should have failed");
    } catch (e: any) {
      // must fail with the hook error (6000 = 0x1770 ReceiverNotVerified),
      // not with some arbitrary other error
      const msg = e.toString() + JSON.stringify((e as any).logs ?? []);
      expect(msg).to.match(/0x1770|ReceiverNotVerified|custom program error/);
      expect(msg).to.not.include("should have failed");
    }
  });

  it("unwraps: pToken back to asset (with fee)", async () => {
    const amount = 50_000_000; // 50 pTokens
    const expectedFee = (amount * FEE_BPS) / 10_000;
    const before = await getAccount(connection, userAssetAta);

    await wrapper.methods
      .unwrap(new BN(amount))
      .accounts({
        vault: vaultPda,
        assetMint,
        pMint,
        userAssetAccount: userAssetAta,
        userPAccount: userPAta,
        assetTokenProgram: TOKEN_PROGRAM_ID,
        pTokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    const after = await getAccount(connection, userAssetAta);
    assert.equal(Number(after.amount) - Number(before.amount), amount - expectedFee);
  });

  it("collects fees to the treasury", async () => {
    const treasuryAta = await createAssociatedTokenAccountIdempotent(
      connection, payer, assetMint, treasury.publicKey
    );
    const vaultBefore = await (wrapper.account as any).vault.fetch(vaultPda);
    const fees = Number(vaultBefore.accruedFees);
    assert.isAbove(fees, 0);

    await wrapper.methods
      .collectFees()
      .accounts({
        vault: vaultPda,
        assetMint,
        treasuryAssetAccount: treasuryAta,
        assetTokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const bal = await getAccount(connection, treasuryAta);
    assert.equal(Number(bal.amount), fees);
    const vaultAfter = await (wrapper.account as any).vault.fetch(vaultPda);
    assert.equal(Number(vaultAfter.accruedFees), 0);
  });
});
