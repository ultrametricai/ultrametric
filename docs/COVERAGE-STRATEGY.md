# Coverage Strategy: an AI-first taxonomy at G2 scale

This document explains how Ultrametric grows from 11 live rankings to 180+ planned rankings
(`data/arena-roadmap.json`), how our taxonomy relates to G2's, why ours is organized differently,
and the runner architecture that gets us to 100+ live rankings in roughly three months.

## 1. The G2 tree, and how we obtained it

We fetched https://www.g2.com/categories directly (September 2026). The page rendered and we
extracted the top-level groups plus their second-level categories. **Honesty note:** the page is
very large and our fetch truncated mid-way through the "Digital Advertising Tech" group, so
second-level detail for the alphabetically later groups was not captured from the live page; the
names of those remaining top-level groups were reconstructed from G2's own public "Best Software"
hub pages surfaced via web search (g2.com/best-software-companies/top-erp,
top-it-infrastructure, top-supply-chain-and-logistics, etc.). Nothing here is scraped wholesale —
we use the tree only as a market map.

### G2 top-level groups (second-level detail captured from the live page)

| # | Group | Scale of 2nd level | Notes relevant to us |
|---|-------|--------------------|----------------------|
| 1 | Artificial Intelligence Software | ~40 categories | G2 is retrofitting AI fast: it now has "Agentic AI", "AI Gateways", "MCP Server Infrastructure Platforms", "AI Agents Marketplace", "Answer Engine Optimization (AEO) Tools", "Prompt Management". Still organized as bolt-ons to an ML-era tree. |
| 2 | Ecosystem Service Providers | ~29 | Consulting/reseller listings (AWS/SAP/Salesforce consultants). **Excluded** (see §3). |
| 3 | Sales Tools | ~20 | CRM, sales engagement, CPQ, e-signature. |
| 4 | Marketing Services Providers | ~16 | Agencies. **Excluded**. |
| 5 | Marketing Software | ~70 | Very finely sliced (URL shorteners, sweepstakes software, ...). We collapse aggressively. |
| 6 | Security Software | ~16 hubs | Each hub fans out further (SAST, CASB, endpoint, ...). |
| 7 | Analytics Tools & Software | ~16 | BI, digital analytics, enterprise search, "Agentic Analytics". |
| 8 | AR/VR Software | 2 | Thin; we skip for now (weak agent spine, hardware-tied). |
| 9 | B2B Marketplaces | 4 | Ride sharing, on-demand delivery. **Excluded**. |
| 10 | Business Services Providers | ~23 | HR services, legal services, ISPs. **Excluded** (services, not software). |
| 11 | CAD & PLM Software | ~13 | We keep one ranking (CAD) where API access is real (Onshape). |
| 12 | Collaboration & Productivity | ~55 | Team chat, docs, email, meetings, notes. Heavily collapsed by us. |
| 13 | Commerce Software | ~6 hubs | E-commerce, POS, payments. |
| 14 | Content Management | ~37 | CMS, DAM, headless CMS, form builders, website builders. |
| 15 | Customer Service Software | ~26 | Help desk, contact center, customer success. |
| 16 | Data Privacy Software | ~14 | Consent management, DSAR. Mostly tier-3 or folded into our shared privacy axis. |
| 17 | Design Software | ~18 | Graphic design, audio/video editing, podcasting. |
| 18 | Development Software | ~50 | IDEs, API tools, PaaS, DevOps, web frameworks. Our densest overlap. |
| 19 | Digital Advertising Tech | ~20 (partial capture) | Ad networks, CTV, click fraud. Mostly tier-3 for us. |

### Remaining G2 top-level groups (names recovered via G2's public hub pages; second-level not captured)

ERP Software · Governance, Risk & Compliance · Hosting Providers · HR Software · IoT Management
Platforms · IT Infrastructure Software · IT Management Software · Marketplace Apps · Office
Management Software · Supply Chain & Logistics Software · Vertical Industry Software · Zero Trust
Software.

G2's tree is roughly 20+ top-level groups and 2,000+ leaf categories, optimized for one thing:
capturing every possible buyer search phrase for review SEO. That is not our goal.

## 2. Our organizing principle: the AI-era scoring spine

Every Ultrametric ranking is judged on the same canon (see `lib/scoring.ts` — the Overall score
blends five components with renormalized weights):

