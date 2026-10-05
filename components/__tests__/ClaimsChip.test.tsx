// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import ClaimsChip from '@/components/ClaimsChip'
import { claimsIntegrity } from '@/lib/claimsIntegrity'
import { loadCategory } from '@/lib/data'

const DATA_DIR = path.resolve(__dirname, '../../data')

describe('ClaimsChip', () => {
  it('renders the claims-integrity score as "{score}/100" for a product with testable claims', () => {
    const data = loadCategory('code-hosting', DATA_DIR)
    const { score } = claimsIntegrity(data, 'github')
    expect(score).not.toBeNull() // sanity: github's real data has testable claims
    const { container } = render(<ClaimsChip data={data} productId="github" />)
    expect(screen.getByText(String(score))).toBeDefined()
    expect(screen.getByText('/100')).toBeDefined()
    // No trailing "integrity" word in the cell (founder 2026-10-02) — tooltip carries the name.
    expect(container.textContent).not.toContain('integrity')
  })

  it('renders an italic "untested" (unscored, not zero) when nothing is claimed for the product', () => {
    const data = loadCategory('code-hosting', DATA_DIR)
    const noClaims = { ...data, claims: {} }
    render(<ClaimsChip data={noClaims} productId="github" />)
    expect(screen.getByText('untested')).toBeDefined()
  })

  it('carries the full bucket breakdown in the title tooltip', () => {
    const data = loadCategory('code-hosting', DATA_DIR)
    const { container } = render(<ClaimsChip data={data} productId="github" />)
    const title = container.querySelector('[title]')?.getAttribute('title')
    expect(title).toContain('verified')
    expect(title).toContain('contradicted')
    expect(title).toContain('untestable')
  })
})
