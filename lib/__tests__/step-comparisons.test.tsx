// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { loadSharedProcesses } from '../shared-processes/load'
import { buildStepComparisons } from '../shared-processes/step-comparisons'
import { buildVendorPreview } from '../shared-processes/vendor-preview'
import { buildProcessCheckSteps } from '../processCheckData'
import { loadProcesses } from '../processes'
import { loadCategory } from '../data'
import { resolveServiceCandidates } from '../shared-processes/service-candidates'
import SharedProcessReader from '@/components/shared-processes/SharedProcessReader'

const records = loadSharedProcesses()
const record = records.find(record => record.id === 'form_001')!
const comparisons = buildStepComparisons(record)
afterEach(cleanup)

describe('canonical step comparisons', () => {
  it('includes every judged function product, exact scores and its own cited evidence', () => {
    const source = buildProcessCheckSteps(loadProcesses().find(task => task.id === record.id)!)
    expect(Object.keys(comparisons)).toEqual(['form_001:n4:default', 'form_001:n6', 'form_001:n7'])
    for (const step of source) {
      const arena = step.arenas.find(arena => arena.kind === 'function')!
      const scope = `${record.id}:${step.nodeId}${step.nodeId === 'n4' ? ':default' : ''}`
      const comparison = comparisons[scope]
      expect(comparison.products.map(p => p.productId)).toEqual(arena.vendors.filter(v => !v.shutdown).map(v => v.productId))
      for (const product of comparison.products) {
        expect(product.score).toBe(arena.vendors.find(v => v.productId === product.productId)!.score)
        const data = loadCategory(arena.arenaId)
        for (const story of product.stories) {
          const verdict = data.verdicts.find(v => v.productId === product.productId && v.storyId === story.id)!
          expect(story.rationale).toBe(verdict.rationale)
          expect(story.evidence.map(e => e.id).sort()).toEqual([...verdict.evidenceIds].sort())
        }
      }
    }
    expect(comparisons['form_001:n6'].products.map(p => p.name).sort()).toEqual(['Clerky', 'Stripe Atlas', 'Docusign', 'Beglaubigt.de', 'LegalZoom', 'Firstbase', 'Ironclad'].sort())
    expect(comparisons['form_001:n6'].storyCount).toBe(4)
    expect(comparisons['form_001:n7'].products.find(p => p.name === 'Firstbase')?.score).toBe(0)
    expect(comparisons['form_001:n5']).toBeUndefined()
    expect(buildStepComparisons({ ...record, id: 'unknown' })).toEqual({})
  })

  it('shows full comparisons without selection and scopes filing evidence to the default option', () => {
    const el = render(<SharedProcessReader record={record} records={records} comparisons={comparisons} vendorPreview={buildVendorPreview(record)} />)
    const scope = el.container.querySelector('[id="form_001:n6"]') as HTMLElement
    expect(within(scope).getAllByRole('button', { name: /Show .* story evidence/ })).toHaveLength(3)
    fireEvent.click(within(scope).getByRole('button', { name: '+ 4 more' }))
    expect(within(scope).getAllByRole('button', { name: /Show .* story evidence/ })).toHaveLength(7)
    expect(el.container.querySelectorAll('[aria-label="Step product comparison"]')).toHaveLength(3)
    expect(el.container.querySelector('[id="form_001:n4:default"] [aria-label="Step product comparison"]')).not.toBeNull()
    expect(el.container.querySelector('[id="form_001:n4:india-spice-plus"] [aria-label="Step product comparison"]')).toBeNull()
    fireEvent.click(within(scope).getByRole('button', { name: 'Show Docusign story evidence' }))
    const evidence = within(scope).getByRole('region', { name: 'Docusign story evidence' })
    expect(evidence.querySelectorAll(':scope > details')).toHaveLength(4)
    expect(within(evidence).getAllByRole('link', { name: 'View product assessment' }).every(a => a.getAttribute('href')?.startsWith('/arena/legal-ops/product/docusign#story-'))).toBe(true)
    const choice = el.container.querySelector('[id="form_001:n1"]') as HTMLElement
    expect(within(choice).queryByRole('button', { name: 'Use Docusign' })).toBeNull()
    expect(el.container.querySelector('[aria-label="Step product comparison"] [data-selected-provider]')).toBeNull()
    fireEvent.click(within(choice).getByRole('button', { name: 'Use Clerky' }))
    expect(el.container.querySelectorAll('[aria-label="Step product comparison"] [data-selected-provider]')).toHaveLength(3)
    expect(within(scope).getByText('Process choice')).toBeDefined()
    expect(within(scope).getAllByText('✓').every(mark => mark.getAttribute('aria-hidden') === 'true')).toBe(true)
    expect(within(scope).getByRole('button', { name: 'Use Clerky for this step' }).getAttribute('aria-pressed')).toBe('true')
    expect(el.container.querySelector('[data-capability-evidence]')).toBeNull() // no duplicate selected score panel
    fireEvent.click(within(scope).getByRole('button', { name: 'Hide Docusign story evidence' }))
    expect(within(choice).getByRole('button', { name: 'Use Clerky' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(choice).getByRole('button', { name: 'Use Doola' }))
    expect(el.container.querySelector('[aria-label="Step product comparison"] [data-selected-provider]')).toBeNull()
    expect(within(scope).getAllByRole('button', { name: /Show .* story evidence/ })).toHaveLength(7)
  })


  it('pins positive selected coverage, keeps zero in score order, and restores ranking on deselection', () => {
    const el = render(<SharedProcessReader record={record} records={records} comparisons={comparisons} vendorPreview={buildVendorPreview(record)} />)
    const choice = el.container.querySelector('[id="form_001:n1"]') as HTMLElement
    const bylaws = el.container.querySelector('[id="form_001:n6"]') as HTMLElement
    const stock = el.container.querySelector('[id="form_001:n7"]') as HTMLElement
    const names = (scope: HTMLElement) => within(scope).getAllByRole('link').filter(a => a.closest('[aria-label="Step product comparison"] ul') && !a.closest('[role="region"]')).map(a => a.textContent)
    fireEvent.click(within(choice).getByRole('button', { name: 'Use Firstbase' }))
    expect(names(bylaws)).toEqual(['Firstbase', ...comparisons['form_001:n6'].products.filter(p => p.name !== 'Firstbase').slice(0, 2).map(p => p.name)])
    expect(names(stock)).toEqual(comparisons['form_001:n7'].products.slice(0, 3).map(p => p.name))
    fireEvent.click(within(stock).getByRole('button', { name: '+ 4 more' }))
    expect(names(stock).at(-1)).toBe('Firstbase')
    expect(stock.querySelector('[data-selected-provider]')).toBeNull()
    expect(stock.textContent).toContain('0/100')
    fireEvent.click(within(bylaws).getByRole('button', { name: '+ 4 more' }))
    expect(names(bylaws)).toHaveLength(7)
    fireEvent.click(within(bylaws).getByRole('button', { name: 'Show fewer' }))
    expect(names(bylaws)).toHaveLength(3)
    fireEvent.click(within(choice).getByRole('button', { name: 'Use Firstbase' }))
    expect(names(bylaws)).toEqual(comparisons['form_001:n6'].products.slice(0, 3).map(p => p.name))
    for (const name of ['Doola', 'Northwest Registered Agent']) {
      const button = within(choice).queryByRole('button', { name: `Use ${name}` })
      if (button) fireEvent.click(button)
      expect(names(bylaws)).toEqual(comparisons['form_001:n6'].products.slice(0, 3).map(p => p.name))
    }
  })

  it('preserves explicit alternatives missing from a scored function comparison', () => {
    for (const [recordId, partId, optionId] of [['site_001', 'n1', 'default'], ['startup_002', 'n4', null], ['sw_001', 'n8', null]]) {
      const record = records.find(record => record.id === recordId)!
      const part = record.parts.find(part => part.id === partId)!
      const scope = `${recordId}:${partId}${optionId ? `:${optionId}` : ''}`
      const references = optionId ? part.options.find(option => option.id === optionId)!.references : part.references
      const comparisons = buildStepComparisons(record)
      const candidates = resolveServiceCandidates(references)
      const el = render(<SharedProcessReader record={record} records={records} comparisons={comparisons} />)
      const section = el.container.querySelector(`[id="${scope}"]`) as HTMLElement
      for (const candidate of candidates) {
        if (comparisons[scope].products.some(product => product.id === candidate.id)) continue
        const list = section.querySelector('[aria-label="Service options"]') as HTMLElement
        expect(list).not.toBeNull()
        expect(list.textContent).toContain(candidate.name)
        if (candidate.href) expect(list.querySelector(`a[href="${candidate.href}"]`)).not.toBeNull()
        expect(list.textContent).not.toContain('/100')
      }
      cleanup()
    }
  })

  it('covers every applicable function-mapped canonical scope across the catalog', () => {
    let scopes = 0
    let recordCount = 0
    for (const record of records) {
      const comparisons = buildStepComparisons(record)
      if (Object.keys(comparisons).length) recordCount++
      const task = loadProcesses().find(task => task.id === record.id)
      if (!task) { expect(comparisons).toEqual({}); continue }
      const expected = buildProcessCheckSteps(task).filter(step => record.parts.some(part => part.id === step.nodeId && part.kind !== 'reference'))
      expect(Object.keys(comparisons)).toHaveLength(expected.length)
      for (const step of expected) {
        const node = task.dag.nodes.find(node => node.id === step.nodeId)!
        const scope = `${record.id}:${step.nodeId}${node.methods?.length ? ':default' : ''}`
        const functionArena = step.arenas.find(arena => arena.kind === 'function')!
        expect(comparisons[scope].products.map(p => p.productId)).toEqual(functionArena.vendors.filter(v => !v.shutdown).map(v => v.productId))
        scopes++
      }
    }
    // Wave-3 situations (2026-10-02): 8 new records carry function-mapped steps (12 scopes —
    // sit_013 x4, sit_019/sit_020 x2 each, sit_014/015/017/018/022 x1 each).
    // Immigration wiring (2026-10-02): hr_011 gains its first function-mapped step (n1,
    // startup-immigration) and sit_002 adds n6 — +1 record, +2 scopes.
    expect(recordCount).toBe(130)
    expect(scopes).toBe(388)
  })

  it('works beyond the formation preview and never scores linked or unmapped parts by inheritance', () => {
    const other = records.find(record => record.id === 'fin_002')!
    const otherComparisons = buildStepComparisons(other)
    expect(Object.keys(otherComparisons).length).toBeGreaterThan(0)
    expect(buildStepComparisons(records.find(record => record.id === 'first-hire')!)).toEqual({})
    const changed = structuredClone(record)
    changed.parts.find(part => part.id === 'n4')!.options = []
    expect(buildStepComparisons(changed)['form_001:n4:default']).toBeUndefined()
  })
})
