// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import ServiceCandidateRows from '@/components/shared-processes/ServiceCandidateRows'
import { VendorSelectionProvider } from '@/components/shared-processes/VendorSelection'
import { readSharedCatalog, findSharedRecord } from '../shared-processes/reader'
import { resolveServiceCandidates } from '../shared-processes/service-candidates'

const records = readSharedCatalog()
const registeredAgent = findSharedRecord(records, 'qs_043')!
const candidates = resolveServiceCandidates(registeredAgent.parts[0].references)
afterEach(cleanup)

it('preserves the pictured registered-agent candidates and destinations when no assessment is supplied', () => {
  const source = JSON.stringify(registeredAgent)
  const el = render(<ServiceCandidateRows candidates={candidates} />)
  const list = el.getByRole('list', { name: 'Service options' })
  expect(within(list).getAllByRole('listitem')).toHaveLength(4)
  expect(within(list).getAllByRole('link').map(link => [link.getAttribute('aria-label'), link.getAttribute('href')])).toEqual(candidates.filter(candidate => candidate.href).map(candidate => [`${candidate.name} profile`, candidate.href]))
  for (const candidate of candidates) expect(within(list).getByText(candidate.name, { exact: true })).toBeDefined()
  expect(within(list).getByText('Northwest Registered Agent').closest('a')).toBeNull()
  expect(list.querySelector('button, .w-8, .w-9, .w-7')).toBeNull()
  expect(within(list).queryByText('Not assessed')).toBeNull()
  expect(document.getElementById(list.getAttribute('aria-describedby')!)?.textContent).toBe('These options have not been assessed for this step.')
  expect(list.className).toContain('border-zinc-800')
  expect([...list.children].every(row => row.className.includes('border-b'))).toBe(true)
  expect(JSON.stringify(registeredAgent)).toBe(source)
})

it('keeps assessed and unassessed rows together, including a real zero score', () => {
  const el = render(<ServiceCandidateRows candidates={candidates} />)
  expect(el.getByText('These options have not been assessed for this step.')).toBeDefined()
  el.rerender(<ServiceCandidateRows candidates={candidates} coverage={{ [candidates[0].id]: { scope: 'test:step', score: 0, storyCount: 1 } }} />)
  const list = el.getByRole('list', { name: 'Service options' })
  expect(list.getAttribute('aria-describedby')).toBeNull()
  expect(el.queryByText('These options have not been assessed for this step.')).toBeNull()
  expect(el.getAllByText('Not assessed')).toHaveLength(3)
  expect(el.getByTitle('Filing story coverage 0/100 across 1 mapped stories for the default filing option.')).toBeDefined()
  expect(list.querySelector('.w-8')).not.toBeNull()
})

it('preserves unassessed selection controls and provider detail disclosure', () => {
  const el = render(<VendorSelectionProvider><ServiceCandidateRows candidates={candidates} choiceScope="test:choice" details={{ [candidates[0].id]: <p>Existing provider detail</p> }} /></VendorSelectionProvider>)
  expect(el.queryByText('These options have not been assessed for this step.')).toBeNull()
  expect(el.getAllByRole('button', { name: /^Use / })).toHaveLength(4)
  expect(el.getAllByText('Not assessed')).toHaveLength(4)
  const selection = el.getByRole('button', { name: 'Use Firstbase' })
  fireEvent.click(el.getByRole('button', { name: 'Show Firstbase story evidence' }))
  expect(el.getByText('Existing provider detail')).toBeDefined()
  expect(selection.getAttribute('aria-pressed')).toBe('false')
  fireEvent.click(selection)
  expect(selection.getAttribute('aria-pressed')).toBe('true')
})

it('keeps nonselectable provider details available and preserves long labels and unknown identities', () => {
  const long = 'RegisteredAgentServiceWithAnUnbrokenNameForEveryJurisdictionAndQualificationState'
  const el = render(<ServiceCandidateRows candidates={[...candidates, { id: 'vendor/unknown', name: long, href: null, logoId: null }]} details={{ [candidates[0].id]: <p>Existing provider detail</p> }} />)
  expect(el.queryByText('These options have not been assessed for this step.')).toBeNull()
  fireEvent.click(el.getByRole('button', { name: 'Show Firstbase story evidence' }))
  expect(el.getByText('Existing provider detail')).toBeDefined()
  expect(el.getByText(long).closest('a')).toBeNull()
  expect(el.queryByRole('button', { name: /^Use / })).toBeNull()
})
