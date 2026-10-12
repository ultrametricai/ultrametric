// "Check my process": the pure client-side math (lib/processCheck.ts) over fixtures, and the
// server builder (lib/processCheckData.ts) recomputed against the real committed data — every
// serialized step score must equal stepVendorScore straight off the step's mapped stories ×
// verdicts.json, the same determinism bar as lib/__tests__/processRankings.test.ts.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  runProcessCheck,
  STEP_UPGRADE_DELTA,
  yoursForStep,
  type ProcessCheckStep,
} from '@/lib/processCheck'
import { buildProcessCheckSteps } from '@/lib/processCheckData'
import { findProcessBySlug } from '@/lib/processes'
import { functionMappingFor, stepVendorScore } from '@/lib/processRankings'

const DATA_DIR = path.resolve(__dirname, '../../rankings')

function step(overrides: Partial<ProcessCheckStep>): ProcessCheckStep {
  return {
    nodeId: 'n1',
    label: 'Open the account',
    storyCount: 3,
    arenas: [
      {
        arenaId: 'startup-banking',
        arenaName: 'Startup banking',
        kind: 'function',
        vendors: [
          { productId: 'best-bank', name: 'Best Bank', score: 90 },
          { productId: 'mid-bank', name: 'Mid Bank', score: 71 },
          { productId: 'my-bank', name: 'My Bank', score: 60 },
        ],
      },
    ],
    best: { productId: 'best-bank', name: 'Best Bank', score: 90, arenaId: 'startup-banking' },
    ...overrides,
  }
}

describe('yoursForStep', () => {
  it('resolves via the covering arena first, then extra arenas, else null', () => {
    const s = step({
      arenas: [
        ...step({}).arenas,
        {
          arenaId: 'ai-assistants',
          arenaName: 'AI assistants',
          kind: 'extra',
          vendors: [{ productId: 'chatgpt', name: 'ChatGPT', score: 55 }],
        },
      ],
    })
    expect(yoursForStep(s, { 'startup-banking': ['my-bank'] })?.productId).toBe('my-bank')
    // No covering-arena pick — the extra arena serves the step.
    expect(yoursForStep(s, { 'ai-assistants': ['chatgpt'] })?.arenaId).toBe('ai-assistants')
    // A pick with no judged step evidence (not in the vendor list) does not cover the step.
    expect(yoursForStep(s, { 'startup-banking': ['ghost-bank'] })).toBeNull()
    expect(yoursForStep(s, {})).toBeNull()
  })

  it('multi-pick arena: the HIGHEST-SCORING covered pick is yours, whatever the stack order', () => {
    const s = step({})
    // The 2nd pick (mid-bank, 71) outscores the 1st (my-bank, 60) on this step.
    expect(yoursForStep(s, { 'startup-banking': ['my-bank', 'mid-bank'] })?.productId).toBe('mid-bank')
    // An uncovered pick alongside a covered one — the covered one serves the step.
    expect(yoursForStep(s, { 'startup-banking': ['ghost-bank', 'my-bank'] })?.productId).toBe('my-bank')
  })

  it('arena order still wins over score: a covering-arena pick beats a higher-scoring extra-arena pick', () => {
    const s = step({
      arenas: [
        ...step({}).arenas,
        {
          arenaId: 'ai-assistants',
          arenaName: 'AI assistants',
          kind: 'extra',
          vendors: [{ productId: 'chatgpt', name: 'ChatGPT', score: 99 }],
        },
      ],
    })
    expect(
      yoursForStep(s, { 'startup-banking': ['my-bank'], 'ai-assistants': ['chatgpt'] })?.productId,
    ).toBe('my-bank')
  })
})

