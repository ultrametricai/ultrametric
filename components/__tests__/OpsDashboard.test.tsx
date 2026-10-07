// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@/lib/session'

// OpsDashboard reuses the DoViaAfk admin gate (session allowlist + the pa-admin localStorage
// switch) — same test rig as DoViaAfk.test.tsx: stub the session hook and localStorage.
const sessionStub = vi.hoisted(() => ({ current: { state: 'loading' } as Session }))
vi.mock('@/lib/session', () => ({
  useSession: () => sessionStub.current,
}))

import { ADMIN_FLAG_KEY } from '@/components/DoViaAfk'
import OpsDashboard, { type OpsData } from '@/components/OpsDashboard'

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

const DATA: OpsData = {
  depth: {
    fleet: {
      arenas: 1, products: 2, verdicts: 8, evidenceItems: 12, medianEvidencePerProduct: 6,
      probeBackedPct: 50, bottomDecileThreshold: 1, neverSpiked: 1, oldestSpikeDays: 12,
    },
    arenas: [{
      arenaId: 'alpha', arenaName: 'Alpha Arena', products: 2, medianEvidence: 6, minEvidence: 1,
      minEvidenceProductId: 'p2', probeBackedPct: 50,
      bottomDecile: [{ productId: 'p2', name: 'Product Two', evidence: 1 }],
      neverSpiked: 1, oldestSpikeDays: 12, stalestProductId: 'p1',
    }],
  },
  arenaCoverage: {
    liveArenas: 1,
    plannedArenas: [{ id: 'gamma', name: 'Gamma Arena', tier: 2, status: 'planned' }],
    liveNotPopulated: [],
    populatedNotInRoadmap: [],
    untrackedVendors: [{ vendor: 'doola', label: 'Doola', steps: 2, impliedArena: null }],
  },
  cron: {
    workflows: [{ file: 'daily-snapshot.yml', name: 'daily-snapshot', crons: ['43 5 * * *'], triggers: ['workflow_dispatch'] }],
    sessionCronNote: 'the daily spike runs as a session cron',
    lastRuns: [{ label: 'Spike queue re-rank (session cron)', date: '2026-09-23T00:01:00Z', source: 'data/spike-queue.json' }],
  },
  news: {
    generatedAt: '2026-09-23T01:00:00Z',
    budget: { cap: 150, used: 42, exhausted: false },
    sourcesChecked: 2, productsWithSource: 1, feedSources: 1,
    items: [
      { productId: 'p1', productName: 'Product One', arenaId: 'alpha', title: 'Our MCP server is live', url: 'https://p1.com/blog/mcp', date: '2026-09-18', agentic: true },
      { productId: 'p1', productName: 'Product One', arenaId: 'alpha', title: 'Pricing update', url: 'https://p1.com/blog/pricing', date: '2026-09-20', agentic: false },
    ],
    agenticCount: 1,
    respike: [{ productId: 'p1', productName: 'Product One', arenaId: 'alpha', lastSpiked: '2026-09-13T00:00:00Z', newestAgenticDate: '2026-09-18', title: 'Our MCP server is live', url: 'https://p1.com/blog/mcp' }],
  },
  builtAt: '2026-09-23T02:00:00Z',
}

describe('OpsDashboard admin gating', () => {
  beforeEach(() => {
    stubLocalStorage()
    vi.unstubAllEnvs()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders NOTHING for anonymous readers with no local flag — no trace in the DOM', async () => {
    sessionStub.current = { state: 'anonymous' }
    const { container } = render(<OpsDashboard data={DATA} />)
    await act(async () => {})
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing for authenticated non-admins, even with an allowlist set', async () => {
    vi.stubEnv('NEXT_PUBLIC_ADMIN_EMAILS', 'founder@ultrametric.ai')
    sessionStub.current = { state: 'authenticated', email: 'reader@example.com' }
    const { container } = render(<OpsDashboard data={DATA} />)
    await act(async () => {})
    expect(container.innerHTML).toBe('')
  })

  it("renders the dashboard for the founder's pa-admin=1 switch, with all four sections", async () => {
    window.localStorage.setItem(ADMIN_FLAG_KEY, '1')
    sessionStub.current = { state: 'anonymous' }
    render(<OpsDashboard data={DATA} />)
    expect(await screen.findByRole('heading', { name: /Coverage & engines/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Depth coverage' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Ranking coverage' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Cron / engine health' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Vendor news monitor' })).toBeTruthy()
    // The re-spike cross-signal and the agentic highlight are the founder-actionable bits.
    expect(screen.getByText(/Re-spike these/)).toBeTruthy()
    expect(screen.getAllByText('Our MCP server is live').length).toBeGreaterThan(0)
  })

  it('renders for an allowlisted admin email', async () => {
    vi.stubEnv('NEXT_PUBLIC_ADMIN_EMAILS', 'founder@ultrametric.ai')
    sessionStub.current = { state: 'authenticated', email: 'founder@ultrametric.ai' }
    render(<OpsDashboard data={DATA} />)
    expect(await screen.findByRole('heading', { name: /Coverage & engines/ })).toBeTruthy()
  })

  it('renders for ANY verified @ultrametric.ai session, no allowlist needed (founder 2026-09-23)', async () => {
    vi.stubEnv('NEXT_PUBLIC_ADMIN_EMAILS', '')
    sessionStub.current = { state: 'authenticated', email: 'Staff@Ultrametric.AI' }
    render(<OpsDashboard data={DATA} />)
    expect(await screen.findByRole('heading', { name: /Coverage & engines/ })).toBeTruthy()
  })

  it('the company-domain rule matches the domain only — lookalikes stay out', async () => {
    vi.stubEnv('NEXT_PUBLIC_ADMIN_EMAILS', '')
    sessionStub.current = { state: 'authenticated', email: 'attacker@notultrametric.ai.evil.com' }
    const { container } = render(<OpsDashboard data={DATA} />)
    await act(async () => {})
    expect(container.innerHTML).toBe('')
    sessionStub.current = { state: 'authenticated', email: 'x@ultrametric.ai.evil.com' }
    const second = render(<OpsDashboard data={DATA} />)
    await act(async () => {})
    expect(second.container.innerHTML).toBe('')
  })
})
