import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCategory } from '@/lib/data'
import { GOVERNMENT_ARENA_ID, loadProcesses } from '@/lib/processes'
import { crossArenaStepRankings, processLeaderboard, stepRanking, stepRankingFull } from '@/lib/processRankings'
import { loadStepVendorCalls } from '@/lib/stepVendorCalls'
import { processesForVendor, VENDOR_PROCESS_KINDS } from '@/lib/vendorProcesses'

const DATA_DIR = path.resolve(__dirname, '../../open-rankings')

describe('processesForVendor — the reverse index over the process pages\' own rankings', () => {
  it('mercury (startup-banking) serves the finance processes it comes up in, with leaderboard ranks — track runway and open bank account included', () => {
    const rows = processesForVendor('startup-banking', 'mercury', DATA_DIR)
    expect(rows.length).toBeGreaterThan(0)
    for (const taskId of ['qs_050', 'qs_023']) {
      const row = rows.find((a) => a.taskId === taskId)
      expect(row, `mercury must appear in ${taskId}`).toBeDefined()
      expect(row!.kinds).toContain('step-ranked')
      expect(row!.leaderboardRank).not.toBeNull()
      expect(row!.processScore).not.toBeNull()
      expect(row!.stepsServed).toBeGreaterThan(0)
      expect(row!.bestStepScore).not.toBeNull()
      expect(row!.slug.length).toBeGreaterThan(0)
      expect(row!.title.length).toBeGreaterThan(0)
    }
    // The bank the DAG names: mercury is a canonical vendor somewhere in the corpus.
    expect(rows.some((a) => a.kinds.includes('canonical'))).toBe(true)
    // Grounded API-call cells (open-rankings/step-vendor-calls.json) surface as the api-calls kind.
    const callTaskIds = new Set(
      loadStepVendorCalls(DATA_DIR)
        .filter((e) => e.arenaId === 'startup-banking' && e.productId === 'mercury')
        .map((e) => e.taskId),
    )
    expect(callTaskIds.size).toBeGreaterThan(0)
    for (const taskId of callTaskIds) {
      const row = rows.find((a) => a.taskId === taskId)
      expect(row, `mercury api-calls cell for ${taskId} must be an appearance`).toBeDefined()
      expect(row!.kinds).toContain('api-calls')
    }
  })

  it('a browser agent\'s computer-use appearances never inflate stepsServed — attempting is not serving', () => {
    const { products } = loadCategory('browser-agents', DATA_DIR)
    let cuOnlyRows = 0
    for (const p of products) {
      for (const a of processesForVendor('browser-agents', p.id, DATA_DIR)) {
        if (a.kinds.includes('computer-use') && !a.kinds.includes('step-ranked')
          && !a.kinds.includes('supporting-ranked') && !a.kinds.includes('cross-arena')) {
          cuOnlyRows += 1
          expect(a.stepsServed, `${p.id} ${a.taskId}: computer-use-only appearance must serve 0 steps`).toBe(0)
          expect(a.leaderboardRank).toBeNull()
          expect(a.processScore).toBeNull()
          // Still a judged appearance: the attempt score is real and cited on the process page.
          expect(a.bestStepScore).not.toBeNull()
        }
      }
    }
    // The fleet really does surface via computer-use across the corpus (not vacuously green).
    expect(cuOnlyRows).toBeGreaterThan(50)
  })

  it('unknown products — and known products no process surfaces — return []', () => {
    expect(processesForVendor('startup-banking', 'no-such-product', DATA_DIR)).toEqual([])
    expect(processesForVendor('no-such-arena', 'mercury', DATA_DIR)).toEqual([])
  })

  it('index consistency: every processLeaderboard entry of 3 sampled tasks appears with the same rank and score', () => {
    const tasks = loadProcesses(DATA_DIR)
    const sampled = ['qs_050', 'form_001', 'hr_002'].map((id) => tasks.find((t) => t.id === id)!)
    for (const task of sampled) {
      const lb = processLeaderboard(task, DATA_DIR)
      expect(lb.entries.length).toBeGreaterThan(0)
      lb.entries.forEach((e, i) => {
        const row = processesForVendor(e.arenaId, e.productId, DATA_DIR).find((a) => a.taskId === task.id)
        expect(row, `${task.id}: leaderboard entry ${e.arenaId}/${e.productId} missing from the index`).toBeDefined()
        expect(row!.leaderboardRank).toBe(i + 1)
        expect(row!.processScore).toBe(e.processScore)
        expect(row!.kinds).toContain('step-ranked')
        // Function-kind coverage is at least the leaderboard's; extra-arena steps may add more.
        expect(row!.stepsServed).toBeGreaterThanOrEqual(e.stepsServed)
        expect(row!.rankableSteps).toBe(lb.rankableSteps)
        // bestStepScore is the max of its judged step scores — never below any leaderboard step.
        const bestFn = Math.max(...e.steps.map((s) => s.score))
        expect(row!.bestStepScore).toBeGreaterThanOrEqual(bestFn)
      })
    }
  })

  it('servedSteps receipts: node-id\'d, best-first, deduped per node, never on computer-use-only rows (founder 2026-10-02 depth)', () => {
    const rows = processesForVendor('startup-banking', 'mercury', DATA_DIR)
    expect(rows.some((a) => a.servedSteps.length > 0)).toBe(true)
    for (const a of rows) {
      const ids = a.servedSteps.map((s) => s.nodeId)
      expect(new Set(ids).size).toBe(ids.length)
      for (let i = 1; i < a.servedSteps.length; i++) {
        expect(a.servedSteps[i - 1].score).toBeGreaterThanOrEqual(a.servedSteps[i].score)
      }
      for (const s of a.servedSteps) {
        expect(s.nodeId.length).toBeGreaterThan(0)
        expect(s.label.length).toBeGreaterThan(0)
      }
      // "Could attempt it" never produces a served-step receipt.
      if (!a.kinds.includes('step-ranked') && !a.kinds.includes('supporting-ranked') && !a.kinds.includes('cross-arena')) {
        expect(a.servedSteps).toEqual([])
      }
    }
  })

  it('every vendor a process step card ranks — supporting steps included — lists that process on its product page', () => {
    // The invariant the site renders against: the step cards show stepRanking chips (plus
    // cross-arena chips); any vendor visible there must come back from processesForVendor
    // with a score-bearing kind. Government agencies stay out by doctrine (they are not
    // competing vendors and keep their own arena rankings).
    for (const task of loadProcesses(DATA_DIR)) {
      for (const node of task.dag.nodes) {
        const primary = stepRanking(task.id, node, DATA_DIR)
        if (primary && primary.arenaId !== GOVERNMENT_ARENA_ID) {
          for (const v of primary.vendors) {
            const row = processesForVendor(primary.arenaId, v.productId, DATA_DIR).find((a) => a.taskId === task.id)
            expect(row, `${task.id}/${node.id}: ranked vendor ${primary.arenaId}/${v.productId} missing from its product page`).toBeDefined()
            expect(
              row!.kinds.includes(node.supporting ? 'supporting-ranked' : 'step-ranked'),
              `${task.id}/${node.id}: ${v.productId} must carry the ${node.supporting ? 'supporting-ranked' : 'step-ranked'} kind`,
            ).toBe(true)
            expect(row!.servedSteps.some((s) => s.nodeId === node.id), `${task.id}/${node.id}: ${v.productId} receipt missing`).toBe(true)
          }
        }
        for (const ranking of crossArenaStepRankings(task.id, node, DATA_DIR)) {
          for (const v of ranking.vendors) {
            const row = processesForVendor(ranking.arenaId, v.productId, DATA_DIR).find((a) => a.taskId === task.id)
            expect(row, `${task.id}/${node.id}: cross-arena vendor ${ranking.arenaId}/${v.productId} missing from its product page`).toBeDefined()
            expect(row!.kinds).toContain('cross-arena')
          }
        }
      }
    }
  })

  it('a vendor ranked only on a supporting step keeps the process link with receipts: tax_002 cloud-storage (the Box case)', () => {
    const task = loadProcesses(DATA_DIR).find((t) => t.id === 'tax_002')!
    const node = task.dag.nodes.find((n) => n.supporting)!
    const ranking = stepRankingFull(task.id, node, DATA_DIR)!
    expect(ranking.arenaId).toBe('cloud-storage')
    expect(ranking.vendors.length).toBeGreaterThan(0)
    for (const v of ranking.vendors) {
      const row = processesForVendor('cloud-storage', v.productId, DATA_DIR).find((a) => a.taskId === 'tax_002')
      expect(row, `cloud-storage/${v.productId} must list tax_002`).toBeDefined()
      expect(row!.kinds).toContain('supporting-ranked')
      // Supporting appearances confer no leaderboard placement: the step stays out of the
      // entry aggregation, so rank and process score come only from non-supporting steps.
      expect(row!.leaderboardRank).toBeNull()
      expect(row!.processScore).toBeNull()
      expect(row!.stepsServed).toBeGreaterThan(0)
      const receipt = row!.servedSteps.find((s) => s.nodeId === node.id)
      expect(receipt).toBeDefined()
      expect(receipt!.score).toBe(v.score)
    }
  })

  it('supporting appearances never create leaderboard entries: the five supporting steps stay out of entry aggregation', () => {
    for (const [taskId] of [['tax_001'], ['tax_002'], ['shutdown_001'], ['fund_002'], ['comp_011']] as const) {
      const task = loadProcesses(DATA_DIR).find((t) => t.id === taskId)!
      const lb = processLeaderboard(task, DATA_DIR)
      for (const node of task.dag.nodes.filter((n) => n.supporting)) {
        const ranking = stepRankingFull(task.id, node, DATA_DIR)
        if (!ranking) continue
        for (const v of ranking.vendors) {
          const entry = lb.entries.find((e) => e.arenaId === ranking.arenaId && e.productId === v.productId)
          // A vendor may be an entry via OTHER (non-supporting) steps; the supporting step
          // itself never appears among an entry's served steps.
          if (entry) expect(entry.steps.some((s) => s.nodeId === node.id)).toBe(false)
        }
      }
    }
  })

  it('appearances are sorted best-placement-first and kinds are canonical-ordered', () => {
    const rows = processesForVendor('startup-banking', 'mercury', DATA_DIR)
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1]
      const b = rows[i]
      const ra = a.leaderboardRank ?? Number.MAX_SAFE_INTEGER
      const rb = b.leaderboardRank ?? Number.MAX_SAFE_INTEGER
      expect(
        ra < rb
        || (ra === rb && (a.processScore ?? -1) > (b.processScore ?? -1))
        || (ra === rb && (a.processScore ?? -1) === (b.processScore ?? -1) && a.stepsServed >= b.stepsServed),
        `rows ${a.taskId} and ${b.taskId} out of order`,
      ).toBe(true)
    }
    const kindOrder = VENDOR_PROCESS_KINDS as readonly string[]
    for (const a of rows) {
      const idx = a.kinds.map((k) => kindOrder.indexOf(k))
      expect([...idx].sort((x, y) => x - y)).toEqual(idx)
    }
  })
})
