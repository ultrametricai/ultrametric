# Repo split plan: the open artifact and the closed site

Status: PHASE 1 spec, founder-ordered 2026-10-08, revised same day. This document
partitions the current public repo (`ultrametricai/ultrametric`, which today holds
everything: site, artifact, pipeline, worker, tests) into an OPEN repo that is exactly
the checkable substance and a CLOSED repo that runs ultrametric.ai. Founder framing: "the
open repo should just [be] the parts that should be open — the data that forms the
rankings, the processes, objects, the simulator etc — the parts people will want to check
(not the actual pages)."

Founder revision (2026-10-08): the site moves to a FRESH private repo, working name
`ultrametric-app-private`. The landing repo (`ultrametricai/landing`) stays exactly what
it is: the Astro marketing site on its zone overrides. This simplifies the bring-up
(no Astro/Next cohabitation, no npm/pnpm mixing, no Workers-Builds auto-deploys firing
on site merges) at one new cost: a third repo to provision (Vercel link, branch
protection, the codex access decision in open question 2).

Ground truth this plan is built on (all measured 2026-10-08 in this tree):

- The artifact is pure content. `data/` (4,327 files, 91 MB), `processes/`, `content/`,
  `rules/`, `schemas/`, and the other content dirs contain zero `.ts`/`.js`; the
  dependency arrow is strictly one-way, `lib/` reads the artifact.
- `lib/` is almost entirely framework-free: of 179 non-test modules, 2 import React,
  0 import `next/*`, 3 reference `@/components` (two of those type-only).
- The neighboring private repo `ultrametricai/landing` (Astro 6 on Cloudflare Workers,
  worker `tight-lake-8796`, npm, no GitHub Actions, deployed by Cloudflare Workers Builds
  on push to main) has zero code dependency on this repo today; the coupling is
  URL-level links plus the zone's `/productarena*` carve-out. It is unaffected by this
  split.
- The live edge is `infra/cloudflare-proxy` (worker `productarena-proxy` on
  `ultrametric.ai/*`), which proxies to the Vercel origin `ultrametric.vercel.app` and
  service-binds `LANDING_ASSETS` to `tight-lake-8796` for the retained landing paths.
- Deploys run `scripts/deploy-prod.sh`: fresh shallow clone of the public repo into
  `/tmp/pa-deploy`, then `vercel deploy --prod --archive=tgz` (CLI upload of local files;
  no Vercel git integration).

## 1. File partition

Dispositions: **OPEN** (stays in `ultrametricai/ultrametric`), **CLOSED** (moves to the
private site repo), **SPLIT** (file-level partition inside the directory),
**BOTH-DURING-MIGRATION** (lives in both trees until the strip, with one side canonical).

### Top-level directories

