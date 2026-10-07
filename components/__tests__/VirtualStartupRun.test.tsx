// @vitest-environment jsdom
// Virtual Startup v3 surfaces at the DOM level — the labeling invariants the founder contract
// hangs on: every mid-run event card is visibly SIMULATED and grounded in a linked real process;
// every simulation constant surfaces with the words "simulation assumption"; the burn block is
// labeled "published pricing" with per-vendor cites and honest gaps; and the ?run= permalink
// replays the exact run (picks included) after a reload. The pure math behind these surfaces is
// tested against the live corpus in lib/__tests__/virtualStartupRun.test.ts.
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VirtualStartup from '@/components/VirtualStartup'
import type { SimStep, VendorRole } from '@/lib/processSim'
import type { VirtualTaskPayload, VsChain } from '@/lib/virtualStartup'
import {
  decodeRunState,
  DEFAULT_FOUNDER_AXES,
  encodeRunState,
  FOUNDER_HOURS_MULTIPLIER,
  type VsAccessMap,
  type VsPricingMap,
} from '@/lib/virtualStartupRun'

// Decisions are dropdowns (founder addendum 2026-09-29): open the trigger, click the option.
const pickDecision = (id: string, optionName: string | RegExp) => {
  fireEvent.click(screen.getByTestId(`vs-decision-${id}`))
  fireEvent.click(screen.getByRole('option', { name: optionName }))
}

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
  { id: 'company-launch', name: 'Company launch', taskIds: ['form_001', 'startup_002'] },
  { id: 'raise-a-seed-round', name: 'Raise a seed round', taskIds: ['fund_001'] },
  { id: 'set-up-compliance', name: 'Set up compliance (SOC 2-lite)', taskIds: ['ops_005'] },
  { id: 'ship-v1', name: 'Ship v1', taskIds: ['prod_006'] },
  { id: 'launch-website', name: 'Launch the website', taskIds: ['site_001'] },
  { id: 'get-paid', name: 'Get paid', taskIds: ['qs_021'] },
  { id: 'first-hire', name: 'First hire', taskIds: ['hr_001'] },
  { id: 'launch-on-product-hunt', name: 'Launch on Product Hunt', taskIds: ['growth_010'] },
  { id: 'land-the-enterprise-deal', name: 'Land the enterprise deal', taskIds: ['comp_002'] },
]

const TASKS: Record<string, VirtualTaskPayload> = Object.fromEntries(
  [
    task('brand_001', 'Generate a company name'),
    task('form_001', 'Incorporate C-Corp'),
    task('startup_002', 'Sign the founder agreement'),
    task('fund_001', 'Raise pre-seed (SAFEs)'),
    task('ops_005', 'Set up a password manager'),
    task('prod_006', 'Set up a code hosting org'),
    task('site_001', 'Generate a website'),
    // The payments-served agent step — the outcome model reroutes it by pick surface. Its top
    // carries hasLogo + runnersUp so the terminal's recommended-vendor treatment is testable.
    task('qs_021', 'Connect a payment processor', {
      steps: [step('qs_021', 'Activate the processor account', { arenaId: 'payments', vendor: 'stripe', vendorLabel: 'Stripe' })],
      tops: [
        {
          productId: 'stripe', name: 'Stripe', score: 90, arenaId: 'payments', arenaName: 'Payments',
          hasLogo: true,
          runnersUp: [
            { productId: 'square', name: 'Square', score: 70 },
            { productId: 'paypal', name: 'PayPal', score: 61 },
          ],
        },
      ],
    }),
    task('hr_001', 'Hire first employee'),
    task('growth_010', 'Launch on the directories'),
    task('comp_002', 'Complete SOC 2 Type II'),
    task('ops_014', 'Lease an office'),
  ].map((t) => [t.id, t]),
)

