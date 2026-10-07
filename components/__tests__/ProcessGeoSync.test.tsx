// @vitest-environment jsdom
// The detail-page ↔ index geo seam, through the ONE header control (founder 2026-10-05:
// "connect the process detail page's geo dropdown to the sitewide geo selection"; founder
// 2026-10-07: "move this into the top bar … then we don't need it per page"): a process page
// and the /processes index are both driven by the site header's country control
// (components/HeaderGeoControl.tsx) over the SAME preference — the ?geo= param + the pa-geo
// localStorage copy + the lib/geoPreference.ts per-tab store. One pick travels both ways:
//   1. detail → index: choose the UK while on a process page and the index (a later mount — the
//      store is per-tab, pa-geo is the cross-page carrier) opens in the UK view;
//   2. index → detail: choose the UK while on the index and a process page's banner leads with
//      the committed UK note;
//   3. same-tab fan-out: with both surfaces mounted, one header pick moves both (shared store);
//   4. the US-default SSR contract survives: the static HTML is byte-identical even when
//      URL/storage carry a country — the stored choice lands mount-only, and the header's
//      🌐 Global framing is server-rendered (framing only; the store stays null).
import { act, fireEvent, render, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import HeaderGeoControl from '@/components/HeaderGeoControl'
import ProcessGeoBanner from '@/components/ProcessGeoBanner'
import ProcessesTable, { type ProcessRow } from '@/components/ProcessesTable'
import { GEO_STORAGE_KEY, setGeoChoice, type GeoAnalogNote } from '@/lib/geoPreference'

// Same in-memory localStorage stand-in as components/__tests__/GeoDropdown.test.tsx.
function stubLocalStorage() {
  const store = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, String(value)),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    },
  })
}

const setUrl = (path: string) => window.history.replaceState(null, '', path)

const NOTES: GeoAnalogNote[] = [
  {
    country: 'UK',
    kind: 'analog',
    summary: 'Register a private limited company with Companies House.',
    actionUrl: 'https://www.gov.uk/limited-company-formation',
    actionLabel: 'Companies House',
  },
]

// The process DETAIL page's geo surface as the reader sees it since the top-bar move: the
// header's country control (the page mounts no dropdown of its own) over the banner that
// renders the selected country's committed story.
const DetailSurface = () => (
  <div>
    <HeaderGeoControl />
    <ProcessGeoBanner geoScope="us" notes={NOTES} />
  </div>
)

function row(over: Pick<ProcessRow, 'slug' | 'title'> & Partial<ProcessRow>): ProcessRow {
  return {
    icon: '🏦',
    phase: 'formation',
    area: 'Formation',
    areaRank: 0,
    geoScope: 'global',
    geoNotesByCountry: {},
    kind: 'process',
    trigger: null,
    urgency: null,
    pct: 50,
    agentSteps: 2,
    totalSteps: 4,
    complexity: 'medium',
    timeOrder: 1,
    cadenceLabel: 'Monthly',
    cadenceRank: 3,
    annoyance: 3,
    risk: 3,
    growthImpact: 3,
    vendors: [],
    ...over,
  }
}

// The /processes INDEX surface: the header control over the table (which mounts no dropdown of
// its own since 2026-10-07), with one global row and one US-scoped row so the UK view visibly
// filters.
const INDEX_ROWS: ProcessRow[] = [
  row({ slug: 'pick-a-name', title: 'Pick a company name', timeOrder: 1 }),
  row({
    slug: 'get-ein', title: 'Get EIN', geoScope: 'us', timeOrder: 2,
    geoNotesByCountry: { UK: { kind: 'absorbed', summary: 'HMRC posts the company a UTR automatically.' } },
  }),
]
const IndexSurface = () => (
  <div>
    <HeaderGeoControl />
    <ProcessesTable rows={INDEX_ROWS} phases={['formation']} />
  </div>
)

const trigger = (scope: { getByTitle: (t: RegExp) => HTMLElement }) => scope.getByTitle(/Where you operate/)
const pickCountry = (scope: { getByTitle: (t: RegExp) => HTMLElement; getByRole: (role: string, opts?: object) => HTMLElement }, name: string) => {
  fireEvent.click(trigger(scope))
  const list = scope.getByRole('listbox', { name: 'Country' })
  fireEvent.click(within(list).getByRole('option', { name: new RegExp(name) }) as Element)
}

beforeEach(() => {
  stubLocalStorage()
  setUrl('/processes/get-ein')
})
afterEach(() => {
  window.localStorage.clear()
  // The module-level store outlives unmounts — reset so tests stay independent (a real full
  // page load does the same; pa-geo is what persists).
  setGeoChoice(null)
})

