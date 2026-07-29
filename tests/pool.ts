import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair, PublicKey, SystemProgram, Transaction, ComputeBudgetProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ExtensionType,
  createMint, createAssociatedTokenAccountIdempotent,
  createInitializeMintInstruction, createInitializeTransferHookInstruction,
  getAssociatedTokenAddressSync, getMintLen, getAccount, mintTo,
} from "@solana/spl-token";
import { assert, expect } from "chai";

const BN = (anchor as any).BN ?? (anchor as any).default?.BN;

describe("Passage Pool (gated AMM)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  const identity = anchor.workspace.PassageIdentity as Program;
  const hook = anchor.workspace.PassageHook as Program;
  const wrapper = anchor.workspace.PassageWrapper as Program;
  const pool = anchor.workspace.PassagePool as Program;

  const DECIMALS = 6;
  let assetMint: PublicKey;   // tUSDY
  let quoteMint: PublicKey;   // mock USDC
  const pMintKp = Keypair.generate();
  const pMint = pMintKp.publicKey;
  const lpMintKp = Keypair.generate();
  const lpMint = lpMintKp.publicKey;

  let vaultPda: PublicKey;
  let poolPda: PublicKey;
  let metaListPda: PublicKey;

  const credPda = (w: PublicKey) => PublicKey.findProgramAddressSync(
    [Buffer.from("credential"), w.toBuffer()], identity.programId)[0];

  // remaining accounts needed for any pToken transfer inside the pool program
  const hookRemaining = (destOwner: PublicKey) => [
    { pubkey: hook.programId, isSigner: false, isWritable: false },
    { pubkey: metaListPda, isSigner: false, isWritable: false },
    { pubkey: identity.programId, isSigner: false, isWritable: false },
    { pubkey: credPda(destOwner), isSigner: false, isWritable: false },
  ];

  const cu = ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });

  before(async () => {
    // mints
    assetMint = await createMint(connection, payer, payer.publicKey, null, DECIMALS);
    quoteMint = await createMint(connection, payer, payer.publicKey, null, DECIMALS);

    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), assetMint.toBuffer()], wrapper.programId);
    [metaListPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("extra-account-metas"), pMint.toBuffer()], hook.programId);

    // pToken mint with transfer hook
    const mintLen = getMintLen([ExtensionType.TransferHook]);
    const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);
    await sendAndConfirmTransaction(connection, new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey, newAccountPubkey: pMint,
        space: mintLen, lamports, programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeTransferHookInstruction(pMint, payer.publicKey, hook.programId, TOKEN_2022_PROGRAM_ID),
      createInitializeMintInstruction(pMint, DECIMALS, vaultPda, null, TOKEN_2022_PROGRAM_ID),
    ), [payer, pMintKp]);

    // identity (config may exist from the other suite), verify payer
    try { await identity.methods.initialize().rpc(); } catch {}
    try { await identity.methods.verifyWallet(payer.publicKey).rpc(); } catch {}

    await hook.methods.initializeExtraAccountMetaList().accounts({ mint: pMint }).rpc();
    await wrapper.methods.initializeVault(10).accounts({
      assetMint, pMint, assetTokenProgram: TOKEN_PROGRAM_ID,
    }).rpc();

    // fund payer: tUSDY + USDC, wrap tUSDY -> pUSDY
    const userAssetAta = await createAssociatedTokenAccountIdempotent(connection, payer, assetMint, payer.publicKey);
    const userQuoteAta = await createAssociatedTokenAccountIdempotent(connection, payer, quoteMint, payer.publicKey);
    await mintTo(connection, payer, assetMint, userAssetAta, payer, 1_000_000_000);
    await mintTo(connection, payer, quoteMint, userQuoteAta, payer, 1_000_000_000);
    await createAssociatedTokenAccountIdempotent(connection, payer, pMint, payer.publicKey, undefined, TOKEN_2022_PROGRAM_ID);
    await wrapper.methods.wrap(new BN(500_000_000)).accounts({
      vault: vaultPda, assetMint, pMint,
      userAssetAccount: userAssetAta,
      userPAccount: getAssociatedTokenAddressSync(pMint, payer.publicKey, false, TOKEN_2022_PROGRAM_ID),
      assetTokenProgram: TOKEN_PROGRAM_ID, pTokenProgram: TOKEN_2022_PROGRAM_ID,
    }).rpc();

    [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), pMint.toBuffer(), quoteMint.toBuffer()], pool.programId);
  });

  it("initializes the pool and verifies the pool PDA", async () => {
    await pool.methods.initializePool().accounts({
      pMint, quoteMint, lpMint,
      pTokenProgram: TOKEN_2022_PROGRAM_ID,
      quoteTokenProgram: TOKEN_PROGRAM_ID,
    }).signers([lpMintKp]).rpc();

    // the pool PDA gets a credential so it may hold pTokens
    await identity.methods.verifyWallet(poolPda).rpc();
    const state = await (pool.account as any).pool.fetch(poolPda);
    assert.ok(state.pMint.equals(pMint));
  });

  it("adds initial liquidity (100 pUSDY + 100 USDC)", async () => {
    await createAssociatedTokenAccountIdempotent(connection, payer, lpMint, payer.publicKey);
    const ix = await pool.methods
      .addLiquidity(new BN(100_000_000), new BN(100_000_000))
      .accounts({
        pool: poolPda, pMint, quoteMint, lpMint,
        userPAccount: getAssociatedTokenAddressSync(pMint, payer.publicKey, false, TOKEN_2022_PROGRAM_ID),
        userQuoteAccount: getAssociatedTokenAddressSync(quoteMint, payer.publicKey),
        userLpAccount: getAssociatedTokenAddressSync(lpMint, payer.publicKey),
        pTokenProgram: TOKEN_2022_PROGRAM_ID,
        quoteTokenProgram: TOKEN_PROGRAM_ID,
        lpTokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(hookRemaining(poolPda)) // pToken goes TO the pool
      .instruction();
    await sendAndConfirmTransaction(connection, new Transaction().add(cu, ix), [payer]);

    const lpBal = await getAccount(connection, getAssociatedTokenAddressSync(lpMint, payer.publicKey));
    assert.equal(Number(lpBal.amount), 100_000_000); // sqrt(x*y) = 100
  });

  it("swaps USDC -> pUSDY (user must be verified)", async () => {
    const userP = getAssociatedTokenAddressSync(pMint, payer.publicKey, false, TOKEN_2022_PROGRAM_ID);
    const before = await getAccount(connection, userP, undefined, TOKEN_2022_PROGRAM_ID);

    const ix = await pool.methods
      .swap(new BN(10_000_000), new BN(8_000_000), false)
      .accounts({
        pool: poolPda, pMint, quoteMint,
        userPAccount: userP,
        userQuoteAccount: getAssociatedTokenAddressSync(quoteMint, payer.publicKey),
        pTokenProgram: TOKEN_2022_PROGRAM_ID,
        quoteTokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(hookRemaining(payer.publicKey)) // pToken goes TO the user
      .instruction();
    await sendAndConfirmTransaction(connection, new Transaction().add(cu, ix), [payer]);

    const after = await getAccount(connection, userP, undefined, TOKEN_2022_PROGRAM_ID);
    const got = Number(after.amount) - Number(before.amount);
    // x*y=k: 100 out of ~110 in pool → ~9.06 pUSDY for 10 USDC (0.25% fee)
    assert.isAbove(got, 9_000_000);
    assert.isBelow(got, 9_100_000);
  });

  it("swaps pUSDY -> USDC", async () => {
    const userQ = getAssociatedTokenAddressSync(quoteMint, payer.publicKey);
    const before = await getAccount(connection, userQ);

    const ix = await pool.methods
      .swap(new BN(5_000_000), new BN(4_000_000), true)
      .accounts({
        pool: poolPda, pMint, quoteMint,
        userPAccount: getAssociatedTokenAddressSync(pMint, payer.publicKey, false, TOKEN_2022_PROGRAM_ID),
        userQuoteAccount: userQ,
        pTokenProgram: TOKEN_2022_PROGRAM_ID,
        quoteTokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(hookRemaining(poolPda)) // pToken goes TO the pool
      .instruction();
    await sendAndConfirmTransaction(connection, new Transaction().add(cu, ix), [payer]);

    const after = await getAccount(connection, userQ);
    assert.isAbove(Number(after.amount) - Number(before.amount), 4_000_000);
  });

  it("blocks buying pUSDY for an UNVERIFIED wallet", async () => {
    const mallory = Keypair.generate();
    const sig = await connection.requestAirdrop(mallory.publicKey, 2e9);
    await connection.confirmTransaction(sig);

    const malloryQ = await createAssociatedTokenAccountIdempotent(connection, payer, quoteMint, mallory.publicKey);
    await mintTo(connection, payer, quoteMint, malloryQ, payer, 50_000_000);
    const malloryP = await createAssociatedTokenAccountIdempotent(connection, payer, pMint, mallory.publicKey, undefined, TOKEN_2022_PROGRAM_ID);

    const ix = await pool.methods
      .swap(new BN(10_000_000), new BN(1), false)
      .accounts({
        pool: poolPda, pMint, quoteMint,
        userPAccount: malloryP,
        userQuoteAccount: malloryQ,
        user: mallory.publicKey,
        pTokenProgram: TOKEN_2022_PROGRAM_ID,
        quoteTokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(hookRemaining(mallory.publicKey))
      .instruction();
    try {
      await sendAndConfirmTransaction(connection, new Transaction().add(cu, ix), [mallory]);
      assert.fail("swap to unverified wallet should have failed");
    } catch (e: any) {
      const msg = e.toString() + JSON.stringify((e as any).logs ?? []);
      expect(msg).to.match(/0x1770|ReceiverNotVerified|custom program error/);
      expect(msg).to.not.include("should have failed");
    }
  });

  it("removes liquidity", async () => {
    const userLp = getAssociatedTokenAddressSync(lpMint, payer.publicKey);
    const ix = await pool.methods
      .removeLiquidity(new BN(50_000_000))
      .accounts({
        pool: poolPda, pMint, quoteMint, lpMint,
        userPAccount: getAssociatedTokenAddressSync(pMint, payer.publicKey, false, TOKEN_2022_PROGRAM_ID),
        userQuoteAccount: getAssociatedTokenAddressSync(quoteMint, payer.publicKey),
        userLpAccount: userLp,
        pTokenProgram: TOKEN_2022_PROGRAM_ID,
        quoteTokenProgram: TOKEN_PROGRAM_ID,
        lpTokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(hookRemaining(payer.publicKey)) // pToken back TO the user
      .instruction();
    await sendAndConfirmTransaction(connection, new Transaction().add(cu, ix), [payer]);

    const lpBal = await getAccount(connection, userLp);
    assert.equal(Number(lpBal.amount), 50_000_000);
  });
});
