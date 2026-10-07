import { z } from 'zod'

export const CategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  personas: z.array(z.string().min(1)).min(1),
  themes: z.array(z.string().min(1)).optional(),
  // Dimensions that are not meaningful for this arena's product class (founder 2026-09-15,
  // hardware precedent: a physical chip has no agent-drivable surface or API of its own — the
  // SDK belongs to the vendor, not the part). Display-only: tables and vendor pages render
  // "n/a" for these instead of a number; the Overall score itself still shows.
  naDimensions: z.array(z.enum(['agentReady', 'agenticApp', 'apiQuality'])).optional(),
})

export const ProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  vendor: z.string().min(1),
  // 'government' (added at the government-services bring-up, founder 2026-10-05 "test the
  // untested — e.g. the IRS as a vendor"): a public agency judged as a vendor. Neither 'oss'
  // nor 'commercial' is honest for a statutory monopoly — fees are set by statute, there is no
  // pricing posture to extract, and no OSS pill applies. Display code treats it like
  // 'commercial' (no pill) except where the type itself is rendered (lib/markdown.ts).
  type: z.enum(['oss', 'commercial', 'government']),
  urls: z.object({
    site: z.string().url(),
    docs: z.string().url().optional(),
    changelog: z.string().url().optional(),
    github: z.string().url().optional(),
    extra: z.array(z.string().url()).optional(),
  }),
  logo: z.string().optional(),
  affiliation: z.string().optional(),
  links: z.object({
    app: z.string().url().optional(),
    api: z.string().url().optional(),
    cli: z.string().url().optional(),
    mcp: z.string().url().optional(),
  }).optional(),
  businessModel: z.object({
    models: z.array(z.string().min(1)).min(1),
    summary: z.string().min(10).max(240),
    url: z.string().url(),
  }).optional(),
  // Copy-pasteable install/try one-liners — curated only where a genuine OFFICIAL command
  // exists (see components/InstallCommands.tsx). `label` is a short kind like "npm", "brew",
  // "pip", "installer", "docker"; `command` is the exact vendor-documented one-liner (never a
  // paraphrase); `url` is the docs page that documents it. Absent entirely for SaaS-only
  // products with nothing to install (see METHODOLOGY.md).
  install: z.array(z.object({
    label: z.string().min(1),
    command: z.string().min(2),
    url: z.string().url().optional(),
  })).max(4).optional(),
  // YC batch code (e.g. "S22", "W23", and since YC's 2024 move to four batches a year the
  // Spring/Fall codes "X25"/"F25") for products verified — by website domain, never by name
  // alone — to be alumni of a Y Combinator batch (see pipeline/scripts/yc-cross-reference.ts and
  // data/yc-batches.json, the source of truth this field is stamped from). Display-only, like
  // PopularitySchema: never fed into scoring (lib/scoring.ts never imports it).
  ycBatch: z.string().regex(/^[WXSF]\d{2}$/, 'ycBatch must look like "S22", "W23", "X25", or "F25"').optional(),
  // Product-family membership (e.g. "stripe" for Stripe, Stripe Terminal, Stripe Atlas): the id
  // of an entry in data/product-families.json (see lib/families.ts, the source of truth for
  // family structure — this field is a denormalized back-reference kept in sync by the families
  // test). Display-only, like ycBatch/PopularitySchema: never fed into scoring, and never part
  // of the judge's cellHash (pipeline/stages/judge.ts hashes story+evidence only), so stamping
  // it on existing products never busts the judge cache.
  familyId: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'familyId must be kebab-case').optional(),
  // Enterprise-motion flag: true only for vendors whose primary go-to-market is enterprise
  // sales-led — no self-serve signup, pricing by sales contact — verified against the vendor's
  // own pricing/signup pages (enterpriseSource cites the page that shows it). Display-only,
  // like ycBatch: never fed into scoring, never part of the judge cellHash.
  enterprise: z.boolean().optional(),
  enterpriseSource: z.string().url().optional(),
  // Shutdown notice for a product that has announced it is closing: a short dated note quoting
  // the vendor's own announcement, plus the page that shows it. Display-only (an amber "CLOSING"
  // chip + note) — verdicts and history stay intact so the record is preserved; the roster keeps
  // the row until the shutdown date passes. Founder rule 2026-09-15 (Pulley precedent): verify
  // live, mark closed, keep the data.
  shutdown: z.string().min(1).max(240).optional(),
  shutdownSource: z.string().url().optional(),
  // Jurisdiction tags for type:'government' products (government-services Phase 2, founder GO
  // 2026-10-07 on docs/vendor-research/government-agenticness-world.md §5): `country` is the
  // dossier's country code (US/UK/IN/DE/FR/PT/CA — UK kept as the dossier spells it), `area`
  // the matched service area the agency is judged in. Rollup inputs only (lib/rollups.ts derives
  // country and per-area rankings from these tags plus computed scores) — never hand-feeds a
  // score, never part of the judge cellHash (judge.ts hashes story+evidence only), so tagging
  // existing products never busts the judge cache. Both set together or not at all (refined in
  // lib/rollups.ts's loader contract); non-government arenas leave them absent.
  country: z.string().regex(/^[A-Z]{2}$/, 'country must be a 2-letter uppercase code').optional(),
  area: z.enum(['company-registry', 'tax', 'ip-office', 'immigration', 'procurement']).optional(),
  // URLs from `urls` above that the crawl stage must NOT fetch (pipeline/stages/crawl.ts skips
  // them): hosts that wall keyless agents at robots.txt itself or serve a bot-management
  // interstitial (government-services Phase 2: mca.gov.in, aima.gov.pt, scc.virginia.gov,
  // ohiosos.gov, the sos.state.mn.us Radware page). The URL stays in `urls` because it is the
  // product's real front door (display/link identity); the wall itself is recorded as dated
  // probe-tier evidence instead of being re-fetched on every crawl. Robots compliance stays
  // mechanical: a category-wide crawl can never breach a recorded wall.
  crawlExclude: z.array(z.string().url()).optional(),
})

