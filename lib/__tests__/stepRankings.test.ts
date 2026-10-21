import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCategory } from '@/lib/data'
import {
  GOVERNMENT_ARENA_ID, governmentStepEligibility, loadProcesses, STEP_OPTIONS_CAP, vendorProductId,
} from '@/lib/processes'
import { crossArenaStepRankings, stepRanking } from '@/lib/processRankings'
import { StepRankingsFileSchema, type StepRankingMarket } from '@/lib/schemas'
import { VERDICT_FACTORS } from '@/lib/scoring'
import { isShutdown } from '@/lib/shutdown'
import { buildStepRankings, serializeStepRankings } from '@/lib/stepRankings'

const DATA_DIR = path.resolve(__dirname, '../../open-rankings')
const FILE = path.join(DATA_DIR, 'step-rankings.json')

const committed = StepRankingsFileSchema.parse(JSON.parse(fs.readFileSync(FILE, 'utf8')))
const tasks = loadProcesses(DATA_DIR)
const nodeByKey = new Map(tasks.flatMap((t) => t.dag.nodes.map((n) => [`${t.id}:${n.id}`, n] as const)))

// Raw arena files, read straight from disk so the recompute is independent of lib/data.ts.
interface RawProduct { id: string; name: string; shutdown?: string; country?: string; area?: string }
interface RawArena {
  name: string
  products: Map<string, RawProduct>
  storyWeight: Map<string, number>
  storyTitle: Map<string, string>
  verdict: Map<string, { verdict: keyof typeof VERDICT_FACTORS; quality: number }>
}
const rawCache = new Map<string, RawArena>()
function raw(arenaId: string): RawArena {
  const hit = rawCache.get(arenaId)
  if (hit) return hit
  const read = (f: string) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, arenaId, f), 'utf8'))
  const categories = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'categories.json'), 'utf8')) as
    Array<{ id: string; name: string }>
  const stories = read('stories.json') as Array<{ id: string; title: string; weight: number }>
  const verdicts = read('verdicts.json') as
    Array<{ productId: string; storyId: string; verdict: keyof typeof VERDICT_FACTORS; quality: number }>
  const arena: RawArena = {
    name: categories.find((c) => c.id === arenaId)!.name,
    products: new Map((read('products.json') as RawProduct[]).map((p) => [p.id, p])),
    storyWeight: new Map(stories.map((s) => [s.id, s.weight])),
    storyTitle: new Map(stories.map((s) => [s.id, s.title])),
    verdict: new Map(verdicts.map((v) => [`${v.productId}:${v.storyId}`, v])),
  }
  rawCache.set(arenaId, arena)
  return arena
}

// The documented formula, from scratch: weight × quality × verdict factor over the mapped
// stories, na excluded, normalized to 0–100 and rounded to one decimal.
function recompute(arenaId: string, storyIds: string[], productId: string): number | null {
  const a = raw(arenaId)
  let num = 0
  let den = 0
  for (const sid of storyIds) {
    const v = a.verdict.get(`${productId}:${sid}`)
    if (!v || v.verdict === 'na') continue
    const w = a.storyWeight.get(sid)!
    num += w * v.quality * VERDICT_FACTORS[v.verdict]
    den += w * 10
  }
  return den === 0 ? null : Math.round((num / den) * 100 * 10) / 10
}

const markets = (): Array<{ key: string; market: StepRankingMarket; primary: boolean }> =>
  committed.steps.flatMap((s) => [
    ...(s.primary ? [{ key: `${s.taskId}:${s.nodeId}`, market: s.primary, primary: true }] : []),
    ...s.crossArena.map((m) => ({ key: `${s.taskId}:${s.nodeId}`, market: m, primary: false })),
  ])