describe('runProcessCheck', () => {
  it('flags a covered step only when it trails the best by more than the threshold', () => {
    const steps = [
      step({ nodeId: 'behind' }), // my-bank 60 vs best 90 → Δ30 > 15 → flagged
      step({
        nodeId: 'close',
        arenas: [
          {
            arenaId: 'startup-banking',
            arenaName: 'Startup banking',
            kind: 'function',
            vendors: [
              { productId: 'best-bank', name: 'Best Bank', score: 72 },
              { productId: 'my-bank', name: 'My Bank', score: 60 },
            ],
          },
        ],
        best: { productId: 'best-bank', name: 'Best Bank', score: 72, arenaId: 'startup-banking' },
      }), // Δ12 ≤ 15 → not flagged
    ]
    const result = runProcessCheck(steps, { 'startup-banking': ['my-bank'] })
    expect(result.steps.map((s) => s.flagged)).toEqual([true, false])
    expect(result.steps[0].delta).toBe(30)
    expect(result.flaggedSteps).toBe(1)
    expect(STEP_UPGRADE_DELTA).toBe(15)
  })

  it('never flags the step-best pick itself and reports coverage + averages over covered steps only', () => {
    const steps = [
      step({ nodeId: 'a' }),
      step({ nodeId: 'b' }),
      step({
        nodeId: 'uncoverable',
        arenas: [
          { arenaId: 'payroll', arenaName: 'Payroll', kind: 'function', vendors: [{ productId: 'gusto', name: 'Gusto', score: 80 }] },
        ],
        best: { productId: 'gusto', name: 'Gusto', score: 80, arenaId: 'payroll' },
      }),
    ]
    const result = runProcessCheck(steps, { 'startup-banking': ['best-bank'] })
    expect(result.rankableSteps).toBe(3)
    expect(result.coveredSteps).toBe(2)
    expect(result.flaggedSteps).toBe(0)
    expect(result.avgYours).toBe(90) // best-bank on both covered steps
    expect(result.avgBest).toBe(90)
    expect(result.steps[2].yours).toBeNull()
    expect(result.steps[2].delta).toBeNull()
  })

  it('an empty stack covers nothing and averages stay null', () => {
    const result = runProcessCheck([step({})], {})
    expect(result.coveredSteps).toBe(0)
    expect(result.avgYours).toBeNull()
    expect(result.avgBest).toBeNull()
  })
})

describe('buildProcessCheckSteps — deterministic recompute against committed data', () => {
  const task = findProcessBySlug('open-bank-account', DATA_DIR)!

  it('serves the founder example: open-bank-account has rankable steps with a best vendor each', () => {
    expect(task).toBeTruthy()
    const steps = buildProcessCheckSteps(task, DATA_DIR)
    expect(steps.length).toBeGreaterThan(0)
    for (const s of steps) {
      expect(s.arenas[0].kind).toBe('function')
      expect(s.best.productId).toBe(s.arenas[0].vendors[0].productId)
      expect(s.best.arenaId).toBe(s.arenas[0].arenaId)
      // Ranked best-first.
      const scores = s.arenas[0].vendors.map((v) => v.score)
      expect([...scores].sort((a, b) => b - a)).toEqual(scores)
    }
  })

  it('every serialized vendor score equals stepVendorScore over the step\'s committed story mapping', () => {
    const steps = buildProcessCheckSteps(task, DATA_DIR)
    const nodeById = new Map(task.dag.nodes.map((n) => [n.id, n]))
    for (const s of steps) {
      const entry = functionMappingFor(task.id, nodeById.get(s.nodeId)!, DATA_DIR)!
      for (const v of s.arenas[0].vendors) {
        const recomputed = stepVendorScore(entry.arenaId, entry.storyIds, v.productId, DATA_DIR)
        expect(recomputed?.score, `${s.nodeId}/${v.productId}`).toBe(v.score)
      }
    }
  })

  it('the uncapped function roster lets ANY judged pick be found, not just the display cap', () => {
    const steps = buildProcessCheckSteps(task, DATA_DIR)
    // Mercury is the corpus's canonical startup-banking vendor — it must be resolvable as
    // "yours" wherever startup-banking covers a step, regardless of its per-step rank.
    const banking = steps.filter((s) => s.arenas[0].arenaId === 'startup-banking')
    expect(banking.length).toBeGreaterThan(0)
    for (const s of banking) {
      expect(yoursForStep(s, { 'startup-banking': ['mercury'] })?.productId).toBe('mercury')
    }
  })
})
