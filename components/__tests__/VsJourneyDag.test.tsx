// @vitest-environment jsdom
// VsJourneyDag — the journey DAG viewer (founder ask 2026-09-29; round-5 rework: "use vertical
// space more" — a wrapping flow of FIXED-size nodes replaces round 4's fisheye zoom). What must
// hold:
//   - the strip has NO timers of its own — everything derives from the shared rows/revealed state;
//   - REVEAL-ON-REACH: pre-run ONLY the first node renders (dim); upcoming nodes are NOT shown —
//     each appears when the reveal reaches its task row, so visible count == reached count;
//   - WRAPPING FLOW: nodes render at one comfortable FIXED size (icon + title legible ALWAYS —
//     no data-dag-size tiers, no title hiding) and wrap left→right, top→bottom in a flex-wrap
//     row (no overflow-x, no w-max) — the container grows vertically with content;
//   - HEIGHT CAP + FOLLOW: past min(45vh, 380px) the strip scrolls VERTICALLY only, auto-pinned
//     to the newest (active) node while following, with the terminal's follow-slack courtesy
//     (scroll up unpins; back near the bottom re-pins) — smoke-tested via a scrollTop mock;
//   - EDGES: a simple in-row connector leads every node after the first; an item measured at the
//     start of a wrapped row swaps it for the WRAP ELBOW — a drawn drop-in curve + arrowhead,
//     lit like an edge (founder 2026-10-02: the old ↵ text hint was too subtle) — (pure helper
//     dagWrapStartIds; jsdom does no layout, so the swap is driven via mocked offsetTops);
//   - cluster grouping survives as a chain-tinted label chip leading each phase's first node;
//   - nodes light progressively as the terminal reveal passes them (pending → active → done),
//     with exactly the node whose rows are printing carrying the active state (pulsing emerald);
//   - seeded mid-run events and semi-auto pauses render as diamond markers attached under the
//     node whose terminal region carries them (the awaited pause pulses);
//   - clicking a node asks the parent to scroll the terminal to that process's first row (smoke);
//   - a semi-auto recomposition redraws only the unrevealed tail — every already-lit node keeps
//     its identity and order across each in-run decision pick.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VirtualStartup from '@/components/VirtualStartup'
import VsJourneyDag, {
  activeDagTaskId,
  dagNodeReached,
  dagNodeState,
  dagVisibleTaskIds,
  dagWrapStartIds,
  deriveJourneyDag,
  type VsDagSourceRow,
} from '@/components/VsJourneyDag'
import type { SimStep } from '@/lib/processSim'
import type { SyntheticArtifact, TopVendorPick, VirtualTaskPayload, VsChain } from '@/lib/virtualStartup'

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

// ---------------------------------------------------------------------------
// Unit level: the pure derivation over a hand-built row list.
// ---------------------------------------------------------------------------

const TOP: TopVendorPick = { productId: 'best-legal', name: 'Best Legal', score: 82.5, arenaId: 'legal-ops', arenaName: 'Legal ops' }
const ARTIFACT: SyntheticArtifact = { taskId: 'form_001', label: 'EIN', value: '00-0000000', simulated: true }

const taskA = task('form_001', 'Incorporate C-Corp', {
  steps: [step('form_001', 'file it', { route: 'form' }), step('form_001', 'wait for it', { route: 'person' })],
  tops: [TOP, null],
})
const taskB = task('site_001', 'Generate a website')

// 0 phase · 1 task A · 2 step (top) · 3 step · 4 artifact · 5 event · 6 phase · 7 task B · 8 step
const UNIT_ROWS: VsDagSourceRow[] = [
  { kind: 'phase', key: 'phase-form', title: 'Form the company', chainId: 'company-launch', chainName: 'Company launch', note: null },
  { kind: 'task', key: 'task-form_001', task: taskA },
  { kind: 'step', key: 'step-form_001-0', step: taskA.steps[0], top: TOP, outNote: null, outMinutes: 10 },
  { kind: 'step', key: 'step-form_001-1', step: taskA.steps[1], top: null, outNote: null, outMinutes: 10 },
  { kind: 'artifact', key: 'artifact-form_001-0', artifact: ARTIFACT },
  { kind: 'vsevent', key: 'vsevent-ev1', eventId: 'ev1', day: 2 },
  { kind: 'phase', key: 'phase-website', title: 'Launch the website', chainId: 'launch-website', chainName: 'Launch website', note: null },
  { kind: 'task', key: 'task-site_001', task: taskB },
  { kind: 'step', key: 'step-site_001-0', step: taskB.steps[0], top: null, outNote: null, outMinutes: 10 },
]

