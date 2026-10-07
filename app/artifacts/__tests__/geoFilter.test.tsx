// @vitest-environment jsdom
// The /artifacts country view (founder 2026-10-07 — the /processes country rule's sibling):
// the index adapts to the same shared store the process pages use — written by the site
// header's country control since the top-bar move (founder 2026-10-07,
// components/HeaderGeoControl.tsx; the page mounts no dropdown of its own) — and under an
// EXPLICIT country selection it hides the artifacts whose EVERY producing process (canonical
// producer + documented alsoProducedBy exceptions) is geoScope us/us-state. Mixed producers
// stay visible; 🌐 Global and the no-selection default show the whole registry; the static
// HTML never learns about the selection (byte-identical default). Display filter only — no
// judged number moves.
import { act, cleanup, fireEvent, render, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ArtifactsPage from '@/app/artifacts/page'
import HeaderGeoControl from '@/components/HeaderGeoControl'
import { loadArtifactPages } from '@/lib/artifactPages'
import { GEO_GLOBAL, setGeoChoice } from '@/lib/geoPreference'
import { loadProcesses } from '@/lib/processes'

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

beforeEach(() => {
  stubLocalStorage()
  window.history.replaceState(null, '', '/artifacts')
  setGeoChoice(null)
})
afterEach(() => {
  cleanup()
  window.localStorage.clear()
  setGeoChoice(null)
})

const link = (container: HTMLElement, id: string) =>
  container.querySelector(`a[href="/artifacts/${id}"]`)

describe('usOnlyProducers (the filter flag, computed from the producers geoScope)', () => {
  it('is true exactly when EVERY producer is US-scoped — mixed producers stay visible', () => {
    const tasks = new Map(loadProcesses().map((t) => [t.id, t]))
    const pages = loadArtifactPages()
    for (const page of pages) {
      const producers = [page.producer.id, ...page.exceptionProducers.map((p) => p.id)].map(
        (id) => tasks.get(id)!,
      )
      expect(page.usOnlyProducers, page.artifact.id).toBe(
        producers.every((t) => t.geoScope === 'us' || t.geoScope === 'us-state'),
      )
    }
    // Non-vacuous over the real corpus: the EIN hides, a mixed-producer artifact does not.
    expect(pages.find((p) => p.artifact.id === 'ein')!.usOnlyProducers).toBe(true)
    const mixed = pages.find((p) => p.artifact.id === 'bank-account')!
    expect(mixed.usOnlyProducers).toBe(false)
    expect(
      [mixed.producer.id, ...mixed.exceptionProducers.map((p) => p.id)].some(
        (id) => tasks.get(id)!.geoScope !== 'global',
      ),
      'bank-account must really have a US-scoped producer (the mixed case)',
    ).toBe(true)
  })
})

describe('/artifacts under a country selection', () => {
  it('mounts no dropdown of its own (the header control owns it) and hides US-only artifacts under a country selection; mixed and global stay', () => {
    const { container } = render(<ArtifactsPage />)
    expect(
      container.querySelector('button[aria-haspopup="listbox"][title^="Where you operate"]'),
      'the page must not mount its own geo dropdown — the header control owns it (founder 2026-10-07)',
    ).toBeNull()

    // Default: the whole registry.
    expect(link(container, 'ein')).toBeTruthy()
    expect(link(container, 'bank-account')).toBeTruthy()
    expect(link(container, 'domain')).toBeTruthy()

    act(() => setGeoChoice('IN'))
    expect(link(container, 'ein'), 'EIN-ish artifacts hide in a country view').toBeNull()
    expect(link(container, 'bank-account'), 'mixed producers stay visible').toBeTruthy()
    expect(link(container, 'domain'), 'globally-produced artifacts stay').toBeTruthy()

    // Every US-only artifact hides; every other one stays — and no heading sits over an
    // all-hidden group.
    for (const page of loadArtifactPages()) {
      if (page.usOnlyProducers) expect(link(container, page.artifact.id)).toBeNull()
      else expect(link(container, page.artifact.id)).toBeTruthy()
    }
    for (const table of container.querySelectorAll('table')) {
      expect(table.querySelectorAll('tbody tr').length).toBeGreaterThan(0)
    }

    // 🌐 Global and clearing the choice both restore the full registry.
    act(() => setGeoChoice(GEO_GLOBAL))
    expect(link(container, 'ein')).toBeTruthy()
    act(() => setGeoChoice(null))
    expect(link(container, 'ein')).toBeTruthy()
  })

  it('the header control drives the page (the 2026-10-07 seam): picking India in the header hides the EIN row; USA restores it', () => {
    const r = render(
      <div>
        <HeaderGeoControl />
        <ArtifactsPage />
      </div>,
    )
    expect(link(r.container, 'ein')).toBeTruthy()
    fireEvent.click(r.getByTitle(/Where you operate/))
    fireEvent.click(within(r.getByRole('listbox', { name: 'Country' })).getByRole('option', { name: /India/ }))
    expect(window.location.search).toBe('?geo=in')
    expect(link(r.container, 'ein')).toBeNull()
    expect(link(r.container, 'bank-account')).toBeTruthy()
    fireEvent.click(r.getByTitle(/Where you operate/))
    fireEvent.click(within(r.getByRole('listbox', { name: 'Country' })).getByRole('option', { name: /USA/ }))
    expect(link(r.container, 'ein')).toBeTruthy()
  })

  it('static HTML never learns about the selection: SSR with ?geo=in equals the plain default', () => {
    window.history.replaceState(null, '', '/artifacts?geo=in')
    window.localStorage.setItem('pa-geo', 'in')
    const withParam = renderToString(<ArtifactsPage />)
    window.history.replaceState(null, '', '/artifacts')
    window.localStorage.clear()
    const plain = renderToString(<ArtifactsPage />)
    expect(withParam).toBe(plain)
    expect(withParam).toContain('/artifacts/ein')
  })
})
