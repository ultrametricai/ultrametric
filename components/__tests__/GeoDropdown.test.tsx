// @vitest-environment jsdom
// GeoDropdown — the table-controls geo switcher, now with a per-surface default framing
// (founder 2026-09-30: "default /processes onto a global view — you can include the US specific
// ones in the first view"; lib/geoPreference.ts PROCESSES_INDEX_DEFAULT_GEO). Load-bearing
// assertions, in the site-wide personalization contract's order (the GeoSwitcher.test template):
//   1. SSR honesty: the static HTML IS the surface default — 🇺🇸 USA with no prop (the homepage
//      surface, unchanged), 🌐 Global under defaultChoice=GEO_GLOBAL (/processes) — even when
//      the URL/storage carry a choice (mount-effect reads only), and it hydrates mismatch-free;
//   2. an explicit choice still wins over the surface default: ?geo= first, then pa-geo;
//      ?geo=global stays valid (now redundant on the global-default surface);
//   3. picks write as before: a country/Global writes BOTH ?geo= and pa-geo; 🇺🇸 USA clears both
//      (the US default never appears in the URL) — on a global-default surface the trigger then
//      settles back on the surface's Global framing (the index rows are identical either way);
//   4. the detail-page seam (flipped 2026-10-02: process detail pages now render THIS dropdown
//      with defaultChoice=GEO_GLOBAL): the surface default is trigger FRAMING only — the shared
//      store stays null, so the page's banner/notes/toggles keep their US-default no-selection
//      render byte-identical. GeoSwitcher (the WhereItWorks pill row) keeps its US default.
import { render, fireEvent, act } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import GeoDropdown from '@/components/GeoDropdown'
import GeoSwitcher from '@/components/GeoSwitcher'
import { GEO_GLOBAL, PROCESSES_INDEX_DEFAULT_GEO, getGeoChoice, setGeoChoice } from '@/lib/geoPreference'

// Same in-memory localStorage stand-in as components/__tests__/GeoSwitcher.test.tsx.
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

const PATH = '/processes'
const setUrl = (search: string) => window.history.replaceState(null, '', `${PATH}${search}`)
const url = () => `${window.location.pathname}${window.location.search}`

const trigger = (scope: { getByTitle: (t: RegExp) => HTMLElement }) =>
  scope.getByTitle(/Where you operate/)
const openList = (scope: { getByTitle: (t: RegExp) => HTMLElement; getByRole: (role: string, opts?: object) => HTMLElement }) => {
  fireEvent.click(trigger(scope))
  return scope.getByRole('listbox', { name: 'Country' })
}

beforeEach(() => {
  stubLocalStorage()
  setUrl('')
})
afterEach(() => {
  window.localStorage.clear()
  // The module-level store outlives unmounts — reset so tests stay independent.
  setGeoChoice(null)
})

describe('static-HTML contract (SSR IS the surface default — no client flash)', () => {
  it('no prop: the server HTML renders 🇺🇸 USA (the sitewide default, the homepage surface unchanged)', () => {
    const ssr = renderToString(<GeoDropdown />)
    expect(ssr).toContain('🇺🇸')
    expect(ssr).toContain('USA')
    expect(ssr).not.toContain('Global')
  })

  it('defaultChoice=GEO_GLOBAL: the server HTML renders 🌐 Global — byte-identical even when the URL and storage carry a country — and hydrates mismatch-free', async () => {
    ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
    setUrl('?geo=de')
    window.localStorage.setItem('pa-geo', 'uk')
    const tree = <GeoDropdown defaultChoice={GEO_GLOBAL} />
    const ssr = renderToString(tree)
    expect(ssr).toBe(renderToString(tree)) // the server never sees the query or the storage
    expect(ssr).toContain('🌐')
    expect(ssr).toContain('Global')
    expect(ssr).not.toContain('USA')
    const container = document.createElement('div')
    container.innerHTML = ssr
    document.body.appendChild(container)
    let root: Root | undefined
    try {
      const hydrationErrors: unknown[] = []
      await act(async () => {
        root = hydrateRoot(container, tree, { onRecoverableError: (e) => hydrationErrors.push(e) })
      })
      expect(hydrationErrors).toEqual([])
      // Post-hydration the mount effect applies the URL — the param wins over both the stored
      // copy AND the surface default.
      expect(container.querySelector('button')?.textContent).toContain('Germany')
    } finally {
      await act(async () => root?.unmount())
      container.remove()
    }
  })

  it('the /processes index default constant IS the global framing', () => {
    expect(PROCESSES_INDEX_DEFAULT_GEO).toBe(GEO_GLOBAL)
  })
})

describe('the surface default vs an explicit choice (defaultChoice=GEO_GLOBAL)', () => {
  const mountGlobal = () => render(<GeoDropdown defaultChoice={GEO_GLOBAL} />)

  it('pristine (no param, no stored pref): the trigger reads 🌐 Global and the Global option is the selected one — USA is not', () => {
    const r = mountGlobal()
    expect(trigger(r).textContent).toContain('Global')
    const list = openList(r)
    const options = [...list.querySelectorAll('[role="option"]')]
    const byName = (name: string) => options.find((o) => o.textContent?.includes(name))
    expect(byName('Global')?.getAttribute('aria-selected')).toBe('true')
    expect(byName('USA')?.getAttribute('aria-selected')).toBe('false')
  })

  it('?geo=de wins over the Global surface default; junk (?geo=narnia) degrades to the surface default', () => {
    setUrl('?geo=de')
    const first = mountGlobal()
    expect(trigger(first).textContent).toContain('Germany')
    first.unmount()
    act(() => setGeoChoice(null))
    setUrl('?geo=narnia')
    const second = mountGlobal()
    expect(trigger(second).textContent).toContain('Global')
  })

  it('the stored pref (pa-geo=uk) wins over the surface default when no param is present', () => {
    window.localStorage.setItem('pa-geo', 'uk')
    const r = mountGlobal()
    expect(trigger(r).textContent).toContain('United Kingdom')
  })

  it('?geo=global stays valid (now redundant on this surface): Global shown and selected', () => {
    setUrl('?geo=global')
    const r = mountGlobal()
    expect(trigger(r).textContent).toContain('Global')
    const list = openList(r)
    const global = [...list.querySelectorAll('[role="option"]')].find((o) => o.textContent?.includes('Global'))
    expect(global?.getAttribute('aria-selected')).toBe('true')
  })
})

