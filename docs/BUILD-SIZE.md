# Build size: what's big, what we excluded, how to diagnose a regression

Founder report (2026-10-02): "we are generating 17GB of files for each build which is
grinding things to a halt", plus ENOSPC failures in Vercel's output packaging. Measured on
that date with next@16.3.8 (Turbopack), 7,118 generated pages, 94 server traces.

## The 17GB is two separate problems

`du -sh .next` = 18 GB: `.next/server` 17 GB (virtually all `.next/server/app` prerender
artifacts — problem 2), `.next/cache` ~0.3 GB, `.next/static` 2.6 MB. The tracing fix
(problem 1) does not shrink the local `.next` — it shrinks what the deployment packaging
copies per function, which is what was failing on Vercel.

### 1. Deployment traces dragged the whole corpus into every function (fixed here)

Every page imports loaders (`lib/data.ts` and friends) that read repo data with `fs` at
prerender time. `@vercel/nft` cannot tell build-time reads from runtime reads, so every
page's `.nft.json` trace listed the lot. Measured before the fix (summing the on-disk size
of every file listed by every trace — this is what Vercel copies per function when
packaging the deployment, and what ran its container out of disk):

| | before | after |
|---|---|---|
| traced bytes, all 94 traces | 10.17 GB | 2.64 GB |
| `data/**` share | 6.64 GB | 0.22 GB (preview routes only) |
| `public/**` share | 1.25 GB | 0.24 GB (preview routes only) |
| `node_modules` share (legit function deps) | 2.02 GB | 2.02 GB (unchanged — nothing over-excluded) |
| typical static page trace | ~116 MB, ~5,900 files | ~26 MB, ~290 files (node_modules + .next chunks only) |
| fattest trace (`/arena/.../product/[id]`) | 244 MB, 46,955 files | 27 MB, 393 files |
| the 3 preview-route traces | ~116 MB each | 187 MB each (see include notes below) |
| `.nft.json` files themselves on disk | 56 MB | 7.4 MB |

The preview traces GREW by design: the include globs are matched unanchored, so
`'./data/**'` re-includes the `public/data/**` mirror too (~83 MB extra per preview
function). 187 MB traced (of which ~24 MB node_modules) is below the per-function size
limit, but it is the number to watch as `data/` grows.

The fix is `outputFileTracingExcludes` in `next.config.ts`. See that file's comments for
the exact shape; the summary of what we verified **empirically against this Next version's
Turbopack tracer** (probe builds 2026-10-02 — the shipped docs describe the webpack/JS
path in `collect-build-traces.js`, which DOES NOT RUN under Turbopack):

- `'*'` works as a global route key (applies to every route, including dynamic ones).
- Exact keys (`'/ops'`), brace alternations (`'/{ops,proofs}'`), and single-star path
  segments (`'/vs/*'` matches `'/vs/[slug]'`) all work.
- **Negated keys (`'!{...}'`) are silently ignored** — do not use them.
- **Includes are applied AFTER excludes and win** — the reverse of the JS implementation
  in `collect-build-traces.js`. A route listed in `outputFileTracingIncludes` keeps those
  files even when a global exclude matches them.
- Value globs (both excludes and includes) are matched UNANCHORED (contains-style):
  `'./data/**'` also strips — or re-includes — `public/data/**`. Keep patterns specific
  enough that they cannot collide with `node_modules` paths (verified: every page trace
  keeps its full `node_modules` set with the current list).
- **Never anchor a value glob with a leading slash**: `'/data/**'` makes the tracer's
  `read_glob` walk outside the project and crash the whole build on node_modules
  platform-stub symlink loops (`TurbopackInternalError ... is a symlink causes that causes
  an infinite loop`).
- Excludes do not disturb the `next-server.js.nft.json` trace (it contains only
  `node_modules` files).

### 2. Prerender artifacts are huge (the palette-index share fixed 2026-10-02)

`.next/server/app` holds the prerendered output: 11.7 GB of `.rsc` (31,304 files,
avg 372 KB) + 6.9 GB of `.html` (6,261 files, avg 1.1 MB). Each page is materialized
~4 times: `.html`, `.rsc`, `.segments/_full.segment.rsc`, `.segments/_index.segment.rsc`
(+ per-segment files). By directory: `arena/` 9.5 GB, `vs/` 6.5 GB, `alternatives/`
0.5 GB, `processes/` 0.5 GB.

The single biggest shared cost: `app/layout.tsx` passed the full command-palette search
index (`buildSearchIndex(loadAll(), ...)` — every arena, every product, all alias
keywords) as props to the `CommandPalette` **client** component. That serialized a
~160 KB flight blob into every artifact of every page, and ~160 KB of every page's
wire HTML. A near-empty page (`/about`) was 215 KB of HTML + 172 KB rsc + 348 KB
segments mostly because of it.