describe('deriveJourneyDag — pure derivation', () => {
  it('builds one node per process with its row span, phase cluster, and first top pick', () => {
    const { clusters, markers } = deriveJourneyDag(UNIT_ROWS)
    expect(clusters.map((c) => c.title)).toEqual(['Form the company', 'Launch the website'])
    expect(clusters[0].chainId).toBe('company-launch')
    const [a] = clusters[0].nodes
    const [b] = clusters[1].nodes
    expect(a).toMatchObject({ taskId: 'form_001', rowStart: 1, rowEnd: 5, stepCount: 2, agentSteps: 0 })
    expect(a.vendor).toEqual({ productId: 'best-legal', name: 'Best Legal', hasLogo: false })
    expect(a.vendorRow).toBe(2)
    expect(b).toMatchObject({ taskId: 'site_001', rowStart: 7, rowEnd: 8, agentSteps: 1 })
    // The event marker attaches under the node whose terminal region carries it.
    expect(markers).toEqual([{ kind: 'event', key: 'event-ev1', id: 'ev1', day: 2, taskId: 'form_001', at: 5 }])
  })

  it('attaches pause markers to the node containing the pause row; a Run-press pause (at 0) floats before the first node', () => {
    const { markers } = deriveJourneyDag(UNIT_ROWS, [
      { id: 'ordering', at: 0, label: 'What comes first' },
      { id: 'hire', at: 7, label: 'First hire' },
    ])
    const pauses = markers.filter((m) => m.kind === 'pause')
    expect(pauses).toEqual([
      { kind: 'pause', key: 'pause-ordering', id: 'ordering', day: null, taskId: null, at: 0 },
      { kind: 'pause', key: 'pause-hire', id: 'hire', day: null, taskId: 'site_001', at: 7 },
    ])
  })

  it('derives node state from the shared reveal counter (active = the node whose rows are printing)', () => {
    const { clusters } = deriveJourneyDag(UNIT_ROWS)
    const [a] = clusters[0].nodes
    const [b] = clusters[1].nodes
    expect(dagNodeState(a, 0)).toBe('pending')
    expect(dagNodeState(a, 2)).toBe('active') // its task row printed, steps still printing
    expect(dagNodeState(a, 6)).toBe('done') // every row under it printed
    expect(dagNodeState(b, 6)).toBe('pending')
    expect(activeDagTaskId(clusters, 2)).toBe('form_001')
    expect(activeDagTaskId(clusters, 8)).toBe('site_001')
    expect(activeDagTaskId(clusters, UNIT_ROWS.length)).toBe(null) // run complete — nothing active
  })

  it('reveal-on-reach: a node is visible once the reveal reaches its task row; pre-run only the FIRST node shows', () => {
    const { clusters } = deriveJourneyDag(UNIT_ROWS)
    const [a] = clusters[0].nodes
    const [b] = clusters[1].nodes
    expect(dagNodeReached(a, 0)).toBe(false)
    expect(dagNodeReached(a, 1)).toBe(true) // its task row is the next to print — the cluster started
    expect(dagNodeReached(b, 6)).toBe(false) // upcoming — never shown early
    expect(dagNodeReached(b, 7)).toBe(true)
    // Pre-run fallback: nothing reached → exactly the journey's first node, dim.
    expect(dagVisibleTaskIds(clusters, 0)).toEqual(new Set(['form_001']))
    expect(dagVisibleTaskIds(clusters, 2)).toEqual(new Set(['form_001']))
    expect(dagVisibleTaskIds(clusters, 7)).toEqual(new Set(['form_001', 'site_001']))
    expect(dagVisibleTaskIds(clusters, UNIT_ROWS.length)).toEqual(new Set(['form_001', 'site_001']))
  })

  it('dagWrapStartIds (round 5): an item measured below its predecessor starts a wrapped row (its connector becomes the ↵ hint)', () => {
    // One row: nothing wraps.
    expect(dagWrapStartIds([{ id: 'a', top: 0 }, { id: 'b', top: 0 }, { id: 'c', top: 0 }])).toEqual(new Set())
    // b and d each open a new visual row; c continues b's row.
    expect(
      dagWrapStartIds([
        { id: 'a', top: 0 },
        { id: 'b', top: 40 },
        { id: 'c', top: 40 },
        { id: 'd', top: 80 },
      ]),
    ).toEqual(new Set(['b', 'd']))
    // Empty and single-item flows never wrap.
    expect(dagWrapStartIds([])).toEqual(new Set())
    expect(dagWrapStartIds([{ id: 'a', top: 120 }])).toEqual(new Set())
  })
})

