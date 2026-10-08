// @vitest-environment jsdom
// GeoDropdown — the house geo listbox, since founder 2026-10-07 mounted ONCE in the site
// header (components/HeaderGeoControl.tsx: "move this into the top bar so the user can set
// their country or default to global, then we don't need it per page"). Load-bearing
// assertions, in the site-wide personalization contract's order:
//   1. SSR honesty: the static HTML IS the surface default — 🇺🇸 USA with no prop,
//      🌐 Global under defaultChoice=GEO_GLOBAL (the header's framing) — even when the
//      URL/storage carry a choice (mount-effect reads only), and it hydrates mismatch-free;
//   2. an explicit choice still wins over the surface default: ?geo= first, then pa-geo;
//      ?geo=global stays valid (redundant on the global-default surface);
//   3. picks write as before (the committed codec, untouched): a country/Global writes BOTH
//      ?geo= and pa-geo; 🇺🇸 USA clears both (the US default never appears in the URL) — the
//      trigger then settles back on the surface's framing; no selection and Global both mean
//      the full corpus + US-baseline flows (only a country view filters/adapts);
//   4. defaultChoice stays trigger framing ONLY — the shared store stays null, so every
//      geo-aware page block keeps its US-default no-selection render byte-identical;
//   5. the nav variant (the header form): compact flag-or-globe trigger at nav weight — no
//      border chip, the country name sr-only/tooltip only, the same listbox and writes.
import { render, fireEvent, act } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import GeoDropdown from '@/components/GeoDropdown'
import { GEO_GLOBAL, PROCESSES_INDEX_DEFAULT_GEO, getGeoChoice, getGeoSelection, setGeoChoice, setUsPickDisplay } from '@/lib/geoPreference'

// Same in-memory localStorage stand-in as components/__tests__/ProcessGeoSync.test.tsx.
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
  // The module-level store outlives unmounts — reset so tests stay independent (the explicit-
  // USA display flag included, founder 2026-10-08).
  setGeoChoice(null)
  setUsPickDisplay(false)
})

