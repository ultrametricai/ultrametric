// @vitest-environment jsdom
// Pins for the "Test it in sandbox" panel (founder 2026-10-02, two passes): the Experimental
// chip, the long explainer paragraph (docs/TRY-IT.md link included), the microterminal's footer
// "replay ↺ / run again ▶" button, the title-bar ▶ replay/run control, AND the per-run
// "recorded session — replayed, not live" badge are all gone; the heading is renamed from
// "Try it agentically" (founder-decided). The HONESTY CONTRACT survives: the per-story footer
// provenance line (recorded date · exit code · "captured verbatim…") marks every recording, live
// output alone carries a live badge, and the ▶ run-live affordance stays per line. Data libs are
// mocked so these pins don't depend on which products currently carry recorded proofs.
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TryItSection from '@/components/TryIt/TryItSection'

vi.mock('@/lib/tryit', () => ({
  buildRecordedStories: () => [
    {
      id: 'llms-txt',
      title: 'read the docs',
      kind: 'recorded',
      command: 'curl -s https://vendor.example/llms.txt | head -4',
      transcript: 'recorded output',
      recordedAt: '2026-09-01T00:00:00Z',
      exitCode: 0,
      live: true,
    },
  ],
  mcpDocsUrlFor: () => null,
}))
vi.mock('@/lib/mcpEndpoints', () => ({ mcpEndpointFor: () => null }))

describe('TryItSection — founder 2026-10-02 batch', () => {
  it('heading reads "Test it in sandbox" (renamed from "Try it agentically"); no Experimental chip, no explainer', () => {
    const { container } = render(
      <TryItSection category="payments" productId="stripe" productName="Stripe" stories={[]} />,
    )
    expect(screen.getByRole('heading', { name: 'Test it in sandbox' })).toBeTruthy()
    expect(container.textContent).not.toContain('Try it agentically')
    expect(screen.queryByText('Experimental')).toBeNull()
    expect(container.textContent).not.toContain('See what an agent can do')
    expect(container.textContent).not.toContain('docs/TRY-IT.md')
    expect(container.querySelector('a[href*="TRY-IT.md"]')).toBeNull()
  })

  it('HONESTY GUARD: the recorded badge is gone, but the provenance footer still marks every recording', () => {
    const { container } = render(
      <TryItSection category="payments" productId="stripe" productName="Stripe" stories={[]} />,
    )
    // The per-run badge is gone (founder 2026-10-02)…
    expect(screen.queryByText(/recorded session — replayed, not live/)).toBeNull()
    // …but the distinction stays visible: the footer leads with the recorded date / exit code /
    // verbatim-capture line, and NO live badge renders for a pure replay.
    expect(screen.getByText(/recorded 2026-09-01 · exit 0 · captured verbatim by our probe harness/)).toBeTruthy()
    expect(container.textContent).not.toContain('live — run just now')
    // …and the live-capable story keeps its ▶ run live affordance and its badge (the small
    // 'live' badge — the inline 'live-capable' text went with the 2026-10-05 selector redesign).
    expect(screen.getByRole('button', { name: /run live/i })).toBeTruthy()
    expect(screen.queryByText('live-capable')).toBeNull()
    expect(screen.getByText('live')).toBeTruthy()
  })

  it('the title-bar ▶ replay/run control is gone too (second founder ask) — the story chips are the play affordance', () => {
    render(<TryItSection category="payments" productId="stripe" productName="Stripe" stories={[]} />)
    expect(screen.queryByRole('button', { name: /replay ↺/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /run again/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /▶ replay/ })).toBeNull()
    // The story-menu chip (auto-plays on mount, re-plays on click) remains — labeled by run
    // type since the 2026-10-05 selector redesign, with the story title in its tooltip.
    const chip = screen.getByRole('button', { name: /llms\.txt discovery/ })
    expect(chip.getAttribute('title')).toContain('read the docs')
  })
})
