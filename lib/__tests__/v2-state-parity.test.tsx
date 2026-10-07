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
import ProcessCompatibilityBridge from '@/components/shared-processes/ProcessCompatibilityBridge'
import { RegionalOption, RegionalVariantProvider, useRegionalVariant } from '@/components/shared-processes/RegionalVariant'
import { VendorSelectionProvider, useVendorSelection } from '@/components/shared-processes/VendorSelection'
import { getGeoSelection } from '../geoPreference'
import { STACK_KEY, writeStack } from '../myStack'
import { act } from 'react'
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
    <button onClick={() => region.selectCountry('PT')}>Portugal</button>
    <button onClick={() => region.selectCountry('CA')}>Canada</button>
    <output data-testid="country">{region.country}</output>
    <output data-testid="region">{region.selected}</output>
    <output data-testid="picks">{JSON.stringify(vendors.picks)}</output>
    <output data-testid="overrides">{JSON.stringify(vendors.overrides)}</output>
    <button onClick={() => region.select('india-spice-plus')}>India</button>
    <button onClick={() => region.select('default')}>Default</button>
    <button onClick={() => vendors.toggle('form_001:n1', 'legal-ops/clerky')}>Clerky</button>
    <button onClick={() => vendors.override('form_001:n6:regional:form_001:n4:india-spice-plus', 'legal-ops/stripe-atlas')}>Regional override</button>
    <button onClick={() => vendors.override('form_001:n6', 'legal-ops/stripe-atlas')}>Step override</button>
    <button onClick={() => vendors.override('form_001:n7', 'legal-ops/firstbase')}>Zero-score choice</button>
    <RegionalOption scope="form_001:n6" optionId="method" id="form_001:n6" heading="Method details"><p>Method content</p></RegionalOption>
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
  history.replaceState(null, '', '/processes/incorporate-c-corp/v2')
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0))
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))
  HTMLElement.prototype.scrollIntoView = vi.fn()
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('v2 URL, storage and history restoration', () => {
  it('restores a legacy step hash, repeated/comma via values, and unknown query values', async () => {
    history.replaceState(null, '', '/processes/incorporate-c-corp/v2?via=payments:stripe,legal-ops:clerky&via=unrelated:keep&extra=retained#step-form_001-n4')
    const page = render(tree())
    await waitFor(() => expect(document.activeElement?.id).toBe('form_001:n4'))
    expect(page.getByTestId('picks').textContent).toContain('legal-ops/clerky')
    expect(new URLSearchParams(location.search).getAll('via')).toHaveLength(2)
    expect(location.hash).toBe('#step-form_001-n4')
    expect(location.search).toContain('extra=retained')
  })

  it('gives valid geo precedence over contradictory option hashes without pretending the target was reached', async () => {
    history.replaceState(null, '', '/processes/incorporate-c-corp/v2?geo=IN#form_001:n4:default')
    const page = render(tree())
    await waitFor(() => expect(page.getByTestId('region').textContent).toBe('india-spice-plus'))
    expect(document.getElementById('form_001:n4:default')).toBeNull()
    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled()
    expect(location.search).toBe('?geo=IN')
    expect(location.hash).toBe('#form_001:n4:default')
  })

  it('opens a source-declared hash option with no geo, then lets the next explicit region click win', async () => {
    history.replaceState(null, '', '/processes/incorporate-c-corp/v2#form_001%3An4%3Aindia-spice-plus')
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
    history.replaceState(null, '', '/processes/incorporate-c-corp/v2?extra=keep#steps')
    const page = render(tree())
    await waitFor(() => expect(page.getByTestId('region').textContent).toBe('india-spice-plus'))
    expect(page.getByTestId('picks').textContent).toContain('legal-ops/clerky')
    fireEvent.click(page.getByText('Default', { selector: 'button' }))
    fireEvent.click(page.getByText('Clerky', { selector: 'button' }))
    expect(page.getByTestId('picks').textContent).toBe('{}')
    expect(history.state.paProcessSelection.recordId).toBe(record.id)
    expect(location.search).toBe('?extra=keep')
    expect(location.hash).toBe('#steps')
    history.pushState(null, '', '/processes/incorporate-c-corp/v2?geo=IN&via=legal-ops:stripe-atlas#form_001:n4:india-spice-plus')
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
    history.replaceState(null, '', '/processes/incorporate-c-corp/v2?via=legal-ops:clerky')
    const page = render(tree())
    fireEvent.click(page.getByText('Step override', { selector: 'button' }))
    const entry = history.state
    const entryUrl = location.href
    expect(page.getByTestId('overrides').textContent).toContain('legal-ops/stripe-atlas')
    history.replaceState(null, '', '/processes/incorporate-c-corp/v2?via=legal-ops:clerky')
    fireEvent.popState(window)
    expect(page.getByTestId('overrides').textContent).not.toContain('legal-ops/stripe-atlas')
    history.replaceState(entry, '', entryUrl)
    fireEvent.popState(window)
    await waitFor(() => expect(page.getByTestId('overrides').textContent).toContain('legal-ops/stripe-atlas'))
  })
})


