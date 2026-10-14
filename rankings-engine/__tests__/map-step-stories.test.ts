// Pure-part tests for the step→story mapper (pipeline/scripts/map-step-stories.ts): target
// enumeration mirrors lib/processRankings.ts's consumption, hashing, prompt shape, and rule
// validation. No LLM/network — same posture as classify-story-tiers.test.ts.
import { describe, expect, it } from 'vitest'
import { loadProcesses, type DagNode } from '../../lib/processes'
import {
  COMPUTER_USE_SOURCES, coveringArenaId, extraArenasFor, isComputerUseCandidate,
} from '../../lib/processRankings'
import type { Story } from '../../lib/schemas'
import {
  enumerateTargets, mapPrompt, MAX_STORIES_PER_STEP, RawStepMapSchema, STEP_STORY_PROMPT_VERSION,
  targetHash, validateStepMapEntries, type MapTarget,
} from '../scripts/map-step-stories'
import { DATA_DIR } from '../paths'

const story = (id: string, weight = 2): Story => ({
  id,
  persona: 'developer',
  title: `As a developer, I can ${id.replace(/-/g, ' ')}`,
  theme: 'agenticness',
  group: 'agent-access',
  weight,
})

const target: MapTarget = {
  taskId: 'form_001',
  nodeId: 'n2',
  kind: 'function',
  arenaId: 'legal-ops',
  stepKey: 'form_001:n2',
  label: 'File certificate of incorporation',
  route: 'form',
  taskTitle: 'Incorporate C-Corp',
  taskDescription: 'Form a Delaware C-Corp.',
  candidates: [story('esign-flow'), story('entity-filing')],
}

describe('validateStepMapEntries', () => {
  const candidates = new Set(['esign-flow', 'entity-filing'])

  it('accepts a clean answer, including honest empty mappings', () => {
    expect(validateStepMapEntries(
      [{ stepKey: 'a', storyIds: ['esign-flow'] }, { stepKey: 'b', storyIds: [] }],
      ['a', 'b'],
      candidates,
    )).toBeNull()
  })

  it('rejects unknown story ids — every storyId must exist in the candidate list', () => {
    expect(validateStepMapEntries([{ stepKey: 'a', storyIds: ['made-up'] }], ['a'], candidates))
      .toMatch(/not in the candidate story list/)
  })

  it('rejects unexpected, duplicate, and missing steps', () => {
    expect(validateStepMapEntries([{ stepKey: 'x', storyIds: [] }], ['a'], candidates)).toMatch(/unexpected step/)
    expect(validateStepMapEntries(
      [{ stepKey: 'a', storyIds: [] }, { stepKey: 'a', storyIds: [] }],
      ['a'],
      candidates,
    )).toMatch(/duplicate entry/)
    expect(validateStepMapEntries([], ['a'], candidates)).toMatch(/missing entry/)
  })

  it('rejects duplicate story ids and over-cap selections', () => {
    expect(validateStepMapEntries(
      [{ stepKey: 'a', storyIds: ['esign-flow', 'esign-flow'] }], ['a'], candidates,
    )).toMatch(/duplicate storyId/)
    const many = Array.from({ length: MAX_STORIES_PER_STEP + 1 }, (_, i) => `s${i}`)
    expect(validateStepMapEntries(
      [{ stepKey: 'a', storyIds: many }], ['a'], new Set(many),
    )).toMatch(/exceeds the cap/)
  })
})

describe('targetHash', () => {
  it('is stable for identical inputs and changes with the step text, candidates, or prompt version', () => {
    const h = targetHash(target, STEP_STORY_PROMPT_VERSION)
    expect(targetHash({ ...target }, STEP_STORY_PROMPT_VERSION)).toBe(h)
    expect(targetHash({ ...target, label: 'Different step' }, STEP_STORY_PROMPT_VERSION)).not.toBe(h)
    expect(targetHash({ ...target, candidates: [story('esign-flow')] }, STEP_STORY_PROMPT_VERSION)).not.toBe(h)
    expect(targetHash(target, 'v999')).not.toBe(h)
  })
})

