# Editorial and governance policy

## Maturity ladder (jurisdiction-scoped workflows and rule cards)

- `stub`: mapped need, no actionable workflow.
- `draft`: structured workflow; sourcing or review incomplete. Not available for agent execution.
- `demonstration`: illustrative structure and source links, without independent expert review.
  Not available for automated external execution.
- `reviewed`: source-backed and checked by a named reviewer for stated scenario and date. Still
  needs case-specific review.
- `deprecated`: retained for historical reference; not matched for new events.

Legal changes require a primary-source URL and provision locator, a date check, independent
editorial review for a `reviewed` label, and notes on effective dates and affected versions.
The starter examples have source checks but **no independent expert sign-off**; their coverage
status is `example`, not production certified. A review expiry produces a stale warning and
must block any automated external action. Disputed rules stay visible with an issue and are
downgraded if material. No one may claim the repository is comprehensive for a country merely
because it has several playbooks — coverage is tracked per scenario and locale in
`coverage/coverage.json`, including known exclusions.

## Evidence doctrine (vendor layer — already enforced in the pipeline)

- **Everything evidence-driven.** Verdicts, scores, and ranks are computed from cited evidence;
  they are never hand-tuned. Honest negatives are recorded as probes.
- **Churn policy.** A verdict flip is kept only when it cites new evidence IDs; flips without
  new evidence are reverted.
- **Owner-product bias audits.** Products affiliated with the maintainers (Foreloop, AFK,
  Ultrametric) carry affiliation disclosure on every surface and receive adversarial bias
  audits; favorable flips get extra scrutiny and have been reverted under this policy.
- **Determinism.** Committed rankings recompute bit-identically
  (`pipeline/scripts/recompute-check.ts` must report ALL DETERMINISTIC); provenance is
  HMAC-fingerprinted.
- **No paid placement.** Payment cannot change scores, rankings, routing, or inclusion — in
  arenas, in workflows, or in vendor reviews. Maintainers with a vendor relationship disclose
  it and recuse themselves from that vendor's review; a vendor may respond to factual errors
  in public.

## Contribution workflow

1. Open an issue describing the founder scenario, jurisdiction dimensions, and specific gap.
   Search existing coverage first.
2. Add a source record for each legal assertion — current primary sources (statute, regulation,
   agency guidance, official form) with the exact section and a `checked_on` date. A provider
   blog can explain a practice but cannot establish law.
3. Copy `templates/process.json`. Narrow the applicability, separate legal requirements from
   operating advice, state the trigger and exceptions, and include a human decision at
   irreversible or regulated steps.
4. Add at least one wholly fictional fixture. Update `coverage/coverage.json` with the real
   maturity level.
5. For vendors, use `templates/vendor-review.json` per `vendors/README.md`. Disclose
   affiliations and compensation; record the tested scenario, observed evidence, cost date, and
   negatives. Marketing copy alone is `unverified`.
6. Run the gates: `npx vitest run __tests__/founder-ops.test.ts` (structure + invariants) and
   the full suite before merging. A domain expert must review legal changes; two independent
   reviewers are preferred for high-stakes rules.
7. An agent contribution includes an audit trail of sources, dates accessed, uncertainty, and
   steps it did not perform. AI-generated legal assertions receive the same human review as any
   other contribution.

Never commit private company documents, PII, credentials, referral links without disclosure,
scraped copyrighted forms, or purported universal legal answers. Publish correction history and
keep an escalation path open.
