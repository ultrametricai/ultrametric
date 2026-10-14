// Integrity tests for the committed human-step audit (open-rankings/human-step-audit.json, generated
// by pipeline/scripts/audit-human-steps.ts): exact coverage of the corpus's non-agent nodes,
// enum-valid feasibility, authored (non-generic) reasons, the hand-verified not-drivable set,
// and a loader smoke test. No LLM/network — same posture as map-step-stories.test.ts.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { humanStepAudit, loadHumanStepAudit } from '../../lib/humanSteps'
import { loadProcesses } from '../../lib/processes'
import { DATA_DIR } from '../paths'
import {
  ComputerUseFeasibilitySchema, HAND_VERIFIED_NOT_DRIVABLE, type HumanStepAuditEntry,
  HumanStepAuditFileSchema, LEGACY_GENERIC_REASONS, mergeAuditEntries,
} from '../scripts/audit-human-steps'

const file = path.join(DATA_DIR, 'human-step-audit.json')
const entries = HumanStepAuditFileSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')))
const byKey = new Map(entries.map((e) => [`${e.taskId}:${e.nodeId}`, e]))

// Every non-agent node in the corpus, from the same loader the generator enumerates with.
const nonAgentNodes = loadProcesses(DATA_DIR).flatMap((t) =>
  t.dag.nodes
    .filter((n) => n.route === 'form' || n.route === 'person')
    .map((n) => ({ key: `${t.id}:${n.id}`, route: n.route as 'form' | 'person' })),
)

describe('open-rankings/human-step-audit.json coverage', () => {
  it('covers exactly the corpus\'s non-agent nodes — no missing, no stale extras', () => {
    const expected = new Set(nonAgentNodes.map((n) => n.key))
    const actual = new Set(byKey.keys())
    expect([...expected].filter((k) => !actual.has(k))).toEqual([])
    expect([...actual].filter((k) => !expected.has(k))).toEqual([])
    // One entry per node — no duplicates collapsed by the map.
    expect(entries.length).toBe(nonAgentNodes.length)
  })

  it('records the node\'s actual route on every entry', () => {
    for (const n of nonAgentNodes) {
      expect(byKey.get(n.key)!.route).toBe(n.route)
    }
  })
})

describe('authored reasons', () => {
  it('every computerUse value is from the closed enum', () => {
    for (const e of entries) {
      expect(ComputerUseFeasibilitySchema.safeParse(e.computerUse).success).toBe(true)
    }
  })

  it('why and computerUseWhy are non-empty and never one of the three legacy generic strings', () => {
    for (const e of entries) {
      expect(e.why.trim().length).toBeGreaterThan(0)
      expect(e.computerUseWhy.trim().length).toBeGreaterThan(0)
      expect(LEGACY_GENERIC_REASONS.has(e.why.trim())).toBe(false)
      expect(LEGACY_GENERIC_REASONS.has(e.computerUseWhy.trim())).toBe(false)
    }
  })

  it('the hand-verified no-screen/waiting set is never judged drivable or assist', () => {
    expect(HAND_VERIFIED_NOT_DRIVABLE.size).toBe(14)
    for (const key of HAND_VERIFIED_NOT_DRIVABLE) {
      const e = byKey.get(key)
      expect(e, `validation-set node ${key} missing from audit`).toBeDefined()
      expect(['drivable', 'assist']).not.toContain(e!.computerUse)
    }
  })
})

describe('mergeAuditEntries', () => {
  const entry = (nodeId: string, why: string, extra: Partial<HumanStepAuditEntry> = {}): HumanStepAuditEntry => ({
    taskId: 'fund_001', nodeId, route: 'person', why,
    computerUse: 'no-screen', computerUseWhy: `cu-why for ${nodeId}`, ...extra,
  })

  it('a committed entry marked preserve wins over the cache-derived entry for the same node', () => {
    const curated = entry('n1', 'hand-curated root cause', { preserve: true })
    const assembled = [entry('n1', 'freshly generated reason'), entry('n2', 'other reason')]
    const merged = mergeAuditEntries(assembled, [curated, entry('n2', 'stale committed reason')])
    expect(merged).toEqual([curated, entry('n2', 'other reason')])
  })

  it('unmarked committed entries are refreshed normally, and preserved entries for nodes gone from the corpus drop out', () => {
    const assembled = [entry('n1', 'regenerated')]
    const committed = [entry('n1', 'old'), entry('n9', 'node no longer in corpus', { preserve: true })]
    expect(mergeAuditEntries(assembled, committed)).toEqual([entry('n1', 'regenerated')])
  })
})

describe('lib/humanSteps loader', () => {
  it('loads the committed audit and resolves per-node lookups', () => {
    const loaded = loadHumanStepAudit()
    expect(loaded.length).toBe(entries.length)
    const sample = entries[0]
    const hit = humanStepAudit(sample.taskId, sample.nodeId)
    expect(hit).not.toBeNull()
    expect(hit!.why).toBe(sample.why)
    expect(humanStepAudit('no_such_task', 'n0')).toBeNull()
  })
})
