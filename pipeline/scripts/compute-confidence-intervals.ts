// Analytic score-intervals pass (v1, no new judging) — writes rankings/{cat}/score-intervals.json,
// the 68% confidence band on every product's Overall score and agent-readiness. All the modeling
// and math live in lib/scoreIntervals.ts (buildMeasuredNoiseModel + simulateScoreInterval — see
// that module's doc for the precise method); this script only:
//
//   1. Aggregates the MEASURED judge re-roll statistics fleet-wide from every
//      rankings/*/uncertainty.json (plus the fleet-median partial quality for reviveQuality) into
//      the noise model — measured rates, never invented ones.
//   2. Runs the seeded Monte Carlo (500 draws/product, deterministic mulberry32 stream keyed per
//      product — reproducible builds, no Math.random) for each populated arena and writes the
//      per-arena score-intervals.json.
//
// Entirely LLM-free and cheap (~seconds for the whole fleet), but deliberately a pipeline script
// rather than part of `next build`: intervals only change when verdicts or the measured re-roll
// stats do, so they're computed once, committed, and re-run after re-judges (story-runner.yml
// runs this post-derive for the refreshed arena).
//
// Usage: pnpm exec tsx pipeline/scripts/compute-confidence-intervals.ts [--category <id>]
//   --category limits which arenas get REwritten; the measured noise model is always built from
//   the whole fleet's uncertainty files regardless.
import fs from 'node:fs'
import path from 'node:path'
import {
  buildMeasuredNoiseModel, SCORE_INTERVALS_FILE, simulateScoreInterval,
} from '../../lib/scoreIntervals'
import {
  ProductSchema, type ScoreIntervalEntry, StorySchema, type UncertaintyEntry,
  UncertaintyArraySchema, VerdictSchema,
} from '../../lib/schemas'
import { categoryDir, readCategories, readJson, resolveCategories, writeJson } from '../paths'

const DRAWS = 500
// Bump on any change to the noise model or sampling order — the seed key namespaces the PRNG
// stream so "same code + same data ⇒ same bytes" stays true across re-runs.
const SEED_VERSION = 'pa-score-intervals-v1'

const isPopulated = (dataDir: string): boolean =>
  ['stories.json', 'verdicts.json', 'rankings.json'].every((f) => fs.existsSync(path.join(dataDir, f)))

function main(): void {
  const categoryArgIdx = process.argv.indexOf('--category')
  const onlyCategory = categoryArgIdx === -1 ? undefined : process.argv[categoryArgIdx + 1]
  if (categoryArgIdx !== -1 && !onlyCategory) throw new Error('--category requires an arena id')

  // 1. Measured noise model, fleet-wide (see lib/scoreIntervals.ts's buildMeasuredNoiseModel).
  const allCategories = readCategories()
  const uncertainty: UncertaintyEntry[] = []
  const partialQualities: number[] = []
  for (const cat of allCategories) {
    const dataDir = categoryDir(cat.id)
    const uPath = path.join(dataDir, 'uncertainty.json')
    if (fs.existsSync(uPath)) uncertainty.push(...readJson(UncertaintyArraySchema, uPath))
    if (!isPopulated(dataDir)) continue
    for (const v of readJson(VerdictSchema.array(), path.join(dataDir, 'verdicts.json'))) {
      if (v.verdict === 'partial') partialQualities.push(v.quality)
    }
  }
  const model = buildMeasuredNoiseModel(uncertainty, partialQualities)
  console.log(
    `noise model: ${uncertainty.length} measured re-rolled cells, ` +
      `untestedFlipRate=${model.untestedFlipRate.toFixed(3)}, reviveQuality=${model.reviveQuality}`,
  )
  for (const [tier, row] of Object.entries(model.transitions)) {
    const parts = Object.entries(row).filter(([, p]) => p > 0).map(([t, p]) => `${t}:${p.toFixed(3)}`)
    console.log(`  ${tier} → ${parts.join(' ')}`)
  }

  // 2. Simulate + write per arena.
  const fleet: Array<{ cat: string; productId: string; width: number }> = []
  for (const cat of resolveCategories(onlyCategory)) {
    const dataDir = categoryDir(cat.id)
    if (!isPopulated(dataDir)) continue
    const products = readJson(ProductSchema.array(), path.join(dataDir, 'products.json'))
    const stories = readJson(StorySchema.array(), path.join(dataDir, 'stories.json'))
    const verdicts = readJson(VerdictSchema.array(), path.join(dataDir, 'verdicts.json'))
    const byCell = new Map(verdicts.map((v) => [`${v.productId}:${v.storyId}`, v]))

    const entries: ScoreIntervalEntry[] = products.map((p) => {
      const cells = stories.map((s) => {
        const verdict = byCell.get(`${p.id}:${s.id}`)
        if (!verdict) throw new Error(`missing verdict for cell ${p.id}:${s.id}`)
        return { verdict, story: s }
      })
      const interval = simulateScoreInterval(cells, model, `${SEED_VERSION}:${cat.id}:${p.id}`, DRAWS)
      if (interval.aiEraLow !== null && interval.aiEraHigh !== null) {
        fleet.push({ cat: cat.id, productId: p.id, width: interval.aiEraHigh - interval.aiEraLow })
      }
      return { productId: p.id, ...interval }
    })

    writeJson(path.join(dataDir, SCORE_INTERVALS_FILE), entries)
    const widths = entries
      .filter((e) => e.aiEraLow !== null && e.aiEraHigh !== null)
      .map((e) => e.aiEraHigh! - e.aiEraLow!)
      .sort((a, b) => a - b)
    const median = widths.length > 0 ? widths[Math.floor(widths.length / 2)] : 0
    console.log(`${cat.id}: ${entries.length} products, median aiEra band width ${median.toFixed(1)}`)
  }

  // Fleet summary (only meaningful on a full run).
  if (fleet.length > 0) {
    const sorted = [...fleet].sort((a, b) => a.width - b.width)
    const median = sorted[Math.floor(sorted.length / 2)]
    const narrowest = sorted[0]
    const widest = sorted[sorted.length - 1]
    console.log('\n=== score intervals summary ===')
    console.log(`products banded: ${sorted.length}`)
    console.log(`median aiEra band width: ${median.width.toFixed(1)} (${median.cat}/${median.productId})`)
    console.log(`narrowest: ${narrowest.width.toFixed(1)} (${narrowest.cat}/${narrowest.productId})`)
    console.log(`widest: ${widest.width.toFixed(1)} (${widest.cat}/${widest.productId})`)
  }
}

main()
