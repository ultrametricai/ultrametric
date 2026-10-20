# Contributing to Ultrametric

Ultrametric's whole premise is that every score should trace back to cited evidence, and
that anyone can contest a verdict. This document covers the contribution paths — contesting
a verdict, adding evidence, [adding your product](#add-your-vendor) to a ranking,
[submitting a stack](#4-submit-a-stack), [adding a process](#add-a-process),
[adding a jurisdiction](#add-a-jurisdiction), or [adding an open module](#add-an-open-module) —
plus local setup and style rules.

UI and page changes are maintained in the private site repo; report rendering bugs on this
repo with the [site rendering issue form](https://github.com/ultrametricai/ultrametric/issues/new?template=site-rendering.yml).

Contributing to the **founder-ops corpus** (jurisdiction-scoped workflows, rule cards, sources,
vendor reviews, open modules) has its own workflow and review bar — see
[policies/REVIEW_POLICY.md](policies/REVIEW_POLICY.md) and the templates in
[`templates/`](templates/).

**Founders outside the US (or outside Delaware):** the highest-leverage contribution is local
knowledge — vendor availability rows for your country, verified country analogs for the
processes, rule cards for your jurisdiction, full workflows. The PR shapes, with exact
file paths and the gates that validate them, are in
[Add a jurisdiction](#add-a-jurisdiction) below.

## 1. Contest a verdict

Every verdict shown on the site (battle round cards, product pages) carries a small
"⚑ contest" link right next to it. Clicking it opens a prefilled GitHub issue — category,
product, story id, and the current verdict/quality are filled in for you, with empty sections
for your proposed verdict, evidence URLs, and quotes. It's the fast path for flagging
something that looks wrong; it does not itself change any data. A maintainer (or, eventually,
a GitHub Action) still has to do the deeper check described below: add the evidence, run
`pnpm engine judge --category <category> --product <product>`, then
`pnpm engine derive --category <category>` to update the verdict.

If you'd rather skip the prefilled link, you can also open an issue manually using the
[Contest a Verdict](./.github/ISSUE_TEMPLATE/contest-verdict.yml) template. Fill in:

- `category` and `product` (must match the ids in `open-rankings/categories.json` / `open-rankings/{category}/products.json`)
- `story id` (from `open-rankings/{category}/stories.json`)
- the current verdict (tier + quality, from `open-rankings/{category}/verdicts.json`)
- your proposed verdict
- evidence URLs and quotes supporting your proposal

**Flow:**

1. You open the issue with the fields above.
2. A maintainer reviews it against the cited evidence in `open-rankings/{category}/evidence/{product}.json`.
3. If your evidence is new or better, the maintainer (or you, via a PR — see below) adds it
   to the product's evidence file and re-judges:
   ```bash
   pnpm engine judge --category <category> --product <product>
   pnpm engine derive --category <category>
   ```
   This re-judges **every** cell for that product, not only the one you're contesting —
   see the cache note below.
4. The updated `verdicts.json` and `rankings.json` are committed with a reference to the
   issue.

### Automated contest resolution (GitHub Action)

`.github/workflows/contest-check.yml` can do steps 2–4 above automatically: when an issue is
labeled `contest` (or a maintainer runs the workflow manually via `workflow_dispatch` with an
`issue_number`), it runs `pnpm tsx rankings-engine/contest-check.ts --issue <n>`, which:

1. Fetches the issue and parses the category/product/story id and the "Evidence URLs" section
   from its body (tolerant of the exact template — see `rankings-engine/__tests__/contest-check.test.ts`
   for the cases it handles).
2. Fetches each evidence URL and appends it as a `claimed-docs`-tier evidence item, ided
   `{product}-contest-{issueNumber}-{n}` (namespaced by issue so it can never collide with ids
   the engine itself mints, or with another contest issue's items).
3. Re-runs `judge --category <category> --product <product>` and `derive --category <category>`.
4. Opens a PR on a `contest-{issueNumber}` branch referencing the issue, and comments the
   outcome (PR link, or a failure reason) back on the issue.

**This ships dormant.** It requires an `ANTHROPIC_API_KEY` repository secret (Settings →
Secrets and variables → Actions) — without it, the workflow fails fast at a "Verify required
secret" step with a clear error, before touching any data. Only a maintainer can add that
secret. Until it's configured, contested verdicts still go through the manual flow above.

You don't need to be a maintainer to do step 3 yourself — see the PR flow below.

### Vendors: respond officially instead

If you speak for the product's vendor, you can also put an official statement on the record
next to the verdict itself (CVE-style) via the
[Vendor response](./.github/ISSUE_TEMPLATE/vendor-response.yml) issue form. Responses are
verified (company-domain email, vendor GitHub org membership, or DNS TXT token), published
verbatim, and **never change a verdict by themselves** — they enter the evidence pool as
claimed-docs-tier input for the next re-judge. If your point is demonstrable with keyless,
reproducible commands, submit a proof spec instead (`docs/PROVE-IT.md`) — recordings beat
statements. Full governance: [`docs/VENDOR-RESPONSES.md`](./docs/VENDOR-RESPONSES.md).

## 2. Add evidence (PR flow)

If you have a source (docs, changelog, GitHub, a hands-on write-up) that should change a
verdict, you can propose it directly as a PR:

1. Fork/branch, then edit `open-rankings/{category}/evidence/{product}.json` to add your evidence
   item. Each item needs:
   - `id` — a unique, stable id (convention: `{product}-{tier-prefix}-{n}`, e.g. `claude-code-docs-20`)
   - `tier` — one of `claimed-docs`, `github`, `community`, `probe`
   - `url` — the source URL
   - `excerpt` — a verbatim quote (not a paraphrase) supporting the claim
   - `fetchedAt` — an ISO 8601 datetime
2. Re-judge that product:
   ```bash
   pnpm engine judge --category <category> --product <product>
   pnpm engine derive --category <category>
   ```
3. Commit **both** the evidence file and the resulting `verdicts.json` / `rankings.json`
   changes in the same PR — never hand-edit `verdicts.json` or `rankings.json` directly.
4. Open the PR describing what the new evidence shows and which cell(s) you expect to change.
   A maintainer will sanity-check the diff (does the new verdict follow from the
   cited excerpt?) before merging.

### About the judge cache and re-judge scope

The judge cache (`rankings-engine/cache/judge/`) **is committed** to the repo, keyed by a hash of
`(storyId, story title, the product's full evidence array, prompt version)` — the
*whole* evidence pack, not only the item(s) you cite. This has two consequences:

- **If you haven't touched a product's evidence, re-running `judge` for it makes no LLM
  calls** (all cells are cache hits — no `ANTHROPIC_API_KEY` even needed to hit the fast
  path). This is why the judge cache is tracked in git: everyone shares the same cache and
  doesn't re-run verdicts nobody changed.
- **If you add/edit/remove even one evidence item for a product, every cell hash for that
  product changes** — because the hash covers the full pack, not only the changed item. A
  `judge --product <product>` run will therefore re-send **all** of that product's stories to
  the LLM, not only the one your new evidence supports. Approximate scope: one LLM call per
  story in the category (see `open-rankings/{category}/stories.json` for the count), each a
  small JSON-mode call. This is expected and intentional (the judge re-evaluates the whole
  pack rather than only the new item); plan for it — a single-evidence-item PR is not a
  single-LLM-call PR.

<a id="add-your-vendor"></a>

## 3. Add your product

Founders and vendors: this is how you get your product into a ranking — and how you make sure
the rankings engine *sees* what you've built. Scores only credit cited evidence, so the single
biggest failure mode is not "the judge was harsh," it's "the crawl never saw your best pages."
(Real precedent: both Asana and Linear sat at API-quality **0**, despite shipping OpenAPI specs
and full rate-limit docs, until their deep developer-docs URLs were added to `urls.extra`.)

### 3a. Quick path: prefilled issue (no repo knowledge needed)

Go to [/submit](https://ultrametric.ai/submit), paste your product URL, and run the
instant agent-readiness scan (llms.txt / OpenAPI / MCP / robots signals). The result page links
to a **prefilled GitHub issue** with the scan attached — add which ranking you belong in and why,
and you're done. A maintainer takes it from there.

### 3b. PR path: add yourself directly

One file gets you in: append an entry to `open-rankings/<arena>/products.json` (ranking ids live in
`open-rankings/categories.json`; if no ranking fits, open a [Submit a product](./.github/ISSUE_TEMPLATE/request-a-product.yml)
issue proposing a new one instead). A real, current entry for shape reference:

```jsonc
{
  "id": "linear",                      // lowercase, stable, unique within the ranking
  "name": "Linear",
  "vendor": "Linear Orbit, Inc.",
  "type": "commercial",                // or "oss"
  "urls": {
    "site": "https://linear.app",                    // marketing claims get extracted too
    "docs": "https://developers.linear.app",         // the main evidence source
    "changelog": "https://linear.app/changelog",     // recency + shipping-velocity signals
    "extra": [
      "https://linear.app/developers/graphql.md",            // API reference
      "https://linear.app/developers/webhooks.md",           // events/webhooks
      "https://linear.app/developers/oauth-2-0-authentication.md",
      "https://linear.app/developers/rate-limiting.md",      // documented limits
      "https://linear.app/developers/deprecations.md",       // versioning/deprecation policy
      "https://linear.app/llms.txt"
    ]
  },
  "links": {
    "app": "https://linear.app/login",
    "api": "https://developers.linear.app/",
    "mcp": "https://linear.app/docs/mcp"             // your MCP docs page — see 3c
  },
  "businessModel": {
    "models": ["free-tier", "subscription-per-seat"],
    "summary": "Free tier; per-seat subscriptions; custom Enterprise.",
    "url": "https://linear.app/pricing"
  }
}
```

Why the URLs matter so much: the rankings engine crawls **exactly** `urls.site`, `urls.docs`,
`urls.changelog`, `urls.github` (README) and every `urls.extra` entry — nothing else. That crawl
is the entire corpus your docs-tier evidence is extracted from (community and probe evidence are
collected separately). Judging is evidence-or-nothing, so a capability documented only on a page
you didn't list scores `none`/0.
`urls.extra` is where you point us at the deep pages a homepage crawl misses, in rough priority:

1. **API reference** (and GraphQL/OpenAPI reference pages) — feeds the API-quality stories
2. **Rate limits / quotas** — its own scored story in most rankings
3. **Versioning + deprecation policy** — ditto
4. **Webhooks, OAuth/auth, sandbox/test-mode docs**
5. **Integrations/marketplace directory** — feeds the integration graph
6. **A raw GitHub README** (`raw.githubusercontent.com/...`) for your SDK/spec repo

Validate before opening the PR: `pnpm test` (schema checks). You do **not** need to run the
LLM engine stages or touch `stories.json`/`verdicts.json`/`rankings.json` — those are
engine-owned; maintainers run the stages on your entry. If you *do* have an
`ANTHROPIC_API_KEY` and want to include results, the sequence is
`crawl → extract → probe → judge → derive` (all `pnpm engine <stage> --category <arena>
--product <id>`), committing evidence + verdicts + rankings together.

### 3c. Make your product probe well (this is the score-moving part)

The rankings engine runs keyless, reproducible probes against public conventions, and the
[certification suite](./docs/CERTIFICATION.md) checks the same surfaces. Each artifact below
maps directly to scored stories:

| Ship this | Convention the probe checks | What it moves |
| --- | --- | --- |
| **`llms.txt`** | `GET {your-origin}/llms.txt` → 200, plain text | `agentic-agent-docs` story → Agent-ready index; cert `llms-txt` check |
| **Machine-readable API spec** | OpenAPI JSON at `/openapi.json`, `/swagger.json`, `/api/openapi.json`, or `/.well-known/openapi.json` (GraphQL: introspection + published SDL) | `api-machine-spec` + strengthens `agentic-public-api` → API-quality index; cert `openapi` check |
| **Remote MCP server** | hostname **must start with `mcp.`** on your own domain (e.g. `mcp.linear.app`), path `/`, `/mcp`, or `/sse` — that hostname rule is how our static allowlist admits your endpoint for the live "Try it" handshake on your product page | `agentic-mcp-server` (weight 3) → Agent-ready index; cert `mcp` check |
| **Keyless docs `.md` mirrors** | any docs page + `.md` serves raw markdown (Mintlify-style) | cleaner extraction of *all* your docs evidence; cert `docs-md` check |
| **Documented rate limits** | a crawlable page with actual numbers | `interface-rate-limit-disclosure` story |
| **Versioning/deprecation policy page** | ditto | `api-versioning-policy` story |
| **Sandbox/test environment docs** | ditto | `api-sandbox` story |
| **robots.txt that doesn't block everything** | `User-agent: *` not fully disallowed | cert `robots` check; agents can read you at all |

Then run the suite yourself before anyone else does:
`npx ultrametric-cli certify https://docs.your-product.com` (see
[docs/CERTIFICATION.md](./docs/CERTIFICATION.md) — passing earns a dated, badge-backed
certification).

### 3d. What happens after

1. **Pipeline runs** on your entry: crawl → extract (LLM lifts verbatim claims into your
   evidence pack) → probes (keyless checks recorded as `probe`-tier evidence) → community
   evidence → judge (every story gets a verdict citing evidence ids) → derive (rankings).
2. **Stability policy**: the judge cache is keyed on your full evidence pack, so verdicts only
   re-roll when evidence changes — and on re-judges, any verdict flip that cites **no new
   evidence** is reverted as noise (see the `revert-churn-*` scripts). Your scores don't drift
   because a model had a different day.
3. **Disagree with a verdict?** Every verdict on the site has a ⚑ contest link (section 1).
   Vendors can also put an official statement on the record (the
   [vendor-response lane](./docs/VENDOR-RESPONSES.md)) or, better, submit a reproducible proof
   spec ([docs/PROVE-IT.md](./docs/PROVE-IT.md)) — recordings beat statements.
4. **Keep it fresh**: ship a new API surface? PR the new docs URL into `urls.extra` — coverage
   gaps, not judge harshness, are the #1 cause of undeserved zeros.

## 4. Submit a stack

[/stacks](https://ultrametric.ai/stacks) is proven toolchains to use and improve — cross-market
stacks whose scored slots resolve live from the published rankings, composed from curated,
committed data (`lib/aiStacks.ts`). If you run a toolchain founders should see, propose it via
the [Submit a stack](https://github.com/ultrametricai/ultrametric/issues/new?template=submit-stack.yml)
issue form (the "Submit your stack" link on /stacks opens the same form). It asks for:

- the stack's name (and who it's for),
- the picks per ranking (ranking id + product id, one line each; unjudged layers marked editorial),
- what you shipped with it — the proof it's proven, not a wishlist,
- an affiliations disclosure (any relationship to any pick; "none" is an answer).

Submissions feed curation review — a maintainer checks the picks against the ranking
leaderboards and composes accepted stacks into the committed data by PR. The form never
auto-publishes anything.

<a id="add-a-process"></a>

## 5. Add a process

Each founder process (and each reactive situation) is authored as one canonical
definition: `open-processes/<slug>.json`, contract in
[`schemas/process.schema.json`](schemas/process.schema.json) (`#/$defs/canonical`), listed
in `open-processes/catalog.json`. `open-processes/corpus.json`,
`open-processes/chains.json`, and the equity workflow files are generated projections of
the canonical definitions: edit a definition and regenerate them with `pnpm shared:project`;
editing a projection by hand fails the `pnpm shared:check` drift gate.

The flow:

1. Copy [`templates/canonical-process.json`](templates/canonical-process.json) to
   `open-processes/<slug>.json` and fill it in, following the curation rules in
   [`open-processes/README.md`](open-processes/README.md): routing, reversibility,
   verification checks. A situation additionally carries a `trigger` and an `urgency`
   tier (see [`open-processes/SITUATIONS.md`](open-processes/SITUATIONS.md)). A chained
   founder path is a canonical definition too: the same record fields plus ordered
   `taskIds` naming existing processes, with empty `entrySteps` and `links`.
2. Add the slug to `open-processes/catalog.json` (unlisted definitions fail validation).
3. Run `pnpm shared:project`, then `pnpm shared:check` and `pnpm test`, and commit the
   definition together with the regenerated projections.

Two geo fields carry a record's reach beyond the US, both authored in the canonical
definition's metadata:

- `geoNotes` (record-level) records a country analog for the process as a whole:
  `{country, kind, summary, actionUrl, actionLabel}` with a live, official `actionUrl`.
  `kind` is `analog` (the need exists there as its own doable process), `absorbed`
  (handled automatically inside another act there), or `not-applicable` (the need
  genuinely doesn't exist there).
- `geoResolutions` (step-level) makes a step's own text the global abstraction and
  carries each country's concrete mechanics as entries (`{country, kind, label,
  guidance?, actionUrl?, actionLabel?}`, same country and kind vocabulary as `geoNotes`).
  Wherever resolutions exist, the US is one explicit entry with kind `analog`; a country
  with no committed mechanics carries no entry, and the abstraction stands there by
  design. Legal claims inside the prose cite dated rule cards in `open-law/` by id.

<a id="add-a-jurisdiction"></a>

## 6. Add a jurisdiction

This is the highest-leverage contribution for founders outside the US. The PR shapes
follow, smallest first; each is schema-validated, so `pnpm test` tells you immediately
whether your records hold up:

1. **Vendor availability in your country** — add rows to
   [`jurisdictions/vendor-geo.json`](jurisdictions/): `{productId, country, status:
   available|unavailable|partial, sourceUrl, note}`. The source must be the vendor's own
   page (or an official register) stating the fact; negatives ("US entities only") are as
   valuable as positives. These rows drive the geo switcher and "Geos supported" on the
   site.
2. **A country analog for a process** — add a `geoNotes` entry to the process's canonical
   definition ([`open-processes/<slug>.json`](open-processes/), under `metadata.geoNotes`;
   see [Add a process](#add-a-process)): `{country, kind, summary, actionUrl, actionLabel}`
   with a live, official actionUrl (Companies House, MCA/NSWS, Handelsregister, INPI…),
   then regenerate the projections with `pnpm shared:project`. This renders in the
   top-of-page geo banner and the "Outside the US" block.
3. **Rule cards for your jurisdiction** — register the jurisdiction in
   [`jurisdictions/registry.json`](jurisdictions/) with a deliberately narrow scope, then
   add `open-law/<CODE>/*.json` cards citing primary sources in
   [`open-law/citations/registry.json`](open-law/citations/) (statute, regulation, agency
   guidance; a provider blog cannot establish law). One proposition per stable ID.
4. **A full jurisdiction-scoped workflow** — copy
   [`templates/process.json`](templates/process.json), narrow the applicability dimensions,
   reference your rule cards, gate every external effect on a human approval, add a
   fictional fixture in [`open-processes/fixtures/`](open-processes/fixtures/), and record the
   maturity level in [`open-law/workflow-coverage.json`](open-law/) (`draft` or `demonstration` to
   start; `reviewed` requires a named domain expert, see the
   [review policy](policies/REVIEW_POLICY.md)).

US rules are never copied into another jurisdiction, no country is marked covered because
one workflow exists, and fixtures are fictional by gate. The validator
(`lib/founderOps.ts`, run by `pnpm test __tests__/founder-ops.test.ts`) enforces
source resolution, jurisdiction matching, approval gates, and accurate coverage reporting.

<a id="add-an-open-module"></a>

## 7. Add an open module

Open modules are pure, source-cited TypeScript under [`lib/openstartup/`](lib/openstartup/).
The bar (pure functions, a citation on every formula, tests that double as documentation,
`needs_review` wherever facts decide) and the candidate-module backlog live in
[`open-modules/README.md`](open-modules/README.md).

## Local setup

```bash
git clone https://github.com/ultrametricai/ultrametric.git && cd ultrametric
pnpm install
cp .env.example .env    # fill in ANTHROPIC_API_KEY if you need to run extract/normalize/collect-community/judge
pnpm test
```

`ANTHROPIC_API_KEY` is only needed for the LLM-driven engine stages (`extract`,
`normalize`, `collect-community`, `judge`) run locally. It is **never** required to work on
the data, and it must **never** be set on the site's Vercel project — the deployed site
serves pre-computed static `open-rankings/` and makes no LLM calls at build or request time.

## Style: schemas are law

Every data file (`categories.json`, `products.json`, `stories.json`, `evidence/*.json`,
`verdicts.json`, `rankings.json`) is validated against a Zod schema in `lib/schemas.ts`.
Before opening a PR that touches any `open-rankings/` file, run:

```bash
pnpm test
```

This runs the schema and scoring unit tests (`vitest`) and will fail loudly if your change
produces invalid data — e.g. a verdict missing a required `evidenceId`, a `na` verdict with
nonzero quality, or a `disputed` verdict citing only one evidence tier. A PR that doesn't
pass `pnpm test` won't be merged.

## No secrets

Never commit `.env`, API keys, or tokens. `.gitignore` already excludes `.env*` (except
`.env.example`) — if you're ever unsure whether something contains a secret, don't commit it
and ask first. If you accidentally commit one, tell a maintainer immediately so the key can
be rotated — don't rely on a follow-up commit to "remove" it, since it stays in git history.