// Provenance of a story in the taxonomy: 'canonical' for the 29 ids injected verbatim by
// pipeline/agentic-stories.ts (never LLM-authored), 'normalized' for LLM-assembled stories
// (normalize.ts, or the depth-mining pass's claims-derived stories — see
// pipeline/scripts/depth-mine.ts), 'mined' for stories distilled from demand-side signal (HN/
// community discussion) or an expert-buyer gap review (same script), 'contest' for stories
// ever added/adjusted via a contest issue, 'manual' for hand-edited entries. Optional and
// additive — never referenced by cellHash (see judge.ts), so stamping/backfilling it must
// never bust the judge cache.
export const StoryOriginSchema = z.object({
  kind: z.enum(['normalized', 'canonical', 'contest', 'manual', 'mined']),
  promptVersion: z.string().optional(),
  recordedAt: z.string().optional(),
})

export const StorySchema = z.object({
  id: z.string().min(1),
  persona: z.string().min(1),
  title: z.string().min(1),
  theme: z.string().min(1),
  group: z.string().min(1),
  weight: z.number().int().min(1).max(3),
  origin: StoryOriginSchema.optional(),
  // How far a story generalizes beyond its own arena (see pipeline/scripts/tag-story-scopes.ts,
  // the deterministic tagger that stamps this): 'global' = meaningful for any software product
  // (2FA, "I can use a CLI", pricing transparency, uptime SLA) — the 29 canonical lens stories
  // are global by definition and carry the tag at the source (pipeline/agentic-stories.ts);
  // 'category' = meaningful only within this arena's domain (treasury yield, payroll runs,
  // proxy rotation); 'product' = written to probe one product's specific claim (claims-derived
  // depth-mine stories that in practice only that product holds). Optional and additive — like
  // `origin`, never referenced by cellHash (judge.ts), so stamping/backfilling it must never
  // bust the judge cache. Global stories with ≥2-arena coverage power the /global/[story]
  // cross-arena comparison pages (see lib/globalStories.ts).
  scope: z.enum(['global', 'category', 'product']).optional(),
})

export const EvidenceSchema = z.object({
  id: z.string().min(1),
  tier: z.enum(['claimed-docs', 'github', 'community', 'probe']),
  url: z.string().url(),
  excerpt: z.string().min(1),
  fetchedAt: z.string().datetime(),
})

export const VerdictBaseSchema = z.object({
  productId: z.string().min(1),
  storyId: z.string().min(1),
  verdict: z.enum(['full', 'partial', 'none', 'disputed', 'na']),
  quality: z.number().min(0).max(10),
  confidence: z.enum(['high', 'medium', 'low']),
  rationale: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)),
})