| Path | Disposition | Reason |
| --- | --- | --- |
| `data/` | OPEN | The arena evidence layer that forms the rankings; the core checkable artifact (includes the `.png`/`.webm` probe evidence inside arena dirs). |
| `processes/` | OPEN | The operational corpus, situations, artifacts, company fields, vendor registry; founder intent names it directly. |
| `content/processes/` | OPEN | The shared-process records; public Git owns shared process meaning (AGENTS.md). |
| `journeys/` | OPEN | `chains.json`, the multi-process founder paths; corpus-schema-gated content. |
| `jurisdictions/` | OPEN | Registry and per-country vendor availability; checkable legal scope. |
| `rules/` | OPEN | Dated, source-locked rule cards; the "know the rules" layer. |
| `sources/` | OPEN | Primary-authority registry the rule cards cite. |
| `lore/` | OPEN | Sourced heuristics registry. |
| `open-documents/` | OPEN | The canonical startup legal documents as dated link-only records. |
| `open-modules/` | OPEN | Index of the open founder-math modules (code in `lib/openstartup/`). |
| `resources/` | OPEN | Source registry for lore and laws. |
| `coverage/` | OPEN | Coverage and domain vocabulary for the corpus. |
| `fixtures/` | OPEN | Fictional worked-example inputs for the open modules. |
| `templates/` | OPEN | Contribution templates for processes and vendor reviews. |
| `vendors/` | OPEN | Evidence doctrine plus `reviews/generated/` (651 interchange records, deterministic regeneration from `data/`). |
| `schemas/` | OPEN | Every published shape; "schemas are law" is the public contract. |
| `governance/` | OPEN | AGENT_POLICY, REVIEW_POLICY, SECURITY; the methodology/governance layer. |
| `pipeline/` | OPEN | Resolved below ("Hard case: the pipeline"). |
| `reports/` | OPEN | Dated pipeline/radar reports; provenance of automated decisions. |
| `__tests__/` (root) | OPEN | 8 files / ~71 cases, pure data-integrity (corpus schemas, documents, lore, founder-ops, README stats blocks). |
| `app/` | CLOSED | The actual pages, including the legal/meta pages (see "Legal and meta pages" below). Exceptions handled in "Hard case: llms/openapi route generation". |
| `components/` | CLOSED | Site UI (plus its 92 test files). |
| `infra/cloudflare-proxy/` | CLOSED | The live worker: auth backend, rate limits, KV bindings, WorkOS client wiring, demo-credential plumbing. Its inputs (`lib/mcpEndpoints.ts`, `data/mcp-demo-calls.json`, the proof recordings) stay OPEN; the generated allowlists ship with the worker. |
| `public/` | SPLIT | Pipeline-produced, evidence-bearing assets OPEN (`badges/` are regenerated from the cert registry and hot-linked by vendors, `logos/` and `screenshots/` are pipeline stages' output); site chrome CLOSED (og images, marks, `faces/`, `people/`, `process-icons/`, `step-icons/`, `robots.txt`, stock svgs). |
| `lib/` | SPLIT | Resolved below ("Hard case: the lib split"). |
| `scripts/` | SPLIT | OPEN: `update-readme-stats.mjs`, `generate-badges.mjs`, `generate-corpus-schemas.ts`, `generate-situations-md.ts`, `generate-business-logic-serves.ts`, `generate-timeline-inversions.ts`, `generate-process-arena-coverage.ts`, `shared-processes/` (Python importer + checks), `content-audit.mjs` + its test, `pnpmfile.cjs`. CLOSED: `copy-data.mjs`, `dedupe-segments.mjs`, `generate-og.mjs`, `audit-site-urls.mjs`, `check-preview-runtime.mjs`, `deploy-prod.sh`, `workos-go-live.sh`, `generate-mcp-allowlist.mjs`, `generate-mcp-demo-calls.mjs` (worker build inputs). |
| `docs/` | SPLIT | OPEN: methodology and artifact docs (SCORING, SCORING-REVIEW, ACCURACY, CERTIFICATION, SELF-EVAL, PROVE-IT, COVERAGE-STRATEGY, OSS-COVERAGE, VENDOR-RADAR, product-families, judge-migration records, ARTIFACT-OBJECT-MODEL, OPEN-MODULES-GAPS, TIMELINE-INVERSIONS, `assets/`). CLOSED: site-internal docs (BUILD-SIZE, SITE-QA, AUTH, TRY-IT, TRY-IT-DEMO-ACCOUNTS, PROCESS-UI-RELEASE, search-gaps, INCORPORATION-SHOWCASE-*, FOUNDER-ASKS where site-operational). Judgment calls at file level during Phase 0 inventory. |
| `.github/workflows/` | SPLIT | OPEN: the artifact loops (story-runner, daily-snapshot, cert-sweep, accuracy-engine, vendor-radar, yc-coverage, contest-check, spike-engine) and the validation half of `ci.yml`. CLOSED: the `next build` job of `ci.yml` plus a new UI-suite workflow. |

### Significant root files

| File | Disposition | Reason |
| --- | --- | --- |
| `README.md` | OPEN | Reorganized at strip time (see Cutover step 6); the layers map survives minus site-internal rows. |
| `CONTRIBUTING.md` | OPEN | All seven contribution flows target the artifact; updated at strip time. |
| `METHODOLOGY.md` | OPEN | The trust document. |
| `LICENSE`, `DATA-LICENSE` | OPEN | License posture of the artifact. The closed repo carries its own proprietary license. |
| `CODE_OF_CONDUCT.md`, `SECURITY.md`, `CODEOWNERS` | BOTH-DURING-MIGRATION | Each repo needs its own copy; diverge after the strip. |
| `AGENTS.md`, `CLAUDE.md` | BOTH-DURING-MIGRATION | House rules split: evidence doctrine and artifact gates OPEN; build/deploy/worker rules CLOSED. Immutable-identifier list stays in both (identifiers span worker and data). |
| `next.config.ts`, `postcss.config.mjs`, `vercel.json`, `.vercelignore`, `vitest.setup.ts` | CLOSED | Site build machinery (`next.config.ts` imports `lib/processes` for redirects; it consumes the overlay). |
| `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.mjs`, `renovate.json` | BOTH-DURING-MIGRATION | Each repo keeps a slimmed copy: OPEN drops next/react/tailwind deps after the strip; CLOSED starts as a full copy. |

### Legal and meta pages — CLOSED

`app/privacy/`, `app/terms/`, `app/tos/`, `app/about/`, and the other company/meta pages
are site pages, not open substance; they move to the private repo with the rest of
`app/` (founder, 2026-10-08: "we should not take the privacy pages etc into vercel…
these should be on the private repo"). Reading made explicit so the sentence cannot be
misapplied: the deploy mechanics do not change. The private repo still deploys to Vercel
and these pages are still served by the Vercel origin behind the proxy; what changes is
which repo's SOURCE carries them (private, not public). If the founder instead means
these pages should be served from a different origin entirely (for example the landing
worker, the way the retained landing paths already work), that is a zone-override
routing change at the proxy, out of scope here and flagged as open question 5.

### Hard case: the pipeline — OPEN

The pipeline (crawl, extract, normalize, collect-community, probe, judge, derive, logos,
popularity, plus `pipeline/scripts/` and `pipeline/cache/`) stays OPEN.

- Recompute determinism is the public trust mechanism: `pnpm recompute-check` proving
  rankings regenerate bit-identically from committed verdicts is only checkable if the
  code that derives them is public. "Change the inputs or the code, never the output" is
  an empty promise if the code is private.
- The scheduled artifact loops (story-runner, cert-sweep, accuracy-engine, vendor-radar,
  yc-coverage, daily-snapshot, contest-check) all run the pipeline against `data/` and
  commit results to the artifact repo. They move nowhere.
- Judging prompts: the judge stage's prompts are already public today and become part of
  the auditable methodology. That is a feature (contestants can read exactly how they are
  judged) and a known exposure (vendors can write to the rubric); the contest flow and
  bias-audit precedent already assume visible rubrics, so publishing them is consistent.
- Keys: `ANTHROPIC_API_KEY` is local/Actions-secret only, never committed and never set
  on Vercel (existing rule, unchanged). The keyless loops stay keyless. `pipeline/cache/`
  (judge caches keyed on evidence) stays OPEN: it is how a third party replays a verdict
  without spend, and it is already published.

### Hard case: the lib split

Measured 2026-10-08: 179 non-test modules; the pipeline imports 33 of them, the app
imports 87, components import 108.

- **OPEN** (~160 modules): every artifact loader and domain-logic module. The fs-reading
  loaders (`data.ts`, `processes.ts`, `pricing.ts`, `proofs.ts`, `rollups.ts`,
  `scoreHistory.ts`, 40+ more), the static-JSON importers, the pure domain logic
  (`scoring.ts`, `schemas.ts`, `confidence.ts`, `uncertainty.ts`, `provenance.ts`,
  `claims.ts`, `freshness.ts`, sorters), `lib/openstartup/` (20 pure-math modules, each
  source-cited with 1:1 golden tests: the open modules themselves), and
  `lib/shared-processes/` (the shared-corpus reader/derivation layer, minus the two
  exceptions below).
- **The simulator, called explicitly: OPEN.** `lib/processSim.ts` (zero imports),
  `lib/virtualStartup.ts` (the decision model), `lib/virtualStartupRun.ts` (the run
  engine; its own header states it is pure, client-safe, and deterministic from
  (combo, preset, founder axes, seed)), and `lib/virtualStartupData.ts` (the binder to
  `data/`) are checkable logic with zero React/next imports. People should be able to
  verify that the sim replays the corpus rather than scripting outcomes, so the logic is
  open. The sim UI (`app/startup-sim/`, `app/vs/`, their components) is pages: CLOSED.
- **CLOSED** (~20 modules): the browser-coupled files (`processLens.ts` with React +
  `useMyStackMap`, `session.ts`, `urlState.ts`, `myStack.ts`, `watchlist.ts`,
  `shared-processes/open-target.ts`) and the site-presentation helpers (`icons.ts`,
  `arenaIcons.ts`, `processIcons.ts`, `accessGlyphs.ts`, `sparkline.ts`, `dates.ts`,
  `ordinal.ts`, `rankingJsonLd.ts`, `notFoundSpotlight.ts`,
  `stackBuilder.ts`, `humanStepsUi.ts`, `markdown.ts`, `search-index.ts`,
  `myStackData.ts`, `megaTable*.ts`, `search-entries.ts`).
- **Named hard cases and their resolutions:**
  - `lib/processRows.ts` and `lib/shared-processes/index-rows.ts` import row types from
    `@/components/ProcessesTable` (type-only). Resolution: move `ProcessRow`,
    `PlaybookRow`, `ProcessTableRow` type definitions into an OPEN module
    (`lib/processRowTypes.ts`); the component imports the types from lib, inverting the
    arrow. Then both files go OPEN (they are fs-backed corpus derivations).
  - `lib/site.ts` is imported by the pipeline and by the app routes. Resolution: OPEN
    (it is two constants, `SITE_URL` with an env override and `REPO`; the published
    artifact legitimately knows its own canonical URLs).
  - `lib/openModulePages.ts` fs-reads `open-modules/README.md` and enumerates
    `lib/openstartup/` to build `/open-modules` pages. Resolution: OPEN (it derives
    page-shaped data from open sources; the page that renders it is CLOSED).
  - `lib/shared-processes/open-target.ts` (3-line DOM helper inside the otherwise pure
    package). Resolution: move to the closed repo's site lib; it has no corpus logic.
  - `lib/virtualStartupData.ts` hard-wires `data/` paths. Resolution: OPEN unchanged;
    the overlay (section 2) preserves the paths byte-for-byte.

### Hard case: tests

344 test files, ~3,250 cases (measured 2026-10-08; single root `vitest.config.ts`, glob
`**/__tests__/**/*.test.{ts,tsx}`).

| Suite | Files | ~cases | Disposition |
| --- | --- | --- | --- |
| Root `__tests__/` | 8 | 71 | OPEN — pure artifact integrity. |
| `lib/__tests__` + `lib/openstartup/__tests__` | 166 | 1,927 | SPLIT — 150 files OPEN (loader/determinism/golden tests, 64 of them fs-reading); the 16 `.tsx` files that render `components/shared-processes/SharedProcessReader` move CLOSED with that component. |
| `pipeline/__tests__` | 33 | 339 | OPEN — derive/judge/probe/recompute correctness. |
| `components/**/__tests__` | 92 | 605 | CLOSED — UI. |
| `app/**/__tests__` | 32 | 155 | CLOSED — route/render checks, including the design pins (`app/processes/__tests__/canonicalPageDesignPin.test.tsx` and the processFlowOverview pin). |
| `infra/cloudflare-proxy/__tests__` | 10 | 147 | CLOSED — worker behavior; note three of them sync-test worker allowlists against OPEN inputs (`lib/mcpEndpoints.ts`, `data/mcp-demo-calls.json`, `data/live-probes.json`), so they run against the pinned overlay. |
| `scripts/` tests | 3 | 8 | SPLIT — `content-audit.test.mjs` OPEN (runs via `node --test` in CI, not vitest — a known glob blind spot; carry it explicitly so the split does not drop it), `check-preview-runtime.test.ts` and `dedupe-segments.test.ts` CLOSED. |

Census rule for the cutover: OPEN file count + CLOSED file count must equal the
pre-split total (344 at time of measurement; re-measure at cutover). A committed census
file in each repo makes the equality checkable in CI.

### Hard case: llms/openapi route generation — CLOSED, with parity gates

`app/llms.txt/route.ts`, `app/openapi.json/route.ts`, `app/search-index.json/route.ts`,
`app/sitemap.ts`, `app/feed.xml`, and the `/data/**` static mirror (`copy-data.mjs`) are
site-side code that publishes open data. They move CLOSED with the app because they are
Next route handlers, but they depend only on OPEN lib modules plus the overlay, and the
cutover gate (section 4) requires them byte-identical against production. The OpenAPI
document describes `/data/*.json` shapes that are owned by OPEN `schemas/`; a closed-CI
check validates the served mirror against the pinned schemas so the published contract
cannot drift from the artifact silently.

## 2. Consumption mechanism: how the closed site reads the open artifact

The closed repo needs, at build time: the content dirs (`data/`, `processes/`,
`content/processes/`, `journeys/`, `rules/`, `jurisdictions/`, `lore/`,
`open-documents/`, `open-modules/`, `sources/`, `resources/`, `coverage/`, `fixtures/`,
`templates/`, `vendors/`, `schemas/`, `governance/`, the OPEN half of `docs/` that pages
read, e.g. `docs/assets/`), the OPEN `public/` assets (badges, logos, screenshots), and
the OPEN lib modules the app imports (87-module surface, ~160 OPEN files).

### Options compared

| | (a) git submodule | (b) published npm data package | (c) build-time fetch at a pinned SHA |
| --- | --- | --- | --- |
| Pinning | Native (gitlink SHA) | Version number (indirect SHA) | Lockfile SHA, explicit |
| Vercel build | Git-integration clones public submodules; the CLI `--archive=tgz` flow uploads whatever is initialized locally, so a forgotten `submodule update` ships a stale or empty tree silently | `pnpm install` fetches it, but 91 MB of data plus 4,300 files per version is registry abuse; publish latency on every data change; version churn | One `codeload.github.com` tarball download in `prebuild` (public repo, no auth), checksum-verified |
| Path shape | Subdirectory mount; every `process.cwd()` loader path breaks or needs a root indirection | `node_modules` paths; every fs loader breaks | Materialized at canonical paths; zero import or loader changes |
| Provenance | SHA, good | npm version, weaker | SHA + tarball sha256, strongest |
| Failure mode | Silent staleness | Registry outage, size limits | Download failure is loud (checksum mismatch or 404 fails the build) |

### Recommendation: (c) as a pinned-SHA materialized overlay

The closed repo commits an `open.lock` file:

```json
{ "repo": "ultrametricai/ultrametric", "sha": "<40-hex>", "tarballSha256": "<64-hex>" }
```

A `scripts/sync-open.mjs` prebuild step (running where `copy-data.mjs` runs today):

1. Downloads `https://codeload.github.com/ultrametricai/ultrametric/tar.gz/<sha>`
   (public repo: no token, no Vercel auth problem; the PRIVATE repo is the one Vercel
   builds, and the current CLI archive-deploy flow never needs Vercel to touch GitHub at
   all), verifies `tarballSha256`, and caches by SHA.
2. Extracts exactly the paths listed in the open repo's committed
   `open-manifest.json` (the open repo owns the definition of what is open) into the
   closed working tree at their canonical paths: `data/` lands at `data/`, OPEN lib files
   land at `lib/...`, OPEN public assets land at `public/...`.
3. Fails the build on any collision (a path present both in the closed repo's git tree
   and in the manifest), so the open/closed boundary is machine-enforced and drift is
   impossible rather than reviewed-for.

All overlaid paths are gitignored in the closed repo. This is the same materialize-then-
build pattern the repo already trusts in `scripts/copy-data.mjs` and the fresh-clone
`deploy-prod.sh`, which is why it wins over the submodule: identical bytes at identical
paths, zero changes to the 40+ `process.cwd()`-relative loaders, zero changes to
`next.config.ts` tracing globs, and byte parity at cutover follows by construction.

- **Vercel mechanics:** the Vercel project builds the closed repo (via the existing
  CLI archive deploy from a local clone of the private repo, or later via git
  integration with the GitHub app installed on `ultrametricai`). The public dependency
  needs no credentials. `prebuild` runs `sync-open.mjs` then `copy-data.mjs` unchanged.
- **Update cadence:** the site pins a SHA and bumps it in a one-line `open.lock` PR, so
  every data change still deploys deliberately, preserving the batched-deploy cost
  posture of `deploy-prod.sh`. A scheduled bot PR ("bump open artifact to <sha>: <n>
  commits, <summary>") can propose bumps; a human merges. Nothing auto-deploys on
  artifact merges.
- **Design pins keep guarding founder decisions:** the pins
  (`canonicalPageDesignPin.test.tsx` and friends) live in the closed repo and run in
  closed CI on every `open.lock` bump PR. A data change that would alter a pinned
  rendering fails the bump PR before any deploy, which is exactly the review point the
  pins exist to create.
- Runner-up: (a) submodule, acceptable if the founder prefers standard tooling, but it
  still needs the overlay/manifest layer for lib and public paths, so it adds submodule
  UX on top of the same script. (b) is rejected on size, latency, and provenance.

## 3. CI and gates on both sides

### Open repo (artifact integrity, standalone)

The open repo's CI must prove the artifact's integrity with no site present:

1. `pnpm lint` (scoped to remaining code: lib, pipeline, scripts).
2. `pnpm tsc --noEmit` (OPEN tsconfig: lib + pipeline + scripts).
3. `pnpm shared:check` + the Python importer checks + `node --test scripts/content-audit.test.mjs`.
4. `pnpm vitest run` over the OPEN suites (root `__tests__/`, `lib/__tests__` minus the
   16 moved `.tsx`, `pipeline/__tests__`): schemas, corpus, golden math, loaders.
5. `pnpm recompute-check` (rankings regenerate bit-identically; the public trust gate).
6. Manifest check: every path in `open-manifest.json` exists; no CLOSED-only path listed.
7. The scheduled loops (story-runner, cert-sweep, accuracy-engine, vendor-radar,
   yc-coverage, daily-snapshot, contest-check) continue unchanged; their `pnpm test`
   steps now run the slimmer OPEN suite. The `next build` job is deleted from `ci.yml`
   at strip time, and only then.

### Closed repo (the site)

1. `sync-open.mjs` at the pinned SHA, with the collision check.
2. `pnpm lint`, `pnpm tsc --noEmit`.
3. `pnpm vitest run` over the CLOSED suites: components, app (design pins included),
   the 16 shared-process preview-render tests, worker tests, build-script tests.
4. `pnpm build` (`next build`; one build slot machine-wide locally, normal on CI).
5. **The same recompute verification against the pinned open SHA:**
   `pnpm tsx pipeline/scripts/recompute-check.ts` run from the overlaid tree (pipeline
   code and data both come from the pin). The site thereby refuses to ship rankings that
   its own pinned artifact cannot reproduce, independent of the open repo's CI.
6. Worker allowlist sync tests (`mcp-probe`, `mcp-demo-call`, `try`) against the
   overlaid `lib/mcpEndpoints.ts` / `data/*.json`, so a bump that changes probe
   manifests forces a worker regenerate-and-deploy in the same PR.
7. Test-census assertion (section 1): the two repos' committed censuses sum to the
   pre-split total until both sides agree to retire it.

## 4. Cutover plan, byte-parity first

Ordering rule: the public repo keeps serving production until parity is proven and the
switch has soaked; **the strip is the last step** because an unstripped public repo is
the rollback target.

1. **Prepare in place (public repo, additive).** Land `open-manifest.json`,
   `scripts/sync-open.mjs`, the type inversions (`ProcessRow`/`PlaybookRow`/
   `ProcessTableRow` into OPEN lib), the `open-target.ts` relocation, and the 16-test
   move. All gates stay green; production is untouched.
2. **Stand up the closed build.** Per the founder's revision, the site lands in a fresh
   private repo, working name `ultrametricai/ultrametric-app-private`: the Next app,
   components, closed lib, styles, closed public assets, closed scripts and tests, and
   `infra/cloudflare-proxy`, with the existing pnpm toolchain carried over whole. The
   landing repo is untouched. Provisioning for the new repo: Vercel project link (or the
   CLI archive flow's clone target), branch protection matching the PR workflow, the
   scheduled-loop exclusions (the artifact loops stay on the open repo), and the codex
   access decision (open question 2). `open.lock` pins the current public-repo main SHA.
3. **Preview deploy + byte/route parity verification against production.** A parity
   script crawls both deployments and asserts:
   - route census: `sitemap.xml` and `llms.txt` route sets identical;
   - `/data/**` mirror byte-identical (hash manifest over the tree);
   - `llms.txt`, `openapi.json`, `search-index.json`, `feed.xml`, `/badges/*` byte-identical;
   - rendered HTML identical per route template (every template, sampled instances)
     after normalizing `/_next/static/<hash>` asset names and the build id;
   - the dynamic preview routes (`/processes/v2`, `/processes/*/v2`) boot, via
     `check-preview-runtime.mjs` against the packaged artifact.
   Parity failures are fixed in the closed repo until the diff is empty.
4. **Switch Vercel to the closed repo.** `deploy-prod.sh` moves to the closed repo and
   clones it (private: the operator's existing GitHub auth; Vercel itself still needs no
   repo access under the CLI archive flow). Deploy, verify the proxy origin
   (`ultrametric.vercel.app`) serves the new build, re-run parity against the live site.
   The worker, zone routes, and the landing Astro site are untouched by the switch.
   **Soak: one full week of the scheduled loops, at least one `open.lock` bump cycle,
   and one worker deploy, with the public repo still deployable as rollback.**
5. **Strip the open repo.** One PR removes `app/`, `components/`, CLOSED lib, CLOSED
   scripts, CLOSED public assets, `infra/cloudflare-proxy/`, CLOSED docs, next/vercel
   configs, and the CLOSED tests; slims `package.json` (next, react, tailwind, jsdom,
   testing-library all drop) and `ci.yml` (build job deleted). Git history stays: the
   repo is stripped, not rewritten; old SHAs keep resolving, which also keeps every
   pre-split `open.lock` pin fetchable forever.
6. **The stripped README.** The layers reorg survives minus the site-internal rows: the
   "Start here" table and "Map of the repo" keep the processes/vendors/open-modules/
   lore/governance rows (these all point at OPEN paths already) and keep linking to the
   live site for rendered views; rows and sections that documented site internals
   (build size, preview runtime, Try-it plumbing) move to the closed repo's docs. The
   `pnpm stats` blocks and badge generation keep working (both scripts are OPEN).
7. **Redirects, docs, CONTRIBUTING.** In-repo route renames stay with the app
   (`next.config.ts`); proxy-layer redirects stay with the worker; neither is affected
   by the strip. CONTRIBUTING keeps all seven artifact flows and gains one line: UI and
   page changes are maintained in the private site repo, with an issue template for
   site-rendering bug reports on the public repo. AGENTS.md splits per section 1.
8. **The codex-collaboration question (founder decision, stated here, not resolved).**
   The process-UI line of work (docs/PROCESS-UI-RELEASE.md, the `codex/*` integration
   branches) targets `app/`/`components/`, which after cutover live in the private repo.
   Their PRs therefore target the CLOSED repo and need collaborator access to it, or the
   workflow changes (patches handed off, or a UI-contribution mirror). Which repo their
   process-UI PRs target afterward, and who gets private access, is the founder's call
   (open question 2).

## 5. Risks and rollback

Rollback posture: until step 5 (the strip), the public repo remains a complete,
deployable site; rollback is `deploy-prod.sh` pointed back at the public repo (one
variable), plus reverting the Vercel root-directory setting if it was changed. This is
why the strip comes last and only after the soak.

| # | Risk | Mitigation |
| --- | --- | --- |
| 1 | **Deploy auth to the private repo.** The CLI archive flow needs a local clone of the private repo; a credential gap (operator machine, or a future CI deploy) bricks deploys. Vercel git integration with a private repo needs the GitHub app granted on `ultrametricai`. | Keep the CLI archive flow for cutover (only the operator's existing `gh` auth is involved; Vercel never touches GitHub). Dry-run the private clone + deploy to a preview before the switch. Defer git integration to its own change. Note the pending Vercel team transfer (personal → UM team) and sequence it before or after, never during, the cutover. |
| 2 | **llms/data route continuity.** Agents curl `/data/*.json`, `/llms.txt`, `/openapi.json`, badge embeds, and the worker's probe manifests; any drift breaks published integrations silently. | The parity gate in step 3 makes these byte-identical before the switch; the closed CI schema check and the worker sync tests keep them pinned afterward. The overlay serves `data/` verbatim, same as `copy-data.mjs` today. |
| 3 | **Test-split gaps.** 344 files across seven suites, one vitest glob, plus `content-audit.test.mjs` which the glob already misses; a file dropped in the move vanishes without failing anything. | Committed test census on both sides with a CI equality check against the pre-split total; the known glob blind spot is called out in section 1 and carried explicitly; the 16 `lib/__tests__/*.tsx` files are enumerated in the move PR. |
| 4 | **Contributor confusion.** PRs and issues against stripped paths, forks of the old tree, stale deep links into app/ code. | CONTRIBUTING/README updated in the same strip PR; an issue template routes site-rendering reports; the strip PR description lists old → new homes; paths die in one commit rather than decaying piecemeal. |
| 5 | **The in-flight PR flow and the scheduled loops.** Open PRs touching both sides of the boundary cannot merge after the strip; the seven scheduled workflows must stay green on the slimmed suite; `open.lock` bumps add a second merge step that could stall data freshness. | PR inventory + merge-or-migrate freeze window before the strip; the loops' `pnpm test` runs the OPEN suite which is a strict subset of what they pass today; the bump-bot PR plus the batched-deploy cadence (≤3/day target) means freshness lag is bounded by the existing deploy cadence, not worsened by it. |

## 6. Phasing and effort

Lane rules apply throughout: build-free lanes wide, one `next build` machine-wide,
every change a branch + PR.

| Phase | Work | Effort |
| --- | --- | --- |
| 0. Inventory + manifest | File-level disposition pass over `docs/` and `scripts/`, `open-manifest.json`, test census, `sync-open.mjs` + collision check, all additive in the public repo | 1–2 lane-days |
| 1. Boundary refactors | Type inversions (`processRows`, `index-rows`), `open-target.ts` move, `site.ts` decision, relocate the 16 preview-render tests, OPEN tsconfig/vitest project split proven green in place | 1–2 lane-days |
| 2. Closed bring-up | Fresh private repo `ultrametric-app-private` provisioned (Vercel link, branch protection), full copy of CLOSED set, overlay wired, build + full CLOSED suite green, closed CI workflow | 2–3 days (includes the one-build-slot constraint) |
| 3. Parity | Parity script, preview deploy, iterate to empty diff | 1–2 days |
| 4. Switch + soak | Repoint deploy, live parity re-check, one week soak incl. one bump cycle and one worker deploy | 0.5 day active + 1 week elapsed |
| 5. Strip + docs | Strip PR, README/CONTRIBUTING/AGENTS updates, CI slimming, codex-collaboration answer applied | 1–2 lane-days |

Total: roughly 6–10 active lane-days plus a one-week soak, with production switchable
back at any point before Phase 5.

## 7. Post-split queue (founder follow-ups, sequenced after Phase 5)

These are ordered after the strip because each one depends on the split being the stable
state (anchorable public paths, a settled artifact registry).

1. **/artifacts needed-by lists.** The `/artifacts` index lists, for each artifact, the
   processes that need it as a real list (the consumers are already in
   `processes/artifacts.json` and the corpus's `producesArtifact`/consumes edges; this is
   page work in the closed repo over OPEN data). Queue position: first, no dependencies.
2. **Per-artifact public-repo links.** Each artifact page links to its record in the
   public repo. This ties to the per-file split assessment in
   `docs/ARTIFACT-OBJECT-MODEL.md`: the split makes these links anchorable, because the
   open repo's paths stop churning with site refactors and a pinned-SHA link to
   `processes/artifacts.json` (or a per-record anchor) stays stable. Queue position:
   after 1; wants the stripped repo's final layout.
3. **Licensing-gated vendor-in of open documents.** Pulling document templates INTO the
   repo instead of linking out is only done where each document's published license
   permits redistribution. The gate is the existing `license_note` doctrine: all 100
   records in `open-documents/registry.json` carry a `license_note` stating the actual
   terms as published (measured 2026-10-08), and those terms divide cleanly — CC-BY
   Common Paper and Bonterms texts can be vendored with attribution, public-domain IRS
   and other US-government forms can be vendored outright, CC-BY-ND oneNDA can be
   vendored only verbatim, and Cooley GO / NVCA-style terms-of-use documents are link-
   only. Spec: a per-document license check (a `redistribution: vendorable | verbatim-only
   | link-only` field derived from `license_note`, reviewed record by record) gates every
   vendor-in PR; a document whose terms do not allow redistribution is never vendored,
   whatever the convenience. Queue position: last; it is a corpus change with legal
   review in the loop.

## Phase 0/1 record

Phases 0 and 1 landed in place, all additive (2026-10-08). What exists now:

- `open-manifest.json` at the repo root: every path with its disposition (`open`, `closed`,
  `both-during-migration`); whole directories as dir entries, the SPLIT directories
  (`lib/`, `scripts/`, `docs/`, `public/`, `.github/workflows/`) file-by-file or with
  explicit sub-directory entries. Each entry carries an `overlay` flag: the open
  definition and the build-time extraction list differ (tests, workflows, and most docs
  are open without being closed-build inputs), so one manifest serves both.
- `scripts/sync-open.mjs`: the section-2 overlay (lock-pinned codeload tarball, sha256
  verification, manifest-driven extraction, collision gate against the consuming repo's
  git-tracked paths) plus a `--check` mode validating the manifest against the current
  tracked tree (entry paths exist, every tracked file classified, no open entries
  under `app/`, `components/`, `infra/`). `pnpm manifest:check` wraps it.
  Hardened after PR #224 review: manifest paths are sanitized at load (relative only,
  no `.`/`..` segments), overlay destinations and collisions compare resolved paths
  verified to sit strictly inside the consuming repo root, and a gitignored ledger
  (`.open-overlay-manifest.json`) records materialized paths so entries dropped or
  renamed at a pin bump are cleaned up under the same guards. `--check` now classifies
  the full tracked tree, not only the split directories; at adoption every tracked file
  was already covered, so no new classification calls were needed. `reports/` flipped
  to `overlay: true` because `app/reports/page.tsx` reads `reports/*.md` at build time.
  Second review round: an lstat walk rejects symlinked ancestors of any destination
  (lexical containment alone would follow a symlinked `lib` outside the root), the
  tracked-children collision check runs for file entries too (rm is recursive for every
  destination), and the ledger is written before the copy loop so a mid-run failure's
  partial output is still cleaned up at the next pin.
- `docs/repo-split-census.json` plus `__tests__/repo-split.test.ts`: the test-file census
  with its live-tree equality test (file exists if and only if listed; open + closed
  counts sum to the total; `scripts/content-audit.test.mjs` carried explicitly as the
  `node --test` file outside the vitest glob).
- Boundary refactors: `lib/processRowTypes.ts` now owns `ProcessRow`/`PlaybookRow`/
  `ProcessTableRow` (components re-export them; `lib/processRows.ts` and
  `lib/shared-processes/index-rows.ts` no longer import from `@/components`);
  `open-target.ts` moved to `components/shared-processes/`; the preview-render `.tsx`
  tests moved from `lib/__tests__/` to `components/shared-processes/__tests__/`.
- The OPEN surface proven green in place: `tsconfig.open.json` (lib minus the CLOSED
  files, pipeline, scripts, root tests) behind `pnpm typecheck:open`, and
  `vitest.open.config.ts` (root, lib, pipeline suites) behind `pnpm test:open`. The
  default `pnpm test` is unchanged.

### File-level judgment calls, docs/

Files the section-1 lists do not name. OPEN: `AFK-HANDOFF.md` (the corpus manifest
contract), `AGENTIC-DEPTH-PROGRAM.md` (measurement methodology design),
`CLASSIC-BATTLES.md` (rankings coverage backlog), `CLI-SANDBOX-DESIGN.md` and
`cli-sandbox-spike/` (probe design with its recorded keyless transcripts),
`COMPUTER-USE-FEASIBILITY.md` (recorded dry-run evidence), `FOUNDER-OPS.md` and
`FOUNDER-OPS-ROADMAP.md` (corpus architecture and arena roadmap),
`OPUS-5-5-JUDGE-PILOT.md` and `OPUS-5-5-MIGRATION-STATUS.md` (judge-migration records),
`PROCESS-ARENA-COVERAGE.md` (generated by an OPEN script, pinned by an OPEN test),
`PROCESS-COVERAGE-FOLLOW-UP.md` and `PROCESS-MIGRATION-2026-10-02.{md,json}` (corpus
migration records), `REPO-SPLIT-PLAN.md` (this document), `SIM-UM-CLI.md` (simulator
design; the sim logic is OPEN), `ULTRAMETRIC-CLI-CAPABILITIES.md` (audit of the published
CLI artifact), `VENDOR-RESPONSES.md` (verdict-response doctrine), `catalog-task-briefs/`
(read by `scripts/shared-processes/check-task-briefs.py`), `self-eval-probes/` (recorded
transcripts behind SELF-EVAL), `vendor-research/` (sourced arena research). CLOSED:
`FUNCTIONAL-100.md` (built-site crawl QA), `process-redirects.json` (route renames stay
with the app), `superpowers/` (site design plans and specs), and `FOUNDER-ASKS.md` per
the plan's own site-operational reading.

### File-level judgment calls, scripts/

The section-1 lists name every existing script. Beyond them: `scripts/__tests__/` is
CLOSED (both files test CLOSED build scripts, matching the tests table), and the new
`scripts/sync-open.mjs` is OPEN with `overlay: false` (the closed repo vendors its own
copy, since the overlay script cannot deliver itself).

### Deviations from the plan text, with reasons

1. The preview-render `.tsx` move covered 21 files, not the table's 16: re-measured at
   move time, as the census rule requires. `docs/repo-split-census.json` is the authority.
2. `vitest.setup.ts` is `both-during-migration` rather than CLOSED:
   `vitest.open.config.ts` loads it, so the open repo keeps a copy after the strip.
3. `.github/ISSUE_TEMPLATE/` and the PR template are OPEN (contribution templates target
   the artifact; section 1 names only the workflows). `ci.yml` is carried as
   `both-during-migration` until its file-level split at strip time.
4. Cross-boundary lib imports remain and are green in place; they are strip-blocking
   inversions (or re-disposition candidates) for later phases: `checklist`, `compare`,
   `storyDag` import `icons`; `compareData`, `everything`, `virtualStartupData` import
   `accessGlyphs`; `controlSurfaces` imports `arenaIcons`; `processCheck`, `stackBattle`,
   `shared-processes/selection-compatibility` import `myStack`; `processRows`,
   `storyProcessGraph`, `vendorProcesses` import `processIcons`;
   `shared-processes/computer-use` imports `humanStepsUi`;
   `shared-processes/selection-compatibility` imports `processLens`; `stackBattle`
   imports `stackBuilder`.

## Open questions for the founder

1. **Provisioning owner for `ultrametric-app-private`:** who creates the repo, links the
   Vercel project, and sets branch protection (dashboard actions, founder-level access),
   and does the repo name stay `ultrametric-app-private`?
2. **Codex collaboration:** after cutover, process-UI PRs target the private repo; grant
   collaborator access, or switch that workflow to hand-off patches?
3. **Vercel team transfer sequencing:** the planned move off the personal team happens
   before Phase 2 or after Phase 4 (not between Phases 2 and 5).
4. **License posture of the stripped repo:** `package.json` says UNLICENSED while
   LICENSE/DATA-LICENSE govern the artifact; the strip is the natural moment to make the
   open repo's code license explicit.
5. **Legal/meta page origin:** this plan keeps `/privacy`, `/terms`, `/tos`, `/about` on
   the Vercel origin with their source in the private repo. If the intent is to serve
   them from a different origin entirely (the landing worker's zone overrides), that is
   a proxy routing change to spec separately.
