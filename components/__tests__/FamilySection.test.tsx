// @vitest-environment jsdom
// FamilySection — the "Products" mini leaderboard on product pages, rendered against the
// committed corpus (data/product-families.json + each arena's rankings.json). Pins the
// founder 2026-10-08 change: the "Not yet judged (N — no ranking where they compete): …"
// footer line is gone, display only — not-yet-judged lines stay data (the family page still
// tells their story), and the section renders only when two or more judged lines exist.
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import FamilySection from '@/components/FamilySection'
import { familyForProduct, loadFamilies } from '@/lib/families'

describe('FamilySection (committed corpus)', () => {
  it('renders the judged mini leaderboard without the "Not yet judged" footer, while the page-only lines stay data', () => {
    // Stripe's committed family carries page-only (arenaRef: null) lines — the data the removed
    // footer used to list.
    const family = familyForProduct(loadFamilies(), 'payments', 'stripe')!
    expect(family.subProducts.some((s) => s.arenaRef === null)).toBe(true)
    const { container } = render(<FamilySection arenaId="payments" productId="stripe" />)
    expect(container.textContent).toContain('Products')
    expect(container.textContent).toContain('product by product')
    expect(container.textContent).not.toContain('Not yet judged')
    expect(container.textContent).not.toContain('no ranking where they compete')
  })

  it('is a plain section (founder 2026-10-08): no enclosing card chrome — the only border is the table\'s own shell', () => {
    const { container } = render(<FamilySection arenaId="payments" productId="stripe" />)
    // The section root is an unstyled div (the Verified integrations idiom: heading + content).
    const root = container.firstElementChild!
    expect(root.getAttribute('class')).toBeNull()
    // The house table shell remains the one bordered element around the rows.
    expect(root.querySelector('.rounded-2xl.border')).not.toBeNull()
  })

  it('renders nothing when fewer than two judged lines exist, even with page-only lines committed', () => {
    // PayPal's committed family has one judged line plus page-only lines; with the footer gone
    // there is nothing left to show.
    const family = familyForProduct(loadFamilies(), 'payments', 'paypal')!
    expect(family.subProducts.filter((s) => s.arenaRef !== null).length).toBeLessThan(2)
    expect(family.subProducts.some((s) => s.arenaRef === null)).toBe(true)
    const { container } = render(<FamilySection arenaId="payments" productId="paypal" />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing for a product with no family entry', () => {
    const { container } = render(<FamilySection arenaId="payments" productId="no-such-product" />)
    expect(container.innerHTML).toBe('')
  })
})