describe('open-rankings/step-rankings.json', () => {
  it('matches a fresh derivation byte-for-byte (run: tsx rankings-engine/scripts/generate-step-rankings.ts)', () => {
    expect(fs.readFileSync(FILE, 'utf8')).toBe(serializeStepRankings(buildStepRankings(DATA_DIR)))
    expect(committed.optionsCap).toBe(STEP_OPTIONS_CAP)
  })

  it('lists exactly the steps that have a ranking, in task-id then DAG order, each once', () => {
    const expected: string[] = []
    for (const task of [...tasks].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
      for (const node of task.dag.nodes) {
        if (stepRanking(task.id, node, DATA_DIR) || crossArenaStepRankings(task.id, node, DATA_DIR).length > 0) {
          expected.push(`${task.id}:${node.id}`)
        }
      }
    }
    expect(committed.steps.map((s) => `${s.taskId}:${s.nodeId}`)).toEqual(expected)
  })

  it('every market\'s first optionsCap vendors equal the site\'s capped step chips, order included', () => {
    for (const step of committed.steps) {
      const node = nodeByKey.get(`${step.taskId}:${step.nodeId}`)!
      const capped = stepRanking(step.taskId, node, DATA_DIR)
      expect(step.primary?.arenaId ?? null).toBe(capped?.arenaId ?? null)
      if (capped && step.primary) {
        expect(step.primary.vendors.slice(0, STEP_OPTIONS_CAP).map((v) => [v.productId, v.score]))
          .toEqual(capped.vendors.map((v) => [v.productId, v.score]))
        expect(step.primary.stories.map((s) => s.id)).toEqual(capped.stories.map((s) => s.id))
      }
      const cross = crossArenaStepRankings(step.taskId, node, DATA_DIR)
      expect(step.crossArena.map((m) => m.arenaId)).toEqual(cross.map((r) => r.arenaId))
      step.crossArena.forEach((m, i) => {
        expect(m.vendors.slice(0, STEP_OPTIONS_CAP).map((v) => [v.productId, v.score]))
          .toEqual(cross[i].vendors.map((v) => [v.productId, v.score]))
      })
    }
  })

  it('ids resolve: steps, labels, arenas, stories, and products all exist', () => {
    for (const step of committed.steps) {
      const node = nodeByKey.get(`${step.taskId}:${step.nodeId}`)
      expect(node, `unknown step ${step.taskId}:${step.nodeId}`).toBeDefined()
      expect(step.label).toBe(node!.label)
    }
    for (const { key, market } of markets()) {
      const a = raw(market.arenaId)
      expect(market.arenaName).toBe(a.name)
      for (const s of market.stories) {
        expect(a.storyTitle.get(s.id), `${key} cites unknown story ${market.arenaId}/${s.id}`).toBe(s.title)
        expect(s.weight).toBe(a.storyWeight.get(s.id))
      }
      const storyIds = new Set(market.stories.map((s) => s.id))
      for (const v of market.vendors) {
        expect(a.products.get(v.productId)?.name, `${key} lists unknown product ${v.productId}`).toBe(v.name)
        for (const c of v.cites) expect(storyIds.has(c.storyId)).toBe(true)
      }
    }
  })

  it('every score and cite recomputes from verdicts.json; ranks run 1..n best-first', () => {
    for (const { key, market } of markets()) {
      const a = raw(market.arenaId)
      const storyIds = market.stories.map((s) => s.id)
      market.vendors.forEach((v, i) => {
        expect(v.rank).toBe(i + 1)
        if (i > 0) expect(market.vendors[i - 1].score).toBeGreaterThanOrEqual(v.score)
        expect(v.score, `${key} ${market.arenaId}/${v.productId}`).toBe(recompute(market.arenaId, storyIds, v.productId))
        const expectedCites = storyIds.flatMap((sid) => {
          const real = a.verdict.get(`${v.productId}:${sid}`)
          return real ? [{ storyId: sid, verdict: real.verdict, quality: real.quality, weight: a.storyWeight.get(sid)! }] : []
        })
        expect(v.cites).toEqual(expectedCites)
      })
    }
  })

  it('primary markets list every eligible, non-shutdown product with an applicable verdict', () => {
    for (const step of committed.steps) {
      if (!step.primary) continue
      const node = nodeByKey.get(`${step.taskId}:${step.nodeId}`)!
      const eligible = governmentStepEligibility(node, step.primary.arenaId, DATA_DIR)
      const storyIds = step.primary.stories.map((s) => s.id)
      const expected = [...raw(step.primary.arenaId).products.values()]
        .filter((p) => !isShutdown(p) && (!eligible || eligible.has(p.id)))
        .filter((p) => recompute(step.primary!.arenaId, storyIds, p.id) !== null)
        .map((p) => p.id)
        .sort()
      expect(step.primary.vendors.map((v) => v.productId).sort(), `${step.taskId}:${step.nodeId}`).toEqual(expected)
    }
  })

  it('cross-arena markets pass the stricter gate: positive score backed by a full or partial verdict', () => {
    for (const step of committed.steps) {
      for (const m of step.crossArena) {
        expect(m.eligibility).toBeNull()
        for (const v of m.vendors) {
          expect(v.score).toBeGreaterThan(0)
          expect(v.cites.some((c) => c.verdict === 'full' || c.verdict === 'partial')).toBe(true)
        }
      }
    }
  })

  it('government-covered steps list only agencies matching the wired agency\'s country and area', () => {
    const gov = committed.steps.filter((s) => s.primary?.arenaId === GOVERNMENT_ARENA_ID)
    expect(gov.length).toBeGreaterThan(0)
    const products = loadCategory(GOVERNMENT_ARENA_ID, DATA_DIR).products
    for (const step of gov) {
      const node = nodeByKey.get(`${step.taskId}:${step.nodeId}`)!
      const anchor = products.find((p) => p.id === vendorProductId(node.vendor ?? ''))
      if (!anchor?.country || !anchor.area) {
        expect(step.primary!.eligibility).toBeNull()
        continue
      }
      expect(step.primary!.eligibility).toEqual({ country: anchor.country, area: anchor.area })
      for (const v of step.primary!.vendors) {
        const p = raw(GOVERNMENT_ARENA_ID).products.get(v.productId)!
        expect([p.country, p.area], `${step.taskId}:${step.nodeId} lists ${v.productId}`)
          .toEqual([anchor.country, anchor.area])
      }
    }
    for (const step of committed.steps) {
      if (step.primary && step.primary.arenaId !== GOVERNMENT_ARENA_ID) expect(step.primary.eligibility).toBeNull()
    }
  })

  it('shutdown products are absent from every market', () => {
    for (const { key, market } of markets()) {
      for (const v of market.vendors) {
        expect(isShutdown(raw(market.arenaId).products.get(v.productId)!), `${key} lists shutdown ${v.productId}`)
          .toBe(false)
      }
    }
  })
})