| Component | Weight | Question it answers |
|-----------|--------|---------------------|
| **Agent-ready** (`agentReady`) | 0.30 | Can an AI agent drive this product? (MCP, CLI, API auth for non-humans) |
| **API quality** (`apiQuality`) | 0.20 | Once an agent is in, how good is the surface? (docs, SDKs, webhooks, idempotency) |
| **Openness** | 0.20 | Can you leave, inspect, self-host, export? |
| **Agentic features** (`agenticApp`) | 0.15 | Does the product act agentically itself? |
| **Automation depth** | 0.15 | How deep do the automation primitives go? |

Plus the shared privacy/security themes carried by per-ranking stories. **The taxonomy test is
simple: a ranking belongs in our tree if and only if this spine produces meaningful, falsifiable
verdicts for its products.** A category where agent access, API quality, and openness are
category-irrelevant cannot be a ranking, no matter how big its G2 review count is.

### How we diverge from G2

**Collapse — categories AI agents make obsolete or that only exist for SEO.** G2 slices marketing
into ~70 leaves (Email Signature Software, URL Shortener, Sweepstakes Software, Pop-Up Builders).
Most of these are one-afternoon agent tasks now, not product categories. We collapse G2's dozens
of email leaves into three rankings (transactional email APIs, email marketing, email clients), its
"AI Writing Assistants / Proofreading / Plagiarism Checker" cluster into nothing (a frontier-model
capability, not a category), and its meeting/transcription sprawl into one AI-meeting-assistants
ranking.

**Split — where agent access changes the buying decision.** We split G2's single "AI Code
Generation" into three rankings: supervised coding agents (live `ai-coding`), autonomous
ticket-to-PR agents (`async-coding-agents`), and AI code review (`ai-code-review`) — because
autonomy level is the axis buyers actually decide on. Likewise web data splits into extraction
(live `web-scraping`) vs acting on the web (`browser-automation`), and databases split by
agent-era usage pattern (managed Postgres with branch-per-agent, SQLite/edge DBs for
app-per-agent, vector DBs for retrieval) instead of G2's engine-type slicing.

**Add — AI-native categories G2 lacks or under-serves.** Agent frameworks, MCP infrastructure,
vibe-coding builders, agent sandboxes, AI memory, LLM evals/observability, model gateways, AI
search APIs, voice agents, open-weight LLMs, inference providers, agent payments, agent
identity/auth, durable execution, GEO/AEO, chat UI SDKs, GPU clouds, cloud dev environments.
Where G2 has recently added a matching leaf (AI Gateways, MCP Server Infrastructure, AEO) we
record it in `g2Equivalent` — credit where due — but our tier-1 is majority AI-native, which G2's
tree structurally cannot be.

**Tier by AI-era salience, not review volume.** Tier 1 (30 planned) = highest AI-era salience plus
classic battles with huge comparison-search demand (Slack vs Teams, Datadog vs Grafana). Tier 2
(62) = strong spine, strong demand. Tier 3 (81) = valid rankings we'll reach opportunistically.

### Explicit exclusions (spine is meaningless)

| G2 territory | Why excluded |
|---|---|
| Ecosystem Service Providers, Marketing/Business Services Providers | Human services marketplaces — no API, no agent access, no openness axis. Nothing to score. |
| B2B Marketplaces (ride sharing, on-demand delivery/wellness) | Logistics networks judged on coverage and price, not software qualities. |
| MLM software, sweepstakes, promotional products | Category exists for SEO capture; no evidence-based verdicts worth publishing. |
| Video surveillance, smart spaces, drone analytics, hardware-tied AR/VR | Verdicts hinge on hardware fleets we cannot probe; agent spine marginal. |
| Regulated vertical suites (EHR, core banking, ERP mega-suites, legal practice mgmt) | Deferred, not rejected: sales-gated products where we cannot verify claims hands-on yet. Revisit when vendors expose public APIs/sandboxes. |
| Data privacy paperwork tools (DSAR, privacy policy generators) | Privacy is a **shared axis on every ranking**, not its own ranking family; the paperwork-tool leaves are collapsing into compliance-automation (kept, tier 2). |

## 3. Roadmap file

`data/arena-roadmap.json` — 184 entries: 11 live (mirroring `data/categories.json`) + 173 planned
(tier 1: 30, tier 2: 62, tier 3: 81). Each entry: `{id, name, tier, status, g2Equivalent,
candidateProducts, rationale, aiEraAngle}`. Candidate products are seeds for the arena-builder,
not final rosters — the seeding stage verifies each product's URLs before it enters the pipeline.
Because `scripts/copy-data.mjs` mirrors `data/` into `public/data/`, the roadmap is automatically
served at `/data/arena-roadmap.json` for agents to consume.

## 4. Runner architecture for scaling

### Existing: story-runner (refresh)

