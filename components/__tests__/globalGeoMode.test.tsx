// @vitest-environment jsdom
// The 🌐 Global mode for individual processes (founder 2026-09-30: "add a Global option IN
// ADDITION to the country list — selecting Global shows the GENERAL process without
// country-specifics"). The contract, in the site-wide personalization order:
//   1. default byte-identical: the static HTML — even with ?geo=global in the URL — renders the
//      US default of every geo-aware block, and ?geo=global never changes a committed number;
//   2. under the explicit Global choice: the banner shows the country-agnostic lens, the
//      "Outside the US" geoNotes block renders NOTHING at all (founder 2026-10-02 — supersedes
//      the earlier availability-only collapse), jurisdiction-conditional steps (the jca1/jmu1
//      family) disappear, geo method variants are NOT auto-preselected, and vendor-geo
//      annotations render nothing (Global reads as null to every country-consumer);
//   3. a manual country still wins: picking a country after Global restores every country
//      behavior unchanged, and the US default clears everything.
import { render, fireEvent, act } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import GeoSwitcher from '@/components/GeoSwitcher'
import JurisdictionToggle from '@/components/JurisdictionToggle'
import ProcessGeoBanner from '@/components/ProcessGeoBanner'
import ProcessGeoNotes from '@/components/ProcessGeoNotes'
import StepMethodPicker from '@/components/StepMethodPicker'
import VendorGeoMark from '@/components/VendorGeoMark'
import { useGeoSelection } from '@/components/useGeoSelection'
import {
  GEO_GLOBAL,
  getGeoSelection,
  setGeoChoice,
  type GeoAnalogNote,
  type VendorGeoByCountry,
} from '@/lib/geoPreference'
import type { JurisdictionStepView } from '@/lib/jurisdictions'
import { resetMethodSelections, stepMethodNodeKey, type StepMethodView } from '@/lib/stepMethods'

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

// The jca1/jmu1 family: a jurisdiction-conditional step view (shape of lib/jurisdictions.ts).
const JURIS_STEPS: JurisdictionStepView[] = [
  {
    label: 'Register as a foreign corporation in California',
    route: 'form',
    estimatedMinutes: 45,
    async: false,
    jurisdictions: ['CA'],
    actionUrl: null,
    actionLabel: null,
    processHref: null,
    processTitle: null,
  },
]
const BASE = { agentSteps: 5, totalSteps: 7, pct: 71 }

const NODE_KEY = stepMethodNodeKey('startup_001', 'n1')
const defaultView: StepMethodView = {
  id: 'default',
  label: 'File with the Delaware Division of Corporations',
  summary: null,
  context: null,
  route: 'agent',
  estimatedMinutes: 20,
  calls: [],
  chips: [],
  subSteps: [],
  actionUrl: null,
  actionLabel: null,
  ceiling: BASE,
}
const ukMethod: StepMethodView = {
  id: 'uk-companies-house',
  label: 'UK — Companies House filing',
  summary: 'Register with Companies House.',
  context: { kind: 'geo', when: 'Incorporating in the United Kingdom', countries: ['UK'] },
  route: 'form',
  estimatedMinutes: null,
  calls: [],
  chips: [],
  subSteps: [],
  actionUrl: 'https://www.gov.uk/limited-company-formation',
  actionLabel: 'Companies House',
  ceiling: BASE,
}

const VENDOR_GEO: VendorGeoByCountry = {
  UK: { status: 'available', note: 'Fully available in the UK.', sourceUrl: 'https://example.com' },
}

function Probe() {
  const geo = useGeoSelection()
  return <output data-testid="probe">{geo ?? 'US-default'}</output>
}

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

const PATH = '/processes/incorporate-c-corp'
const setUrl = (search: string) => window.history.replaceState(null, '', `${PATH}${search}`)

beforeEach(() => {
  stubLocalStorage()
  setUrl('')
  resetMethodSelections()
  setGeoChoice(null)
})
afterEach(() => {
  window.localStorage.clear()
  setGeoChoice(null)
})

const geoAware = (
  <>
    <ProcessGeoBanner geoScope="us" notes={NOTES} />
    <ProcessGeoNotes notes={NOTES} geoScope="us" />
    <JurisdictionToggle steps={JURIS_STEPS} base={BASE} />
    <VendorGeoMark geo={VENDOR_GEO} />
  </>
)

describe('default byte-identical (the static HTML never learns about ?geo=global)', () => {
  it('SSR with ?geo=global in the URL renders exactly the no-selection default of every block', () => {
    setUrl('?geo=global')
    window.localStorage.setItem('pa-geo', 'global')
    const withParam = renderToString(geoAware)
    setUrl('')
    window.localStorage.clear()
    const plain = renderToString(geoAware)
    expect(withParam).toBe(plain)
    // The default of each block: no banner, the FULL notes block, the Delaware-only toggle.
    expect(withParam).toContain('Outside the US')
    expect(withParam).toContain('Register a private limited company with Companies House.')
    expect(withParam).toContain('Delaware-only')
  })
})

