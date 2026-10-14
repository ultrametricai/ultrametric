// Diffs a scratch re-judge (produced by pipeline/scripts/rejudge-pilot.ts) against the
// committed baseline verdicts for one category. Read-only on the repo: everything it writes
// goes into the pilot's scratch dir. Reports:
//   - per-cell verdict agreement (exact, and credit-direction: both credit-bearing vs both zero)
//   - quality deltas on cells where the verdict matched
//   - every flipped cell with both rationales (for manual evidence spot-reads)
//   - the leaderboard (aiEra + rank) that WOULD result if the pilot verdicts were adopted,
//     next to the committed baseline leaderboard
//
// Usage:
//   pnpm tsx pipeline/scripts/rejudge-pilot-diff.ts --category ai-coding --pilot /tmp/opus55-pilot
import fs from 'node:fs'
import path from 'node:path'
import { ProductSchema, StorySchema, VerdictSchema, type Verdict } from '../../lib/schemas'
import { VERDICT_FACTORS, buildRankings, cellScore } from '../../lib/scoring'
import { categoryDir, readJson } from '../paths'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const category = arg('category')
const pilot = arg('pilot')
if (!category || !pilot) {
  console.error('usage: pnpm tsx pipeline/scripts/rejudge-pilot-diff.ts --category <id> --pilot <scratch-dir>')
  process.exit(1)
}

const dataDir = categoryDir(category)
const products = readJson(ProductSchema.array(), path.join(dataDir, 'products.json'))
const stories = readJson(StorySchema.array(), path.join(dataDir, 'stories.json'))
const baseline = readJson(VerdictSchema.array(), path.join(dataDir, 'verdicts.json'))
const pilotVerdicts = readJson(VerdictSchema.array(), path.join(path.resolve(pilot), category, 'verdicts.json'))

const key = (v: Verdict) => `${v.productId}:${v.storyId}`
const baseByCell = new Map(baseline.map((v) => [key(v), v]))
const storyById = new Map(stories.map((s) => [s.id, s]))

let exact = 0
let direction = 0
let qualityDeltaSum = 0
let qualityDeltaAbsSum = 0
let matchedWithQuality = 0
const flips: Array<{
  cell: string
  base: string
  pilot: string
  baseQuality: number
  pilotQuality: number
  scoreDelta: number
  baseRationale: string
  pilotRationale: string
  baseEvidence: string[]
  pilotEvidence: string[]
}> = []

for (const pv of pilotVerdicts) {
  const bv = baseByCell.get(key(pv))
  if (!bv) throw new Error(`pilot cell ${key(pv)} missing from baseline`)
  const story = storyById.get(pv.storyId)!
  if (bv.verdict === pv.verdict) {
    exact += 1
    direction += 1
    if (bv.verdict !== 'none' && bv.verdict !== 'na') {
      qualityDeltaSum += pv.quality - bv.quality
      qualityDeltaAbsSum += Math.abs(pv.quality - bv.quality)
      matchedWithQuality += 1
    }
  } else {
    const baseCredit = VERDICT_FACTORS[bv.verdict] > 0
    const pilotCredit = VERDICT_FACTORS[pv.verdict] > 0
    if (baseCredit === pilotCredit) direction += 1
    flips.push({
      cell: key(pv),
      base: `${bv.verdict} q${bv.quality}`,
      pilot: `${pv.verdict} q${pv.quality}`,
      baseQuality: bv.quality,
      pilotQuality: pv.quality,
      scoreDelta: Math.round((cellScore(pv, story) - cellScore(bv, story)) * 10) / 10,
      baseRationale: bv.rationale,
      pilotRationale: pv.rationale,
      baseEvidence: bv.evidenceIds,
      pilotEvidence: pv.evidenceIds,
    })
  }
}

const n = pilotVerdicts.length
const pct = (x: number) => `${((x / n) * 100).toFixed(1)}%`

// Rank preview: what the leaderboard would look like if the pilot verdicts were adopted.
const ts = '2026-01-01T00:00:00.000Z' // fixed timestamp; only leaderboard order/scores matter here
const baseRankings = buildRankings(products, stories, baseline, ts)
const pilotRankings = buildRankings(products, stories, pilotVerdicts, ts)
const baseRank = new Map(baseRankings.leaderboard.map((e, i) => [e.productId, { rank: i + 1, aiEra: e.aiEra, score: e.score }]))
const rankMoves = pilotRankings.leaderboard.map((e, i) => {
  const b = baseRank.get(e.productId)!
  return {
    productId: e.productId,
    baseRank: b.rank,
    pilotRank: i + 1,
    rankMove: b.rank - (i + 1),
    baseAiEra: b.aiEra,
    pilotAiEra: e.aiEra,
    baseScore: b.score,
    pilotScore: e.score,
  }
})

const report = {
  category,
  cells: n,
  exactAgreement: exact,
  exactAgreementPct: pct(exact),
  directionAgreement: direction,
  directionAgreementPct: pct(direction),
  flips: flips.length,
  meanQualityDeltaOnMatchedCells: matchedWithQuality ? +(qualityDeltaSum / matchedWithQuality).toFixed(2) : null,
  meanAbsQualityDeltaOnMatchedCells: matchedWithQuality ? +(qualityDeltaAbsSum / matchedWithQuality).toFixed(2) : null,
  rankMoves,
  flippedCells: flips.sort((a, b) => Math.abs(b.scoreDelta) - Math.abs(a.scoreDelta)),
}

const outFile = path.join(path.resolve(pilot), category, 'diff-report.json')
fs.writeFileSync(outFile, JSON.stringify(report, null, 2) + '\n')

console.log(`cells: ${n}`)
console.log(`exact verdict agreement: ${exact} (${pct(exact)})`)
console.log(`credit-direction agreement: ${direction} (${pct(direction)})`)
console.log(`flips: ${flips.length}`)
console.log(`mean quality delta on verdict-matched credit cells: ${report.meanQualityDeltaOnMatchedCells} (mean abs ${report.meanAbsQualityDeltaOnMatchedCells})`)
console.log('\nrank preview (pilot adopted):')
for (const m of rankMoves) {
  const move = m.rankMove === 0 ? '  =' : m.rankMove > 0 ? ` +${m.rankMove}` : ` ${m.rankMove}`
  console.log(`  #${String(m.pilotRank).padStart(2)} (${move}) ${m.productId}  aiEra ${m.baseAiEra} → ${m.pilotAiEra}  score ${m.baseScore} → ${m.pilotScore}`)
}
console.log(`\nfull report (incl. every flip with both rationales): ${outFile}`)
