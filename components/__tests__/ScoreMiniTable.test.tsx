// @vitest-environment jsdom
// Pins for the product header's score mini table (components/ScoreMiniTable.tsx — the founder's
// 2026-10-08 revision retiring the same-day ScoreViewMenu dropdown: it hid too much). All four
// scores render TOGETHER at one glance, no interaction: Overall visually primary (the bigger
// number, emerald lead cell), Agent-ready / Built-in AI / API quality as compact labeled cells.
// Derivation tooltips and the per-dimension /score receipts anchors ride along per cell, and the
// honesty renders are VISIBLE (n/a for naDimensions, "untested" for unscored-not-zero groups).
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ScoreMiniTable from '@/components/ScoreMiniTable'
import ProductPage from '@/app/arena/[category]/product/[id]/page'

const overall = {
  value: 72,
  href: '/arena/payments/product/stripe/score',
  components: { agentReady: 80, apiQuality: 75, openness: 40, agenticApp: 55, automation: 60 },
}

const cells = [
  { kind: 'agent-ready' as const, value: 80, href: '/arena/payments/product/stripe/score#agent-ready' },
  { kind: 'agentic-app' as const, value: 55, href: '/arena/payments/product/stripe/score#built-in-ai' },
  { kind: 'api-quality' as const, value: 75, href: '/arena/payments/product/stripe/score#api-quality' },
]

describe('ScoreMiniTable', () => {
  it('shows all four scores at once — no dropdown, no interaction', () => {
    const { container } = render(<ScoreMiniTable overall={overall} cells={cells} />)
    expect(screen.getByText('Overall score')).toBeTruthy()
    expect(screen.getByText('AGENT-READY')).toBeTruthy()
    expect(screen.getByText('BUILT-IN AI')).toBeTruthy()
    expect(screen.getByText('API')).toBeTruthy()
    for (const value of ['72', '80', '55', '75']) {
      expect(container.textContent).toContain(value)
    }
    // The retired ScoreViewMenu idiom is gone: nothing to open, nothing hidden.
    expect(container.querySelector('button')).toBeNull()
    expect(container.querySelector('[aria-haspopup]')).toBeNull()
  })

  it('Overall is visually primary: the bigger number in the emerald lead cell', () => {
    const { container } = render(<ScoreMiniTable overall={overall} cells={cells} />)
    const overallValue = container.querySelector('.text-2xl')!
    expect(overallValue).not.toBeNull()
    expect(overallValue.textContent).toBe('72/100')
    expect(overallValue.className).toContain('text-emerald-300')
    expect(overallValue.className).toContain('font-bold')
    // Dimension values stay compact (the smaller type tier), inside plain cells.
    const dimValue = [...container.querySelectorAll('.text-sm')].find((el) => el.textContent === '80/100')
    expect(dimValue).toBeDefined()
    expect(container.querySelector('.bg-emerald-400\\/10')).not.toBeNull()
  })

  it('each cell keeps its derivation tooltip and /score receipts anchor', () => {
    const { container } = render(<ScoreMiniTable overall={overall} cells={cells} />)
    const overallLink = container.querySelector('a[href="/arena/payments/product/stripe/score"]')!
    expect(overallLink).not.toBeNull()
    expect(overallLink.getAttribute('title')).toContain('agent-ready ×0.30')
    const anchors: Array<[string, string]> = [
      ['#agent-ready', 'Outside-in'],
      ['#built-in-ai', 'Inside-out'],
      ['#api-quality', 'programmable surface'],
    ]
    for (const [hash, derivation] of anchors) {
      const link = container.querySelector(`a[href="/arena/payments/product/stripe/score${hash}"]`)
      expect(link, `${hash} cell must link its /score anchor`).not.toBeNull()
      expect(link!.getAttribute('title')).toContain(derivation)
    }
  })

  it('honesty renders are visible: n/a dimensions say n/a (no link), untested says untested', () => {
    const { container } = render(
      <ScoreMiniTable
        overall={overall}
        cells={[
          { kind: 'agent-ready', value: null },
          { kind: 'agentic-app', value: 55, href: '/x#built-in-ai' },
          { kind: 'api-quality', value: 40, untested: true, href: '/x#api-quality' },
        ]}
      />,
    )
    expect(screen.getByText('n/a')).toBeTruthy()
    const untested = screen.getByText('untested')
    expect(untested).toBeTruthy()
    // Untested shows the word, never the number (unscored, not zero).
    expect(container.textContent).not.toContain('40')
    // The n/a cell carries its explanation tooltip but no /score link (nothing judged to show).
    const naCell = screen.getByText('n/a').closest('[title]')!
    expect(naCell.getAttribute('title')).toContain('Outside-in')
    expect(naCell.closest('a')).toBeNull()
  })
})

describe('product page header mounts the score mini table (startup-banking/mercury)', () => {
  it('all four scores are visible at once in the static header — the dropdown is retired', async () => {
    const { container } = render(
      await ProductPage({ params: Promise.resolve({ category: 'startup-banking', id: 'mercury' }) }),
    )
    // getAllBy — other surfaces on the page (comparison tables) also say 'Overall score'.
    expect(screen.getAllByText('Overall score').length).toBeGreaterThan(0)
    expect(screen.getAllByText('AGENT-READY').length).toBeGreaterThan(0)
    expect(screen.getAllByText('BUILT-IN AI').length).toBeGreaterThan(0)
    // No score-menu trigger remains (founder revert of the 2026-10-08 dropdown) — other menus
    // on the page (Docs, row actions) are unaffected.
    expect(screen.queryByRole('button', { name: /Switch which score/ })).toBeNull()
    expect(container.querySelector('.inline-grid')).not.toBeNull()
  })
})
