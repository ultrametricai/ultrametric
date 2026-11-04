import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  aiEraBandFor, buildMeasuredNoiseModel, hashSeed, loadScoreIntervals, mulberry32,
  NOISE_TIERS, simulateScoreInterval, type ScoreIntervalEntry, type VerdictNoiseModel,
} from '@/lib/scoreIntervals'
import { computeAiEra, weightedPercent } from '@/lib/scoring'
import type { Story, UncertaintyEntry, Verdict } from '@/lib/schemas'

const story = (id: string, theme: string, group: string, weight = 1): Story => ({
  id, persona: 'dev', title: id, theme, group, weight,
})
const v = (storyId: string, verdict: Verdict['verdict'], quality: number, evidenced = true): Verdict => ({
  productId: 'p', storyId, verdict, quality, confidence: 'high', rationale: 'r',
  evidenceIds: evidenced && verdict !== 'na' ? ['e1'] : [],
})

// A small but fully-populated Overall score surface: one story per component group/theme.
const stories = [
  story('aa', 'agenticness', 'agent-access', 2),
  story('af', 'agenticness', 'agentic-features'),
  story('aq', 'agenticness', 'api-quality'),
  story('op', 'openness', 'openness-basics'),
  story('au', 'automation-depth', 'automation-basics'),
]
const cellsFor = (verdicts: Verdict[]) =>
  stories.map((s) => ({ story: s, verdict: verdicts.find((x) => x.storyId === s.id)! }))

// Identity transitions ⇒ the only possible noise is the untested branch.
const zeroNoise: VerdictNoiseModel = {
  transitions: Object.fromEntries(
    NOISE_TIERS.map((t) => [t, Object.fromEntries(NOISE_TIERS.map((u) => [u, u === t ? 1 : 0]))]),
  ) as VerdictNoiseModel['transitions'],
  untestedFlipRate: 0,
  untestedQualityRange: [3, 7],
  reviveQuality: 5,
}

describe('mulberry32 / hashSeed', () => {
  it('is deterministic per seed and in [0, 1)', () => {
    const a = mulberry32(hashSeed('k'))
    const b = mulberry32(hashSeed('k'))
    const xs = Array.from({ length: 100 }, () => a())
    expect(Array.from({ length: 100 }, () => b())).toEqual(xs)
    for (const x of xs) expect(x).toBeGreaterThanOrEqual(0)
    for (const x of xs) expect(x).toBeLessThan(1)
    expect(mulberry32(hashSeed('other'))()).not.toBe(xs[0])
  })
})

