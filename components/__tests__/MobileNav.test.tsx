// @vitest-environment jsdom
// The ☰ panel's open-state geometry (founder bug 2026-10-08: the panel rendered off-screen —
// the crowded pre-fix header wrapped onto a second line, the ☰ landed at that line's LEFT edge,
// and the then `absolute right-0` panel hung its 224px width off the button, past the viewport's
// left edge). The fix anchors the panel to the VIEWPORT, so no header regression can push it
// off-screen again, and bounds it to the viewport height with its own scroll. jsdom computes no
// layout, so the pins are the positioning classes that make the geometry — plus the behavior
// that still has to hold around them (open/close, the destinations, the Country row).
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MobileNav from '@/components/MobileNav'
import { DOCS_URL } from '@/lib/site'

function openPanel() {
  const r = render(<MobileNav />)
  fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
  // The panel is the links' container (every item links somewhere; /arenas is the first).
  const panel = r.container.querySelector('a[href="/arenas"]')?.parentElement as HTMLElement
  expect(panel).toBeTruthy()
  return { r, panel }
}

describe('MobileNav open-state geometry', () => {
  it('pins the panel to the viewport (fixed, inside the header gutter), never to the ☰ button', () => {
    const { panel } = openPanel()
    const classes = panel.className.split(/\s+/)
    expect(classes).toContain('fixed')
    expect(classes).toContain('right-3') // the header row's own px-3 gutter — on-screen by construction
    expect(classes).toContain('top-14') // just below the py-3 + h-8 header row
    expect(classes).not.toContain('absolute') // button-anchored positioning is what went off-screen
  })

  it('is height-bounded to the viewport with its own scroll, so every row stays reachable', () => {
    const { panel } = openPanel()
    expect(panel.className).toContain('max-h-[calc(100dvh-4.5rem)]')
    expect(panel.className).toContain('overflow-y-auto')
  })

  it('carries the nav destinations and the Country row, and closes on a link tap', () => {
    const { r, panel } = openPanel()
    for (const href of ['/arenas', '/processes', '/situations', '/startup-sim', '/methodology']) {
      expect(panel.querySelector(`a[href="${href}"]`)).toBeTruthy()
    }
    expect(panel.textContent).toContain('Country') // the 2026-10-07 geo row stays
    fireEvent.click(screen.getByRole('link', { name: /Processes/ }))
    expect(r.container.querySelector('a[href="/arenas"]')).toBeNull() // panel closed
  })

  it('opens the docs site in a new tab and closes the menu', () => {
    const { r } = openPanel()
    const docs = screen.getByRole('link', { name: 'Docs' })
    expect(docs.getAttribute('href')).toBe(DOCS_URL)
    expect(docs.getAttribute('target')).toBe('_blank')
    expect(docs.getAttribute('rel')).toBe('noopener noreferrer')
    fireEvent.click(docs)
    expect(r.container.querySelector('a[href="/arenas"]')).toBeNull()
  })
})
