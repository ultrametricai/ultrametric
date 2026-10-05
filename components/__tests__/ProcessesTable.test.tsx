// @vitest-environment jsdom
// ProcessesTable's shareable-view URL params (founder 2026-09-21, lib/urlState.ts):
//   ?order=<preset>  the sort/ordering ('timeline' spells the timeOrder column; 'grouped' the
//                    grouped-by-area view; the founder-timeline default elided)
//   ?phase=<phase>   phase filter ('all' elided)
//   ?pq=<text>       text filter (pq, NOT q — must coexist with MegaTable's ?q on the homepage)
// Contract per param: (a) present on mount → the view applies after hydration, (b) changing the
// control writes it, (c) the default state removes it; invalid values fall back silently.
// Since 2026-09-30 the no-param default is the flat FOUNDER-TIMELINE sort — the rank-by
// dropdown visibly shows 'Founder timeline' — and the grouped-by-area view (the 2026-09-28
// default) is the dropdown's TOP entry, shareable as ?order=grouped.
import { act, fireEvent, render, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import ProcessesTable, { type PlaybookRow, type ProcessRow } from '@/components/ProcessesTable'
import { GEO_GLOBAL, setGeoChoice, setGeoSelection } from '@/lib/geoPreference'

const PATH = '/'
const setUrl = (search: string) => window.history.replaceState(null, '', `${PATH}${search}`)
const params = () => new URLSearchParams(window.location.search)

function row(over: Pick<ProcessRow, 'slug' | 'title' | 'phase'> & Partial<ProcessRow>): ProcessRow {
  return {
    icon: '🏦',
    area: 'Formation',
    areaRank: 0,
    geoScope: 'global',
    geoNotesByCountry: {},
    kind: 'process',
    trigger: null,
    urgency: null,
    pct: 50,
    agentSteps: 2,
    totalSteps: 4,
    complexity: 'medium',
    timeOrder: 1,
    cadenceLabel: 'Monthly',
    cadenceRank: 3,
    annoyance: 3,
    risk: 3,
    growthImpact: 3,
    vendors: [{ id: 'mercury', label: 'Mercury', arena: 'startup-banking', hasLogo: false }],
    ...over,
  }
}

// Two areas; 'Formation' (the merged startup+formation area — founder 2026-09-30) holds two
// rows deliberately OUT of timeOrder in the array (bank timeOrder 2 before incorporate
// timeOrder 1) so both the default timeline sort and the grouped view's within-area ordering
// are proven, not inherited. 'Growth & sales' (rank 8) comes after 'Formation' (rank 0).
// Phases are corpus-style lowercase so the capitalized AREA probes never match a phase cell.
const ROWS: ProcessRow[] = [
  row({ slug: 'open-bank-account', title: 'Open a bank account', phase: 'formation', risk: 5, timeOrder: 2, pct: 40 }),
  row({ slug: 'run-payroll', title: 'Run payroll', phase: 'growth', area: 'Growth & sales', areaRank: 8, risk: 2, timeOrder: 5, pct: 90 }),
  row({ slug: 'incorporate', title: 'Incorporate the company', phase: 'formation', risk: 4, timeOrder: 1, pct: 60 }),
]
const PHASES = ['formation', 'growth']

// The visual order of the table: area headers and row titles as they appear top-to-bottom.
const bodyOrder = (root: HTMLElement) =>
  [...root.querySelectorAll('tbody tr')].map((tr) => {
    for (const probe of ['Formation', 'Growth & sales', 'Open a bank account', 'Run payroll', 'Incorporate the company']) {
      if (tr.textContent?.includes(probe)) return probe
    }
    return '?'
  })

const mount = () => render(<ProcessesTable rows={ROWS} phases={PHASES} />)

const thFor = (root: HTMLElement, label: string) =>
  within(root).getAllByText(label).map((el) => el.closest('th')).find((th) => th !== null) ?? null

beforeEach(() => setUrl(''))


// The rank-by presets live in ONE dropdown (founder 2026-09-30) — open it, pick the option.
const pickPreset = (scope: { getByRole: (role: string, opts?: object) => HTMLElement }, label: string) => {
  fireEvent.click(scope.getByRole('button', { name: /Rank by|Grouped by area|Most automatable|Founder timeline|Regularity|Most annoying|Riskiest|Growth-focused/ }))
  // Scope to the LISTBOX — the mobile fallback <select>'s options share the role in jsdom.
  const listbox = scope.getByRole('listbox', { name: 'Rank by' })
  fireEvent.click(within(listbox).getByRole('option', { name: new RegExp(label) }))
}

describe('mount applies URL params (invalids fall back silently)', () => {
  it("pristine URL renders the default view: flat founder-timeline sort, the dropdown showing 'Founder timeline'", () => {
    const { container, getByRole } = mount()
    // Flat — no area group headers.
    expect(within(container).queryByText('Formation')).toBeNull()
    expect(thFor(container, 'Timeline')?.getAttribute('aria-sort')).toBe('ascending')
    // Rows in timeOrder: incorporate (1) → bank (2) → payroll (5), despite the array order.
    expect(bodyOrder(container)).toEqual(['Incorporate the company', 'Open a bank account', 'Run payroll'])
    // The rank-by control visibly shows the default selection (founder 2026-09-30).
    expect(getByRole('button', { name: /Founder timeline/ })).toBeDefined()
    expect((within(container).getByLabelText('Filter by phase') as HTMLSelectElement).value).toBe('all')
  })

  it("the Steps column is GONE (founder 2026-10-02): no header, no N/M cell, no 'Most steps' preset — and the ceiling chip reads the bare percentage", () => {
    const { container, getByRole } = mount()
    expect([...container.querySelectorAll('thead th')].some((th) => th.textContent?.includes('Steps'))).toBe(false)
    expect(container.textContent).not.toContain('2/4') // the fixture rows' agentSteps/totalSteps
    expect(container.querySelector('a[href$="#steps"]')).toBeNull()
    // The rank-by dropdown no longer offers 'Most steps', and ?order=steps falls back silently.
    fireEvent.click(getByRole('button', { name: /Founder timeline/ }))
    const listbox = getByRole('listbox', { name: 'Rank by' })
    expect(within(listbox).queryByRole('option', { name: /Most steps/ })).toBeNull()
    // The ceiling chip dropped the word 'agent' (founder 2026-10-02) — aria-label keeps the
    // concept.
    expect(container.textContent).not.toContain('% agent')
    expect(within(container).getAllByText('40%').length).toBeGreaterThan(0) // bank row's ceiling chip
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toMatch(/% of steps agent-runnable$/)
  })

  it("styling pins (founder 2026-10-05): 'Area' header (not 'Phase'), sentence-case headers (no uppercase transform), rounded-2xl wrapper, and the vendor cell's '→' replacing '+N'", () => {
    const manyVendors = [
      row({
        slug: 'open-bank-account', title: 'Open a bank account', phase: 'formation',
        vendors: ['Mercury', 'Brex', 'Ramp', 'Relay', 'Novo'].map((label) => ({ id: label.toLowerCase(), label, arena: 'startup-banking', hasLogo: false })),
      }),
    ]
    const { container } = render(<ProcessesTable rows={manyVendors} phases={PHASES} />)
    const headerRow = container.querySelector('thead tr') as HTMLElement
    expect(headerRow.textContent).toContain('Area')
    expect(headerRow.textContent).not.toContain('Phase')
    expect(headerRow.className).not.toContain('uppercase')
    expect(headerRow.className).toContain('text-xs')
    expect(container.querySelector('.rounded-2xl.border')).toBeTruthy()
    // Every vendor renders as a chip (the one-row clip is CSS; jsdom sees all five) and the
    // overflow affordance is the accessible '→', never '+N'. No tooltip on vendor chips
    // (founder 2026-10-05) — the ?via= destination lives in the aria-label instead.
    expect(within(container).getAllByLabelText(/viewed via/).length).toBe(5)
    expect(container.querySelector('a[title*="viewed via"]')).toBeNull()
    expect(container.textContent).not.toMatch(/\+\d/)
    const arrow = within(container).getByLabelText('All vendors and steps — open Open a bank account')
    expect(arrow.getAttribute('href')).toBe('/processes/open-bank-account')
    expect(arrow.textContent).toBe('→')
  })

  it('?order=steps (the retired column) falls back silently to the default timeline view', () => {
    setUrl('?order=steps')
    const { container } = mount()
    expect(thFor(container, 'Timeline')?.getAttribute('aria-sort')).toBe('ascending')
    expect(within(container).queryByText('Formation')).toBeNull() // flat default, no grouped leak
  })

  it('?order=risk sorts by risk in its preset direction (desc)', () => {
    setUrl('?order=risk')
    const { container } = mount()
    expect(thFor(container, 'Risk')?.getAttribute('aria-sort')).toBe('descending')
    const titles = within(container).getAllByText(/Open a bank account|Run payroll/).map((el) => el.textContent)
    expect(titles.indexOf('Open a bank account')).toBeLessThan(titles.indexOf('Run payroll')) // risk 5 first
  })

  it("?order=timeline (the default, elided on write) is still accepted on read", () => {
    setUrl('?order=timeline')
    const { container } = mount()
    expect(thFor(container, 'Timeline')?.getAttribute('aria-sort')).toBe('ascending')
  })

  it('?order=grouped opens the grouped-by-area view (the former default), no column sorted', () => {
    setUrl('?order=grouped')
    const { container } = mount()
    expect(within(container).getByText('Formation')).toBeDefined() // area headers render
    expect(thFor(container, 'Agentic %')?.getAttribute('aria-sort')).toBe('none')
    expect(thFor(container, 'Cadence')?.getAttribute('aria-sort')).toBe('none')
  })

  it('?phase= and ?pq= apply the phase filter and search box', () => {
    setUrl('?phase=growth&pq=payroll')
    const { container } = mount()
    expect((within(container).getByLabelText('Filter by phase') as HTMLSelectElement).value).toBe('growth')
    expect((within(container).getByLabelText('Filter products by name or vendor') as HTMLInputElement).value).toBe('payroll')
    expect(within(container).queryByText('Open a bank account')).toBeNull()
    expect(within(container).getByText('Run payroll')).toBeDefined()
  })

  it('invalid ?order/?phase fall back to the defaults (the flat timeline view), silently', () => {
    setUrl('?order=vibes&phase=Retirement')
    const { container } = mount()
    expect(within(container).queryByText('Formation')).toBeNull() // flat — no area headers
    expect(thFor(container, 'Timeline')?.getAttribute('aria-sort')).toBe('ascending')
    expect((within(container).getByLabelText('Filter by phase') as HTMLSelectElement).value).toBe('all')
  })

  it('?order=pct opens the flat ceiling-sorted view', () => {
    setUrl('?order=pct')
    const { container } = mount()
    expect(within(container).queryByText('Formation')).toBeNull() // flat, no area headers
    expect(thFor(container, 'Agentic %')?.getAttribute('aria-sort')).toBe('descending')
  })
})

describe('interactions write params; defaults remove them', () => {
  it('an ordering preset writes ?order=, and the default (Founder timeline) removes it', () => {
    const { getByRole } = mount()
    pickPreset({ getByRole }, 'Riskiest')
    expect(params().get('order')).toBe('risk')
    pickPreset({ getByRole }, 'Most automatable')
    expect(params().get('order')).toBe('pct') // no longer the default — written since 2026-09-30
    pickPreset({ getByRole }, 'Founder timeline') // the default sort — param gone
    expect(params().get('order')).toBeNull()
  })

  it('the phase <select> and the in-row phase button write ?phase=; All/again clears it', () => {
    const { container } = mount()
    const select = within(container).getByLabelText('Filter by phase')
    fireEvent.change(select, { target: { value: 'formation' } })
    expect(params().get('phase')).toBe('formation')
    fireEvent.change(select, { target: { value: 'all' } })
    expect(params().get('phase')).toBeNull()

    const phaseButton = within(container).getByTitle(/click to filter to growth/)
    fireEvent.click(phaseButton)
    expect(params().get('phase')).toBe('growth')
    fireEvent.click(within(container).getByTitle(/click to clear the phase filter/))
    expect(params().get('phase')).toBeNull()
  })

  it('the search box writes ?pq= and clears it when emptied', () => {
    const { container } = mount()
    const input = within(container).getByLabelText('Filter products by name or vendor')
    fireEvent.change(input, { target: { value: 'bank' } })
    expect(params().get('pq')).toBe('bank')
    fireEvent.change(input, { target: { value: '' } })
    expect(params().get('pq')).toBeNull()
  })

  it("patches, never rebuilds: MegaTable's ?rank/?q and HomeModes' ?view survive (homepage co-mount)", () => {
    setUrl('?view=processes&rank=popularity&q=stripe')
    const { getByRole } = mount()
    pickPreset({ getByRole }, 'Growth-focused')
    const p = params()
    expect(p.get('view')).toBe('processes')
    expect(p.get('rank')).toBe('popularity')
    expect(p.get('q')).toBe('stripe')
    expect(p.get('order')).toBe('growth')
  })
})

describe("grouped-by-area view (founder 2026-09-28; the dropdown's top entry since 2026-09-30)", () => {
  it("picking 'Grouped by area' renders area headers in lifecycle order with counts, rows in timeOrder within each area, and writes ?order=grouped", () => {
    const { container, getByRole } = mount()
    pickPreset({ getByRole }, 'Grouped by area')
    expect(params().get('order')).toBe('grouped')
    // Areas in AREA_ORDER (areaRank), rows re-sorted by timeOrder inside 'Formation'
    // (incorporate timeOrder 1 before bank timeOrder 2, despite the array order).
    expect(bodyOrder(container)).toEqual([
      'Formation', 'Incorporate the company', 'Open a bank account',
      'Growth & sales', 'Run payroll',
    ])
    // Header stats: count only (avg ceiling dropped — founder 2026-09-29).
    const formation = within(container).getByText('Formation').closest('tr') as HTMLElement
    expect(formation.textContent).toContain('2 processes')
    expect(formation.textContent).not.toContain('%')
    const growth = within(container).getByText('Growth & sales').closest('tr') as HTMLElement
    expect(growth.textContent).toContain('1 process')
  })

  it('a rank-by preset flattens the grouped view; the timeline default clears ?order=', () => {
    setUrl('?order=grouped')
    const { container, getByRole } = mount()
    expect(within(container).getByText('Formation')).toBeDefined()
    pickPreset({ getByRole }, 'Riskiest')
    expect(within(container).queryByText('Formation')).toBeNull() // flat — headers gone
    expect(thFor(container, 'Risk')?.getAttribute('aria-sort')).toBe('descending')
    expect(params().get('order')).toBe('risk')

    pickPreset({ getByRole }, 'Grouped by area')
    expect(within(container).getByText('Formation')).toBeDefined() // grouped again
    expect(params().get('order')).toBe('grouped')
    pickPreset({ getByRole }, 'Founder timeline')
    expect(params().get('order')).toBeNull() // back to the no-param default
  })

  it('a column-header sort also flattens (grouping and cross-corpus sorting cannot coexist)', () => {
    setUrl('?order=grouped')
    const { container } = mount()
    const processTh = thFor(container, 'Process') as HTMLElement
    fireEvent.click(within(processTh).getByRole('button'))
    expect(within(container).queryByText('Formation')).toBeNull()
    expect(processTh.getAttribute('aria-sort')).toBe('ascending') // title's preset direction
    expect(params().get('order')).toBe('title')
  })

  it('the phase filter collapses the grouped view to the matching area(s)', () => {
    setUrl('?order=grouped')
    const { container } = mount()
    fireEvent.change(within(container).getByLabelText('Filter by phase'), { target: { value: 'formation' } })
    expect(within(container).getByText('Formation')).toBeDefined()
    expect(within(container).queryByText('Growth & sales')).toBeNull()
    expect(within(container).queryByText('Run payroll')).toBeNull()
    expect(params().get('phase')).toBe('formation') // URL contract untouched in the grouped view
  })
})

describe('chain rows in the combined table (founder 2026-09-29: one view under the search; the same-day follow-up drops the "playbook" vocabulary — chain rows fold into their dominant area)', () => {
  function playbook(over: Pick<PlaybookRow, 'id' | 'title'> & Partial<PlaybookRow>): PlaybookRow {
    return {
      tagline: 'From zero to a running company',
      icon: '🚀',
      href: `/processes/chains/${over.id}`,
      // Dominant area = the FIRST constituent's area; timeOrder = that constituent's timeOrder.
      // Set to 'Formation' at timeOrder 1 so the grouped test proves the fold: the chain ties
      // with Incorporate (timeOrder 1) and the plain process leads on a tie.
      dominantArea: 'Formation',
      areaRank: 0,
      timeOrder: 1,
      // Titles deliberately distinct from ROWS' (IconChip renders its title as sr-only text —
      // colliding names would make textContent probes ambiguous).
      processes: [
        { id: 'pick-a-name', icon: '🏷️', title: 'Pick a company name', phase: 'formation' },
        { id: 'file-delaware', icon: '🏛', title: 'File with Delaware', phase: 'formation' },
      ],
      phases: ['formation'],
      pct: 70,
      agentSteps: 7,
      totalSteps: 10,
      // The vendor cell (founder 2026-10-02): chips instead of the old 'Go to process' link.
      vendors: [
        { id: 'clerky', label: 'Clerky', arena: 'legal-ops', hasLogo: false },
        { id: 'stripe-atlas', label: 'Stripe Atlas', arena: 'legal-ops', hasLogo: false },
      ],
      steps: [
        { label: 'File the charter', route: 'agent' as const, legalSignature: false },
        { label: 'Sign the incorporator consent', route: 'person' as const, legalSignature: true },
      ],
      ...over,
    }
  }
  const PLAYBOOKS: PlaybookRow[] = [playbook({ id: 'company-in-a-day', title: 'Company in a day' })]
  const mountWith = (playbooks = PLAYBOOKS) => render(<ProcessesTable rows={ROWS} phases={PHASES} playbooks={playbooks} />)
  const rowTexts = (root: HTMLElement) => [...root.querySelectorAll('tbody tr')].map((tr) => tr.textContent ?? '')

  it('grouped view: the chain row folds into its dominant area at its first-constituent timeOrder — no leading Playbooks group, no playbook label', () => {
    setUrl('?order=grouped')
    const { container } = mountWith()
    const texts = rowTexts(container)
    const at = (probe: string) => texts.findIndex((t) => t.includes(probe))
    // No 'Playbooks' group header and no 'playbook' chip anywhere — one vocabulary.
    expect(within(container).queryByText('Playbooks')).toBeNull()
    expect(within(container).queryByText('playbook')).toBeNull()
    // Inside 'Formation' (its dominant area): Incorporate (timeOrder 1, plain process leads
    // the tie) → Company in a day (timeOrder 1) → Open a bank account (timeOrder 2).
    expect(at('Formation')).toBeLessThan(at('Company in a day'))
    expect(at('Incorporate the company')).toBeLessThan(at('Company in a day'))
    expect(at('Company in a day')).toBeLessThan(at('Open a bank account'))
    expect(at('Company in a day')).toBeLessThan(at('Growth & sales')) // inside the area, not after it
    // The area header counts the chain row as a process (playbooks are still processes).
    const header = within(container).getByText('Formation').closest('tr') as HTMLElement
    expect(header.textContent).toContain('3 processes')
  })

  it('a chain row keeps its composition signals and links to its chain page: constituent chips, honest metric dash — no category chip', () => {
    const { container } = mountWith()
    const tr = within(container).getByText('Company in a day').closest('tr') as HTMLElement
    expect(within(tr).queryByText('playbook')).toBeNull() // the chip is gone (founder 2026-09-29)
    expect(within(tr).getByText('Company in a day').closest('a')?.getAttribute('href')).toBe('/processes/chains/company-in-a-day')
    expect(tr.textContent).not.toContain('7/10') // the aggregate Steps cell left with its column (founder 2026-10-02)
    // Route-dot strip removed (founder 2026-09-29) — no per-step dots render.
    expect(within(tr).queryByTitle('File the charter — agent-runnable')).toBeNull()
    // No timeline/cadence/risk value to show — the metric cell is an honest dash.
    expect(within(tr).getByText('—')).toBeDefined()
    // The vendor cell carries the chips themselves (founder 2026-10-02), each opening the
    // playbook through that vendor's ?via= lens — no 'Go to process' link.
    expect(within(tr).queryByText('Go to process →')).toBeNull()
    expect(within(tr).getByText('Clerky').closest('a')?.getAttribute('href')).toBe(
      '/processes/chains/company-in-a-day?via=legal-ops:clerky',
    )
    expect(within(tr).getByText('Stripe Atlas')).toBeDefined()
    // Process rows are unchanged next to it (their own links intact).
    expect(within(container).getByText('Run payroll').closest('a')?.getAttribute('href')).toBe('/processes/run-payroll')
  })

  it('a ceiling sort interleaves chain rows by their aggregate ceiling (flat semantics unchanged)', () => {
    const { container, getByRole } = mountWith()
    pickPreset({ getByRole }, 'Most automatable')
    const texts = rowTexts(container)
    const at = (probe: string) => texts.findIndex((t) => t.includes(probe))
    // pct desc: Run payroll 90 → chain 70 → Incorporate 60 → bank 40.
    expect(at('Run payroll')).toBeLessThan(at('Company in a day'))
    expect(at('Company in a day')).toBeLessThan(at('Incorporate the company'))
    expect(within(container).queryByText('Formation')).toBeNull() // flat — no group headers
  })

  it('a per-process ordering (risk) lists chain rows after the sorted processes — missing values last', () => {
    const { container, getByRole } = mountWith()
    pickPreset({ getByRole }, 'Riskiest')
    const texts = rowTexts(container)
    expect(texts.findIndex((t) => t.includes('Company in a day'))).toBe(texts.length - 1)
  })

  it('the default founder-timeline view also lists chain rows after the sorted processes (no timeOrder of their own in the flat view)', () => {
    const { container } = mountWith()
    const texts = rowTexts(container)
    expect(texts.findIndex((t) => t.includes('Company in a day'))).toBe(texts.length - 1)
  })

  it('the phase filter scopes chain rows by their constituent processes; the text filter matches name and taglines', () => {
    const { container } = mountWith()
    fireEvent.change(within(container).getByLabelText('Filter by phase'), { target: { value: 'growth' } })
    expect(within(container).queryByText('Company in a day')).toBeNull() // formation-only chain filtered out
    fireEvent.change(within(container).getByLabelText('Filter by phase'), { target: { value: 'formation' } })
    expect(within(container).getByText('Company in a day')).toBeDefined()

    fireEvent.change(within(container).getByLabelText('Filter by phase'), { target: { value: 'all' } })
    const search = within(container).getByLabelText('Filter products by name or vendor')
    fireEvent.change(search, { target: { value: 'zero to a running' } }) // the tagline
    expect(within(container).getByText('Company in a day')).toBeDefined()
    expect(within(container).queryByText('Run payroll')).toBeNull()
    fireEvent.change(search, { target: { value: 'zzz-no-match' } })
    // One vocabulary in the empty state too — chain rows are processes.
    expect(container.textContent).toContain('No processes match')
    expect(container.textContent).not.toContain('playbooks')
  })

  it('without a playbooks prop the table renders exactly the process-only view (homepage co-mount)', () => {
    const { container } = mount()
    expect(within(container).queryByText('Playbooks')).toBeNull()
    expect(within(container).queryByText('playbook')).toBeNull()
  })
})

describe('geoScope glyphs (founder batch 2026-10-02: the 🇺🇸 flag keys STRICTLY on geoScope us/us-state; global rows wear no scope glyph; no 🌐/🏛 ever follows a title)', () => {
  // The module-level geo store outlives unmounts — always reset.
  afterEach(() => setGeoSelection(null))
  // The US-scoped rows carry UK ANALOG notes — since the founder override 2026-10-05 a UK
  // selection hides them anyway (a country view shows no US-scoped row); this describe pins
  // the GLYPHS on the no-selection and Global framings, and the country-view FILTER has its
  // own describe below.
  const GEO_ROWS: ProcessRow[] = [
    row({ slug: 'open-bank-account', title: 'Open a bank account', phase: 'formation', geoScope: 'global' }),
    row({
      slug: 'incorporate', title: 'Incorporate the company', phase: 'formation', geoScope: 'us-state', timeOrder: 2,
      geoNotesByCountry: { UK: { kind: 'analog', summary: 'Register a private limited company with Companies House.' } },
    }),
    row({
      slug: 'get-an-ein', title: 'Get an EIN', phase: 'formation', geoScope: 'us', timeOrder: 3,
      geoNotesByCountry: { UK: { kind: 'analog', summary: 'Register for Corporation Tax with HMRC.' } },
    }),
  ]
  const cellFor = (root: HTMLElement, title: string) =>
    [...root.querySelectorAll('tbody td:first-child')].find((c) => c.textContent?.includes(title))

  it('no selection: us AND us-state rows wear 🇺🇸; the GLOBAL row wears NO scope glyph at all (no 🌐, no 🏛)', () => {
    const { container } = render(<ProcessesTable rows={GEO_ROWS} phases={PHASES} />)
    expect(cellFor(container, 'Open a bank account')?.textContent).not.toContain('🌐')
    expect(cellFor(container, 'Open a bank account')?.textContent).not.toContain('🇺🇸')
    expect(cellFor(container, 'Incorporate the company')?.textContent).toContain('🇺🇸')
    expect(cellFor(container, 'Get an EIN')?.textContent).toContain('🇺🇸')
    // 🏛 never follows a title (founder 2026-10-02: 'Set up registered agent 🏛' read as a
    // duplicate icon) — the us-state flag's LABEL still tells state from federal work.
    expect(cellFor(container, 'Incorporate the company')?.textContent).not.toContain('🏛')
    expect(cellFor(container, 'Incorporate the company')?.querySelector('span[title*="US state-level"]')?.textContent).toBe('🇺🇸')
  })

  it('a non-US selection hides the US-scoped rows entirely (founder override 2026-10-05 — analog notes included); clearing it restores them with their flags', () => {
    const { container } = render(<ProcessesTable rows={GEO_ROWS} phases={PHASES} />)
    act(() => setGeoSelection('UK'))
    // Only the global row survives the UK view — and it still wears no scope glyph.
    expect(cellFor(container, 'Open a bank account')?.textContent).not.toContain('🌐')
    expect(cellFor(container, 'Incorporate the company')).toBeUndefined()
    expect(cellFor(container, 'Get an EIN')).toBeUndefined()
    // Clearing the selection restores the full corpus and the selection-independent flags.
    act(() => setGeoSelection(null))
    expect(cellFor(container, 'Incorporate the company')?.textContent).toContain('🇺🇸')
    expect(cellFor(container, 'Get an EIN')?.textContent).toContain('🇺🇸')
    expect(cellFor(container, 'Incorporate the company')?.textContent).not.toContain('🏛')
  })

  it('PIN: a geoScope-global record can NEVER render the flag (the qs_023 audit, founder 2026-10-02) — in any framing or selection', () => {
    const { container } = render(<ProcessesTable rows={GEO_ROWS} phases={PHASES} defaultGeo={GEO_GLOBAL} />)
    expect(cellFor(container, 'Open a bank account')?.textContent).not.toContain('🇺🇸')
    act(() => setGeoSelection('UK'))
    expect(cellFor(container, 'Open a bank account')?.textContent).not.toContain('🇺🇸')
  })

  describe('the GLOBAL surface default (founder 2026-09-30: /processes opens on the global view — defaultGeo threads in from app/processes/page.tsx)', () => {
    it('no selection: every row still renders (annotates, never filters) — flags on US-scoped rows only — and the geo dropdown trigger reads Global', () => {
      const { container, getByTitle } = render(<ProcessesTable rows={GEO_ROWS} phases={PHASES} defaultGeo={GEO_GLOBAL} />)
      // Nothing filtered out: the US-specific rows are in the first view.
      expect(container.querySelectorAll('tbody tr').length).toBe(GEO_ROWS.length)
      expect(cellFor(container, 'Open a bank account')?.textContent).not.toContain('🌐')
      expect(cellFor(container, 'Get an EIN')?.textContent).toContain('🇺🇸')
      expect(cellFor(container, 'Incorporate the company')?.textContent).toContain('🇺🇸')
      expect(cellFor(container, 'Incorporate the company')?.textContent).not.toContain('🏛')
      // The dropdown's no-selection framing is 🌐 Global on this surface.
      expect(getByTitle(/Where you operate/).textContent).toContain('Global')
      // Annotation only — the timeOrder sort is untouched by the framing.
      expect([...container.querySelectorAll('tbody td:first-child')].map((c) =>
        c.textContent?.includes('Open a bank account') ? 'bank' : c.textContent?.includes('Incorporate') ? 'inc' : 'ein',
      )).toEqual(['bank', 'inc', 'ein'])
    })

    it('SSR honesty: the server HTML already carries the Global trigger and the flags — and no title-trailing 🏛/🌐', () => {
      const ssr = renderToString(<ProcessesTable rows={GEO_ROWS} phases={PHASES} defaultGeo={GEO_GLOBAL} />)
      expect(ssr).toContain('Global')
      // The us-state LABEL still tells the state story; its glyph is the flag.
      expect(ssr).toContain('US state-level process — a US state is the counterparty')
      const doc = document.createElement('div')
      doc.innerHTML = ssr
      const titleCells = [...doc.querySelectorAll('tbody td:first-child')]
      // Title cells carry 🇺🇸 on the US-scoped rows only — never 🏛 or 🌐 (the phase select's
      // own 🏛️ area emoji is a different, unrelated glyph outside the table).
      expect(titleCells.filter((c) => c.textContent?.includes('🇺🇸'))).toHaveLength(2)
      expect(titleCells.some((c) => c.textContent?.includes('🏛'))).toBe(false)
      expect(titleCells.some((c) => c.textContent?.includes('🌐'))).toBe(false)
    })

    it('a country selection hides analog-noted rows too (founder override 2026-10-05; dropdown shows the country); without defaultGeo the homepage surface reads USA', () => {
      const withGlobal = render(<ProcessesTable rows={GEO_ROWS} phases={PHASES} defaultGeo={GEO_GLOBAL} />)
      act(() => setGeoSelection('UK'))
      expect(cellFor(withGlobal.container, 'Incorporate the company')).toBeUndefined()
      expect(withGlobal.getByTitle(/Where you operate/).textContent).toContain('United Kingdom')
      withGlobal.unmount()
      act(() => setGeoSelection(null))
      // The homepage's process mode (no defaultGeo) renders the same glyph rule.
      const plain = render(<ProcessesTable rows={GEO_ROWS} phases={PHASES} />)
      expect(cellFor(plain.container, 'Incorporate the company')?.textContent).toContain('🇺🇸')
      expect(cellFor(plain.container, 'Incorporate the company')?.textContent).not.toContain('🏛')
      expect(plain.getByTitle(/Where you operate/).textContent).toContain('USA')
    })
  })
})

describe('the country-view filter (founder 2026-10-02, tightened 2026-10-05: an explicit country view shows NO US-scoped row — analogs included; the filter just filters since the same-day removal of the hidden-rows disclosure — the per-country analog detail lives on the process detail pages)', () => {
  afterEach(() => setGeoChoice(null))

  // A miniature of the real curation: one global row, a full-analog row, the EIN row (absorbed
  // in IN/UK/FR, a real ELSTER filing in DE), a not-applicable-in-the-UK row, and a US-scoped
  // SITUATION with no notes at all (the sit_002 visa shape — it hides honestly everywhere).
  const analog = (summary: string) => ({ kind: 'analog' as const, summary })
  const FILTER_ROWS: ProcessRow[] = [
    row({ slug: 'pick-a-name', title: 'Pick a company name', phase: 'formation', geoScope: 'global', timeOrder: 1 }),
    row({
      slug: 'incorporate-c-corp', title: 'Incorporate C-Corp', phase: 'formation', geoScope: 'us', timeOrder: 2,
      geoNotesByCountry: {
        IN: analog('Incorporate through MCA’s SPICe+ integrated form.'),
        UK: analog('Register a private limited company with Companies House.'),
        DE: analog('Form a GmbH (or UG) with a notarized deed.'),
        FR: analog('Form a SAS/SASU through the INPI guichet unique.'),
      },
    }),
    row({
      slug: 'get-ein', title: 'Get EIN', phase: 'formation', geoScope: 'us', timeOrder: 3,
      geoNotesByCountry: {
        IN: { kind: 'absorbed', summary: 'PAN and TAN are allotted automatically as part of the SPICe+ incorporation filing.' },
        UK: { kind: 'absorbed', summary: 'HMRC posts the company a UTR automatically after incorporation.' },
        DE: analog('The tax office issues a Steuernummer after you file the Fragebogen on ELSTER.'),
        FR: { kind: 'absorbed', summary: 'INSEE allots the SIREN/SIRET automatically when the registration lands.' },
      },
    }),
    row({
      slug: 'issue-1099s', title: 'Issue 1099s', phase: 'compliance', geoScope: 'us', timeOrder: 4,
      geoNotesByCountry: {
        IN: analog('TDS: deduct tax at source from contractor fees and file quarterly returns.'),
        UK: { kind: 'not-applicable', summary: 'No 1099 regime — ordinary contractors self-assess.' },
      },
    }),
    row({
      slug: 'visa-is-held-up', title: 'Visa is held up', phase: 'hr', geoScope: 'us', kind: 'situation',
      timeOrder: null, trigger: 'Your visa petition is stuck in processing.', urgency: 'weeks',
    }),
  ]
  const titles = (root: HTMLElement) =>
    [...root.querySelectorAll('tbody tr')].map((tr) =>
      ['Pick a company name', 'Incorporate C-Corp', 'Get EIN', 'Issue 1099s', 'Visa is held up'].find((t) => tr.textContent?.includes(t)) ?? '?')
  const mountFilter = () => render(<ProcessesTable rows={FILTER_ROWS} phases={['formation', 'compliance', 'hr']} defaultGeo={GEO_GLOBAL} />)

  it('the no-selection default and the explicit 🌐 Global view keep the FULL corpus — nothing hidden, no disclosure line', () => {
    const { container } = mountFilter()
    expect(titles(container)).toHaveLength(FILTER_ROWS.length)
    expect(container.textContent).not.toContain('hidden in the')
    // The explicit Global pick is byte-equal to the pristine row set (only the trigger changes).
    act(() => setGeoChoice(GEO_GLOBAL))
    expect(titles(container)).toHaveLength(FILTER_ROWS.length)
    expect(container.textContent).not.toContain('hidden in the')
  })

  it('under 🇮🇳 India EVERY US-scoped row hides — the IN analogs (incorporation, TDS) included; only the global row stays', () => {
    const { container } = mountFilter()
    act(() => setGeoChoice('IN'))
    expect(titles(container)).toEqual(['Pick a company name'])
    expect(within(container).queryByText('Get EIN')).toBeNull()
    expect(within(container).queryByText('Incorporate C-Corp')).toBeNull()
    expect(within(container).queryByText('Issue 1099s')).toBeNull()
    expect(within(container).queryByText('Visa is held up')).toBeNull()
  })

  it('under 🇬🇧 and 🇩🇪 the row set is the same global-only view — an analog note no longer re-admits a row (the 2026-10-05 override)', () => {
    const { container } = mountFilter()
    act(() => setGeoChoice('UK'))
    expect(titles(container)).toEqual(['Pick a company name'])
    // Under 🇩🇪 Get EIN carries a real ELSTER analog — it stays hidden all the same; its
    // committed German path lives on the process detail page (ProcessGeoNotes).
    act(() => setGeoChoice('DE'))
    expect(titles(container)).toEqual(['Pick a company name'])
  })

  it("PIN (founder 2026-10-05): a country view renders NO disclosure line — no 'hidden in the' counts, no committed-note summaries under the table; the filter just filters", () => {
    const { container, queryByRole } = mountFilter()
    act(() => setGeoChoice('IN'))
    expect(container.textContent).not.toContain('hidden in the')
    expect(queryByRole('button', { name: /hidden in the/ })).toBeNull()
    // The committed note one-liners live on the detail pages, never under this table.
    expect(container.textContent).not.toContain('Incorporate through MCA’s SPICe+ integrated form.')
    expect(container.textContent).not.toContain('PAN and TAN are allotted automatically')
    expect(container.textContent).not.toContain('no India note is curated yet')
  })

  it('under 🇬🇧 the same global-only row set renders (no disclosure), and clearing the selection restores everything', () => {
    const { container } = mountFilter()
    act(() => setGeoChoice('UK'))
    expect(titles(container)).toEqual(['Pick a company name'])
    expect(container.textContent).not.toContain('hidden in the')
    act(() => setGeoChoice(null))
    expect(titles(container)).toHaveLength(FILTER_ROWS.length)
    expect(container.textContent).not.toContain('hidden in the')
  })

  it('the group headers of the grouped view count the FILTERED set honestly in a country view', () => {
    setUrl('?order=grouped')
    const { container } = mountFilter()
    act(() => setGeoChoice('IN'))
    const formation = within(container).getByText('Formation').closest('tr') as HTMLElement
    // All four US-scoped fixture rows hide under IN (analogs included since 2026-10-05), so
    // the Formation header honestly counts the one global row — never 5.
    expect(formation.textContent).toContain('1 process')
    expect(within(container).queryByText('Get EIN')).toBeNull()
    expect(within(container).queryByText('Incorporate C-Corp')).toBeNull()
  })
})

describe("cadence click-to-filter (founder 2026-10-02: clicking a row's cadence value scopes the table to that cadence; the same value again clears)", () => {
  // Two Monthly rows (the fixture default) and one Once row; the cadence cell renders while the
  // metric column shows Cadence — any non-five-axis sort (ceiling, title) and the grouped view
  // fall back to it.
  const CAD_ROWS: ProcessRow[] = [
    row({ slug: 'close-books', title: 'Close the books', phase: 'formation', timeOrder: 1 }),
    row({ slug: 'run-payroll', title: 'Run payroll', phase: 'growth', area: 'Growth & sales', areaRank: 8, timeOrder: 2 }),
    row({ slug: 'incorporate', title: 'Incorporate the company', phase: 'formation', cadenceLabel: 'Once', cadenceRank: 7, timeOrder: 3 }),
  ]
  const CAD_PLAYBOOK: PlaybookRow[] = [{
    id: 'company-in-a-day',
    title: 'Company in a day',
    tagline: 'From zero to a running company',
    icon: '🚀',
    href: '/processes/chains/company-in-a-day',
    dominantArea: 'Formation',
    areaRank: 0,
    timeOrder: 1,
    processes: [{ id: 'file-delaware', icon: '🏷️', title: 'File with Delaware', phase: 'formation' }],
    phases: ['formation'],
    pct: 70,
    agentSteps: 7,
    totalSteps: 10,
    vendors: [],
    steps: [],
  }]

  it('clicking a cadence value filters to it — a real button with aria-pressed and a visible active state — and the same value again clears', () => {
    const { container, getByRole } = render(<ProcessesTable rows={CAD_ROWS} phases={PHASES} />)
    pickPreset({ getByRole }, 'Most automatable') // the metric column falls back to Cadence
    const monthly = within(container).getAllByRole('button', { name: 'Monthly' })[0]
    expect(monthly.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(monthly)
    expect(within(container).getByText('Close the books')).toBeDefined()
    expect(within(container).getByText('Run payroll')).toBeDefined()
    expect(within(container).queryByText('Incorporate the company')).toBeNull()
    const active = within(container).getAllByRole('button', { name: 'Monthly' })[0]
    expect(active.getAttribute('aria-pressed')).toBe('true')
    expect(active.className).toContain('text-emerald-300') // the visible active state
    // The same value again clears the filter.
    fireEvent.click(active)
    expect(within(container).getByText('Incorporate the company')).toBeDefined()
    expect(within(container).getAllByRole('button', { name: 'Monthly' })[0].getAttribute('aria-pressed')).toBe('false')
  })

  it('works in the grouped view (?order=grouped): rows filter, empty areas collapse, header counts stay honest', () => {
    setUrl('?order=grouped')
    const { container } = render(<ProcessesTable rows={CAD_ROWS} phases={PHASES} />)
    fireEvent.click(within(container).getAllByRole('button', { name: 'Once' })[0])
    expect(within(container).getByText('Incorporate the company')).toBeDefined()
    expect(within(container).queryByText('Run payroll')).toBeNull()
    expect(within(container).queryByText('Growth & sales')).toBeNull() // the emptied area collapses
    const header = within(container).getByText('Formation').closest('tr') as HTMLElement
    expect(header.textContent).toContain('1 process')
    fireEvent.click(within(container).getAllByRole('button', { name: 'Once' })[0])
    expect(within(container).getByText('Run payroll')).toBeDefined()
  })

  it('an active cadence filter scopes to process rows — chain rows (no cadence of their own, the honest dash) hide until it clears', () => {
    setUrl('?order=grouped') // the grouped view shows the cadence cells without a preset pick
    const { container } = render(<ProcessesTable rows={CAD_ROWS} phases={PHASES} playbooks={CAD_PLAYBOOK} />)
    expect(within(container).getByText('Company in a day')).toBeDefined()
    fireEvent.click(within(container).getAllByRole('button', { name: 'Monthly' })[0])
    expect(within(container).queryByText('Company in a day')).toBeNull()
    fireEvent.click(within(container).getAllByRole('button', { name: 'Monthly' })[0])
    expect(within(container).getByText('Company in a day')).toBeDefined()
  })

  it('the empty state echoes the active cadence', () => {
    setUrl('?order=grouped')
    const { container } = render(<ProcessesTable rows={CAD_ROWS} phases={PHASES} />)
    fireEvent.click(within(container).getAllByRole('button', { name: 'Once' })[0])
    const search = within(container).getByLabelText('Filter products by name or vendor')
    fireEvent.change(search, { target: { value: 'payroll' } }) // a Monthly-only match, filtered out
    expect(container.textContent).toContain('at the Once cadence')
  })
})
