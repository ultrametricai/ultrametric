// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { loadSharedProcesses } from '../shared-processes/load'
import { buildStepComparisons } from '../shared-processes/step-comparisons'
import { buildProcessProviderChoice } from '../shared-processes/provider-choice'
import { processGraphs, graphExecutionType } from '../shared-processes/graph'
import SharedProcessReader from '@/components/shared-processes/SharedProcessReader'
const records = loadSharedProcesses()
afterEach(cleanup)

describe('canonical preview graph and grouped process providers', () => {
  it('uses only canonical links, keeps real parallel branches, and leaves edgeless parts unordered', () => {
    for (const record of records) {
      for (const graph of processGraphs(record, records)) {
        expect(graph.unresolved).toBe(0)
        const rank = new Map(graph.layers.flatMap((layer, index) => layer.map(node => [node.id, index])))
        for (const edge of graph.edges) expect(rank.get(edge.from)!).toBeLessThan(rank.get(edge.to)!)
      }
    }
    const record = records.find(record => record.id === 'form_001')!
    const root = processGraphs(record, records)[0]
    expect(root.edges).toHaveLength(record.links.length)
    expect(root.unlinked).toHaveLength(2)
    expect(root.layers.every(layer => layer.length === 1)).toBe(true)
    expect(processGraphs(records.find(record => record.id === 'fin_002')!, records)[0].layers.some(layer => layer.length > 1)).toBe(true)
    const edgeless = processGraphs({ ...record, links: [] }, records)[0]
    expect(edgeless.edges).toHaveLength(0)
    expect(edgeless.layers).toHaveLength(1)
    expect(edgeless.layers[0]).toHaveLength(record.parts.length)
  })

  it('keeps geographic and nested option scopes separate and does not fabricate cross-scope edges', () => {
    const record = records.find(record => record.id === 'form_001')!
    const graphs = processGraphs(record, records, 'germany-notary-gmbh')
    expect(graphs[0].nodes.find(node => node.id === 'n4')?.title).toContain('Germany')
    expect(graphs.some(graph => graph.id === 'form_001:n4:germany-notary-gmbh')).toBe(true)
    expect(graphs.some(graph => graph.id.includes('uk-companies-house'))).toBe(false)
    for (const graph of graphs) for (const edge of graph.edges) expect(graph.nodes.some(node => node.id === edge.to)).toBe(true)
    const malformed = processGraphs({ ...record, links: [...record.links, { from: 'missing', to: 'n1' }] }, records)[0]
    expect(malformed.unresolved).toBe(1)
    expect(malformed.edges).toHaveLength(record.links.length)
  })

  it('keeps legal signatures human, unknown types unknown, and agent classifications unverified', () => {
    const node = { id: 'x', scope: 'form_001:n3', title: 'Example', when: null, metadata: { route: 'agent', legalSignature: true } }
    expect(graphExecutionType(node).label).toBe('Signature — legally human')
    expect(graphExecutionType({ ...node, metadata: { route: 'agent' } }).label).toContain('unverified')
    expect(graphExecutionType({ ...node, metadata: {} }).label).toBe('Execution type not specified')
    expect(graphExecutionType({ ...node, metadata: { route: 'person' } }).symbol).not.toBe(graphExecutionType({ ...node, metadata: { route: 'form' } }).symbol)
  })

  it('keeps payroll and team chat choices independent, scoped to mapped steps, with local overrides with the overview always visible', () => {
    const record = records.find(record => record.id === 'hr_012')!
    const comparisons = buildStepComparisons(record)
    const choice = buildProcessProviderChoice(record, comparisons)!
    expect(choice.groups.map(group => group.arenaId).sort()).toEqual(['payroll', 'team-chat'])
    expect(choice.groups.every(group => !group.partScope)).toBe(true)
    expect(choice.stepScopes['hr_012:n1']).toBeUndefined()
    const el = render(<SharedProcessReader record={record} records={records} comparisons={comparisons} processChoice={choice} />)
    const payroll = el.getByRole('region', { name: 'Payroll & HR Ops' })
    const chat = el.getByRole('region', { name: 'Team Chat' })
    expect(within(payroll).getAllByRole('button', { name: /^Use / })).toHaveLength(choice.groups.find(group => group.arenaId === 'payroll')!.candidates.length)
    fireEvent.click(within(payroll).getByRole('button', { name: 'Use Gusto' }))
    expect(within(chat).queryByRole('button', { name: /more|fewer/ })).toBeNull()
    fireEvent.click(within(chat).getByRole('button', { name: 'Use Slack' }))
    const step = el.container.querySelector('[id="hr_012:n4"]') as HTMLElement
    expect(within(step).getByText('Process choice')).toBeDefined()
    expect(el.container.querySelector('[id="hr_012:n1"] [aria-pressed="true"]')).toBeNull()
    fireEvent.click(within(step).getByRole('button', { name: 'Use Deel for this step' }))
    expect(el.queryByRole('button', { name: 'Graph' })).toBeNull()
    expect(el.getByRole('region', { name: 'Process overview graph' })).toBeDefined()
    expect(el.getByRole('region', { name: 'Process overview graph' })).toBeDefined()
    expect(el.getByRole('region', { name: 'Process parts' })).toBeDefined()
    expect(within(step).getByRole('button', { name: 'Use Deel for this step' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(payroll).getByRole('button', { name: 'Use Gusto' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(chat).getByRole('button', { name: 'Use Slack' }).getAttribute('aria-pressed')).toBe('true')
  })
})