`.github/workflows/story-runner.yml` runs every 6 hours, picks the next **live** ranking by
`run_number % categories.length`, re-runs the full pipeline (crawl → extract → normalize →
collect-community → probe → judge → claims → popularity → derive), and opens a PR only if data
changed. The judge's `cellHash` cache (story + evidence + prompt version) means unchanged
evidence costs zero LLM calls — a quiet ranking refresh is nearly free.

### Proposed: arena-builder (growth)

A second scheduled workflow, `arena-builder.yml`, that converts roadmap entries into live rankings:

1. **Pick** — read `data/arena-roadmap.json`; select the first `status: "planned"` entry by tier
   (1 → 2 → 3) then array order, skipping any id with an open `arena-builder/<id>` PR (idempotent
   under failures; `workflow_dispatch` input can override the pick).
2. **Seed** — one LLM pass drafts the `categories.json` entry (description, personas, themes —
   themes must include the shared canon: `agenticness`, `openness`, `automation-depth`,
   privacy/security) and `products.json` from `candidateProducts` (official URL, docs URL, repo
   URL). Every URL is then **fetch-verified** (reusing `pipeline/fetch-page.ts`); products whose
   URLs don't resolve are dropped, and the run fails if fewer than 4 survive. A second pass
   drafts ~70-90 stories following the story shape and group conventions
   (`agent-access` / `agentic-features` / `api-quality` groups under `agenticness`) used by the
   11 live rankings as few-shot examples.
3. **Run** — the same nine pipeline stages story-runner uses, via `pipeline/cli.ts`.
4. **Gate** — `pnpm test` + `pipeline/scripts/recompute-check.ts` must pass; the PR body includes
   the leaderboard and flags low-evidence cells.
5. **PR** — branch `arena-builder/<id>`; the PR adds the ranking to `data/categories.json`, adds
   `data/<id>/`, and flips the roadmap entry to `status: "live"`. **Never a direct push** — a
   human reviews product roster sanity, story quality, and verdict plausibility (same bias-audit
   discipline as the live rankings) before merge. Merging automatically enrolls the ranking in
   story-runner's rotation.

### Cost model (judge tokens dominate)

Assumptions: Sonnet-class judge (`pipeline/llm.ts` default `claude-sonnet-5`), ~$3/M input,
~$15/M output; live rankings average ~5 products × ~80 stories = **~400 judge cells**; a cell sends
story + rubric + evidence excerpts (~5-6k input) and returns a structured verdict (~0.4k output).

| Item | Tokens | Cost |
|---|---|---|
| Judge, fresh ranking (~400 cells) | ~2.3M in / ~0.16M out | **~$9-10** |
| Extract + claims + probe assists | ~0.5-1M in | ~$2-4 |
| Seeding (category, products, stories) | ~0.2M in / ~0.1M out | ~$2 |
| **Fresh ranking, total** | | **~$13-16 (budget $20)** |
| Refresh run (cellHash: 5-15% cells moved) | ~0.1-0.35M in | **~$1-3** |

### Cadence to 100+ rankings in ~3 months

- **arena-builder: 1/day** (`cron: '23 5 * * *'`), pausing itself when >3 arena-builder PRs are
  open (human review is the real throttle, ~10-15 min/PR). 30 tier-1 rankings land in the first
  month; ~90 days x ~1 merge/day → **~101 live rankings by early December 2026**, finishing tier 1
  and most of tier 2. Build cost: ~90 rankings × ~$15 ≈ **$1,350**.
- **story-runner: keep 6-hourly** (4 refreshes/day, ~$8-12/day). At 100 rankings a flat rotation
  revisits each ranking only every ~25 days, so add **tier-weighted rotation**: tier-1-live rankings
  enter the rotation array 3x, so they refresh roughly weekly while the tail refreshes monthly.
  When budget allows, move to hourly (`'17 * * * *'`) for ~4-day whole-catalog freshness at
  ~$50-70/day worst case — cellHash keeps quiet rankings near-free, so realistic spend is lower.
- **Total ~3-month spend: ~$2-2.5k** ($1.35k build + ~$0.7-1k refresh) — roughly the cost of one
  G2 review-campaign gift-card batch, for 100 evidence-based rankings.

### Failure and quality valves

- arena-builder exits green when `ANTHROPIC_API_KEY` is absent (same gate as story-runner).
- A planned ranking that fails seeding twice gets `status` left as planned and an issue opened with
  the failure log; the picker skips ids with open `arena-builder:<id>` issues.
- Re-judge stability policy (README) applies to builder PRs exactly as to refresh PRs:
  no-new-citation verdict flips get reverted in review.