describe('picks write the param/storage exactly as before (the codec is untouched)', () => {
  it('a country writes BOTH ?geo= and pa-geo; Global writes geo=global; 🇺🇸 USA clears both and the trigger settles on the surface default framing', () => {
    const r = render(<GeoDropdown defaultChoice={GEO_GLOBAL} />)
    let list = openList(r)
    fireEvent.click([...list.querySelectorAll('[role="option"]')].find((o) => o.textContent?.includes('Germany')) as Element)
    expect(url()).toBe(`${PATH}?geo=de`)
    expect(window.localStorage.getItem('pa-geo')).toBe('de')
    expect(trigger(r).textContent).toContain('Germany')

    list = openList(r)
    fireEvent.click([...list.querySelectorAll('[role="option"]')].find((o) => o.textContent?.includes('Global')) as Element)
    expect(url()).toBe(`${PATH}?geo=global`)
    expect(window.localStorage.getItem('pa-geo')).toBe('global')

    list = openList(r)
    fireEvent.click([...list.querySelectorAll('[role="option"]')].find((o) => o.textContent?.includes('USA')) as Element)
    // As today: the US default never appears in the URL and clears the stored copy — so detail
    // pages return to their US default; THIS surface's pristine framing is Global, and the
    // index rows are identical either way (the geo dimension annotates, never filters).
    expect(url()).toBe(PATH)
    expect(window.localStorage.getItem('pa-geo')).toBeNull()
    expect(trigger(r).textContent).toContain('Global')
  })

  it('with no defaultChoice the pristine selected entry is 🇺🇸 USA (the sitewide default, unchanged)', () => {
    const r = render(<GeoDropdown />)
    expect(trigger(r).textContent).toContain('USA')
    const list = openList(r)
    const usa = [...list.querySelectorAll('[role="option"]')].find((o) => o.textContent?.includes('USA'))
    expect(usa?.getAttribute('aria-selected')).toBe('true')
  })
})

describe('the menu stays attached to its trigger (founder bug 2026-10-05: "the geo menu is disconnected from the initial clickable dropdown Global")', () => {
  it('walks the founder sequence inside a block container: Global → open → India → reopen (India ✓) → Global — the trigger label tracks every pick', () => {
    // The detail-page shape that exposed the bug: the dropdown as the only child of a
    // full-width block container (app/processes/[slug] renders it inside a plain div).
    const r = render(
      <div>
        <GeoDropdown defaultChoice={GEO_GLOBAL} />
      </div>,
    )
    expect(trigger(r).textContent).toContain('Global')
    let list = openList(r)
    const option = (name: string) =>
      [...list.querySelectorAll('[role="option"]')].find((o) => o.textContent?.includes(name)) as HTMLElement
    expect(option('Global').getAttribute('aria-selected')).toBe('true')
    fireEvent.click(option('India'))
    expect(trigger(r).textContent).toContain('India')
    expect(url()).toBe(`${PATH}?geo=in`)
    list = openList(r)
    expect(option('India').getAttribute('aria-selected')).toBe('true')
    fireEvent.click(option('Global'))
    expect(trigger(r).textContent).toContain('Global')
    expect(url()).toBe(`${PATH}?geo=global`)
  })

  it('the popover anchors to the trigger, not the surrounding container: shrink-to-fit root (inline-flex) + top-full, sharing the trigger parent', () => {
    const r = render(<GeoDropdown defaultChoice={GEO_GLOBAL} />)
    const list = openList(r)
    const root = trigger(r).parentElement!
    // jsdom computes no layout, so the pin is structural: the listbox is positioned against the
    // same `relative` box the trigger fills. A block-level root in a block container spans the
    // full content width and sends the right-0 menu a page-width away from the trigger (the
    // founder's "disconnected" report); inline-flex shrinks the anchor box to the trigger.
    expect(list.parentElement).toBe(root)
    expect(root.className).toContain('relative')
    expect(root.className).toContain('inline-flex')
    expect(list.className).toContain('top-full')
  })
})

describe('the detail-page seam (flipped this round — founder 2026-10-02: detail pages render the dropdown, Global-first)', () => {
  it('defaultChoice=GEO_GLOBAL is trigger framing ONLY: after mount with no param/storage the shared store still reads null, so ProcessGeoBanner/notes/toggles keep the US-default no-selection render', () => {
    const r = render(<GeoDropdown defaultChoice={GEO_GLOBAL} />)
    expect(trigger(r).textContent).toContain('Global')
    // The SSR contract behind the page-level byte-identity pins: no explicit choice means NO
    // store write — every geo-aware consumer on the page still sees "nothing chosen".
    expect(getGeoChoice()).toBeNull()
  })

  it('GeoSwitcher (the remaining pill-row consumer, WhereItWorksStrip) still SSRs the 🇺🇸 US default as pressed', () => {
    const ssr = renderToString(<GeoSwitcher />)
    const container = document.createElement('div')
    container.innerHTML = ssr
    const us = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('US') && !b.textContent.includes('USA'))
    expect(us?.getAttribute('aria-pressed')).toBe('true')
  })
})
