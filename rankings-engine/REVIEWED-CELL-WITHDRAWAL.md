# Reviewed cell withdrawal planning

`reviewed-cell-withdrawal.ts` is a dormant, read-only planning primitive. It has no
CLI, workflow hook, model call, data write, publication step, or review-thread action.
The repository's existing reconciliation, retention, cache, repair, and publication
gates are unchanged. No approved adjudication is supplied with this module.

## Authority boundary

`planReviewedWithdrawal(root, trustedPins)` requires an independently authenticated
repository identity and origin URL, PR number, exact head and baseline commits,
current trusted main commit, adjudication path, and SHA-256 of its exact bytes.
The caller must obtain these pins from trusted configuration and live authenticated
repository/review APIs. A local Git remote proves only consistency with the supplied
URL; it does not establish repository ownership. PR contents, proposed proof fields,
review comments, and arbitrary caller-provided pins do not establish authorization.
The caller must revalidate the live main/head and approval state immediately before
any future use. This module has no live API or revocation service.

Adjudication is read only from a regular Git blob at the pinned trusted main commit,
under `rankings-engine/reviewed-withdrawals/`. Its exact digest must match the trusted
pin, its status must be `approved`, and its strict schema must match the entire
source binding. Each unique decision names a cell, finding ID and diagnostic digest,
explicit withdrawal decision, and exact old/current row and raw-cache digests.
The approved main document is the authority. The finding identifies the diagnostic
input; the finding text itself does not approve a change. The independent controller
must authenticate the named reviewer and diagnostic snapshot before accepting the
main document. This module cannot infer that authority from a name or a comment.

## Snapshot and candidate checks

Both source snapshots come from exact committed Git objects. Baseline must be the
unique merge base of head and trusted main. Each targeted baseline row must still
equal the trusted main canonical row exactly; an intervening main decision blocks
the withdrawal even when the source snapshot approval still matches. Catalog files across baseline, head and trusted main must match byte for byte and
contain a complete unique product/story matrix. Each snapshot identity covers every
file, including ancillary blobs, under its arena and every tracked `rankings-engine/cache/<stage>/<arena>/`
directory, including judge, story-tiers, and refresh-retention. File content is represented as base64 to preserve bytes.
Digests bind a sorted list of path/base64 pairs. Row digests use JSON serialization
of the original parsed row without schema stripping.

All raw rows are checked for consistency under the current cell-hash and prompt
versions and the existing verdict rules. Hash equality proves input consistency,
not that a model produced a row. Before issuing trust pins, the future trusted
controller must authenticate canonical producer provenance for the source head
and the applicable historical-origin policy. A commit and internally consistent
cache hashes alone cannot certify model origin. Existing canonical receipt gates
remain separate and mandatory. Existing v2 retained rows authenticate through
`prepareRetainedRepair`, against trusted-main ancestry. Review targets cannot be
existing retained cells. Raw-cache digests cover the original cache bytes, including
metadata and whitespace.

A withdrawal restores the exact authenticated baseline row, limited to uncited
`none/0` with absent support and no support citations, from a current `partial` or
`full` proposal with positive quality. No arbitrary replacement row is accepted.
Every other row retains its original object; every file except `verdicts.json` stays
byte-identical, including evidence, current raw caches and existing retention.
The returned candidate is an in-memory map. Only the verdict array is serialized.

`verifyReviewedWithdrawal` reconstructs the plan from independent trust pins and
compares the strict proof and entire candidate file map. An edited proof cannot
approve itself. Candidate tampering, extra files, stale bindings, unknown proof or
adjudication fields, missing authority, and invalid caches fail closed.

## Remaining integration boundary

The old retention identity continues to authenticate the original source snapshot.
Its bytes are preserved; its identity is not rewritten to make the two withdrawals
look like ordinary churn. A future composite verifier would need to authenticate
that original snapshot, verify each authorized substitution, and authenticate the
resulting candidate through this separate proof. The current production verifier
intentionally does not accept this composite output.

Activation requires explicit approval and a separately reviewed integration. Producer
canonical receipts, live head/main checks, adjudication governance, review gates,
derivation, merge checks and any review-thread resolution remain separate work.
The planner never writes paths outside its snapshot. A future publication diff guard
must independently reject unrelated changes outside explicitly approved verdict,
proof, and derived-file paths; this proof does not cover the entire repository.
The synthetic tests use the two PR #650 cell names to exercise the failure mode;
they do not approve or modify that PR or its data.
