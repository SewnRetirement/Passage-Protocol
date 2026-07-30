# Passage Protocol — X (Twitter) Content Kit

## Profile

**Handle:** @PassageRWA
**Name:** Passage Protocol
**Bio:**
> The compliance bridge that makes RWAs DeFi-composable. Wrap once, compose everywhere. Built on Solana with Token-2022 transfer hooks. Testnet live ↓
**Link:** https://sewnretirement.github.io/Passage-Protocol/
**Banner:** dark (#060B09) with neon-green gate mark + "Make your RWAs DeFi-composable" (I can generate this when needed)

---

## Pinned thread (post as a 7-tweet thread)

**1/**
$30,000,000,000 in tokenized RWAs sits on-chain today.

Only ~8% of it can actually move in DeFi.

The rest is locked behind KYC allowlists and transfer agents — tokenized, but frozen.

We're fixing that. Meet Passage 🧵

**2/**
The problem isn't tokenization. BlackRock, Ondo and Franklin Templeton already did that part.

The problem is that permissioned tokens can't touch open protocols. No swaps. No lending. No collateral. No yield.

Regulators call it what it is: isolated pools.

**3/**
Passage puts compliance INSIDE the token.

Deposit a permissioned RWA → receive a pToken 1:1.

The pToken is a Token-2022 asset with a transfer hook: every single transfer checks on-chain whether the recipient is verified.

**4/**
The result sounds impossible, but it's just good architecture:

✅ freely composable in any DeFi protocol
✅ every holder KYC-verified, always
✅ full audit trail on-chain, every transfer

Compliance isn't a gate around the market anymore. It travels with the asset.

**5/**
This isn't a whitepaper.

4 Solana programs, built and tested:
→ vault (wrap/unwrap 1:1)
→ identity registry
→ transfer hook
→ gated AMM where verified users swap pTokens vs USDC

14/14 integration tests passing. Open source. Demo live on devnet.

**6/**
Business model: boring and beautiful.

0.10% wrap/unwrap fee. 0.25% swap fee. 100% of protocol revenue to a treasury governed by futarchy markets.

No emissions. No ponzinomics. Fees from real assets, from day one.

**7/**
Launch: $PASS via @MetaDAOProject — high float, no VC allocations, team paid on milestones from treasury USDC (zero token sell pressure), performance tokens locked until 2x-8x.

Repo: github.com/SewnRetirement/passage-protocol
Demo: sewnretirement.github.io/Passage-Protocol

Passage is coming.

---

## Week 1 posts (1 per day)

**Day 1 (na pinned thread):**
> Chart of the week: RWA on-chain value went from $1.5B (2022) to $30B (2026).
> DeFi captured 8% of it.
> The other 92% is the biggest untapped liquidity pool in crypto. That's the market we're building for.

**Day 2:**
> Hot take: "compliant DeFi" failed because it built walls around protocols.
> Allowlist the protocol → composability dies.
> Passage flips it: verify the *wallet*, put the check in the *token*. The protocol stays open. The asset stays compliant.

**Day 3 (dev update):**
> Dev update 🛠️
> Our transfer hook now blocks any pToken transfer to an unverified wallet — enforced by the token itself, tested against our gated AMM.
> Same tx, verified wallet: ✅
> Same tx, random wallet: ❌ ReceiverNotVerified
> This is what compliance-as-code looks like.

**Day 4:**
> Why Solana for RWAs?
> → BlackRock's BUIDL and Ondo's USDY are already here
> → 400ms finality, fees under a cent — the only chain where a compliance check on *every transfer* is economically viable
> → And no one has built the compliance layer yet. First-mover territory.

**Day 5:**
> How the team gets paid, in one tweet:
> Salary from treasury. Bonuses only at measurable milestones (mainnet, $5M TVW, $25M TVW, $250k revenue) — in USDC, not tokens. Performance tokens locked until 2x-8x above ICO price.
> If you win, we win. In that order.

**Day 6:**
> The ECB warned that tokenized markets risk becoming "isolated pools" without common standards.
> Translation: someone needs to build the standard.
> Passage is neutral infrastructure — one layer, every issuer, every DeFi venue.

**Day 7 (community):**
> Question for RWA holders: if your tokenized T-bills could earn DeFi yield *without* breaking compliance, what would you do first?
> Lend them? LP them? Collateralize a stablecoin loan?
> Genuinely curious — building the integrations in that order.

---

## Content-regels (voor consistentie)

- Toon: zelfverzekerd, technisch onderbouwd, nooit hype-taal ("100x", "moon") — institutioneel geloofwaardig.
- Altijd Engels. Cijfers > adjectieven.
- Elke claim moet kloppen met het werkende product (geen beloftes over features die niet bestaan).
- Dev-updates met echte output/screenshots doen het het best — post ze wekelijks.
- Volg + engage: @MetaDAOProject, RWA-accounts (Ondo, Centrifuge, Maple, RWA.xyz), Solana-devs.
