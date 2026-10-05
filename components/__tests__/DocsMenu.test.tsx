// @vitest-environment jsdom
// Docs dropdown pins (founder 2026-10-05): the product header's separate "API docs ↗ /
// CLI docs ↗ / MCP docs ↗" chips collapse into ONE accessible menu labeled 'Docs' — proper
// menu-button semantics (aria-haspopup + aria-expanded, Escape closes and restores focus,
// arrow keys move between entries), every entry keeping its destination and external-link mark.
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ProductLinkChips, { productDocEntries } from '@/components/ProductLinkChips'
import type { Product } from '@/lib/schemas'

const PRODUCT = {
  id: 'mercury',
  name: 'Mercury',
  vendor: 'Mercury Technologies',
  type: 'commercial',
  urls: { site: 'https://mercury.com', docs: 'https://docs.mercury.com' },
  links: {
    api: 'https://docs.mercury.com',
    cli: 'https://github.com/MercuryTechnologies/mercury-cli',
    mcp: 'https://docs.mercury.com/docs/what-is-mercury-mcp.md',
  },
} as unknown as Product

describe('Docs dropdown (founder 2026-10-05)', () => {
  it('collapses the doc links into one closed-by-default "Docs" menu button', () => {
    const { container } = render(<ProductLinkChips product={PRODUCT} />)
    const trigger = screen.getByRole('button', { name: /Docs/ })
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    // No separate chips, no visible links until the menu opens.
    expect(container.querySelectorAll('a')).toHaveLength(0)
    expect(screen.queryByText(/API docs/)).toBeNull()
  })

  it('open: every entry keeps its destination and external-link mark, in API/CLI/MCP order', () => {
    render(<ProductLinkChips product={PRODUCT} />)
    fireEvent.click(screen.getByRole('button', { name: /Docs/ }))
    expect(screen.getByRole('button', { name: /Docs/ }).getAttribute('aria-expanded')).toBe('true')
    const items = screen.getAllByRole('menuitem')
    expect(items.map((i) => i.textContent)).toEqual(['API docs↗', 'CLI docs↗', 'MCP docs↗'])
    expect(items.map((i) => i.getAttribute('href'))).toEqual([
      'https://docs.mercury.com',
      'https://github.com/MercuryTechnologies/mercury-cli',
      'https://docs.mercury.com/docs/what-is-mercury-mcp.md',
    ])
    for (const item of items) {
      expect(item.getAttribute('target')).toBe('_blank')
      expect(item.getAttribute('rel')).toContain('noopener')
    }
  })

  it('keyboard: ArrowDown/ArrowUp move focus between entries; Escape closes and refocuses the trigger', () => {
    render(<ProductLinkChips product={PRODUCT} />)
    const trigger = screen.getByRole('button', { name: /Docs/ })
    fireEvent.click(trigger)
    const menu = screen.getByRole('menu')
    const items = screen.getAllByRole('menuitem')
    items[0].focus()
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1])
    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items[0])
    fireEvent.keyDown(menu, { key: 'ArrowUp' }) // wraps to the last entry
    expect(document.activeElement).toBe(items[2])
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)
  })

  it('renders nothing without links; productDocEntries is the one source for the mobile table too', () => {
    const bare = { ...PRODUCT, links: undefined } as unknown as Product
    const { container } = render(<ProductLinkChips product={bare} />)
    expect(container.innerHTML).toBe('')
    expect(productDocEntries(bare)).toEqual([])
    expect(productDocEntries(PRODUCT).map((e) => e.label)).toEqual(['API docs', 'CLI docs', 'MCP docs'])
  })
})
