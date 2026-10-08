// @vitest-environment jsdom
// WhereItWorksStrip — the "Geos supported" section on product pages (renamed from "Where it
// works", founder 2026-10-08 — display strings only), compacted to a flag row
// (founder 2026-10-07): ONLY the countries where the product works render, as small adjacent
// flags — no ticks, no pills, no per-country labels (the country name, status and committed
// note live in each flag's tooltip/sr-only text, and each flag keeps its vendor-source link).
// Committed 'unavailable' rows stay data but draw nothing; 'partial' keeps its flag muted with
// a tooltip that says partial; 🌐 Global leads when the server half derived global availability
// (every judged country committed 'available'). The US default renders flags only — no
// highlight, no inline note — and the static HTML never carries a selection (mount-only reads,
// the client-personalization contract).
import { act, render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import WhereItWorksStrip from '@/components/WhereItWorksStrip'
import { setGeoSelection, type VendorGeoStripRow } from '@/lib/geoPreference'

const row = (over: Partial<VendorGeoStripRow> & Pick<VendorGeoStripRow, 'country' | 'status'>): VendorGeoStripRow => ({
  sourceUrl: `https://vendor.example/${over.country.toLowerCase()}`,
  note: `${over.country} note.`,
  checkedAt: '2026-09-28',
  ...over,
})

// A Mercury-shaped fixture: available at home, unavailable in the UK (the pinned negative).
const MERCURY: VendorGeoStripRow[] = [
  row({ country: 'US', status: 'available', note: 'Dedicated US product.' }),
  row({
    country: 'UK',
    status: 'unavailable',
    note: 'US entities only — international founders need a US entity.',
  }),
]

// A Stripe-shaped fixture: available in four judged countries, partial in India.
const STRIPE: VendorGeoStripRow[] = [
  row({ country: 'US', status: 'available' }),
  row({ country: 'UK', status: 'available' }),
  row({ country: 'IN', status: 'partial', note: 'Invite-only onboarding for new Indian businesses.' }),
  row({ country: 'DE', status: 'available' }),
  row({ country: 'FR', status: 'available' }),
]

const flags = (container: HTMLElement) => [...container.querySelectorAll('a[target="_blank"]')]

beforeEach(() => window.history.replaceState(null, '', '/arena/startup-banking/product/mercury'))
afterEach(() => {
  window.localStorage.clear()
  setGeoSelection(null)
})

describe('the compact flag row (default view, and the static HTML)', () => {
  it('renders ONLY the working countries as flag links — the committed UK negative draws nothing — and SSR equals the default client render', () => {
    const tree = <WhereItWorksStrip rows={MERCURY} />
    expect(renderToString(tree)).toBe(renderToString(tree))
    const { container } = render(tree)
    expect(container.textContent).toContain('Geos supported')
    expect(container.textContent).not.toContain('Where it works') // renamed, founder 2026-10-08
    const links = flags(container)
    // One flag: the US (available). The unavailable UK row renders no flag, no ✕, no pill.
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['https://vendor.example/us'])
    expect(links[0].textContent).toContain('🇺🇸')
    expect(container.textContent).not.toContain('✓')
    expect(container.textContent).not.toContain('✕')
    expect(container.textContent).not.toContain('🇬🇧')
    // No per-country visible labels — the name lives in the tooltip and sr-only text.
    expect(links[0].getAttribute('title')).toContain('United States — available')
    expect(links[0].querySelector('.sr-only')?.textContent).toContain('United States')
    // No selection → no inline note, negative or otherwise.
    expect(container.textContent).not.toContain('US entities only')
  })

  it('a partial country keeps its flag, muted, with the honest partial tooltip', () => {
    const { container } = render(<WhereItWorksStrip rows={STRIPE} />)
    const india = flags(container).find((l) => l.getAttribute('href') === 'https://vendor.example/in')!
    expect(india.textContent).toContain('🇮🇳')
    expect(india.className).toContain('opacity-50')
    expect(india.getAttribute('title')).toContain('India — partial')
    expect(india.getAttribute('title')).toContain('Invite-only onboarding')
    // The available flags carry no muting.
    const us = flags(container).find((l) => l.getAttribute('href') === 'https://vendor.example/us')!
    expect(us.className).not.toContain('opacity-50')
  })

  it('🌐 Global leads the row exactly when the server half derived it; a partial-coverage product never claims it', () => {
    const withGlobal = render(<WhereItWorksStrip rows={STRIPE.map((r) => ({ ...r, status: 'available' as const }))} global />)
    const strip = withGlobal.container.querySelector('.flex.items-center.gap-1') as HTMLElement
    expect(strip.textContent!.startsWith('🌐')).toBe(true)
    expect(withGlobal.container.textContent).toContain('🌐')
    withGlobal.unmount()
    const withoutGlobal = render(<WhereItWorksStrip rows={STRIPE} />)
    expect(withoutGlobal.container.textContent).not.toContain('🌐')
  })
})

describe('under a selection (the shared store still drives the strip)', () => {
  it('the selected working country highlights and its committed note shows inline, with the source', () => {
    const { container } = render(<WhereItWorksStrip rows={STRIPE} />)
    act(() => setGeoSelection('DE'))
    const de = flags(container).find((l) => l.getAttribute('href') === 'https://vendor.example/de')
    expect(de?.className).toContain('ring-1')
    expect(container.textContent).toContain('Germany — available:')
    expect(container.textContent).toContain('source ↗')
  })

  it('a selected UNAVAILABLE country draws no flag but still tells its committed negative inline (honest, still compact)', () => {
    const { container } = render(<WhereItWorksStrip rows={MERCURY} />)
    act(() => setGeoSelection('UK'))
    expect(flags(container).some((l) => l.textContent?.includes('🇬🇧') && !l.textContent.includes('source'))).toBe(false)
    expect(container.textContent).toContain('United Kingdom — not available:')
    expect(container.textContent).toContain('US entities only — international founders need a US entity.')
  })

  it('a selected country the spike has no row for shows no note and highlights nothing (no guess)', () => {
    const { container } = render(<WhereItWorksStrip rows={MERCURY} />)
    act(() => setGeoSelection('DE'))
    expect(container.textContent).not.toContain('not available:')
    for (const flag of flags(container)) expect(flag.className).not.toContain('ring-1')
  })
})