it('restores country, provider, step override and method disclosure after a refresh remount', async () => {
  let page = render(tree())
  fireEvent.click(page.getByText('Clerky', { selector: 'button' }))
  fireEvent.click(page.getByText('Step override', { selector: 'button' }))
  fireEvent.click(page.getByText('Portugal', { selector: 'button' }))
  const details = document.getElementById('form_001:n6') as HTMLDetailsElement
  details.open = true
  fireEvent(details, new Event('toggle'))
  expect(getGeoSelection()).toBe('PT')
  expect(page.getByTestId('region').textContent).toBe('default')
  const originalUrl = location.href
  page.unmount()
  page = render(tree())
  await waitFor(() => expect(page.getByTestId('country').textContent).toBe('PT'))
  expect(page.getByTestId('picks').textContent).toContain('legal-ops/clerky')
  expect(page.getByTestId('overrides').textContent).toContain('legal-ops/stripe-atlas')
  expect((document.getElementById('form_001:n6') as HTMLDetailsElement).open).toBe(true)
  expect(location.href).toBe(originalUrl)
  expect(Object.keys(localStorage).some(key => key.startsWith('pa-shared'))).toBe(false)
})

it('restores Back/Forward snapshots including a cleared/default country despite later storage', () => {
  const page = render(tree())
  fireEvent.click(page.getByText('Clerky', { selector: 'button' }))
  const us = { state: history.state, url: location.href }
  history.pushState(null, '', '/processes/incorporate-c-corp/v2?geo=ca&via=legal-ops:stripe-atlas')
  fireEvent.popState(window)
  expect(page.getByTestId('country').textContent).toBe('CA')
  const canada = { state: history.state, url: location.href }
  localStorage.setItem('pa-geo', 'ca')
  history.replaceState(us.state, '', us.url); fireEvent.popState(window)
  expect(page.getByTestId('country').textContent).toBe('')
  expect(page.getByTestId('picks').textContent).toContain('legal-ops/clerky')
  history.replaceState(canada.state, '', canada.url); fireEvent.popState(window)
  expect(page.getByTestId('country').textContent).toBe('CA')
  expect(page.getByTestId('picks').textContent).toContain('legal-ops/stripe-atlas')
})

it('uses current account changes and falls back from an invalid URL vendor without creating a second store', () => {
  localStorage.setItem(STACK_KEY, JSON.stringify({ 'legal-ops': ['clerky'] }))
  history.replaceState(null, '', '/processes/incorporate-c-corp/v2?via=legal-ops:missing&geo=XX&keep=one&keep=two')
  const page = render(tree())
  expect(page.getByTestId('overrides').textContent).toContain('legal-ops/clerky')
  expect(getGeoSelection()).toBe(null)
  act(() => writeStack({ 'legal-ops': ['stripe-atlas'] }))
  expect(page.getByTestId('overrides').textContent).toContain('legal-ops/stripe-atlas')
  expect(new URLSearchParams(location.search).getAll('keep')).toEqual(['one', 'two'])
})