describe('?geo=global hides the country specifics (the country-agnostic lens)', () => {
  it('banner: the Global view renders NOTHING (founder 2026-10-05 — the availability line left; the geo dropdown names the countries), with or without mappings', () => {
    const withNotes = render(<ProcessGeoBanner geoScope="us" notes={NOTES} />)
    act(() => setGeoChoice(GEO_GLOBAL))
    expect(withNotes.container.innerHTML).toBe('')
    const withoutNotes = render(<ProcessGeoBanner geoScope="us" notes={[]} />)
    expect(withoutNotes.container.innerHTML).toBe('')
    // A country pick still renders the committed detail — the line's removal costs nothing.
    act(() => setGeoChoice('UK'))
    expect(withNotes.container.textContent).toContain('Register a private limited company with Companies House.')
  })

  it('geoNotes: the "Outside the US" block renders NOTHING in the Global view (founder 2026-10-02)', () => {
    const { container } = render(<ProcessGeoNotes notes={NOTES} geoScope="us" />)
    // Default (and static HTML): the full per-country detail.
    expect(container.textContent).toContain('Register a private limited company with Companies House.')
    act(() => setGeoChoice(GEO_GLOBAL))
    // Nothing from the block — no heading, no availability line, no portal links.
    expect(container.innerHTML).toBe('')
    // A manual country restores the full per-country detail unchanged.
    act(() => setGeoChoice('UK'))
    expect(container.textContent).toContain('Outside the US')
    expect(container.textContent).toContain('Register a private limited company with Companies House.')
  })

  it('jurisdiction-conditional steps (jca1 family): the whole control disappears', () => {
    const { container } = render(<JurisdictionToggle steps={JURIS_STEPS} base={BASE} />)
    expect(container.textContent).toContain('Delaware-only')
    act(() => setGeoChoice(GEO_GLOBAL))
    expect(container.innerHTML).toBe('')
  })

  it('geo method variants are NOT auto-preselected under Global', () => {
    const { container } = render(
      <StepMethodPicker nodeKey={NODE_KEY} defaultView={defaultView} methods={[ukMethod]} />,
    )
    act(() => setGeoChoice(GEO_GLOBAL))
    // Global reads as geo-neutral to the auto-preselect: the Default method stays selected.
    expect(container.textContent).toContain('Default')
    expect(container.textContent).not.toContain('Companies House')
    // A country pick (the reader not having clicked a method) still auto-preselects.
    act(() => setGeoChoice('UK'))
    expect(container.textContent).toContain('UK — Companies House filing')
  })

  it('vendor-geo annotations are suppressed: Global reads as null to country-consumers', () => {
    const { container } = render(<VendorGeoMark geo={VENDOR_GEO} />)
    act(() => setGeoChoice(GEO_GLOBAL))
    expect(container.innerHTML).toBe('')
    expect(getGeoSelection()).toBeNull()
    act(() => setGeoChoice('UK'))
    expect(container.textContent).toContain('✓')
  })
})

describe('manual country still wins; the switcher writes the shareable token', () => {
  it('Global → UK → US default: every block restores its country behavior unchanged', () => {
    const { container } = render(geoAware)
    act(() => setGeoChoice(GEO_GLOBAL))
    // The geoNotes block AND the banner are gone entirely under Global (founder 2026-10-02;
    // the availability line followed 2026-10-05).
    expect(container.textContent).not.toContain('Outside the US')
    expect(container.textContent).not.toContain('United Kingdom')
    expect(container.textContent).not.toContain('Delaware-only')
    act(() => setGeoChoice('UK'))
    // The wrong-country-flow guard (founder 2026-10-02): the committed UK note LEADS the banner.
    expect(container.textContent).toContain('In the United Kingdom, this runs as:')
    expect(container.textContent).toContain('Register a private limited company with Companies House.')
    expect(container.textContent).toContain('Delaware-only')
    act(() => setGeoChoice(null))
    expect(container.textContent).not.toContain('Global view')
    expect(container.textContent).not.toContain('this runs as:')
    expect(container.textContent).toContain('Delaware-only')
  })

  it('the 🌐 Global pill writes ?geo=global + pa-geo, and country-consumers stay geo-neutral', () => {
    const { getByRole, getByTestId } = render(
      <>
        <GeoSwitcher />
        <Probe />
      </>,
    )
    fireEvent.click(getByRole('button', { name: /Global$/ }))
    expect(`${window.location.pathname}${window.location.search}`).toBe(`${PATH}?geo=global`)
    expect(window.localStorage.getItem('pa-geo')).toBe('global')
    // Country-consumers (useGeoSelection) see the geo-neutral null — never a sixth country.
    expect(getByTestId('probe').textContent).toBe('US-default')
    // And the US pill clears both again.
    fireEvent.click(getByRole('button', { name: /US$/ }))
    expect(`${window.location.pathname}${window.location.search}`).toBe(PATH)
    expect(window.localStorage.getItem('pa-geo')).toBeNull()
  })

  it('GeoSwitcher restores the stored global choice on mount (pa-geo=global, no param)', () => {
    window.localStorage.setItem('pa-geo', 'global')
    const { getByRole } = render(<GeoSwitcher />)
    expect(getByRole('button', { name: /Global$/ }).getAttribute('aria-pressed')).toBe('true')
    expect(getByRole('button', { name: /US$/ }).getAttribute('aria-pressed')).toBe('false')
  })
})
