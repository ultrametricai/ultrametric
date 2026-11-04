// Approval modes: every approval-gated step declares WHEN its named, scoped human
// approval happens (lib/execution.ts approvalSchema). These tests pin the migration
// invariants: full mode coverage over formerly approvalRequired steps, the derived
// approvalRequired alias, and the floor that irreversible and money-moving steps are
// never pre-approvable or unapproved.
import { describe, expect, it } from 'vitest'
import {
  APPROVAL_MODES, approvalOf, approvalSchema, requiresExecutionApproval, validateApproval,
} from '../execution'
import { recordForInstructions } from '../shared-processes/instructions'
import { loadSharedProcesses } from '../shared-processes/load'
import type { Part, SharedRecord } from '../shared-processes/schema'
import { loadProcesses } from '../processes'

const records = loadSharedProcesses()

interface Step { at: string; metadata: Record<string, unknown>; title: string }
const steps: Step[] = []
function collect(parts: Part[], at: string) {
  for (const part of parts) {
    steps.push({ at: `${at}/${part.id}`, metadata: part.metadata, title: part.title ?? '' })
    for (const option of part.options) {
      // Option metadata merges over the part's (the same view the catalog validator checks).
      steps.push({ at: `${at}/${part.id}/${option.id}`, metadata: { ...part.metadata, ...option.metadata }, title: part.title ?? option.title })
      collect(option.parts, `${at}/${part.id}/${option.id}`)
    }
  }
}
for (const record of records) collect(record.parts, record.id)

const gated = steps.filter(step => step.metadata.approvalRequired === true || step.metadata.approval)

const MONEY = /\b(pay|pays|payment|payments|payroll|paycheck|payout|payouts|refund|refunds|wire|wires|remit|remittance|disburse|capital call|distribution|distributions)\b/i

describe('approval modes across the canonical corpus', () => {
  it('covers the corpus: there are approval-gated steps to classify', () => {
    expect(gated.length).toBeGreaterThan(400)
  })

  it('every formerly approvalRequired step carries a declared mode', () => {
    for (const step of gated) {
      const approval = approvalOf(step.metadata)
      expect(approval, `${step.at} is approval-gated without a declared approval mode`).toBeDefined()
      expect(APPROVAL_MODES, step.at).toContain(approval!.mode)
      expect(approval!.reason, `${step.at} approval reason must cite its policy`).toContain('policies/AGENT_POLICY.md')
    }
  })

  it('approvalRequired is the derived alias of the mode everywhere: true unless mode is "none"', () => {
    for (const step of steps) {
      const approval = approvalOf(step.metadata)
      if (approval) {
        expect(step.metadata.approvalRequired === true, `${step.at}: approvalRequired must equal (mode !== 'none')`).toBe(approval.mode !== 'none')
        expect(requiresExecutionApproval(step.metadata), step.at).toBe(approval.mode !== 'none')
      } else {
        // Without a declared mode the boolean stands alone; no step may contradict it.
        expect(step.metadata.approval ?? undefined, `${step.at}: approval objects parse as approvalSchema`).toBeUndefined()
      }
    }
  })

  it('irreversible and signature steps are approved on every run, never standing or absent', () => {
    for (const step of gated) {
      const m = step.metadata
      if (m.reversibility === 'irreversible' || m.legalSignature === true) {
        expect(approvalOf(m)!.mode, `${step.at} (irreversible/signature) must be every-run`).toBe('every-run')
      }
    }
  })

  it('money-moving steps are never pre-approvable or unapproved', () => {
    expect(gated.filter(step => MONEY.test(step.title)).length).toBeGreaterThan(10)
    for (const step of gated) {
      if (!MONEY.test(step.title)) continue
      expect(['pre-approvable', 'none'], `${step.at} ("${step.title}") moves money`).not.toContain(approvalOf(step.metadata)!.mode)
    }
  })

  it('standing-approval modes stay on reversible steps and thresholds ride with their mode', () => {
    for (const step of gated) {
      const approval = approvalOf(step.metadata)!
      if (approval.mode === 'pre-approvable' || approval.mode === 'first-run') {
        expect(step.metadata.reversibility, `${step.at}: ${approval.mode} requires a reversible step`).toBe('reversible')
      }
      expect(approval.threshold !== undefined, `${step.at}: threshold rides with mode "threshold" only`).toBe(approval.mode === 'threshold')
      if (approval.threshold) {
        expect(['amount', 'data-sharing', 'recipients', 'irreversible']).toContain(approval.threshold.kind)
      }
    }
  })
})

