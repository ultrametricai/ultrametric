// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, within } from '@testing-library/react'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import StepMetadata from '@/components/shared-processes/StepMetadata'
import { ProcessOverview } from '@/components/shared-processes/ProcessViews'
import { loadSharedProcesses } from '@/lib/shared-processes/load'
import { processGraphs } from '@/lib/shared-processes/graph'
import SharedProcessReader from '@/components/shared-processes/SharedProcessReader'
import { buildStepComparisons } from '@/lib/shared-processes/step-comparisons'
import { buildVendorPreview } from '@/lib/shared-processes/vendor-preview'
import { costChipText } from '@/components/StepVerifyCost'
import { costSummary } from '@/lib/shared-processes/cost-summary'
import type { StepCost } from '@/lib/processes'

const records = loadSharedProcesses()
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('shared process presentation', () => {
  it.each<StepCost>([
    { usd: 110, kind: 'government-fee', source: 'https://example.com/filing-fees', asOf: '2026-10-01', note: '$110 minimum; additional charges depend on the filing.' },
    { usd: 0, kind: 'free', source: 'https://example.com/free', asOf: '2026-10-01' },
    { usd: null, kind: 'typical-vendor-price', source: 'https://example.com/pricing', asOf: '2026-10-01', note: 'Local fees: €50–€100 depending on service; no USD quote.' },
  ])('keeps cost text unlinked and preserves its full source and conditions in one disclosure', cost => {
    const el = render(<StepMetadata metadata={{ cost }} sourceId="form_011" records={records} />)
    const amount = el.getByText((_, node) => node?.tagName === 'P' && node.textContent === `Costs: ${costSummary(cost)}`)
    expect(amount.querySelector('a')).toBeNull()
    expect(amount.className).not.toMatch(/border|rounded/)
    const details = el.getByText('Cost details').closest('details')!
    expect(details.open).toBe(false)
    expect(el.container.querySelectorAll('details')).toHaveLength(1)
    const source = details.querySelector('a')!
    expect(source.href).toBe(cost.source)
    expect(source.className).toContain('focus-visible:')
    expect(details.textContent).toContain(cost.asOf)
    expect(details.textContent).toContain(costChipText(cost))
    if (cost.note) expect(details.textContent).toContain(cost.note)
    fireEvent.click(el.getByText('Cost details'))
    expect(details.open).toBe(true)
  })

  it.each([
    ['form_001', 'n5', null, '$50'],
    ['form_001', 'n8', null, '$5.55'],
    ['form_001', 'n4', 'default', 'From $109'],
    ['form_001', 'n4', 'uk-companies-house', 'Varies'],
    ['form_011', 'n7', null, 'Free'],
    ['prod_012', 'n1', null, '$99 / year'],
    ['legal_002', 'n5', 'default', '$350 / class'],
  ])('keeps the actual fee shape for %s:%s:%s in a compact summary', (id, partId, optionId, expected) => {
    const part = records.find(record => record.id === id)!.parts.find(part => part.id === partId)!
    const metadata = optionId ? part.options.find(option => option.id === optionId)!.metadata : part.metadata
    const cost = metadata.cost as StepCost
    const el = render(<StepMetadata metadata={metadata} sourceId={id!} records={records} />)
    expect(el.getByText((_, node) => node?.tagName === 'P' && node.textContent === `Costs: ${expected}`)).toBeDefined()
    const details = el.getByText('Cost details').closest('details')!
    expect(details.open).toBe(false)
    expect(details.textContent).toContain(cost.note)
    expect(details.textContent).toContain(cost.asOf)
    expect(details.querySelector('a')?.href).toBe(cost.source)
  })

  it('renders only real branch edges and keeps long node labels keyboard navigable', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1240)
    const record = structuredClone(records.find(item => item.id === 'form_011')!)
    record.parts[0].title = `Long formation service label ${'unbroken'.repeat(15)}`
    const scope = `${record.id}:${record.parts[0].id}`
    const graph = processGraphs(record, records)[0]
    const scroll = vi.fn()
    const el = render(<><ProcessOverview record={record} records={records} /><details><summary>Step container</summary><article id={scope}>Step details</article></details></>)
    const target = el.container.querySelector<HTMLElement>(`[id="${scope}"]`)!
    target.scrollIntoView = scroll
    const paths = [...el.container.querySelectorAll('[data-edge-from]')]
    expect(paths.map(path => [path.getAttribute('data-edge-from'), path.getAttribute('data-edge-to')])).toEqual(graph.edges.map(edge => [`${graph.id}:${edge.from}`, `${graph.id}:${edge.to}`]))
    expect(paths.every(path => path.getAttribute('marker-end'))).toBe(true)
    const button = el.getByRole('button', { name: new RegExp('^Long formation service label') })
    expect(button.className).toContain('[overflow-wrap:anywhere]')
    expect(button.className).toContain('cursor-pointer')
    expect(button.className).toContain('focus-visible:')
    fireEvent.click(button)
    expect(document.activeElement).toBe(target)
    expect(target.closest('details')!.open).toBe(true)
    expect(scroll).toHaveBeenCalledOnce()
    const region = el.getByRole('region', { name: `Dependency graph: ${record.title}` })
    expect(region.className).not.toMatch(/overflow-auto|max-h-|border/)
  })

  it('keeps the guessed-width graph out of server paint and supplies usable dependency links without hydration', () => {
    const record = records.find(item => item.id === 'form_001')!
    const el = document.createElement('div')
    el.innerHTML = renderToStaticMarkup(<ProcessOverview record={record} records={records} />)
    const pending = el.querySelector('[data-overview-measured="false"]')!
    expect(pending.className).toContain('invisible absolute')
    expect(pending.getAttribute('aria-hidden')).toBe('true')
    expect(pending.hasAttribute('inert')).toBe(true)
    const fallback = el.querySelector('[data-overview-fallback]')!
    expect(fallback.textContent).toContain('View process steps')
    expect(fallback.querySelectorAll('li')).toHaveLength(record.links.length)
    expect([...fallback.querySelectorAll('li')].map(row => [...row.querySelectorAll('a')].map(a => a.getAttribute('href')))).toEqual(record.links.map(edge => [`#${record.id}:${edge.from}`, `#${record.id}:${edge.to}`]))
    expect(fallback.querySelectorAll('a[href*="jca1"],a[href*="jmu1"]')).toHaveLength(0)
  })

  it('reveals the graph only after a measurable width and responds immediately to resize', () => {
    let width = 0
    let resize = () => {}
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width)
    vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback } observe() {} disconnect() {} })
    try {
      const record = records.find(item => item.id === 'form_011')!
      const el = render(<ProcessOverview record={record} records={records} />)
      expect(el.container.querySelector('[data-overview-fallback]')).not.toBeNull()
      width = 1240
      act(() => resize())
      expect(el.container.querySelector('[data-overview-fallback]')).toBeNull()
      const measured = el.container.querySelector<HTMLElement>('[data-overview-measured="true"]')!
      expect(measured.getAttribute('aria-hidden')).toBeNull()
      expect(measured.hasAttribute('inert')).toBe(false)
      expect(measured.style.width).toBe('1240px')
      const desktopHeight = Number.parseFloat(measured.style.height)
      width = 265
      act(() => resize())
      expect(measured.style.width).toBe('265px')
      expect(Number.parseFloat(measured.style.height)).toBeGreaterThan(desktopHeight)
      expect(el.container.querySelectorAll('[data-edge-from]')).toHaveLength(record.links.length)
    } finally { vi.unstubAllGlobals() }
  })

  it('hydrates the server fallback without a mismatch or painting guessed graph geometry', async () => {
    const record = records.find(item => item.id === 'form_001')!
    const tree = <ProcessOverview record={record} records={records} />
    const container = document.createElement('div')
    container.innerHTML = renderToString(tree)
    document.body.append(container)
    const recoverable = vi.fn()
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1240)
    let root: ReturnType<typeof hydrateRoot> | undefined
    try {
      expect(container.querySelector<HTMLElement>('[data-overview-measured]')!.style.height).toBe('0px')
      await act(async () => { root = hydrateRoot(container, tree, { onRecoverableError: recoverable }) })
      expect(recoverable).not.toHaveBeenCalled()
      expect(errors).not.toHaveBeenCalled()
      expect(container.querySelector('[data-overview-fallback]')).toBeNull()
      expect(container.querySelectorAll('[data-edge-from]')).toHaveLength(record.links.length)
      expect(container.querySelector<HTMLElement>('[data-overview-measured="true"]')!.style.width).toBe('1240px')
    } finally { act(() => root?.unmount()); container.remove() }
  })

  it('makes execution types distinct icon labels without changing their meaning or risk annotations', () => {
    const record = records.find(item => item.id === 'form_001')!
    const el = render(<SharedProcessReader record={record} records={records} />)
    for (const [node, label, symbol] of [['n1', 'Human or computer use', '♙'], ['n3', 'Agent', '✦'], ['n4', 'Manual form', '▤'], ['n7b', 'Signature — legally human', '✎']]) {
      const card = el.container.querySelector(`[id="form_001:${node}"]`)!
      const badge = card.querySelector('[title$="source route assessment"], [title^="Legacy agent classification"]')!
      expect(badge.textContent).toBe(label)
      expect(badge.querySelector('[aria-hidden="true"]')?.getAttribute('data-route-symbol')).toBe(symbol)
      expect(badge.tagName).toBe('SPAN')
      expect(badge.className).toContain('text-sm')
      expect(badge.className).toContain('rounded-lg border')
    }
    expect(el.container.querySelector('[id="form_001:n3"] [title^="Legacy agent classification"]')?.getAttribute('title')).toBe('Legacy agent classification; no verified API or tool binding')
    expect([...el.container.querySelectorAll('[title="Existing source risk assessment"]')].filter(node => node.textContent === 'High risk')).toHaveLength(6)
  })

  it('uses the detailed row spacing for source-only candidates without fabricating scores or controls', () => {
    const record = records.find(item => item.id === 'form_011')!
    const el = render(<SharedProcessReader record={record} records={records} comparisons={buildStepComparisons(record)} vendorPreview={buildVendorPreview(record)} />)
    const chooser = el.container.querySelector('[id="form_011:n1"]') as HTMLElement
    const rows = [...chooser.querySelectorAll('[aria-label="Service options"] > li')]
    expect(rows).toHaveLength(5)
    for (const row of rows) {
      expect(row.querySelector(':scope > div')?.className).toContain('min-h-12')
      expect(row.textContent).not.toContain('Not assessed')
      expect(row.textContent).not.toContain('/100')
      expect(row.querySelector('button')).toBeNull()
    }
    for (const name of ['Stripe Atlas', 'Firstbase', 'LegalZoom', 'Northwest Registered Agent', 'Doola']) expect(within(chooser).getByText(name)).toBeDefined()
    expect(within(chooser).getByRole('link', { name: 'Stripe Atlas profile' }).getAttribute('href')).toContain('/product/stripe-atlas')
    const scored = el.container.querySelector('[id="form_011:n3:default"] [aria-label="Step product comparison"]') as HTMLElement
    expect(scored).not.toBeNull()
    expect(within(scored).getAllByRole('button', { name: /^Use / }).length).toBeGreaterThan(1)
    const all = [...scored.querySelectorAll('li > div:first-child')]
    expect(all.every(row => row.className.includes('min-h-12'))).toBe(true)
    fireEvent.click(within(scored).getByRole('button', { name: 'Show LegalZoom story evidence' }))
    expect(within(scored).getByRole('region', { name: 'LegalZoom story evidence' }).querySelector('a[href*="#story-"]')).not.toBeNull()
  })
})
