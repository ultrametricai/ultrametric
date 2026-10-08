// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MomentumChip from '@/components/MomentumChip'

describe('MomentumChip', () => {
  it('renders stars and stars/yr when both present', () => {
    render(<MomentumChip popularity={{ stars: 12_400, starsPerYear: 2_100, fetchedAt: '2026-08-27T00:00:00.000Z' }} />)
    expect(screen.getByText('★ 12.4k')).toBeDefined()
    expect(screen.getByText('▲ 2.1k/yr')).toBeDefined()
  })

  it('renders npm weekly downloads', () => {
    render(<MomentumChip popularity={{ npmWeekly: 890_000, fetchedAt: '2026-08-27T00:00:00.000Z' }} />)
    expect(screen.getByText('npm 890k/wk')).toBeDefined()
  })

  it('renders pypi weekly downloads in the full-size (product page) variant only', () => {
    render(<MomentumChip popularity={{ pypiWeekly: 520_890, fetchedAt: '2026-08-27T00:00:00.000Z' }} />)
    expect(screen.getByText('pypi 520.9k/wk')).toBeDefined()
  })

  it('compact (ranking tables) never renders pypi — even alongside other signals (founder 2026-09-30)', () => {
    const { container } = render(
      <MomentumChip popularity={{ stars: 1_200, pypiWeekly: 520_890, fetchedAt: '2026-08-27T00:00:00.000Z' }} compact />,
    )
    expect(container.textContent).toContain('★ 1.2k')
    expect(container.textContent).not.toContain('pypi')
  })

  it('compact renders nothing at all for a pypi-only record (no empty hoverable shell)', () => {
    const { container } = render(
      <MomentumChip popularity={{ pypiWeekly: 520_890, fetchedAt: '2026-08-27T00:00:00.000Z' }} compact />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('compact suppresses a stars-only record under the noise floor (founder 2026-10-02, the ByteAsk case)', () => {
    // The real committed shape that read as "$89/yr pricing next to 24 stars" on /arena/ai-coding.
    const { container } = render(
      <MomentumChip popularity={{ stars: 24, starsPerYear: 89.099, fetchedAt: '2026-09-25T18:15:55.776Z' }} compact />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('compact keeps rendering at/above the floor, and for small-stars records with an npm signal', () => {
    const { container: above } = render(
      <MomentumChip popularity={{ stars: 100, starsPerYear: 89, fetchedAt: '2026-09-25T00:00:00.000Z' }} compact />,
    )
    expect(above.textContent).toContain('★ 100')
    const { container: withNpm } = render(
      <MomentumChip popularity={{ stars: 24, npmWeekly: 5_000, fetchedAt: '2026-09-25T00:00:00.000Z' }} compact />,
    )
    expect(withNpm.textContent).toContain('npm 5k/wk')
  })

  it('the full-size (product page) variant still shows every signal of a tiny-stars record', () => {
    const { container } = render(
      <MomentumChip popularity={{ stars: 24, starsPerYear: 89.099, fetchedAt: '2026-09-25T18:15:55.776Z' }} />,
    )
    expect(container.textContent).toContain('★ 24')
    expect(container.textContent).toContain('▲ 89/yr')
  })

  it('renders nothing (compact) when there is no signal', () => {
    const { container } = render(<MomentumChip popularity={undefined} compact />)
    expect(container.textContent).toBe('')
  })

  it('renders nothing (compact) for a fetch-attempted-but-empty record', () => {
    const { container } = render(<MomentumChip popularity={{ fetchedAt: '2026-08-27T00:00:00.000Z' }} compact />)
    expect(container.textContent).toBe('')
  })

  it('renders nothing in the non-compact (default) variant when there is no signal — silence, not "no public signals" text (founder 2026-10-08)', () => {
    const { container } = render(<MomentumChip popularity={undefined} />)
    expect(container.innerHTML).toBe('')
    const { container: emptyRecord } = render(<MomentumChip popularity={{ fetchedAt: '2026-08-27T00:00:00.000Z' }} />)
    expect(emptyRecord.innerHTML).toBe('')
  })

  it('surfaces fetchedAt in the title for freshness', () => {
    const { container } = render(<MomentumChip popularity={{ stars: 10, fetchedAt: '2026-08-27T00:00:00.000Z' }} />)
    expect(container.querySelector('[title]')?.getAttribute('title')).toContain('2026-08-27')
  })
})
