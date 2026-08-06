# Passage — Developer Tooling proposal

**Tool name:** `@passage_protocol/hook-kit` and the transfer-hook reference materials
**Applicant:** Passage Protocol
**Repo:** https://github.com/SewnRetirement/passage-protocol
**Package:** https://www.npmjs.com/package/@passage_protocol/hook-kit
**Licence:** MIT
**Requested:** $95,000, milestone-based

---

## 1. Problem statement

Token-2022 transfer hooks let a program run arbitrary logic inside every transfer.
They are the mechanism behind compliance-gated assets, royalty enforcement, transfer
limits and allowlisted tokens on Solana. They are also the least-documented extension
in the token program, and the difficulty is not where developers expect it.

Writing a hook is straightforward. The friction is entirely on the **calling** side.

A hook declares the extra accounts it needs in an on-chain `ExtraAccountMetaList`, a
TLV-encoded account at `["extra-account-metas", mint]` under the hook program. Each
entry can be a fixed pubkey, a PDA of the hook program, or a PDA of a *different*
program, and its seeds can be literal bytes, another account's key, a slice of
**instruction data**, or a slice of **account data at a specific byte offset**.
Resolving them means reading the list, walking each entry, fetching whatever accounts
the seeds point at, deriving the addresses, and appending them in the position the
callee expects.

Get any of it wrong and the CPI fails with `AccountNotFound` or a bare
`ProgramFailedToComplete`. Nothing in the error identifies which account was missing
or why.

`@solana/spl-token` handles one case: a plain top-level `transfer_checked` where the
SPL library builds the whole instruction. That covers wallets and simple transfers.

**It does not cover the case that matters for tooling:** when *your own program*
performs the transfer via CPI — `spl_token_2022::onchain::invoke_transfer_checked` on
the Rust side — and therefore needs those same accounts passed as
`remaining_accounts` on *your* instruction. There is no helper for this. Every AMM,
vault, lending market, escrow or router that wants to support hooked assets writes
the resolution logic again, by hand, usually after losing a day to it.

The practical result is that hooked tokens are supported almost nowhere. The
extension exists, but the ecosystem around it does not, and the gap is developer
experience rather than protocol capability.

## 2. What we have already built and shipped

All of the following is public, MIT-licensed and live before this application.

**`@passage_protocol/hook-kit`** — published on npm. A dependency-light TypeScript
package that resolves transfer-hook accounts for any hooked Token-2022 mint.

```ts
import { hookAccountsForCpi } from '@passage_protocol/hook-kit';

const remaining = await hookAccountsForCpi(connection, {
  mint, source, destination, owner, amount: 1_000_000n,
});

const ix = await program.methods.swap(amountIn, minOut, true)
  .accounts({ /* ... */ })
  .remainingAccounts(remaining)
  .instruction();
```

Public API:

| Function | Returns |
|---|---|
| `getHookProgramId(connection, mint, tokenProgramId?, commitment?)` | The hook program, or `null` |
| `hasTransferHook(connection, mint, ...)` | `boolean`, for branching before you build |
| `getMetaListAddress(mint, hookProgramId)` | The `ExtraAccountMetaList` PDA |
| `resolveHookAccounts(connection, ctx)` | The resolved extras only |
| `hookAccountsForCpi(connection, ctx)` | `[hookProgram, metaList, ...extras]` for `remaining_accounts` |
| `appendHookAccounts(connection, ix, ctx)` | Instruction with extras appended in top-level order |

Two design decisions worth noting. Every function returns an empty array or a no-op
when the mint has no hook, so callers do not have to branch on whether hooks are
involved. And the two failure modes that cost developers the most time are turned
into a typed `HookResolutionError` with an explanation rather than a bare not-found:

1. **The destination token account must exist before resolution.** Hooks commonly
   derive a PDA from bytes inside the destination account — its owner field, to look
   up a credential or allowlist entry. Resolution reads that account off-chain, ahead
   of the transaction. If the destination ATA is created in the same transaction being
   built, it does not exist yet and resolution fails. The error now says which account
   is missing and that it must be created in an earlier, confirmed transaction.

2. **A receiving program is itself a recipient.** If a hook gates on the recipient,
   then a pool, vault or lending market receiving the token must satisfy the same
   rule — its PDA needs whatever the hook checks for. A swap that fails for no
   apparent reason is very often this. Documented prominently.

**`passage_pool`** — a working constant-product AMM that trades a transfer-hooked
Token-2022 mint, live on devnet. As far as we can find it is one of very few public,
tested examples of the full pattern: CPI transfer through the hook, correct
remaining-account ordering, and the pool PDA holding its own credential.

**Verification.** Eleven checks run `hook-kit` against the live devnet deployment and
assert that the accounts it resolves are byte-for-byte the ones the working AMM passes
by hand. Twenty-one integration tests cover the four protocol programs, including the
negative cases — an unverified wallet cannot receive the token, and an unverified pool
cannot be traded into.

This was all built without funding. The application can be assessed on delivered work.

## 3. What the grant funds

### Milestone 1 — Harden and generalise the SDK · $10,000

The core is done. Remaining work is what turns an internal tool into a public one.

