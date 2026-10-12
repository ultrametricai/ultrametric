// Analytic score intervals (v1) — honest 68% confidence bands on every Overall score, derived
// WITHOUT any new judging. See README "Score intervals" for the full writeup; the model, exactly:
//
//   Per product, each verdict cell gets a noise distribution built from the MEASURED re-roll
//   statistics in rankings/*/uncertainty.json (the multi-judge uncertainty pass re-judged 650+
//   decisive cells 2 extra times each against unchanged evidence — see
//   pipeline/scripts/uncertainty-pass.ts):
//
//   - Evidenced full/partial/disputed/none cells resample their verdict tier from the measured
//     cached-tier → re-roll-tier transition rates (e.g. a cached `full` re-rolled to `partial`
//     ~7% of the time fleet-wide). Same tier keeps the cached quality; a flip keeps the cached
//     quality under the new tier's VERDICT_FACTOR (flips to `none` force quality 0 per schema;
//     flips OUT of `none` take `reviveQuality`, the fleet-median quality of partial verdicts).
//   - Untested cells (verdict `none` citing zero evidence — "we found nothing either way", not
//     "it failed") carry deliberately WIDER epistemic uncertainty: with probability
//     `untestedFlipRate` (the measured share of re-rolled cells with ANY judge disagreement,
//     ~20%) the cell could be a `partial` on new evidence, with quality drawn uniformly from the
//     bounded plausible range `untestedQualityRange` ([3, 7]).
//   - `na` cells are PINNED: the re-judge stability policy (README §7) reverts applicability
//     flips that cite no new evidence, so published applicability is policy-stable and we do not
//     model na↔none noise.
//
//   Each of `draws` (default 500) Monte Carlo draws resamples every relevant cell and
//   recomputes the score through the EXACT published formula — lib/scoring.ts's weightedPercent
//   per component and computeAiEra for the blend, roundings included. The 68% band is the
//   16th/84th percentile of the resulting distribution. The PRNG is seeded (mulberry32 over an
//   FNV-1a hash of a per-product key) — never Math.random — so builds are byte-reproducible.
//
// This measures propagated JUDGE-SAMPLING noise plus untested-cell ignorance — NOT model-family
// disagreement (that upgrade needs a second judge model; see README future work).
//
// Layout mirrors the scoreHistory/scoreTrend split, collapsed into one file: the simulation +
// measurement helpers up top are pure (no fs — unit-testable, usable from the pipeline script),
// the tolerant-optional loader for rankings/{cat}/score-intervals.json at the bottom uses node:fs
// and is server-only. Client components never import this module — bands reach them as props.
import fs from 'node:fs'
import path from 'node:path'
import { computeAiEra, weightedPercent } from './scoring'
import {
  type ScoreIntervalEntry, ScoreIntervalsArraySchema, type Story, type UncertaintyEntry, type Verdict,
} from './schemas'

export type { ScoreIntervalEntry }

// ---------------------------------------------------------------------------
// Seeded PRNG — deterministic builds, no Math.random anywhere in this module.
// ---------------------------------------------------------------------------

