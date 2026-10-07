// @vitest-environment jsdom
// Founder round 2026-10-07, items 2–3 — the sim's corpus linkage at the DOM level:
//   item 2 — every STEP the terminal prints deep-links its canonical block on the process page
//            (/processes/{slug}#step-{taskId}-{nodeId}, the pinned anchor contract) when the
//            payload carries node ids, and renders plain text (no invented link) when it
//            doesn't — the honest degrade;
//   item 3 — the state panel's Company documents section lists EXACTLY the registry artifacts
//            (processes/artifacts.json) of the producesArtifact-tagged steps the run actually
//            printed, in production order, each linking /artifacts/{id}, each carrying the
//            structural data-synthetic attribute (the possession claim is the synthetic run's;
//            the document type is the committed registry's), with NO visible 'simulated' string
//            (the page-wide invariant).
// The corpus side (node ids/produces/fork serialized from the real corpus + registry) is tested
// against the live files in lib/__tests__/virtualStartupLinkage.test.ts.
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VirtualStartup from '@/components/VirtualStartup'
import type { SimStep } from '@/lib/processSim'
import type { VirtualTaskPayload, VsChain } from '@/lib/virtualStartup'

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

// journeyPhases resolves every VS_CHAIN_IDS chain, so the fixture covers all ten (the suite
// convention — components/__tests__/VirtualStartup.test.tsx).
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
    // Carries the corpus linkage: node ids for the step anchors, a producesArtifact-tagged
    // second step for the document panel.
    task('form_001', 'Incorporate C-Corp', {
      steps: [
        step('form_001', 'Submit incorporation filing', { route: 'form' }),
        step('form_001', 'Receive Certificate of Incorporation', { route: 'person' }),
      ],
      tops: [null, null],
      nodeIds: ['n1', 'n5'],
      produces: [null, { id: 'certificate-of-incorporation', label: 'Certificate of Incorporation' }],
    }),
    task('qs_023', 'Open bank account', {
      nodeIds: ['n2'],
      produces: [{ id: 'bank-account', label: 'Business bank account' }],
    }),
    // No nodeIds/produces — the honest degrade half of item 2/3.
    task('brand_001', 'Generate a company name'),
    task('form_011', 'Set up an LLC'),
    task('startup_002', 'Founder agreement & equity split'),
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
    task('ops_014', 'Lease an office'),
    task('fund_007', 'Apply to Y Combinator'),
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

describe('step → canonical process-page anchors (item 2)', () => {
  it('a printed step deep-links /processes/{slug}#step-{taskId}-{nodeId}; a payload without node ids renders the label unlinked', () => {
    renderIt()
    showAll()
    const term = within(screen.getByTestId('vs-terminal-body'))
    const links = term.getAllByTestId('vs-step-link')
    const hrefs = links.map((l) => l.getAttribute('href'))
    expect(hrefs).toContain('/processes/incorporate-c-corp#step-form_001-n1')
    expect(hrefs).toContain('/processes/incorporate-c-corp#step-form_001-n5')
    expect(hrefs).toContain('/processes/open-bank-account#step-qs_023-n2')
    // Exactly the steps whose payloads carry node ids are linked — nothing invented.
    expect(links).toHaveLength(3)
    // The honest degrade: brand_001 has no node ids, so its step prints as plain text.
    const naming = term.getByText('Generate a company name — step 1')
    expect(naming.closest('a')).toBeNull()
  })
})

describe('Company documents from executed producesArtifact steps (item 3)', () => {
  it('lists exactly the registry artifacts of the steps the run printed, in production order, linking /artifacts/{id}, data-synthetic, no visible "simulated"', () => {
    const { container } = renderIt()
    showAll()
    const section = screen.getByTestId('vs-sg-documents')
    const docs = within(section).getAllByTestId('vs-sg-document')
    // Exactly the two produces-tagged steps' artifacts — the run never invents a document.
    expect(docs).toHaveLength(2)
    expect(docs.map((d) => d.querySelector('a')!.getAttribute('href'))).toEqual([
      '/artifacts/certificate-of-incorporation',
      '/artifacts/bank-account',
    ])
    expect(docs.map((d) => d.textContent)).toEqual(['Certificate of Incorporation', 'Business bank account'])
    for (const d of docs) expect(d.getAttribute('data-synthetic')).toBe('true')
    // The page-wide labeling invariant holds for the new section too.
    expect(container.textContent).not.toMatch(/simulated/i)
  })

  it('a document appears only once its producing step has printed, and the panel resets with the run', () => {
    renderIt()
    vi.useFakeTimers()
    try {
      fireEvent.click(screen.getByRole('button', { name: /run this startup/i }))
      // Two ticks in: the name phase is printing — the certificate's step hasn't printed.
      act(() => {
        vi.advanceTimersByTime(240 * 2)
      })
      expect(screen.queryByTestId('vs-sg-documents')).toBeNull()
      act(() => {
        vi.runAllTimers()
      })
      expect(screen.getAllByTestId('vs-sg-document')).toHaveLength(2)
    } finally {
      vi.useRealTimers()
    }
    // Restarting clears the company's documents with the rest of the run state (the component's
    // unmount cleanup clears the restarted ticker — auto-cleanup runs after each test).
    fireEvent.click(screen.getByRole('button', { name: /run it again/i }))
    expect(screen.queryByTestId('vs-sg-documents')).toBeNull()
  })
})
