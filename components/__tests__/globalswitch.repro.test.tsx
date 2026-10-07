// @vitest-environment jsdom
import { fireEvent, render, screen, cleanup, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import HeaderGeoControl from '@/components/HeaderGeoControl'
import ProcessGeoBanner from '@/components/ProcessGeoBanner'
import { setGeoChoice } from '@/lib/geoPreference'

// The control is the site header's since founder 2026-10-07 — the repro walks the same founder
// sequence through its listbox instead of the retired GeoSwitcher pills.
const pick = (name: RegExp) => {
  fireEvent.click(screen.getByTitle(/Where you operate/))
  fireEvent.click(within(screen.getByRole('listbox', { name: 'Country' })).getByRole('option', { name }))
}

describe('founder repro: selecting Global while on a process page', () => {
  beforeEach(() => { window.history.replaceState(null, '', '/processes/incorporate-c-corp'); window.localStorage.clear(); setGeoChoice(null) })
  afterEach(cleanup)
  it('US default → pick Global: option selects, URL+storage written, banner goes global', () => {
    render(<><HeaderGeoControl /><ProcessGeoBanner geoScope="us" notes={[{ country: 'DE', kind: 'analog', summary: 'German analog', actionUrl: 'https://example.de', actionLabel: 'Handelsregister' }]} /></>)
    pick(/Global/)
    expect(window.location.search).toContain('geo=global')
    expect(window.localStorage.getItem('pa-geo')).toBe('global')
    fireEvent.click(screen.getByTitle(/Where you operate/))
    expect(within(screen.getByRole('listbox', { name: 'Country' })).getByRole('option', { name: /Global/ }).getAttribute('aria-selected')).toBe('true')
    // The Global banner renders nothing since founder 2026-10-05 (the availability line left —
    // the geo control itself names the mapped countries); no country content leaks either.
    expect(document.body.textContent).not.toContain('Country mappings exist for')
    expect(document.body.textContent).not.toContain('German analog')
  })
  it('DE → Global: banner leaves the DE view', () => {
    render(<><HeaderGeoControl /><ProcessGeoBanner geoScope="us" notes={[{ country: 'DE', kind: 'analog', summary: 'German analog', actionUrl: 'https://example.de', actionLabel: 'Handelsregister' }]} /></>)
    pick(/Germany/)
    expect(document.body.textContent).toContain('German analog')
    pick(/Global/)
    expect(document.body.textContent).not.toContain('German analog')
    // No availability line either (founder 2026-10-05) — the Global banner is empty.
    expect(document.body.textContent).not.toContain('Country mappings exist for')
  })
})
