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
- **Status:** working MVP — 5 programs live on devnet, 21 tests, playable public demo
- **Revenue model:** a recurring fee on wrapped AUM, plus wrap/unwrap flow and
  venue integrations → treasury, then split between stakers and buyback-and-burn (§3)

## 2. Why this fits futarchy

Every governance question is measurable in protocol revenue: add a new asset?
Change the fee? Marketing budget? Markets can price the cash-flow impact. Passage
is infrastructure with real fees — not a narrative token.

## 3. Revenue model and what $PASS is worth

### Where the money comes from

A fee only on wrapping is too thin to build on: someone who holds a tokenized
T-bill for two years pays 0.10% going in and 0.10% coming out — roughly 10 bps
over two years. The fee has to sit on the **stock**, not only the flow.

The market already pays for exactly this work. Ondo charges **15 bps a year** on
OUSG for tokenization, compliance and transferability, on top of BlackRock's
20 bps for the underlying BUIDL fund. Passage adds the piece neither of them
sells: the token stops being a walled garden and becomes usable across DeFi.

| Line | Rate | Nature |
|---|---|---|
| Wrapped AUM fee | 5–10 bps / year | Recurring, scales with TVL |
| Wrap / unwrap | 0.10% each way | Flow, scales with turnover |
| Venue integration | per venue, annual | Each pool that holds pTokens needs a credential |
| Swap fee share | ~4 bps of the 25 bps | Protocol cut of the gated AMM |

At **$500M wrapped**, an 8 bps annual fee is ~$400k a year before any flow
revenue. At **$2B** — roughly OUSG and USDY combined today — it is ~$1.6M a year,
recurring. That is a quarter of what a holder already pays Ondo and BlackRock,
for a service that increases the issuer's own distribution.

Our customer is the **issuer**, not the trader. A pToken circulating on more
venues is not lost revenue; it is the reason anyone wraps in the first place.

### Why hold $PASS

**1. It is a claim on the treasury.** Under MetaDAO's model the raise stays
on-chain, we draw a pre-approved monthly budget, and holders can vote the
remaining treasury back to themselves if they lose confidence. That is a floor
most tokens do not have.

**2. Staking is a job, not a yield.** Stakers underwrite the credential
registry: if a credential is wrongly issued and an issuer takes a loss, staked
$PASS covers it, and stake is slashed. In exchange stakers receive half of
protocol revenue. This is what lets an issuer trust the registry with a
regulated asset — the backstop is capital, not a promise.

**3. Issuers who stake pay less.** Fee tiers tied to staked $PASS mean our
customers hold the token because it lowers their cost, not because they expect
a pump.

Governance sits on top of all three: fee parameters, which venues get verified,
and who may issue credentials are decided by futarchy markets.

### Buyback-and-burn

The other half of protocol revenue buys $PASS on the open market and burns it.
Two commitments about how:

**It is automatic and permissionless.** An on-chain instruction sweeps accrued
fees, swaps them, and burns the result. Anyone can call it and earn a small
keeper reward, so it does not depend on us remembering to do it, and nobody has
to trust us to follow through.

**It is continuous, not lumpy.** Execution triggers once accrued fees pass a
threshold, is rate-limited, and is capped per execution so a large balance is
spread over time. Big scheduled buybacks get sandwiched by bots and fill badly;
a steady small bid executes closer to fair value. Slippage limits are enforced
on-chain.

Honest about the size: at early revenue this is a small daily bid, and we will
not pretend otherwise — at $800k a year it is roughly $2,200 a day. A burn is
a distribution mechanism, not a value creator. What makes $PASS worth holding is
the revenue underneath it; the burn only decides how that reaches holders.

Split and thresholds are governance parameters, priced by the market like every
other decision.

## 4. The raise

- **Minimum:** $1.8M (18 months of runway: 2 devs, 2 advisors, audit ~$40k, legal/regulatory ~$60k, KYC integration, listings)
- **Cap: $4M.** If commitments exceed the cap, allocations are pro-rata and the excess is refunded in USDC at TGE (MetaDAO standard)
- 10M $PASS, high float, no hidden allocations

## 5. Founder compensation (fixed up front — you consent by participating)

| Component | Size | Condition |
|---|---|---|
| Founder salary | $16k/month | monthly budget, from day 1 |
| Advisors (2x, part-time) | $5k/month each | named roles: legal/regulatory (MiCA + securities law) and RWA/issuer relations — part of the pre-approved operating budget |
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