// ---------------------------------------------------------------------------
// Component level: rendering states, wrap-flow invariants, follow scroll, markers, vendor dot,
// click wiring, no own timers.
// ---------------------------------------------------------------------------

// jsdom does no real layout or scrolling, so the strip's follow logic runs against a fake
// scroll box (the same precedent as VirtualStartup.test.tsx's terminal-follow suite).
function mockScrollBox(el: HTMLElement, { scrollHeight, clientHeight }: { scrollHeight: number; clientHeight: number }) {
  let top = 0
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => scrollHeight })
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => clientHeight })
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (v: number) => { top = v },
  })
}

describe('VsJourneyDag — rendering', () => {
  it('pre-run renders ONLY the first node, dim, and never starts a reveal clock of its own', () => {
    // No interval, ever — the strip only derives from rows/revealed (React itself may schedule
    // setTimeout work, so the interval primitive is the attributable assertion; the integration
    // suite below additionally proves the strip stays frozen while the shared ticker is stopped).
    const spy = vi.spyOn(window, 'setInterval')
    try {
      render(<VsJourneyDag rows={UNIT_ROWS} revealed={0} running={false} />)
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
    // Reveal-on-reach: upcoming nodes are NOT shown — only the journey's first node, dim
    // (pending); the upcoming cluster's chip doesn't render either.
    const nodes = screen.getByTestId('vs-journeydag').querySelectorAll('[data-testid^="vs-dag-node-"]')
    expect(nodes.length).toBe(1)
    expect(screen.getByTestId('vs-dag-node-form_001').getAttribute('data-dag-state')).toBe('pending')
    expect(screen.queryByTestId('vs-dag-node-site_001')).toBeNull()
    expect(screen.getAllByTestId('vs-dag-cluster')).toHaveLength(1)
    // No vendor dots yet; the first node's event marker is present but dim.
    expect(screen.queryByTestId('vs-dag-vendor-best-legal')).toBeNull()
    expect(screen.getByTestId('vs-dag-marker-event').className).toContain('fuchsia-400/30')
  })

  it('lights nodes with the reveal: active pulses emerald, done fills; upcoming stays hidden; the vendor logo attaches INSIDE the node box once its step printed', () => {
    const { rerender } = render(<VsJourneyDag rows={UNIT_ROWS} revealed={2} running />)
    const activeNode = screen.getByTestId('vs-dag-node-form_001')
    expect(activeNode.getAttribute('data-dag-state')).toBe('active')
    expect(activeNode.className).toContain('emerald')
    expect(screen.queryByTestId('vs-dag-node-site_001')).toBeNull() // upcoming — not reached yet
    expect(screen.queryByTestId('vs-dag-vendor-best-legal')).toBeNull() // top-pick step not printed yet
    rerender(<VsJourneyDag rows={UNIT_ROWS} revealed={6} running />)
    expect(screen.getByTestId('vs-dag-node-form_001').getAttribute('data-dag-state')).toBe('done')
    expect(screen.queryByTestId('vs-dag-node-site_001')).toBeNull() // still one row short of reached
    expect(screen.getByTestId('vs-dag-vendor-best-legal')).toBeTruthy()
    // Founder 2026-10-02: the logo rides INSIDE the node box (trailing the title), so it reads
    // as the node's vendor — not a floating dot in the under-node row.
    expect(
      screen.getByTestId('vs-dag-node-form_001').contains(screen.getByTestId('vs-dag-vendor-best-legal')),
    ).toBe(true)
    expect(screen.getByTestId('vs-dag-marker-event').className).toContain('fuchsia-400/90') // event revealed
    rerender(<VsJourneyDag rows={UNIT_ROWS} revealed={8} running />)
    expect(screen.getByTestId('vs-dag-node-site_001').getAttribute('data-dag-state')).toBe('active')
  })

  it('wrap-flow invariants: fixed-size nodes (no size tiers) in a flex-wrap row, vertical-only scroll, visible == reached, one connector per non-first node', () => {
    for (const revealed of [0, 2, 6, 8, UNIT_ROWS.length]) {
      const view = render(<VsJourneyDag rows={UNIT_ROWS} revealed={revealed} running={false} />)
      const strip = screen.getByTestId('vs-journeydag-strip')
      // Vertical-only: capped natural height with internal Y scroll — NEVER a sideways scroll.
      // overflow-x-hidden is load-bearing: with overflow-y-auto alone, overflow-x COMPUTES to
      // auto, so an unshrinkable cluster-led item on a narrow phone grew a sideways scrollbar.
      expect(strip.className).toContain('overflow-x-hidden')
      expect(strip.className).not.toContain('overflow-x-auto')
      expect(strip.className).toContain('overflow-y-auto')
      expect(strip.className).toContain('max-h-[min(45vh,380px)]')
      const row = strip.querySelector('ol')!
      expect(row.className).toContain('flex-wrap') // the flow wraps in reading order
      expect(row.className).toContain('w-full')
      expect(row.className).not.toContain('w-max')
      const nodes = Array.from(strip.querySelectorAll<HTMLElement>('[data-testid^="vs-dag-node-"]'))
      // Visible node count == reached count (pre-run: the single dim first node).
      const { clusters } = deriveJourneyDag(UNIT_ROWS)
      const reached = dagVisibleTaskIds(clusters, revealed)
      expect(nodes.length).toBe(reached.size)
      for (const n of nodes) {
        // FIXED size: no tier attribute, and each flow item is shrink-0 — it wraps as a unit
        // instead of compressing.
        expect(n.getAttribute('data-dag-size')).toBeNull()
        expect(n.closest('[data-dag-flow]')!.className).toContain('shrink-0')
      }
      // Edges: every node after the first carries exactly one leading connector (jsdom measures
      // no layout → nothing registers as wrapped, so no ↵ hints render here).
      const edges = strip.querySelectorAll('[data-testid="vs-dag-edge"]')
      const hints = strip.querySelectorAll('[data-testid="vs-dag-wrap-hint"]')
      expect(edges.length + hints.length).toBe(Math.max(0, nodes.length - 1))
      view.unmount()
    }
  })

  it('the wrap connector is a visible lit-aware ELBOW (founder 2026-10-02): a wrapped row leads with the drawn drop-in curve + arrowhead, emerald once traversed', () => {
    // jsdom reports every offsetTop as 0, so the wrap classification is forced by mocking the
    // flow items' offsetTops and re-rendering (the dependency-less measure effect re-runs on
    // every commit and converges via its set-equality guard).
    const mockFlowTops = (strip: HTMLElement, tops: Record<string, number>) => {
      for (const el of Array.from(strip.querySelectorAll<HTMLElement>('[data-dag-flow]'))) {
        const top = tops[el.getAttribute('data-dag-flow')!] ?? 0
        Object.defineProperty(el, 'offsetTop', { configurable: true, get: () => top })
      }
    }
    // Traversed wrap: both nodes done → the elbow lights emerald, exactly like an in-row edge.
    const done = render(<VsJourneyDag rows={UNIT_ROWS} revealed={UNIT_ROWS.length} running={false} />)
    const strip = screen.getByTestId('vs-journeydag-strip')
    expect(screen.queryByTestId('vs-dag-wrap-hint')).toBeNull() // all tops 0 — nothing wraps yet
    mockFlowTops(strip, { site_001: 40 }) // site_001 measured below form_001 → starts a wrapped row
    done.rerender(<VsJourneyDag rows={UNIT_ROWS} revealed={UNIT_ROWS.length} running={false} />)
    const hint = screen.getByTestId('vs-dag-wrap-hint')
    expect(hint.tagName.toLowerCase()).toBe('svg') // a DRAWN connector — not the old ↵ text hint
    expect(hint.textContent).not.toContain('↵')
    const [elbow, head] = Array.from(hint.querySelectorAll('path'))
    expect(elbow.getAttribute('d')).toContain('Q') // the drop-in curve from the row above
    expect(elbow.getAttribute('class')).toContain('stroke-emerald-400/70')
    expect(head.getAttribute('class')).toContain('fill-emerald-400/70')
    // The single connector slot swapped — no in-row edge remains beside it.
    expect(strip.querySelectorAll('[data-testid="vs-dag-edge"]').length).toBe(0)
    done.unmount()
    // Un-traversed wrap: the just-reached (still pending) node's elbow stays dim zinc.
    const reached = render(<VsJourneyDag rows={UNIT_ROWS} revealed={7} running />)
    mockFlowTops(screen.getByTestId('vs-journeydag-strip'), { site_001: 40 })
    reached.rerender(<VsJourneyDag rows={UNIT_ROWS} revealed={7} running />)
    const dim = screen.getByTestId('vs-dag-wrap-hint')
    expect(dim.querySelector('path')!.getAttribute('class')).toContain('stroke-zinc-600')
    reached.unmount()
  })

  it('nodes keep FULL fixed size at any count: icon + title legible always, no tier ever hides a title', () => {
    // A 12-node journey (one cluster per node) — round 4 would have compressed this to the 'sm'
    // tier and hidden every non-active title; round 5 must not.
    const many: VsDagSourceRow[] = []
    for (let i = 0; i < 12; i++) {
      const t = task(`task_${i}`, `Process ${i}`)
      many.push({ kind: 'phase', key: `phase-${i}`, title: `Phase ${i}`, chainId: 'ship-v1', chainName: 'Ship v1', note: null })
      many.push({ kind: 'task', key: `task-task_${i}`, task: t })
      many.push({ kind: 'step', key: `step-task_${i}-0`, step: t.steps[0], top: null, outNote: null, outMinutes: 10 })
    }
    // Reveal into the LAST node's span: 11 done + 1 active = 12 visible.
    render(<VsJourneyDag rows={many} revealed={many.length - 1} running />)
    expect(screen.getByTestId('vs-journeydag').getAttribute('data-dag-tier')).toBeNull() // tiers are gone
    const active = screen.getByTestId('vs-dag-node-task_11')
    expect(active.getAttribute('data-dag-state')).toBe('active')
    expect(active.textContent).toContain('Process 11')
    for (let i = 0; i < 12; i++) {
      const n = screen.getByTestId(`vs-dag-node-task_${i}`)
      expect(n.textContent).toContain(`Process ${i}`) // every title renders — no compression tiers
      expect(n.getAttribute('aria-label')).toBe(`Process ${i}`)
      expect(n.querySelector('[aria-hidden]')).toBeTruthy() // the icon stays
      expect(n.getAttribute('data-dag-size')).toBeNull()
    }
    // Every cluster chip renders too — grouping survives the wrap as leading chips.
    expect(screen.getAllByTestId('vs-dag-cluster')).toHaveLength(12)
  })

  it('height cap + follow (smoke): pins to the newest node on each reveal, unpins when the reader scrolls up, re-pins within the slack', () => {
    const { rerender } = render(<VsJourneyDag rows={UNIT_ROWS} revealed={2} running />)
    const strip = screen.getByTestId('vs-journeydag-strip')
    mockScrollBox(strip, { scrollHeight: 400, clientHeight: 200 })
    rerender(<VsJourneyDag rows={UNIT_ROWS} revealed={3} running />)
    expect(strip.scrollTop).toBe(400) // pinned to the bottom — the active node is always the newest
    // The reader scrolls up mid-run → follow pauses; new reveals must not yank them back down.
    strip.scrollTop = 50
    fireEvent.scroll(strip)
    rerender(<VsJourneyDag rows={UNIT_ROWS} revealed={6} running />)
    expect(strip.scrollTop).toBe(50)
    // Back within the slack of the bottom → follow re-engages on the next reveal.
    strip.scrollTop = 190 // 190 + 200 ≥ 400 − 24
    fireEvent.scroll(strip)
    rerender(<VsJourneyDag rows={UNIT_ROWS} revealed={8} running />)
    expect(strip.scrollTop).toBe(400)
    // An emptied strip (restart) rests at its top and re-arms the follow.
    rerender(<VsJourneyDag rows={UNIT_ROWS} revealed={0} running={false} />)
    expect(strip.scrollTop).toBe(0)
    rerender(<VsJourneyDag rows={UNIT_ROWS} revealed={2} running />)
    expect(strip.scrollTop).toBe(400)
  })

  it('renders pause diamonds and pulses the one the run is waiting on', () => {
    render(
      <VsJourneyDag
        rows={UNIT_ROWS}
        revealed={7}
        running={false}
        waitingOn="hire"
        pauses={[{ id: 'hire', at: 7, label: 'First hire' }]}
      />,
    )
    const marker = screen.getByTestId('vs-dag-marker-pause')
    expect(marker.getAttribute('data-marker-id')).toBe('hire')
    expect(marker.getAttribute('data-marker-active')).toBe('true')
    expect(marker.className).toContain('animate-pulse')
  })

  it('node click calls onNodeClick with the process id (the parent scrolls the terminal)', () => {
    const onNodeClick = vi.fn()
    render(<VsJourneyDag rows={UNIT_ROWS} revealed={UNIT_ROWS.length} running={false} onNodeClick={onNodeClick} />)
    fireEvent.click(screen.getByTestId('vs-dag-node-site_001'))
    expect(onNodeClick).toHaveBeenCalledWith('site_001')
    // The secondary ↗ links the real process page.
    expect(screen.getByTestId('vs-dag-open-site_001').getAttribute('href')).toContain('/processes/generate-a-website')
  })
})

// ---------------------------------------------------------------------------
// Integration level: the strip inside VirtualStartup, driven by the REAL reveal ticker.
// ---------------------------------------------------------------------------

// journeyPhases resolves every VS_CHAIN_IDS chain, so the fixture must cover all ten (the same
// convention as components/__tests__/VirtualStartup.test.tsx).
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
    task('form_001', 'Incorporate C-Corp', {
      steps: [step('form_001', 'Submit incorporation filing', { route: 'form' }), step('form_001', 'Receive certificate', { route: 'person' })],
      tops: [TOP, null],
    }),
    task('form_011', 'Set up an LLC'),
    task('startup_002', 'Founder agreement & equity split'),
    task('qs_023', 'Open bank account'),
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
    // The round-7 default composition (2026-10-01, item 5) asserts Office — the lease process.
    task('ops_014', 'Lease an office'),
  ].map((t) => [t.id, t]),
)

