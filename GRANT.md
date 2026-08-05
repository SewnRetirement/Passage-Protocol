# Solana Foundation — Funding Application (draft)

**Project:** Passage Protocol
**Applicant:** [@passageRWA](https://x.com/passageRWA) (solo founder, pseudonymous, third-party KYC attested before the MetaDAO ICO)
**Repo:** https://github.com/SewnRetirement/passage-protocol
**Live demo (devnet):** https://sewnretirement.github.io/Passage-Protocol/
**Track requested:** Convertible grant — public good with a commercial component
**Amount requested:** $95,000, milestone-based
**Raising elsewhere:** Yes. A futarchy ICO on MetaDAO is planned (min $1.8M, capped $4M). See "How this relates to the raise" below — the two fund different things and we are explicit about which.

---

## 1. One paragraph

Passage makes permissioned real-world assets usable in DeFi by moving the
compliance check inside the token. A user deposits a permissioned RWA and
receives a pToken 1:1 — a Token-2022 mint with a transfer hook that verifies, on
every single transfer, that the recipient holds a credential in an on-chain
registry. The asset stays compliant wherever it goes, so it can be swapped, lent
and used as collateral without each venue building its own allowlist. Five
programs are live on devnet today with 21 passing tests, and the demo is playable
by anyone without signing up.

## 2. What already exists (verifiable now, not promised)

All five are live on devnet and verifiable by address:

**`passage_identity`** — credential registry, one PDA per verified wallet
`8ueut8DShZXteSLKq4VbQtWyw5eXGNS1efUxyKNKGpup`

**`passage_hook`** — Token-2022 transfer hook; blocks transfers to unverified recipients
`2t8mRopezLdyJLDgcD2ufS4LnL1YVeZopzhddwZc13Nf`

**`passage_wrapper`** — vault: wrap/unwrap 1:1, fee accrual
`HuM2rUWj5qcuEAWRcGKmpHkh3qwY9Y1m6nsV2UAFxagX`

**`passage_pool`** — constant-product AMM that trades hooked pTokens correctly
`2Sj66HHtHt2fkHQkpFSMyf71nZZ7iNELWnJiNHFo33aJ`

**`passage_demo_faucet`** — devnet only; gives visitors a credential and test tokens
`7e2xLqS525PMSrr1Wx6zqamcHCUvsaS3bGCZVmPA49XR`

Anyone can reproduce the full path in a browser: get test tokens, wrap, swap in
the gated AMM, unwrap. 21 integration tests cover it, including the negative
cases — an unverified wallet cannot receive pTokens, and an unverified pool
cannot be traded into.

## 3. Why this is a public good

**Transfer hooks are the least-documented part of Token-2022, and the hardest
part is not the hook itself — it is everything downstream.** Writing a hook that
rejects a transfer is a weekend project. Making a hooked token work inside an AMM
is not: the caller has to resolve the `ExtraAccountMetaList`, derive the right
PDAs from account data at the right offsets, and pass them as remaining accounts
in the correct order, or every CPI fails with an error that explains nothing.

We solved that and it is already open source under MIT. `passage_pool` is, as far
as we can find, one of the few working, tested, public examples of an AMM that
trades a transfer-hooked Token-2022 mint — including the non-obvious detail that
the pool's own PDA must satisfy the hook.

That work is reusable by any Solana team touching Token-2022 hooks, whatever they
are building: gaming assets with royalty enforcement, loyalty points with
transfer limits, or any other RWA project. **The grant is requested to turn what
we learned the hard way into documentation, an SDK and an audit that the whole
ecosystem can build on**, rather than leaving it as five repos someone has to
reverse-engineer.

## 4. Why Solana specifically

This design is not portable. It depends on **Token-2022 transfer hooks**, which
let a program run arbitrary logic inside every transfer at the token-program
level. There is no equivalent on other chains: the ERC-3643 and ERC-1400 approach
enforces at the token contract, and every venue that wants to hold the asset must
integrate the standard explicitly. That is why permissioned assets on those
chains stay in walled gardens.

On Solana the rule travels with the token and applies to programs that were
written before the token existed. Add cost — a compliance check per transfer is
only viable when a transfer costs a fraction of a cent — and this is a design
that works here and effectively nowhere else today.

Solana also has the assets. Tokenized treasuries and equities are arriving on the
chain, and the gap between "issued on Solana" and "usable in Solana DeFi" is the
gap this closes.

## 5. Use of funds

All four milestones produce open-source, MIT-licensed output that is useful
independently of Passage's business.

**Milestone 1 — `@passage_protocol/hook-kit` TypeScript SDK · $10,000**
The core is already built and verified, unfunded (see §5a). Remaining: publish to
npm, stabilise the API, and test against transfer hooks other than our own.
*Complete when:* on npm under MIT, working against at least two third-party hooks.

**Milestone 2 — Reference implementation guide · $20,000**
A written walkthrough of building a transfer hook and consuming one from another
program, covering the failure modes and account-ordering rules that are currently
folklore.
*Complete when:* published openly, submitted to the Solana developer docs, with a
runnable example repo.

**Milestone 3 — Security audit of the four core programs · $40,000**
Full report published, including anything found.
*Complete when:* audit complete, report public in the repo, findings fixed.

**Milestone 4 — Integration examples with two Solana DeFi venues · $25,000**
Showing what a venue has to change to accept hooked assets, published as PRs or
standalone adapters.
*Complete when:* both working on devnet, documented, code public.

**Total: $95,000**

Milestone 3 is the largest line because an audit of this pattern benefits anyone
who copies it. Hook programs sit in the path of every transfer, so a bug in the
pattern is a bug in every token that adopts it.

### 5a. What we built before asking for anything

Milestone 1 is largely done and it was done unfunded, so this application can be
judged on delivered work rather than intent.

**`@passage_protocol/hook-kit`** ([`sdk/hook-kit`](https://github.com/SewnRetirement/passage-protocol/tree/main/sdk/hook-kit))
resolves transfer-hook accounts for any hooked Token-2022 mint — and covers the
case `@solana/spl-token` does not: when *your own program* performs the transfer
by CPI and needs those accounts as `remaining_accounts`. Every AMM, vault and
lending market that wants to touch a hooked token hits this and currently solves
it by hand.

It also turns the two failure modes that cost developers an afternoon into
readable errors and documentation: the destination token account must exist
before resolution, because hooks read data out of it; and a receiving pool PDA is
itself a recipient that must satisfy the hook. Both are undocumented today.

Eleven checks pass against the live devnet deployment, asserting that the
accounts it resolves are exactly the ones our working AMM passes by hand.

The remaining $10,000 on milestone 1 is for the part that makes it a public good
rather than our internal tool: publishing to npm, stabilising the API, and
proving it against hooks we did not write.

## 6. How this relates to the MetaDAO raise

We are being explicit about this because overlapping asks are how grant
applications lose trust.

The **MetaDAO ICO funds the business**: salaries, issuer relations, legal and
regulatory structuring, marketing, and the commercial side of the protocol. That
money is not requested here.

The **grant funds the parts that are useful to Solana whether or not Passage
succeeds commercially**: the SDK, the documentation, the audit report, and the
venue integration examples. If Passage fails, all four still exist and still work
for the next team.

If the Foundation would rather fund a subset, milestones 1 and 2 are the ones we
would prioritise, because they are the ones nobody else is doing.

## 7. What we do not have yet

No issuer relationship is signed. No audit is complete. There is no mainnet
deployment and no token. It is one developer. All of that is accurate as of this
application, and the milestones above are written so progress is checkable rather
than asserted.

## 8. Links

- Repo: https://github.com/SewnRetirement/passage-protocol
- Demo: https://sewnretirement.github.io/Passage-Protocol/
- X: https://x.com/passageRWA
- Launch document (compensation, budget, risks, in full): `LAUNCH.md` in the repo
