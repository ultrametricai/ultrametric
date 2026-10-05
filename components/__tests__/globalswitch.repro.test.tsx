// @vitest-environment jsdom
import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import GeoSwitcher from '@/components/GeoSwitcher'
import ProcessGeoBanner from '@/components/ProcessGeoBanner'
import { setGeoChoice } from '@/lib/geoPreference'

describe('founder repro: selecting Global on a process page', () => {
  beforeEach(() => { window.history.replaceState(null, '', '/processes/incorporate-c-corp'); window.localStorage.clear(); setGeoChoice(null) })
  afterEach(cleanup)
  it('US default → click Global: pill activates, URL+storage written, banner goes global', () => {
    render(<><GeoSwitcher /><ProcessGeoBanner geoScope="us" notes={[{ country: 'DE', kind: 'analog', summary: 'German analog', actionUrl: 'https://example.de', actionLabel: 'Handelsregister' }]} /></>)
    const globalPill = screen.getByRole('button', { name: /Global/ })
    fireEvent.click(globalPill)
    expect(globalPill.getAttribute('aria-pressed')).toBe('true')
    expect(window.location.search).toContain('geo=global')
    expect(window.localStorage.getItem('pa-geo')).toBe('global')
    // The Global banner renders nothing since founder 2026-10-05 (the availability line left —
    // the geo control itself names the mapped countries); no country content leaks either.
    expect(document.body.textContent).not.toContain('Country mappings exist for')
    expect(document.body.textContent).not.toContain('German analog')
  })
  it('DE → Global: banner leaves the DE view', () => {
    render(<><GeoSwitcher /><ProcessGeoBanner geoScope="us" notes={[{ country: 'DE', kind: 'analog', summary: 'German analog', actionUrl: 'https://example.de', actionLabel: 'Handelsregister' }]} /></>)
    fireEvent.click(screen.getByRole('button', { name: /Germany|DE/ }))
    expect(document.body.textContent).toContain('German analog')
    fireEvent.click(screen.getByRole('button', { name: /Global/ }))
    expect(document.body.textContent).not.toContain('German analog')
    // No availability line either (founder 2026-10-05) — the Global banner is empty.
    expect(document.body.textContent).not.toContain('Country mappings exist for')
  })
})