export const VerdictSchema = VerdictBaseSchema.refine(
  (v) => v.verdict === 'none' || v.verdict === 'na' || v.evidenceIds.length >= 1,
  { message: 'non-none verdicts must cite at least one evidenceId' },
).refine(
  (v) => v.verdict !== 'na' || v.quality === 0,
  { message: 'na verdicts must have quality 0' },
).refine(
  (v) => v.verdict !== 'none' || v.quality === 0,
  { message: 'none verdicts must have quality 0' },
)

// A vendor CLAIM extracted from a product's own claimed-docs/github evidence (see
// pipeline/stages/claims.ts) — distinct from a Verdict, which is our judge's assessment of
// whether the claim actually holds up. `quote` is always copied verbatim from the cited
// evidence item's own excerpt (never LLM-paraphrased), so every claim is traceable byte-for-byte
// back to something the vendor's own materials said. `storyIds` maps this claim onto the
// category's story taxonomy — empty when no story covers the claimed capability, which is
// itself a signal: a taxonomy gap worth surfacing (see lib/claims.ts's claimStatus /
// "claims outside our story set" on the product page), not an error.
export const ClaimSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(160),
  quote: z.string().min(1).max(240),
  url: z.string().url(),
  sourceTier: z.enum(['claimed-docs', 'github']),
  storyIds: z.array(z.string().min(1)),
  extractedAt: z.string().datetime(),
})

// data/{cat}/claims/{productId}.json shape: at most 60 distinct capability claims per product
// (see pipeline/stages/claims.ts's SYSTEM prompt — the LLM consolidates near-duplicate evidence
// into one claim per distinct capability, so this cap is a content limit, not a truncation).
export const ClaimsArraySchema = ClaimSchema.array().min(0).max(60)

export const StackSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  productIds: z.array(z.string().min(1)).min(2),
})

export const RankingsSchema = z.object({
  generatedAt: z.string().datetime(),
  leaderboard: z.array(
    z.object({
      productId: z.string().min(1),
      score: z.number().min(0).max(100),
      agentReady: z.number().min(0).max(100).nullable(),
      agenticApp: z.number().min(0).max(100).nullable(),
      apiQuality: z.number().min(0).max(100).nullable(),
      aiEra: z.number().min(0).max(100).nullable(),
      applicable: z.number().int().min(0),
      total: z.number().int().min(0),
      themeScores: z.record(z.string(), z.number().min(0).max(100).nullable()),
    }),
  ),
  battles: z.array(
    z.object({
      a: z.string().min(1),
      b: z.string().min(1),
      winner: z.string().min(1), // productId or "draw"
      record: z.object({
        aWins: z.number().int().min(0),
        bWins: z.number().int().min(0),
        draws: z.number().int().min(0),
      }),
      rounds: z.array(
        z.object({
          storyId: z.string().min(1),
          winner: z.enum(['a', 'b', 'draw', 'na']),
          margin: z.number().min(0),
        }),
      ),
    }),
  ),
  // Provenance watermark stamped by the derive stage (see lib/provenance.ts): identifies the
  // file as Ultrametric's published data and carries an HMAC fingerprint over the rankings
  // content, so republished copies are identifiable and verifiable
  // (pipeline/scripts/verify-provenance.ts). Optional because buildRankings' raw output is
  // schema-shaped before the stamp is attached. Keep this key LAST: recompute-check compares
  // JSON.stringify output, and zod emits keys in shape order.
  _provenance: z
    .object({
      owner: z.string().min(1),
      license: z.string().min(1),
      source: z.string().min(1),
      arena: z.string().min(1),
      fingerprint: z.string().regex(/^[0-9a-f]{32}$/),
    })
    .optional(),
})

