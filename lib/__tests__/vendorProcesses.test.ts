import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCategory } from '@/lib/data'
import { loadProcesses } from '@/lib/processes'
import { processLeaderboard } from '@/lib/processRankings'
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
        if (a.kinds.includes('computer-use')
          && !a.kinds.includes('step-ranked') && !a.kinds.includes('cross-arena')) {
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
      if (!a.kinds.includes('step-ranked') && !a.kinds.includes('cross-arena')) {
        expect(a.servedSteps).toEqual([])
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
