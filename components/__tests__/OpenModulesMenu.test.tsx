// @vitest-environment jsdom
// OpenModulesMenu — the process page's 'Open modules' chip row as a compact collapsible
// (founder 2026-10-05). Pins:
//   1. nothing renders for a process with no mapped modules (the registry's common case);
//   2. SSR stability: the server HTML is the COLLAPSED state — a real disclosure <button> with
//      aria-expanded="false", no chip hrefs in the HTML — deterministic and hydration-safe
//      (collapsed is also the first client render: plain state, no mount effect);
//   3. the disclosure: clicking expands (aria-expanded flips, the same GitHub deep-link chips
//      as the old inline row appear, new-tab + noopener), clicking again collapses.
import { fireEvent, render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import OpenModulesMenu from '@/components/OpenModulesMenu'
import type { OpenModuleChip } from '@/lib/businessLogicMap'

const MODULES: OpenModuleChip[] = [
  {
    id: 'capTable',
    label: 'Cap table math',
    href: 'https://github.com/ultrametricai/productarena/blob/main/open-modules/README.md#cap-table-math',
  },
  {
    id: 'deadlines',
    label: 'Compliance deadlines',
    href: 'https://github.com/ultrametricai/productarena/blob/main/open-modules/README.md#compliance-deadlines',
  },
]

describe('no mapped modules', () => {
  it('renders nothing at all — no button, no empty shell', () => {
    expect(renderToString(<OpenModulesMenu modules={[]} />)).toBe('')
    const { container } = render(<OpenModulesMenu modules={[]} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('SSR stability (collapsed is the static state)', () => {
  it('the server HTML is deterministic, collapsed (aria-expanded=false), and carries no chip links', () => {
    const tree = <OpenModulesMenu modules={MODULES} />
    const ssr = renderToString(tree)
    expect(ssr).toBe(renderToString(tree))
    expect(ssr).toContain('Open modules')
    expect(ssr).toContain('aria-expanded="false"')
    expect(ssr).not.toContain('cap-table-math') // no chip hrefs until the reader opens it
    expect(ssr).not.toContain('Cap table math')
  })
})

describe('the disclosure button', () => {
  it('expands to the same GitHub deep-link chips (new tab, noopener) and collapses again', () => {
    const { container, getByRole } = render(<OpenModulesMenu modules={MODULES} />)
    const button = getByRole('button', { name: /Open modules/ })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelectorAll('a')).toHaveLength(0)

    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    const links = [...container.querySelectorAll('a')]
    expect(links.map((a) => a.textContent)).toEqual(['Cap table math ↗', 'Compliance deadlines ↗'])
    expect(links[0].getAttribute('href')).toBe(MODULES[0].href)
    expect(links[0].getAttribute('target')).toBe('_blank')
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer')

    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelectorAll('a')).toHaveLength(0)
  })
})
