// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { buildProcessProviderChoice } from '../shared-processes/provider-choice'
import { buildComposedComparisons } from '../shared-processes/composed-preview'
import { loadSharedProcesses } from '../shared-processes/load'
import { aggregateStepCoverage } from '../processRankings'
import type { StepComparisonProduct } from '../shared-processes/step-comparisons'
import SharedProcessReader from '@/components/shared-processes/SharedProcessReader'
const records = loadSharedProcesses()
afterEach(cleanup)
it('shares the existing coverage formula and preserves missing versus zero across category-scoped steps', () => {
  const record = records.find(record => record.id === 'get-paid')!
  const product = (id: string, score: number): StepComparisonProduct => ({ id: `payments/${id}`, productId: id, name: id, href: `/arena/payments/product/${id}`, hasLogo: false, score, stories: [] })
  const choice = buildProcessProviderChoice(record, {
    a: { title: 'First', storyCount: 100, products: [product('one', 80), product('zero', 0)] },
    b: { title: 'Second', storyCount: 1, products: [product('one', 40)] },
    c: { title: 'Other category', storyCount: 1, products: [{ ...product('bank', 100), id: 'banking/bank' }] },
  })!
  const group = choice.groups.find(group => group.arenaId === 'payments')!
  expect(group.stepCount).toBe(2)
  expect(group.scores['payments/one'].score).toBe(aggregateStepCoverage([80, 40], 2))
  expect(group.scores['payments/one'].score).toBe(60)
  expect(group.scores['payments/zero'].assessedSteps).toBe(1)
  expect(group.scores['payments/zero'].steps.map(step => step.score)).toEqual([0, null])
  expect(group.scores['payments/zero'].score).toBe(0)
  expect(buildProcessProviderChoice(records.find(record => record.id === 'form_001')!, {})).toBeUndefined()
})
it('shows scoped aggregate evidence independently of selection and preserves linked graph headings', () => {
  const record = records.find(record => record.id === 'get-paid')!
  const comparisons = buildComposedComparisons(record, records)
  const choice = buildProcessProviderChoice(record, comparisons)!
  const payments = choice.groups.find(group => group.arenaId === 'payments')!
  expect(payments.stepCount).toBe(12)
  expect(payments.scores['payments/stripe'].score).toBe(68.8)
  const el = render(<SharedProcessReader record={record} records={records} comparisons={comparisons} processChoice={choice} />)
  const providers = within(el.getByRole('region', { name: 'Process providers' }))
  fireEvent.click(providers.getByRole('button', { name: 'Show Stripe process coverage' }))
  expect(providers.getByRole('region', { name: 'Stripe process coverage' }).textContent).toContain('Assessed on 12 of 12')
  expect(providers.getByRole('button', { name: 'Use Stripe' }).getAttribute('aria-pressed')).toBe('false')
  fireEvent.click(providers.getByRole('button', { name: 'Use Stripe' }))
  expect(el.queryByRole('button', { name: 'Graph' })).toBeNull()
    expect(el.getByRole('region', { name: 'Process overview graph' })).toBeDefined()
  const graph = within(el.getByRole('region', { name: 'Process overview graph' }))
  expect(graph.getByRole('heading', { name: 'Get paid' }).className).toContain('sr-only')
  const scopes = el.getByText(/^Subprocesses and option scopes/).closest('details')!
  scopes.open = true
  fireEvent(scopes, new Event('toggle'))
  const link = graph.getByRole('link', { name: 'Bookkeeping close' })
  expect(link.getAttribute('href')).toBe('/processes/preview/bookkeeping-close')
  expect(el.getByRole('region', { name: 'Process parts' })).toBeDefined()
  expect(providers.getByRole('button', { name: 'Use Stripe' }).getAttribute('aria-pressed')).toBe('true')
})

it('hides default-scope aggregate scores for an unassessed regional option', () => {
  const record = records.find(record => record.id === 'sales_002')!
  const comparisons = buildComposedComparisons(record, records)
  const choice = buildProcessProviderChoice(record, comparisons)!
  const el = render(<SharedProcessReader record={record} records={records} comparisons={comparisons} processChoice={choice} />)
  const selector = el.getByRole('group', { name: 'Regional variant' })
  const alternate = selector.querySelector('input:not([value="default"])')!
  fireEvent.click(alternate)
  const providers = within(el.getByRole('region', { name: 'Process providers' }))
  expect(providers.queryByText('These scores do not assess the selected regional variant.')).toBeNull()
  expect(el.getByRole('region', { name: 'Process providers' }).querySelector('[title*="rated default-scope"]')).toBeNull()
  fireEvent.click(selector.querySelector('input[value="default"]')!)
  expect(el.getByRole('region', { name: 'Process providers' }).querySelector('[title*="rated default-scope"]')).not.toBeNull()
})