describe('simulateScoreInterval', () => {
  const evidencedVerdicts = [
    v('aa', 'full', 8), v('af', 'partial', 5), v('aq', 'full', 7), v('op', 'partial', 6), v('au', 'full', 9),
  ]

  it('zero variance collapses to a zero-width band equal to the published score', () => {
    const cells = cellsFor(evidencedVerdicts)
    const interval = simulateScoreInterval(cells, zeroNoise, 'seed', 100)
    const published = computeAiEra({
      agentReady: weightedPercent(cells.filter((c) => c.story.group === 'agent-access')),
      apiQuality: weightedPercent(cells.filter((c) => c.story.group === 'api-quality')),
      openness: weightedPercent(cells.filter((c) => c.story.theme === 'openness')),
      agenticApp: weightedPercent(cells.filter((c) => c.story.group === 'agentic-features')),
      automation: weightedPercent(cells.filter((c) => c.story.theme === 'automation-depth')),
    })
    expect(interval.aiEraLow).toBe(published)
    expect(interval.aiEraHigh).toBe(published)
    expect(interval.agentReadyLow).toBe(interval.agentReadyHigh)
  })

  it('an all-untested product gets a wide band anchored at 0', () => {
    const cells = cellsFor(stories.map((s) => v(s.id, 'none', 0, false)))
    const model: VerdictNoiseModel = { ...zeroNoise, untestedFlipRate: 0.2 }
    const interval = simulateScoreInterval(cells, model, 'seed', 500)
    // Published score is 0 everywhere; the epistemic branch opens real upside.
    expect(interval.aiEraLow).toBe(0)
    expect(interval.aiEraHigh! - interval.aiEraLow!).toBeGreaterThan(5)
    expect(interval.agentReadyHigh).toBeGreaterThanOrEqual(interval.agentReadyLow!)
  })

  it('is reproducible for the same seed and diverges across seeds', () => {
    const cells = cellsFor(evidencedVerdicts)
    const noisy: VerdictNoiseModel = {
      ...zeroNoise,
      transitions: {
        ...zeroNoise.transitions,
        full: { full: 0.8, partial: 0.15, disputed: 0, none: 0.05 },
        partial: { full: 0.2, partial: 0.7, disputed: 0, none: 0.1 },
      },
    }
    const a = simulateScoreInterval(cells, noisy, 'seed-1', 300)
    const b = simulateScoreInterval(cells, noisy, 'seed-1', 300)
    expect(b).toEqual(a)
    expect(a.aiEraHigh! - a.aiEraLow!).toBeGreaterThan(0)
    // A different seed re-draws the whole stream — bounds may coincide, but not the full tuple
    // AND the underlying draws for this much noise; assert at least the interval object differs.
    const c = simulateScoreInterval(cells, noisy, 'seed-2', 300)
    expect([c.aiEraLow, c.aiEraHigh, c.agentReadyLow, c.agentReadyHigh]).not.toEqual([
      a.aiEraLow, a.aiEraHigh, a.agentReadyLow, a.agentReadyHigh,
    ])
  })

  it('pins na cells: an all-na product keeps null bounds in every draw', () => {
    const cells = cellsFor(stories.map((s) => ({ ...v(s.id, 'na', 0), evidenceIds: [] })))
    const model: VerdictNoiseModel = { ...zeroNoise, untestedFlipRate: 1 }
    expect(simulateScoreInterval(cells, model, 'seed', 50)).toEqual({
      aiEraLow: null, aiEraHigh: null, agentReadyLow: null, agentReadyHigh: null,
    })
  })

  it('expands asymmetric percentile bands to contain the published point scores', () => {
    const upwardCells = cellsFor(stories.map((s) => v(s.id, 'partial', 5)))
    const upwardOnly: VerdictNoiseModel = {
      ...zeroNoise,
      transitions: {
        ...zeroNoise.transitions,
        partial: { full: 1, partial: 0, disputed: 0, none: 0 },
      },
    }
    const upwardInterval = simulateScoreInterval(upwardCells, upwardOnly, 'seed', 100)
    const upwardAgentReady = weightedPercent(upwardCells.filter((c) => c.story.group === 'agent-access'))
    const upwardAiEra = computeAiEra({
      agentReady: upwardAgentReady,
      apiQuality: weightedPercent(upwardCells.filter((c) => c.story.group === 'api-quality')),
      openness: weightedPercent(upwardCells.filter((c) => c.story.theme === 'openness')),
      agenticApp: weightedPercent(upwardCells.filter((c) => c.story.group === 'agentic-features')),
      automation: weightedPercent(upwardCells.filter((c) => c.story.theme === 'automation-depth')),
    })
    expect(upwardInterval.aiEraLow).toBe(upwardAiEra)
    expect(upwardInterval.agentReadyLow).toBe(upwardAgentReady)
    expect(upwardInterval.aiEraHigh!).toBeGreaterThan(upwardAiEra!)
    expect(upwardInterval.agentReadyHigh!).toBeGreaterThan(upwardAgentReady!)

    const downwardCells = cellsFor(stories.map((s) => v(s.id, 'full', 8)))
    const downwardOnly: VerdictNoiseModel = {
      ...zeroNoise,
      transitions: {
        ...zeroNoise.transitions,
        full: { full: 0, partial: 0, disputed: 0, none: 1 },
      },
    }
    const downwardInterval = simulateScoreInterval(downwardCells, downwardOnly, 'seed', 100)
    const downwardAgentReady = weightedPercent(downwardCells.filter((c) => c.story.group === 'agent-access'))
    const downwardAiEra = computeAiEra({
      agentReady: downwardAgentReady,
      apiQuality: weightedPercent(downwardCells.filter((c) => c.story.group === 'api-quality')),
      openness: weightedPercent(downwardCells.filter((c) => c.story.theme === 'openness')),
      agenticApp: weightedPercent(downwardCells.filter((c) => c.story.group === 'agentic-features')),
      automation: weightedPercent(downwardCells.filter((c) => c.story.theme === 'automation-depth')),
    })
    expect(downwardInterval.aiEraHigh).toBe(downwardAiEra)
    expect(downwardInterval.agentReadyHigh).toBe(downwardAgentReady)
    expect(downwardInterval.aiEraLow!).toBeLessThan(downwardAiEra!)
    expect(downwardInterval.agentReadyLow!).toBeLessThan(downwardAgentReady!)
  })
})

