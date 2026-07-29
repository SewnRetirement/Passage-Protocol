# Passage Protocol

**The compliance bridge that makes permissioned RWAs DeFi-composable — on Solana.**

Nearly $30B of tokenized real-world assets sit on-chain today, yet only ~8% circulates
in DeFi because the tokens are permissioned (KYC allowlists, transfer agents). Passage
solves this by putting compliance **inside the token itself**:

1. Deposit a permissioned RWA token into the **vault** → receive a **pToken** 1:1.
2. The pToken is a Token-2022 mint with a **transfer hook**: every transfer verifies
   on-chain that the recipient holds a **credential** in the identity registry.
3. Result: freely composable in DeFi (DEX, lending, staking), but only between
   verified wallets. Wrap/unwrap fees are protocol revenue.

## Architecture

| Program | ID (localnet/devnet) | Purpose |
|---|---|---|
| `passage_wrapper` | `HuM2...xagX` | Vault: wrap/unwrap 1:1, fee accrual, collect_fees |
| `passage_identity` | `8ueu...Gpup` | Registry: verify/revoke wallet credentials (PDA per wallet) |
| `passage_hook` | `2t8m...13Nf` | Token-2022 transfer hook: blocks transfers to unverified wallets |
| `passage_pool` | `2Sj6...33aJ` | Gated constant-product AMM: pToken/USDC swaps between verified wallets |

Flow of a pToken transfer:

```
user → Token-2022 transfer_checked
         └─ CPI → passage_hook::Execute
                    ├─ reads owner of destination token account
                    ├─ resolves credential PDA ["credential", dest_owner]
                    └─ no valid credential? → transaction fails
```

## Setup

```bash
# requirements: rust, solana cli (agave 2.1.x), anchor 0.31.1, node 22
npm install
anchor build
anchor test        # starts a local validator, runs all 14 tests
```

## Tests

`tests/passage.ts` covers the full MVP flow:

- identity init + verification of 2 wallets
- extra-account-meta-list init for the pToken mint
- vault init (10 bps fee, pToken mint authority = vault PDA)
- wrap: 100 in → 99.9 pTokens out, fee accrued
- transfer to a verified wallet → **succeeds**
- transfer to an unverified wallet → **fails** (blocked by the hook)
- unwrap + collect_fees to the treasury

## Frontend

`app/index.html` — standalone demo UI (wrap/unwrap, wallet connect, KYC badge).
After the devnet deploy: fill in `CONFIG.assetMint` / `CONFIG.pMint`.
Live demo: GitHub Pages serves `docs/index.html`.

## Roadmap

- [ ] Devnet deploy + live tx flow in the frontend
- [ ] KYC provider integration (Civic/Sumsub) → automated credential issuance
- [ ] zk-credentials instead of plain PDAs (privacy)
- [x] AMM pool pToken/USDC (`passage_pool`) — gated swaps, LP tokens, 14/14 tests
- [ ] $PASS staking / insurance pool (post token launch)
- [ ] Security audit
- [ ] Issuer partnerships (Ondo, Maple, Centrifuge)

## Links

- X: [@PassageRWA](https://x.com/PassageRWA)
- Live demo: https://sewnretirement.github.io/passage-protocol/

## Disclaimer

MVP / unaudited. Wrapped securities remain securities — legal review
(MiCA/SEC) is required before mainnet use with real RWAs.
