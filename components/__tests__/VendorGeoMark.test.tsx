// @vitest-environment jsdom
// Vendor availability annotations (founder GEO ask 2026-09-28): under a non-US selection,
// vendors with a committed (vendor, country) row in jurisdictions/vendor-geo.json annotate —
// ✓/◐ inline, unavailable = muted + the row's honest note — and vendors WITHOUT a row never
// change (evidence-only, never guessed). Judged order/scores are untouched (annotation only),
// and the default view / static HTML renders no annotation at all. The unavailable pin uses the
// REAL committed evidence: mercury + UK ("US entities only").
import { act, render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import StepVendorRow, { type StepRowVendor } from '@/components/StepVendorRow'
import VendorGeoMark, { VendorGeoShade } from '@/components/VendorGeoMark'
import { setGeoSelection, type VendorGeoByCountry } from '@/lib/geoPreference'
import { vendorGeoLookup } from '@/lib/vendorGeo'

const DATA_DIR = path.resolve(__dirname, '../../data')

// The real committed evidence for the pin — loaded from jurisdictions/vendor-geo.json, so a
// silent data edit that flips the judged negative fails here too.
const MERCURY_GEO: VendorGeoByCountry = vendorGeoLookup(['mercury'], DATA_DIR).mercury

afterEach(() => setGeoSelection(null))
const select = (c: 'UK' | 'IN' | 'DE' | 'FR' | null) => act(() => setGeoSelection(c))

describe('VendorGeoMark', () => {
  it('renders nothing by default, in the static HTML, and when the vendor has no row', () => {
    expect(renderToString(<VendorGeoMark geo={MERCURY_GEO} />)).toBe('')
    const withRow = render(<VendorGeoMark geo={MERCURY_GEO} />)
    expect(withRow.container.innerHTML).toBe('')
    const noRow = render(<VendorGeoMark geo={undefined} />)
    select('UK')
    // Selection active, but no committed row → still nothing (never guessed).
    expect(noRow.container.innerHTML).toBe('')
  })

  it('mercury + UK pins the unavailable style: ✕, "not in UK", the honest note in the tooltip', () => {
    const { container } = render(<VendorGeoMark geo={MERCURY_GEO} />)
    select('UK')
    expect(container.textContent).toContain('✕')
    expect(container.textContent).toContain('not in UK')
    const mark = container.querySelector('span[title]')
    expect(mark?.getAttribute('title')).toContain('United Kingdom')
    expect(mark?.getAttribute('title')).toMatch(/United States|US/)
  })
})

describe('VendorGeoShade (leaderboard row muting)', () => {
  const row = (geo?: VendorGeoByCountry) => (
    <VendorGeoShade geo={geo} className="border-b">
      <p>Mercury row</p>
    </VendorGeoShade>
  )

  it('default: a neutral wrapper carrying only the row classes — SSR and client agree', () => {
    expect(renderToString(row(MERCURY_GEO))).toBe(renderToString(row(undefined)))
    const { container } = render(row(MERCURY_GEO))
    expect(container.firstElementChild?.className).toBe('border-b')
  })

  it('mutes ONLY on committed unavailable evidence; no row → untouched', () => {
    const withRow = render(row(MERCURY_GEO))
    const noRow = render(row(undefined))
    select('UK')
    expect(withRow.container.firstElementChild?.className).toBe('border-b opacity-50')
    expect(noRow.container.firstElementChild?.className).toBe('border-b')
    select(null)
    expect(withRow.container.firstElementChild?.className).toBe('border-b')
  })
})

describe('StepVendorRow chip annotation', () => {
  const vendor = (productId: string, name: string, score: number): StepRowVendor => ({
    productId,
    arenaId: 'startup-banking',
    arenaName: 'Startup banking',
    name,
    score,
    hasLogo: false,
    cross: false,
    citesTotal: 3,
    citesFull: 2,
    citesPartial: 1,
  })
  // Mercury first (judged order) — annotation must not re-rank it.
  const vendors = [vendor('mercury', 'Mercury', 91), vendor('relay', 'Relay', 80)]
  // Only mercury carries geo evidence here — relay stands in for a no-row vendor.
  const tree = (geo?: Record<string, VendorGeoByCountry>) => (
    <StepVendorRow vendors={vendors} untracked={[]} arenaLink={null} storyCount={3} vendorGeo={geo} />
  )

  it('byte-identical default: the geo prop changes NOTHING without a selection (SSR and client)', () => {
    expect(renderToString(tree({ mercury: MERCURY_GEO }))).toBe(renderToString(tree(undefined)))
    const withGeo = render(tree({ mercury: MERCURY_GEO }))
    const withoutGeo = render(tree(undefined))
    expect(withGeo.container.innerHTML).toBe(withoutGeo.container.innerHTML)
  })

  it('UK selected: the mercury chip mutes with ✕ + note; the row order and scores never move', () => {
    const { container } = render(tree({ mercury: MERCURY_GEO }))
    select('UK')
    // Since the founder batch 2026-10-05 the chip is a bordered container: the body is the
    // pick toggle <button aria-pressed> and the only anchors are the score receipts links
    // (#story-verdicts). The mute styling and the geo mark live on the container.
    expect([...container.querySelectorAll('a[href^="/arena/"]')].map((c) => c.getAttribute('href'))).toEqual([
      '/arena/startup-banking/product/mercury#story-verdicts',
      '/arena/startup-banking/product/relay#story-verdicts',
    ])
    const chips = [...container.querySelectorAll('button[aria-pressed]')].map(
      (b) => b.parentElement as HTMLElement,
    )
    const mercuryChip = chips[0]
    const relayChip = chips[1]
    // Annotation only — mercury still first, both scores untouched.
    expect(mercuryChip.textContent).toContain('Mercury')
    expect(relayChip.textContent).toContain('Relay')
    expect(mercuryChip.textContent).toContain('91')
    expect(mercuryChip.textContent).toContain('✕')
    expect(mercuryChip.textContent).toContain('not in UK')
    expect(mercuryChip.className).toContain('opacity-70')
    // The no-row vendor is untouched: default chip styling, no glyphs.
    expect(relayChip.textContent).not.toContain('✕')
    expect(relayChip.className).not.toContain('opacity-70')
    expect(relayChip.className).toContain('border-zinc-700')
  })

  it('back to the US default: annotations disappear and the markup matches the no-geo render', () => {
    const withGeo = render(tree({ mercury: MERCURY_GEO }))
    select('UK')
    expect(withGeo.container.textContent).toContain('not in UK')
    select(null)
    const withoutGeo = render(tree(undefined))
    expect(withGeo.container.innerHTML).toBe(withoutGeo.container.innerHTML)
  })
})
