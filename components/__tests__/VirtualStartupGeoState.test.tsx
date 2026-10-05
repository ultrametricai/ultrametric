// @vitest-environment jsdom
// The 2026-09-29 founder batch at the DOM level:
//   1. control icons — decoration only, every accessible name unchanged;
//   2. the in-sim Geo row — the US default stays byte-identical (and 🌐 Global is geo-neutral),
//      while a country selection annotates the run from COMMITTED data only, pinned here against
//      the real repo evidence (processes/corpus.json geoNotes for form_001 → UK Companies House;
//      jurisdictions/vendor-geo.json mercury → unavailable in the UK);
//   3. the state-graph panel — fills/resets off the SAME revealed-row state as the terminal,
//      artifacts stay visibly SIMULATED inside it, tabs carry the run's objects.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VirtualStartup from '@/components/VirtualStartup'
import { setGeoSelection, type GeoAnalogNote, type GeoNoteKind, type VendorGeoLookup } from '@/lib/geoPreference'
import type { SimStep } from '@/lib/processSim'
import { vendorGeoLookup } from '@/lib/vendorGeo'
import type { VirtualTaskPayload, VsChain } from '@/lib/virtualStartup'

// ── REAL committed evidence, loaded from the repo — these tests pin the rendered lines to the
// exact data files the honesty contract cites, so a silent data drift fails loudly here.
interface CorpusGeoSlice {
  id: string
  geoScope: 'global' | 'us' | 'us-state'
  // The committed notes also carry the curated kind (lib/geoPreference.ts GEO_NOTE_KINDS) —
  // the scope-audit pins below assert it on qs_023's UK flavor note.
  geoNotes?: (GeoAnalogNote & { kind: GeoNoteKind })[]
}
const corpus = JSON.parse(
  readFileSync(path.join(process.cwd(), 'processes', 'corpus.json'), 'utf8'),
) as CorpusGeoSlice[]
const corpusById = new Map(corpus.map((t) => [t.id, t]))
const FORM_001 = corpusById.get('form_001')!
const QS_023 = corpusById.get('qs_023')!
const VENDOR_GEO: VendorGeoLookup = vendorGeoLookup(['mercury'])

const step = (taskId: string, label: string, over: Partial<SimStep> = {}): SimStep => ({
  taskId,
  taskTitle: taskId,
  label,
  route: 'agent',
  vendor: null,
  vendorLabel: null,
  arenaId: null,
  choiceArenaId: null,
  calls: [],
  toolCall: null,
  approvalRequired: false,
  legalSignature: false,
  riskLevel: null,
  estimatedMinutes: 10,
  async: false,
  gap: null,
  ...over,
})

const task = (id: string, title: string, over: Partial<VirtualTaskPayload> = {}): VirtualTaskPayload => ({
  id,
  title,
  slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  phase: 'formation',
  description: `${title} description`,
  steps: [step(id, `${title} — step 1`)],
  tops: [null],
  ...over,
})

// journeyPhases resolves every VS_CHAIN_IDS chain, so the fixture must cover all ten.
const CHAINS: VsChain[] = [
  { id: 'name-the-company', name: 'Name the company', taskIds: ['brand_001'] },
  { id: 'company-launch', name: 'Company launch', taskIds: ['form_001', 'startup_002', 'qs_023'] },
  { id: 'raise-a-seed-round', name: 'Raise a seed round', taskIds: ['fund_001'] },
  { id: 'set-up-compliance', name: 'Set up compliance (SOC 2-lite)', taskIds: ['ops_005'] },
  { id: 'ship-v1', name: 'Ship v1', taskIds: ['prod_006'] },
  { id: 'launch-website', name: 'Launch the website', taskIds: ['site_001'] },
  { id: 'get-paid', name: 'Get paid', taskIds: ['qs_021', 'growth_001', 'sales_002'] },
  { id: 'first-hire', name: 'First hire', taskIds: ['hr_001', 'hr_002'] },
  { id: 'launch-on-product-hunt', name: 'Launch on Product Hunt', taskIds: ['growth_010'] },
  { id: 'land-the-enterprise-deal', name: 'Land the enterprise deal', taskIds: ['comp_002'] },
]