describe('static-HTML contract (SSR IS the surface default — no client flash)', () => {
  it('no prop: the server HTML renders 🇺🇸 USA (the no-framing default, unchanged)', () => {
    const ssr = renderToString(<GeoDropdown />)
    expect(ssr).toContain('🇺🇸')
    expect(ssr).toContain('USA')
    expect(ssr).not.toContain('🌐')
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

  it('the global-default framing constant IS the global framing (the header control reuses it as GEO_GLOBAL)', () => {
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
    // As today: the US default never appears in the URL and clears the stored copy. The views
    // stay the full-corpus US-baseline ones (store null — same as Global); only the TRIGGER
    // reflects the pick (founder 2026-10-08: "clicking USA … stays 🌐" superseded the old
    // settle-back-to-the-surface-framing display).
    expect(url()).toBe(PATH)
    expect(window.localStorage.getItem('pa-geo')).toBeNull()
    expect(trigger(r).textContent).toContain('🇺🇸')
    expect(getGeoChoice()).toBeNull()
  })

  it('with no defaultChoice the pristine selected entry is 🇺🇸 USA (the no-framing default, unchanged)', () => {
    const r = render(<GeoDropdown />)
    expect(trigger(r).textContent).toContain('USA')
    const list = openList(r)
    const usa = [...list.querySelectorAll('[role="option"]')].find((o) => o.textContent?.includes('USA'))
    expect(usa?.getAttribute('aria-selected')).toBe('true')
  })
})

describe('the menu stays attached to its trigger (founder bug 2026-10-05: "the geo menu is disconnected from the initial clickable dropdown Global")', () => {
  it('walks the founder sequence inside a block container: Global → open → India → reopen (India ✓) → Global — the trigger label tracks every pick', () => {
    // The container shape that exposed the bug: the dropdown as a child of a full-width block
    // container.
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

  it('menu alignment follows the align prop: right-0 by default (the header trigger sits at the bar\'s right end), left-0 under align="left"', () => {
    const r = render(<GeoDropdown defaultChoice={GEO_GLOBAL} />)
    expect(openList(r).className).toContain('right-0')
    r.unmount()
    const left = render(<GeoDropdown align="left" defaultChoice={GEO_GLOBAL} />)
    const list = openList(left)
    expect(list.className).toContain('left-0')
    expect(list.className).not.toContain('right-0')
  })
})

describe('defaultChoice is trigger framing ONLY (the SSR byte-identity contract behind the page-level pins)', () => {
  it('after mount with no param/storage the shared store still reads null, so banners/notes/toggles keep the US-default no-selection render', () => {
    const r = render(<GeoDropdown defaultChoice={GEO_GLOBAL} />)
    expect(trigger(r).textContent).toContain('Global')
    // No explicit choice means NO store write — every geo-aware consumer on the page still
    // sees "nothing chosen".
    expect(getGeoChoice()).toBeNull()
  })
})

describe('the nav variant (the header form, founder 2026-10-07)', () => {
  it('compact flag-or-globe trigger at nav weight: no border chip, the current choice name sr-only, the flag visible', () => {
    const r = render(<GeoDropdown variant="nav" defaultChoice={GEO_GLOBAL} />)
    const t = trigger(r)
    expect(t.className).not.toContain('border')
    expect(t.className).toContain('text-sm')
    expect(t.textContent).toContain('🌐')
    // The label stays for screen readers only — no visible per-state text at nav weight.
    const label = [...t.querySelectorAll('span')].find((s) => s.textContent === 'Global')
    expect(label?.className).toContain('sr-only')
  })

  it('the nav trigger drives the same listbox and codec: pick the UK → ?geo=uk + pa-geo, trigger flag flips to 🇬🇧', () => {
    const r = render(<GeoDropdown variant="nav" defaultChoice={GEO_GLOBAL} />)
    const list = openList(r)
    fireEvent.click([...list.querySelectorAll('[role="option"]')].find((o) => o.textContent?.includes('United Kingdom')) as Element)
    expect(url()).toBe(`${PATH}?geo=uk`)
    expect(window.localStorage.getItem('pa-geo')).toBe('uk')
    expect(trigger(r).textContent).toContain('🇬🇧')
  })
})

describe('an explicit 🇺🇸 USA pick is REFLECTED on the trigger (founder 2026-10-08)', () => {
  it('walks the founder sequence on the header form: 🌐 → USA 🇺🇸 → Global 🌐 → Germany 🇩🇪 → USA 🇺🇸 — with USA and Global both leaving the views geo-neutral', () => {
    const r = render(<GeoDropdown variant="nav" defaultChoice={GEO_GLOBAL} />)
    const pick = (name: string) => {
      const list = openList(r)
      fireEvent.click([...list.querySelectorAll('[role="option"]')].find((o) => o.textContent?.includes(name)) as Element)
    }

    // Pristine: the surface's Global framing (nothing chosen, nothing stored).
    expect(trigger(r).textContent).toContain('🌐')

    pick('USA')
    expect(trigger(r).textContent).toContain('🇺🇸')
    // Display only: the codec is untouched (USA never reaches URL/storage) and the store stays
    // null — a USA view and a Global view render identically (the 2026-10-07 decision).
    expect(url()).toBe(PATH)
    expect(window.localStorage.getItem('pa-geo')).toBeNull()
    expect(getGeoChoice()).toBeNull()
    expect(getGeoSelection()).toBeNull()
    // The pick also reads as the selected entry when the list reopens.
    const list = openList(r)
    expect([...list.querySelectorAll('[role="option"]')].find((o) => o.textContent?.includes('USA'))?.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(document, { key: 'Escape' })

    pick('Global')
    expect(trigger(r).textContent).toContain('🌐')
    expect(getGeoSelection()).toBeNull() // same geo-neutral views as the USA state above

    pick('Germany')
    expect(trigger(r).textContent).toContain('🇩🇪')
    expect(url()).toBe(`${PATH}?geo=de`)

    pick('USA')
    expect(trigger(r).textContent).toContain('🇺🇸')
    expect(url()).toBe(PATH)
    expect(window.localStorage.getItem('pa-geo')).toBeNull()
  })

  it('the pristine default framing is untouched: no pick, no 🇺🇸 override — SSR and first client render still show the surface default', () => {
    const ssr = renderToString(<GeoDropdown variant="nav" defaultChoice={GEO_GLOBAL} />)
    expect(ssr).toContain('🌐')
    expect(ssr).not.toContain('🇺🇸')
  })
})
