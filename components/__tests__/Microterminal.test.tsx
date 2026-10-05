// @vitest-environment jsdom
// State-machine tests for the Try-it microterminal's live tiers (components/TryIt/
// Microterminal.tsx): keyless demo-call affordance, BYO-key form (memory-only credential),
// sandbox-account affordance, and the honest badges for each outcome. The worker is mocked at
// the fetch boundary — these tests assert exactly what the component would send it.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Microterminal from '@/components/TryIt/Microterminal'
import type { McpProbeResult } from '@/lib/tryitReplay'

const PROBE = {
  arena: 'payments',
  product: 'stripe',
  endpoint: 'https://mcp.stripe.com/',
  docsUrl: 'https://docs.stripe.com/mcp',
}

interface SentBody {
  arena: string
  product: string
  action?: string
  token?: string
  useSandbox?: boolean
  tool?: string
}

// Queue of JSON responses for the mocked worker endpoint; records each request body.
function stubFetch(responses: unknown[]): { sent: SentBody[] } {
  const sent: SentBody[] = []
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)) as SentBody)
    const next = responses.shift()
    if (next === undefined) throw new Error('stubFetch exhausted')
    return new Response(JSON.stringify(next), { status: 200, headers: { 'content-type': 'application/json' } })
  }))
  return { sent }
}

const keylessOk: McpProbeResult = {
  ok: true,
  auth: 'keyless',
  reachable: true,
  authRequired: false,
  handshake: true,
  serverInfo: { name: 'vendor-mcp', version: '1' },
  protocolVersion: '2025-06-18',
  toolCount: 3,
  toolNames: ['a', 'b', 'c'],
  demoCall: { tool: 'search_docs', label: 'search the docs' },
}

const authGated: McpProbeResult = {
  ok: true,
  auth: 'keyless',
  reachable: true,
  authRequired: true,
  httpStatus: 401,
  oauth: true,
}

const renderLive = () => render(<Microterminal arena="payments" product="stripe" productName="Stripe" stories={[]} probe={PROBE} />)
const runHandshake = () => fireEvent.click(screen.getByRole('button', { name: /Live MCP handshake/ }))

afterEach(() => vi.unstubAllGlobals())

describe('Microterminal live tiers', () => {
  it('keyless handshake with a curated demo exposes "run a real call" and sends action:call with NO tool/args', async () => {
    const { sent } = stubFetch([
      keylessOk,
      { ok: true, auth: 'keyless', reachable: true, handshake: true, call: { tool: 'search_docs', label: 'search the docs', ok: true, resultText: 'found 4 results', truncated: false } },
    ])
    renderLive()
    // With the title-bar ▶ control gone (founder 2026-10-02), the empty live terminal points at
    // the menu chip, which is the one way to fire the handshake.
    expect(screen.getByText(/press ▶ Live MCP handshake above/)).toBeTruthy()
    runHandshake()

    // Live output wears the live badge — the one per-run badge left after the recorded badge
    // was removed (founder 2026-10-02).
    expect(screen.getByText(/live — run just now from our edge/)).toBeTruthy()
    // Founder 2026-10-05: the live-probe footer caption is gone (caption only — the probe and
    // its result lines stay).
    expect(screen.queryByText(/read-only, nothing is written/)).toBeNull()
    const runCall = await screen.findByRole('button', { name: /run a real call — search the docs/ })
    expect(sent[0]).toEqual({ arena: 'payments', product: 'stripe' }) // keyless probe: no token, no action
    fireEvent.click(runCall)

    await waitFor(() => expect(sent).toHaveLength(2))
    expect(sent[1]).toEqual({ arena: 'payments', product: 'stripe', action: 'call' })
    expect(sent[1].tool).toBeUndefined() // the tool/args live server-side only
    expect(await screen.findByText(/keyless handshake OK — 3 tools live/)).toBeTruthy()
  })




  it('auth-gated results offer NO key form (founder 2026-09-23: never take keys here) — the MCP client config is the route', async () => {
    stubFetch([authGated])
    renderLive()
    runHandshake()
    expect(await screen.findAllByText(/auth/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /have a key/i })).toBeNull()
    expect(screen.queryByLabelText(/API key or token/)).toBeNull()
  })

  it('shows the sandbox-account option only when the worker advertises a provisioned credential', async () => {
    const { sent } = stubFetch([
      { ...authGated, sandboxAvailable: true },
      { ...keylessOk, auth: 'sandbox' },
    ])
    renderLive()
    runHandshake()

    fireEvent.click(await screen.findByRole('button', { name: /use our sandbox account/ }))
    await waitFor(() => expect(sent).toHaveLength(2))
    expect(sent[1]).toEqual({ arena: 'payments', product: 'stripe', useSandbox: true })
    expect(await screen.findByText(/authenticated handshake OK \(our sandbox account\)/)).toBeTruthy()
  })

  it('a live-capable recorded story exposes "run live", POSTs only the three ids, and re-badges honestly', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      urls.push(String(url))
      expect(init?.method).toBe('POST')
      expect(init?.body).toBeUndefined() // ids travel in the path; the worker reads no body at all
      return new Response(
        JSON.stringify({ ok: true, reachable: true, status: 200, contentType: 'text/plain', elapsedMs: 42, bodyExcerpt: 'live output body', pass: true, expected: { status: 200, pattern: null } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }))
    render(
      <Microterminal
        arena="payments"
        product="stripe"
        productName="Stripe"
        stories={[{ id: 'llms-txt', title: 'read the docs', kind: 'recorded', command: 'curl -s https://stripe.com/llms.txt | head -4', transcript: 'recorded output', recordedAt: '2026-09-01T00:00:00Z', exitCode: 0, live: true }]}
        probe={null}
      />,
    )
    // Founder 2026-10-02: no per-run recorded badge — the provenance footer marks the recording
    // and no live badge renders until a live re-run actually happens.
    expect(screen.queryByText(/recorded session — replayed, not live/)).toBeNull()
    expect(screen.getByText(/recorded 2026-09-01 · exit 0 · captured verbatim/)).toBeTruthy()
    expect(screen.getByText('live-capable')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /run live/i }))
    await waitFor(() => expect(urls).toHaveLength(1))
    expect(urls[0]).toBe('https://ultrametric.ai/api/try/payments/stripe/llms-txt')
    expect(await screen.findByText(/recorded replay \+ live re-run/)).toBeTruthy()
    // Founder 2026-10-02 (two passes): the footer "replay ↺ / run again ▶" duplicate AND the
    // title-bar ▶ replay/run control are both gone — the story chips are the play affordance.
    expect(screen.queryByRole('button', { name: /replay ↺/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /run again/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /▶ replay/ })).toBeNull()
  })

  it('a replay-only story (CLI/pty probe) offers no run-live affordance', () => {
    render(
      <Microterminal
        arena="ai-coding"
        product="claude-code"
        productName="Claude Code"
        stories={[{ id: 'cli-version', title: 'check the CLI', kind: 'recorded', command: 'claude --version', transcript: '2.1.0', recordedAt: '2026-09-01T00:00:00Z', exitCode: 0, live: false }]}
        probe={null}
      />,
    )
    expect(screen.queryByRole('button', { name: /run live/i })).toBeNull()
    expect(screen.queryByText('live-capable')).toBeNull()
    // No recorded badge (founder 2026-10-02) — the provenance footer is the recording's marker.
    expect(screen.queryByText(/recorded session — replayed, not live/)).toBeNull()
    expect(screen.getByText(/captured verbatim by our probe harness/)).toBeTruthy()
    expect(screen.queryByText(/live — run just now/)).toBeNull()
  })

})
