# Product submission intake

`rankings-engine/scripts/submission-intake.ts` turns an open `product-request` issue into a reviewed draft package. After explicit activation, issue creation, editing, reopening and label changes start intake automatically. It reads the structured fields in `request-a-product.yml`, verifies public surfaces with a bounded transport, applies the existing radar qualification rules, and prepares one draft per product identity and requested arena.

## Run

From a trusted, current main checkout with the normal locked dependencies:

```sh
pnpm exec tsx rankings-engine/scripts/submission-intake.ts --issue 123
```

The default writes a local report under `reports/submission-intake-local/`, which is gitignored. It makes read-only GitHub requests and credential-free public HTTPS requests. A blocked or malformed issue produces a local error receipt. Needs-human and duplicate dispositions remain in the report, with the reason, for the maintainer handling the issue.

To create or resume the draft package:

```sh
pnpm exec tsx rankings-engine/scripts/submission-intake.ts --issue 123 --publish
```

This explicit mode requires the caller's existing repository content and PR permissions. It creates an isolated `submission-intake/` branch with a proposal, source receipts, and a review checklist, then opens a **draft** PR. It does not close or comment on the source issue, request paid review, dispatch engine workflows, or merge. An API refusal fails the run; a pushed branch remains reserved for retry. There is no credential or permission fallback.

`submission-intake.yml` handles `opened`, `edited`, `reopened`, `labeled`, and `unlabeled` issue events when repository variable `UM_SUBMISSION_INTAKE_ENABLED` is exactly `true`. Unset, false, or any other value leaves unattended processing off. The issue must be open with `product-request` and without `needs-founder` or `intake-paused`. Admission is checked both against event metadata and a fresh issue read. Per-issue concurrency preserves independent submissions; atomic per-product reservation handles concurrent duplicates. Manual dispatch remains available and defaults to preview.

Activation requires maintainer confirmation to set `UM_SUBMISSION_INTAKE_ENABLED=true` after this PR merges and a pilot is accepted. No new persistent credential is required. GitHub must already permit the built-in Actions token to create PRs. If that setting is disabled, publication stops with the reserved branch intact; changing that repository/organization permission requires separate confirmation. This change does not set the variable, change permissions settings, enable any workflow, or resume any existing content loop.

Source assessment runs with `contents: read` and `issues: read`. It uploads a same-run artifact and records the trusted main revision. A separate publisher job checks out that exact revision, downloads the artifact by its immutable ID (also supporting failed-job retries), validates it, and receives only `contents: write`, `pull-requests: write`, and `issues: read`. It makes GitHub API calls only; vendor URLs are never fetched in the write-capable job. No PAT, app credential, issue write permission, cross-run artifact lookup, or `pull_request_target` is used. Dispositions and blocked cases appear in the run summary and retained intake artifacts for human handling; source issues remain open.

## Routing and evidence

- Existing arena: fetched product content must uniquely match the requested arena at the radar threshold. The standard radar checks then assess docs, shipped substance, agentic surface, popularity anomalies, and affiliation. Passing submissions receive a schema-valid **proposed** product record in the draft package.
- Planned arena: the draft identifies the roadmap entry and peer set for reviewed arena creation under `policies/AGENT_POLICY.md`. The roadmap stays planned. Each peer still needs qualification and the arena needs stories, judged evidence, and review before it becomes live.
- Unknown arena, conflicting placement, missing evidence, malformed fields, or founder affiliation: human review, with the reason recorded. Vendor self-submissions retain their disclosure on the proposed product. Known affiliated roster identities, including renamed submissions using the same domain, route to human review.
- Already rostered product: duplicate disposition. New evidence belongs in the correction flow. Repeated requests for an unrostered product/arena share a deterministic branch. Shared code hosts use owner/repository identity rather than their common domain.

The form explicitly asks for Product site. Legacy issues may identify it with a single `Site:` line; unordered multi-link requests require clarification. Shared listing sites such as npm and PyPI require product-identity review, and path identities remain distinct so different listings cannot share a draft.

Submitter rationale and affiliation declarations are assertions. They are kept separate from fetched receipts (URL, status, checked time, content hash, bounded excerpt). A GitHub issue link is not passed to radar's repository detector as a product source. Placement remains a mechanical nomination for a reviewer to confirm against the arena definition.

The existing public submission form is the supported intake contract. The site’s Add vendor flow prefills that form. This repository exposes no separate authenticated Pro submission store or webhook contract. Pro or priority labels do not affect intake qualification, placement, inclusion, or scores. An external Pro source must use the same issue contract after its own authenticated handling; this change does not invent a private API or copy private customer data.

## Publication boundary

The draft package is a bring-up input, not a completed evaluation. After identity, placement, and source review, the maintainer applies the proposed roster input and runs the scoped standard pipeline from `docs/VENDOR-RADAR.md`, then the bias audit and repository gates. The judge's current untouched-cache preflight remains authoritative; an incompatible peer cache blocks the run instead of authorizing a category-wide re-judge. Intake does not run vendor commands or pass arbitrary URLs into the less constrained engine crawler.

Reports have identity-specific paths and preserve their original source revision. A retry resumes the branch without rewriting evidence. Concurrent reservation fails atomically and can be retried. Changed issue bodies, closed or paused source issues, changed main during preparation or retry, corrupt reservation data, and failed state reads stop publication. The reserved report carries its original main revision; a fresh checkout does not silently authorize publishing a proposal prepared against older main. A closed or merged draft is returned as the existing outcome; it is not reopened automatically. For a revised submission, update the reserved draft through review rather than bypassing its history.

The `submission-intake/` branch family and draft state remain outside the existing story-runner automatic repair/review paths. No scoring code, cache, radar discovery ledger, or paused workflow is modified.

## Fetch limits

The intake fetcher accepts credential-free HTTPS on port 443, resolves public IPv4 addresses, and pins the validated address into the TLS connection while retaining hostname certificate verification. It validates every redirect, rejects local and special-use addresses, sends no cookies or authorization, and bounds DNS time, request time, redirect hops, request count, and response bytes. IPv6-only hosts, binary documents, large responses, and bot walls require human review. The intake never follows source text as instructions.
