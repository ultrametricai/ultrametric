// The shutdown founder rule (lib/shutdown.ts; 2026-09-21: "if pulley doesnt exist anymore and
// shutting down, have a tag for 'shutdown' and dont offer it"): a marked product keeps its
// rows, verdicts and history (list/rank surfaces tag it) but is never OFFERED — stack picks,
// step vendor rosters, upgrade advice, gap closers. Pulley (rankings/equity-management, marked
// 2026-09-15) is the real-data probe: it must vanish from every equity-management step vendor
// list while its arena leaderboard row and step scores stay fully intact.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveStack, type AiStack } from '@/lib/aiStacks'
import { loadCategory } from '@/lib/data'
import type { CategoryData } from '@/lib/data-helpers'
import { resolveGapStep } from '@/lib/gapClosers'
import { runProcessCheck } from '@/lib/processCheck'
import { buildProcessCheckSteps } from '@/lib/processCheckData'
import { loadProcesses, stepVendorOptions, vendorAlternatives, type DagNode, type ProcessTask } from '@/lib/processes'
import {
  computerUseOptions, crossArenaStepRankings, functionMappingFor, processLeaderboard,
  stepRanking, stepVendorScore,
} from '@/lib/processRankings'
import { isShutdown, SHUTDOWN_TAG_TITLE } from '@/lib/shutdown'

const DATA_DIR = path.resolve(__dirname, '../../rankings')

describe('isShutdown', () => {
  it('is true exactly when the verified note is set', () => {
    expect(isShutdown({})).toBe(false)
    expect(isShutdown({ shutdown: undefined })).toBe(false)
    expect(isShutdown({ shutdown: 'Shutting down 2026-12-08 (vendor notice).' })).toBe(true)
  })

  it('tag tooltip prefers the dated vendor note', () => {
    expect(SHUTDOWN_TAG_TITLE({ shutdown: 'note' })).toBe('note')
    expect(SHUTDOWN_TAG_TITLE({})).toMatch(/shutting down/)
  })
})

// ---------------------------------------------------------------------------
// aiStacks: a shutdown product is never a stack pick, runner-up, or co-pick
// ---------------------------------------------------------------------------

// Minimal in-memory arena — resolveStack only reads category id/name, products
// (name/type/shutdown) and the leaderboard metric columns.
function fakeArena(
  id: string,
  rows: Array<{ id: string; name: string; agentReady: number; shutdown?: string }>,
): CategoryData {
  return {
    category: { id, name: id },
    products: rows.map((r) => ({ id: r.id, name: r.name, type: 'commercial', shutdown: r.shutdown })),
    rankings: {
      leaderboard: rows.map((r) => ({ productId: r.id, aiEra: r.agentReady, agentReady: r.agentReady, agenticApp: r.agentReady })),
    },
  } as unknown as CategoryData
}

const arenaTopStack = (arenaId: string): AiStack => ({
  id: 'test-stack',
  name: 'Test',
  tagline: 't',
  audience: 'a',
  slots: [
    { role: 'Role', why: 'w', pick: { kind: 'arena-top', arenaId, metric: 'agentReady' } },
    { role: 'Editorial', why: 'w', pick: { kind: 'editorial', name: 'X', url: 'https://x.test/', note: 'n' } },
  ],
})

describe('aiStacks shutdown exclusion', () => {
  it('the next product moves up when the metric leader announced a shutdown; it is never a runner-up or co-pick either', () => {
    const categories = [
      fakeArena('fake-arena', [
        { id: 'dying-leader', name: 'Dying Leader', agentReady: 90, shutdown: 'Shutting down 2026-12-08.' },
        { id: 'runner', name: 'Runner', agentReady: 80 },
        { id: 'closebehind', name: 'Close Behind', agentReady: 79 },
      ]),
    ]
    const resolved = resolveStack(arenaTopStack('fake-arena'), categories)
    const slot = resolved.slots[0]
    expect(slot.productId).toBe('runner')
    expect(slot.metricValue).toBe(80)
    // Δ1 to closebehind → co-pick; the shutdown leader appears nowhere.
    expect(slot.coPick?.productId).toBe('closebehind')
    expect(slot.runnerUpId).not.toBe('dying-leader')
    expect([slot.productId, slot.runnerUpId, slot.coPick?.productId]).not.toContain('dying-leader')
  })

  it('a curated product pick pointing at a shutdown product degrades (slot dropped), like any dead slot', () => {
    const categories = [
      fakeArena('fake-arena', [
        { id: 'dying-leader', name: 'Dying Leader', agentReady: 90, shutdown: 'Shutting down.' },
        { id: 'runner', name: 'Runner', agentReady: 80 },
      ]),
    ]
    const curated: AiStack = {
      ...arenaTopStack('fake-arena'),
      slots: [
        { role: 'Curated', why: 'w', pick: { kind: 'product', arenaId: 'fake-arena', productId: 'dying-leader', metric: 'agentReady', note: 'pairing' } },
        { role: 'Live', why: 'w', pick: { kind: 'product', arenaId: 'fake-arena', productId: 'runner', metric: 'agentReady', note: 'pairing' } },
      ],
    }
    const resolved = resolveStack(curated, categories)
    expect(resolved.slots.map((s) => s.productId)).toEqual(['runner'])
  })
})

