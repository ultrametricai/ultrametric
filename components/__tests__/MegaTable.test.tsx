// @vitest-environment jsdom
// MegaTable's shareable-view URL params (founder 2026-09-21, lib/urlState.ts):
//   ?rank=<column>  sort column (default agentReady elided)
//   ?dir=asc|desc   only when it differs from the column's own default direction
//   ?arena=<id>     arena scope ('all' elided)
//   ?q=<text>       text filter (empty elided)
// Sub-product visibility is no longer a checkbox/?all param: the homepage's Companies|Products
// tabs own it via HomeModeContext (legacy ?all=1 links resolve in components/HomeModes.tsx).
// Contract per param: (a) present on mount → the view applies after hydration, (b) changing the
// control writes it, (c) the default state removes it; invalid values fall back silently.
import { fireEvent, render, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import MegaTable from '@/components/MegaTable'
import { HomeModeContext } from '@/components/HomeModes'
import type { MegaTableRow } from '@/lib/megaTableSort'

const PATH = '/'
const setUrl = (search: string) => window.history.replaceState(null, '', `${PATH}${search}`)
const params = () => new URLSearchParams(window.location.search)

const GLYPH = { char: '—', className: 'text-zinc-600', title: 'none found', href: '/methodology' }

function row(
  over: Pick<MegaTableRow, 'productId' | 'name' | 'arenaId' | 'arenaName'> & Partial<MegaTableRow>,
): MegaTableRow {
  return {
    vendor: over.name,
    type: 'commercial',
    hasLogo: false,
    initScore: 50,
    agentReady: 50,
    agenticApp: 50,
    apiQuality: 50,
    apiUntested: false,
    popularity: null,
    access: { MCP: GLYPH, CLI: GLYPH, API: GLYPH },
    ...over,
  }
}

const ROWS: MegaTableRow[] = [
  row({ productId: 'stripe', name: 'Stripe', arenaId: 'payments', arenaName: 'Payments', agentReady: 90, initScore: 40 }),
  row({ productId: 'stripe-issuing', name: 'Stripe Issuing', arenaId: 'payments', arenaName: 'Payments', isFamilySubProduct: true }),
  row({ productId: 'notion', name: 'Notion', arenaId: 'docs', arenaName: 'Docs', agentReady: 30, initScore: 95 }),
]
const ARENAS = [
  { id: 'payments', name: 'Payments' },
  { id: 'docs', name: 'Docs' },
]

const mount = () => render(<MegaTable rows={ROWS} arenas={ARENAS} />)

const thFor = (root: HTMLElement, label: string) =>
  within(root).getAllByText(label).map((el) => el.closest('th')).find((th) => th !== null) ?? null

beforeEach(() => setUrl(''))

describe('mount applies URL params (invalids fall back silently)', () => {
  it('pristine URL renders the default view: AGENT-READY desc, all arenas', () => {
    const { container } = mount()
    expect(thFor(container, 'Agent-ready')?.getAttribute('aria-sort')).toBe('descending')
    expect((within(container).getByLabelText('Filter by ranking') as HTMLSelectElement).value).toBe('all')
  })

  it('?rank=initScore&dir=asc sorts by Overall score ascending', () => {
    setUrl('?rank=initScore&dir=asc')
    const { container } = mount()
    expect(thFor(container, 'Overall score')?.getAttribute('aria-sort')).toBe('ascending')
    // Ascending Overall score puts Stripe (40) before Notion (95).
    const names = within(container).getAllByText(/^(Stripe|Notion)$/).map((el) => el.textContent)
    expect(names.indexOf('Stripe')).toBeLessThan(names.indexOf('Notion'))
  })

  it('?arena=<id> and ?q= apply the scope and text filter', () => {
    setUrl('?arena=payments&q=stripe')
    const { container } = mount()
    expect((within(container).getByLabelText('Filter by ranking') as HTMLSelectElement).value).toBe('payments')
    expect((within(container).getByLabelText('Filter products by name or vendor') as HTMLInputElement).value).toBe('stripe')
    expect(within(container).queryByText('Notion')).toBeNull()
  })

  it('sub-products hide by default and rank in products mode (HomeModeContext)', () => {
    const { container } = mount()
    expect(within(container).queryByText('Stripe Issuing')).toBeNull() // companies: one row per company
    const products = render(
      <HomeModeContext.Provider value="products">
        <MegaTable rows={ROWS} arenas={ARENAS} />
      </HomeModeContext.Provider>,
    )
    expect(within(products.container).getByText('Stripe Issuing')).toBeDefined()
  })

  it('invalid ?rank/?dir/?arena fall back to the defaults, silently', () => {
    setUrl('?rank=bogus&dir=sideways&arena=nope')
    const { container } = mount()
    expect(thFor(container, 'Agent-ready')?.getAttribute('aria-sort')).toBe('descending')
    expect((within(container).getByLabelText('Filter by ranking') as HTMLSelectElement).value).toBe('all')
  })
})

describe('interactions write params; defaults remove them', () => {
  it('a rank-by preset writes ?rank=, and the default preset removes it', () => {
    const { getByRole } = mount()
    fireEvent.click(getByRole('button', { name: 'Most popular' }))
    expect(params().get('rank')).toBe('popularity')
    fireEvent.click(getByRole('button', { name: 'Highest Overall score' }))
    expect(params().get('rank')).toBe('initScore')
    fireEvent.click(getByRole('button', { name: 'Most agent-ready' })) // the default sort — param gone
    expect(params().get('rank')).toBeNull()
  })

  it('toggling the current column writes ?dir= only when non-default', () => {
    const { container } = mount()
    const header = within(thFor(container, 'Agent-ready') as HTMLElement).getByRole('button')
    fireEvent.click(header) // agentReady was active desc → now asc (non-default)
    expect(params().get('dir')).toBe('asc')
    expect(params().get('rank')).toBeNull() // still the default column
    fireEvent.click(header) // back to desc — the default — param gone
    expect(params().get('dir')).toBeNull()
  })

  it('arena scope and text filter write and clear their params', () => {
    const { container } = mount()
    const select = within(container).getByLabelText('Filter by ranking')
    fireEvent.change(select, { target: { value: 'docs' } })
    expect(params().get('arena')).toBe('docs')
    fireEvent.change(select, { target: { value: 'all' } })
    expect(params().get('arena')).toBeNull()

    const input = within(container).getByLabelText('Filter products by name or vendor')
    fireEvent.change(input, { target: { value: 'notion' } })
    expect(params().get('q')).toBe('notion')
    fireEvent.change(input, { target: { value: '' } })
    expect(params().get('q')).toBeNull()
  })

  it('patches, never rebuilds: co-mounted params (?view, ?order) survive a sort click', () => {
    setUrl('?view=processes&order=risk')
    const { getByRole } = mount()
    fireEvent.click(getByRole('button', { name: 'Most popular' }))
    expect(params().get('view')).toBe('processes')
    expect(params().get('order')).toBe('risk')
    expect(params().get('rank')).toBe('popularity')
  })
})

describe('arena column house glyphs (founder sweep 2026-10-02)', () => {
  it("renders the arena's house SVG via arenaIcon()/IconGlyph, never the legacy emoji or a raw token", () => {
    const { container } = mount()
    // 'payments' is a real arena id — its cell link carries the custom duotone SVG.
    const arenaLink = container.querySelector('a[href="/arena/payments"]') as HTMLElement
    expect(arenaLink).not.toBeNull()
    expect(arenaLink.querySelector('svg')).not.toBeNull()
    expect(arenaLink.textContent).not.toContain('💳') // the old data/arena-icons.json emoji
    expect(arenaLink.textContent).not.toContain('pi:') // the token renders as SVG, never as text
  })
})