describe('detail → index (one stored preference, founder 2026-10-05; one control, founder 2026-10-07)', () => {
  it('picking the UK in the header on a process page writes ?geo=/pa-geo, the banner leads with the committed UK note, and a fresh /processes mount opens in the UK view', () => {
    const detail = render(<DetailSurface />)
    pickCountry(detail, 'United Kingdom')
    expect(window.location.search).toBe('?geo=uk')
    expect(window.localStorage.getItem(GEO_STORAGE_KEY)).toBe('uk')
    // The banner reacts in the same tab — the committed analog leads.
    expect(detail.container.textContent).toContain('Register a private limited company with Companies House.')
    detail.unmount()

    // A later index visit: new document URL (no ?geo=), new mount, store reset as a fresh page
    // load would have it — the stored pa-geo preference is the carrier (read by the header
    // control, the one mount-time reader).
    act(() => setGeoChoice(null))
    setUrl('/processes')
    const index = render(<IndexSurface />)
    expect(trigger(index).textContent).toContain('United Kingdom')
    // The UK country view applied: the US-scoped row is out of the table — and no disclosure
    // line renders under it (founder 2026-10-05: the filter just filters; the committed UK
    // analog lives on the detail page, asserted above).
    expect([...index.container.querySelectorAll('tbody td:first-child')].some((c) => c.textContent?.includes('Get EIN'))).toBe(false)
    expect(index.container.textContent).not.toContain('hidden in the')
  })
})

describe('index → detail (the vice versa)', () => {
  it('picking the UK while on /processes stores the preference; a fresh process-page mount reads it — header trigger and banner both speak UK', () => {
    setUrl('/processes')
    const index = render(<IndexSurface />)
    pickCountry(index, 'United Kingdom')
    expect(window.localStorage.getItem(GEO_STORAGE_KEY)).toBe('uk')
    index.unmount()

    act(() => setGeoChoice(null))
    setUrl('/processes/get-ein')
    const detail = render(<DetailSurface />)
    expect(trigger(detail).textContent).toContain('United Kingdom')
    expect(detail.container.textContent).toContain('Register a private limited company with Companies House.')
  })

  it('clearing back to 🇺🇸 USA clears the stored preference — a process page returns to its US default', () => {
    setUrl('/processes')
    window.localStorage.setItem(GEO_STORAGE_KEY, 'uk')
    const index = render(<IndexSurface />)
    expect(trigger(index).textContent).toContain('United Kingdom')
    pickCountry(index, 'USA')
    expect(window.localStorage.getItem(GEO_STORAGE_KEY)).toBeNull()
    index.unmount()

    act(() => setGeoChoice(null))
    setUrl('/processes/get-ein')
    const detail = render(<DetailSurface />)
    // No stored choice: the detail page renders no banner (the US-default no-selection view).
    expect(detail.container.textContent).not.toContain('Companies House')
  })
})

describe('same-tab fan-out (the shared per-tab store)', () => {
  it('with a process page and the index both mounted, one header pick moves both surfaces', () => {
    const both = render(
      <div>
        <DetailSurface />
        <IndexSurface />
      </div>,
    )
    // Two header-control instances on screen (the test composes both surfaces) — pick in the
    // first; the shared store fans the choice out to the second.
    const triggers = both.getAllByTitle(/Where you operate/)
    fireEvent.click(triggers[0])
    const list = both.getByRole('listbox', { name: 'Country' })
    fireEvent.click(within(list).getByRole('option', { name: /United Kingdom/ }) as Element)
    // Both triggers and both surfaces agree without a reload.
    for (const t of both.getAllByTitle(/Where you operate/)) {
      expect(t.textContent).toContain('United Kingdom')
    }
    expect(both.container.textContent).toContain('Register a private limited company with Companies House.')
    expect([...both.container.querySelectorAll('tbody td:first-child')].some((c) => c.textContent?.includes('Get EIN'))).toBe(false)
  })
})

describe('the US-default SSR contract survives the top-bar move', () => {
  it('the static detail-surface HTML is byte-identical with and without a stored/URL country — the choice lands mount-only, and the header wears the Global framing (no country banner)', () => {
    const pristine = renderToString(<DetailSurface />)
    setUrl('/processes/get-ein?geo=uk')
    window.localStorage.setItem(GEO_STORAGE_KEY, 'uk')
    expect(renderToString(<DetailSurface />)).toBe(pristine)
    // The pristine HTML carries no country banner, and the header's no-selection framing is
    // 🌐 Global (founder 2026-10-07 — framing only; the US-baseline flows are unchanged).
    expect(pristine).not.toContain('Companies House')
    expect(pristine).toContain('🌐')
  })
})
