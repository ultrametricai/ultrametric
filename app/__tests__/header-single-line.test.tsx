// @vitest-environment jsdom
// The mobile top bar renders as ONE line (founder bug 2026-10-08: below sm the header wrapped
// to double line height — the ~170px-wide full wordmark plus the worded Search trigger, the
// GitHub mark, ☰, and the Log in / Sign up cluster exceeded a 375px viewport, and the row's
// flex-wrap turned the overflow into a second line). The fix set, each pinned here:
//   1. the header row carries NO wrapping classes — flex-nowrap at every width, no gap-y;
//   2. LogoWordmark shows a compact first-glyph mark below sm, the full wordmark from sm up;
//   3. the search trigger is an icon below sm (accessible name stays "Open search"), the
//      "Search" word and the ⌘K hint are sm-up.
// jsdom has no layout engine, so the pins are structural: the responsive classes that decide
// what exists on each side of the sm breakpoint, plus the row's nowrap contract in the source.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {} }),
}))

import CommandPalette from '@/components/CommandPalette'
import LogoWordmark from '@/components/fx/LogoWordmark'

const layoutSrc = readFileSync(path.join(__dirname, '..', 'layout.tsx'), 'utf8')

describe('header row single-line contract (app/layout.tsx)', () => {
  // The row div is the first element inside <header> — grab its exact className.
  const headerIdx = layoutSrc.indexOf('<header')
  const rowStart = layoutSrc.indexOf('<div className="mx-auto flex max-w-7xl', headerIdx)
  const rowClassName = layoutSrc.slice(
    layoutSrc.indexOf('"', rowStart) + 1,
    layoutSrc.indexOf('"', layoutSrc.indexOf('"', rowStart) + 1),
  )

  it('the row is flex-nowrap at every width and carries no wrap/gap-y classes', () => {
    expect(rowStart).toBeGreaterThan(headerIdx) // the row div exists inside <header>
    expect(rowClassName).toContain('flex-nowrap')
    // No breakpoint re-enables wrapping and no cross-axis gap exists to open a second line.
    expect(rowClassName).not.toMatch(/(^|[\s:"])flex-wrap/)
    expect(rowClassName).not.toContain('gap-y')
  })

  it('the nav cluster never wraps below sm (wrapping is a desktop-only allowance)', () => {
    const navStart = layoutSrc.indexOf('<nav className="', headerIdx)
    const navClassName = layoutSrc.slice(
      navStart + '<nav className="'.length,
      layoutSrc.indexOf('"', navStart + '<nav className="'.length),
    )
    expect(navClassName).toContain('flex-nowrap')
    // flex-wrap may only appear behind the sm: prefix.
    expect(navClassName.split(/\s+/).filter((c) => c === 'flex-wrap')).toEqual([])
  })
})

describe('LogoWordmark compact variant below sm', () => {
  it('renders the first-glyph mark below sm and the full wordmark from sm up', () => {
    const { container } = render(<LogoWordmark />)
    const mark = container.querySelector('img[src="/ultrametric-mark.svg"]')
    const wordmark = container.querySelector('img[src="/ultrametric-wordmark.svg"]')
    expect(mark?.className).toContain('sm:hidden')
    expect(wordmark?.className).toContain('hidden')
    expect(wordmark?.className).toContain('sm:block')
    // One img names the link (the mark is decorative beside it, and the link keeps its title).
    expect(screen.getByRole('link', { name: 'ultrametric' }).getAttribute('title')).toBe('Ultrametric home')
  })

  it('ships the compact mark asset — the committed wordmark cropped to its first glyph', () => {
    const markSvg = readFileSync(path.join(__dirname, '..', '..', 'public', 'ultrametric-mark.svg'), 'utf8')
    const wordmarkSvg = readFileSync(path.join(__dirname, '..', '..', 'public', 'ultrametric-wordmark.svg'), 'utf8')
    expect(markSvg).toContain('viewBox="0 0 32.5 23"') // one glyph wide, not 324
    // Same letterform data, no redrawn art: the first glyph's outline path opens both files.
    expect(markSvg).toContain('M31 .8q.6 0 .7.6v9.9')
    expect(wordmarkSvg).toContain('M31 .8q.6 0 .7.6v9.9')
  })
})

describe('search trigger compacts to an icon below sm', () => {
  it('keeps the accessible name, hides the word below sm, and the icon from sm up', () => {
    render(<CommandPalette />)
    const trigger = screen.getByRole('button', { name: 'Open search' })
    const word = [...trigger.querySelectorAll('span')].find((s) => s.textContent === 'Search')
    expect(word?.className).toContain('hidden')
    expect(word?.className).toContain('sm:inline')
    const icon = trigger.querySelector('svg')
    expect(icon?.getAttribute('class')).toContain('sm:hidden')
    // The ⌘K hint stays desktop-only.
    const kbd = trigger.querySelector('kbd')
    expect(kbd?.className).toContain('hidden')
    expect(kbd?.className).toContain('sm:inline')
  })
})
