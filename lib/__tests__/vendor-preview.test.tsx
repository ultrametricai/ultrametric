// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { readSharedCatalog, findSharedRecord } from '../shared-processes/reader'
import { buildVendorPreview } from '../shared-processes/vendor-preview'
import { resolveServiceCandidates } from '../shared-processes/service-candidates'
import ServiceCandidateRows from '@/components/shared-processes/ServiceCandidateRows'
import { SelectedCapability, VendorSelectionProvider } from '@/components/shared-processes/VendorSelection'
import SharedProcessReader from '@/components/shared-processes/SharedProcessReader'

const records = readSharedCatalog()
const corporation = findSharedRecord(records, 'form_001')!
const preview = buildVendorPreview(corporation)!
const candidates = resolveServiceCandidates(corporation.parts[0].references)
afterEach(cleanup)

describe('local vendor preview', () => {
  it('bridges only exact supported scopes, retaining missing scores and genuine zero', () => {
    expect(Object.keys(preview.evidence)).toEqual(['form_001:n4:default', 'form_001:n6', 'form_001:n7'])
    expect(preview.evidence['form_001:n4:default'].find(v => v.name === 'Clerky')?.score).toBeGreaterThan(0)
    expect(preview.evidence['form_001:n7'].find(v => v.name === 'Firstbase')?.score).toBe(0)
    expect(Object.values(preview.evidence).flat().some(v => v.name === 'Doola')).toBe(false)
    expect(buildVendorPreview({ ...corporation, id: 'unmapped-record' })).toBeUndefined()
  })

  it('shows only default filing scores with separate select and profile targets', () => {
    for (const [id, coverage] of Object.entries(preview.coverage)) {
      const source = preview.evidence['form_001:n4:default'].find(item => item.candidateId === id)!
      expect(coverage.score).toBe(source.score)
      expect(coverage.scope).toBe('form_001:n4:default')
      expect(coverage.storyCount).toBe(3)
    }
    const el = render(<SharedProcessReader record={corporation} records={records} vendorPreview={preview} />)
    const chooser = el.container.querySelector('[id="form_001:n1"]') as HTMLElement
    expect(within(chooser).getByText('Filing coverage · /100')).toBeDefined()
    expect(chooser.querySelectorAll('button[aria-expanded]')).toHaveLength(4)
    expect(chooser.textContent).not.toContain('avg')
    expect(chooser.textContent).not.toContain('Profile')
    expect(chooser.querySelectorAll('button[aria-pressed]')).toHaveLength(6)
    for (const candidate of candidates.filter(candidate => candidate.href)) {
      const link = within(chooser).getByRole('link', { name: `${candidate.name} profile` })
      expect(link.getAttribute('href')).toBe(candidate.href)
      const select = within(chooser).getByRole('button', { name: `Use ${candidate.name}` })
      expect(select.contains(link)).toBe(false)
    }
    const ordered = [...chooser.querySelectorAll('button[aria-pressed]')].map(button => button.getAttribute('aria-label'))
    const expected = [...candidates].sort((a, b) => (preview.coverage[b.id]?.score ?? -1) - (preview.coverage[a.id]?.score ?? -1))
    expect(ordered).toEqual(expected.map(candidate => `Use ${candidate.name}`))
  })

  it('starts empty, switches, deselects, hides missing evidence and keeps choices isolated', () => {
    const el = render(<VendorSelectionProvider>
      <section aria-label="formation"><ServiceCandidateRows candidates={candidates} choiceScope="form_001:n1" /></section>
      <section aria-label="independent"><ServiceCandidateRows candidates={candidates} choiceScope="other:n1" /></section>
      <SelectedCapability choiceScope="form_001:n1" evidence={preview.evidence['form_001:n7']} />
    </VendorSelectionProvider>)
    const choices = within(screen.getByRole('region', { name: 'formation' }))
    expect(el.container.querySelector('[data-capability-evidence]')).toBeNull()
    fireEvent.click(choices.getByRole('button', { name: 'Use Clerky' }))
    expect(screen.getByText(`${preview.evidence['form_001:n7'].find(v => v.name === 'Clerky')!.score}/100`)).toBeDefined()
    expect(within(screen.getByRole('region', { name: 'independent' })).getByRole('button', { name: 'Use Clerky' }).getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(choices.getByRole('button', { name: 'Use Firstbase' }))
    expect(screen.getByText('0/100')).toBeDefined()
    expect(choices.getByRole('button', { name: 'Use Clerky' }).getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(choices.getByRole('button', { name: 'Use Doola' }))
    expect(el.container.querySelector('[data-capability-evidence]')).toBeNull()
    fireEvent.click(choices.getByRole('button', { name: 'Use Doola' }))
    expect(choices.getByRole('button', { name: 'Use Doola' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('keeps profile links independent and resets on record navigation without persistence', () => {
    const storageBefore = localStorage.length
    const tree = (key: string) => <VendorSelectionProvider key={key}><ServiceCandidateRows candidates={candidates} choiceScope={`${key}:n1`} /></VendorSelectionProvider>
    const el = render(tree('form_001'))
    const link = screen.getByRole('link', { name: 'Clerky profile' })
    link.addEventListener('click', event => event.preventDefault())
    fireEvent.click(link)
    expect(screen.getByRole('button', { name: 'Use Clerky' }).getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'Use Clerky' }))
    el.rerender(tree('other'))
    expect(screen.getByRole('button', { name: 'Use Clerky' }).getAttribute('aria-pressed')).toBe('false')
    expect(localStorage.length).toBe(storageBefore)
  })

  it('puts filing evidence only inside its default option and preserves graph content', () => {
    const el = render(<SharedProcessReader record={corporation} records={records} vendorPreview={preview} />)
    fireEvent.click(screen.getByRole('button', { name: 'Use Clerky' }))
    expect(el.container.querySelectorAll('article')).toHaveLength(12)
    expect(el.container.querySelectorAll('[data-capability-evidence]')).toHaveLength(3)
    const filing = el.container.querySelector('[id="form_001:n4"]')!
    expect(filing.querySelector('[id="form_001:n4:default"] [data-capability-evidence]')).not.toBeNull()
    expect(filing.querySelector('[id="form_001:n4:india-spice-plus"]')).toBeNull()
    expect(el.container.querySelector('[id="form_001:n1"] [data-capability-evidence]')).toBeNull()
  })
})
