// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import ArenaTable from '@/components/ArenaTable'
import { loadCategory } from '@/lib/data'

describe('ArenaTable', () => {
  it('renders every product with Overall score as the default sort', () => {
    const data = loadCategory('desktop-os', path.resolve(__dirname, '../../data'))
    render(<ArenaTable data={data} logoMap={{}} />)
    for (const p of data.products) {
      expect(screen.getAllByText(p.name).length).toBeGreaterThan(0)
    }
    const initScoreHeader = screen.getAllByText('Overall score').map((el) => el.closest('th')).find((th) => th !== null)
    expect(initScoreHeader?.getAttribute('aria-sort')).toBe('descending')
  })

  it('activates the preset and re-sorts when a preset button is clicked', () => {
    const data = loadCategory('desktop-os', path.resolve(__dirname, '../../data'))
    render(<ArenaTable data={data} logoMap={{}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Most agent-ready' }))
    const header = screen.getAllByText('Agent-ready').map((el) => el.closest('th')).find((th) => th !== null)
    expect(header?.getAttribute('aria-sort')).toBe('descending')
  })

  it('filters rows by the text filter', () => {
    const data = loadCategory('desktop-os', path.resolve(__dirname, '../../data'))
    render(<ArenaTable data={data} logoMap={{}} />)
    const input = screen.getByLabelText('Filter products by name or vendor')
    fireEvent.change(input, { target: { value: 'zzz-no-such-product' } })
    expect(screen.getByText(/No products match/)).toBeDefined()
  })

  it('sets aria-sort on the current sort column header', () => {
    const data = loadCategory('desktop-os', path.resolve(__dirname, '../../data'))
    render(<ArenaTable data={data} logoMap={{}} />)
    const initScoreHeader = screen.getAllByText('Overall score').map((el) => el.closest('th')).find((th) => th !== null)
    expect(initScoreHeader?.getAttribute('aria-sort')).toBe('descending')
  })
})

// Founder batch 2026-09-30, item 4: display-only removals inside the arena leaderboards.
// vector-databases is the fixture on purpose: its COMMITTED data carries both pypi popularity
// numbers and disputed verdicts, so each absence pin proves a real suppression, not an empty
// dataset. The data itself stays in the repo untouched.
describe('leaderboard display removals (founder 2026-09-30)', () => {
  const load = () => loadCategory('vector-databases', path.resolve(__dirname, '../../data'))

  it('never renders pypi in the popularity column (the data stays committed)', () => {
    const data = load()
    expect(Object.values(data.popularity).some((p) => p?.pypiWeekly !== undefined)).toBe(true)
    const { container } = render(<ArenaTable data={data} logoMap={{}} />)
    expect(container.textContent).not.toContain('pypi')
    // Other popularity signals keep rendering as committed.
    expect(container.textContent).toContain('★')
  })

  it('renders no per-row "vs …" battle link', () => {
    const { container } = render(<ArenaTable data={load()} logoMap={{}} />)
    expect(container.querySelector('a[href*="/battle/"]')).toBeNull()
    expect(container.textContent).not.toMatch(/vs .+ ↗/)
  })

  it('renders no visible "disputed" datum (the dispute data stays committed)', () => {
    const data = load()
    expect(data.verdicts.some((v) => v.verdict === 'disputed')).toBe(true)
    const { container } = render(<ArenaTable data={data} logoMap={{}} />)
    expect(container.textContent).not.toContain('disputed')
  })

  it('carries an accessible table name without the visible word "Leaderboard"', () => {
    const data = load()
    const { container } = render(<ArenaTable data={data} logoMap={{}} />)
    expect(container.querySelector('table')?.getAttribute('aria-label')).toBe(`${data.category.name} rankings`)
    expect(container.textContent).not.toContain('Leaderboard')
  })
})

// Founder batch 2026-10-02: more display-only removals inside the arena leaderboards. The
// underlying data and components stay (VerificationMixChip still renders on /rankings/
// most-tested; the /score receipt pages stay live and linked from product pages).
describe('leaderboard display removals (founder 2026-10-02)', () => {
  const load = () => loadCategory('vector-databases', path.resolve(__dirname, '../../data'))

  it('renders no Verification column (header and VerificationMixChip cells gone)', () => {
    const { container } = render(<ArenaTable data={load()} logoMap={{}} />)
    const headers = [...container.querySelectorAll('th')].map((th) => th.textContent)
    expect(headers).not.toContain('Verification')
    // The chip's ratio cells linked to #story-verdicts — none of those links remain.
    expect(container.querySelector('a[href*="#story-verdicts"]')).toBeNull()
  })

  it('renders no Evidence column (header and per-row "view" /score links gone)', () => {
    const { container } = render(<ArenaTable data={load()} logoMap={{}} />)
    const headers = [...container.querySelectorAll('th')].map((th) => th.textContent)
    expect(headers).not.toContain('Evidence')
    expect(container.querySelector('a[href$="/score"]')).toBeNull()
  })

  it('claims cells render "{score}/100" with no trailing "integrity" word', () => {
    const { container } = render(<ArenaTable data={load()} logoMap={{}} />)
    expect(container.textContent).not.toContain('integrity')
    // The Claims column itself stays.
    const headers = [...container.querySelectorAll('th')].map((th) => th.textContent)
    expect(headers).toContain('Claims')
  })

  it('renders no "Open source" chip in the product column (the type data stays committed)', () => {
    const data = load()
    // Non-vacuous: this arena's committed data really has open-source products.
    expect(data.products.some((p) => p.type === 'oss')).toBe(true)
    const { container } = render(<ArenaTable data={data} logoMap={{}} />)
    expect(container.textContent).not.toContain('Open source')
  })

  it('suppresses a tiny stars-only popularity record — no lonely star count, no orphaned GitHub link (the ByteAsk case)', () => {
    const data = loadCategory('ai-coding', path.resolve(__dirname, '../../data'))
    // Non-vacuous: the committed record that read as "$89/yr pricing next to 24 stars".
    const byteask = data.popularity['byteask']
    expect(byteask?.stars).toBeLessThan(100)
    expect(byteask?.npmWeekly).toBeUndefined()
    const { container } = render(<ArenaTable data={data} logoMap={{}} />)
    expect(container.textContent).not.toContain('★ 24')
    expect(container.textContent).not.toContain('89/yr')
    // No empty <a> shell left where the chip was suppressed.
    for (const a of container.querySelectorAll('a[title="Open the GitHub repo"]')) {
      expect(a.textContent?.trim()).not.toBe('')
    }
    // Healthy records in the same table keep rendering.
    expect(container.textContent).toContain('★')
  })
})
