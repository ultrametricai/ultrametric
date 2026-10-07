// @vitest-environment jsdom
// "Outside the US" is pure internal navigation (founder 2026-10-07): the country rows no longer
// link out to government portals — each row switches THIS page to the country's view, writing
// exactly the state the GeoDropdown writes (the shared applyGeoChoice: store + ?geo= + pa-geo).
// The committed actionUrl/actionLabel stay corpus data and stay reachable: the country view's
// top banner (ProcessGeoBanner) renders the portal link.
import { act, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ProcessGeoBanner from '@/components/ProcessGeoBanner'
import ProcessGeoNotes from '@/components/ProcessGeoNotes'
import {
  GEO_STORAGE_KEY,
  getGeoChoice,
  setGeoChoice,
  type GeoAnalogNote,
} from '@/lib/geoPreference'

// Same in-memory localStorage stand-in as components/__tests__/globalGeoMode.test.tsx.
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

const NOTES: GeoAnalogNote[] = [
  {
    country: 'UK',
    kind: 'analog',
    summary: 'Register a private limited company with Companies House.',
    actionUrl: 'https://www.gov.uk/limited-company-formation',
    actionLabel: 'Companies House — set up a limited company',
  },
  {
    country: 'IN',
    kind: 'analog',
    summary: 'Incorporate via MCA SPICe+ on the NSWS portal.',
    actionUrl: 'https://www.nsws.gov.in/',
    actionLabel: 'NSWS — incorporate a company',
  },
]

const PATH = '/processes/incorporate-c-corp'

beforeEach(() => {
  stubLocalStorage()
  window.history.replaceState(null, '', PATH)
  setGeoChoice(null)
})
afterEach(() => {
  window.localStorage.clear()
  setGeoChoice(null)
})

describe('Outside the US — internal navigation only (founder 2026-10-07)', () => {
  it('renders NO external links: every country row is an internal view switch', () => {
    const { container } = render(<ProcessGeoNotes notes={NOTES} geoScope="us" />)
    expect(container.querySelectorAll('a').length).toBe(0)
    // The committed portal URLs never appear in this section's markup.
    expect(container.innerHTML).not.toContain('gov.uk')
    expect(container.innerHTML).not.toContain('nsws.gov.in')
    // One switch affordance per country row.
    expect(container.textContent).toContain('switch to the United Kingdom view')
    expect(container.textContent).toContain('switch to the India view')
  })

  it("clicking a row writes the dropdown's exact state: store, ?geo= param, stored preference", () => {
    const { getByTitle } = render(<ProcessGeoNotes notes={NOTES} geoScope="us" />)
    const row = getByTitle(/Switch this page to the India view/)
    act(() => {
      fireEvent.click(row)
    })
    expect(getGeoChoice()).toBe('IN')
    expect(window.location.search).toContain('geo=in')
    expect(window.localStorage.getItem(GEO_STORAGE_KEY)).toBe('in')
  })

  it('the committed portal link stays reachable in the country view banner after the switch', () => {
    const banner = render(<ProcessGeoBanner geoScope="us" notes={NOTES} />)
    const notes = render(<ProcessGeoNotes notes={NOTES} geoScope="us" />)
    act(() => {
      fireEvent.click(notes.getByTitle(/Switch this page to the United Kingdom view/))
    })
    const link = banner.container.querySelector('a[href="https://www.gov.uk/limited-company-formation"]')
    expect(link, 'the committed actionUrl must render in the country banner').toBeTruthy()
    expect(link!.textContent).toContain('Companies House — set up a limited company')
  })
})