Fixed by moving the index out of props: `lib/search-entries.ts` builds it,
`app/search-index.json/route.ts` (force-static, rendered once at build: a 140 KB
`.body` file) serves it, and `CommandPalette` fetches it on first open with a visible
loading row. Measured on 2026-10-02 (same machine, same corpus, 7,338 pages):
`.next/server/app` 18,841,528 KB → 15,107,488 KB (−3.6 GB); `/about` 218,559 B html +
176,148 B rsc + 356 KB segments → 55,580 B + 33,258 B + 76 KB. The cost that remains
is one JSON round-trip on the palette's first open per page load (state-cached after;
browser HTTP cache covers reloads). `scripts/check-preview-runtime.mjs` guards the new
route's trace alongside the other static routes.

`.next/server/app` still holds ~14.4 GB of per-page prerender volume (the arena/vs
page bodies themselves); any further reduction has to come from the pages' own markup,
not shared layout props.

### 2b. Round 2 (2026-10-02, same day): the pages' own payloads

Starting point: the measured 15,111,188 KB (14.41 GB) above. 6,458 prerendered pages;
the volume is battle/vs (1,876 + 1,872 pages). Every byte of a page's rendered tree is
materialized ~5×: the HTML markup, the inline flight blob in that HTML, `.rsc`,
`.segments/_full.segment.rsc` (byte-identical to `.rsc`), and
`.segments/.../__PAGE__.segment.rsc` (the page subtree again). So tree bytes are the
multiplier that matters.

What was actually in the trees (sampled across 240 `.rsc` files): Tailwind `className`
strings ~28%, `title` tooltip attributes ~9.6%, the ⚑ flag links' prefilled-GitHub-issue
URLs ~7-9%, the rest real judged-round content (rationale, citations, element structure).
Battle/vs pages carry **no** fat client props (the palette was the last one); arena index
pages carried one (full CategoryData, 1.66 MB) and product pages a purpose-built 334 KB
`rows` prop (all of it rendered — left alone).

Three fixes, none changing a rendered pixel or the static posture:

1. **Flag links** (`lib/contestUrl.ts`): the issue URL carried a ~600-byte markdown
   `body` param that GitHub *ignores* for issue-form templates — it never prefilled
   anything. Now ~230 bytes of per-field form params that actually prefill
   (`.github/ISSUE_TEMPLATE/flag-verdict.yml` field ids), two links per judged round.
2. **Arena pages** (`lib/arenaClientData.ts`): ArenaTable/StoryMatrix/stacks sections get
   CategoryData minus `verdict.rationale` and `rankings.battles`, neither read anywhere
   in those trees: 1.66 MB → 0.68 MB of flight per artifact on ai-coding.
3. **Chip class dedup** (`app/globals.css` `um-*`): the per-round/per-row verdict-chip,
   verification-pill, persona-chip and round-scaffold utility strings became one class
   each, `@apply`ing exactly the utilities they replaced (pinned byte-for-byte by
   `app/__tests__/globals-chip-classes.test.ts`).

Measured (same corpus, both builds this worktree, `du -sm`):

| route group | before | after |
|---|---|---|
| `arena/*/battle` (1,876 pages) | 5,870 MB | 5,074 MB |
| `vs/` (1,872 pages) | 5,873 MB | 5,077 MB |
| `arena/*/product` | 1,828 MB | 1,801 MB |
| `arena/` index + checklist/report/llms (95 arenas) | 372 MB | 270 MB |
| `processes/` | 249 MB | 249 MB |
| everything else | 565 MB | 552 MB |
| **`.next/server/app` total** | **15,111,188 KB (14.41 GB)** | **13,336,168 KB (12.72 GB)** |

Sample pages: battle `cursor-vs-cline.html` 2,002,670 B → 1,740,652 B (`.rsc` 1,028,177 →
895,769); arena `ai-coding.html` 3,123,409 → 2,017,681; product `cursor.html` 1,621,569 →
1,574,507.

**Honest remainder.** This round's −1.69 GB leaves 12.72 GB — above the ~9 GB that gives
Vercel's ~2× packaging comfortable headroom. What's left in the 10.2 GB of battle/vs
artifacts is, in order: the judged-round content itself (rationale + citations — the
product), the remaining non-deduped class strings, and ~1 GB of `title` hover text that
is user-visible vocabulary (shortening it changes what readers see — founder call, not a
payload fix). The two levers big enough to reach ~9 GB are posture or framework calls,
not prop fixes:

- The segment files: `_full.segment.rsc` is byte-identical to `.rsc` on every page
  (~2.9 GB of pure duplication) and `__PAGE__.segment.rsc` nearly so. This Next fork
  generates them unconditionally (`collectSegmentData` has no config gate; the
  prefetchInlining doc calls segment prefetching "a permanent part of the App Router").
  Deduplicating them (hardlinks, or an upstream flag) would pass ~9 GB on its own.
- The header menus: ArenaMenu/MobileNav props + SSR markup cost every one of the 6,458
  pages ~50 KB across artifacts (~0.35 GB). The search-index.json idiom fits, but it
  would remove the arena menu links from every page's served HTML — an internal-link-graph
  (SEO) change that needs a founder call.

`.next/cache` (Turbopack) was ~300-360 MB across builds — not part of the problem, and
fine to keep persisted in CI/Vercel build caching.

### 2c. Round 3 (2026-10-04): segment hardlinks + /vs becomes a redirect

