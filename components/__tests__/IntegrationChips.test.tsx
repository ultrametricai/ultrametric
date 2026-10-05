// @vitest-environment jsdom
// Verified-integrations table pins (founder 2026-10-05): the product page's section converts
// from pill chips to the house table idiom (rounded-2xl border wrapper, text-xs sentence-case
// headers) — content unchanged: one row per verified neighbor, the integration linking to its
// product page, the arena tag (desktop-only below sm), and the evidence excerpt affordance with
// the full verbatim quote(s) in the tooltip. /integrations keeps composing IntegrationChip.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import IntegrationChips, { type IntegrationChipData } from '@/components/IntegrationChips'

const CHIPS: IntegrationChipData[] = [
  {
    productId: 'stripe',
    name: 'Stripe',
    arenaId: 'payments',
    arenaName: 'Payments',
    title: '“works with Stripe out of the box” — from Vercel\'s evidence\n“Stripe webhooks supported” — from Stripe\'s evidence',
    hasLogo: false,
  },
  {
    productId: 'vercel',
    name: 'Vercel',
    arenaId: 'edge-platforms',
    arenaName: 'Edge & serverless platforms',
    title: '“deploys to Vercel” — from Vercel\'s evidence',
    hasLogo: false,
  },
]

describe('Verified integrations table (founder 2026-10-05)', () => {
  it('renders the house table idiom: rounded-2xl wrapper, text-xs sentence-case headers, one row per neighbor', () => {
    const { container } = render(<IntegrationChips chips={CHIPS} />)
    expect(screen.getByText('Verified integrations')).toBeTruthy()
    const wrapper = container.querySelector('table')!.parentElement!
    expect(wrapper.className).toContain('rounded-2xl')
    expect(wrapper.className).toContain('border')
    const headers = [...container.querySelectorAll('th')]
    expect(headers.map((h) => h.textContent)).toEqual(['Integration', 'Arena', 'Evidence'])
    expect(headers[0].closest('tr')!.className).toContain('text-xs')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
  })

  it('content unchanged: rows link to the neighbor product page, carry the arena, and keep the verbatim-evidence tooltip', () => {
    const { container } = render(<IntegrationChips chips={CHIPS} />)
    const stripeRow = [...container.querySelectorAll('tbody tr')][0]
    expect(stripeRow.querySelector('a')!.getAttribute('href')).toBe('/arena/payments/product/stripe')
    expect(stripeRow.textContent).toContain('Payments')
    // The evidence affordance: first excerpt visible, EVERY excerpt verbatim in the tooltip.
    const evidence = stripeRow.querySelector('[title]')!
    expect(evidence.getAttribute('title')).toContain('works with Stripe out of the box')
    expect(evidence.getAttribute('title')).toContain('Stripe webhooks supported')
    expect(evidence.textContent).toContain('works with Stripe out of the box')
    // Arena column yields on phones (hidden below sm) so the table renders sanely.
    const arenaCell = [...stripeRow.querySelectorAll('td')][1]
    expect(arenaCell.className).toContain('hidden')
    expect(arenaCell.className).toContain('sm:table-cell')
    // No pill chips left in this section.
    expect(container.querySelector('a.rounded-full')).toBeNull()
  })

  it('the honest empty state is unchanged', () => {
    const { container } = render(<IntegrationChips chips={[]} />)
    expect(container.textContent).toContain('No integration evidence found in our corpus')
    expect(container.querySelector('table')).toBeNull()
  })
})