it('keeps explicit PT context when the hash requests a different authored country', async () => {
  history.replaceState(null, '', '/processes/incorporate-c-corp/v2?geo=pt#form_001:n4:india-spice-plus')
  const page = render(tree())
  await waitFor(() => expect(page.getByTestId('country').textContent).toBe('PT'))
  expect(page.getByTestId('region').textContent).toBe('default')
  expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled()
  expect(location.hash).toBe('#form_001:n4:india-spice-plus')
})


it('preserves a scoped regional vendor override on refresh and returns to the same default choice', () => {
  let page = render(tree())
  fireEvent.click(page.getByText('Clerky', { selector: 'button' }))
  fireEvent.click(page.getByText('India', { selector: 'button' }))
  fireEvent.click(page.getByText('Regional override', { selector: 'button' }))
  page.unmount(); page = render(tree())
  expect(page.getByTestId('region').textContent).toBe('india-spice-plus')
  expect(JSON.parse(page.getByTestId('overrides').textContent!)).toMatchObject({ 'form_001:n6:regional:form_001:n4:india-spice-plus': 'legal-ops/stripe-atlas' })
  fireEvent.click(page.getByText('Default', { selector: 'button' }))
  expect(page.getByTestId('picks').textContent).toContain('legal-ops/clerky')
})

it('preserves explicit process and step choices through account synchronization', () => {
  const page = render(tree())
  fireEvent.click(page.getByText('Clerky', { selector: 'button' }))
  fireEvent.click(page.getByText('Step override', { selector: 'button' }))
  act(() => writeStack({ 'legal-ops': ['firstbase'] }))
  expect(JSON.parse(page.getByTestId('picks').textContent!)).toMatchObject({ 'form_001:n1': 'legal-ops/clerky' })
  expect(JSON.parse(page.getByTestId('overrides').textContent!)).toMatchObject({ 'form_001:n6': 'legal-ops/stripe-atlas' })
})

it('restores a cached Back entry before queued cross-document storage events', () => {
  const page = render(tree())
  fireEvent.click(page.getByText('Clerky', { selector: 'button' }))
  fireEvent.click(page.getByText('Step override', { selector: 'button' }))
  const url = location.href
  localStorage.setItem(lensStorageKey(record.id), JSON.stringify({ picks: { 'legal-ops': 'clerky' }, names: {} }))
  fireEvent(window, new PageTransitionEvent('pageshow', { persisted: true }))
  fireEvent(window, new StorageEvent('storage', { key: lensStorageKey(record.id), newValue: localStorage.getItem(lensStorageKey(record.id)) }))
  fireEvent(window, new StorageEvent('storage', { key: 'pa-geo', newValue: 'in' }))
  expect(location.href).toBe(url)
  expect(JSON.parse(page.getByTestId('picks').textContent!)).toMatchObject({ 'form_001:n1': 'legal-ops/clerky' })
  expect(JSON.parse(page.getByTestId('overrides').textContent!)).toMatchObject({ 'form_001:n6': 'legal-ops/stripe-atlas' })
})

it('remembers an explicit zero-score row without promoting it to assessed positive coverage', () => {
  let page = render(tree())
  fireEvent.click(page.getByText('Zero-score choice', { selector: 'button' }))
  page.unmount(); page = render(tree())
  expect(JSON.parse(page.getByTestId('overrides').textContent!)).toMatchObject({ 'form_001:n7': 'legal-ops/firstbase' })
  expect(choices.steps.find(step => step.scope === 'form_001:n7')!.candidates).not.toContain('legal-ops/firstbase')
})
