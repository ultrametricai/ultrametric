# Prove-It: the protocol for evidence-based software claims

Ultrametric's verdicts already cite evidence. Prove-It goes one step further: **claims get
recordings**. When we say "product X has a working CLI / MCP server / documented endpoint",
we publish a replayable capture of that thing actually happening — a terminal transcript or a
browser video — next to the verdict. And the protocol runs in both directions: instead of us
scraping vendors' marketing, **vendors prove their own stories** by submitting reproducible
proof specs that our runner executes, records, and publishes — pass *or* fail.

This document is the protocol. The current implementation (v1) is the probe recorder
(`rankings-engine/stages/probe-record.ts`, with per-arena probe definitions in
`rankings-engine/probes/<arena-id>.ts`), the browser-proof pilot
(`rankings-engine/scripts/record-browser-proof.ts`), the proof store (`lib/proofs.ts`,
`open-rankings/<category>/proofs/`), and the intake form
(`.github/ISSUE_TEMPLATE/prove-a-story.yml`).

## 1. Proof specs

A proof spec is a reproducible recipe for demonstrating one story:

```jsonc
{
  "storyId": "agentic-mcp-server",           // from open-rankings/<category>/stories.json
  "productId": "claude-code",
  "environment": "docker:node:22-bookworm",  // pinned docker image, or "macos-shell"
  "setup": [                                  // prepare the sandbox (may install things)
    "npm install -g @anthropic-ai/claude-code"
  ],
  "proof": [                                  // the commands that get recorded & published
    "claude --version",
    "echo '<jsonrpc initialize>' | claude mcp serve"
  ],
  "assertions": [                             // what the recording must show to PASS
    { "outputMatches": "\"serverInfo\"" },
    { "exitCode": 0 }
  ]
}
```

Anyone can submit one — vendors, users, maintainers — via the
[Prove a story](../.github/ISSUE_TEMPLATE/prove-a-story.yml) issue template. Hard rules:

- **Keyless.** No credentials, no accounts, no signup flows. If a story genuinely can't be
  demonstrated without an account, it can't be proved under this protocol (yet) — that
  limitation is itself information and stays visible on the story.
- **Deterministic.** Same spec, same result. Pin versions/digests; don't depend on time of
  day, geography, or A/B flags.
- **Cheap and bounded.** Specs get a hard wall-clock budget (default 5 minutes end-to-end)
  and no privileged access. Long-running servers are fine — the runner terminates them after
  the asserted output appears (see "exit codes" below).

## 2. The runner

Our runner executes each spec in a disposable sandbox (the declared docker image, or a clean
macOS shell for `macos-shell` specs), with a **minimal environment** — `PATH`, `HOME`, `TERM`
and nothing else, so no host secret can even reach the process — and records the session:

- **Terminal specs** run inside a pty recorder (BSD `script(1)` in v1) so the transcript is a
  faithful capture of a real terminal session, not a reconstruction.
- **Browser specs** run under Playwright with video recording; the recording shows the public
  page loading and the claimed thing being located.

Before anything is written, transcripts pass a sanitization gate (`lib/proofs.ts`):

1. pty artifacts and ANSI escapes are normalized (SGR colors are kept, everything else is
   stripped);
2. secret-shaped values (`sk-…`, `key=…`, `token: …`, bearer headers, …) are redacted;
3. **hard assert**: the final text must not match `/sk-|key|token/i` at all — residual prose
   hits are redacted too. A transcript that can't be made clean is not published, period.

**Exit codes.** For commands that terminate, the sidecar `exitCode` is the real process exit
code. For deliberately long-running processes (an MCP server answering a handshake), the
runner kills the process after the capture window and `exitCode` reports the **assertion
outcome**: `0` = the expected output was observed, non-zero = it wasn't.

## 3. Published artifacts

Every executed spec — pass or fail — produces:

```
open-rankings/<category>/proofs/<productId>/<probeId>.txt|.webm   the recording
open-rankings/<category>/proofs/<productId>/<probeId>.json        sidecar: {probeId, storyIds, command,
                                                         recordedAt, exitCode, kind}
open-rankings/<category>/proofs/index.json                        per-category index (adds productId, file)
```

Recordings render on the product page ("Probe proofs" section, `components/ProofBlock.tsx`,
private site repo) and are served raw under `/data/<category>/proofs/…` like every other
dataset file.

Provenance labels:

| provenance | meaning |
| --- | --- |
| `maintainer-authored, runner-verified` | spec written by us (v1 probes are all this) |
| `vendor-submitted, runner-verified` | spec came from the vendor; our runner reproduced it |
| `community-submitted, runner-verified` | spec came from a non-affiliated user |

A **passing** recording becomes `probe`-tier evidence for its stories — the strongest tier we
have. A **failing** recording is published too and becomes input for a `disputed` verdict:
a vendor claim that doesn't reproduce under its own proof spec is exactly what our `disputed`
tier exists for (see `METHODOLOGY.md`). Failure is a finding, not a gap — this is what flips
the market: submitting a spec is putting your claim on the record either way.

## 4. Versioning and expiry

Proofs decay. A recording is **stale** when either:

- it is older than **90 days**, or
- the product has shipped a new **major version** since `recordedAt`.

Stale proofs stay visible but are labeled stale and stop counting as probe-tier evidence
until re-run. The story-runner re-executes specs automatically on that schedule; a spec that
newly fails on re-run flips its stories to `disputed` with both recordings (the old pass, the
new fail) cited side by side.

## 5. Phasing

- **v1 (this repo, now).** Maintainer-authored probes with recordings: local CLI checks and
  real MCP stdio handshakes for `ai-coding` (`pnpm engine probe-record --category
  ai-coding` with `UM_RECORD=1`), one browser-video pilot for `web-scraping`. Proof metadata
  lives **only** in sidecar JSON + `proofs/index.json` — deliberately outside
  `lib/schemas.ts`, which is owned by another lane.
- **Phase 2 — schema integration.** Evidence items gain an optional `proofId` reference (a
  `lib/schemas.ts` change, coordinated with its owners) so verdicts cite recordings directly
  and the judge can weight "has a replayable recording" explicitly. The provenance label
  moves from this doc into the sidecar schema.
- **Phase 3 — external specs.** The issue template becomes machine-ingestible: a bot parses
  submitted specs, the runner executes them in CI sandboxes, and merged recordings carry
  `vendor-submitted` / `community-submitted` provenance automatically.