// 32-bit FNV-1a — stable string → seed so each product gets its own reproducible stream,
// independent of the order products are processed in.
export function hashSeed(key: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// mulberry32 — tiny, well-distributed 32-bit seeded PRNG returning floats in [0, 1).
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------------
// Noise model — built from MEASURED re-roll statistics, never invented rates.
// ---------------------------------------------------------------------------

// The tiers noise can move between. `na` is deliberately absent — applicability is pinned (see
// module doc): cached na cells never resample, and measured re-rolls INTO na are folded back
// into the row's remaining tiers by renormalization.
export const NOISE_TIERS = ['full', 'partial', 'disputed', 'none'] as const
export type NoiseTier = (typeof NOISE_TIERS)[number]

export interface VerdictNoiseModel {
  // transitions[cached][sampled]: probability a re-roll of a cell cached at `cached` lands on
  // `sampled`. Each row sums to 1 over NOISE_TIERS. Rows with no measured observations are
  // identity (no evidence of noise ⇒ no modeled noise — conservative, not wide).
  transitions: Record<NoiseTier, Record<NoiseTier, number>>
  // P(an untested cell would move to `partial` under new evidence) — measured share of re-rolled
  // cells showing ANY disagreement, used as the epistemic prior for cells we know nothing about.
  untestedFlipRate: number
  // Inclusive integer bounds on the plausible quality of that hypothetical partial.
  untestedQualityRange: [number, number]
  // Quality assigned when a cached quality-0 cell (`none`) resamples into a scoring tier.
  reviveQuality: number
}

const identityRow = (tier: NoiseTier): Record<NoiseTier, number> =>
  Object.fromEntries(NOISE_TIERS.map((t) => [t, t === tier ? 1 : 0])) as Record<NoiseTier, number>

// Aggregates raw uncertainty-pass entries (fleet-wide) into the noise model. judgments[0] is the
// tier cached in verdicts.json, judgments[1..2] are the fresh re-roll samples (see
// uncertainty-pass.ts). `partialQualities` is the fleet's published qualities on `partial`
// verdicts, used for the median reviveQuality (falls back to 5 when empty).
export function buildMeasuredNoiseModel(
  entries: UncertaintyEntry[],
  partialQualities: number[],
): VerdictNoiseModel {
  const counts = new Map<NoiseTier, Record<NoiseTier, number>>()
  let cells = 0
  let splitCells = 0
  for (const e of entries) {
    cells++
    if (e.agreement !== '3/3') splitCells++
    const cached = e.judgments[0]
    if (cached === 'na') continue // pinned — see module doc
    const row = counts.get(cached) ?? (Object.fromEntries(NOISE_TIERS.map((t) => [t, 0])) as Record<NoiseTier, number>)
    for (const sampled of e.judgments.slice(1)) {
      if (sampled === 'na') continue // fold na re-rolls back via renormalization
      row[sampled]++
    }
    counts.set(cached, row)
  }

  const transitions = Object.fromEntries(
    NOISE_TIERS.map((tier) => {
      const row = counts.get(tier)
      const total = row ? NOISE_TIERS.reduce((s, t) => s + row[t], 0) : 0
      if (!row || total === 0) return [tier, identityRow(tier)]
      return [tier, Object.fromEntries(NOISE_TIERS.map((t) => [t, row[t] / total])) as Record<NoiseTier, number>]
    }),
  ) as Record<NoiseTier, Record<NoiseTier, number>>

  const sortedQ = [...partialQualities].sort((a, b) => a - b)
  const reviveQuality = sortedQ.length > 0 ? sortedQ[Math.floor(sortedQ.length / 2)] : 5

  return {
    transitions,
    untestedFlipRate: cells > 0 ? splitCells / cells : 0,
    untestedQualityRange: [3, 7],
    reviveQuality,
  }
}

// ---------------------------------------------------------------------------
// Monte Carlo propagation through the exact published formula.
// ---------------------------------------------------------------------------

export interface SimCell {
  verdict: Verdict
  story: Story
}

export interface ScoreInterval {
  aiEraLow: number | null
  aiEraHigh: number | null
  agentReadyLow: number | null
  agentReadyHigh: number | null
}

// An untested cell: scored 0 today, but its real status is unknown, not failed — the wider
// epistemic branch of the noise model. Mirrors lib/data-helpers.ts's isGroupUntested framing.
const isUntested = (v: Verdict): boolean => v.verdict === 'none' && v.evidenceIds.length === 0

function sampleTier(row: Record<NoiseTier, number>, r: number): NoiseTier {
  let acc = 0
  for (const t of NOISE_TIERS) {
    acc += row[t]
    if (r < acc) return t
  }
  return NOISE_TIERS[NOISE_TIERS.length - 1] // float-sum slack lands on the last tier
}

const percentile = (sorted: number[], q: number): number => sorted[Math.round((sorted.length - 1) * q)]

// Simulates `draws` re-rolls of one product's verdict matrix under `model` and returns the 68%
// (16th–84th percentile) band on the Overall score and agent-readiness, each recomputed per draw
// through lib/scoring.ts's exact weightedPercent + computeAiEra. Deterministic for a given
// (cells, model, seedKey, draws) — see the seeded-PRNG section above. Null bounds exactly when
// the corresponding published score is null (nullness only depends on the na-pattern, which is
// pinned, so it never varies across draws).
export function simulateScoreInterval(
  cells: SimCell[],
  model: VerdictNoiseModel,
  seedKey: string,
  draws = 500,
): ScoreInterval {
  const rand = mulberry32(hashSeed(seedKey))

  // Only cells feeding the Overall score components matter; everything else can't move the band.
  const agentAccess = cells.filter((c) => c.story.theme === 'agenticness' && c.story.group === 'agent-access')
  const agenticFeatures = cells.filter((c) => c.story.theme === 'agenticness' && c.story.group === 'agentic-features')
  const apiQuality = cells.filter((c) => c.story.theme === 'agenticness' && c.story.group === 'api-quality')
  const openness = cells.filter((c) => c.story.theme === 'openness')
  const automation = cells.filter((c) => c.story.theme === 'automation-depth')
  const relevant = [...agentAccess, ...agenticFeatures, ...apiQuality, ...openness, ...automation]

  // One draw = resample every relevant cell in place (na pinned), recompute both scores exactly.
  const sampled = new Map(relevant.map((c) => [c, { verdict: c.verdict, story: c.story }]))
  const view = (subset: SimCell[]) => subset.map((c) => sampled.get(c)!)
  const aiEraDraws: number[] = []
  const agentReadyDraws: number[] = []

  for (let d = 0; d < draws; d++) {
    for (const cell of relevant) {
      const cached = cell.verdict
      const slot = sampled.get(cell)!
      if (cached.verdict === 'na') {
        slot.verdict = cached
        continue
      }
      const r = rand()
      if (isUntested(cached)) {
        if (r < model.untestedFlipRate) {
          const [qLow, qHigh] = model.untestedQualityRange
          const quality = qLow + Math.floor(rand() * (qHigh - qLow + 1))
          slot.verdict = { ...cached, verdict: 'partial', quality }
        } else {
          slot.verdict = cached
        }
        continue
      }
      const tier = sampleTier(model.transitions[cached.verdict as NoiseTier], r)
      if (tier === cached.verdict) {
        slot.verdict = cached
      } else if (tier === 'none') {
        slot.verdict = { ...cached, verdict: tier, quality: 0 }
      } else {
        slot.verdict = { ...cached, verdict: tier, quality: cached.quality > 0 ? cached.quality : model.reviveQuality }
      }
    }

    const agentReady = weightedPercent(view(agentAccess))
    const aiEra = computeAiEra({
      agentReady,
      apiQuality: weightedPercent(view(apiQuality)),
      openness: weightedPercent(view(openness)),
      agenticApp: weightedPercent(view(agenticFeatures)),
      automation: weightedPercent(view(automation)),
    })
    if (aiEra !== null) aiEraDraws.push(aiEra)
    if (agentReady !== null) agentReadyDraws.push(agentReady)
  }

  const band = (xs: number[]): [number | null, number | null] => {
    if (xs.length === 0) return [null, null]
    const sorted = [...xs].sort((a, b) => a - b)
    return [percentile(sorted, 0.16), percentile(sorted, 0.84)]
  }
  const [aiEraLow, aiEraHigh] = band(aiEraDraws)
  const [agentReadyLow, agentReadyHigh] = band(agentReadyDraws)
  return { aiEraLow, aiEraHigh, agentReadyLow, agentReadyHigh }
}

// ---------------------------------------------------------------------------
// Tolerant-optional loader for rankings/{cat}/score-intervals.json (server-only).
// ---------------------------------------------------------------------------

export const SCORE_INTERVALS_FILE = 'score-intervals.json'

const DEFAULT_DIR = () => path.join(process.cwd(), 'rankings')

const intervalsCache = new Map<string, Map<string, ScoreIntervalEntry>>()

// Per-product intervals for one category. Same tolerant-optional contract as popularity /
// uncertainty in lib/data.ts: a category that hasn't been through the intervals pass resolves to
// an empty map, and a product with no entry to undefined — display code renders NO band (never a
// fabricated or zero one) on a miss.
export function loadScoreIntervals(categoryId: string, dir: string = DEFAULT_DIR()): Map<string, ScoreIntervalEntry> {
  const cacheKey = `${dir}::${categoryId}`
  const hit = intervalsCache.get(cacheKey)
  if (hit) return hit

  const byProduct = new Map<string, ScoreIntervalEntry>()
  const file = path.join(dir, categoryId, SCORE_INTERVALS_FILE)
  if (fs.existsSync(file)) {
    for (const entry of ScoreIntervalsArraySchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')))) {
      byProduct.set(entry.productId, entry)
    }
  }
  intervalsCache.set(cacheKey, byProduct)
  return byProduct
}

// Convenience for callers wiring AiEraBadge: the aiEra band as {low, high}, or undefined when
// the file, entry, or either bound is absent — the "never render a band without data" contract
// collapses to a single optional prop.
export function aiEraBandFor(
  intervals: Map<string, ScoreIntervalEntry>,
  productId: string,
): { low: number; high: number } | undefined {
  const entry = intervals.get(productId)
  if (!entry || entry.aiEraLow === null || entry.aiEraHigh === null) return undefined
  return { low: entry.aiEraLow, high: entry.aiEraHigh }
}
