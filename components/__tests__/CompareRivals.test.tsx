// @vitest-environment jsdom
import { render } from '@testing-library/react'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import CompareRivals from '@/components/CompareRivals'
import { loadCategory } from '@/lib/data'
import type { CategoryData } from '@/lib/data-helpers'

const dataDir = path.resolve(__dirname, '../../data')
const banking = loadCategory('startup-banking', dataDir)

describe('CompareRivals', () => {
  it('renders self first and highlighted, 4 rivals linked — no VS column (founder 2026-10-02)', () => {
    const { container } = render(<CompareRivals data={banking} productId="mercury" />)
    const rows = container.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(5)
    // Self row: first, highlighted, no product link.
    expect(rows[0].className).toContain('bg-emerald-500/5')
    expect(rows[0].textContent).toContain('Mercury')
    expect(rows[0].querySelector('a[href="/arena/startup-banking/product/mercury"]')).toBeNull()
    // Rival row links to its product page; the VS column is gone from the table (header + cells).
    const rampRow = [...rows].find((r) => r.textContent?.includes('Ramp'))!
    expect(rampRow.querySelector('a[href="/arena/startup-banking/product/ramp"]')).not.toBeNull()
    expect([...container.querySelectorAll('th')].some((th) => th.textContent === 'vs')).toBe(false)
    expect(rampRow.querySelector('a[href="/arena/startup-banking/battle/mercury-vs-ramp"]')).toBeNull()
    // Overall score cells link to each product's /score receipt page.
    expect(rows[0].querySelector('a[href="/arena/startup-banking/product/mercury/score"]')).not.toBeNull()
    expect(rampRow.querySelector('a[href="/arena/startup-banking/product/ramp/score"]')).not.toBeNull()
    // Footer: the full-arena link is the one outbound link — the "Alternatives to <X> →" link
    // is gone (founder 2026-10-05; the /alternatives route itself stays alive for old links).
    const footer = [...container.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/arena/startup-banking')
    expect(footer?.textContent).toContain('full arena')
    expect(container.querySelector('a[href^="/alternatives/"]')).toBeNull()
    expect(container.textContent).not.toContain('Alternatives to Mercury')
  })

  it('renamed heading "Alternatives comparison", no explainer sentence (founder 2026-10-02)', () => {
    const { container } = render(<CompareRivals data={banking} productId="mercury" />)
    const heading = container.querySelector('h2')!
    expect(heading.textContent).toContain('Alternatives comparison')
    expect(container.textContent).not.toContain('How it compares')
    // The explainer paragraph under the heading is gone ("…plus each pair's head-to-head
    // record."); the GeoMark's svg <title> still carries the one-line framing.
    expect(container.textContent).not.toContain('head-to-head record')
    expect(container.querySelector('h2 + p')).toBeNull()
  })

  it('the Compare head-to-head strip is the prominent battle affordance: chip buttons with the judged record where known', () => {
    const { container } = render(<CompareRivals data={banking} productId="mercury" />)
    expect([...container.querySelectorAll('h3')].some((h) => h.textContent === 'Compare head-to-head')).toBe(true)
    // Every same-arena rival gets a battle-page chip (direct link, no /vs redirect hop); the
    // ramp chip carries the stored judged record (mercury 16 – 28 ramp in
    // data/startup-banking/rankings.json, self-first) since ramp is a leaderboard-adjacent
    // rival row.
    const rampChip = container.querySelector('a[href="/arena/startup-banking/battle/mercury-vs-ramp"]')!
    expect(rampChip).not.toBeNull()
    expect(rampChip.className).toContain('rounded-full')
    expect(rampChip.textContent).toContain('vs Ramp')
    expect(rampChip.textContent).toContain('16–28')
    const vsChips = container.querySelectorAll('a[href^="/arena/startup-banking/battle/"]')
    expect(vsChips.length).toBe(banking.products.length - 1)
  })

  it('renders n/a for the arena-declared naDimensions (processors: agentReady + apiQuality)', () => {
    const processors = loadCategory('processors', dataDir)
    const { container } = render(
      <CompareRivals data={processors} productId={processors.rankings.leaderboard[0].productId} />,
    )
    const rows = container.querySelectorAll('tbody tr')
    expect(rows.length).toBeGreaterThanOrEqual(2)
    // Every row shows the arena-class n/a cell (with its explanatory tooltip) for BOTH na
    // dimensions — never a number, never a /score link for those columns.
    // Tooltip shortened in the founder 2026-10-02 sweep: "… for this product class".
    const naCells = container.querySelectorAll('td [title^="Not meaningful for this product class"]')
    expect(naCells).toHaveLength(rows.length * 2)
  })

  it('renders nothing for an arena with fewer than 2 products', () => {
    const solo: CategoryData = {
      category: { id: 'solo', name: 'Solo', description: '', personas: ['a developer'] },
      products: [{ id: 'only', name: 'Only', vendor: 'v', type: 'oss', urls: { site: 'https://example.com/only' } }],
      stories: [],
      evidence: {},
      verdicts: [],
      rankings: {
        generatedAt: '2026-01-01T00:00:00.000Z',
        leaderboard: [{ productId: 'only', score: 50, agentReady: null, agenticApp: null, apiQuality: null, aiEra: 50, applicable: 1, total: 1, themeScores: {} }],
        battles: [],
      },
      stacks: [],
      popularity: {},
      claims: {},
      uncertainty: [],
      vendorResponses: [],
      certifications: [],
    }
    const { container } = render(<CompareRivals data={solo} productId="only" />)
    expect(container.innerHTML).toBe('')
  })
})
