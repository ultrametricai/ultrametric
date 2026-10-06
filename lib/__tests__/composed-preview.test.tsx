// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { loadSharedProcesses } from '../shared-processes/load'
import { buildComposedComparisons, referencedCatalog } from '../shared-processes/composed-preview'
import { buildStepComparisons } from '../shared-processes/step-comparisons'
import { buildProcessProviderChoice } from '../shared-processes/provider-choice'
import { processGraphs, graphExecutionType } from '../shared-processes/graph'
import { processSummary } from '../shared-processes/summary'
import SharedProcessReader from '@/components/shared-processes/SharedProcessReader'
const records = loadSharedProcesses()
const record = records.find(record => record.id === 'get-paid')!
afterEach(cleanup)

describe('composed canonical previews', () => {
  it('counts resolved default subprocess scopes, approvals and human work without inventing completion estimates', () => {
    expect(processSummary(record, records)).toEqual({ steps: 22, subprocesses: 4, agent: 18, approvals: 7, person: 3, manual: 1, signature: null, unverified: null, completionTime: null, automation: null, cost: null, agentCeiling: 82 })
    expect(processSummary(record).steps).toBeNull()
    const cycle = { ...record, parts: [{ ...record.parts[0], ref: record.id }] }
    expect(processSummary(cycle, [cycle]).steps).toBeNull()
    expect(referencedCatalog(cycle, [cycle])).toHaveLength(1)
    expect(buildComposedComparisons(cycle, [cycle])).toEqual({})
    expect(processGraphs(cycle, [cycle])).toHaveLength(1)
    expect(() => render(<SharedProcessReader record={cycle} records={[cycle]} />)).not.toThrow()
  })

  it('remaps exact subprocess mappings, preserving scores and distinct scoped IDs', () => {
    const comparisons = buildComposedComparisons(record, records)
    for (const part of record.parts) {
      const referenced = records.find(record => record.id === part.ref)!
      for (const [scope, comparison] of Object.entries(buildStepComparisons(referenced))) expect(comparisons[`${record.id}:${part.id}:ref${scope.slice(referenced.id.length)}`]).toEqual(comparison)
    }
    expect(Object.keys(comparisons)).toHaveLength(18)
    const graphs = processGraphs(record, referencedCatalog(record, records))
    expect(graphs[0].edges).toEqual([])
    for (const part of record.parts) expect(graphs.find(graph => graph.id === `get-paid:${part.id}:ref`)?.edges).toHaveLength(records.find(record => record.id === part.ref)!.links.length)
    const scopes = graphs.flatMap(graph => graph.nodes.map(node => node.scope))
    expect(new Set(scopes).size).toBe(scopes.length)
    const launch = records.find(record => record.id === 'company-launch')!
    const node = processGraphs(launch, records).flatMap(graph => graph.nodes).find(node => node.sourceScope === 'form_001:n3')!
    expect(graphExecutionType(node).label).toContain('unverified')
  })

  it('restores inline actions and type-specific choices with independent per-step overrides', () => {
    const comparisons = buildComposedComparisons(record, records)
    const processChoice = buildProcessProviderChoice(record, comparisons)!
    expect(processChoice.groups.map(group => group.title)).toEqual(['Accounting & Bookkeeping', 'Online Payments', 'Startup Banking'])
    const el = render(<SharedProcessReader record={record} records={records} comparisons={comparisons} processChoice={processChoice} />)
    const summary = el.container.querySelector('[aria-label="Process summary"]')!
    expect(summary.textContent).toBe('82%Agentic ceiling')
    expect(el.container.querySelectorAll('article')).toHaveLength(26)
    const bookkeeping = el.container.querySelector('[id="get-paid:part-4"]')!
    expect(bookkeeping.querySelector('h3 a')?.textContent).toBe('Bookkeeping close')
    expect(bookkeeping.querySelector('h3 a')?.getAttribute('href')).toBe('/processes/bookkeeping-close/v2')
    expect(within(bookkeeping as HTMLElement).queryByRole('link', { name: /^Open / })).toBeNull()
    expect(bookkeeping.querySelector('summary a')).toBeNull()
    const ids = [...el.container.querySelectorAll('[id]')].map(element => element.id)
    expect(new Set(ids).size).toBe(ids.length)
    const payments = el.getByRole('region', { name: 'Online Payments' })
    expect(within(payments).queryByRole('button', { name: /^\+ / })).toBeNull()
    fireEvent.click(within(payments).getByRole('button', { name: 'Use Stripe' }))
    expect(summary.textContent).toBe('82%Agentic ceiling')
    expect(el.container.querySelectorAll('article [aria-pressed="true"]').length).toBeGreaterThan(1)
    expect(el.queryByRole('button', { name: 'Graph' })).toBeNull()
    expect(el.getByRole('region', { name: 'Process overview graph' })).toBeDefined()
  const scopes = el.getByText(/^Subprocesses and option scopes/).closest('details')!
  scopes.open = true
  fireEvent(scopes, new Event('toggle'))
    expect(el.container.querySelectorAll('[data-graph-node^="get-paid:part-1:ref:"]').length).toBeGreaterThan(0)
    expect(el.getByRole('region', { name: 'Process parts' })).toBeDefined()
    expect(within(payments).getByRole('button', { name: 'Use Stripe' }).getAttribute('aria-pressed')).toBe('true')
  })
})

