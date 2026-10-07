// @vitest-environment jsdom
// HomeModes — the homepage companies/products/processes switch, shareable (founder 2026-09-21;
// Products tab added 2026-09-23): ?view=products / ?view=processes reproduce the sender's mode.
// Companies and Products share the same pane (the mode reaches MegaTable via HomeModeContext);
// legacy ?all=1 links (the retired sub-products checkbox) resolve to products mode. Load-bearing assertions, in the site-wide
// personalization contract's order:
//   1. SSR-equivalence: the static HTML always renders the companies default — even when the
//      URL carries ?view=processes — and hydrates with ZERO mismatches (the param is applied in
//      a mount effect, never during render);
//   2. URL wins over the localStorage preference on first load;
//   3. clicking a tab writes BOTH the param and localStorage, with the companies default elided.
import { render, fireEvent, act } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import HomeModes from '@/components/HomeModes'

// Same in-memory localStorage stand-in as components/__tests__/StepVendorRow.test.tsx.
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

const PATH = '/'
const setUrl = (search: string) => window.history.replaceState(null, '', `${PATH}${search}`)
const url = () => `${window.location.pathname}${window.location.search}`

const tree = <HomeModes companies={<div>COMPANIES-PANE</div>} processes={<div>PROCESSES-PANE</div>} />

// The mode a container is showing: which pane's wrapper does NOT carry the `hidden` class.
function visiblePane(root: ParentNode): string {
  const shown = [...root.querySelectorAll('div')].filter(
    (d) => (d.textContent === 'COMPANIES-PANE' || d.textContent === 'PROCESSES-PANE') && d.children.length === 0,
  )
  const visible = shown.filter((d) => !d.parentElement?.className.includes('hidden'))
  return visible.map((d) => d.textContent).join(',')
}

beforeEach(() => {
  stubLocalStorage()
  setUrl('')
})
afterEach(() => window.localStorage.clear())

describe('static-HTML contract (SSR ↔ empty client state)', () => {
  it('SSR renders companies even when the URL says ?view=processes, and hydrates mismatch-free', async () => {
    ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
    setUrl('?view=processes')
    const ssr = renderToString(tree)
    // The server never sees the query — byte-identical default HTML.
    expect(ssr).toBe(renderToString(tree))
    const container = document.createElement('div')
    container.innerHTML = ssr
    document.body.appendChild(container)
    expect(visiblePane(container)).toBe('COMPANIES-PANE')
    let root: Root | undefined
    try {
      const hydrationErrors: unknown[] = []
      await act(async () => {
        root = hydrateRoot(container, tree, { onRecoverableError: (e) => hydrationErrors.push(e) })
      })
      expect(hydrationErrors).toEqual([])
      // Post-hydration, the mount effect applies the shared view.
      expect(visiblePane(container)).toBe('PROCESSES-PANE')
    } finally {
      await act(async () => root?.unmount())
      container.remove()
    }
  })
})

describe('URL ⇄ mode', () => {
  it('mounts in process mode from ?view=processes', () => {
    setUrl('?view=processes')
    const { container, getByRole } = render(tree)
    expect(visiblePane(container)).toBe('PROCESSES-PANE')
    expect(getByRole('button', { name: /Processes/ }).getAttribute('aria-pressed')).toBe('true')
  })

  it('a stale localStorage preference is IGNORED — no companies→processes flicker on pristine visits (founder 2026-09-23)', () => {
    window.localStorage.setItem('pa-home-mode', 'processes')
    setUrl('')
    const { container } = render(tree)
    expect(visiblePane(container)).toBe('COMPANIES-PANE')
  })

  it('an invalid ?view falls back to companies silently', () => {
    setUrl('?view=nonsense')
    const { container } = render(tree)
    expect(visiblePane(container)).toBe('COMPANIES-PANE')
  })

  it('clicking Processes writes ?view=processes (URL is the only mode store)', () => {
    const { getByRole } = render(tree)
    fireEvent.click(getByRole('button', { name: /Processes/ }))
    expect(url()).toBe(`${PATH}?view=processes`)
    expect(window.localStorage.getItem('pa-home-mode')).toBeNull()
  })

  it('clicking back to Companies (the default) removes the param — clean pristine URL', () => {
    setUrl('?view=processes')
    const { getByRole } = render(tree)
    fireEvent.click(getByRole('button', { name: /Companies/ }))
    expect(url()).toBe(PATH)
  })

  it('?view=products mounts with the Products tab pressed and the shared companies pane visible', () => {
    setUrl('?view=products')
    const { container, getByRole } = render(tree)
    expect(visiblePane(container)).toBe('COMPANIES-PANE')
    expect(getByRole('button', { name: /Products/ }).getAttribute('aria-pressed')).toBe('true')
  })

  it('legacy ?all=1 links resolve to products mode; clicking Products writes ?view=products and clears ?all', () => {
    setUrl('?all=1')
    const { getByRole } = render(tree)
    expect(getByRole('button', { name: /Products/ }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(getByRole('button', { name: /Products/ }))
    expect(url()).toBe(`${PATH}?view=products`)
  })

  it('patches, never rebuilds: co-mounted params survive a mode click', () => {
    setUrl('?order=risk&rank=popularity')
    const { getByRole } = render(tree)
    fireEvent.click(getByRole('button', { name: /Processes/ }))
    const p = new URLSearchParams(window.location.search)
    expect(p.get('view')).toBe('processes')
    expect(p.get('order')).toBe('risk')
    expect(p.get('rank')).toBe('popularity')
  })

  it('every tab wears its house glyph as SVG — never the old 🏢/📦/🔁/🏟 emoji or a raw token (founder sweep 2026-10-02)', () => {
    const { getByRole } = render(
      <HomeModes companies={<div>COMPANIES-PANE</div>} processes={<div>PROCESSES-PANE</div>} arenas={<div>ARENAS-PANE</div>} />,
    )
    for (const name of [/Companies/, /Products/, /Processes/, /Rankings/]) {
      const btn = getByRole('button', { name })
      expect(btn.querySelector('svg'), String(name)).not.toBeNull()
      expect(btn.textContent).not.toMatch(/🏢|📦|🔁|🏟|pi:/)
    }
  })
})