describe('buildMeasuredNoiseModel', () => {
  const entry = (
    cached: Verdict['verdict'], s1: Verdict['verdict'], s2: Verdict['verdict'],
  ): UncertaintyEntry => ({
    productId: 'p', storyId: 's',
    judgments: [cached, s1, s2],
    agreement: cached === s1 && s1 === s2 ? '3/3' : s1 === s2 || cached === s1 || cached === s2 ? '2/3' : '1/3',
  })

  it('derives transition rows, split rate, and median revive quality from measurements', () => {
    const model = buildMeasuredNoiseModel(
      [entry('full', 'full', 'partial'), entry('full', 'full', 'full'), entry('none', 'none', 'none')],
      [4, 5, 7],
    )
    expect(model.transitions.full).toEqual({ full: 0.75, partial: 0.25, disputed: 0, none: 0 })
    expect(model.transitions.none).toEqual({ full: 0, partial: 0, disputed: 0, none: 1 })
    // No measurements for partial/disputed ⇒ identity rows, not invented noise.
    expect(model.transitions.partial.partial).toBe(1)
    expect(model.untestedFlipRate).toBeCloseTo(1 / 3)
    expect(model.reviveQuality).toBe(5)
  })

  it('pins na: cached-na entries are skipped and na re-rolls are renormalized away', () => {
    const model = buildMeasuredNoiseModel(
      [entry('na', 'none', 'none'), entry('partial', 'na', 'partial')],
      [],
    )
    expect(model.transitions.partial).toEqual({ full: 0, partial: 1, disputed: 0, none: 0 })
    expect(model.reviveQuality).toBe(5) // fallback when no partial qualities exist
  })

  it('handles zero measurements without dividing by zero', () => {
    const model = buildMeasuredNoiseModel([], [])
    expect(model.untestedFlipRate).toBe(0)
    for (const t of NOISE_TIERS) expect(model.transitions[t][t]).toBe(1)
  })
})

describe('loadScoreIntervals / aiEraBandFor', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-intervals-'))
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }))

  it('reads score-intervals.json and misses tolerantly', () => {
    fs.mkdirSync(path.join(tmp, 'arena-x'), { recursive: true })
    fs.writeFileSync(
      path.join(tmp, 'arena-x', 'score-intervals.json'),
      JSON.stringify([
        { productId: 'p1', aiEraLow: 40.1, aiEraHigh: 45.3, agentReadyLow: 30, agentReadyHigh: 36 },
        { productId: 'p2', aiEraLow: null, aiEraHigh: null, agentReadyLow: null, agentReadyHigh: null },
      ]),
    )
    const intervals = loadScoreIntervals('arena-x', tmp)
    expect(intervals.get('p1')?.aiEraHigh).toBe(45.3)
    expect(aiEraBandFor(intervals, 'p1')).toEqual({ low: 40.1, high: 45.3 })
    // Null bounds and missing products both mean "no band", never a fabricated one.
    expect(aiEraBandFor(intervals, 'p2')).toBeUndefined()
    expect(aiEraBandFor(intervals, 'ghost')).toBeUndefined()
    // A category without the file at all resolves to an empty map, not an error.
    expect(loadScoreIntervals('arena-missing', tmp).size).toBe(0)
  })
})

describe('committed score intervals', () => {
  it('covers every published product and contains each point score with matching nullability', () => {
    const root = path.join(process.cwd(), 'open-rankings')
    const violations: string[] = []
    for (const category of fs.readdirSync(root)) {
      const dataDir = path.join(root, category)
      const intervalsPath = path.join(dataDir, 'score-intervals.json')
      const rankingsPath = path.join(dataDir, 'rankings.json')
      if (!fs.existsSync(intervalsPath) || !fs.existsSync(rankingsPath)) continue

      const intervals = JSON.parse(fs.readFileSync(intervalsPath, 'utf8')) as ScoreIntervalEntry[]
      const rankings = JSON.parse(fs.readFileSync(rankingsPath, 'utf8')) as {
        leaderboard: Array<{ productId: string; aiEra: number | null; agentReady: number | null }>
      }
      const intervalIds = intervals.map((entry) => entry.productId).sort()
      const publishedIds = rankings.leaderboard.map((entry) => entry.productId).sort()
      if (JSON.stringify(intervalIds) !== JSON.stringify(publishedIds)) {
        violations.push(
          `${category}: interval products ${JSON.stringify(intervalIds)} do not match ` +
            `published products ${JSON.stringify(publishedIds)}`,
        )
      }

      const byProduct = new Map(intervals.map((entry) => [entry.productId, entry]))
      for (const published of rankings.leaderboard) {
        const interval = byProduct.get(published.productId)
        if (!interval) continue
        for (const [scoreKey, lowKey, highKey] of [
          ['aiEra', 'aiEraLow', 'aiEraHigh'],
          ['agentReady', 'agentReadyLow', 'agentReadyHigh'],
        ] as const) {
          const point = published[scoreKey]
          const low = interval[lowKey]
          const high = interval[highKey]
          if (point === null) {
            if (low !== null || high !== null) {
              violations.push(
                `${category}/${published.productId}:${scoreKey} null point has non-null bounds [${low}, ${high}]`,
              )
            }
          } else if (low === null || high === null) {
            violations.push(
              `${category}/${published.productId}:${scoreKey} ${point} has null bounds [${low}, ${high}]`,
            )
          } else if (point < low || point > high) {
            violations.push(`${category}/${published.productId}:${scoreKey} ${point} outside [${low}, ${high}]`)
          }
        }
      }
    }
    expect(violations).toEqual([])
  })
})