it('connects the embedded formation chooser to its upstream provider with independent scoped overrides', () => {
  const launch = records.find(record => record.id === 'company-launch')!
  const comparisons = buildComposedComparisons(launch, records)
  const choice = buildProcessProviderChoice(launch, comparisons)!
  const group = choice.groups.find(group => group.arenaId === 'legal-ops')!
  const el = render(<SharedProcessReader record={launch} records={records} comparisons={comparisons} processChoice={choice} />)
  const upstream = within(el.getByRole('region', { name: group.title }))
  const expand = upstream.queryByRole('button', { name: /^\+ / })
  if (expand) fireEvent.click(expand)
  const chooser = within(el.container.querySelector('[id="company-launch:part-1:ref:n1"]') as HTMLElement)
  const filing = within(el.container.querySelector('[id="company-launch:part-1:ref:n4:default"]') as HTMLElement)
  const pressed = (area: typeof chooser, name: string) => area.getByRole('button', { name }).getAttribute('aria-pressed')
  fireEvent.click(upstream.getByRole('button', { name: 'Use Clerky' }))
  expect(pressed(chooser, 'Use Clerky')).toBe('true')
  expect(pressed(filing, 'Use Clerky for this step')).toBe('true')
  fireEvent.click(upstream.getByRole('button', { name: 'Use Stripe Atlas' }))
  expect(pressed(chooser, 'Use Stripe Atlas')).toBe('true')
  expect(pressed(filing, 'Use Stripe Atlas for this step')).toBe('true')
  fireEvent.click(chooser.getByRole('button', { name: 'Use Firstbase' }))
  expect(pressed(upstream, 'Use Stripe Atlas')).toBe('true')
  expect(pressed(filing, 'Use Firstbase for this step')).toBe('true')
  fireEvent.click(filing.getByRole('button', { name: 'Use Clerky for this step' }))
  fireEvent.click(chooser.getByRole('button', { name: 'Use LegalZoom' }))
  expect(pressed(filing, 'Use Clerky for this step')).toBe('true')
  fireEvent.click(filing.getByRole('button', { name: 'Use process choice' }))
  expect(pressed(filing, 'Use LegalZoom for this step')).toBe('true')
  fireEvent.click(chooser.getByRole('button', { name: 'Use process choice' }))
  expect(pressed(chooser, 'Use Stripe Atlas')).toBe('true')
  expect(pressed(filing, 'Use Stripe Atlas for this step')).toBe('true')
  fireEvent.click(chooser.getByRole('button', { name: 'Use Stripe Atlas' }))
  expect(chooser.queryByRole('button', { name: 'Use Stripe Atlas', pressed: true })).toBeNull()
  expect(filing.queryByRole('button', { pressed: true })).toBeNull()
  fireEvent.click(chooser.getByRole('button', { name: 'Use process choice' }))
  expect(pressed(filing, 'Use Stripe Atlas for this step')).toBe('true')
  fireEvent.click(chooser.getByRole('button', { name: 'Use Northwest Registered Agent' }))
  expect(filing.queryByRole('button', { pressed: true })).toBeNull()
  const unknown = chooser.getByRole('button', { name: 'Use Northwest Registered Agent' }).closest('li')!
  expect(unknown.textContent).not.toContain('/100')
  expect(unknown.querySelector('[aria-expanded]')).toBeNull()
})