const ROLES: VendorRole[] = [
  {
    arenaId: 'payments',
    arenaName: 'Payments',
    canonicalVendor: 'stripe',
    defaultProductId: 'stripe',
    defaultProductName: 'Stripe',
    stepCount: 1,
    alternatives: [
      { id: 'stripe', name: 'Stripe', agentReady: 90 },
      { id: 'square', name: 'Square', agentReady: 70 },
      // paypal exists for the pick-your-vendors loop (founder addendum #3): a NON-default pick
      // WITH extracted pricing, so the burn line labeling ('your pick') is observable — square
      // deliberately stays unpriced (the honest-gap fixtures below depend on it).
      { id: 'paypal', name: 'PayPal', agentReady: 61 },
    ],
  },
]

// Default pick (stripe) has NO judged agent surface; square has one — so the default stack
// carries a founder-hours step and the optimal stack (square) runs faster.
const ACCESS: VsAccessMap = {
  payments: {
    stripe: { mcp: 'none', cli: 'none' },
    square: { mcp: 'full', cli: 'na' },
    paypal: { mcp: 'none', cli: 'none' },
  },
}

const PRICING: VsPricingMap = {
  payments: {
    stripe: {
      kind: 'fact',
      label: '2.9% + $0.3',
      unit: 'per transaction',
      tier: 'usage',
      amountUsd: 0.3,
      percent: 2.9,
      monthly: false,
      sourceUrl: 'https://stripe.example/pricing',
      asOf: '2026-09-01',
    },
    // square deliberately absent — a picked vendor with no extracted pricing is an honest gap.
    paypal: {
      kind: 'fact',
      label: '$30',
      unit: 'per month',
      tier: 'entry-paid',
      amountUsd: 30,
      monthly: true,
      sourceUrl: 'https://paypal.example/pricing',
      asOf: '2026-09-01',
    },
  },
}

// Both drawable events' grounded processes are in the fixture journey (qs_021 always,
// startup_002 with cofounders) and clear their risk floors — exactly two eligible, so every
// seeded draw contains both.
const RISKS: Record<string, number> = { qs_021: 2, startup_002: 5 }

const renderIt = () =>
  render(
    <VirtualStartup
      chains={CHAINS}
      tasks={TASKS}
      roles={ROLES}
      yearCandidates={[]}
      eventExamples={[]}
      access={ACCESS}
      pricing={PRICING}
      taskRisks={RISKS}
    />,
  )

