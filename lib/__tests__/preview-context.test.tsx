// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { loadSharedProcesses } from '../shared-processes/load'
import { buildVendorPreview } from '../shared-processes/vendor-preview'
import { buildStepComparisons } from '../shared-processes/step-comparisons'
import { processGraphs } from '../shared-processes/graph'
import SharedProcessReader from '@/components/shared-processes/SharedProcessReader'
const records = loadSharedProcesses()
afterEach(cleanup)

it('resolves authored vendor briefs, restores fallback, and respects an explicit step override', () => {
  const record = structuredClone(records.find(record => record.id === 'form_001')!)
  const step = record.parts.find(part => part.id === 'n6')!
  step.guidance = 'Shared formation instructions.'
  step.metadata.previewBriefs = [{ vendor: 'stripe_atlas', guidance: 'Confirm whether Atlas handles this work.' }, { vendor: 'clerky', guidance: 'Review the Clerky prepared documents.' }]
  const el = render(<SharedProcessReader record={record} records={records} vendorPreview={buildVendorPreview(record)} comparisons={buildStepComparisons(record)} />)
  const area = within(el.container.querySelector('[id="form_001:n6"]') as HTMLElement)
  const choose = (name: string) => fireEvent.click(el.getByRole('button', { name }))
  expect(area.getByText(step.guidance)).toBeDefined()
  choose('Use Stripe Atlas')
  expect(area.getByText('Confirm whether Atlas handles this work.')).toBeDefined()
  expect(area.queryByText(step.guidance)).toBeNull()
  choose('Use Clerky')
  expect(area.getByText('Review the Clerky prepared documents.')).toBeDefined()
  fireEvent.click(area.getByRole('button', { name: 'Use Stripe Atlas for this step' }))
  expect(area.getByText('Confirm whether Atlas handles this work.')).toBeDefined()
  choose('Use Firstbase')
  expect(area.getByText('Confirm whether Atlas handles this work.')).toBeDefined()
  fireEvent.click(area.getByRole('button', { name: 'Use process choice' }))
  expect(area.getByText(step.guidance)).toBeDefined()
  choose('Use Stripe Atlas')
  expect(area.getByText('Confirm whether Atlas handles this work.')).toBeDefined()
  choose('Use Stripe Atlas')
  expect(area.getByText(step.guidance)).toBeDefined()
})

it('applies explicit default context to both cards and graph without inventing cross-region edges', () => {
  const record = structuredClone(records.find(record => record.id === 'form_001')!)
  for (const part of record.parts) if (part.id !== 'n4') part.metadata.previewContext = { decision: 'n4', option: 'default' }
  const before = JSON.stringify(record)
  const graphs = processGraphs(record, records, 'germany-notary-gmbh')
  expect(graphs[0].nodes.map(node => node.id)).toEqual(['n4'])
  expect(graphs[0].edges).toEqual([])
  expect(graphs.find(graph => graph.id === 'form_001:n4:germany-notary-gmbh')?.nodes).toHaveLength(4)
  const el = render(<SharedProcessReader record={record} records={records} />)
  fireEvent.click(el.container.querySelector('input[value="germany-notary-gmbh"]')!)
  expect(el.container.querySelector('[id="form_001:n8"]')).toBeNull()
  expect(el.container.querySelector('[data-graph-node="form_001:n8"]')).toBeNull()
  expect(el.container.querySelector('[id="form_001:n4:germany-notary-gmbh:de1"]')).not.toBeNull()
  fireEvent.click(el.container.querySelector('input[value="default"]')!)
  expect(el.container.querySelector('[id="form_001:n8"]')).not.toBeNull()
  expect(JSON.stringify(record)).toBe(before)
})

it('reuses sourced metadata without treating a vendor package as a process-wide fee', () => {
  const record = records.find(record => record.id === 'form_001')!
  const el = render(<SharedProcessReader record={record} records={records} vendorPreview={buildVendorPreview(record)} />)
  const choice = within(el.container.querySelector('[id="form_001:n1"]') as HTMLElement)
  expect(choice.queryByText('$500 vendor price · as of 2026-10-01')).toBeNull()
  fireEvent.click(choice.getByRole('button', { name: 'Use Stripe Atlas' }))
  expect(choice.getByText('$500 vendor price · as of 2026-10-01')).toBeDefined()
  fireEvent.click(choice.getByRole('button', { name: 'Use Clerky' }))
  expect(choice.queryByText('$500 vendor price · as of 2026-10-01')).toBeNull()
  const filing = within(el.container.querySelector('[id="form_001:n4:default"]') as HTMLElement)
  expect(filing.getByText('$109 government fee · as of 2026-10-01')).toBeDefined()
  expect(filing.getByText('open docs:')).toBeDefined()
  expect(filing.getByText('✓ verify:')).toBeDefined()
  // The '⚠ if it goes wrong' block no longer renders on steps (founder 2026-10-05) — the
  // failureModes metadata stays in the record, display only.
  expect(filing.queryByText('⚠ if it goes wrong')).toBeNull()
  expect(el.container.querySelector('[id="form_001:n5"]')?.textContent).toContain('Certificate of Incorporation')
  // Current main renders produced artifacts only; prerequisites stay in source.
  expect(el.queryByText('Needs:')).toBeNull()
  expect(record.metadata.requires).toEqual(['company-name', 'registered-agent'])
  fireEvent.click(el.container.querySelector('input[value="uk-companies-house"]')!)
  expect(el.queryByText('$109 government fee · as of 2026-10-01')).toBeNull()
  const uk = within(el.container.querySelector('[id="form_001:n4:uk-companies-house"]') as HTMLElement)
  expect(uk.getByText('cost varies · as of 2026-10-01')).toBeDefined()
  expect(uk.queryByText('✓ verify:')).toBeNull()
})


it('renders corrected verification alongside the authored briefs while retaining source provenance', () => {
  const record = records.find(record => record.id === 'form_001')!
  const el = render(<SharedProcessReader record={record} records={records} />)
  const name = el.container.querySelector('[id="form_001:n3"]')!
  expect(name.textContent).toContain('dedicated name-availability checker')
  expect(name.querySelector('a[href="https://icis.corp.delaware.gov/Ecorp/NameReserv/NameReservation.aspx"]')).not.toBeNull()
  const filing = el.container.querySelector('[id="form_001:n4:default"]')!
  expect(filing.textContent).not.toContain('with a file number and Good Standing status')
  expect(filing.textContent).toContain('returned Certificate of Incorporation')
  const certificate = el.container.querySelector('[id="form_001:n5"]')!
  expect(certificate.textContent).not.toContain('every bank and investor')
  expect(certificate.textContent).not.toContain('accepted wherever')
  expect(record.source?.sha256).toMatch(/^[a-f0-9]{64}$/)
})
