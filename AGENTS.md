<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# House rules

These bind every agent and contributor working in this repo.

## Evidence doctrine

- Never hand-tune a verdict, score, rank, or leaderboard position. Every ranked number is
  computed from judged evidence by the pipeline — change the inputs or the code, never the
  output. Honest negatives stay published.
- Every claim cites its evidence (vendor docs, GitHub, community sources, or a recorded
  probe). No citable evidence → no claim. Never fabricate a URL; if a source is bot-walled,
  document that and substitute a reachable one.
- Products affiliated with the founders are disclosed and bias-audited, never favored.
- Counts shown on pages are computed at build time, never hand-written. README and doc
  prose carries no counts and no dates that will go stale.

## Writing voice

- Functional titles: say what the page or table shows. No marketing adjectives, no
  "judged on evidence"-style suffixes, no invented framing ("the three pillars"), no
  conversational tics ("all pure", "the real X").

## Gates — exit codes, never grep'd output

All of these must exit 0 before any merge to main:

1. `pnpm recompute-check` (derived data deterministic)
2. `pnpm tsc --noEmit`
3. `pnpm lint` (0 errors)
4. `pnpm vitest run --maxWorkers=2`
5. `pnpm shared:check` when `content/processes/` or the shared corpus is touched

Never gate an `&&` chain on echoed text — test the tool's exit code.

## Workflow

- Every change lands as a branch + pull request. No direct commits to main.
- One `next build` at a time machine-wide; worktree lanes never build.
- Authored records in `content/processes/` are never overwritten by catalog regeneration:
  refresh only source-mirrored metadata and re-bless the manifest
  (see `scripts/shared-processes/import.py`, authored-record conflict rule).

## Immutable identifiers — legacy on purpose, never rename

`PROVENANCE_KEY 'productarena-provenance-v1'`; `pa-*` localStorage keys; `pa_session` /
`pa_state` cookies; recorded probe-evidence strings (`'productarena certify'`,
`PA_PROBE_OK`, `'productarena-probe'` user agents); `lib/mcpDemoCalls` `'self/productarena'`;
manifest source `'productarena'`; the `#pa-score` anchor; the `productarena-proxy` worker
name; `/productarena` redirect routes. These are recorded evidence or deployed state —
renaming them breaks provenance. New code reads `UM_*` env names first with `PA_*` as
deprecated fallback; user-facing copy never says "productarena" or "PA".

# Shared process content

The shared situations/process schema and records live in `content/processes/`.
Keep the old corpus, chains, jurisdiction files, and site loaders working during
the additive transition. Public Git owns shared process meaning. Private UM
instructions live as versioned additions in the API database. Do not use the
retired private process repo as a source of authority or copy private guides here.
Run `pnpm shared:check` and the shared-process tests for schema or catalog changes.

# Repository guide

Practical detail beneath the house rules. Section order is roughly the order you will
need it.

## What this repo is

Ultrametric is the open startup repo: step-by-step founder processes (`processes/`),
agent-tested vendor rankings (`data/`, `vendors/`, `pipeline/`), and open, source-cited
business logic (`lib/openstartup/`, `rules/`, `sources/`), rendered by a Next.js static
site. The knowledge layer (plain JSON and markdown, schema-validated in CI) is the
product; the site only renders it. The README has the full map.

## Setup and everyday commands

```bash
pnpm install
pnpm dev        # http://localhost:3000 (predev mirrors data/ into public/data/)
pnpm test       # vitest run: schema, scoring, and founder-ops gates
pnpm stats      # regenerates the README stats/arenas blocks and badges
```

`public/data/` is a gitignored build artifact produced by `scripts/copy-data.mjs`;
do not commit it and do not expect it to exist before a dev or build run. Per the
house rules, worktree lanes do not run `pnpm build`.

## Schemas are law

Every data file (`categories.json`, `products.json`, `stories.json`, `evidence/*.json`,
`verdicts.json`, `rankings.json`, rule cards, process records) validates against a
schema (`lib/schemas.ts`, `schemas/*.schema.json`). If a fact does not fit the schema,
change the schema deliberately in its own commit; do not stuff it into a free-text
field. Run `pnpm test` before opening any PR that touches `data/`, `processes/`,
`rules/`, `sources/`, or `jurisdictions/`.

## Generated files: do not hand-edit

The evidence doctrine in the house rules is the principle; these are the mechanical
traps:

- `data/<arena>/rankings.json` is derived. Change verdicts or evidence, then run
  `pnpm pipeline derive --category <id>`.
