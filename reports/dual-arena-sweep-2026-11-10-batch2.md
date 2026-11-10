# Dual-arena sweep, batch 2 (2026-11-10)

Maintainer rulings on the twelve pairs the 2026-11-09 sweep
(`reports/dual-arena-sweep-2026-11-09.md`) recorded for review, executed subject to
live-evidence verification per pair: where the fetched docs had not supported on-axis
membership, the evidence would have won and the pair been skipped with the quote (the
GitHub → durable-workflows precedent). All eleven approved pairs verified live on 2026-11-10;
the adjacent JSON carries the fetched quotes. Each add runs the standard scoped engine run;
scores stay engine-computed.

## Approved and executed

| product | to | identity in the arena |
| --- | --- | --- |
| elastic | observability | Elastic Observability |
| sentry | llm-evals-observability | Sentry |
| amplitude | feature-flags | Amplitude Experiment |
| supabase | auth-platforms | Supabase Auth |
| github | project-management | GitHub Projects |
| gitlab | security-scanners | GitLab |
| hubspot | email-marketing | HubSpot Marketing Hub |
| modal | gpu-clouds | Modal |
| next-js | frontend-frameworks | Next.js (new identity, Vercel) |
| figma-make | vibe-coding | Figma Make (new identity, Figma) |

The sentry and amplitude bring-ups are sequenced after PR #685 lands, since that PR owns the
same arena files (llm-evals-observability, feature-flags); they ride this batch once the
branch reconciles onto post-#685 main.

## Approved, execution blocked

notion → notes-knowledge: approved on the verification in the JSON (notion is genuinely
absent from the roster; REST API and MCP docs verified). The scoped judge run is stopped by
the engine's stale-peer guard. Diagnosis (2026-11-10): all 55 obsidian judge-cache cells are
stale against obsidian's current evidence pack after the wave-8 API-quality evidence append
(commit aa3e266704), while every other peer is current. Reconciling obsidian is a
product-wide re-judge owned by the API-quality lane, not a sibling-cell fix, so the roster
entry is withheld with the approval on record; the bring-up executes once that lane's
reconcile lands.

## Skipped

inngest → workflow-automation: maintainer ruling — wrong arena class (that arena ranks
no-code automation; Inngest is a developer durable-execution engine). Roster check confirms
inngest already sits in durable-workflows, its on-axis arena; recorded as a no-op.