const renderIt = () =>
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
    />,
  )

const dagNodes = () => Array.from(screen.getByTestId('vs-journeydag').querySelectorAll('[data-testid^="vs-dag-node-"]'))
const dagStates = () => dagNodes().map((n) => n.getAttribute('data-dag-state'))
const litIds = () =>
  dagNodes()
    .filter((n) => n.getAttribute('data-dag-state') !== 'pending')
    .map((n) => n.getAttribute('data-testid'))
const isDone = () => (screen.getByTestId('vs-terminal-body').textContent ?? '').includes('journey complete')

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('VsJourneyDag inside VirtualStartup — the live viewer above the terminal', () => {
  it('pre-run: ONLY the first node renders, dim, above the terminal (upcoming nodes hidden — reveal-on-reach)', () => {
    renderIt()
    // The strip precedes the terminal in document order — it sits on top of the output.
    const strip = screen.getByTestId('vs-journeydag')
    const term = screen.getByTestId('vs-terminal')
    expect(strip.compareDocumentPosition(term) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(dagNodes().length).toBe(1) // the journey's first node only — nothing upcoming shows
    expect(new Set(dagStates())).toEqual(new Set(['pending']))
    // The wrapping flow (round 5): natural height capped at min(45vh, 380px) with vertical-only
    // internal scroll — no fixed-height band, no sideways scroll.
    const body = screen.getByTestId('vs-journeydag-strip')
    expect(body.className).toContain('max-h-[min(45vh,380px)]')
    expect(body.className).toContain('overflow-y-auto')
    expect(body.className).toContain('overflow-x-hidden') // explicit: overflow-y-auto alone computes overflow-x to auto
    expect(body.className).not.toContain('overflow-x-auto')
    expect(body.className).not.toContain('h-[140px]')
    expect(body.querySelector('ol')!.className).toContain('flex-wrap')
  })

  it('reveals + lights progressively with the terminal reveal (never its own timers): visible == traversed, at most one active, whole journey shown at completion', () => {
    renderIt()
    vi.useFakeTimers()
    try {
      fireEvent.click(screen.getByRole('button', { name: /run this startup/i }))
      act(() => {
        vi.advanceTimersByTime(240 * 8)
      })
      const mid = dagStates()
      expect(mid.filter((s) => s === 'done').length).toBeGreaterThan(0)
      expect(mid.filter((s) => s === 'active').length).toBeLessThanOrEqual(1)
      // Reveal-on-reach mid-run: every visible node has been reached (at most the one just
      // reached is still pending), and the upcoming tail is NOT rendered yet.
      expect(mid.filter((s) => s === 'pending').length).toBeLessThanOrEqual(1)
      expect(mid.length).toBeLessThan(14)
      // With the ticker stopped, nothing advances (nothing new appears) — no clock of its own.
      const frozen = dagStates()
      fireEvent.click(screen.getByRole('button', { name: /stop/i }))
      act(() => {
        vi.advanceTimersByTime(240 * 20)
      })
      expect(dagStates()).toEqual(frozen)
      fireEvent.click(screen.getByRole('button', { name: /run this startup|run it again/i }))
      act(() => {
        vi.runAllTimers()
      })
      // Completed run: the WHOLE traversed journey renders in the flow — all 14 nodes done,
      // every title still legible (fixed node size, no tiers). The round-7 default composition
      // (2026-10-01): SOC 2 early adds ops_005, Office adds ops_014.
      expect(dagStates()).toHaveLength(14)
      expect(new Set(dagStates())).toEqual(new Set(['done']))
      for (const n of dagNodes()) expect(n.textContent!.length).toBeGreaterThan(1) // icon + title
    } finally {
      vi.useRealTimers()
    }
  })

  it('click-to-scroll smoke: a lit node click targets the terminal row and unpins the follow (no crash, no navigation)', () => {
    renderIt()
    vi.useFakeTimers()
    try {
      fireEvent.click(screen.getByRole('button', { name: /run this startup/i }))
      act(() => {
        vi.runAllTimers()
      })
    } finally {
      vi.useRealTimers()
    }
    // The terminal row the click scrolls to exists and is addressable.
    expect(screen.getByTestId('vs-terminal-body').querySelector('[data-vs-row="task-brand_001"]')).toBeTruthy()
    fireEvent.click(screen.getByTestId('vs-dag-node-brand_001'))
    expect(screen.getByTestId('vs-terminal')).toBeTruthy() // still here — no navigation, no crash
  })

  it('semi-auto: pause markers render for unasserted decisions, and each in-run pick redraws ONLY the unrevealed tail (lit nodes keep identity and order)', () => {
    renderIt()
    // The round-7 DEFAULT-ASSERTED decisions (entity, team, funding, compliance, ph, remote —
    // 2026-10-01, item 5) are never asked — clear them back to Not set so the run asks them
    // in-run like the other decisions this test answers.
    for (const id of ['entity', 'team', 'funding', 'compliance', 'ph', 'remote']) {
      fireEvent.click(screen.getByTestId(`vs-decision-${id}`))
      fireEvent.click(screen.getByTestId(`vs-decision-${id}-notset`))
    }
    fireEvent.click(screen.getByTestId('vs-mode-semi'))
    // Every unasserted decision (plus the naming card) is a diamond on the strip before the run.
    expect(screen.getAllByTestId('vs-dag-marker-pause').length).toBeGreaterThan(0)
    const answers: Record<string, string> = {
      entity: 'llc',
      team: 'solo',
      funding: 'seed',
      product: 'invoices',
      ordering: 'build-first',
      hire: 'yes',
      compliance: 'later',
      enterprise: 'yes',
      ph: 'no',
      remote: 'remote',
    }
    vi.useFakeTimers()
    try {
      fireEvent.click(screen.getByRole('button', { name: /run this startup/i }))
      for (let guard = 0; guard < 800 && !isDone(); guard++) {
        act(() => {
          vi.advanceTimersByTime(240)
        })
        const decisionCard = screen.queryByTestId('vs-run-decision')
        if (decisionCard) {
          const button = Object.entries(answers)
            .map(([id, value]) => screen.queryByTestId(`vs-run-decision-${id}-${value}`))
            .find((b) => b !== null)
          expect(button, `no answer for the paused card: ${decisionCard.textContent}`).toBeTruthy()
          const litBefore = litIds()
          fireEvent.click(button!)
          // Only the unrevealed tail recomposed — every already-lit node kept its place.
          expect(litIds()).toEqual(litBefore)
          continue
        }
        if (screen.queryByTestId('vs-run-naming')) {
          const litBefore = litIds()
          fireEvent.click(screen.getByTestId('vs-run-naming-skip'))
          expect(litIds()).toEqual(litBefore)
        }
      }
      expect(isDone()).toBe(true)
    } finally {
      vi.useRealTimers()
    }
    // The picked branches redrew the tail: LLC swapped in, the enterprise phase appended, the
    // subscriptions/PH branches dropped — and everything ended done.
    expect(screen.getByTestId('vs-dag-node-form_011')).toBeTruthy()
    expect(screen.getByTestId('vs-dag-node-comp_002')).toBeTruthy()
    expect(screen.queryByTestId('vs-dag-node-growth_001')).toBeNull()
    expect(screen.queryByTestId('vs-dag-node-growth_010')).toBeNull()
    expect(new Set(dagStates())).toEqual(new Set(['done']))
    // Answered decisions' pause markers are gone — nothing left to wait on.
    expect(screen.queryByTestId('vs-dag-marker-pause')).toBeNull()
  })
})

describe('connector footprint invariant (mobile flicker fix, founder 2026-10-01)', () => {
  // ROOT CAUSE the invariant guards: the wrap detector measures offsetTops post-commit and swaps
  // Edge \u2194 WrapHint per item. With different connector widths the swap re-flowed the wrap, the
  // next measurement flipped the classification back, and at borderline (mobile) widths the strip
  // oscillated between layouts on every 240ms reveal commit \u2014 visible flicker. Equal footprints
  // make the swap layout-neutral so the measurement converges in one pass. jsdom does no layout,
  // so this is a source pin: both connectors must carry the identical w-4 + mx-0.5 footprint.
  it('Edge and WrapHint occupy the exact same width (w-4 + mx-0.5)', () => {
    const src = readFileSync(path.resolve(__dirname, '../VsJourneyDag.tsx'), 'utf8')
    const edge = src.slice(src.indexOf('function Edge'), src.indexOf('function WrapHint'))
    const hint = src.slice(src.indexOf('function WrapHint'), src.indexOf('export default'))
    for (const [name, part] of [['Edge', edge], ['WrapHint', hint]] as const) {
      expect(part, `${name} carries w-4`).toContain('w-4')
      expect(part, `${name} carries mx-0.5`).toContain('mx-0.5')
      expect(part, `${name} is shrink-0`).toContain('shrink-0')
      // No stray one-sided margins that would break the shared footprint.
      expect(part, `${name} has no mr-/ml- margin`).not.toMatch(/\bm[rl]-/)
    }
    // The invariant is documented at the source so a future edit can't miss it.
    expect(src).toContain('FOOTPRINT INVARIANT')
  })

  it('the wrap elbow (founder 2026-10-02) kept the footprint: an SVG with Edge-matching lit/unlit classes, width 16 — not the retired ↵ text', () => {
    const src = readFileSync(path.resolve(__dirname, '../VsJourneyDag.tsx'), 'utf8')
    const hint = src.slice(src.indexOf('function WrapHint'), src.indexOf('export default'))
    expect(hint).toContain('<svg') // drawn connector
    expect(hint).toContain('width="16"') // same content width as Edge — the invariant's number
    expect(hint).toContain('lit: boolean') // lit-aware, like Edge
    expect(hint).toContain('stroke-emerald-400/70')
    expect(hint).not.toContain('↵')
  })
})
