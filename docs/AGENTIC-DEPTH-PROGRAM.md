# The Agentic Depth Program

**Status: proposed, phased rollout.** This document is the design for Ultrametric's next layer of
agent-readiness measurement — a successor to (not a replacement for) the current
`agentic-*`/`api-*` verdict cells described in [METHODOLOGY.md](../METHODOLOGY.md#the-agenticness-index).
Those cells ask *"does documentation/evidence say this product has an MCP server / CLI /
API?"* The Agentic Depth Program asks the harder question: *"if an agent actually tries to use
it, how far does it get, and how reliably?"*

It is linked from the README's "Status & roadmap" section as the headline item in active
expansion.

## Why a separate program

Evidence-tier judging (vendor docs, GitHub, community, probe) is fast, keyless, and scales to
every ranking, but it has a ceiling: it can tell you a product *claims* an MCP server exists, and
even confirm the endpoint resolves (`probe` tier), but it cannot tell you whether that MCP
server returns well-formed tool schemas, degrades gracefully under a long context, or survives
a malformed request. That requires actually running something against the product. The
Agentic Depth Program is where that runtime work lives, kept structurally separate from the
evidence pipeline so a slow, sandboxed, occasionally-flaky conformance suite never blocks or
destabilizes the fast evidence-in/rankings-out loop that powers the current site.

## 1. Capability ladders (L0–L5)

Every product gets a ladder rung per surface, not a single yes/no. The same six-rung scale
applies across all four surfaces so cross-surface comparison is meaningful:

| Rung | Meaning |
|---|---|
| L0 | No surface exists, or it's undocumented/unreachable. |
| L1 | Surface exists and is documented, but unverified — claim only (today's evidence tiers stop here). |
| L2 | Surface resolves and responds to a minimal handshake (today's `probe` tier reaches here for a few checks). |
| L3 | Surface passes a structural conformance suite (schema-valid, spec-compliant, correct error shapes) — see §2. |
| L4 | Surface completes realistic agent task trials end-to-end — see §3. |
| L5 | Surface sustains repeated, adversarial, and long-horizon use without degrading (robustness + safety, sustained over time, not a single trial). |

Ladders are tracked per surface:

- **MCP** — server discoverability, handshake, tool/resource schema quality.
- **API** — REST/HTTP surface: docs, spec, versioning, error shapes, rate limits.
- **CLI** — official command-line surface: scriptability, machine-readable output.
- **Automation** — webhooks, scheduled jobs, bulk operations, workflow primitives.
- **Human-AI UX** — how well a product's *human-facing* surface tolerates or assists an
  agent acting on a human's behalf (e.g. an agent operating a web UI, not just an API).

A product's overall "agentic depth" is not a single number collapsing all five ladders — the
leaderboard will show the per-surface rungs plus a summary, the same way the current Arena
Score is a transparent weighted blend rather than a black box (see README §5).

## 2. ArenaBench: runtime conformance suites

**ArenaBench** is the versioned, public conformance spec + runner that gets a product from L2
to L3. It is deliberately narrow and mechanical — no LLM judgment in the loop, just protocol-
and contract-level checks, so results are reproducible and adversarially hard to dispute.

- **MCP suite**: handshake (initialize/list-tools/list-resources round-trip), schema lint
  (every tool's input schema is valid JSON Schema, required fields are actually enforced,
  descriptions aren't empty), and a context-bloat check (does a minimal tool-list response stay
  under a sane token budget, or does it dump megabytes of schema at the agent before it's done
  anything).
- **API suite**: error-shape probes (do 4xx/5xx responses follow a consistent, parseable
  error format), rate-limit probes (documented limits actually enforced and reported via
  standard headers, not a silent drop), and idempotency probes (does a repeated write with an
  idempotency key actually dedupe, or double-apply).
- **CLI suite**: non-interactive/non-TTY behavior (does it hang waiting for input when stdin
  isn't a terminal), `--json`/machine-readable output mode where advertised, and exit-code
  correctness (0 on success, distinct nonzero codes on distinct failure classes, not a blanket
  1).

Every suite run produces a **transcript** — the literal requests/responses or command
invocations and their outputs — stored as evidence, the same way probe-tier evidence works
today. The transcript, not just a pass/fail bit, is the artifact anyone can audit. The spec
itself is versioned (`ARENABENCH_VERSION`, mirroring the existing `PROMPT_VERSION` pattern in
`pipeline/stages/judge.ts`) so suite changes don't silently reshuffle historical scores —
a version bump is a visible, changelogged event, and old transcripts stay attributed to the
spec version that produced them.

## 3. Agent task trials

L3→L4 requires an actual agent attempting real work against a sandboxed instance of the
product (a disposable account/workspace, never production data — mirroring the `api-sandbox`
story already in the taxonomy). Each trial is scored on five independent axes, not collapsed
into one pass/fail:

| Axis | What it measures |
|---|---|
| Success | Did the agent complete the task at all? |
| Autonomy | How much human intervention/hand-holding was required mid-task? |
| Efficiency | Tool calls, tokens, and wall-clock time relative to a reasonable baseline. |
| Robustness | Does it still succeed when the task is perturbed (renamed fields, slower responses, partial failures injected)? |
| Safety | Did the agent stay within scope — no destructive side effects, no leaking scoped-credential access beyond what the task needed? |

Task trials are the most expensive tier and the most valuable — they're what actually
distinguishes "has an MCP server" from "an agent can get real work done through it." They run
on a slower cadence than ArenaBench (see §6) precisely because of that cost.

## 4. Demand-side story mining + claims gap analysis

Capability ladders and conformance suites measure supply (what a product's surface actually
does). The program's other half measures demand: mining real user/developer stories (support
forums, issue trackers, "how do I get an agent to do X with this" threads) to find the
capabilities people are actually trying to use agents for, then running a **claims gap
analysis** — where a vendor's marketing claims an L4/L5-grade capability but ArenaBench or task
trials only substantiate L1/L2. That gap, not the raw rung, is often the more interesting
signal for a buyer: a product overclaiming its agent-readiness is arguably worse than one that
makes no claim at all. Gap findings feed back into the existing `disputed` verdict tier
(vendor claims it, evidence contradicts) already defined in the README's judged-cells table.

## 5. Multi-judge uncertainty on close cells

Any cell near a rung boundary, or where task-trial axes disagree sharply (e.g. high success but
low safety), is re-run through multiple independent judge passes rather than a single verdict,
and the *disagreement itself* is surfaced (e.g. "3/5 judge passes scored this L4, 2/5 scored
L3 citing a robustness failure") instead of silently averaged away. This extends the existing
re-judge-stability policy (README §7) — which already treats churn as a signal to investigate,
not noise to hide — to cells where the underlying trial, not just the LLM judging it, is
genuinely ambiguous.

## 6. Monthly snapshots → agentic-velocity leaderboard

ArenaBench and task-trial results are captured as dated **snapshots**, not overwritten in
place. A monthly cadence balances cost (task trials are expensive) against staleness. The
snapshot history feeds an **agentic-velocity leaderboard** — not just "who's ahead" but "who's
improving fastest," ranking products by month-over-month rung movement and gap closure. This
is the leaderboard most useful to a vendor deciding where to invest, and to a buyer deciding
whether a laggard is catching up or falling further behind.

## 7. Governance

- **Vendor evidence submissions.** Vendors may submit their own ArenaBench transcripts or
  task-trial logs as supporting evidence, exactly like the existing contest flow
  (`CONTRIBUTING.md`) — submissions are additive evidence, never a direct score override, and
  are subject to the same adversarial review as any other contested verdict.
- **Standing adversarial audits.** The bias-disclosure practice already applied to the judge
  model itself (README §8) extends to the program as a whole: recurring, published audits that
  specifically hunt for judge leniency/harshness patterns, vendor gaming of sandboxed trials,
  and spec version changes that quietly favor one product's existing integration over another's.
- **Annual State of Agentic Software report.** A yearly synthesis — aggregate rung
  distributions across rankings, the biggest claims gaps closed and opened, and the year's
  agentic-velocity leaders — published as a standalone document, separate from the
  continuously-updated leaderboards, so there's a fixed point-in-time reference for citation.

## Phases

- **Phase 1 — Spec + transcripts.** Publish the versioned ArenaBench spec (MCP/API/CLI suites)
  and wire suite runs to produce evidence-grade transcripts, gated behind the sandbox
  infrastructure needed to run them safely against real products without touching production
  data. No leaderboard changes yet — this phase is instrumentation only.
  - **Exit criteria:** at least one full ranking has ArenaBench transcripts for every product on
    every implemented surface; transcripts are reproducible on a re-run with no product-side
    changes.
- **Phase 2 — Ladder rungs on-site.** Surface L0–L3 rungs per surface on product pages
  alongside (not replacing) the existing agenticness cells; add the claims-gap flagging from
  demand-side mining for the rankings with the richest community signal.
  - **Exit criteria:** ladder rungs are live on-site for at least two rankings; a documented gap
    analysis exists for every product flagged as overclaiming.
- **Phase 3 — Task trials + L4/L5.** Stand up sandboxed task-trial infrastructure, run the
  five-axis trial scoring, and light up L4/L5 rungs. Introduce multi-judge uncertainty
  handling for close cells.
  - **Exit criteria:** task trials running on the monthly cadence for at least one ranking, with
    disagreement reporting live wherever judge passes split.
- **Phase 4 — Velocity leaderboard + governance.** Ship the agentic-velocity leaderboard off
  the accumulated snapshot history, open the vendor evidence-submission channel, stand up the
  recurring adversarial audit cadence, and publish the first annual State of Agentic Software
  report.
  - **Exit criteria:** at least two monthly snapshots exist to compute velocity from; the first
    annual report is published.

Each phase ships independently and is additive to the current site — no phase requires
retracting or invalidating the existing evidence-tier verdicts, and every ArenaBench/task-trial
result is itself subject to the same contest mechanism as any other verdict on Ultrametric.
