# Solana Foundation — invulhulp

**Formulier:** https://share.hsforms.com/1GE1hYdApQGaDiCgaiWMXHA5lohw
**Doorlooptijd:** ~1 week eerste beoordeling, ~3 weken tot bericht per e-mail.
Bij toewijzing volgt een gesprek met hun juridische team over de overeenkomst.

Hieronder staan de antwoorden klaar om te kopiëren. Alles wat je zelf moet
invullen staat als `[…]`.

---

## Zelf invullen

- Naam en e-mailadres — je eigen. Gebruik een adres dat je blijft lezen.
- Land / tijdzone — Nederland.
- Entiteit: er is er nog geen. Antwoord: *individual*.
- Vraagt het om een wallet: gebruik een adres dat je beheert. **Niet** de
  deployer-key uit de repo.
- Vraagt het of je elders geld ophaalt: **ja** — zie het antwoord hieronder.

---

## Project name

Passage Protocol

## Website / repo

- Repo: https://github.com/SewnRetirement/passage-protocol
- Demo (devnet, speelbaar): https://sewnretirement.github.io/Passage-Protocol/
- SDK: https://github.com/SewnRetirement/passage-protocol/tree/main/sdk/hook-kit

## Amount requested

$95,000, milestone-based (see budget)

## Project overview

Passage makes permissioned real-world assets usable in DeFi by moving the
compliance check inside the token itself. A user deposits a permissioned RWA and
receives a pToken 1:1 — a Token-2022 mint carrying a transfer hook that verifies,
on every transfer, that the recipient holds a credential in an on-chain registry.
The rule travels with the asset, so it can be swapped, lent and used as
collateral without every venue building its own allowlist.

Five programs are live on Solana devnet with 21 passing integration tests,
including the negative cases: an unverified wallet cannot receive pTokens, and an
unverified pool cannot be traded into. The demo is playable by anyone without
signing up — get test tokens, wrap, swap in a gated AMM, unwrap.

## How does this provide a public good for Solana?

Transfer hooks are the least-documented part of Token-2022, and the hard part is
not the hook — it is everything downstream. Writing a hook that rejects a
transfer is a weekend project. Making a hooked token work inside an AMM is not:
the caller must resolve the ExtraAccountMetaList, derive PDAs from account data
at specific offsets, and pass them in the right place, or every CPI fails with an
error that explains nothing.

We solved that, and it is already MIT-licensed and public. passage_pool is one of
the few working, tested, public examples of an AMM trading a transfer-hooked
Token-2022 mint — including the non-obvious detail that the pool's own PDA must
satisfy the hook.

Before applying we extracted the client-side half into @passage_protocol/hook-kit, an
MIT-licensed SDK that resolves hook accounts for any hooked mint, not just ours.
It covers the case @solana/spl-token does not: when your own program performs the
transfer by CPI and needs those accounts as remaining_accounts. Every AMM, vault
and lending market touching a hooked token hits this and currently solves it by
hand. Eleven checks pass against our live devnet deployment.

This work is reusable by any Solana team using transfer hooks — gaming assets
with royalty enforcement, loyalty points with transfer limits, other RWA
projects. The grant turns what we learned the hard way into an SDK, written
documentation, a published audit and venue integration examples, rather than
leaving it as five repos someone has to reverse-engineer.

## Why Solana?

This design is not portable. It depends on Token-2022 transfer hooks, which let a
program run logic inside every transfer at the token-program level. There is no
equivalent elsewhere: ERC-3643 and ERC-1400 enforce at the token contract, and
every venue must integrate the standard explicitly — which is why permissioned
assets on those chains stay in walled gardens.

On Solana the rule travels with the token and applies to programs written before
the token existed. Add cost: a compliance check on every transfer is only viable
when a transfer costs a fraction of a cent. This works here and effectively
nowhere else today.

Solana is also where the assets are arriving. The gap between "issued on Solana"
and "usable in Solana DeFi" is the gap this closes.

## Budget and milestones

Milestone 1 — @passage_protocol/hook-kit SDK — $10,000
Core built, verified and already published to npm as @passage_protocol/hook-kit
under MIT — all unfunded. Remaining: stabilise the API and prove it against hooks
we did not write.
Complete when: working against at least two third-party hooks.

Milestone 2 — Reference implementation guide — $20,000
Building a transfer hook and consuming one from another program, covering the
failure modes and account-ordering rules that are currently folklore.
Complete when: published openly, submitted to Solana developer docs, runnable
example repo.

Milestone 3 — Security audit of the four core programs — $40,000
Full report published, including anything found.
Complete when: audit complete, report public in the repo, findings fixed.

Milestone 4 — Integration examples with two Solana DeFi venues — $25,000
Showing what a venue must change to accept hooked assets.
Complete when: both working on devnet, documented, code public.

Total: $95,000

Milestone 3 is the largest line because an audit of this pattern benefits anyone
who copies it. A hook program sits in the path of every transfer, so a bug in the
pattern is a bug in every token that adopts it.

If the Foundation would rather fund a subset, milestones 1 and 2 are the priority
— they are the ones nobody else is doing.

## Are you raising investment funds?

Yes, and the two do not overlap.

A futarchy ICO on MetaDAO is planned (minimum $1.8M, capped at $4M). That funds
the business: salaries, issuer relations, legal and regulatory structuring,
marketing, and the commercial side of the protocol. None of that is requested
here.

The grant funds the parts that are useful to Solana whether or not Passage
succeeds commercially: the SDK, the documentation, the audit report, and the
venue integration examples. If Passage fails, all four still exist and still work
for the next team.

Given the commercial component, the convertible grant track seems the right fit,
but we are happy to be directed to whichever structure the Foundation prefers.

## Team

One developer, working pseudonymously as @passageRWA and verified by a
third-party KYC attestation provider before the MetaDAO ICO opens. Identity is
disclosed under NDA to counterparties — issuers are regulated entities and cannot
contract with an anonymous party — while the public profile stays pseudonymous.

What this team does not have yet, stated plainly: no issuer relationship signed,
no completed audit, no mainnet deployment, no token, and no second developer.
The milestones above are written so progress is checkable rather than asserted.
