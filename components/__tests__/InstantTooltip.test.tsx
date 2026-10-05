// @vitest-environment jsdom
// Sticky-tooltip regression pins (founder bug 2026-10-05): the sitewide instant tooltip
// (components/InstantTooltip.tsx, mounted once in app/layout.tsx) used to survive a click-through
// — client-side navigation never fires mouseleave on an element React removed, so the tooltip
// stayed on screen over the next page. Pins: the tooltip hides on pointerdown on its anchor, on
// a route change (next/navigation usePathname), and when the anchor leaves the DOM.
import { fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import InstantTooltip from '@/components/InstantTooltip'

// Controllable pathname — reassigned per test to simulate an App Router client-side navigation
// (the component re-renders, usePathname returns the new path, its route-change effect hides).
let pathname = '/processes'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))

function mountWithAnchor(title = 'the vendor page this links to') {
  const utils = render(<InstantTooltip />)
  const anchor = document.createElement('a')
  anchor.href = '/arena/payments/product/stripe'
  anchor.title = title
  anchor.textContent = 'Stripe'
  document.body.appendChild(anchor)
  return { ...utils, anchor, tip: utils.container.querySelector('[role="tooltip"]') as HTMLDivElement }
}

// Hover then advance past the 80ms show delay so the tooltip is visibly up.
function hoverUntilShown(anchor: HTMLElement, tip: HTMLDivElement) {
  fireEvent.mouseOver(anchor)
  vi.advanceTimersByTime(120)
  expect(tip.style.display).toBe('block')
  expect(tip.textContent).toContain('the vendor page')
}

beforeEach(() => {
  pathname = '/processes'
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  document.body.querySelectorAll('a').forEach((a) => a.remove())
})

describe('InstantTooltip sticky-tooltip regression (founder 2026-10-05)', () => {
  it('hover → click (pointerdown) on the anchor: the tooltip is gone and the title attribute is restored', () => {
    const { anchor, tip } = mountWithAnchor()
    hoverUntilShown(anchor, tip)
    // While shown, the native title is stashed into data-tip.
    expect(anchor.getAttribute('title')).toBeNull()

    fireEvent.pointerDown(anchor)
    expect(tip.style.display).toBe('none')
    // The a11y/agent-visible title comes back before any navigation.
    expect(anchor.getAttribute('title')).toBe('the vendor page this links to')
    expect(anchor.getAttribute('data-tip')).toBeNull()
  })

  it('hover → route change (usePathname flips): the tooltip is gone', () => {
    const { anchor, tip, rerender } = mountWithAnchor()
    hoverUntilShown(anchor, tip)

    pathname = '/arena/payments/product/stripe'
    rerender(<InstantTooltip />)
    expect(tip.style.display).toBe('none')
  })

  it('hover → the anchor is removed from the DOM: the tooltip is gone', async () => {
    const { anchor, tip } = mountWithAnchor()
    hoverUntilShown(anchor, tip)

    anchor.remove()
    // MutationObserver callbacks are delivered as microtasks — switch to real timers and wait.
    vi.useRealTimers()
    await waitFor(() => expect(tip.style.display).toBe('none'))
  })

  it('popstate (back/forward) hides the tooltip', () => {
    const { anchor, tip } = mountWithAnchor()
    hoverUntilShown(anchor, tip)

    fireEvent.popState(window)
    expect(tip.style.display).toBe('none')
  })
})