// The skip-animation link is gone (founder 2026-09-28) — reveal the full timeline by running
// the startup under fake timers (the reveal interval self-clears when the last row prints).
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

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('mid-run events — simulated, grounded, decidable', () => {
  it('prints every drawn event inside the terminal with the structural data-synthetic attribute and a grounded-in process link', () => {
    renderIt()
    showAll()
    const cards = screen.getAllByTestId('vs-run-event')
    expect(cards).toHaveLength(2) // both eligible fixture events
    for (const card of cards) {
      expect(card.getAttribute('data-synthetic')).toBe('true')
      expect(within(card).queryByText(/simulated/i)).toBeNull() // no visible label (2026-09-29)
      expect(within(card).getByText(/grounded in:/i)).toBeTruthy()
      // The grounded process links its real process page and shows the corpus risk gate.
      const link = within(card).getByRole('link')
      expect(link.getAttribute('href')).toMatch(/\/processes\//)
      expect(within(card).getByText(/corpus risk [1-5]\/5/)).toBeTruthy()
    }
  })

  it('a wait branch discloses its named constant as a simulation assumption and advances the clock', () => {
    renderIt()
    showAll()
    fireEvent.click(screen.getByTestId('vs-event-choice-processor-review-wait'))
    const card = screen.getByTestId('vs-event-choice-processor-review-wait').closest('[data-testid="vs-run-event"]')!
    expect(within(card as HTMLElement).getByTestId('vs-event-assumption').textContent).toContain('simulation assumption')
    expect(within(card as HTMLElement).getByText(/clock \+/)).toBeTruthy()
    // The scorecard counts the decided event and its time.
    const score = screen.getByTestId('vs-scorecard')
    expect(within(score).getByText(/incl\. \+.* from event decisions/)).toBeTruthy()
    expect(within(score).getByTestId('vs-score-events').textContent).toContain('1/2 decided')
  })

  it('undecided events add no time and say so', () => {
    renderIt()
    showAll()
    const cards = screen.getAllByTestId('vs-run-event')
    for (const card of cards) expect(within(card).getByText(/undecided/)).toBeTruthy()
    expect(within(screen.getByTestId('vs-scorecard')).getByTestId('vs-score-events').textContent).toContain('0/2 decided')
  })

  it('decision changes reset decided branches (a new combo is a new run)', () => {
    renderIt()
    showAll()
    fireEvent.click(screen.getByTestId('vs-event-choice-processor-review-wait'))
    pickDecision('team', 'Solo founder')
    showAll()
    // Solo drops the cofounder event; the processor event is back to undecided.
    const cards = screen.getAllByTestId('vs-run-event')
    expect(cards).toHaveLength(1)
    expect(within(cards[0]).getByText(/undecided/)).toBeTruthy()
  })
})

describe('outcome model surfaces — picks change the simulated clock, disclosed', () => {
  it('the default pick without an agent surface marks the step founder-hours (sim badge names the assumption)', () => {
    renderIt()
    showAll()
    const badge = screen.getByTestId('vs-step-outnote')
    expect(badge.getAttribute('title')).toContain('simulation assumption')
    expect(badge.textContent).toContain(`${10 * FOUNDER_HOURS_MULTIPLIER} min`)
  })

  it("the recommended pick prints with its logo, the '(recommended · judged)' tag, likely-led runners-up (judged scores), and the arena link", () => {
    renderIt()
    showAll()
    // The pill: ProductLogoView with the serialized hasLogo → a real <img> logo chip.
    const pill = screen.getByRole('link', { name: /Stripe · 90/ })
    expect(pill.getAttribute('href')).toBe('/arena/payments/product/stripe')
    expect(within(pill).getByAltText('Stripe logo')).toBeTruthy()
    // The step row marks the pick as the JUDGED recommendation (round 5, item 7 label) and
    // trails the runners-up (serialized in likely-choice order server-side, judged scores kept)
    // plus the arena link; the fragment names the ordering in its tooltip.
    const row = pill.closest('li')!
    expect(within(row as HTMLElement).getByText('(recommended · judged)')).toBeTruthy()
    expect(within(row as HTMLElement).queryByText('(recommended)')).toBeNull()
    const runners = within(row as HTMLElement).getByTestId('vs-step-runnersup')
    expect(runners.textContent).toContain('likely')
    expect(runners.getAttribute('title')).toContain('adoption/popularity')
    expect(runners.getAttribute('title')).toContain('judged')
    expect(runners.textContent).toContain('Square · 70')
    expect(runners.textContent).toContain('PayPal · 61')
    expect(within(runners).getByRole('link', { name: /Square · 70/ }).getAttribute('href')).toBe('/arena/payments/product/square')
    expect(within(runners).getByRole('link', { name: 'ranking →' }).getAttribute('href')).toBe('/arena/payments')
  })

  it("the Vendors tab offers the ordering toggle (Likely choice | Judged): likely leads with the committed signal order, judged restores the ladder, and the judged default wears '(recommended · judged)'", () => {
    render(
      <VirtualStartup
        chains={CHAINS}
        tasks={TASKS}
        roles={ROLES}
        yearCandidates={[]}
        eventExamples={[]}
        access={ACCESS}
        pricing={PRICING}
        taskRisks={RISKS}
        // A committed likely order that inverts the ladder: paypal (curated-style signal) leads.
        popularity={{
          payments: {
            order: ['paypal', 'square', 'stripe'],
            signals: { paypal: 'clearly popular (curated set — unranked; alphabetical within)' },
          },
        }}
      />,
    )
    fireEvent.click(screen.getByTestId('vs-set-vendors-summary'))
    // Likely choice is the default ordering.
    expect(screen.getByTestId('vs-vendor-order-likely').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('vs-vendor-order-judged').getAttribute('aria-pressed')).toBe('false')
    const openPicker = () => fireEvent.click(screen.getByTitle('Change the Payments product for this dry run'))
    openPicker()
    let options = screen.getAllByRole('option')
    expect(options.map((o) => o.textContent?.includes('PayPal') ? 'paypal' : o.textContent?.includes('Square') ? 'square' : 'stripe')).toEqual(['paypal', 'square', 'stripe'])
    // The #N badge keeps the LADDER rank (identity, not list position): paypal leads but stays #3.
    expect(options[0].textContent).toContain('#3')
    // The signal label rides the row tooltip — the receipt behind the position.
    expect(options[0].getAttribute('title')).toContain('clearly popular')
    // The judged default keeps its judged-recommendation label whatever the order.
    expect(options.find((o) => o.textContent?.includes('Stripe'))!.textContent).toContain('(recommended · judged)')
    fireEvent.click(options[0]) // close by picking (paypal)
    // Switch to Judged: the ladder order returns.
    fireEvent.click(screen.getByTestId('vs-vendor-order-judged'))
    openPicker()
    options = screen.getAllByRole('option')
    expect(options[0].textContent).toContain('Stripe')
    expect(options[0].textContent).toContain('#1')
  })

  it('a top pick without a committed logo renders the initial-letter fallback (no layout-dependent absence)', () => {
    renderIt()
    showAll()
    // form_001-style tops are null in this fixture, so assert on the state panel path instead:
    // the vendors tab uses the same ProductLogoView contract (covered by the GeoState suite).
    // Here: the pill's logo chip is fixed-size, so rows with and without logos align.
    expect(screen.getByRole('link', { name: /Stripe · 90/ })).toBeTruthy()
  })

  it('the scorecard prints the stack-vs-optimal comparison line', () => {
    renderIt()
    showAll()
    const line = screen.getByTestId('vs-outcome-line')
    expect(line.textContent).toMatch(/Your stack: \d+% agent-run → launch day \d+ · agents-first optimal\s+stack: day \d+/)
  })

  it('every scorecard assumption carries the phrase "simulation assumption"', () => {
    renderIt()
    showAll()
    const list = screen.getByTestId('vs-assumptions')
    const items = within(list).getAllByRole('listitem')
    expect(items.length).toBeGreaterThan(0)
    for (const li of items) expect(li.textContent).toContain('simulation assumption')
  })

  it('an axis pick prints NO amber band line (founder round 3, item 2) — the assumption rides the option SUBLABEL since the 2026-09-30 tooltip removal (item 3)', () => {
    renderIt()
    // The single founder dropdown (addendum 2026-09-30): pick the non-technical first-timer combo.
    fireEvent.click(screen.getByTestId('vs-persona-trigger'))
    fireEvent.click(screen.getByTestId('vs-persona-non-technical-first-timer'))
    expect(screen.getByTestId('vs-persona-trigger').textContent).toContain('Non-technical, first-time')
    // The vs-persona-assumption info lines are gone from the band…
    expect(screen.queryByTestId('vs-persona-assumption')).toBeNull()
    // …and the trigger carries NO tooltip (item 3) — the named simulation assumption stays
    // reachable as the option's in-list sublabel.
    expect(screen.getByTestId('vs-persona-trigger').getAttribute('title')).toBeNull()
    fireEvent.click(screen.getByTestId('vs-persona-trigger'))
    expect(screen.getByTestId('vs-persona-non-technical-first-timer').textContent).toContain('simulation assumption')
    fireEvent.click(screen.getByTestId('vs-persona-trigger')) // close
    expect(screen.queryByText(/full setup guide/i)).toBeNull()
  })

  it('a Vendors-tab pick drives the outcome model (controlled selections): the MCP-surfaced vendor removes the founder-hours badge', () => {
    renderIt()
    // Baseline: the default stripe pick has no judged agent surface → founder-hours badge.
    showAll()
    expect(screen.getByTestId('vs-step-outnote')).toBeTruthy()
    // Fix the payments vendor on the controller's Vendors tab (SimRolePicker listbox).
    fireEvent.click(screen.getByTestId('vs-set-vendors-summary'))
    const panel = screen.getByTestId('vs-set-vendors')
    fireEvent.click(within(panel).getByRole('button', { name: /Stripe/ }))
    fireEvent.click(within(panel).getByRole('option', { name: /Square/ }))
    // Rerun: square carries a judged MCP surface, so the step runs at agent speed — no badge.
    showAll()
    expect(screen.queryByTestId('vs-step-outnote')).toBeNull()
  })
})

describe('simulated burn — published pricing only, cited; gaps stay gaps', () => {
  it('labels the burn as published pricing, cites the vendor pricing page per fact, and shows honest gaps', () => {
    renderIt()
    showAll()
    const burn = screen.getByTestId('vs-score-burn')
    expect(burn.textContent).toContain('published pricing')
    const cite = within(burn).getByTestId('vs-burn-cite')
    expect(cite.getAttribute('href')).toBe('https://stripe.example/pricing')
    expect(burn.textContent).toContain('as of 2026-09-01')
    // A usage rate is never blended into a monthly figure.
    expect(burn.textContent).toContain('never blended into an invented monthly figure')
  })

  it('a picked vendor with no extracted pricing renders as "no published pricing"', () => {
    // Restore a run whose payments pick is square (no pricing entry in the fixture).
    const encoded = encodeRunState({
      choices: { team: 'cofounders' },
      preset: null,
      yc: false,
      founder: DEFAULT_FOUNDER_AXES,
      mode: 'auto',
      companyName: null,
      picks: { payments: 'square' },
      eventChoices: {},
      assistant: null,
      ycApply: false,
      seed: 0,
    })
    window.history.replaceState(null, '', `/?run=${encoded}`)
    renderIt()
    showAll()
    expect(within(screen.getByTestId('vs-score-burn')).getByTestId('vs-burn-gap').textContent).toContain('no published pricing')
  })
})

// The 'Set vendors' disclosure's role picker (round 8: the Vendors tab became a collapsible
// disclosure): open the disclosure if collapsed, then the SimRolePicker trigger (the
// aria-haspopup=listbox button — never matched by name, the reset button's label also carries
// the vendor name) and click an option.
const pickVendorInTab = (optionName: RegExp) => {
  const panel = screen.getByTestId('vs-set-vendors')
  if (!panel.hasAttribute('open')) fireEvent.click(screen.getByTestId('vs-set-vendors-summary'))
  const trigger = within(panel)
    .getAllByRole('button')
    .find((b) => b.getAttribute('aria-haspopup') === 'listbox')!
  fireEvent.click(trigger)
  fireEvent.click(within(panel).getByRole('option', { name: optionName }))
}

describe('pick your vendors and rerun (founder addenda #2/#3, 2026-09-29)', () => {
  it('vendor picks PERSIST across ▶ Run it again — they are the reader\'s stack, not run state', () => {
    renderIt()
    showAll()
    expect(screen.getByTestId('vs-step-outnote')).toBeTruthy() // default stripe: founder-hours
    pickVendorInTab(/Square/)
    showAll() // '▶ Run it again' — a plain restart
    expect(screen.queryByTestId('vs-step-outnote')).toBeNull() // square's MCP surface applied
    showAll() // and again — the pick still holds
    expect(screen.queryByTestId('vs-step-outnote')).toBeNull()
    // The Vendors tab still shows the swap (count badge + swapped marker).
    expect(screen.getByTestId('vs-set-vendors-summary').textContent).toContain('· 1')
    expect(screen.getByTestId('vs-set-vendors').textContent).toContain('(swapped)')
  })

  it('swap while a SEMI-AUTO card holds the run (addendum #2 — the title-bar pause is gone, item 2): printed transcript byte-stable, DAG keeps its lit nodes, the resumed tail uses the new vendor', () => {
    renderIt()
    fireEvent.click(screen.getByTestId('vs-mode-semi'))
    vi.useFakeTimers()
    try {
      fireEvent.click(screen.getByRole('button', { name: /run this startup/i }))
      // Advance until a decision card holds the run mid-transcript (skip the naming card).
      let card: HTMLElement | null = null
      for (let guard = 0; guard < 400 && card === null; guard++) {
        act(() => {
          vi.advanceTimersByTime(240)
        })
        if (screen.queryByTestId('vs-run-naming')) {
          fireEvent.click(screen.getByTestId('vs-run-naming-skip'))
          continue
        }
        card = screen.queryByTestId('vs-run-decision')
      }
      expect(card).toBeTruthy()
      const printed = screen.getByTestId('vs-terminal-body').querySelector('ol')!.innerHTML
      const litNodes = Array.from(
        screen.getByTestId('vs-journeydag').querySelectorAll('[data-testid^="vs-dag-node-"]'),
      ).map((n) => `${n.getAttribute('data-testid')}:${n.getAttribute('data-dag-state')}`)
      // The pickers stay usable while the card holds the run; the pick applies WITHOUT resetting…
      pickVendorInTab(/Square/)
      expect(screen.getByTestId('vs-terminal-body').querySelector('ol')!.innerHTML).toBe(printed)
      expect(
        Array.from(screen.getByTestId('vs-journeydag').querySelectorAll('[data-testid^="vs-dag-node-"]')).map(
          (n) => `${n.getAttribute('data-testid')}:${n.getAttribute('data-dag-state')}`,
        ),
      ).toEqual(litNodes)
      // …then answer every remaining card and run out: the tail picked up the surfaced vendor —
      // no founder-hours badge anywhere in the completed transcript.
      const answers: Record<string, string> = {
        team: 'cofounders', funding: 'seed', product: 'subscriptions', hire: 'yes',
        compliance: 'now', enterprise: 'no', ph: 'yes', remote: 'remote',
      }
      for (let guard = 0; guard < 800 && !(screen.getByTestId('vs-terminal-body').textContent ?? '').includes('journey complete'); guard++) {
        act(() => {
          vi.advanceTimersByTime(240)
        })
        if (screen.queryByTestId('vs-run-naming')) {
          fireEvent.click(screen.getByTestId('vs-run-naming-skip'))
          continue
        }
        if (screen.queryByTestId('vs-run-decision')) {
          const button = Object.entries(answers)
            .map(([id, value]) => screen.queryByTestId(`vs-run-decision-${id}-${value}`))
            .find((b) => b !== null)
          expect(button).toBeTruthy()
          fireEvent.click(button!)
        }
      }
      expect(screen.getByTestId('vs-terminal-body').textContent).toContain('journey complete')
      expect(screen.queryByTestId('vs-step-outnote')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('swap-while-STOPPED (⏹): the frozen transcript never rewrites; the next Run replays with the new pick', () => {
    renderIt()
    vi.useFakeTimers()
    try {
      fireEvent.click(screen.getByRole('button', { name: /run this startup/i }))
      act(() => {
        vi.advanceTimersByTime(240 * 5)
      })
      fireEvent.click(screen.getByRole('button', { name: /stop/i })) // ⏹ — reveal kept, ticker gone
      const printed = screen.getByTestId('vs-terminal-body').querySelector('ol')!.innerHTML
      pickVendorInTab(/Square/)
      expect(screen.getByTestId('vs-terminal-body').querySelector('ol')!.innerHTML).toBe(printed)
      // ⏹ has no resume — the Run press is a restart, and the pick rides into it.
      fireEvent.click(screen.getByRole('button', { name: /run this startup/i }))
      act(() => {
        vi.runAllTimers()
      })
      expect(screen.getByTestId('vs-terminal-body').textContent).toContain('journey complete')
      expect(screen.queryByTestId('vs-step-outnote')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('swap-while-RUNNING applies immediately at the same invariant (our call over pause-then-apply): printed prefix stable, tail picks it up', () => {
    renderIt()
    vi.useFakeTimers()
    try {
      fireEvent.click(screen.getByRole('button', { name: /run this startup/i }))
      act(() => {
        vi.advanceTimersByTime(240 * 3)
      })
      const printed = screen.getByTestId('vs-terminal-body').querySelector('ol')!.innerHTML
      pickVendorInTab(/Square/) // no pause inserted — the reveal just keeps printing
      expect(screen.getByTestId('vs-terminal-body').querySelector('ol')!.innerHTML).toBe(printed)
      act(() => {
        vi.runAllTimers()
      })
      expect(screen.getByTestId('vs-terminal-body').textContent).toContain('journey complete')
      expect(screen.queryByTestId('vs-step-outnote')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('the picks ride the ?run= permalink (round-trip through copy run link)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderIt()
    pickVendorInTab(/Square/)
    showAll()
    fireEvent.click(screen.getByTestId('vs-copy-run-link'))
    expect(await screen.findByText('Copied ✓')).toBeTruthy()
    const param = new URL(writeText.mock.calls[0][0] as string).searchParams.get('run')!
    expect(decodeRunState(param)!.picks).toEqual({ payments: 'square' })
  })

  it('the scorecard labels judged-top vs your-pick vendors, and the completion area offers the rerun affordance only when a pick differs', () => {
    renderIt()
    // Default run: every burn line is the judged top; no affordance (nothing swapped).
    showAll()
    expect(screen.getByTestId('vs-burn-line').getAttribute('data-pick-source')).toBe('judged')
    expect(screen.getByTestId('vs-burn-line').textContent).toContain('[judged top]')
    expect(screen.queryByTestId('vs-rerun-vendors')).toBeNull()
    // Swap to PayPal (priced, non-default) and rerun: the burn line says it was YOUR pick.
    pickVendorInTab(/PayPal/)
    showAll()
    const line = screen.getByTestId('vs-burn-line')
    expect(line.textContent).toContain('PayPal')
    expect(line.getAttribute('data-pick-source')).toBe('user')
    expect(line.textContent).toContain('[your pick]')
    // The honest loop line + affordance — one click reruns with the same picks.
    const affordance = screen.getByTestId('vs-rerun-vendors')
    expect(affordance.textContent).toContain('1 vendor role')
    vi.useFakeTimers()
    try {
      fireEvent.click(screen.getByTestId('vs-rerun-vendors-btn'))
      act(() => {
        vi.runAllTimers()
      })
    } finally {
      vi.useRealTimers()
    }
    expect(screen.getByTestId('vs-terminal-body').textContent).toContain('journey complete')
    expect(screen.getByTestId('vs-burn-line').textContent).toContain('PayPal') // picks persisted
  })
})

describe('shareable permalink — the exact run replays from ?run=', () => {
  it('restores combo, persona, and picks from the URL (the surface-bearing pick removes the founder-hours badge)', () => {
    const encoded = encodeRunState({
      choices: {
        entity: 'llc', funding: 'bootstrap', product: 'invoices', team: 'solo',
        ordering: 'build-first', hire: 'no', compliance: 'later', enterprise: 'no', ph: 'no',
      },
      preset: null,
      yc: false,
      founder: { technical: 'technical', experience: 'second-timer' },
      mode: 'auto',
      companyName: null,
      picks: { payments: 'square' },
      eventChoices: {},
      assistant: null,
      ycApply: false,
      seed: 3,
    })
    window.history.replaceState(null, '', `/?run=${encoded}`)
    renderIt()
    expect(screen.getByTestId('vs-decision-entity').getAttribute('aria-label')).toContain('LLC')
    expect(screen.getByTestId('vs-decision-funding').getAttribute('aria-label')).toContain('Bootstrap')
    // The restored axis pair shows as the single founder selector's combo (addendum 2026-09-30).
    expect(screen.getByTestId('vs-persona-trigger').textContent).toContain('Technical, repeat entrepreneur')
    showAll()
    // square has a judged MCP surface — the payments step runs at agent speed, no sim badge.
    expect(screen.queryByTestId('vs-step-outnote')).toBeNull()
  })

  it('copy run link writes the whole state to the clipboard and the URL, and it decodes back', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderIt()
    showAll()
    fireEvent.click(screen.getByTestId('vs-event-choice-processor-review-wait'))
    fireEvent.click(screen.getByTestId('vs-copy-run-link'))
    expect(await screen.findByText('Copied ✓')).toBeTruthy()
    const url = new URL(writeText.mock.calls[0][0] as string)
    const param = url.searchParams.get('run')!
    expect(new URLSearchParams(window.location.search).get('run')).toBe(param)
    const decoded = decodeRunState(param)!
    expect(decoded.eventChoices['processor-review']).toBe('wait')
    expect(decoded.founder).toEqual(DEFAULT_FOUNDER_AXES)
    expect(decoded.mode).toBe('auto')
    // Nothing was touched in the dropdowns — the link omits every 'Not set' decision and
    // carries exactly the round-7 DEFAULT-ASSERTED state (2026-10-01, item 5: the founder's
    // demo composition, asserted from the first render), plus the ChatGPT assistant default.
    expect(decoded.choices).toEqual({
      entity: 'c-corp', team: 'cofounders', funding: 'seed', compliance: 'now', ph: 'x', remote: 'office',
    })
    expect(decoded.assistant).toBe('chatgpt')
  })

  it('a malformed ?run= is ignored (default view, no crash)', () => {
    window.history.replaceState(null, '', '/?run=!!!garbage!!!')
    renderIt()
    // Default view: the round-7 DEFAULT-ASSERTED set keeps its values, the rest reads 'Not set'.
    expect(screen.getByTestId('vs-decision-entity').textContent).toContain('C-Corp')
    expect(screen.getByTestId('vs-decision-team').textContent).toContain('Cofounders')
    expect(screen.getByTestId('vs-decision-product').textContent).toContain('Not set')
  })

  it('ERA REPLAY (2026-10-01, item 5): a legacy ?run= with elided launch/workplace slots keeps its own era — PH venue, no lease phase — while a fresh visit composes the new defaults (X launch + office)', () => {
    // Fresh visit first: the round-7 demo composition — X-venue launch artifact + the ops_014
    // lease phase, both default-asserted.
    const fresh = renderIt()
    showAll()
    expect(within(screen.getByTestId('vs-terminal-body')).getByText('Lease an office')).toBeTruthy()
    const freshLaunch = screen.getAllByTestId('vs-artifact').find((a) => /Launch day/.test(a.textContent ?? ''))!
    expect(freshLaunch.textContent).toContain('drafted on X')
    fresh.unmount()
    // A legacy v2 link that asserted only entity (the old default-asserted set) and elided the
    // rest — exactly what pre-round-7 links carried. The elided slots must replay THEIR era:
    // the launch artifact keeps the PH-directories venue and the office lease never composes —
    // only the composition-neutral underlay (entity/team/funding/compliance) asserts.
    const legacy = encodeRunState({
      choices: { entity: 'c-corp' }, preset: null, yc: false, founder: DEFAULT_FOUNDER_AXES,
      mode: 'auto', companyName: null, picks: {}, eventChoices: {}, assistant: null, ycApply: false, seed: 0,
    })
    window.history.replaceState(null, '', `/?run=${legacy}`)
    renderIt()
    expect(screen.getByTestId('vs-decision-ph').textContent).toContain('Not set')
    expect(screen.getByTestId('vs-decision-remote').textContent).toContain('Not set')
    showAll()
    expect(screen.queryByText('Lease an office')).toBeNull()
    const legacyLaunch = screen.getAllByTestId('vs-artifact').find((a) => /Launch day/.test(a.textContent ?? ''))!
    expect(legacyLaunch.textContent).toContain('queued on the directories')
    expect(legacyLaunch.textContent).not.toContain('drafted on X')
  })
})
