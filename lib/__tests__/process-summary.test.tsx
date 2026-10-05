// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadSharedProcesses } from '../shared-processes/load'
import { loadProcesses, taskCeiling } from '../processes'
import ProcessSummary, { processSummary } from '@/components/shared-processes/ProcessSummary'

const records = loadSharedProcesses()
const corporation = records.find(record => record.id === 'form_001')!
const contractor = records.find(record => record.id === 'opp_002')!

describe('shared process summary', () => {
  it('counts default-path source classifications, keeping known unverified work distinct', () => {
    expect(processSummary(corporation)).toMatchObject({ automation: null, completionTime: null, cost: null, steps: 10, agent: null, unverified: 1, approvals: null, agentCeiling: 10 })
    expect(processSummary(contractor).agent).toBe(2)
    expect(processSummary(contractor).approvals).toBeNull() // missing is not false or an approval count
    const misleading = { ...contractor, metadata: { activeMinutes: 82, totalEstimatedMinutes: 2977, agentReady: 99, processScore: 75, cost: 500 } }
    expect(processSummary(misleading)).toEqual(processSummary(contractor))
    expect(processSummary(records.find(record => record.id === 'first-hire')!).agent).toBeNull()
  })
  it('omits unsupported summaries and does not sum alternative methods', () => {
    expect(renderToStaticMarkup(<ProcessSummary record={{ ...corporation, metadata: {}, parts: [] }} />)).toBe('')
    const changed = structuredClone(contractor)
    changed.parts[1].options[1].metadata.route = 'agent'
    changed.parts[1].options[1].metadata.approvalRequired = true
    expect(processSummary(changed).agent).toBe(2)
    expect(processSummary(changed).approvals).toBeNull()
    changed.parts[0].metadata.approvalRequired = true
    expect(processSummary(changed).approvals).toBe(1)
  })
  it('renders only the existing default-path ceiling, retaining the unverified classification caveat', () => {
    expect(processSummary(corporation).agentCeiling).toBe(taskCeiling(loadProcesses().find(task => task.id === corporation.id)!).pct)
    const el = document.createElement('div')
    el.innerHTML = renderToStaticMarkup(<ProcessSummary record={corporation} />)
    expect(el.querySelector('dl')?.textContent).toBe('10%Agentic ceiling')
    expect(el.querySelector('dl')?.title).toContain('not verified tool integrations')
  })
  it('counts approval-gated agent steps fully and manual, human, and signature steps only in the denominator', () => {
    const mixed = { ...contractor, parts: [
      { ...contractor.parts[0], id: 'agent', metadata: { route: 'agent', approvalRequired: true, estimatedMinutes: 1 } },
      { ...contractor.parts[0], id: 'form', metadata: { route: 'form', estimatedMinutes: 100 } },
      { ...contractor.parts[0], id: 'person', metadata: { route: 'person', estimatedMinutes: 100 } },
      { ...contractor.parts[0], id: 'signature', metadata: { route: 'person', legalSignature: true, estimatedMinutes: 100 } },
    ] }
    expect(processSummary(mixed)).toMatchObject({ agentCeiling: 25, agent: 1, approvals: 1, steps: 4 })
    const manual = { ...mixed, parts: mixed.parts.slice(1) }
    expect(processSummary(manual).agentCeiling).toBe(0)
    expect(renderToStaticMarkup(<ProcessSummary record={manual} />)).toContain('0%')
  })
  it('omits a ceiling for missing classifications, unresolved references, or an empty scope', () => {
    const unknown = { ...contractor, parts: [{ ...contractor.parts[0], metadata: {} }] }
    const unresolved = records.find(record => record.id === 'first-hire')!
    for (const record of [unknown, unresolved, { ...contractor, parts: [] }]) {
      expect(processSummary(record).agentCeiling).toBeNull()
      expect(renderToStaticMarkup(<ProcessSummary record={record} />)).toBe('')
    }
  })
})
