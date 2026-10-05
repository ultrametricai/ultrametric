// @vitest-environment jsdom
// ProcessVendorPicker — the top-of-page 'Select vendor for process test' control as the house
// listbox dropdown (founder 2026-10-02: the GeoDropdown/SimRolePicker idiom replaces the flat
// chip rows; presentation only — same buildArenas market, same setPick lens writes). Since the
// founder batch 2026-10-05 only CHAIN pages render it — process detail pages dropped the
// section (app/processes/[slug]/page.tsx carries the removal note). Pins:
//   1. the static default: SSR is deterministic and every arena trigger reads 'No vendor' —
//      the SEO page stays byte-identical for readers with no lens/stack;
//   2. the listbox: trigger wears aria-haspopup/aria-expanded, options are role="option" rows
//      with 'No vendor' leading (and selected by default), vendors in ranked order wearing
//      their N/100 best-step score;
//   3. mechanics unchanged: picking writes the SAME lens the chips wrote (lensStorageKey), the
//      trigger names the pick, and 'No vendor' clears back to the generic view.
import { fireEvent, render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import ProcessVendorPicker from '@/components/ProcessVendorPicker'
import { lensStorageKey, parseLensState } from '@/lib/processLens'
import type { ProcessCheckStep } from '@/lib/processCheck'

// Same in-memory localStorage stand-in as components/__tests__/ProcessLensBanner.test.tsx.
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

const PAGE_KEY = 'task-x'
const STORAGE_KEY = lensStorageKey(PAGE_KEY)
const storedPicks = () => parseLensState(window.localStorage.getItem(STORAGE_KEY)).picks

const STEPS: ProcessCheckStep[] = [
  {
    nodeId: 'open',
    label: 'Open the account',
    storyCount: 3,
    arenas: [
      {
        arenaId: 'startup-banking',
        arenaName: 'Startup banking',
        kind: 'function',
        vendors: [
          { productId: 'best-bank', name: 'Best Bank', score: 90 },
          { productId: 'mid-bank', name: 'Mid Bank', score: 71 },
        ],
      },
    ],
    best: { productId: 'best-bank', name: 'Best Bank', score: 90, arenaId: 'startup-banking' },
  },
]

beforeEach(() => {
  stubLocalStorage()
  window.history.replaceState(null, '', '/processes/task-x')
})

describe('ProcessVendorPicker (house listbox dropdown)', () => {
  it('static default: SSR is deterministic, the trigger reads No vendor, and no listbox is open', () => {
    const tree = <ProcessVendorPicker steps={STEPS} lensKey={PAGE_KEY} />
    const ssr = renderToString(tree)
    expect(ssr).toBe(renderToString(tree))
    expect(ssr).toContain('Select vendor for process test')
    expect(ssr).toContain('No vendor')
    expect(ssr).not.toContain('role="listbox"')
    // The generic page never pre-names a vendor in the trigger.
    expect(ssr).not.toContain('Best Bank')
  })

  it('opens a role="listbox" with No vendor leading (selected by default) and vendors in ranked order wearing N/100', () => {
    const r = render(<ProcessVendorPicker steps={STEPS} lensKey={PAGE_KEY} />)
    const trigger = r.getByRole('button', { expanded: false })
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox')
    fireEvent.click(trigger)
    const list = r.getByRole('listbox', { name: 'Startup banking vendors' })
    const options = [...list.querySelectorAll('[role="option"]')]
    expect(options.map((o) => o.textContent)).toEqual([
      'No vendor✓',
      // Ranked order (best step score desc), each wearing the muted /100 score.
      expect.stringContaining('Best Bank'),
      expect.stringContaining('Mid Bank'),
    ])
    expect(options[0].getAttribute('aria-selected')).toBe('true')
    expect(options[1].textContent).toContain('90/100')
    expect(options[2].textContent).toContain('71/100')
  })

  it('picking writes the same lens the chips wrote; No vendor clears back to the generic view', () => {
    const r = render(<ProcessVendorPicker steps={STEPS} lensKey={PAGE_KEY} />)
    fireEvent.click(r.getByRole('button', { expanded: false }))
    const list = r.getByRole('listbox', { name: 'Startup banking vendors' })
    fireEvent.click([...list.querySelectorAll('[role="option"]')].find((o) => o.textContent?.includes('Mid Bank')) as Element)
    expect(storedPicks()).toEqual({ 'startup-banking': 'mid-bank' })
    const trigger = r.getByRole('button', { expanded: false })
    expect(trigger.textContent).toContain('Mid Bank')

    fireEvent.click(trigger)
    fireEvent.click(
      [...r.getByRole('listbox', { name: 'Startup banking vendors' }).querySelectorAll('[role="option"]')].find((o) =>
        o.textContent?.includes('No vendor'),
      ) as Element,
    )
    expect(storedPicks()).toEqual({})
    expect(r.getByRole('button', { expanded: false }).textContent).toContain('No vendor')
  })
})