## 6. Operating budget (pre-approved monthly spend)

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

One-time costs: audit $40k · legal structuring, MiCA + securities $60k · entity setup $15k ·
listings & integrations $30k · bug bounty program $20k · founder KYC attestation $5k ≈ **$170k**.

Math: 18 months x $50k + $170k ≈ **$1.07M**. Of the $1.8M minimum raise, 20%
($360k) seeds liquidity pools per the MetaDAO model, leaving $1.44M of treasury —
a ~$370k buffer on top of the full budget. Any spend above the pre-approved
budget requires a futarchy proposal.

## 7. Post-launch roadmap

| Quarter | Goal |
|---|---|
| Q+1 | Audit complete, mainnet, first asset (issuer partnership) |
| Q+2 | 2nd–3rd asset, KYC provider live, pUSDY/USDC pool |
| Q+3 | Lending integration (pTokens as collateral), $5M TVW |
| Q+4 | zk-credentials, $PASS insurance staking, CEX conversations |

## 8. Risks (transparent)

1. **Regulatory — the one that decides whether this works.** Two separate regimes
   apply and they are often confused. $PASS is a governance token and sits under
   **MiCA**. The wrapped assets are securities, and wrapping does not change that:
   they sit under **MiFID II and the prospectus rules**, which MiCA explicitly
   excludes. The second is the heavier of the two.

   The structural answer is that **Passage is a technology provider, not a
   regulated financial institution.** The issuer holds the licence, issues the
   asset, and remains the regulated party; Passage licenses the compliance layer
   to them and is paid by them. That keeps the vault and the venue in the hands of
   parties already authorised to hold and trade securities, and it is why §3 says
   our customer is the issuer rather than the trader.

   This is a design decision, not a disclaimer: it determines who deploys the
   vault, who operates the pool, and where the entity sits. Getting it wrong means
   needing an investment-firm licence — minimum capital, a compliance function and
   ongoing supervision — which a $1.8M raise cannot carry. The $60k legal budget
   buys an opinion on staying out of scope, not a licence application. Counsel is
   the first advisor hired, before mainnet, for exactly this reason.
2. **Issuer cooperation:** no issuers, no assets; conversations start before the ICO.
3. **Smart-contract risk:** audit required before mainnet; transfer hooks are new territory.
4. **Competition:** large issuers could build this themselves; our edge is neutrality
   (one layer for *all* issuers) and speed on Solana.

## 9. Team

**Founder — [@passageRWA](https://x.com/passageRWA)**

Solo founder, publicly pseudonymous and third-party verified. Identity is
verified with a KYC attestation provider (Assure DeFi or equivalent) before the
ICO opens: they hold the documents, the public sees only the attestation, and
they hand the identity to law enforcement if this project defrauds anyone.

MetaDAO does not require this. It is done because an anonymous founder asking
for $1.8M should be expected to put something at risk, and this puts real legal
exposure behind the pseudonym rather than a promise.

Counterparties are a separate question, and there the answer is simply yes.
Issuers are regulated entities and cannot contract with an anonymous
counterparty; the MiCA structuring, the operating entity, and payroll all run on
a named person. Those parties get the identity under NDA. What stays pseudonymous
is the public profile, not the business.

Everything claimed in this document is verifiable today rather than promised:
five programs live on devnet, 21 passing tests including the compliance checks,
and a public demo anyone can use without asking permission.

**Hiring with the raise**

| Role | When | Why |
|---|---|---|
| Second Solana developer | month 1 | Removes the single point of failure before mainnet |
| Advisor — legal / regulatory (MiCA + securities law) | month 1 | Wrapped securities stay securities; the structure has to be right before mainnet |
| Advisor — RWA / issuer relations | month 1 | The whole business depends on issuers saying yes; that needs someone with the relationships |

Both advisor seats are part-time at $5k/month and are budgeted in §6. They are
named roles with a defined mandate, not decorative advisors paid in tokens.

**What this team does not yet have**

An issuer relationship signed, a completed audit, and a second developer. All
three are what the raise is for, and all three are conditions on the milestone
bonuses in §5 rather than promises made here.

Third-party KYC attestation is budgeted as a one-time cost in §6 and completed
before the ICO opens, not after it closes.

## 10. Links

- Repo: https://github.com/SewnRetirement/passage-protocol
- Demo: https://sewnretirement.github.io/Passage-Protocol/
- X: https://x.com/PassageRWA
- Contact: DM [@passageRWA](https://x.com/passageRWA) on X
