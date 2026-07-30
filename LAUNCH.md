# Passage Protocol — Launch Document (MetaDAO)

*Draft for the MetaDAO application and the public launch doc. Version 0.1*

---

## 1. Pitch

**Passage makes the $30 billion of permissioned RWAs finally DeFi-composable.**

Tokenized T-bills, funds, and credit sit on-chain, but only ~8% circulates in DeFi:
KYC allowlists and transfer agents lock open protocols out. Passage puts compliance
**inside the token itself** — a wrapper (pToken) on Token-2022 with a transfer hook
that checks every transfer on-chain against a credential registry. The result:
RWAs you can swap, lend, and use as collateral, while every holder stays verified.

- **Chain:** Solana (RWA adoption is accelerating; no compliance layer exists yet)
- **Status:** working MVP — 3 programs, full test suite, devnet
- **Revenue model:** wrap/unwrap fee (0.10%) + swap fees (v2) → 100% to the treasury

## 2. Why this fits futarchy

Every governance question is measurable in protocol revenue: add a new asset?
Change the fee? Marketing budget? Markets can price the cash-flow impact. Passage
is infrastructure with real fees — not a narrative token.

## 3. The raise

- **Minimum:** $1.8M (18 months of runway: 2 devs, 2 advisors, audit ~$40k, legal ~$60k, KYC integration, listings)
- **Cap: $4M.** If commitments exceed the cap, allocations are pro-rata and the excess is refunded in USDC at TGE (MetaDAO standard)
- 10M $PASS, high float, no hidden allocations

## 4. Founder compensation (fixed up front — you consent by participating)

| Component | Size | Condition |
|---|---|---|
| Founder salary | $16k/month | monthly budget, from day 1 |
| Advisors (2x, part-time) | $5k/month each | named roles: legal/regulatory (MiCA) and RWA/issuer relations — part of the pre-approved operating budget |
| Milestone bonus 1 | 5% of the raise | mainnet live + first RWA asset wrapped |
| Milestone bonus 2 | 5% of the raise | $5M Total Value Wrapped |
| Milestone bonus 3 | 7.5% of the raise | $25M Total Value Wrapped |
| Milestone bonus 4 | 7.5% of the raise | $250k cumulative protocol revenue |
| Performance tokens | 10% of supply (1M) | tranches at 2x / 4x / 8x, ≥18 months vesting |

Milestone bonuses are calculated over **at most the first $4M of the raise** (hard cap
$1M total), so an oversubscribed raise never inflates team compensation.

Rationale: bonuses are paid from the **treasury in USDC**, not from token sales — no
sell pressure on $PASS. Each bonus requires a futarchy proposal; by fixing this table
here, participants know exactly what the team earns and when.

## 5. Operating budget (pre-approved monthly spend)

| Item | Monthly |
|---|---|
| Founder salary | $16k |
| Second developer | $10k |
| Advisors (2x, part-time) | $10k |
| Marketing & community (content, KOLs, events) | $8k |
| Infrastructure & tooling (RPC, hosting, indexing, monitoring) | $1.5k |
| KYC provider (verification costs) | $1k |
| Entity, accounting, admin | $1.5k |
| Contingency | $2k |
| **Total** | **~$50k/month** |

One-time costs: audit $40k · legal/MiCA structuring $60k · entity setup $15k ·
listings & integrations $30k · bug bounty program $20k ≈ **$165k**.

Math: 18 months x $50k + $165k ≈ **$1.07M**. Of the $1.8M minimum raise, 20%
($360k) seeds liquidity pools per the MetaDAO model, leaving $1.44M of treasury —
a ~$375k buffer on top of the full budget. Any spend above the pre-approved
budget requires a futarchy proposal.

## 6. Post-launch roadmap

| Quarter | Goal |
|---|---|
| Q+1 | Audit complete, mainnet, first asset (issuer partnership) |
| Q+2 | 2nd–3rd asset, KYC provider live, pUSDY/USDC pool |
| Q+3 | Lending integration (pTokens as collateral), $5M TVW |
| Q+4 | zk-credentials, $PASS insurance staking, CEX conversations |

## 7. Risks (transparent)

1. **Regulatory:** wrapped securities remain securities; the legal structure (MiCA)
   is reviewed before mainnet — budget reserved.
2. **Issuer cooperation:** no issuers, no assets; conversations start before the ICO.
3. **Smart-contract risk:** audit required before mainnet; transfer hooks are new territory.
4. **Competition:** large issuers could build this themselves; our edge is neutrality
   (one layer for *all* issuers) and speed on Solana.

## 8. Team

[To fill in: founder background + any co-founders/advisors. MetaDAO looks for
"venture-backable founders" — add LinkedIn/GitHub/track record.]

## 9. Links

- Repo: https://github.com/SewnRetirement/passage-protocol
- Demo: https://sewnretirement.github.io/Passage-Protocol/
- X: https://x.com/PassageRWA
- Contact: [fill in]
