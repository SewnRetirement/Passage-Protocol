# Passage Protocol

**De compliance-brug die permissioned RWA's DeFi-composable maakt — op Solana.**

Er staat ~$30 mld aan tokenized RWA's on-chain, maar slechts ~8% circuleert in DeFi omdat
de tokens permissioned zijn (KYC-allowlists, transfer agents). Passage lost dit op door
compliance **in de token zelf** te stoppen:

1. Stort een permissioned RWA-token in de **vault** → ontvang 1:1 een **pToken**.
2. De pToken is een Token-2022 mint met een **transfer hook**: elke transfer checkt
   on-chain of de ontvanger een **credential** heeft in de identity-registry.
3. Resultaat: vrij composable in DeFi (DEX, lending, staking), maar alleen tussen
   geverifieerde wallets. Wrap/unwrap-fees zijn protocol-omzet.

## Architectuur

| Programma | ID (localnet) | Functie |
|---|---|---|
| `passage_wrapper` | `HuM2...xagX` | Vault: wrap/unwrap 1:1, fee-accrual, collect_fees |
| `passage_identity` | `8ueu...Gpup` | Registry: verify/revoke wallet-credentials (PDA per wallet) |
| `passage_hook` | `2t8m...13Nf` | Token-2022 transfer hook: blokkeert transfers naar niet-geverifieerde wallets |

Flow van een pToken-transfer:

```
user → Token-2022 transfer_checked
         └─ CPI → passage_hook::Execute
                    ├─ leest owner van destination token account
                    ├─ resolvet credential-PDA ["credential", dest_owner]
                    └─ geen geldige credential? → transactie faalt
```

## Setup

```bash
# vereisten: rust, solana cli (agave), anchor 0.31.1, node 22
npm install
anchor build
anchor test        # start lokale validator, draait alle 7 tests
```

## Tests

`tests/passage.ts` dekt de volledige MVP-flow:

- identity init + verify van 2 wallets
- extra-account-meta-list init voor de pToken-mint
- vault init (fee 10 bps, pToken mint authority = vault-PDA)
- wrap: 100 in → 99,9 pToken uit, fee accrued
- transfer naar geverifieerde wallet → **slaagt**
- transfer naar niet-geverifieerde wallet → **faalt** (hook blokkeert)
- unwrap + collect_fees naar treasury

## Frontend

`app/index.html` — standalone demo-UI (wrap/unwrap, wallet-connect, KYC-badge).
Na devnet-deploy: vul `CONFIG.assetMint` / `CONFIG.pMint` in.

## Roadmap

- [ ] Devnet-deploy + echte tx-flow in frontend
- [ ] KYC-provider-integratie (Civic/Sumsub) → credential-uitgifte automatiseren
- [ ] zk-credential i.p.v. plain PDA (privacy)
- [ ] AMM-pool pToken/USDC (`passage_pool`)
- [ ] $PASS staking / verzekeringspool (na MetaDAO-launch)
- [ ] Security-audit
- [ ] Issuer-partnerships (Ondo, Maple, Centrifuge)

## Disclaimer

MVP / niet geauditeerd. Wrapped securities blijven securities — juridische toetsing
(MiCA/AFM) vereist vóór mainnet-gebruik met echte RWA's.