const TASKS: Record<string, VirtualTaskPayload> = Object.fromEntries(
  [
    task('brand_001', 'Generate a company name'),
    // The REAL geo dimension: form_001 is US-scoped with curated country analogs (UK →
    // Companies House); qs_023 is GLOBAL since the founder's scope-audit correction
    // (2026-10-02: the need is universal — only the write-up was US-first) and carries
    // four-country flavor notes (UK → Wise Business).
    task('form_001', 'Incorporate C-Corp', {
      geoScope: FORM_001.geoScope,
      geoNotes: FORM_001.geoNotes ?? [],
    }),
    task('startup_002', 'Founder agreement & equity split'),
    task('qs_023', 'Open a business bank account', {
      geoScope: QS_023.geoScope,
      geoNotes: QS_023.geoNotes ?? [],
      steps: [step('qs_023', 'Open the account', { arenaId: 'startup-banking' })],
      // Mercury as the step's judged top pick — the vendor the committed geo evidence covers.
      tops: [
        { productId: 'mercury', name: 'Mercury', score: 88, arenaId: 'startup-banking', arenaName: 'Startup banking' },
      ],
    }),
    task('fund_001', 'Raise pre-seed (SAFEs)'),
    task('ops_005', 'Set up a password manager'),
    task('prod_006', 'Set up a code hosting org'),
    task('site_001', 'Generate a website'),
    task('qs_021', 'Connect a payment processor'),
    task('growth_001', 'Set up subscription billing'),
    task('sales_002', 'Send an invoice'),
    task('hr_001', 'Hire first employee'),
    task('hr_002', 'Run payroll'),
    task('growth_010', 'Launch on Product Hunt & directories'),
    task('comp_002', 'Complete SOC 2 Type II'),
  ].map((t) => [t.id, t]),
)

const renderIt = (over: Partial<Parameters<typeof VirtualStartup>[0]> = {}) =>
  render(
    <VirtualStartup
      chains={CHAINS}
      tasks={TASKS}
      roles={[]}
      yearCandidates={[]}
      eventExamples={[]}
      access={{}}
      pricing={{}}
      taskRisks={{}}
      vendorGeo={VENDOR_GEO}
      {...over}
    />,
  )

const showAll = () => {
  vi.useFakeTimers()
  try {
    fireEvent.click(screen.getByRole('button', { name: /run this startup|run it again/i }))
    act(() => {
      vi.runAllTimers()
    })
  } finally {
    vi.useRealTimers()
  }
}

// The Geo control is a house-listbox dropdown (founder round 4, item 3): open the trigger,
// click the country option (same ?geo=/pa-geo/store contract as the pill row it replaces).
const pickGeo = (code: string) => {
  fireEvent.click(screen.getByTestId('vs-geo-trigger'))
  fireEvent.click(screen.getByTestId(`vs-geo-${code}`))
}
const geoTriggerText = () => screen.getByTestId('vs-geo-trigger').textContent ?? ''

// URL, storage AND the shared per-tab geo store are real contracts here — reset all three.
beforeEach(() => {
  window.history.replaceState(null, '', '/')
  window.localStorage.clear()
  setGeoSelection(null)
})

