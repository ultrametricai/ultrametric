// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import SharedProcessReader from '@/components/shared-processes/SharedProcessReader'
import { buildProcessProviderChoice } from '../shared-processes/provider-choice'
import { buildComposedComparisons } from '../shared-processes/composed-preview'
import { loadSharedProcesses } from '../shared-processes/load'
import { resolveServiceCandidates } from '../shared-processes/service-candidates'
import { buildVendorPreview } from '../shared-processes/vendor-preview'
import type { SharedRecord } from '../shared-processes/schema'

const records = loadSharedProcesses()
const llc = records.find(record => record.id === 'form_011')!
const comparisons = buildComposedComparisons(llc, records)
const choice = buildProcessProviderChoice(llc, comparisons)!
const legal = choice.groups.find(group => group.arenaId === 'legal-ops')!
afterEach(cleanup)

it('binds the five authored LLC vendors to existing legal evidence without expanding its roster or mutating inputs', () => {
  const before = JSON.stringify({ llc, comparisons })
  const result = buildProcessProviderChoice(llc, comparisons)!
  const group = result.groups.find(group => group.arenaId === 'legal-ops')!
  expect(group.partScope).toBe('form_011:n1')
  expect(group.scope).toBe('form_011:provider:legal-ops')
  expect(result.stepScopes['form_011:n3:default']).toBe(group.scope)
  expect(group.partCandidates!.map(candidate => candidate.id)).toEqual([
    'legal-ops/legalzoom', 'legal-ops/stripe-atlas', 'legal-ops/firstbase', 'vendor/northwest', 'vendor/doola',
  ])
  expect(new Set(group.partCandidates!.map(candidate => candidate.id))).toEqual(new Set(resolveServiceCandidates(llc.parts[0].references).map(candidate => candidate.id)))
  for (const product of comparisons['form_011:n3:default'].products) {
    expect(group.scores[product.id].score).toBe(product.score)
    expect(group.scores[product.id].steps).toEqual([expect.objectContaining({ scope: 'form_011:n3:default', score: product.score })])
    expect(group.scores[product.id].evidenceHref).toBe(`${product.href}#story-verdicts`)
  }
  for (const id of ['vendor/northwest', 'vendor/doola']) expect(group.scores[id]).toBeUndefined()
  expect(JSON.stringify({ llc, comparisons })).toBe(before)
})

