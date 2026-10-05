// @vitest-environment jsdom
// StepMethodGeo + StepMethodDefault — the geo-resolved method variant (founder 2026-10-05: the
// visible per-step "method: Default ▾ N ways" picker is GONE; the country choice resolves the
// variant silently). Load-bearing assertions:
//   1. SSR-equivalence: the static HTML renders the DEFAULT method — no picker UI of any kind
//      (no "method:" row, no "N ways" counter, no listbox trigger), no variant panel, and the
//      default-method content (StepMethodDefault children) present;
//   2. geo auto-select: a non-US geo selection swaps in the matching geo method's panel — its
//      route badge, honest time, "when:" context, and the honestly relabeled "with this method"
//      ceiling — while the default content hides; clearing the geo (or picking a country no
//      method covers) restores the default exactly;
//   3. situational/vendor variants have NO on-page affordance (the deliberate founder tradeoff:
//      they stay corpus/manifest data) — a geo pick never selects them.
import { render, act } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import StepMethodDefault from '@/components/StepMethodDefault'
import StepMethodGeo from '@/components/StepMethodGeo'
import { setGeoSelection } from '@/lib/geoPreference'
import { resetMethodSelections, stepMethodNodeKey, type StepMethodView } from '@/lib/stepMethods'

const NODE_KEY = stepMethodNodeKey('startup_001', 'n2')

const chip = (over: Partial<StepMethodView['chips'][number]>): StepMethodView['chips'][number] => ({
  vendor: 'lovable',
  label: 'Lovable',
  productId: 'lovable',
  arenaId: 'vibe-coding',
  arenaName: 'Vibe coding',
  agentReady: 80,
  rank: 1,
  signupUrl: null,
  hasLogo: false,
  ...over,
})

const defaultView: StepMethodView = {
  id: 'default',
  label: 'Generate a landing-page smoke test',
  summary: null,
  context: null,
  route: 'agent',
  estimatedMinutes: 20,
  calls: [],
  chips: [chip({})],
  subSteps: [],
  actionUrl: null,
  actionLabel: null,
  ceiling: { agentSteps: 5, totalSteps: 7, pct: 71 },
}

const interviewSprint: StepMethodView = {
  id: 'customer-interview-sprint',
  label: 'Customer-interview sprint',
  summary: 'Interviews over clicks.',
  context: { kind: 'situational', when: 'B2B / enterprise', countries: [] },
  route: 'person',
  estimatedMinutes: 585,
  calls: [],
  chips: [],
  subSteps: [],
  actionUrl: null,
  actionLabel: null,
  ceiling: { agentSteps: 6, totalSteps: 10, pct: 60 },
}

const ukFiling: StepMethodView = {
  id: 'uk-companies-house',
  label: 'UK - Companies House filing',
  summary: 'Register with Companies House.',
  context: { kind: 'geo', when: 'Incorporating in the United Kingdom', countries: ['UK'] },
  route: 'form',
  estimatedMinutes: null,
  calls: [],
  chips: [],
  subSteps: [
    {
      id: 'uk1',
      label: 'File the IN01 with Companies House',
      route: 'form',
      legalSignature: false,
      async: true,
      estimatedMinutes: 30,
      calls: [],
      actionUrl: null,
      actionLabel: null,
      chips: [chip({ vendor: 'chatgpt', label: 'ChatGPT', productId: 'chatgpt', arenaId: 'ai-assistants', arenaName: 'AI assistants' })],
    },
  ],
  actionUrl: 'https://www.gov.uk/limited-company-formation',
  actionLabel: 'Companies House',
  ceiling: { agentSteps: 4, totalSteps: 7, pct: 57 },
}

const methods = [interviewSprint, ukFiling]

function Harness() {
  return (
    <div>
      <StepMethodGeo nodeKey={NODE_KEY} defaultView={defaultView} methods={methods} />
      <StepMethodDefault nodeKey={NODE_KEY}>
        <p>DEFAULT-METHOD-CONTENT</p>
      </StepMethodDefault>
    </div>
  )
}

beforeEach(() => {
  resetMethodSelections()
  setGeoSelection(null)
})

afterEach(() => {
  resetMethodSelections()
  setGeoSelection(null)
})

describe('StepMethodGeo', () => {
  it('SSR renders the default method with NO picker UI: no "method:" row, no "N ways", no listbox trigger, no variant panel', () => {
    const html = renderToString(<Harness />)
    expect(html).toContain('DEFAULT-METHOD-CONTENT')
    expect(html).not.toContain('method:')
    expect(html).not.toContain('ways')
    expect(html).not.toContain('listbox')
    expect(html).not.toContain('Agentic % with this method')
    expect(html).not.toContain('Customer-interview sprint')
    expect(html).not.toContain('Companies House')
  })

  it('mounted with no geo choice: still the default — and there is no button to pick a method manually', () => {
    const { container, queryByText } = render(<Harness />)
    expect(queryByText('DEFAULT-METHOD-CONTENT')).toBeTruthy()
    expect(container.querySelector('button')).toBeNull()
    expect(container.querySelector('[role="listbox"]')).toBeNull()
  })

  it('geo auto-select: a UK selection swaps in the UK method panel (route, when:, sub-DAG, relabeled ceiling) and hides the default; clearing restores it', () => {
    const { getAllByText, getByText, queryByText } = render(<Harness />)
    act(() => setGeoSelection('UK'))
    expect(getByText(/Incorporating in the United Kingdom/)).toBeTruthy()
    expect(getAllByText('manual form').length).toBeGreaterThan(0)
    expect(getByText('File the IN01 with Companies House')).toBeTruthy()
    // The relabeled ceiling names both numbers, default alongside.
    expect(getByText(/Agentic % with this method/)).toBeTruthy()
    expect(getByText('57%')).toBeTruthy()
    expect(getByText(/default method: 71%/)).toBeTruthy()
    expect(queryByText('DEFAULT-METHOD-CONTENT')).toBeNull()
    // A geo no method covers → default (IN has no method here).
    act(() => setGeoSelection('IN'))
    expect(queryByText(/Incorporating in the United Kingdom/)).toBeNull()
    expect(getByText('DEFAULT-METHOD-CONTENT')).toBeTruthy()
    act(() => setGeoSelection('UK'))
    expect(queryByText('DEFAULT-METHOD-CONTENT')).toBeNull()
    act(() => setGeoSelection(null))
    expect(getByText('DEFAULT-METHOD-CONTENT')).toBeTruthy()
  })

  it('situational variants never surface: no geo pick selects them and no affordance reaches them (corpus data, no UI — the founder tradeoff)', () => {
    const { container, queryByText } = render(<Harness />)
    for (const geo of ['UK', 'IN', 'DE'] as const) {
      act(() => setGeoSelection(geo))
      expect(queryByText('Customer-interview sprint')).toBeNull()
      expect(container.querySelector('button')).toBeNull()
    }
  })
})