- The README blocks between `<!-- stats:start -->` / `<!-- arenas:start -->` style
  markers, and the badge SVGs in `public/badges/`, come from `pnpm stats` and
  `node scripts/generate-badges.mjs`. Edit around the markers, never inside them.
- `vendors/reviews/generated/` regenerates deterministically from `data/`.

## The pipeline

`pnpm pipeline <stage> --category <id> [--product <id>]` runs the stages
(crawl, extract, normalize, collect-community, probe, judge, derive, logos,
popularity). The LLM stages (`extract`, `normalize`, `collect-community`, `judge`)
need `ANTHROPIC_API_KEY` in a local `.env`. That key is local-pipeline-only: it must
never be set on the Vercel project, and the deployed site never calls the Anthropic
API. Verdicts are cache-keyed on their evidence, so re-judging without new evidence
is wasted spend; scope runs with `--product` where possible. After a contributed
correction, the minimal flow is `judge --product` then `derive`, not a full
category re-run (see CONTRIBUTING.md).

## Legal and founder-ops layer

- Rule cards are dated legal propositions with stable IDs, one proposition per card,
  each citing a primary source with an exact locator. A provider blog cannot
  establish law.
- `reviewed_on`/`review_due` are editorial dates, not legal effective dates.
- When facts or locale are missing, return `needs_review` or `unsupported`; never
  guess a legal threshold, a jurisdiction, or vendor availability.
- Every externally-effectful workflow step requires a named, scoped human approval.
- Fixtures are fictional by gate. Never commit real company data, cap tables, PII,
  or tax IDs.
- Open modules propose results; they do not authorize filings, grants, or
  transfers. Formulas cite their sources, and worked examples are replayed
  number-for-number in tests.
- Behavioral rules for agents consuming this data (what you may do autonomously vs.
  what needs human authorization) are in `governance/AGENT_POLICY.md`; maturity and
  evidence rules are in `governance/REVIEW_POLICY.md`. Follow both.

## Secrets

Never commit `.env`, API keys, or tokens. `.gitignore` excludes `.env*` except
`.env.example`. If a secret lands in history by mistake, tell a maintainer
immediately so it can be rotated; a follow-up commit does not remove it.

## Writing style

The house rules' Writing voice section covers titles and framing. The rules below
cover prose register; they apply to README, docs, reports, commit messages, and any
prose this repo publishes. They exist because the corpus is read by humans and
quoted by agents; voice drift compounds.

1. **State facts positively.** Reserve "never" for actual prohibitions with teeth
   (the API key rule, hand-editing derived files). Write "benchmarks are inputs, not
   encoded constants" instead of "benchmarks are inputs, never encoded", and prefer
   the bare positive form ("scores are computed from verdicts") when the negation
   adds nothing.
2. **Do not assert trustworthiness; demonstrate it.** The words "honest" and
   "honesty" appear only for the two named conventions (the Methodology honesty
   mechanics and the open-modules "Honesty boundaries"). Elsewhere, show the
   mechanism: dated evidence, confidence grades, bias audits. Repeatedly calling
   the work honest reads as the opposite.
3. **Em-dash discipline.** In prose, use commas, colons, parentheses, or sentence
   breaks. Em-dashes are reserved for list separators (`name — description`) and
   literal quoted strings. If a sentence needs two em-dashes, split it.
4. **No aphorism closers.** Cut "X, not Y" epigrams ("a snapshot, not a promise",
   "the template, not the ceiling") and rhetorical wrap-ups ("that's the whole
   publish flow"). End on the fact.
5. **Vary the scaffolding.** Do not stamp the same bold-label template
   ("What it is. / Where it lives. / Live. / Extend it.") across sections. Headings
   plus prose are enough.
6. **Say it once.** If a sentence or list appears twice in the document, one
   instance dies. Redundant restatement ("the share of steps an agent can run
   today ... what an agent can actually run today") is the most recognizable
   generated-text tell.
7. **No editorializing.** Drop unattributed superlatives and hype fragments
   ("the famous March recalculation", "the gap nobody's filling"). Specifics carry
   the persuasion.
8. **Keep anchors stable.** Section headings are link targets; rename one only
   after grepping the repo for its anchor.

## PR checklist

- Every gate in the house rules exits 0.
- No hand-edits inside generated blocks or derived files.
- Scores changed only via evidence/verdict changes plus `derive`.
- Prose changes follow the Writing voice and Writing style rules above.
- No secrets, no real company data, no private UM material.