it('renders only the authored roster, with three independent selection controls and two unassessed nonselectable rows', () => {
  const el = render(<SharedProcessReader record={llc} records={records} comparisons={comparisons} processChoice={choice} />)
  const step = within(el.container.querySelector('[id="form_011:n1"]') as HTMLElement)
  const section = step.getByRole('region', { name: legal.title })
  expect(section.querySelectorAll(':scope > div > ul > li')).toHaveLength(5)
  expect(within(section).getAllByRole('button', { name: /^Use / }).map(button => button.getAttribute('aria-label'))).toEqual(['Use LegalZoom', 'Use Stripe Atlas', 'Use Firstbase'])
  expect(within(el.getByRole('region', { name: 'Process providers' })).queryByRole('region', { name: legal.title })).toBeNull()
  for (const name of ['Northwest Registered Agent', 'Doola']) {
    const row = within(section).getByText(name).closest('li')!
    expect(within(row).getByText('Not assessed')).toBeDefined()
    expect(row.querySelector('button, a, [title]')).toBeNull()
  }
  for (const name of ['Clerky', 'Ironclad', 'Beglaubigt.de', 'IRS']) expect(within(section).queryByText(name)).toBeNull()
  const stripe = within(section).getByRole('button', { name: 'Use Stripe Atlas' })
  fireEvent.click(within(section).getByRole('button', { name: 'Show Stripe Atlas process coverage' }))
  expect(stripe.getAttribute('aria-pressed')).toBe('false')
  const evidence = within(section).getByRole('region', { name: 'Stripe Atlas process coverage' })
  expect(within(evidence).getByRole('link', { name: /coverage 42.0\/100 — vendor evidence/ }).getAttribute('href')).toBe('/arena/legal-ops/product/stripe-atlas#story-verdicts')
  fireEvent.click(stripe)
  expect(stripe.getAttribute('aria-pressed')).toBe('true')
  expect(section.querySelector('li')?.getAttribute('data-selected-provider')).toBe('true')
  const filing = within(el.container.querySelector('[id="form_011:n3:default"]') as HTMLElement)
  expect(filing.getByRole('button', { name: 'Use Stripe Atlas for this step' }).getAttribute('aria-pressed')).toBe('true')
  expect(filing.getByText('Process choice')).toBeDefined()
  fireEvent.click(filing.getByRole('button', { name: 'Use LegalZoom for this step' }))
  expect(stripe.getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(filing.getByRole('button', { name: 'Use process choice' }))
  expect(filing.getByRole('button', { name: 'Use Stripe Atlas for this step' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(stripe)
  expect(filing.getByRole('button', { name: 'Use Stripe Atlas for this step' }).getAttribute('aria-pressed')).toBe('false')
  expect(el.container.querySelector('a a')).toBeNull()
})

it('preserves foreign/default score visibility, evidence navigation and the LLC selection across regional switches', () => {
  const el = render(<SharedProcessReader record={llc} records={records} comparisons={comparisons} processChoice={choice} />)
  const section = within(el.getByRole('region', { name: legal.title }))
  const select = section.getByRole('button', { name: 'Use LegalZoom' })
  fireEvent.click(select)
  fireEvent.click(section.getByRole('button', { name: 'Show LegalZoom process coverage' }))
  const evidence = within(section.getByRole('region', { name: 'LegalZoom process coverage' }))
  const stepTitle = comparisons['form_011:n3:default'].title!
  const scoreName = 'LegalZoom process coverage: 42/100 — vendor evidence'
  for (let i = 0; i < 2; i++) {
    expect(section.getByRole('link', { name: scoreName })).toBeDefined()
    expect(evidence.getByRole('link', { name: stepTitle }).getAttribute('href')).toBe('#form_011%3An3%3Adefault')
    fireEvent.click(el.container.querySelector('input[value="india-llp-fillip"]')!)
    expect(section.queryByRole('link', { name: scoreName })).toBeNull()
    expect(document.getElementById('form_011:n3:default')).toBeNull()
    expect(evidence.getByText(stepTitle).tagName).toBe('SPAN')
    expect(evidence.getByText('Default-scope evidence; the selected country is not assessed.')).toBeDefined()
    expect(evidence.getByRole('link', { name: /coverage 42.4\/100 — vendor evidence/ }).getAttribute('href')).toBe('/arena/legal-ops/product/legalzoom#story-verdicts')
    expect(select.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(el.container.querySelector('input[value="default"]')!)
    expect(el.container.querySelector('[id="form_011:n3:default"] [aria-label="Use LegalZoom for this step"]')?.getAttribute('aria-pressed')).toBe('true')
  }
})

it('requires one authored step, a single known category and no existing step comparison, independently of record ID', () => {
  const bound = (record: SharedRecord, overrides = comparisons) => buildProcessProviderChoice(record, overrides)!.groups.find(group => group.arenaId === 'legal-ops')!
  const unknown = structuredClone(llc)
  unknown.parts[0].references = unknown.parts[0].references.filter(ref => ref.kind === 'vendor' && ['northwest', 'doola'].includes(ref.id))
  expect(bound(unknown).partScope).toBeUndefined()
  const mixed = structuredClone(llc)
  mixed.parts[0].references.push({ kind: 'product', id: 'startup-banking/mercury', role: 'additional-candidate' })
  expect(bound(mixed).partScope).toBeUndefined()
  const duplicate = structuredClone(llc)
  duplicate.parts.push({ ...structuredClone(duplicate.parts[0]), id: 'second-chooser' })
  expect(bound(duplicate).partScope).toBeUndefined()
  const decision = structuredClone(llc)
  decision.parts[0].kind = 'decision'
  expect(bound(decision).partScope).toBeUndefined()
  expect(bound(llc, { ...comparisons, 'form_011:n1': comparisons['form_011:n3:default'] }).partScope).toBeUndefined()
  const renamed = { ...llc, id: 'synthetic-formation', title: 'Different title', slug: 'different-title' }
  const renamedComparisons = Object.fromEntries(Object.entries(comparisons).map(([scope, value]) => [scope.replace(llc.id, renamed.id), value]))
  expect(bound(renamed, renamedComparisons).partScope).toBe('synthetic-formation:n1')
})

it('preserves C-Corp, banking and government comparison candidates and scopes', () => {
  const ccorp = records.find(record => record.id === 'form_001')!
  expect(buildProcessProviderChoice(ccorp, buildComposedComparisons(ccorp, records))).toBeUndefined()
  expect(buildVendorPreview(ccorp)?.choiceScope).toBe('form_001:n1')
  for (const [arena, scope] of [['startup-banking', 'form_011:n8'], ['government-services', 'form_011:n7']]) {
    const group = choice.groups.find(group => group.arenaId === arena)!
    expect(group.partScope).toBeUndefined()
    expect(group.partCandidates).toBeUndefined()
    expect(new Set(group.candidates.map(candidate => candidate.id))).toEqual(new Set(comparisons[scope].products.map(product => product.id)))
    expect(choice.stepScopes[scope]).toBe(group.scope)
  }
  for (const id of ['growth_004', 'hr_004', 'scale_007', 'tax_011']) {
    const record = records.find(record => record.id === id)!
    const groups = buildProcessProviderChoice(record, buildComposedComparisons(record, records))!.groups
    for (const group of groups.filter(group => group.partScope)) {
      expect(group.partCandidates).toBeUndefined() // Existing fully resolved choosers retain all ranked products.
    }
  }
})
