// @vitest-environment jsdom
// THE sitewide country control (founder 2026-10-07: "move this into the top bar so the user
// can set their country or default to global, then we don't need it per page"). The pins:
//   1. it renders in the site layout's header — desktop at nav weight next to the ⌘K/account
//      cluster, and in the MobileNav panel below sm — with the 🌐 Global display default
//      server-rendered, and the layout's static HTML byte-identical whatever ?geo=/pa-geo carry
//      (the US-default SSR contract);
//   2. ONE control drives the pages: a country picked in the header surfaces a process page's
//      committed banner AND applies the /processes country filter (the per-page GeoDropdown
//      mounts are gone — the pages adapt through the same shared store);
//   3. semantics unchanged and honest: no selection/Global = full corpus + US-baseline flows
//      (the store stays null under the Global framing); an explicit country = the
//      filtered/adapted views, written through the committed ?geo=/pa-geo codec.
import { fireEvent, render, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// app/layout.tsx imports next/font (build-time only) and client components that call
// next/navigation hooks — stub both so the REAL layout renders under vitest.
vi.mock('next/font/google', () => ({
  Inter: () => ({ variable: 'font-inter' }),
  Geist_Mono: () => ({ variable: 'font-geist-mono' }),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {} }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

import RootLayout from '@/app/layout'
import HeaderGeoControl from '@/components/HeaderGeoControl'
import MobileNav from '@/components/MobileNav'
import ProcessGeoBanner from '@/components/ProcessGeoBanner'
import ProcessesTable, { type ProcessRow } from '@/components/ProcessesTable'
import { GEO_STORAGE_KEY, getGeoChoice, setGeoChoice, type GeoAnalogNote } from '@/lib/geoPreference'

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

const renderLayout = async () =>
  renderToString(await RootLayout({ children: null } as never))

const NOTES: GeoAnalogNote[] = [
  {
    country: 'UK',
    kind: 'analog',
    summary: 'Register a private limited company with Companies House.',
    actionUrl: 'https://www.gov.uk/limited-company-formation',
    actionLabel: 'Companies House',
  },
]

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

const ROWS: ProcessRow[] = [
  row({ slug: 'pick-a-name', title: 'Pick a company name', timeOrder: 1 }),
  row({
    slug: 'get-ein', title: 'Get EIN', geoScope: 'us', timeOrder: 2,
    geoNotesByCountry: { UK: { kind: 'absorbed', summary: 'HMRC posts the company a UTR automatically.' } },
  }),
]

const trigger = (scope: { getByTitle: (t: RegExp) => HTMLElement }) => scope.getByTitle(/Where you operate/)
const pickCountry = (scope: { getByTitle: (t: RegExp) => HTMLElement; getByRole: (role: string, opts?: object) => HTMLElement }, name: string) => {
  fireEvent.click(trigger(scope))
  const list = scope.getByRole('listbox', { name: 'Country' })
  fireEvent.click(within(list).getByRole('option', { name: new RegExp(name) }) as Element)
}

beforeEach(() => {
  stubLocalStorage()
  window.history.replaceState(null, '', '/processes/get-ein')
})
afterEach(() => {
  window.localStorage.clear()
  setGeoChoice(null)
})

describe('renders in the site layout header', () => {
  it('the REAL app/layout.tsx carries exactly one geo trigger — nav weight, 🌐 Global default — and its static HTML is byte-identical whatever URL/storage carry', async () => {
    const pristine = await renderLayout()
    const doc = document.createElement('div')
    doc.innerHTML = pristine
    const header = doc.querySelector('header') as HTMLElement
    const triggers = [...header.querySelectorAll('button[title^="Where you operate"]')]
    // ONE desktop mount (the MobileNav panel's copy renders only when the ☰ panel opens).
    expect(triggers).toHaveLength(1)
    const t = triggers[0] as HTMLElement
    expect(t.textContent).toContain('🌐')
    // Nav weight: no border chip; the choice name is screen-reader-only.
    expect(t.className).not.toContain('border')
    expect([...t.querySelectorAll('span')].find((s) => s.textContent === 'Global')?.className).toContain('sr-only')
    // Near the ⌘K/account cluster: the control's wrapper is desktop-only like its neighbors.
    expect(t.closest('span.hidden')?.className).toContain('sm:block')
    // US-default SSR byte-identity: a stored/URL country never reaches the server render.
    window.history.replaceState(null, '', '/processes/get-ein?geo=uk')
    window.localStorage.setItem(GEO_STORAGE_KEY, 'uk')
    expect(await renderLayout()).toBe(pristine)
  })

  it('the MobileNav ☰ panel carries the same control below sm', () => {
    const r = render(<MobileNav />)
    fireEvent.click(r.getByRole('button', { name: 'Menu' }))
    expect(r.container.textContent).toContain('Country')
    expect(trigger(r)).toBeTruthy()
  })
})

describe('the one header control drives the pages (the per-page mounts are gone)', () => {
  it("picking the UK in the header surfaces a process page's committed banner and filters the /processes table — and writes ?geo=/pa-geo", () => {
    const r = render(
      <div>
        <HeaderGeoControl />
        <ProcessGeoBanner geoScope="us" notes={NOTES} />
        <ProcessesTable rows={ROWS} phases={['formation']} />
      </div>,
    )
    // Pristine: full corpus, no banner — and the store is null under the Global framing.
    expect(getGeoChoice()).toBeNull()
    expect(r.container.textContent).not.toContain('Companies House')
    expect(r.container.querySelectorAll('tbody tr')).toHaveLength(2)

    pickCountry(r, 'United Kingdom')
    expect(window.location.search).toBe('?geo=uk')
    expect(window.localStorage.getItem(GEO_STORAGE_KEY)).toBe('uk')
    expect(r.container.textContent).toContain('Register a private limited company with Companies House.')
    expect([...r.container.querySelectorAll('tbody td:first-child')].some((c) => c.textContent?.includes('Get EIN'))).toBe(false)

    // Back to USA: the codec clears, the page returns to the full-corpus US-baseline view.
    pickCountry(r, 'USA')
    expect(window.location.search).toBe('')
    expect(window.localStorage.getItem(GEO_STORAGE_KEY)).toBeNull()
    expect(r.container.textContent).not.toContain('Companies House')
    expect(r.container.querySelectorAll('tbody tr')).toHaveLength(2)
  })

  it('🌐 Global stays the honest no-filter view: explicit Global keeps the full corpus and no banner (the store maps it to geo-neutral)', () => {
    const r = render(
      <div>
        <HeaderGeoControl />
        <ProcessGeoBanner geoScope="us" notes={NOTES} />
        <ProcessesTable rows={ROWS} phases={['formation']} />
      </div>,
    )
    pickCountry(r, 'Global')
    expect(window.location.search).toBe('?geo=global')
    expect(r.container.querySelectorAll('tbody tr')).toHaveLength(2)
    expect(r.container.textContent).not.toContain('Companies House')
  })
})
