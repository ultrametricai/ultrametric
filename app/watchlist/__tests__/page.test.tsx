// @vitest-environment jsdom
// Watchlist page pins (founder 2026-10-05): the explainer line under the title ("Products you
// starred (☆ → ★) anywhere on Ultrametric…") is gone — display only; the metadata description
// keeps the crawler summary, and the gated list itself is unchanged.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import WatchlistPage, { metadata } from '@/app/watchlist/page'

describe('watchlist page — founder 2026-10-05', () => {
  it('renders the title with NO explainer line beneath it', () => {
    const { container } = render(<WatchlistPage />)
    expect(screen.getByRole('heading', { name: 'Watchlist' })).toBeTruthy()
    expect(container.textContent).not.toContain('Products you starred')
    expect(container.textContent).not.toContain('Saved to your account')
  })

  it('the metadata description keeps the one-line summary (display-only removal)', () => {
    expect(metadata.description).toContain('Products you starred')
  })
})
