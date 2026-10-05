// @vitest-environment jsdom
// ProcessGeoBanner — the top-of-process-page geo banner (founder GEO ask 2026-09-28). The
// honesty matrix is the point: every (geoScope × notes-present/absent) cell says exactly what
// the committed data supports — an analog is promoted only when a curated geoNote exists for
// the selected country, and NEVER fabricated (the unsupported-never-guessed doctrine). The US
// default (and the static HTML) renders nothing, keeping the default page byte-identical.
import { act, render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import GeoStepMark from '@/components/GeoStepMark'
import ProcessGeoBanner from '@/components/ProcessGeoBanner'
import UsFlowLabel from '@/components/UsFlowLabel'
import { GEO_GLOBAL, setGeoChoice, setGeoSelection, type GeoAnalogNote } from '@/lib/geoPreference'

const NOTES: GeoAnalogNote[] = [
  {
    country: 'UK',
    kind: 'analog',
    summary: 'Register a private limited company with Companies House.',
    actionUrl: 'https://www.gov.uk/limited-company-formation',
    actionLabel: 'Companies House — set up a limited company',
  },
]

// The non-analog note kinds (the wrong-country-flow guard, founder 2026-10-02): the committed
// summary IS the local answer — stated plainly, nothing promoted as a doable local flow.
const ABSORBED_NOTES: GeoAnalogNote[] = [
  {
    country: 'IN',
    kind: 'absorbed',
    summary: 'PAN and TAN are allotted automatically as part of the SPICe+ incorporation filing.',
    actionUrl: 'https://www.nsws.gov.in/',
    actionLabel: 'NSWS — incorporate a company',
  },
  {
    country: 'UK',
    kind: 'not-applicable',
    summary: 'No 1099 regime — ordinary contractors self-assess.',
    actionUrl: 'https://www.gov.uk/self-assessment-tax-returns',
    actionLabel: 'HMRC — Self Assessment',
  },
]

afterEach(() => setGeoSelection(null))

const select = (c: 'UK' | 'IN' | 'DE' | 'FR' | null) => act(() => setGeoSelection(c))

describe('default view (US, and the static HTML)', () => {
  it('renders NOTHING without a selection — the default page is byte-identical', () => {
    const tree = <ProcessGeoBanner geoScope="us" notes={NOTES} />
    expect(renderToString(tree)).toBe('')
    const { container } = render(tree)
    expect(container.innerHTML).toBe('')
  })
})

describe('the honesty matrix (geoScope × notes)', () => {
  it("global: 'Global process — the same steps apply in {country}.'", () => {
    const { container } = render(<ProcessGeoBanner geoScope="global" notes={[]} />)
    select('DE')
    expect(container.textContent).toContain('Global process')
    expect(container.textContent).toContain('the same steps apply in Germany.')
  })

  it('global + note for the country: the local flavor renders from committed data only', () => {
    // The mapping expansion (founder ask 2026-09-29): a flavored global process carries notes.
    const { container } = render(<ProcessGeoBanner geoScope="global" notes={NOTES} />)
    select('UK')
    expect(container.textContent).toContain('Global process')
    expect(container.textContent).toContain('the same core steps apply in the United Kingdom.')
    expect(container.textContent).toContain('Local flavor:')
    expect(container.textContent).toContain('Register a private limited company with Companies House.')
    expect(container.querySelector('a[href="https://www.gov.uk/limited-company-formation"]')).not.toBeNull()
    expect(container.querySelector('a[href="#outside-the-us"]')).not.toBeNull()
    // A country without a note stays on the plain global line — nothing borrowed.
    select('FR')
    expect(container.textContent).toContain('the same steps apply in France.')
    expect(container.textContent).not.toContain('Local flavor:')
    expect(container.querySelector('a[href^="https://"]')).toBeNull()
  })

  it("us + analog note: the committed note LEADS — 'In {country}, this runs as:' + the verified link (the wrong-country-flow guard, founder 2026-10-02)", () => {
    const { container } = render(<ProcessGeoBanner geoScope="us" notes={NOTES} />)
    select('UK')
    // The US flow is never presented as the local answer: the country note leads the banner.
    expect(container.textContent).toContain('In the United Kingdom, this runs as:')
    expect(container.textContent).toContain('Register a private limited company with Companies House.')
    expect(container.textContent).not.toContain('US-centric process.')
    const analog = container.querySelector('a[href="https://www.gov.uk/limited-company-formation"]')
    expect(analog?.textContent).toContain('Companies House — set up a limited company')
    // The banner links DOWN to the full multi-country block, which stays on the page.
    expect(container.querySelector('a[href="#outside-the-us"]')).not.toBeNull()
  })

  it("us + absorbed note: the committed summary stated plainly — no 'runs as' promotion, no portal link", () => {
    const { container } = render(<ProcessGeoBanner geoScope="us" notes={ABSORBED_NOTES} />)
    select('IN')
    expect(container.textContent).toContain('PAN and TAN are allotted automatically as part of the SPICe+ incorporation filing.')
    expect(container.textContent).not.toContain('this runs as:')
    expect(container.textContent).not.toContain('US-centric process.')
    // Nothing promoted as a doable local flow — the committed summary is the whole answer.
    expect(container.querySelector('a[href^="https://"]')).toBeNull()
    expect(container.querySelector('a[href="#outside-the-us"]')).not.toBeNull()
  })

  it('us + not-applicable note: the committed summary stated plainly', () => {
    const { container } = render(<ProcessGeoBanner geoScope="us" notes={ABSORBED_NOTES} />)
    select('UK')
    expect(container.textContent).toContain('No 1099 regime — ordinary contractors self-assess.')
    expect(container.textContent).not.toContain('this runs as:')
    expect(container.querySelector('a[href^="https://"]')).toBeNull()
  })

  it('us + NO note for the country: the honest no-mapping line — an analog is never invented', () => {
    const { container } = render(<ProcessGeoBanner geoScope="us" notes={NOTES} />)
    select('IN')
    expect(container.textContent).toContain('US-centric process.')
    expect(container.textContent).toContain('No India mapping yet — this workflow is US-specific.')
    // Nothing borrowed from the UK note.
    expect(container.textContent).not.toContain('Companies House')
    expect(container.querySelector('a[href^="https://"]')).toBeNull()
  })

  it('us-state behaves as US-centric, and with zero notes there is no dangling anchor link', () => {
    const { container } = render(<ProcessGeoBanner geoScope="us-state" notes={[]} />)
    select('FR')
    expect(container.textContent).toContain('US-centric process.')
    expect(container.textContent).toContain('No France mapping yet — this workflow is US-specific.')
    // No "Outside the US" block exists for a notes-less process — no link down to one.
    expect(container.querySelector('a[href="#outside-the-us"]')).toBeNull()
  })

  it('switching back to the US default removes the banner again', () => {
    const { container } = render(<ProcessGeoBanner geoScope="global" notes={[]} />)
    select('UK')
    expect(container.textContent).toContain('Global process')
    select(null)
    expect(container.innerHTML).toBe('')
  })
})

describe("UsFlowLabel — the 'US flow' badge on the step flow (the wrong-country-flow guard, founder 2026-10-02)", () => {
  afterEach(() => setGeoChoice(null))

  it('renders NOTHING in the static HTML and for the US default — the SSR output stays byte-identical', () => {
    const tree = <UsFlowLabel geoScope="us" />
    expect(renderToString(tree)).toBe('')
    const { container } = render(tree)
    expect(container.innerHTML).toBe('')
  })

  it("labels the flow 'US flow' under an explicit country choice, for us AND us-state scope", () => {
    const us = render(<UsFlowLabel geoScope="us" />)
    const usState = render(<UsFlowLabel geoScope="us-state" />)
    select('IN')
    expect(us.container.textContent).toContain('US flow')
    expect(usState.container.textContent).toContain('US flow')
    // Clearing back to the US default removes the badge again.
    select(null)
    expect(us.container.innerHTML).toBe('')
  })

  it('renders nothing for a global-scope process and under the explicit 🌐 Global choice', () => {
    const globalScope = render(<UsFlowLabel geoScope="global" />)
    select('DE')
    expect(globalScope.container.innerHTML).toBe('')
    const usScope = render(<UsFlowLabel geoScope="us" />)
    act(() => setGeoChoice(GEO_GLOBAL))
    expect(usScope.container.innerHTML).toBe('')
  })
})

describe('GeoStepMark (the subtle per-step 🇺🇸 marker)', () => {
  it('renders nothing by default and in the static HTML; flags US-specific steps under a selection', () => {
    expect(renderToString(<GeoStepMark />)).toBe('')
    const { container } = render(<GeoStepMark />)
    expect(container.innerHTML).toBe('')
    select('DE')
    expect(container.textContent).toBe('🇺🇸')
    expect(container.querySelector('span')?.getAttribute('title')).toContain('Germany')
    select(null)
    expect(container.innerHTML).toBe('')
  })
})