// The My Stack recommendation-engine cases (shutdown pick gets MIGRATE advice, shutdown
// products never offered as upgrades/leaders) moved to the private site repo with
// lib/myStack.ts (repo split).

// ---------------------------------------------------------------------------
// Real-data probe: Pulley (equity-management, marked shutdown 2026-09-15)
// ---------------------------------------------------------------------------

const PULLEY = 'pulley'
const EQ = 'equity-management'

function equitySteps(tasks: ProcessTask[]): Array<{ task: ProcessTask; node: DagNode }> {
  const out: Array<{ task: ProcessTask; node: DagNode }> = []
  for (const task of tasks) {
    for (const node of task.dag.nodes) {
      const entry = functionMappingFor(task.id, node, DATA_DIR)
      if (entry?.arenaId === EQ && entry.storyIds.length > 0) out.push({ task, node })
    }
  }
  return out
}

describe('pulley: tagged and preserved, never offered', () => {
  const data = loadCategory(EQ, DATA_DIR)
  const pulley = data.products.find((p) => p.id === PULLEY)!
  const tasks = loadProcesses(DATA_DIR)
  const steps = equitySteps(tasks)

  it('is really marked shutdown in the committed data (the probe is live)', () => {
    expect(pulley).toBeTruthy()
    expect(isShutdown(pulley)).toBe(true)
  })

  it('the arena leaderboard row and judged step scores stay fully intact', () => {
    expect(data.rankings.leaderboard.some((e) => e.productId === PULLEY)).toBe(true)
    // Evidence still resolves: its step score over a real mapped story set is still computable.
    const entry = functionMappingFor(steps[0].task.id, steps[0].node, DATA_DIR)!
    expect(stepVendorScore(EQ, entry.storyIds, PULLEY, DATA_DIR)).not.toBeNull()
  })

  it('no longer appears in ANY equity-management step vendor ranking (function or cross-arena)', () => {
    expect(steps.length).toBeGreaterThan(0)
    for (const { task, node } of steps) {
      const ranking = stepRanking(task.id, node, DATA_DIR)
      expect(ranking, `${task.id}:${node.id} should still rank the remaining field`).not.toBeNull()
      expect(ranking!.vendors.length).toBeGreaterThan(0)
      expect(ranking!.vendors.map((v) => v.productId)).not.toContain(PULLEY)
    }
    for (const task of tasks) {
      for (const node of task.dag.nodes) {
        for (const r of crossArenaStepRankings(task.id, node, DATA_DIR)) {
          expect(r.vendors.map((v) => v.productId)).not.toContain(PULLEY)
        }
        expect(computerUseOptions(task.id, node.id, DATA_DIR).map((v) => v.productId)).not.toContain(PULLEY)
      }
    }
  })

  it('is out of the process leaderboards and never a bestPerStep top', () => {
    for (const { task } of steps) {
      const board = processLeaderboard(task, DATA_DIR)
      expect(board.entries.map((e) => e.productId)).not.toContain(PULLEY)
      expect(board.bestPerStep.map((b) => b.top.productId)).not.toContain(PULLEY)
    }
  })

  it('is out of derived step vendor rosters and swap alternatives', () => {
    const withEqOptions = tasks.flatMap((t) => t.dag.nodes.filter((n) => n.optionsArenaId === EQ))
    expect(withEqOptions.length).toBeGreaterThan(0)
    for (const node of withEqOptions) {
      expect(stepVendorOptions(node, DATA_DIR).map((c) => c.productId)).not.toContain(PULLEY)
    }
    expect(vendorAlternatives('carta', 10, DATA_DIR).map((o) => o.id)).not.toContain(PULLEY)
  })

  it('gap closers never suggest it for equity paperwork', () => {
    const res = resolveGapStep({ label: 'Draft stock option grant paperwork', route: 'form' }, DATA_DIR)
    expect(res?.kind).toBe('closer')
    if (res?.kind === 'closer') expect(res.closer.topProduct.id).not.toBe(PULLEY)
  })

  it('process check: still findable as the reader\'s own pick — marked, never best, always flagged to migrate', () => {
    const task = steps[0].task
    const checkSteps = buildProcessCheckSteps(task, DATA_DIR)
    const eqCheckSteps = checkSteps.filter((s) => s.arenas[0].arenaId === EQ)
    expect(eqCheckSteps.length).toBeGreaterThan(0)
    for (const s of eqCheckSteps) {
      const row = s.arenas[0].vendors.find((v) => v.productId === PULLEY)
      expect(row, `${s.nodeId}: pulley must stay findable in the serialized list`).toBeDefined()
      expect(row!.shutdown).toBe(true)
      expect(s.best.productId).not.toBe(PULLEY)
    }
    const result = runProcessCheck(eqCheckSteps, { [EQ]: [PULLEY] })
    for (const s of result.steps) {
      expect(s.yours?.productId).toBe(PULLEY)
      expect(s.flagged, `${s.nodeId}: a shutdown pick is always flagged`).toBe(true)
    }
  })
})
