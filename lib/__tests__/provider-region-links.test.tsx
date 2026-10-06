// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import SharedProcessReader from '@/components/shared-processes/SharedProcessReader'
import { loadSharedProcesses } from '../shared-processes/load'
import { regionalDecision } from '../shared-processes/regions'
import { buildComposedComparisons } from '../shared-processes/composed-preview'
import { buildProcessProviderChoice } from '../shared-processes/provider-choice'
import type { SharedRecord } from '../shared-processes/schema'

const records = loadSharedProcesses()
const originalScroll = HTMLElement.prototype.scrollIntoView
afterEach(() => { cleanup(); vi.restoreAllMocks(); HTMLElement.prototype.scrollIntoView = originalScroll })

function reader(record: SharedRecord) {
  const comparisons = buildComposedComparisons(record, records)
  const choice = buildProcessProviderChoice(record, comparisons)!
  return { choice, ...render(<SharedProcessReader record={record} records={records} comparisons={comparisons} processChoice={choice} />) }
}

it('restores invoice anchors across repeated region switches and keeps evidence accessible when titles are plain text', () => {
  const el = reader(records.find(record => record.id === 'sales_002')!)
  const providers = within(el.getByRole('region', { name: 'Process providers' }))
  const select = (option: string) => fireEvent.click(el.container.querySelector(`input[type="radio"][value="${option}"]`)!)
  const panel = () => providers.getByRole('region', { name: 'PayPal process coverage' })
  const expand = () => fireEvent.click(providers.getByRole('button', { name: 'Show PayPal process coverage' }))
  const title = () => within(panel()).getByText('Create invoice with line items', { exact: true })
  const evidence = () => within(panel()).getByRole('link', { name: 'PayPal: Create invoice with line items coverage 90.0/100 — vendor evidence' })
  const scroll = vi.fn()
  HTMLElement.prototype.scrollIntoView = scroll
  expand()
  const href = evidence().getAttribute('href')
  expect(href).toBe('/arena/payments/product/paypal#story-verdicts')
  for (let cycle = 0; cycle < 2; cycle++) {
    expect(title().getAttribute('href')).toBe('#sales_002%3An2%3Adefault')
    fireEvent.click(title())
    expect(document.activeElement?.id).toBe('sales_002:n2:default')
    expect(scroll).toHaveBeenCalled()
    select('india-gst-irn')
    expect(document.getElementById('sales_002:n2:default')).toBeNull()
    expect(title().tagName).toBe('SPAN')
    expect(title().tabIndex).toBe(-1)
    expect(title().closest('a')).toBeNull()
    expect(evidence().getAttribute('href')).toBe(href)
    expect(panel().textContent).toContain('rated default-scope steps')
    expect(within(panel()).getByRole('link', { name: 'Look up or create customer' }).getAttribute('href')).toBe('#sales_002%3An1')
    fireEvent.click(providers.getByRole('button', { name: 'Hide PayPal process coverage' }))
    expand()
    expect(title().tagName).toBe('SPAN')
    expect(evidence().getAttribute('href')).toBe(href)
    select('default')
  }
})

it('also suppresses targets inside source-bound cards that the regional renderer unmounts', () => {
  const record = structuredClone(records.find(record => record.id === 'sales_002')!)
  record.parts[0].metadata.previewContext = { decision: 'n2', option: 'default' }
  const el = reader(record)
  fireEvent.click(el.getByRole('button', { name: 'Show PayPal process coverage' }))
  const panel = within(el.getByRole('region', { name: 'PayPal process coverage' }))
  expect(panel.getByRole('link', { name: 'Look up or create customer' })).toBeDefined()
  fireEvent.click(el.container.querySelector('input[value="india-gst-irn"]')!)
  expect(document.getElementById('sales_002:n1')).toBeNull()
  expect(panel.getByText('Look up or create customer').closest('a')).toBeNull()
  fireEvent.click(el.container.querySelector('input[value="default"]')!)
  expect(panel.getByRole('link', { name: 'Look up or create customer' })).toBeDefined()
})

it('applies hidden parent scopes to nested subprocess targets without changing their evidence', () => {
  const record = structuredClone(records.find(record => record.id === 'sales_002')!)
  const part = record.parts[0]
  part.kind = 'reference'
  part.ref = 'qs_044'
  part.metadata.previewContext = { decision: 'n2', option: 'default' }
  const el = reader(record)
  fireEvent.click(el.getByRole('button', { name: 'Show VirtualPostMail process coverage' }))
  const panel = within(el.getByRole('region', { name: 'VirtualPostMail process coverage' }))
  const href = panel.getByRole('link', { name: 'Choose mailing address provider' }).getAttribute('href')!
  expect(href).toBe('#sales_002%3An1%3Aref%3An1')
  expect(document.getElementById(decodeURIComponent(href.slice(1)))).not.toBeNull()
  fireEvent.click(el.container.querySelector('input[value="india-gst-irn"]')!)
  expect(document.getElementById(decodeURIComponent(href.slice(1)))).toBeNull()
  expect(panel.getByText('Choose mailing address provider').closest('a')).toBeNull()
  expect(panel.getByRole('link', { name: /Choose mailing address provider coverage.*vendor evidence$/ }).getAttribute('href')).toContain('/virtualpostmail#story-')
  fireEvent.click(el.container.querySelector('input[value="default"]')!)
  expect(panel.getByRole('link', { name: 'Choose mailing address provider' }).getAttribute('href')).toBe(href)
})

// Compare link behavior with the actual rendered targets for every country
// choice, including unrelated default options that must remain navigable.
for (const record of records.filter(record => regionalDecision(record))) {
  const comparisons = buildComposedComparisons(record, records)
  const choice = buildProcessProviderChoice(record, comparisons)
  if (!choice) continue
  it(`keeps breakdown navigation aligned with mounted targets for every ${record.id} region`, () => {
    const el = reader(record)
    const decision = regionalDecision(record)!
    for (const selected of [...decision.options.map(option => option.id), 'default']) {
      fireEvent.click(el.container.querySelector(`input[type="radio"][value="${selected}"]`)!)
      for (const group of choice.groups) {
        const section = el.queryByRole('region', { name: group.title })
        if (!section) continue // Its containing provider step is itself unmounted.
        const candidate = group.candidates[0]
        const toggle = section.querySelector(`button[aria-label="Show ${candidate.name} process coverage"]`)
        if (toggle) fireEvent.click(toggle)
        const panel = section.querySelector(`[role="region"][aria-label="${candidate.name} process coverage"]`)!
        for (const step of group.scores[candidate.id].steps) {
          const title = within(panel as HTMLElement).getByText(step.title, { exact: true })
          const mounted = document.getElementById(step.scope) !== null
          expect(title.tagName, `${selected}: ${step.scope}`).toBe(mounted ? 'A' : 'SPAN')
          expect(title.getAttribute('href')).toBe(mounted ? `#${encodeURIComponent(step.scope)}` : null)
          if (step.evidenceHref) {
            const evidence = within(title.closest('li')!).getByRole('link', { name: /vendor evidence$/ })
            expect(evidence.getAttribute('href')).toBe(step.evidenceHref)
          }
        }
      }
    }
  })
}
