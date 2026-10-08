// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { loadSharedProcesses } from '@/lib/shared-processes/load'
import { regionalDecision } from '@/lib/shared-processes/regions'
import { buildVendorPreview } from '@/lib/shared-processes/vendor-preview'
import { buildStepComparisons } from '@/lib/shared-processes/step-comparisons'
import SharedProcessReader from '@/components/shared-processes/SharedProcessReader'

const records = loadSharedProcesses()
afterEach(cleanup)
const record = (id: string) => structuredClone(records.find(record => record.id === id)!)

describe('scoped regional presentation', () => {
  it('switches only authored regional options, hides default filing scores, retains nested content and resets', () => {
    const corporation = record('form_001')
    const el = render(<SharedProcessReader record={corporation} records={records} vendorPreview={buildVendorPreview(corporation)} comparisons={buildStepComparisons(corporation)} />)
    const select = el.getByRole('group', { name: 'Select your country' })
    expect(el.queryByText(corporation.parts.find(part => part.id === 'n4')!.guidance!)).toBeNull()
    expect(el.getByText(corporation.parts.find(part => part.id === 'n4')!.options.find(option => option.id === 'default')!.summary)).toBeDefined()
    const chooser = () => el.container.querySelector('[id="form_001:n1"]')!
    expect(chooser().querySelectorAll('[title^="Filing story coverage"]')).toHaveLength(4)
    fireEvent.click(select.querySelector('input[value="germany-notary-gmbh"]')!)
    expect(el.container.querySelector('[id="form_001:n4:default"]')).toBeNull()
    expect(chooser()).toBeNull()
    expect(el.container.querySelector('[id="form_001:n4:germany-notary-gmbh"]')?.querySelectorAll('article')).toHaveLength(4)
    expect(el.container.querySelector('[id="form_001:n4:germany-notary-gmbh"] [aria-label="Step product comparison"]')).toBeNull()
    expect(el.queryByText(/Other steps have not been adapted/)).toBeNull()
    expect(el.queryByRole('definition', { name: 'Agent' })).toBeNull()
    fireEvent.click(select.querySelector('input[value="default"]')!)
    expect(chooser().querySelectorAll('[title^="Filing story coverage"]')).toHaveLength(4)
    expect(el.container.querySelector('[id="form_001:n4:default"]')).not.toBeNull()
    fireEvent.click(select.querySelector('input[value="uk-companies-house"]')!)
    el.rerender(<SharedProcessReader record={record('opp_002')} records={records} />)
    expect((el.container.querySelector('input[value="default"]') as HTMLInputElement).checked).toBe(true)
  })

  it('visibly qualifies UK/EU banking while unadapted application steps remain, and clears the warning on default', () => {
    const banking = record('qs_023')
    const el = render(<SharedProcessReader record={banking} records={records} />)
    expect(el.queryByText(/Other steps have not been adapted/)).toBeNull()
    fireEvent.click(el.container.querySelector('input[value="uk-eu-multicurrency"]')!)
    const warning = el.getByText(/Other steps have not been adapted/)
    expect(warning.className).toBe('text-sm text-zinc-400')
    expect(warning.closest('fieldset')?.getAttribute('aria-describedby')).toBe(warning.id)
    expect(el.container.querySelector('[id="qs_023:n3"]')?.textContent).toContain('EIN')
    expect(el.container.querySelector('[id="qs_023:n5"]')).not.toBeNull()
    expect(regionalDecision(banking)?.options.find(option => option.id === 'uk-eu-multicurrency')?.hasUnadaptedSteps).toBe(true)
    fireEvent.click(el.container.querySelector('input[value="default"]')!)
    expect(el.queryByText(/Other steps have not been adapted/)).toBeNull()
    expect(regionalDecision(record('form_001'))?.options.every(option => !option.hasUnadaptedSteps)).toBe(true)
  })

  it('preserves non-geographic choices and does not assume one country per option', () => {
    const payroll = render(<SharedProcessReader record={record('qs_063')} records={records} />)
    expect(payroll.container.querySelector('[id="qs_063:n3:eor-international"] summary')).not.toBeNull()
    fireEvent.click(payroll.container.querySelector('input[type="radio"][value="uk-paye-rti"]')!)
    expect(payroll.container.querySelector('[id="qs_063:n3:uk-paye-rti"]')?.querySelectorAll('article')).toHaveLength(3)
    expect(payroll.container.querySelector('[id="qs_063:n3:eor-international"] summary')).not.toBeNull()
    const multi = regionalDecision(record('qs_023'))!
    expect(multi.options.filter(option => option.id === 'uk-eu-multicurrency')).toHaveLength(1)
    expect(multi.options.find(option => option.id === 'uk-eu-multicurrency')?.countries).toEqual(['UK', 'DE', 'FR'])
    expect(regionalDecision(record('form_001'))?.options.find(option => option.id === 'default')?.countries).toEqual(['US'])
    expect(records.filter(record => regionalDecision(record))).toHaveLength(18)
  })

  it('shows source-supported agent and approval classifications without inferring missing or non-agent settings', () => {
    const contractor = record('opp_002')
    contractor.parts[0].metadata.approvalRequired = true
    contractor.parts[2].metadata.approvalRequired = false
    const el = render(<SharedProcessReader record={contractor} records={[contractor]} />)
    expect(el.getByRole('heading', { level: 1 }).textContent).toBe('Add a contractor (1099)')
    expect(el.container.querySelector('[id="opp_002:n1"]')?.textContent).toContain('Needs approval')
    expect(el.container.querySelector('[id="opp_002:n3"]')?.textContent).toContain('Automatic')
    expect(el.getByText('Agentic ceiling')).toBeDefined()
    expect(el.container.querySelector('[id="opp_002:n2:default"]')?.textContent).not.toContain('Automatic')
    fireEvent.click(el.container.querySelector('input[type="radio"][value="india-pan-tds"]')!)
    expect(el.queryByText('Agentic ceiling')).toBeNull()
    expect(el.container.querySelector('[aria-label="Process summary"]')).toBeNull()
    expect(el.getByRole('heading', { level: 1 }).textContent).toBe(contractor.title)
    cleanup()
    const original = render(<SharedProcessReader record={record('opp_002')} records={records} />)
    expect(original.queryByText('Automatic')).toBeNull()
    expect(original.queryByText('Needs approval')).toBeNull()
  })

  it('restores irreversibility independently of risk and only on its exact scope', () => {
    const corporation = record('form_001')
    corporation.parts.find(part => part.id === 'n4')!.options.find(option => option.id === 'default')!.metadata.reversibility = 'irreversible'
    const el = render(<SharedProcessReader record={corporation} records={records} />)
    const filing = el.container.querySelector('[id="form_001:n4"]')!
    expect(filing.querySelector(':scope > div:first-child')?.textContent).toContain('Irreversible')
    expect(filing.querySelector('[id="form_001:n4:default"]')?.textContent).not.toContain('Irreversible')
    expect(el.container.querySelector('[id="form_001:n1"]')?.textContent).not.toContain('Irreversible')
    fireEvent.click(el.container.querySelector('input[type="radio"][value="india-spice-plus"]')!)
    expect(within(filing as HTMLElement).queryByText('Irreversible')).toBeNull()
    cleanup()
    const simple = record('opp_002')
    simple.parts = [{ ...simple.parts[0], metadata: { route: 'form', reversibility: 'irreversible', riskLevel: 'low', approvalRequired: true } }]
    simple.links = []
    const low = render(<SharedProcessReader record={simple} records={[simple]} />)
    expect(low.getByText('Irreversible')).toBeDefined()
    expect(low.queryByText('High risk')).toBeNull()
    expect(low.queryByText('Needs approval')).toBeNull()
  })
})