- Stabilise the API surface and commit to semver
- Test against transfer hooks we did not write — at minimum two third-party hooks
  with different `ExtraAccountMetaList` shapes, including instruction-data seeds and
  nested external PDAs, which our own hook does not exercise
- Add a resolution-tracing mode that prints each meta, the seeds used, and the derived
  address, so a failure can be diagnosed without reading the TLV by hand
- CI against devnet, published coverage

**Complete when:** on npm under MIT with a stable API, working against at least two
third-party hooks, with tests demonstrating each.

### Milestone 2 — Reference implementation guide · $20,000

A written guide covering the whole path, which does not currently exist anywhere:
writing a hook, declaring extra accounts, and — the part that is entirely folklore —
consuming a hooked token from another program.

Contents: the account layout Token-2022 passes to `Execute`; every `Seed` variant with
a worked example; account ordering for the top-level and CPI cases and why they
differ; `invoke_transfer_checked` and what it expects in `additional_accounts`; the
failure modes and what each error actually means; and compute-budget guidance, since
hook CPIs push transactions past the default limit.

Accompanied by a runnable example repo: a minimal hook, a minimal program that
consumes it, and tests.

**Complete when:** published openly under MIT, submitted as a contribution to the
Solana developer documentation, example repo public and running in CI.

### Milestone 3 — Security audit, published in full · $40,000

An audit of the four core programs by a recognised Solana firm, with the complete
report published in the repo including anything found and the fixes.

This is the largest line because a hook program sits in the path of every transfer of
its mint. A flaw in the pattern is a flaw in every token that adopts it, and the
pattern is what we are asking the ecosystem to reuse. An audit of a reference
implementation is worth more than an audit of one project.

**Complete when:** audit complete, report public, findings resolved.

### Milestone 4 — Venue integration examples · $25,000

Two worked examples showing what an existing Solana DeFi venue has to change to accept
hooked assets, published as pull requests to those projects where they will take them,
or as standalone adapters where they will not.

This is the step that turns the tooling into adoption. Today a venue that wants to
list a hooked token has to discover all of the above independently; these examples
reduce that to reading a diff.

**Complete when:** both working on devnet, documented, code public.

**Total: $95,000**

## 4. Why this belongs in Developer Tooling

The protocol we build on top of this is a business. The four deliverables above are
not: they are equally useful to a gaming project enforcing royalties, a loyalty
programme enforcing transfer limits, or a competing RWA protocol. If Passage fails
commercially, all four still exist and still work.

We are explicit about the boundary. Passage plans a separate raise (a futarchy ICO on
MetaDAO, minimum $1.8M) which funds salaries, legal structuring, issuer relations and
the commercial side. None of that is requested here, and none of these milestones is
Passage-specific.

## 5. Why Solana

Transfer hooks have no equivalent on other chains. The ERC-3643 and ERC-1400 approach
enforces at the token contract, so every venue must integrate the standard explicitly
before it can hold the asset — which is why permissioned assets on those chains stay
in closed venues. On Solana the rule executes inside the token program and therefore
binds programs written before the token existed.

The economics only work here as well: a check on every transfer is viable at a
fraction of a cent and is not at higher fees.

This makes hooks a genuine Solana differentiator — and one that is currently
underused because the tooling around it is missing rather than because the mechanism
is inadequate. That gap is what this proposal closes.

## 6. Team and maintenance

One developer today, working pseudonymously as @passageRWA, verified by a third-party
KYC attestation provider. Two people are joining in community and partnerships roles.
A second Solana developer is budgeted and being recruited — stated plainly because a
single maintainer is a real risk for a package other teams would depend on.

Maintenance commitment: `hook-kit` is MIT and lives in a public repo. We will keep it
current with `@solana/spl-token` and Token-2022 changes, respond to issues, and — if
the project ever winds down — transfer the package to the Foundation or another
maintainer rather than let it rot on npm.

## 7. Success metrics

Deliberately external and checkable rather than self-reported:

- The SDK works against transfer hooks written by teams other than us, demonstrated
  in tests — the direct measure of whether it is a public good or an internal tool
- The reference guide is accepted into the Solana developer documentation
- The audit report is public, in full
- At least one venue integration is merged upstream or adopted
- npm downloads and dependent repositories, reported honestly including that
  transfer-hook usage is still niche and early numbers will be small

## 8. Links

- Repo: https://github.com/SewnRetirement/passage-protocol
- SDK source: https://github.com/SewnRetirement/passage-protocol/tree/main/sdk/hook-kit
- npm: https://www.npmjs.com/package/@passage_protocol/hook-kit
- Playable devnet demo: https://sewnretirement.github.io/Passage-Protocol/

Devnet program IDs: `8ueut8DShZXteSLKq4VbQtWyw5eXGNS1efUxyKNKGpup` (identity),
`2t8mRopezLdyJLDgcD2ufS4LnL1YVeZopzhddwZc13Nf` (hook),
`HuM2rUWj5qcuEAWRcGKmpHkh3qwY9Y1m6nsV2UAFxagX` (wrapper),
`2Sj66HHtHt2fkHQkpFSMyf71nZZ7iNELWnJiNHFo33aJ` (pool),
`7e2xLqS525PMSrr1Wx6zqamcHCUvsaS3bGCZVmPA49XR` (demo faucet).
