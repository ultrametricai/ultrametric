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
    expect(document.body.textContent).toContain('Country mappings exist for')
  })
  it('DE → Global: banner leaves the DE view', () => {
    render(<><GeoSwitcher /><ProcessGeoBanner geoScope="us" notes={[{ country: 'DE', kind: 'analog', summary: 'German analog', actionUrl: 'https://example.de', actionLabel: 'Handelsregister' }]} /></>)
    fireEvent.click(screen.getByRole('button', { name: /Germany|DE/ }))
    expect(document.body.textContent).toContain('German analog')
    fireEvent.click(screen.getByRole('button', { name: /Global/ }))
    expect(document.body.textContent).not.toContain('German analog')
    expect(document.body.textContent).toContain('Country mappings exist for')
  })
})