// Exercise every authored country choice, including records with unresolved
// downstream applicability. A selected country must not inherit default totals.
for (const source of records.filter(record => regionalDecision(record))) {
  it(`qualifies regional choices and suppresses default totals for ${source.id}`, () => {
    const decision = regionalDecision(source)!
    const el = render(<SharedProcessReader record={source} records={records} />)
    for (const option of decision.options.filter(option => option.id !== 'default')) {
      fireEvent.click(el.container.querySelector(`input[type="radio"][value="${option.id}"]`)!)
      expect(el.container.querySelector('[aria-label="Process summary"]')).toBeNull()
      const warning = el.queryByText(/Other steps have not been adapted/)
      if (option.hasUnadaptedSteps) {
        expect(warning?.className).toBe('text-sm text-zinc-400')
      } else {
        expect(warning).toBeNull()
      }
      const selected = el.container.querySelector(`[id="${decision.scope}:${option.id}"]`)!
      expect(selected).not.toBeNull()
      expect(selected.className).toBe('min-w-0 space-y-3')
      expect(selected.parentElement?.className).toBe('space-y-3')
      const sourcePart = source.parts.find(part => `${source.id}:${part.id}` === decision.scope)!
      const sourceOption = sourcePart.options.find(candidate => candidate.id === option.id)!
      expect(selected.textContent).toContain(sourceOption.summary)
      expect(selected.querySelectorAll('article')).toHaveLength(sourceOption.parts.length)
      if (source.id !== 'form_001' && sourcePart.guidance) expect(el.getByText(sourcePart.guidance)).toBeDefined()
      expect(el.container.querySelector(`[id="${decision.scope}:default"]`)).toBeNull()
    }
    fireEvent.click(el.container.querySelector('input[type="radio"][value="default"]')!)
    expect(el.queryByText(/Other steps have not been adapted/)).toBeNull()
  })
}
