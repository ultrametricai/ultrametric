// @vitest-environment jsdom
// StepAfkChip — the staff-gated per-step chip (founder 2026-09-25 as the AFK computer-use
// trigger; renamed 'run with Ultrametric' and pointed at the /get-started CLI/MCP install page
// by the founder 2026-10-05). Gate = the DoViaAfk pattern (NEXT_PUBLIC_ADMIN_EMAILS allowlist
// + the pa-admin localStorage switch) PLUS OpsDashboard's @ultrametric.ai company rule. The
// load-bearing assertions: non-staff readers get literally NOTHING in the DOM (the
// OpsDashboard.test contract), the label says Ultrametric (never AFK), the destination is the
// real on-site install page, and the AFK manifest-handoff codec (afkStepRunUrl) stays pinned
// for the executor contract.
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@/lib/session'

// Same controllable session stub as DoViaAfk.test.tsx / OpsDashboard.test.tsx.
const sessionStub = vi.hoisted(() => ({ current: { state: 'loading' } as Session }))
vi.mock('@/lib/session', () => ({
  useSession: () => sessionStub.current,
}))

import { ADMIN_FLAG_KEY, AFK_RUN_URL } from '@/components/DoViaAfk'
import StepAfkChip, { AFK_STEP_TRIGGER_PUBLIC, afkStepRunUrl } from '@/components/StepAfkChip'

// Same in-memory localStorage stand-in as DoViaAfk.test.tsx.
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

const MANIFEST_URL = 'https://ultrametric.ai/processes/get-ein/manifest.json'
const NODE_ID = 'n3'

describe('afkStepRunUrl', () => {
  it('builds AFK_RUN_URL?manifest=<encoded manifest>&node=<encoded nodeId>', () => {
    expect(afkStepRunUrl(MANIFEST_URL, NODE_ID)).toBe(
      `${AFK_RUN_URL}?manifest=${encodeURIComponent(MANIFEST_URL)}&node=${NODE_ID}`,
    )
    // Both params are URI-encoded — a nodeId with reserved characters can't smuggle params.
    expect(afkStepRunUrl(MANIFEST_URL, 'a&b=c')).toBe(
      `${AFK_RUN_URL}?manifest=${encodeURIComponent(MANIFEST_URL)}&node=a%26b%3Dc`,
    )
  })
})

describe('StepAfkChip staff gating', () => {
  beforeEach(() => {
    stubLocalStorage()
    vi.unstubAllEnvs()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is pinned staff-only pre-launch — flipping AFK_STEP_TRIGGER_PUBLIC is a deliberate launch-day act', () => {
    expect(AFK_STEP_TRIGGER_PUBLIC).toBe(false)
  })

  it('renders NOTHING for anonymous readers with no local flag — no trace in the DOM', async () => {
    sessionStub.current = { state: 'anonymous' }
    const { container } = render(<StepAfkChip manifestUrl={MANIFEST_URL} nodeId={NODE_ID} />)
    await act(async () => {}) // let any post-hydration snapshot re-render settle
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing for authenticated non-staff, even with an allowlist set', async () => {
    vi.stubEnv('NEXT_PUBLIC_ADMIN_EMAILS', 'founder@ultrametric.ai')
    sessionStub.current = { state: 'authenticated', email: 'reader@example.com' }
    const { container } = render(<StepAfkChip manifestUrl={MANIFEST_URL} nodeId={NODE_ID} />)
    await act(async () => {})
    expect(container.innerHTML).toBe('')
  })

  it('renders for a verified @ultrametric.ai session even with no allowlist (the isCompanyEmail rule)', async () => {
    sessionStub.current = { state: 'authenticated', email: 'anyone@ultrametric.ai' }
    render(<StepAfkChip manifestUrl={MANIFEST_URL} nodeId={NODE_ID} />)
    expect(await screen.findByRole('link', { name: /run with Ultrametric/ })).toBeTruthy()
  })

  it('renders for an allowlisted admin email outside the company domain', async () => {
    vi.stubEnv('NEXT_PUBLIC_ADMIN_EMAILS', 'contractor@example.com')
    sessionStub.current = { state: 'authenticated', email: 'contractor@example.com' }
    render(<StepAfkChip manifestUrl={MANIFEST_URL} nodeId={NODE_ID} />)
    expect(await screen.findByRole('link', { name: /run with Ultrametric/ })).toBeTruthy()
  })

  it("renders for the founder's local pa-admin=1 switch even while anonymous", async () => {
    window.localStorage.setItem(ADMIN_FLAG_KEY, '1')
    sessionStub.current = { state: 'anonymous' }
    render(<StepAfkChip manifestUrl={MANIFEST_URL} nodeId={NODE_ID} />)
    expect(await screen.findByRole('link', { name: /run with Ultrametric/ })).toBeTruthy()
  })

  it("says 'run with Ultrametric' and links to the on-site CLI/MCP install page with the affiliation disclosure (founder rename 2026-10-05)", async () => {
    window.localStorage.setItem(ADMIN_FLAG_KEY, '1')
    sessionStub.current = { state: 'anonymous' }
    render(<StepAfkChip manifestUrl={MANIFEST_URL} nodeId={NODE_ID} />)
    const link = await screen.findByRole('link', { name: /run with Ultrametric/ })
    expect(link.textContent).toContain('run with Ultrametric')
    expect(link.textContent).not.toContain('AFK')
    expect(link.getAttribute('href')).toBe('/get-started')
    expect(link.getAttribute('title')).toBe(
      'Run steps like this with Ultrametric — the CLI/MCP install page (our own product)',
    )
  })

  it('the AFK manifest handoff codec survives the rename (docs/AFK-HANDOFF.md — the DoViaAfk admin affordance still consumes it)', () => {
    expect(afkStepRunUrl(MANIFEST_URL, NODE_ID)).toContain(AFK_RUN_URL)
  })
})