Two changes since round 2 (the first is round 2's segment lever; the second replaces a
duplicate route family outright):

1. **Segment dedup** (`scripts/dedupe-segments.mjs`, postbuild): every page's
   `_full.segment.rsc` is byte-compared against its sibling `.rsc` and replaced with a
   hardlink when identical. This build: 6,459 pages linked, 1.60 GB freed, 0 skipped.
2. **`/vs/{slug}` is a permanent redirect, battle pages are canonical**
   (`app/vs/[slug]/page.tsx`). The route used to prerender a full second copy of every
   arena battle (5,077 MB in round 2). It keeps `generateStaticParams` +
   `dynamicParams = false`, but the page body is now
   `permanentRedirect('/arena/{category}/battle/{slug}')`: the prerendered artifact is a
   308 with a `location` header in its `.meta` (verified on `vs/claude-vs-gemini.meta`).
   The slug audit behind the flip: 1,876 battle pages, 1,872 unique pair-slugs. Every
   /vs slug has a battle twin; the four extra battle pages are pairs that battle in TWO
   arenas (claude/gemini, claude/grok, gemini/grok in ai-assistants + frontier-models;
   temporal/trigger-dev in workflow-automation + durable-workflows), and those slugs
   redirect to the first category in `loadAll` order — the battle the /vs page rendered
   before the flip. `app/vs/__tests__/vs-redirect.test.ts` pins all of this. The battle
   page inherits the canonical, the SEO title/description, and the FAQPage JSON-LD the
   mirror carried; every internal link (home podium cards, CompareRivals chips,
   alternatives rows, family cards, stack-battle slots, llms.txt, sitemap) points at the
   battle URL directly, and the sitemap delists the redirect stubs.

Measured 2026-10-04 on this worktree (7,340 pages; the corpus has grown since round 2 —
PT/CA jurisdiction content and gov-rail regeneration — so round-2 numbers are a baseline,
not an exact like-for-like):

| route group | round 2 after | round 3 |
|---|---|---|
| `vs/` (1,872 pages, now redirect stubs) | 5,077 MB | 205 MB |
| `arena/*/battle` (1,876 pages) | 5,074 MB | 4,058 MB (hardlinked segments) |
| `arena/*/product` | 1,801 MB | 1,466 MB |
| `arena/` total | — | 5,727 MB |
| `processes/` | 249 MB | 201 MB |
| everything else | — | ~645 MB |
| **`.next/server/app` total** | **13,336,168 KB (12.72 GB)** | **6,577 MB (6.42 GB)** |

`.next` overall: 6,877 MB (`.next/server` 6,603 MB, `.next/cache` 265 MB). Battle page
content itself is unchanged: `cursor-vs-cline.html` is 1,742,515 B vs round 2's
1,740,652 B (corpus drift, not markup changes).

A redirect stub still costs ~110 KB across its artifacts (39 KB html + 31 KB rsc +
segments): the root layout's flight payload (nav, menus) serializes into every page, even
one that only redirects. 205 MB for the whole stub family is acceptable; dropping the
stubs entirely would 404 every published /vs URL, so they stay.

## The include exceptions (preview routes)

The shared-reader routes use `force-dynamic`; other pages are
prerendered (`force-static`, or `generateStaticParams` + `dynamicParams = false`, and
all route handlers are `force-static`):

- `/processes/v2`: shared index
- `/processes/[slug]/v2`: shared detail, including the original incorporation URL

Old `/processes/preview` paths use native Next config redirects to these suffix URLs.

At request time they read `processes/corpus.json` (+ `artifacts.json`,
`vendor-registry.json`), `journeys/chains.json`, `content/processes/records/**` — and they
render the root layout, which reads `data/**` (`loadAll()` for the palette index) and
lists `public/logos` (`hasLogo`). Their traces must keep all of that
(`PREVIEW_RUNTIME` in `next.config.ts`). NOT kept: the 34 `pipeline/cache/judge/**` files
the auto-tracer used to drag in — nothing reads them at request time, and the include glob
cannot be narrowed to 34 files (`'./pipeline/cache/judge/**'` re-includes all ~34,000 /
133 MB). `scripts/check-preview-runtime.mjs` is the gate: it asserts the required files
are in the traces, boots the packaged artifact from ONLY the traced files, fetches the
preview routes, and fails on any ENOENT.

## Diagnosing a regression

1. `pnpm build`, then `node scripts/check-preview-runtime.mjs` — it now also fails if a
   static route's trace carries any excluded directory again (`verifyStaticTraceExcludes`).
2. To see where traced bytes go: sum `stat` sizes of the files listed in
   `.next/server/app/<route>/page.js.nft.json` (resolve entries relative to the trace
   file), bucketed by top-level directory.
3. If `.next` itself balloons again, check `du -sh .next/server/app/*` and look at a
   single page's `.html`: the `self.__next_f.push` script blobs are the serialized client
   props — a new fat blob there means someone passed a big object to a client component
   mounted in a shared layout.
4. Changing the excludes? The route keys and value globs behave as the probe results
   above describe — verify any new syntax with a probe build before trusting it; the
   shipped `output.md` doc does not describe this tracer.