describe('approval modes on the operational projection', () => {
  it('projected nodes keep the approval object and the alias agrees with it', () => {
    let seen = 0
    for (const task of loadProcesses()) {
      for (const node of task.dag.nodes) {
        if (node.approvalRequired !== true && !node.approval) continue
        seen++
        expect(node.approval, `${task.id}/${node.id}`).toBeDefined()
        expect(node.approvalRequired === true, `${task.id}/${node.id}`).toBe(node.approval!.mode !== 'none')
      }
    }
    expect(seen).toBeGreaterThan(200)
  })
})

describe('approval instructions', () => {
  const GENERIC = 'Obtain human approval before performing this step.'
  const fixture = (metadata: Record<string, unknown>): SharedRecord => ({
    schemaVersion: 1, id: 'test-rec', kind: 'process', title: 'Test', summary: '', outcomes: [], guidance: null,
    parts: [{ id: 'n1', kind: 'step', title: 'Do the step', guidance: null, when: null, ref: null, options: [], references: [], notes: [], metadata }],
    links: [], references: [], notes: [], metadata: {},
  })
  const notesFor = (metadata: Record<string, unknown>) =>
    recordForInstructions(fixture(metadata)).parts[0].notes.map(note => note.text)

  it('a declared mode emits its own line and suppresses the generic every-run request', () => {
    const notes = notesFor({
      approvalRequired: true,
      approval: { mode: 'first-run', reason: 'policies/AGENT_POLICY.md: standing approval covers repeats.' },
    })
    expect(notes).toContain('Obtain named, scoped human approval before the first run; that recorded approval stands for repeat runs.')
    expect(notes).not.toContain(GENERIC)
  })

  it('a threshold mode names its threshold kind and value', () => {
    const notes = notesFor({
      approvalRequired: true,
      approval: { mode: 'threshold', threshold: { kind: 'amount', value: 'USD 500' }, reason: 'policies/AGENT_POLICY.md.' },
    })
    expect(notes).toContain('Obtain human approval once the amount threshold applies (USD 500).')
    expect(notes).not.toContain(GENERIC)
  })

  it('the bare boolean still gets the generic request, exactly once', () => {
    const notes = notesFor({ approvalRequired: true })
    expect(notes.filter(text => text === GENERIC)).toHaveLength(1)
  })
})

describe('approval schema validation', () => {
  const base = { mode: 'every-run', reason: 'policies/AGENT_POLICY.md: case-specific human authorization.' }
  const metadata = (approval: unknown, rest: Record<string, unknown> = {}) => ({ approvalRequired: true, approval, ...rest })

  it('accepts each mode with a consistent alias', () => {
    for (const mode of APPROVAL_MODES) {
      const approval = { ...base, mode, ...(mode === 'threshold' ? { threshold: { kind: 'amount', value: 'USD 500' } } : {}) }
      expect(approvalSchema.parse(approval).mode).toBe(mode)
      validateApproval({ approvalRequired: mode !== 'none', approval }, 'test')
    }
  })

  it('rejects an unknown mode, a missing reason, and unknown keys', () => {
    expect(() => approvalSchema.parse({ ...base, mode: 'sometimes' })).toThrow()
    expect(() => approvalSchema.parse({ mode: 'every-run' })).toThrow()
    expect(() => approvalSchema.parse({ ...base, approver: 'cfo' })).toThrow()
  })

  it('rejects the pre-mode { role, scope } shape without a mode', () => {
    expect(() => validateApproval(metadata({ role: 'cfo', scope: 'this filing' }), 'test')).toThrow()
  })

  it('rejects a threshold outside mode "threshold" and requires one inside it', () => {
    expect(() => validateApproval(metadata({ ...base, threshold: { kind: 'amount' } }), 'test')).toThrow(/threshold/)
    expect(() => validateApproval(metadata({ ...base, mode: 'threshold' }), 'test')).toThrow(/threshold/)
  })

  it('rejects an alias that contradicts the mode', () => {
    expect(() => validateApproval({ approvalRequired: false, approval: base }, 'test')).toThrow(/approvalRequired/)
    expect(() => validateApproval({ approval: base }, 'test')).toThrow(/approvalRequired/)
    expect(() => validateApproval(metadata({ ...base, mode: 'none' }), 'test')).toThrow(/approvalRequired/)
  })

  it('rejects standing or absent approval on irreversible and signature steps', () => {
    for (const mode of ['first-run', 'pre-approvable'] as const) {
      expect(() => validateApproval(metadata({ ...base, mode }, { reversibility: 'irreversible' }), 'test')).toThrow(/every-run/)
      expect(() => validateApproval(metadata({ ...base, mode }, { legalSignature: true }), 'test')).toThrow(/every-run/)
    }
  })
})
