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
  expect(filing.queryByText('✓ verify:')).toBeNull()
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


it('omits verification and failure displays while retaining authored guidance and source metadata', () => {
  const record = records.find(record => record.id === 'form_001')!
  const el = render(<SharedProcessReader record={record} records={records} />)
  const name = el.container.querySelector('[id="form_001:n3"]')!
  expect(name.textContent).toContain('dedicated name checker')
  expect(el.queryByText('✓ verify:')).toBeNull()
  expect(el.queryByText('⚠ if it goes wrong')).toBeNull()
  expect(record.parts.find(part => part.id === 'n3')?.metadata.verify).toBeDefined()
  expect(record.parts.find(part => part.id === 'n3')?.metadata.failureModes).toBeDefined()
  expect(name.querySelector('a[href="https://icis.corp.delaware.gov/Ecorp/NameReserv/NameReservation.aspx"]')).not.toBeNull()
  const filing = el.container.querySelector('[id="form_001:n4:default"]')!
  expect(filing.textContent).not.toContain('with a file number and Good Standing status')
  expect(filing.textContent).toContain('Retain submission evidence')
  const certificate = el.container.querySelector('[id="form_001:n5"]')!
  expect(certificate.textContent).not.toContain('every bank and investor')
  expect(certificate.textContent).not.toContain('accepted wherever')
  expect(record.source?.sha256).toMatch(/^[a-f0-9]{64}$/)
})

it('places existing source links and open documents together after vendors without empty columns', () => {
  const record = records.find(record => record.id === 'form_001')!
  const el = render(<SharedProcessReader record={record} records={records} comparisons={buildStepComparisons(record)} />)
  const heading = el.getByRole('heading', { name: 'Process Steps', level: 2 })
  expect(el.getAllByRole('heading', { name: 'Process Steps' })).toHaveLength(1)
  expect(heading.compareDocumentPosition(el.container.querySelector('[aria-label="Process parts"] article')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(within(el.getByRole('region', { name: 'Process overview graph' })).queryByText('Produces:')).toBeNull()
  const certificate = within(el.container.querySelector('[id="form_001:n5"]') as HTMLElement).getByText('Certificate of Incorporation', { exact: true })
  expect(certificate.closest('article')?.id).toBe('form_001:n5')
  const step = el.container.querySelector('[id="form_001:n6"]')!
  const vendors = step.querySelector('[aria-label="Step product comparison"]')!
  const resources = step.querySelector('[data-step-resources]')!
  const disclosure = resources.closest('details')!
  expect(disclosure.open).toBe(false)
  expect(disclosure.querySelector('summary')?.textContent).toBe('Resources')
  fireEvent.click(disclosure.querySelector('summary')!)
  expect(disclosure.open).toBe(true)
  expect(vendors.compareDocumentPosition(resources) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(resources.querySelector('[aria-label="Related links"]')?.querySelectorAll('a')).toHaveLength(3)
  expect(within(resources as HTMLElement).getByText('open docs:')).toBeDefined()
  expect(resources.children).toHaveLength(2)
  expect(resources.querySelectorAll('a')).toHaveLength(5)
  const linksOnly = el.container.querySelector('[id="form_001:n3"] [data-step-resources]')!
  expect(linksOnly.children).toHaveLength(1)
  expect(linksOnly.querySelector('[aria-label="Related links"]')).not.toBeNull()
  const docs = record.parts.find(part => part.id === 'n6')!.metadata.documents
  expect(Array.isArray(docs) && docs.length).toBe(2)
})

it('omits empty resources and resets a single disclosure to the current regional links', () => {
  const record = structuredClone(records.find(record => record.id === 'form_001')!)
  const name = record.parts.find(part => part.id === 'n3')!
  name.references = []
  name.metadata.documents = []
  const el = render(<SharedProcessReader record={record} records={records} />)
  expect(within(el.container.querySelector('[id="form_001:n3"]') as HTMLElement).queryByText('Resources')).toBeNull()
  const filing = el.container.querySelector('[id="form_001:n4"]') as HTMLElement
  const links = () => [...filing.querySelectorAll('[data-step-resources] a')].map(link => link.getAttribute('href'))
  const initial = links()
  const resources = () => within(filing).getByText('Resources').closest('details')!
  expect(filing.querySelectorAll('[data-step-resources]')).toHaveLength(1)
  fireEvent.click(resources().querySelector('summary')!)
  expect(resources().open).toBe(true)
  for (let i = 0; i < 2; i++) {
    fireEvent.click(el.container.querySelector('input[value="uk-companies-house"]')!)
    expect(filing.querySelectorAll('[data-step-resources]')).toHaveLength(1)
    expect(resources().open).toBe(false)
    expect(links()).not.toEqual(initial)
    expect(links()).toContain('https://www.gov.uk/limited-company-formation/register-your-company')
    expect(filing.querySelector('[id="form_001:n4:default"]')).toBeNull()
    fireEvent.click(resources().querySelector('summary')!)
    expect(resources().open).toBe(true)
    fireEvent.click(el.container.querySelector('input[value="default"]')!)
    expect(resources().open).toBe(false)
    expect(links()).toEqual(initial)
  }
})
