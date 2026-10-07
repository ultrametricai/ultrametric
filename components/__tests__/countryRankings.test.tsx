// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CountryRankings from '@/components/CountryRankings'
import { loadCategory } from '@/lib/data'
import { loadRollups } from '@/lib/rollups'

// Renders the country-rankings section against the arena's REAL derived rollups.json, so the
// section can never silently drift from the data contract (same posture as the other
// component tests that render live data). Ordering assertions stay structural — which
// country leads is the data's business, not this test's.
describe('CountryRankings (government-services live data)', () => {
  const rollups = loadRollups('government-services')
  const { products } = loadCategory('government-services')

  it('arena has derived rollups with every matched area boarded', () => {
    expect(rollups).not.toBeNull()
    for (const area of rollups!.matchedAreas) {
      expect(rollups!.areaBoards[area]?.length, area).toBeGreaterThanOrEqual(2)
    }
  })

  it('renders one overall row per country and links every cell to its judged agencies', () => {
    const { container, getAllByText } = render(
      <CountryRankings categoryId="government-services" rollups={rollups!} products={products} />,
    )
    const rows = container.querySelectorAll('tbody tr')
    expect(rows.length).toBe(rollups!.countries.length)
    // The founder's named example: the IP-office board compares India's IP office with USPTO
    // (each agency appears in the overall table's cell AND its per-area board).
    expect(getAllByText('USPTO').length).toBeGreaterThanOrEqual(2)
    expect(getAllByText('IP India (CGPDTM)').length).toBeGreaterThanOrEqual(2)
    // Every agency link resolves to the product page of a real roster product.
    const ids = new Set(products.map((p) => p.id))
    for (const a of container.querySelectorAll('a[href*="/product/"]')) {
      const id = (a.getAttribute('href') ?? '').split('/product/')[1]
      expect(ids.has(id), id).toBe(true)
    }
  })

  it('ranks each area board by score with nulls last', () => {
    for (const [area, board] of Object.entries(rollups!.areaBoards)) {
      const scores = board.map((r) => r.score)
      const nonNull = scores.filter((s): s is number => s !== null)
      expect(scores.slice(0, nonNull.length), area).toEqual(nonNull)
      for (let i = 1; i < nonNull.length; i++) expect(nonNull[i - 1], area).toBeGreaterThanOrEqual(nonNull[i])
    }
  })
})
