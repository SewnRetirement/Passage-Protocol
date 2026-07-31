# Solana Foundation — Funding Application (draft)

**Project:** Passage Protocol
**Applicant:** [@passageRWA](https://x.com/passageRWA) (solo founder, pseudonymous, third-party KYC attested before the MetaDAO ICO)
**Repo:** https://github.com/SewnRetirement/passage-protocol
**Live demo (devnet):** https://sewnretirement.github.io/Passage-Protocol/
**Track requested:** Convertible grant — public good with a commercial component
**Amount requested:** $110,000, milestone-based
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

| Program | Devnet address | What it does |
|---|---|---|
| `passage_identity` | `8ueut8DShZXteSLKq4VbQtWyw5eXGNS1efUxyKNKGpup` | Credential registry, one PDA per verified wallet |
| `passage_hook` | `2t8mRopezLdyJLDgcD2ufS4LnL1YVeZopzhddwZc13Nf` | Token-2022 transfer hook; blocks transfers to unverified recipients |
| `passage_wrapper` | `HuM2rUWj5qcuEAWRcGKmpHkh3qwY9Y1m6nsV2UAFxagX` | Vault: wrap/unwrap 1:1, fee accrual |
| `passage_pool` | `2Sj66HHtHt2fkHQkpFSMyf71nZZ7iNELWnJiNHFo33aJ` | Constant-product AMM that trades hooked pTokens correctly |
| `passage_demo_faucet` | `7e2xLqS525PMSrr1Wx6zqamcHCUvsaS3bGCZVmPA49XR` | Devnet only — gives visitors a credential and test tokens |

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

| # | Deliverable | Amount | Done when |
|---|---|---|---|
| 1 | **`@passage/hook-kit` TypeScript SDK** — resolves `ExtraAccountMetaList` and builds hook-aware transfer, swap and CPI instructions for any hooked Token-2022 mint, not just ours | $25,000 | Published to npm, MIT, with tests and a worked example against a third-party hook |
| 2 | **Reference implementation guide** — written walkthrough of building a transfer hook and consuming one from another program, covering the failure modes and the account-ordering rules that are currently folklore | $20,000 | Published openly, submitted to Solana developer docs, with a runnable example repo |
| 3 | **Security audit of the four core programs**, report published in full including anything found | $40,000 | Audit complete, report public in the repo, findings fixed |
| 4 | **Integration examples with two existing Solana DeFi venues**, showing what a venue has to change to accept hooked assets — published as PRs or standalone adapters | $25,000 | Both examples working on devnet, documented, code public |
| | **Total** | **$110,000** | |

Milestone 3 is the largest line because an audit of this pattern benefits anyone
who copies it. Hook programs sit in the path of every transfer, so a bug in the
pattern is a bug in every token that adopts it.

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