// One line of data/{cat}/score-history.jsonl — the append-only per-product time series of the
// two headline scores (Overall score / aiEra + agent-readiness), one line per product per CHANGE
// (not per run — consecutive identical values are deduped, unlike popularity-history.jsonl's
// one-line-per-run cadence). Values are stored rounded to 1 decimal so "changed" is a stable,
// float-noise-free comparison. Seeded by pipeline/scripts/build-score-history.ts (a git-history
// backfill, so `date` is a commit date with a TZ offset there) and grown forward by the derive
// stage (which stamps rankings.generatedAt, a UTC instant). Display-only, like popularity —
// never fed back into scoring.
export const ScoreHistoryEntrySchema = z.object({
  productId: z.string().min(1),
  date: z.iso.datetime({ offset: true }),
  aiEra: z.number().min(0).max(100).nullable(),
  agentReady: z.number().min(0).max(100).nullable(),
  // Optional provenance label for entries whose move is NOT an evidence/capability change —
  // e.g. 'judge-migration-2026-09-30: sonnet-5 → opus-5-5 (prompt v4)'. Stamped so the time
  // series shows a labeled discontinuity instead of a silent evidence-looking move (see
  // docs/OPUS-5-5-JUDGE-PILOT.md §5.4). Absent on ordinary evidence-driven entries.
  note: z.string().min(1).optional(),
})

// Keyless popularity/momentum signal for one product (see pipeline/stages/popularity.ts). Every
// field is optional because coverage depends entirely on what's discoverable without an API
// key: GitHub fields only for products with urls.github, npm/pypi fields only for products
// mapped in pipeline/popularity-packages.json. This is a *display-only* signal — never fed into
// scoring (see lib/scoring.ts, which never imports this schema) — so it stays lenient rather
// than mirroring VerdictSchema's strictness.
export const PopularitySchema = z.object({
  stars: z.number().int().min(0).optional(),
  starsPerYear: z.number().min(0).optional(),
  forks: z.number().int().min(0).optional(),
  openIssues: z.number().int().min(0).optional(),
  daysSincePush: z.number().min(0).optional(),
  npmWeekly: z.number().int().min(0).optional(),
  pypiWeekly: z.number().int().min(0).optional(),
  fetchedAt: z.string().datetime(),
})

// data/{cat}/popularity.json shape: productId -> Popularity. A product absent from the map has
// no public signals at all (not "zero" — genuinely unknown), which display code must render as
// muted/absent rather than as a zero value.
export const PopularityMapSchema = z.record(z.string(), PopularitySchema)

// Multi-judge uncertainty result for one decisive cell — see pipeline/scripts/uncertainty-pass.ts.
// Only computed for cells belonging to a "close race" arena (the #1 and #2 leaderboard products
// within 3.0 Overall score points of each other) on their agenticness-theme cells (agent-access,
// agentic-features, api-quality groups — the axes that actually move the Overall score). `judgments`
// is exactly 3 independently-sampled verdict tiers for the SAME (productId, storyId) cell: the
// tier already cached in verdicts.json plus two fresh re-judgments against the same evidence
// pack. `agreement` is how many of those 3 agree with the plurality tier — '3/3' means the judge
// is stable on this cell, '2/3' or '1/3' flags real judge noise worth treating with suspicion.
export const UncertaintyEntrySchema = z.object({
  productId: z.string().min(1),
  storyId: z.string().min(1),
  judgments: z.array(VerdictBaseSchema.shape.verdict).length(3),
  agreement: z.enum(['1/3', '2/3', '3/3']),
})

// data/{cat}/uncertainty.json shape: an array of UncertaintyEntry, one per decisive cell that
// was re-judged. Entirely optional/additive — see lib/data.ts's tolerant-optional load — most
// categories (not a "close race") will have no uncertainty.json at all, and even a qualifying
// category only covers its decisive cells, not the full matrix.
export const UncertaintyArraySchema = UncertaintyEntrySchema.array()

// Analytic 68% confidence band on one product's Overall score (aiEra) and agent-readiness — see
// pipeline/scripts/compute-confidence-intervals.ts (which writes data/{cat}/score-intervals.json)
// and lib/scoreIntervals.ts (the simulation math + tolerant-optional loader). Derived at pipeline
// time by propagating the MEASURED judge re-roll variance (data/*/uncertainty.json) through the
// exact scoring formula via a seeded Monte Carlo — no new judging, display-only, never feeds
// lib/scoring.ts. Low/high are the 16th/84th percentiles of the simulated score distribution; a
// null pair means the corresponding published score is itself null (nothing to band).
export const ScoreIntervalEntrySchema = z.object({
  productId: z.string().min(1),
  aiEraLow: z.number().nullable(),
  aiEraHigh: z.number().nullable(),
  agentReadyLow: z.number().nullable(),
  agentReadyHigh: z.number().nullable(),
})
export type ScoreIntervalEntry = z.infer<typeof ScoreIntervalEntrySchema>