describe('mapPrompt', () => {
  it('lists every candidate id and every step key', () => {
    const prompt = mapPrompt('legal-ops', target.candidates, [target])
    expect(prompt).toContain('esign-flow')
    expect(prompt).toContain('entity-filing')
    expect(prompt).toContain('form_001:n2')
    expect(prompt).toContain(target.label)
  })
})

describe('RawStepMapSchema', () => {
  it('parses the expected LLM shape and rejects junk', () => {
    expect(RawStepMapSchema.safeParse([{ stepKey: 'a', storyIds: ['x'] }]).success).toBe(true)
    expect(RawStepMapSchema.safeParse([{ stepKey: '', storyIds: ['x'] }]).success).toBe(false)
    expect(RawStepMapSchema.safeParse([{ storyIds: ['x'] }]).success).toBe(false)
  })
})

describe('enumerateTargets mirrors lib/processRankings consumption', () => {
  const targets = enumerateTargets(loadProcesses(DATA_DIR))

  it('function targets use exactly the covering arena; extra targets only declared extra arenas; computer-use targets only fleet arenas on manual (non-agent) steps', () => {
    const nodeByKey = new Map<string, DagNode>(
      loadProcesses(DATA_DIR).flatMap((t) => t.dag.nodes.map((n) => [`${t.id}:${n.id}`, n] as const)),
    )
    const fleet = new Map(COMPUTER_USE_SOURCES.map((s) => [s.arenaId, s]))
    for (const t of targets) {
      const node = nodeByKey.get(t.stepKey)!
      expect(node).toBeDefined()
      if (t.kind === 'function') {
        expect(t.arenaId).toBe(coveringArenaId(node))
      } else if (t.kind === 'extra') {
        // Extras mirror the 'function' posture: the arena's FULL story list is offered — the
        // ref allowlist and full/partial gate live in the consumer, not the mapper.
        expect(extraArenasFor(node)).toContain(t.arenaId)
        expect(t.arenaId).not.toBe(coveringArenaId(node))
      } else {
        // Founder 2026-09-18: every manual step (any non-agent route) is a computer-use cell.
        expect(isComputerUseCandidate(node)).toBe(true)
        const source = fleet.get(t.arenaId)!
        expect(source).toBeDefined()
        // Assistants are only offered their judged computer-use stories as candidates.
        if (source.storyIds !== null) {
          for (const c of t.candidates) expect(source.storyIds).toContain(c.id)
        }
      }
    }
  })

  it('covers the corpus: hundreds of function cells, extra cells for every declared cross-arena market, computer-use cells for every manual step', () => {
    const fn = targets.filter((t) => t.kind === 'function')
    const cu = targets.filter((t) => t.kind === 'computer-use')
    const extra = targets.filter((t) => t.kind === 'extra')
    expect(fn.length).toBeGreaterThan(100)
    expect(cu.length).toBeGreaterThan(0)
    // One computer-use cell per (manual step, populated fleet source) — form AND person routes.
    const manualSteps = loadProcesses(DATA_DIR)
      .flatMap((t) => t.dag.nodes.filter(isComputerUseCandidate)).length
    expect(cu.length).toBe(manualSteps * COMPUTER_USE_SOURCES.length)
    // One cell per declared (step, extra arena) pair across the whole corpus.
    const declared = loadProcesses(DATA_DIR)
      .flatMap((t) => t.dag.nodes.map((n) => extraArenasFor(n).length))
      .reduce((a, b) => a + b, 0)
    expect(extra.length).toBe(declared)
    expect(extra.length).toBeGreaterThanOrEqual(50)
    // One cell per (step, arena, kind) — no duplicates.
    const keys = new Set(targets.map((t) => `${t.stepKey}:${t.kind}:${t.arenaId}`))
    expect(keys.size).toBe(targets.length)
  })
})
