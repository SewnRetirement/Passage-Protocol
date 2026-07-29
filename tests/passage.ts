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

// BN robuust ophalen (werkt onder zowel CJS als ESM interop)
const BN = (anchor as any).BN ?? (anchor as any).default?.BN;

describe("Passage Protocol MVP", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  const identity = anchor.workspace.PassageIdentity as Program;
  const hook = anchor.workspace.PassageHook as Program;
  const wrapper = anchor.workspace.PassageWrapper as Program;

  // acteurs
  const user2 = Keypair.generate(); // geverifieerd
  const mallory = Keypair.generate(); // NIET geverifieerd
  const treasury = Keypair.generate();

  // token state
  let assetMint: PublicKey;
  const pMintKp = Keypair.generate();
  const pMint = pMintKp.publicKey;
  const DECIMALS = 6;
  const FEE_BPS = 10; // 0,10%

  let vaultPda: PublicKey;
  let userAssetAta: PublicKey;
  let userPAta: PublicKey;

  const credentialPda = (wallet: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("credential"), wallet.toBuffer()],
      identity.programId
    )[0];

  before(async () => {
    // SOL voor acteurs
    for (const kp of [user2, mallory, treasury]) {
      const sig = await connection.requestAirdrop(kp.publicKey, 2e9);
      await connection.confirmTransaction(sig);
    }

    // 1. Onderliggende RWA-testtoken (klassieke SPL)
    assetMint = await createMint(
      connection, payer, payer.publicKey, null, DECIMALS
    );
    userAssetAta = await createAssociatedTokenAccountIdempotent(
      connection, payer, assetMint, payer.publicKey
    );
    await mintTo(connection, payer, assetMint, userAssetAta, payer, 1_000_000_000); // 1000 tokens

    // 2. Vault-PDA vooraf berekenen
    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), assetMint.toBuffer()],
      wrapper.programId
    );

    // 3. pToken-mint (Token-2022) met transfer hook, mint authority = vault-PDA
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

  it("initialiseert de identity-registry en verifieert wallets", async () => {
    await identity.methods.initialize().rpc();
    await identity.methods.verifyWallet(payer.publicKey).rpc();
    await identity.methods.verifyWallet(user2.publicKey).rpc();

    const cred = await (identity.account as any).credential.fetch(
      credentialPda(user2.publicKey)
    );
    assert.ok(cred.wallet.equals(user2.publicKey));
  });

  it("initialiseert de extra-account-meta-list voor de pToken", async () => {
    await hook.methods
      .initializeExtraAccountMetaList()
      .accounts({ mint: pMint })
      .rpc();
  });

  it("initialiseert de vault", async () => {
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

  it("wrapt: 100 asset in → 99,9 pToken uit (0,10% fee)", async () => {
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

  it("staat pToken-transfer naar een GEVERIFIEERDE wallet toe", async () => {
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

  it("blokkeert pToken-transfer naar een NIET-geverifieerde wallet", async () => {
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
      assert.fail("transfer naar niet-geverifieerde wallet had moeten falen");
    } catch (e: any) {
      // moet falen met de hook-error (6000 = 0x1770 ReceiverNotVerified),
      // niet met een willekeurige andere fout
      const msg = e.toString() + JSON.stringify((e as any).logs ?? []);
      expect(msg).to.match(/0x1770|ReceiverNotVerified|custom program error/);
      expect(msg).to.not.include("had moeten falen");
    }
  });

  it("unwrapt: pToken terug naar asset (met fee)", async () => {
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

  it("int fees naar de treasury", async () => {
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