// data/{cat}/score-intervals.json shape: one entry per product in the arena. Optional/additive —
// same tolerant contract as uncertainty.json above: an arena that hasn't been through the
// intervals pass has no file, and display code must render no band at all (never a fabricated
// one) when the entry or file is absent.
export const ScoreIntervalsArraySchema = ScoreIntervalEntrySchema.array()

// An official, verified vendor response to one (productId, storyId) verdict — CVE-style: the
// vendor's own words, published verbatim next to the verdict (see docs/VENDOR-RESPONSES.md and
// components/StoryVerdictsTable.tsx's response block). A response NEVER changes a verdict by
// itself — it enters the evidence pool as claimed-docs-tier input for the next re-judge.
// `verification` records how we confirmed the author actually speaks for the vendor (domain
// email, public membership of the vendor's GitHub org, or a DNS TXT token — see the governance
// doc); `status` flips to 'superseded' once a later re-judge has incorporated the response.
export const VendorResponseSchema = z.object({
  productId: z.string().min(1),
  storyId: z.string().min(1),
  // The vendor's statement, verbatim (never edited or paraphrased by maintainers) — hard cap
  // keeps responses statements, not marketing pages; a fuller write-up belongs behind `url`.
  statement: z.string().min(1).max(1200),
  respondedAt: z.string().datetime(),
  // Who at the vendor spoke, by role ("DevRel lead", "CTO") — a role, not a personal name.
  contactRole: z.string().min(1),
  verification: z.object({
    method: z.enum(['domain-email', 'github-org', 'dns-txt']),
    // Short human-auditable trail, e.g. "PR #42 from github.com/acme member".
    evidence: z.string().min(1),
  }),
  // Optional link to the vendor's fuller public statement.
  url: z.string().url().optional(),
  status: z.enum(['standing', 'superseded']),
})

// data/{cat}/vendor-responses.json shape: an array of VendorResponse. Entirely optional/
// additive — see lib/data.ts's tolerant-optional load, same "absence is not an error" contract
// as popularity/claims/uncertainty — most categories have no vendor responses at all. At most
// one 'standing' response per (productId, storyId) cell (enforced in lib/data.ts); superseded
// responses stay in the file as the public record.
export const VendorResponsesArraySchema = VendorResponseSchema.array()

// data/yc-map.json shape: one entry per modern-batch (W23–S26) YC company, distilled from the
// yc-oss/api mirror of YC's public directory (see pipeline/scripts/yc-fetch.ts) plus an
// LLM-assigned arena mapping (see pipeline/scripts/yc-classify.ts). `mappedArena` is an existing
// categories.json id the company genuinely competes in; `proposedArena` is a kebab-case name for
// a new arena it clusters with peers under; a company can have at most one of the two set (never
// both), and both null means "not a software product ranked meaningfully here" (hardware,
// biotech, services, marketplaces — see METHODOLOGY.md).
export const YcCompanySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  batch: z.string().min(1),
  website: z.string().url(),
  oneLiner: z.string(),
  tags: z.array(z.string()),
  mappedArena: z.string().min(1).nullable(),
  proposedArena: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'proposedArena must be kebab-case').nullable(),
}).refine((c) => !(c.mappedArena && c.proposedArena), {
  message: 'a company cannot have both mappedArena and proposedArena set',
})

export const YcMapSchema = YcCompanySchema.array()

export type Category = z.infer<typeof CategorySchema>
export type Product = z.infer<typeof ProductSchema>
export type Story = z.infer<typeof StorySchema>
export type StoryOrigin = z.infer<typeof StoryOriginSchema>
export type Evidence = z.infer<typeof EvidenceSchema>
export type Popularity = z.infer<typeof PopularitySchema>
export type ScoreHistoryEntry = z.infer<typeof ScoreHistoryEntrySchema>
export type UncertaintyEntry = z.infer<typeof UncertaintyEntrySchema>
export type VendorResponse = z.infer<typeof VendorResponseSchema>
export type Verdict = z.infer<typeof VerdictSchema>
export type Claim = z.infer<typeof ClaimSchema>
export type Stack = z.infer<typeof StackSchema>
export type YcCompany = z.infer<typeof YcCompanySchema>
export type Rankings = z.infer<typeof RankingsSchema>
export type BattleRecord = Rankings['battles'][number]
export type LeaderboardEntry = Rankings['leaderboard'][number]
