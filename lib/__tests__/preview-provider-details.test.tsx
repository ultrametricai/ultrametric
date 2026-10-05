// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { loadSharedProcesses } from '../shared-processes/load'
import { buildVendorPreview } from '../shared-processes/vendor-preview'
import { buildStepComparisons } from '../shared-processes/step-comparisons'
import SharedProcessReader from '@/components/shared-processes/SharedProcessReader'
const records = loadSharedProcesses()
const record = records.find(record => record.id === 'form_001')!
afterEach(cleanup)

it('moves only the existing Clerky context above its filing stories without changing canonical data', () => {
  const before = JSON.stringify(record)
  const option = record.parts.find(part => part.id === 'n1')!.options.find(option => option.id === 'clerky-formation')!
  const el = render(<SharedProcessReader record={record} records={records} vendorPreview={buildVendorPreview(record)} comparisons={buildStepComparisons(record)} />)
  expect(el.queryByText('Form through Clerky', { exact: true })).toBeNull()
  const chooser = within(el.container.querySelector('[id="form_001:n1"]') as HTMLElement)
  expect(chooser.queryByText(option.summary!)).toBeNull()
  fireEvent.click(chooser.getByRole('button', { name: 'Show Clerky story evidence' }))
  const panel = chooser.getByRole('region', { name: 'Clerky story evidence' })
  expect(within(panel).getAllByText(option.summary!)).toHaveLength(1)
  const pricing = within(panel).getByText(option.summary!)
  const story = panel.querySelector('a[href*="#story-"]')!
  expect(pricing.compareDocumentPosition(story) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  const source = option.references.find(ref => ref.kind === 'url')!
  expect(panel.querySelector(`a[href="${source.kind === 'url' ? source.url : ''}"]`)).not.toBeNull()
  fireEvent.click(chooser.getByRole('button', { name: 'Show Stripe Atlas story evidence' }))
  expect(within(chooser.getByRole('region', { name: 'Stripe Atlas story evidence' })).queryByText(option.summary!)).toBeNull()
  fireEvent.click(el.container.querySelector('input[value="germany-notary-gmbh"]')!)
  expect(el.container.querySelector('[id="form_001:n1"]')).toBeNull()
  fireEvent.click(el.container.querySelector('input[value="default"]')!)
  const restored = within(el.container.querySelector('[id="form_001:n1"]') as HTMLElement)
  fireEvent.click(restored.getByRole('button', { name: 'Show Clerky story evidence' }))
  expect(restored.getAllByText(option.summary!)).toHaveLength(1)
  expect(JSON.stringify(record)).toBe(before)
})

it('removes only the innermost filing comparison card border and preserves its controls and source link', () => {
  const el = render(<SharedProcessReader record={record} records={records} vendorPreview={buildVendorPreview(record)} comparisons={buildStepComparisons(record)} />)
  const filing = el.container.querySelector('[id="form_001:n4"]')!
  const option = filing.querySelector('[id="form_001:n4:default"]')!
  const comparison = option.querySelector('[aria-label="Step product comparison"]')!
  expect(comparison.querySelector(':scope > div')?.className).toBe('overflow-hidden')
  expect(filing.className).toContain('border')
  expect(option.parentElement?.className).toContain('border')
  expect(within(comparison as HTMLElement).getByRole('button', { name: 'Use Clerky for this step' })).toBeDefined()
  expect(option.querySelector('a[href="https://corp.delaware.gov/howtoform/"]')).not.toBeNull()
})
