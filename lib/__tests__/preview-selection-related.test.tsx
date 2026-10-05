// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { loadSharedProcesses } from '../shared-processes/load'
import { buildStepComparisons } from '../shared-processes/step-comparisons'
import { buildVendorPreview } from '../shared-processes/vendor-preview'
import { relatedProcesses } from '../shared-processes/related'
import { sharedPreviewHref } from '../shared-processes/reader'
import SharedProcessReader from '@/components/shared-processes/SharedProcessReader'
const records = loadSharedProcesses()
const corporation = records.find(record => record.id === 'form_001')!
const contractor = records.find(record => record.id === 'opp_002')!
afterEach(cleanup)
const tree = (record = corporation) => <SharedProcessReader record={record} records={records} comparisons={buildStepComparisons(record)} vendorPreview={buildVendorPreview(record)} supplementary={<section><h2>Who covers this process best</h2></section>} />

describe('step overrides and related processes', () => {
  it('keeps step selection independent, inherited choices visible, and geographic choices isolated', () => {
    const el = render(tree())
    let scope = el.container.querySelector('[id="form_001:n6"]') as HTMLElement
    fireEvent.click(el.getByRole('button', { name: 'Use Clerky' }))
    expect(within(scope).getByText('Process choice')).toBeDefined()
    fireEvent.click(within(scope).getByRole('button', { name: '+ 4 more' }))
    fireEvent.click(within(scope).getByRole('button', { name: 'Use Firstbase for this step' }))
    expect(within(scope).getByText('Selected')).toBeDefined()
    expect(el.getByRole('button', { name: 'Use Clerky' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(el.getByRole('button', { name: 'Use Stripe Atlas' }))
    expect(within(scope).getByRole('button', { name: 'Use Firstbase for this step' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(el.container.querySelector('input[type="radio"][value="germany-notary-gmbh"]')!)
    expect(el.container.querySelector('[id="form_001:n6"]')).toBeNull()
    fireEvent.click(el.container.querySelector('input[type="radio"][value="default"]')!)
    scope = el.container.querySelector('[id="form_001:n6"]') as HTMLElement
    expect(within(scope).getByRole('button', { name: 'Use Firstbase for this step' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(scope).getByRole('button', { name: 'Use process choice' }))
    expect(within(scope).getByRole('button', { name: 'Use Stripe Atlas for this step' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(scope).getByRole('button', { name: 'Use Stripe Atlas for this step' }))
    expect(scope.querySelector('[aria-pressed="true"]')).toBeNull()
    expect(el.getByRole('button', { name: 'Use Stripe Atlas' }).getAttribute('aria-pressed')).toBe('true')
    el.rerender(tree(contractor))
    expect(el.container.querySelector('article [aria-pressed="true"]')).toBeNull()
  })

  it('allows independent choices without a process-level chooser; profile and evidence actions do not select', () => {
    const el = render(tree(contractor))
    const scope = el.container.querySelector('[id="opp_002:n1"]') as HTMLElement
    const product = within(scope).getByRole('link', { name: 'Gusto' })
    product.addEventListener('click', event => event.preventDefault())
    fireEvent.click(product)
    expect(scope.querySelector('[aria-pressed="true"]')).toBeNull()
    fireEvent.click(within(scope).getByRole('button', { name: 'Show Gusto story evidence' }))
    expect(scope.querySelector('[aria-pressed="true"]')).toBeNull()
    fireEvent.click(within(scope).getByRole('button', { name: 'Use Gusto for this step' }))
    expect(within(scope).getByRole('button', { name: 'Use Gusto for this step' }).getAttribute('aria-pressed')).toBe('true')
    expect(el.container.querySelector('[id="opp_002:n3"] [aria-pressed="true"]')).toBeNull()
    expect(el.queryByText('Story coverage, not complete-service equivalence.')).toBeNull()
    expect(el.getAllByText('How coverage scores work')).toHaveLength(1)
  })

  it('renders deduplicated full related titles after coverage, without replacing executable subprocess cards', () => {
    const el = render(tree(contractor))
    const section = el.getByRole('region', { name: 'Related processes' })
    const related = relatedProcesses(contractor, records)
    expect(related.map(record => record.id)).toEqual(['go-global'])
    for (const record of related) expect(within(section).getByRole('link', { name: record.title }).getAttribute('href')).toBe(sharedPreviewHref(record.id, records))
    expect(section.querySelector('details')).toBeNull()
    expect(section.previousElementSibling?.textContent).toBe('Who covers this process best')
    expect(el.queryByText(/Connections \(/)).toBeNull()
    cleanup()
    const chain = records.find(record => record.id === 'first-hire')!
    const referenced = render(tree(chain))
    expect(referenced.container.querySelectorAll('article a[href^="/processes/preview/"]')).toHaveLength(4)
    const cloned = structuredClone(chain)
    cloned.parts.push(structuredClone(cloned.parts[0]))
    expect(new Set(relatedProcesses(cloned, records).map(record => record.id)).size).toBe(relatedProcesses(cloned, records).length)
    expect(relatedProcesses({ ...contractor, id: 'isolated', parts: [] }, records)).toEqual([])
  })
})
