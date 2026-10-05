// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { readSharedCatalog } from '../shared-processes/reader'
import { loadProcesses } from '../processes'
import { processAnchorContract } from '../shared-processes/compatibility'
import { regionalDecision } from '../shared-processes/regions'
import { processSelectionContract } from '../shared-processes/page-compatibility'
import { buildComposedComparisons } from '../shared-processes/composed-preview'
import { buildProcessProviderChoice } from '../shared-processes/provider-choice'
import { buildVendorPreview } from '../shared-processes/vendor-preview'
import ProcessCompatibilityBridge, { sharedSelectionKey } from '@/components/shared-processes/ProcessCompatibilityBridge'
import { RegionalOption, RegionalVariantProvider, useRegionalVariant } from '@/components/shared-processes/RegionalVariant'
import { VendorSelectionProvider, useVendorSelection } from '@/components/shared-processes/VendorSelection'
import { lensStorageKey } from '../processLens'

const records = readSharedCatalog()
const record = records.find(record => record.id === 'form_001')!
const anchors = processAnchorContract(record, records, loadProcesses().find(task => task.id === record.id))
const comparisons = buildComposedComparisons(record, records)
const choices = processSelectionContract(record, records, comparisons, buildProcessProviderChoice(record, comparisons), buildVendorPreview(record))
const decision = regionalDecision(record)

function Probe() {
  const region = useRegionalVariant()!
  const vendors = useVendorSelection()!
  return <>
    <output data-testid="region">{region.selected}</output>
    <output data-testid="picks">{JSON.stringify(vendors.picks)}</output>
    <output data-testid="overrides">{JSON.stringify(vendors.overrides)}</output>
    <button onClick={() => region.select('india-spice-plus')}>India</button>
    <button onClick={() => region.select('default')}>Default</button>
    <button onClick={() => vendors.toggle('form_001:n1', 'legal-ops/clerky')}>Clerky</button>
    <button onClick={() => vendors.override('form_001:n6', 'legal-ops/stripe-atlas')}>Step override</button>
    <section id="steps" />
    <article id="form_001:n4">
      <RegionalOption scope="form_001:n4" optionId="default" id="form_001:n4:default" heading="Default"><p>US filing</p></RegionalOption>
      <RegionalOption scope="form_001:n4" optionId="india-spice-plus" id="form_001:n4:india-spice-plus" heading="India"><p>India filing</p></RegionalOption>
    </article>
  </>
}
function tree() {
  return <RegionalVariantProvider decision={decision}><VendorSelectionProvider>
    <ProcessCompatibilityBridge recordId={record.id} anchors={anchors} choices={choices} />
    <Probe />
  </VendorSelectionProvider></RegionalVariantProvider>
}
beforeEach(() => {
  localStorage.clear()
  history.replaceState(null, '', '/processes/incorporate-c-corp')
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0))
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))
  HTMLElement.prototype.scrollIntoView = vi.fn()
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('canonical page URL, storage and history restoration', () => {
  it('restores a legacy step hash, repeated/comma via values, and unknown query values', async () => {
    history.replaceState(null, '', '/processes/incorporate-c-corp?via=payments:stripe,legal-ops:clerky&via=unrelated:keep&extra=retained#step-form_001-n4')
    const page = render(tree())
    await waitFor(() => expect(document.activeElement?.id).toBe('form_001:n4'))
    expect(page.getByTestId('picks').textContent).toContain('legal-ops/clerky')
    expect(new URLSearchParams(location.search).getAll('via')).toHaveLength(2)
    expect(location.hash).toBe('#step-form_001-n4')
    expect(location.search).toContain('extra=retained')
  })

  it('gives valid geo precedence over contradictory option hashes without pretending the target was reached', async () => {
    history.replaceState(null, '', '/processes/incorporate-c-corp?geo=IN#form_001:n4:default')
    const page = render(tree())
    await waitFor(() => expect(page.getByTestId('region').textContent).toBe('india-spice-plus'))
    expect(document.getElementById('form_001:n4:default')).toBeNull()
    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled()
    expect(location.search).toBe('?geo=IN')
    expect(location.hash).toBe('#form_001:n4:default')
  })

  it('opens a source-declared hash option with no geo, then lets the next explicit region click win', async () => {
    history.replaceState(null, '', '/processes/incorporate-c-corp#form_001%3An4%3Aindia-spice-plus')
    const page = render(tree())
    await waitFor(() => expect(document.activeElement?.id).toBe('form_001:n4:india-spice-plus'))
    fireEvent.click(page.getByText('Default', { selector: 'button' }))
    expect(page.getByTestId('region').textContent).toBe('default')
    expect(document.getElementById('form_001:n4:india-spice-plus')).toBeNull()
    expect(location.hash).toContain('india-spice-plus')
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(page.getByTestId('region').textContent).toBe('default')
  })

  it('restores old storage, persists explicit process choices, and handles Back without dropping unrelated query/hash', async () => {
    localStorage.setItem('pa-geo', 'in')
    localStorage.setItem(lensStorageKey(record.id), JSON.stringify({ picks: { 'legal-ops': 'clerky' }, names: {} }))
    history.replaceState(null, '', '/processes/incorporate-c-corp?extra=keep#steps')
    const page = render(tree())
    await waitFor(() => expect(page.getByTestId('region').textContent).toBe('india-spice-plus'))
    expect(page.getByTestId('picks').textContent).toContain('legal-ops/clerky')
    fireEvent.click(page.getByText('Default', { selector: 'button' }))
    fireEvent.click(page.getByText('Clerky', { selector: 'button' }))
    expect(page.getByTestId('picks').textContent).toBe('{}')
    expect(localStorage.getItem(sharedSelectionKey(record.id))).toBeTruthy()
    expect(location.search).toBe('?extra=keep')
    expect(location.hash).toBe('#steps')
    history.pushState(null, '', '/processes/incorporate-c-corp?geo=IN&via=legal-ops:stripe-atlas#form_001:n4:india-spice-plus')
    fireEvent.popState(window)
    await waitFor(() => expect(document.activeElement?.id).toBe('form_001:n4:india-spice-plus'))
    expect(page.getByTestId('picks').textContent).toContain('legal-ops/stripe-atlas')
  })

  it('restores a same-page encoded hash after the option was unmounted', async () => {
    const page = render(tree())
    history.pushState(null, '', '#form_001%3An4%3Aindia-spice-plus')
    fireEvent(window, new HashChangeEvent('hashchange'))
    await waitFor(() => expect(document.activeElement?.id).toBe('form_001:n4:india-spice-plus'))
    expect(page.getByTestId('region').textContent).toBe('india-spice-plus')
  })

  it('restores a step override on its history entry without applying it to a newly opened via URL', async () => {
    history.replaceState(null, '', '/processes/incorporate-c-corp?via=legal-ops:clerky')
    const page = render(tree())
    fireEvent.click(page.getByText('Step override', { selector: 'button' }))
    const entry = history.state
    expect(page.getByTestId('overrides').textContent).toContain('legal-ops/stripe-atlas')
    history.replaceState(null, '', '/processes/incorporate-c-corp?via=legal-ops:clerky')
    fireEvent.popState(window)
    expect(page.getByTestId('overrides').textContent).not.toContain('legal-ops/stripe-atlas')
    history.replaceState(entry, '', '/processes/incorporate-c-corp?via=legal-ops:clerky')
    fireEvent.popState(window)
    await waitFor(() => expect(page.getByTestId('overrides').textContent).toContain('legal-ops/stripe-atlas'))
  })
})