describe('VirtualStartup — control icons never move an accessible name', () => {
  it('every decision group, its options, the persona group, and the geo row keep their canonical names', () => {
    renderIt()
    for (const name of [
      'Entity', 'Team', 'Funding', 'Business model',
      'First hire', 'Compliance posture', 'ICP', 'Launch', 'Workplace',
    ]) {
      expect(screen.getByRole('group', { name })).toBeTruthy()
    }
    // 'Start with' left the panel (round 5, item 4) — no group remains.
    expect(screen.queryByRole('group', { name: 'What comes first' })).toBeNull()
    expect(screen.getByRole('group', { name: 'Who is the founder?' })).toBeTruthy()
    // The founder axes present as ONE dropdown over the four combinations (addendum
    // 2026-09-30) — the old segmented pairs are gone; the model underneath is unchanged.
    expect(screen.queryByRole('group', { name: 'Technical background' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Founder experience' })).toBeNull()
    const personaTrigger = screen.getByTestId('vs-persona-trigger')
    expect(personaTrigger.getAttribute('aria-haspopup')).toBe('listbox')
    // 'Second-timer' → 'Repeat entrepreneur' (round 4 rename) survives in the combo labels.
    fireEvent.click(personaTrigger)
    for (const name of [
      'Technical founder, first-time',
      'Technical founder, repeat entrepreneur',
      'Non-technical founder, first-time',
      'Non-technical founder, repeat entrepreneur',
    ]) {
      expect(screen.getByRole('option', { name })).toBeTruthy()
    }
    fireEvent.click(personaTrigger) // close
    expect(screen.getByRole('group', { name: 'Country view' })).toBeTruthy()
    // Decision options keep their canonical full labels as accessible names inside the open
    // dropdown listboxes (spot checks; the compact-band suite sweeps all 18).
    fireEvent.click(screen.getByTestId('vs-decision-entity'))
    expect(screen.getByRole('option', { name: 'Delaware C-Corp' })).toBeTruthy()
    fireEvent.click(screen.getByTestId('vs-decision-entity'))
    fireEvent.click(screen.getByTestId('vs-decision-team'))
    expect(screen.getByRole('option', { name: 'Solo founder' })).toBeTruthy()
  })

  it('the row labels and every decision group lead with a tooltipped icon (house rule: no unexplained icon)', () => {
    renderIt()
    const band = screen.getByTestId('vs-setup')
    for (const title of [
      'Scenario — one-tap setups: example companies and YC batch mode',
      'Founder — the who/where cluster: the two founder axes plus the country view',
    ]) {
      expect(within(band).getByTitle(title)).toBeTruthy()
    }
    // The 'Decisions' row label AND its icon are gone (founder batch 2026-09-30, item 6).
    expect(within(band).queryByTitle('Starting decisions — which real processes make up the journey')).toBeNull()
    // The geo row's adjacent 🌍 IconChip is GONE (round 5, item 5) — the selector's own flags
    // (each option tooltipped) carry the affordance; no bare icon remains.
    expect(within(band).queryByTitle('Country view — annotate the run with committed geo evidence')).toBeNull()
    expect(band.textContent).not.toContain('🌍')
    const entity = screen.getByRole('group', { name: 'Entity' })
    expect(within(entity).getByTitle('Entity — starting decision')).toBeTruthy()
    const launch = screen.getByRole('group', { name: 'Launch' })
    expect(within(launch).getByTitle('Launch — starting decision')).toBeTruthy()
  })
})

describe('VirtualStartup — the Geo dropdown (founder round 4, item 3: a house listbox, not pills)', () => {
  it('closed, the trigger shows the current country (default 🇺🇸 USA); open, the list is Global/USA/UK/India/Germany/France/Portugal/Canada', () => {
    renderIt()
    const trigger = screen.getByTestId('vs-geo-trigger')
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox')
    expect(trigger.textContent).toContain('🇺🇸')
    expect(trigger.textContent).toContain('USA')
    fireEvent.click(trigger)
    const list = screen.getByRole('listbox', { name: 'Country view options' })
    expect(within(list).getAllByRole('option').map((o) => o.getAttribute('aria-label'))).toEqual([
      'Global', 'USA', 'UK', 'India', 'Germany', 'France', 'Portugal', 'Canada',
    ])
    // The flags still render, and each option carries its honesty sublabel (item 3: the removed
    // tooltips' copy moved into the list).
    const optionText = within(list).getAllByRole('option').map((o) => o.textContent ?? '').join(' ')
    for (const flag of ['🌐', '🇺🇸', '🇬🇧', '🇮🇳', '🇩🇪', '🇫🇷', '🇵🇹', '🇨🇦']) expect(optionText).toContain(flag)
    expect(within(list).getAllByTestId('vs-geo-detail').length).toBe(8)
    expect(screen.getByTestId('vs-geo-usa').getAttribute('aria-selected')).toBe('true')
    // Picking a country closes the list and the trigger takes its flag + name.
    fireEvent.click(screen.getByTestId('vs-geo-in'))
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(geoTriggerText()).toContain('🇮🇳')
    expect(geoTriggerText()).toContain('India')
    expect(window.location.search).toContain('geo=in')
  })
})

describe('VirtualStartup — the in-sim Geo row', () => {
  it('default (and 🌐 Global) render the run byte-identically: no marks, no analogs, no warnings; an entity-compatible geo switch stays annotation-only', () => {
    renderIt()
    showAll()
    const term = screen.getByTestId('vs-terminal-body')
    const baseline = term.innerHTML
    expect(screen.queryByTestId('vs-geo-analog')).toBeNull()
    expect(screen.queryByTestId('vs-geo-analog-missing')).toBeNull()
    expect(screen.queryByTestId('vs-geo-step-mark')).toBeNull()
    expect(screen.queryByTestId('vs-geo-vendor-warning')).toBeNull()
    expect(screen.queryByTestId('vs-entity-analog')).toBeNull()
    expect(window.location.search).not.toContain('geo')
    // Global is geo-neutral AND entity-compatible (US roster): byte-identical, no reset.
    pickGeo('global')
    expect(term.innerHTML).toBe(baseline)
    pickGeo('usa')
    expect(term.innerHTML).toBe(baseline)
    expect(window.location.search).not.toContain('geo')
  })

  it('the entity-geo RESET rule (round 5, item 1): a geo switch with an incompatible asserted entity resets it to the new country’s default-asserted first option — a composition change, so the run clears', () => {
    renderIt()
    showAll()
    // Default-asserted Delaware C-Corp is not on the UK roster → reset to Ltd, run cleared.
    pickGeo('uk')
    expect(screen.getByTestId('vs-decision-entity').textContent).toContain('Ltd')
    expect(screen.getByTestId('vs-decision-entity').getAttribute('aria-label')).toContain('Ltd (Companies House)')
    expect(screen.queryAllByTestId('vs-artifact')).toHaveLength(0) // composition change = new run
    // The Entity dropdown's roster now follows the UK.
    fireEvent.click(screen.getByTestId('vs-decision-entity'))
    expect(screen.getByRole('option', { name: 'Ltd (Companies House)' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Delaware C-Corp' })).toBeNull()
    fireEvent.click(screen.getByTestId('vs-decision-entity')) // close
    // Back to the USA: Ltd is off the US roster → resets to the default-asserted C-Corp.
    pickGeo('usa')
    expect(screen.getByTestId('vs-decision-entity').textContent).toContain('C-Corp')
    // The run replays the C-Corp composition — same company suffix as the baseline.
    showAll()
    expect(screen.getAllByTestId('vs-artifact').some((a) => /, Inc\./.test(a.textContent ?? ''))).toBe(true)
  })

  it('UK: the committed form_001 analog prints (Companies House + verified actionUrl); global flavor notes print; steps carry the mark', () => {
    // Pin the committed data this test rests on — a corpus drift fails here, visibly.
    const ukNote = (FORM_001.geoNotes ?? []).find((n) => n.country === 'UK')!
    expect(FORM_001.geoScope).toBe('us')
    expect(ukNote.summary).toContain('Companies House')
    // Founder scope-audit correction (2026-10-02): opening a bank account is a universal
    // need — qs_023 is global now, and its UK note is a committed flavor analog.
    expect(QS_023.geoScope).toBe('global')
    const qsUkNote = (QS_023.geoNotes ?? []).find((n) => n.country === 'UK')!
    expect(qsUkNote.kind).toBe('analog')

    renderIt()
    pickGeo('uk')
    expect(window.location.search).toContain('geo=uk')
    expect(window.localStorage.getItem('pa-geo')).toBe('uk')
    showAll()
    // The UK pick reset the entity to Ltd (round 5, item 1), so form_001's country frame is the
    // ENTITY analog line — the same committed geoNotes data, deduped with the generic geo line.
    const analog = screen.getByTestId('vs-entity-analog')
    expect(analog.textContent).toContain('Ltd (Companies House)')
    expect(analog.textContent).toContain('in the United Kingdom this is:')
    expect(analog.textContent).toContain('Companies House')
    expect(analog.textContent).toContain('US-shaped corpus playbook') // the honest frame
    expect(within(analog).getByRole('link').getAttribute('href')).toBe(ukNote.actionUrl)
    // form_001's generic geo line is suppressed where the entity frame covers it — but the
    // now-global qs_023 prints its committed UK flavor note (the bank-account analog), so
    // exactly ONE generic analog line renders, with the committed note's verified link.
    const geoAnalogs = screen.getAllByTestId('vs-geo-analog')
    expect(geoAnalogs).toHaveLength(1)
    expect(geoAnalogs[0].textContent).toContain(qsUkNote.summary)
    expect(within(geoAnalogs[0]).getByRole('link').getAttribute('href')).toBe(qsUkNote.actionUrl)
    // No "no mapping yet" line anywhere — the scope audit left no honest gap in this run.
    expect(screen.queryByTestId('vs-geo-analog-missing')).toBeNull()
    // Only form_001's steps carry the quiet 🇺🇸 mark now; global tasks carry none.
    expect(screen.getAllByTestId('vs-geo-step-mark')).toHaveLength(1)
    // The Ltd entity label reached the artifacts (the company display suffix).
    expect(screen.getAllByTestId('vs-artifact').some((a) => / Ltd/.test(a.textContent ?? ''))).toBe(true)
  })

  it('mercury+UK: the committed unavailability prints verbatim with its source; the judged pill and score never move', () => {
    const cell = VENDOR_GEO['mercury']?.UK
    expect(cell?.status).toBe('unavailable') // pinned against jurisdictions/vendor-geo.json
    renderIt()
    pickGeo('uk')
    showAll()
    const warn = screen.getByTestId('vs-geo-vendor-warning')
    expect(warn.textContent).toContain('Mercury — unavailable in the United Kingdom')
    expect(warn.textContent).toContain(cell!.note)
    expect(within(warn).getByRole('link', { name: /source/ }).getAttribute('href')).toBe(cell!.sourceUrl)
    // Honesty line: annotation only — the judged top-vendor pill still renders, score intact.
    expect(screen.getByRole('link', { name: /Mercury · 88/ })).toBeTruthy()
    // Global is geo-neutral: the warning (and every mark) is gone, and the token round-trips.
    pickGeo('global')
    expect(screen.queryByTestId('vs-geo-vendor-warning')).toBeNull()
    expect(screen.queryByTestId('vs-geo-step-mark')).toBeNull()
    expect(window.location.search).toContain('geo=global')
    expect(window.localStorage.getItem('pa-geo')).toBe('global')
  })

  it('?geo=uk is read on mount — the interop contract with the process/product pages', () => {
    window.history.replaceState(null, '', '/?geo=uk')
    renderIt()
    expect(geoTriggerText()).toContain('UK')
    fireEvent.click(screen.getByTestId('vs-geo-trigger'))
    expect(screen.getByTestId('vs-geo-uk').getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByTestId('vs-geo-trigger')) // close before the run
    showAll()
    // The mount-read UK selection also applied the entity reset (asserted Ltd) — form_001's
    // country frame prints as the entity analog; the now-global qs_023 prints its committed
    // UK flavor note instead of a gap line (founder scope-audit correction 2026-10-02).
    expect(screen.getByTestId('vs-entity-analog')).toBeTruthy()
    expect(screen.getByTestId('vs-geo-analog')).toBeTruthy()
    expect(screen.queryByTestId('vs-geo-analog-missing')).toBeNull()
  })

  it('the stored pa-geo copy (incl. global) is read on mount when the URL carries nothing', () => {
    window.localStorage.setItem('pa-geo', 'global')
    renderIt()
    expect(geoTriggerText()).toContain('Global')
    showAll()
    expect(screen.queryByTestId('vs-geo-step-mark')).toBeNull()
  })
})

describe('VirtualStartup — the state-graph panel', () => {
  it("round 8 (item 4): the first tab is 'Status' (was 'Company'), it is the default, and NO tab carries a count badge", () => {
    renderIt()
    // The rename: vs-sg-tab-status exists and is selected by default; 'Company' is gone.
    const status = screen.getByTestId('vs-sg-tab-status')
    expect(status.textContent).toBe('Status')
    expect(status.getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByTestId('vs-sg-tab-company')).toBeNull()
    // No counts beside any label — before OR after a run reveals objects.
    const labels = () =>
      ['status', 'vendors', 'decisions'].map((id) => screen.getByTestId(`vs-sg-tab-${id}`).textContent ?? '')
    expect(labels()).toEqual(['Status', 'Vendors', 'Decisions'])
    showAll()
    expect(labels()).toEqual(['Status', 'Vendors', 'Decisions'])
    // The default Status tab still mirrors the artifact stream.
    expect(screen.getAllByTestId('vs-sg-artifact').length).toBeGreaterThan(0)
  })

  it('is empty pre-run with a placeholder, fills live with the reveal, mirrors the artifact stream (data-synthetic kept), and resets', () => {
    vi.useFakeTimers()
    try {
      renderIt()
      expect(screen.getByTestId('vs-sg-placeholder')).toBeTruthy()
      expect(screen.queryAllByTestId('vs-sg-artifact')).toHaveLength(0)
      fireEvent.click(screen.getByRole('button', { name: /run this startup/i }))
      act(() => { vi.advanceTimersByTime(240 * 12) })
      // Mid-run: the placeholder is gone and the panel is already filling — same reveal state
      // as the terminal, no separate timers.
      expect(screen.queryByTestId('vs-sg-placeholder')).toBeNull()
      const mid = screen.getAllByTestId('vs-sg-artifact').length
      expect(mid).toBeGreaterThan(0)
      act(() => { vi.runAllTimers() })
      const final = screen.getAllByTestId('vs-sg-artifact')
      expect(final.length).toBeGreaterThan(mid)
      // The Company tab mirrors the terminal's artifact stream exactly — every node carrying
      // the structural data-synthetic attribute (the visible chip is gone, 2026-09-29).
      expect(final).toHaveLength(within(screen.getByTestId('vs-terminal-body')).getAllByTestId('vs-artifact').length)
      for (const node of final) expect(node.getAttribute('data-synthetic')).toBe('true')
    } finally {
      vi.useRealTimers()
    }
    // A decision change resets the panel together with the terminal.
    fireEvent.click(screen.getByTestId('vs-decision-entity'))
    fireEvent.click(screen.getByRole('option', { name: 'LLC' }))
    expect(screen.getByTestId('vs-sg-placeholder')).toBeTruthy()
    expect(screen.queryAllByTestId('vs-sg-artifact')).toHaveLength(0)
  })

  it('Vendors tab collects the judged picks as the journey hits their steps — name, arena, provenance, product link', () => {
    renderIt()
    showAll()
    fireEvent.click(screen.getByTestId('vs-sg-tab-vendors'))
    const vendor = screen.getByTestId('vs-sg-vendor')
    expect(within(vendor).getByRole('link', { name: 'Mercury' }).getAttribute('href')).toBe(
      '/arena/startup-banking/product/mercury',
    )
    expect(vendor.textContent).toContain('Startup banking · top judged · 88')
  })

  it('Decisions tab shows BOTH founder axes plus the nine visible choices, with pending/asserted state', () => {
    renderIt()
    showAll()
    fireEvent.click(screen.getByTestId('vs-sg-tab-decisions'))
    const decisions = screen.getAllByTestId('vs-sg-decision')
    expect(decisions).toHaveLength(11) // 2 founder axes + 9 visible decisions ('Start with' left the UI; Workplace joined 2026-09-30)
    const text = decisions.map((d) => d.textContent).join(' | ')
    // The axes lead (item 5: the panel shows both).
    expect(text).toContain('Technical founder')
    expect(text).toContain('First-time founder')
    // Unasserted decisions show the composed default and say they are not set — while the
    // round-7 DEFAULT-ASSERTED set (entity, team, funding, compliance, ph, remote — 2026-10-01,
    // item 5) reads asserted from the first render.
    expect(text).toContain('SaaS subscriptions · not set')
    expect(text).toContain('Delaware C-Corp')
    expect(text).not.toContain('Delaware C-Corp · not set')
    expect(text).toContain('Raise a seed')
    expect(text).not.toContain('Raise a seed · not set')
    expect(text).toContain('X launch')
    expect(text).toContain('Office')
    // …and asserting one drops the marker (the assertion resets the run; re-run to refill).
    fireEvent.click(screen.getByTestId('vs-decision-product'))
    fireEvent.click(screen.getByRole('option', { name: 'SaaS subscriptions' }))
    showAll()
    fireEvent.click(screen.getByTestId('vs-sg-tab-decisions'))
    const after = screen.getAllByTestId('vs-sg-decision').map((d) => d.textContent).join(' | ')
    expect(after).toContain('SaaS subscriptions')
    expect(after).not.toContain('SaaS subscriptions · not set')
  })

  it('mid-run events land in the Decisions tab as pending, then resolve with the chosen branch', () => {
    // qs_021 clears the processor-review risk floor (minRisk 2, no decision gates) and is the
    // only eligible event in this fixture — the seeded draw always contains exactly it.
    renderIt({ taskRisks: { qs_021: 2 } })
    showAll()
    fireEvent.click(screen.getByTestId('vs-sg-tab-decisions'))
    const pending = screen.getByTestId('vs-sg-event')
    expect(pending.textContent).toContain('Payment processor account review')
    expect(pending.textContent).toContain('pending decision')
    expect(pending.getAttribute('data-synthetic')).toBe('true')
    // Decide the branch on the terminal's event card — the panel resolves off the same state.
    fireEvent.click(screen.getByTestId('vs-event-choice-processor-review-wait'))
    expect(screen.getByTestId('vs-sg-event').textContent).toContain('→ Wait out the review')
    expect(screen.getByTestId('vs-sg-event').textContent).not.toContain('pending decision')
  })
})
