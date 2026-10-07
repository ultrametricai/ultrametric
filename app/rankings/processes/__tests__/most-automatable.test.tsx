// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MostAutomatableProcessesPage from '@/app/rankings/processes/most-automatable/page'
import { buildProcessRows } from '@/lib/processRows'

describe('most-automatable process ranking page', () => {
  it('is explicitly labeled a process ranking and renders every process, sorted by pct desc', () => {
    const { container } = render(<MostAutomatableProcessesPage />)

    // The can-never-be-mistaken-for-a-company-ranking badge — house loop glyph (SVG via
    // IconGlyph), never the old 🔁 emoji (founder sweep 2026-10-02).
    const eyebrow = screen.getByText('Process ranking')
    expect(eyebrow).toBeDefined()
    expect(eyebrow.querySelector('svg')).not.toBeNull()
    expect(eyebrow.textContent).not.toContain('🔁')
    expect(eyebrow.textContent).not.toContain('pi:')
    expect(screen.getByRole('heading', { level: 1, name: /Most automatable/ })).toBeDefined()

    const bodyRows = [...container.querySelectorAll('tbody tr')]
    expect(bodyRows.length).toBe(buildProcessRows().rows.length)

    // Rows are ordered by agent ceiling, descending (the pct cell reads "NN%").
    const pcts = bodyRows.map((tr) => {
      const m = tr.textContent?.match(/(\d+)%/)
      expect(m, tr.textContent ?? '').toBeTruthy()
      return Number(m![1])
    })
    for (let i = 1; i < pcts.length; i++) expect(pcts[i]).toBeLessThanOrEqual(pcts[i - 1])

    // The top row's process links to its /processes/<slug> page.
    const topLink = bodyRows[0].querySelector('a')
    expect(topLink?.getAttribute('href')).toMatch(/^\/processes\/[a-z0-9-]+$/)

    // The cross-link footer shows both labeled groups, each wearing its house glyph (the same
    // SVG the Explore menu's section header wears), not the old 🏢/🔁 emoji.
    for (const label of ['Company leaderboards', 'Process leaderboards']) {
      const group = screen.getByText(label)
      expect(group.querySelector('svg')).not.toBeNull()
      expect(group.textContent).not.toMatch(/🏢|🔁|pi:/)
    }
  })
})
