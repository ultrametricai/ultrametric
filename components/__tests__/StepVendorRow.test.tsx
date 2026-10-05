// @vitest-environment jsdom
// StepVendorRow — the selectable per-step vendor chips. The load-bearing assertion is the
// static-HTML contract: the SSR output (empty lens + empty stack server snapshots) hydrates
// with ZERO mismatches against the empty client state and shows the serialized default order —
// no flash of personalized content, the SEO page stays the one shared default view. Then the
// lens semantics: clicking a chip pins the vendor first ("✓ via"), a stack pick pins as "yours"
// even from below the display cap, and a lens pick with no step evidence yields the honest
// "not covered by" note instead of a silent swap.
import { render, fireEvent, act, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import StepVendorRow, { type StepRowUntracked, type StepRowVendor } from '@/components/StepVendorRow'
import { lensStorageKey, serializeLensState } from '@/lib/processLens'
import { STACK_KEY, serializeStackMap } from '@/lib/myStack'
import type { ProcessCheckStep } from '@/lib/processCheck'

// Same in-memory localStorage stand-in as components/__tests__/ProcessCheck.test.tsx.
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

const LENS_KEY = 'task-x'

// hasLogo false everywhere: the fallback initial-chip renders without next/image.
const VENDORS: StepRowVendor[] = [
  { productId: 'best-bank', arenaId: 'startup-banking', arenaName: 'Startup banking', name: 'Best Bank', score: 90, hasLogo: false, cross: false, citesTotal: 3, citesFull: 2, citesPartial: 1 },
  { productId: 'mid-bank', arenaId: 'startup-banking', arenaName: 'Startup banking', name: 'Mid Bank', score: 71, hasLogo: false, cross: false, citesTotal: 3, citesFull: 1, citesPartial: 2 },
  { productId: 'chatgpt', arenaId: 'ai-assistants', arenaName: 'AI assistants', name: 'ChatGPT', score: 55, hasLogo: false, cross: true, citesTotal: 2, citesFull: 1, citesPartial: 0 },
]

const UNTRACKED: StepRowUntracked[] = [{ vendor: 'irs', label: 'IRS', hasLogo: false, signupUrl: null }]

// The UNCAPPED serialized row: deep-bank ranks below the displayed chips, dead-bank is shutdown.
const CHECK_STEP: ProcessCheckStep = {
  nodeId: 'open',
  label: 'Open the account',
  storyCount: 3,
  arenas: [
    {
      arenaId: 'startup-banking',
      arenaName: 'Startup banking',
      kind: 'function',
      vendors: [
        { productId: 'best-bank', name: 'Best Bank', score: 90, hasLogo: false },
        { productId: 'mid-bank', name: 'Mid Bank', score: 71, hasLogo: false },
        { productId: 'dead-bank', name: 'Dead Bank', score: 65, hasLogo: false, shutdown: true },
        { productId: 'deep-bank', name: 'Deep Bank', score: 40, hasLogo: false },
      ],
    },
    {
      arenaId: 'ai-assistants',
      arenaName: 'AI assistants',
      kind: 'extra',
      vendors: [{ productId: 'chatgpt', name: 'ChatGPT', score: 55, hasLogo: false }],
    },
  ],
  best: { productId: 'best-bank', name: 'Best Bank', score: 90, arenaId: 'startup-banking' },
}

const row = (
  <StepVendorRow
    vendors={VENDORS}
    untracked={UNTRACKED}
    arenaLink="startup-banking"
    storyCount={3}
    lensKey={LENS_KEY}
    checkStep={CHECK_STEP}
  />
)

// Vendor names in on-screen chip order (the .truncate span holds the bare name — the logo
// fallback initial lives in a sibling span). Since the founder batch 2026-10-05 the WHOLE chip
// is the pick toggle <button aria-pressed> with no interactive children (no 'use'/'✕' side
// buttons, no score link) — so ranked chips are the aria-pressed buttons; untracked chips
// stay spans.
const chipNames = (root: ParentNode) =>
  [...root.querySelectorAll('button[aria-pressed] span.truncate')].map((s) => s.textContent ?? '')

describe('static-HTML contract (SSR ↔ empty client state)', () => {
  beforeEach(() => stubLocalStorage())

  it('SSR output hydrates with no mismatch against the empty lens + empty stack', async () => {
    ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
    const ssr = renderToString(row)
    // The default view: serialized order, select affordances present, nothing selected — and
    // no leading label (founder 2026-09-30: the vendors ARE the line, highest score first).
    expect(ssr).not.toContain('ranked for this step:')
    expect(ssr).not.toContain('✓ via')
    expect(ssr).not.toContain('not covered by')
    const container = document.createElement('div')
    container.innerHTML = ssr
    document.body.appendChild(container)
    let root: Root | undefined
    try {
      expect(chipNames(container)).toEqual(['Best Bank', 'Mid Bank', 'ChatGPT'])
      const hydrationErrors: unknown[] = []
      await act(async () => {
        root = hydrateRoot(container, row, { onRecoverableError: (e) => hydrationErrors.push(e) })
      })
      expect(hydrationErrors).toEqual([])
      // Post-hydration DOM keeps the identical default order — no personalized flash.
      expect(chipNames(container)).toEqual(['Best Bank', 'Mid Bank', 'ChatGPT'])
    } finally {
      await act(async () => root?.unmount())
      container.remove()
    }
  })

  it('the chip is ONE click target: a pick-toggle button with no interactive children — the sub-step score links and the cross-arena tag are gone (founder 2026-10-05)', () => {
    const { container } = render(row)
    // The earlier round's per-chip receipts links flipped for sub-steps: no score links here
    // (process-level scores and the product pages keep their receipts links).
    expect(container.querySelector('a[href*="#story-verdicts"]')).toBeNull()
    const chips = [...container.querySelectorAll('button[aria-pressed]')]
    expect(chips).toHaveLength(3)
    // Structural a11y pin: no nested interactive elements anywhere in the row — no
    // button-in-button, no link-in-button, no link-in-link.
    for (const el of container.querySelectorAll('a, button')) {
      expect(el.parentElement?.closest('a, button')).toBeNull()
    }
    // The score renders INSIDE the chip as plain text; the tooltip states THIS number's
    // derivation — the real arena and verdict counts, never a canned sentence.
    const score = chips[0].querySelector('span[title]')
    expect(score?.textContent).toBe('90/100')
    expect(score?.getAttribute('title')).toBe(
      '90/100 · #1 for this step — from 3 judged Startup banking stories mapped to this step (2 full, 1 partial)',
    )
    // The cross-arena tag no longer renders beside the ChatGPT chip — the arena name lives
    // only in the score tooltip.
    expect(container.textContent).not.toContain('AI assistants')
    expect(chips[2].querySelector('span[title]')?.getAttribute('title')).toContain('AI assistants')
  })
})

describe('lens + stack selection', () => {
  beforeEach(() => stubLocalStorage())
  afterEach(() => window.localStorage.clear())

  it('clicking a chip pins the vendor first with the ✓ via tag (aria-pressed); clicking it again clears — and no visible "use"/"✕" control renders (founder 2026-10-05)', () => {
    const { container } = render(row)
    // The pick affordance is the chip body itself — aria-label names the action (no tooltip
    // on vendor chips, founder 2026-10-05: the chip button and the untracked chip carry no
    // title; only the SCORE link keeps its derivation tooltip), no 'use' word.
    expect(container.textContent).not.toMatch(/\buse\b/)
    for (const b of container.querySelectorAll('button[aria-pressed]')) {
      expect(b.getAttribute('title')).toBeNull()
    }
    fireEvent.click(within(container).getByLabelText(/See this process via Mid Bank/))
    expect(chipNames(container)[0]).toContain('Mid Bank')
    expect(container.textContent).toContain('✓ via')
    const pressed = within(container).getByLabelText(/Stop viewing this process via Mid Bank/)
    expect(pressed.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(pressed)
    expect(chipNames(container)[0]).toContain('Best Bank')
    expect(container.textContent).not.toContain('✓ via')
    expect(container.textContent).not.toContain('✕')
  })

  it('a stack pick below the display cap still pins, tagged "yours" (uncapped checkStep row)', () => {
    window.localStorage.setItem(STACK_KEY, serializeStackMap({ 'startup-banking': ['deep-bank'] }))
    const { container } = render(row)
    expect(chipNames(container)[0]).toContain('Deep Bank')
    expect(container.textContent).toContain('yours')
    // The lens click still beats the stack pick.
    fireEvent.click(within(container).getByLabelText(/See this process via Best Bank/))
    expect(chipNames(container)[0]).toContain('Best Bank')
    expect(container.textContent).toContain('✓ via')
  })

  it('a multi-pick stack pins the BEST-scoring pick; the other picks keep a subtle "yours" tag', () => {
    window.localStorage.setItem(
      STACK_KEY,
      serializeStackMap({ 'startup-banking': ['mid-bank', 'best-bank'] }),
    )
    const { container } = render(row)
    // best-bank (90) beats mid-bank (71), whatever the stack order says.
    expect(chipNames(container)[0]).toContain('Best Bank')
    // Two "yours" markers: the pinned tag on best-bank plus the subtle tag on mid-bank.
    const tags = [...container.querySelectorAll('span')].filter((s) => s.textContent === 'yours')
    expect(tags).toHaveLength(2)
  })

  it('a lens pick with no judged evidence on this step shows the honest gap note, never a swap', () => {
    window.localStorage.setItem(
      lensStorageKey(LENS_KEY),
      serializeLensState({ picks: { 'startup-banking': 'ghost-bank' }, names: { 'ghost-bank': 'Ghost Bank' } }),
    )
    const { container } = render(row)
    expect(container.textContent).toContain('not covered by Ghost Bank — best here: Best Bank 90')
    // The best-here score is plain text too (founder 2026-10-05: no sub-step score links).
    expect(container.querySelector('a[href*="#story-verdicts"]')).toBeNull()
    // Default order preserved — nothing pinned.
    expect(chipNames(container)[0]).toContain('Best Bank')
    expect(container.textContent).not.toContain('✓ via')
  })

  it('a shutdown vendor never resolves from the lens (falls back to the default view)', () => {
    window.localStorage.setItem(
      lensStorageKey(LENS_KEY),
      serializeLensState({ picks: { 'startup-banking': 'dead-bank' }, names: { 'dead-bank': 'Dead Bank' } }),
    )
    const { container } = render(row)
    expect(container.textContent).not.toContain('✓ via')
    expect(chipNames(container)[0]).toContain('Best Bank')
    // And the row is honest about it: the pick has no offerable evidence here.
    expect(container.textContent).toContain('not covered by Dead Bank')
  })
})
