/**
 * Checks hook-kit against the live devnet deployment: the accounts it resolves
 * must be exactly the ones the working pool and wrapper code passes by hand.
 */
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const kit = require('./dist/index.js');
const fs = require('fs');

const a = JSON.parse(fs.readFileSync(__dirname + '/../../devnet-addresses.json', 'utf8'));
const P = (k) => new PublicKey(a[k]);

const ATA = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const ata = (owner, mint, prog) =>
  PublicKey.findProgramAddressSync(
    [owner.toBuffer(), prog.toBuffer(), mint.toBuffer()], ATA)[0];

(async () => {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const pMint = P('pMint');
  const assetMint = P('assetMint');
  const identityProgram = P('identityProgram');
  const hookProgram = P('hookProgram');
  const pool = P('pool');

  let failures = 0;
  const check = (label, actual, expected) => {
    const ok = actual === expected;
    console.log(`${ok ? 'OK  ' : 'FAIL'}  ${label}`);
    if (!ok) { console.log(`        verwacht: ${expected}`); console.log(`        gekregen: ${actual}`); failures++; }
  };

  // 1. detects the hook on pUSDY, and its absence on plain tUSDY
  const found = await kit.getHookProgramId(connection, pMint);
  check('hook gevonden op pUSDY', found?.toBase58(), hookProgram.toBase58());

  const noHook = await kit.getHookProgramId(connection, assetMint, TOKEN_PROGRAM_ID);
  check('geen hook op tUSDY (SPL-token)', String(noHook), 'null');
  check('hasTransferHook(pUSDY)', String(await kit.hasTransferHook(connection, pMint)), 'true');

  // 2. meta-list address matches what the on-chain program derives
  const metaList = kit.getMetaListAddress(pMint, hookProgram);
  check('meta-list adres', metaList.toBase58(), a.metaList);

  // 3. extras for a real transfer: the identity program plus the recipient's
  //    credential PDA, derived from data inside the destination token account.
  //    The deployer wallet has a pUSDY account on devnet, so it can be read.
  const someone = new PublicKey('Hqw3vKEwy7LmPnmCeFYhHVN7waEEhXVLMX3dvNGJp3hR');
  const ctx = {
    mint: pMint,
    source: ata(pool, pMint, TOKEN_2022_PROGRAM_ID),
    destination: ata(someone, pMint, TOKEN_2022_PROGRAM_ID),
    owner: pool,
    amount: 1_000_000n,
  };
  const cred = PublicKey.findProgramAddressSync(
    [Buffer.from('credential'), someone.toBuffer()], identityProgram)[0];

  const extras = await kit.resolveHookAccounts(connection, ctx);
  check('aantal extra accounts', String(extras.length), '2');
  check('extra[0] = identity program', extras[0]?.pubkey.toBase58(), identityProgram.toBase58());
  check('extra[1] = credential PDA van ontvanger', extras[1]?.pubkey.toBase58(), cred.toBase58());

  // 4. the CPI ordering our pool program actually uses
  const cpi = await kit.hookAccountsForCpi(connection, ctx);
  check('cpi accounts', cpi.map(k => k.pubkey.toBase58()).join(','),
    [hookProgram, metaList, identityProgram, cred].map(k => k.toBase58()).join(','));

  // 5. a destination that does not exist yet gives a readable error instead of
  //    the bare "not found" the SPL library throws
  try {
    await kit.resolveHookAccounts(connection, {
      ...ctx,
      destination: ata(Keypair.generate().publicKey, pMint, TOKEN_2022_PROGRAM_ID),
    });
    check('onbestaand doelaccount geeft duidelijke fout', 'geen fout', 'HookResolutionError');
  } catch (e) {
    check('onbestaand doelaccount geeft duidelijke fout', e.name, 'HookResolutionError');
    const helpful = /does not exist on-chain yet/.test(e.message);
    check('foutmelding legt de oorzaak uit', String(helpful), 'true');
  }

  // 6. a mint without a hook resolves to nothing rather than throwing
  const none = await kit.resolveHookAccounts(connection, {
    mint: assetMint,
    source: ata(pool, assetMint, TOKEN_PROGRAM_ID),
    destination: ata(someone, assetMint, TOKEN_PROGRAM_ID),
    owner: pool,
    amount: 1n,
    tokenProgramId: TOKEN_PROGRAM_ID,
  });
  check('geen hook -> lege lijst', String(none.length), '0');

  console.log(failures === 0 ? '\nalle checks geslaagd' : `\n${failures} check(s) gefaald`);
  process.exit(failures === 0 ? 0 : 1);
})();
