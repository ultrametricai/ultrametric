// @vitest-environment jsdom
// The product header's score dropdown (founder 2026-10-08): the non-Overall header scores fold
// into a house-idiom menu anchored on the Overall score — the reader switches which score the
// big number shows. Pins: SSR/default shows Overall; selection is client state that swaps the
// big pill (value, label, derivation tooltip, /score click-through all riding along); the menu
// wears the house idiom (aria-haspopup/aria-expanded, menuitemradio entries); honesty renders
// (n/a, untested) carry over per view.
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ScoreViewMenu from '@/components/ScoreViewMenu'
import ProductPage from '@/app/arena/[category]/product/[id]/page'

const overall = {
  value: 72,
  href: '/arena/payments/product/stripe/score',
  components: { agentReady: 80, apiQuality: 75, openness: 40, agenticApp: 55, automation: 60 },
}

const views = [
  { kind: 'agent-ready' as const, value: 80, href: '/arena/payments/product/stripe/score#agent-ready' },
  { kind: 'agentic-app' as const, value: 55, href: '/arena/payments/product/stripe/score#built-in-ai' },
  { kind: 'api-quality' as const, value: 75, href: '/arena/payments/product/stripe/score#api-quality' },
]

describe('ScoreViewMenu', () => {
  it('defaults to the Overall score (the SSR view) with its derivation tooltip and /score link', () => {
    const { container } = render(<ScoreViewMenu overall={overall} views={views} />)
    expect(screen.getByText('Overall score')).toBeTruthy()
    expect(container.textContent).toContain('72')
    // The big pill keeps the Overall derivation tooltip and the /score click-through.
    const pill = container.querySelector('[title*="agent-ready ×0.30"]')
    expect(pill).not.toBeNull()
    expect(container.querySelector('a[href="/arena/payments/product/stripe/score"]')).not.toBeNull()
    // No other view's label renders until the reader opens the menu.
    expect(screen.queryByText('AGENT-READY')).toBeNull()
  })

  it('wears the house menu idiom and lists every score view with value and derivation tooltip', () => {
    render(<ScoreViewMenu overall={overall} views={views} />)
    const trigger = screen.getByRole('button', { name: /Switch which score/ })
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const items = screen.getAllByRole('menuitemradio')
    expect(items.map((i) => i.textContent)).toEqual([
      'Overall score72/100',
      'AGENT-READY80/100',
      'BUILT-IN AI55/100',
      'API75/100',
    ])
    // Overall is the checked default; each entry's tooltip carries its own derivation.
    expect(items[0].getAttribute('aria-checked')).toBe('true')
    expect(items[0].getAttribute('title')).toContain('agent-ready ×0.30')
    expect(items[1].getAttribute('title')).toContain('Outside-in')
    expect(items[2].getAttribute('title')).toContain('Inside-out')
    expect(items[3].getAttribute('title')).toContain('programmable surface')
  })

  it('selecting a view swaps the big number to that score — label, tooltip, and /score anchor ride along', () => {
    const { container } = render(<ScoreViewMenu overall={overall} views={views} />)
    fireEvent.click(screen.getByRole('button', { name: /Switch which score/ }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /AGENT-READY/ }))
    // The big pill now shows agent-ready, in the same prominent idiom.
    expect(screen.getByText('AGENT-READY')).toBeTruthy()
    expect(screen.queryByText('Overall score')).toBeNull()
    expect(container.textContent).toContain('80')
    expect(container.querySelector('[title*="Outside-in"]')).not.toBeNull()
    expect(container.querySelector('a[href="/arena/payments/product/stripe/score#agent-ready"]')).not.toBeNull()
    // The menu closed on selection.
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('honesty renders carry over per view: untested shows "untested", n/a shows n/a — never a number', () => {
    render(
      <ScoreViewMenu
        overall={overall}
        views={[
          { kind: 'agent-ready', value: 80, untested: true },
          { kind: 'agentic-app', value: null },
        ]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Switch which score/ }))
    const items = screen.getAllByRole('menuitemradio')
    expect(items[1].textContent).toContain('untested')
    expect(items[2].textContent).toContain('n/a')
    fireEvent.click(items[1])
    expect(screen.getByText('untested')).toBeTruthy()
    expect(screen.queryByText('80')).toBeNull()
  })
})

describe('product page header mounts the score dropdown (startup-banking/mercury)', () => {
  it('SSR shows Overall only; the per-dimension pills are folded into the menu', async () => {
    const { container } = render(
      await ProductPage({ params: Promise.resolve({ category: 'startup-banking', id: 'mercury' }) }),
    )
    // getAllBy — other surfaces on the page (comparison tables) also say 'Overall score'.
    expect(screen.getAllByText('Overall score').length).toBeGreaterThan(0)
    const trigger = screen.getByRole('button', { name: /Switch which score/ })
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    // The old standalone pills no longer render in the static header.
    expect(container.textContent).not.toContain('AGENT-READY')
    expect(container.textContent).not.toContain('BUILT-IN AI')
  })
})
