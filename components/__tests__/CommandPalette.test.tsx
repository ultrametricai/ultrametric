// @vitest-environment jsdom
// Keyboard behavior of the ⌘K palette: ArrowDown/ArrowUp move the active row FROM THE INPUT and
// cycle (wrap at both ends), Enter opens the active result, Escape closes. The filter itself is
// covered in lib/__tests__/search-matching.test.ts — these tests pin the interaction contract.
// The index arrives over the wire (fetched from /search-index.json on first open — the layout
// stopped passing it as props 2026-10-02, docs/BUILD-SIZE.md problem 2), so every test mocks
// fetch; the fetch contract itself (lazy, once per mount, loading + failure states, retry on
// reopen) has its own describe block below.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CommandPalette from '@/components/CommandPalette'
import type { SearchEntry } from '@/lib/search-index'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

const ENTRIES: SearchEntry[] = [
  // Carries a house icon token (lib/arenaIcons.ts) — the palette must render it as the custom
  // duotone glyph, not as literal text (founder 2026-10-01 custom-icon upgrade).
  { type: 'arena', label: 'AI Coding Agents', sublabel: '8 products', href: '/arena/ai-coding', icon: 'pi:robot:violet' },
  { type: 'arena', label: 'Online Payments', sublabel: '6 products', href: '/arena/payments' },
  { type: 'page', label: 'Compare', sublabel: 'Any products, side by side', href: '/compare' },
  // Prefix-matches "jev" but only in a LATE group (products render after arenas when browsing) —
  // the direct-match hoist must still put it first (founder 2026-09-23).
  { type: 'product', label: 'Jev (TypeSafe AI)', sublabel: 'Frontier models', href: '/arena/frontier-models/product/jev', productId: 'jev' },
  { type: 'arena', label: 'Legal Ops', sublabel: 'jevons paradox of paperwork', href: '/arena/legal-ops' },
]

function indexResponse(entries: SearchEntry[]) {
  return { ok: true, json: async () => entries } as Response
}

const fetchMock = vi.fn()

// jsdom doesn't implement scrollIntoView (the palette calls it to keep the active row visible)
// or fetch (the palette loads its index over the wire on first open).
beforeEach(() => {
  push.mockClear()
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(indexResponse(ENTRIES))
  vi.stubGlobal('fetch', fetchMock)
})

async function openPalette() {
  render(<CommandPalette />)
  fireEvent.click(screen.getByRole('button', { name: 'Open search' }))
  // The index is fetched on open — wait for the first entry to render before driving the keys.
  await screen.findByText('AI Coding Agents')
  return screen.getByPlaceholderText('Search rankings, products, stories…')
}

describe('CommandPalette keyboard navigation', () => {
  it('ArrowDown from the input moves the highlight and Enter opens the active result', async () => {
    const input = await openPalette()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(push).toHaveBeenCalledWith('/arena/payments')
  })

  it('cycles: ArrowDown wraps last → first, ArrowUp wraps first → last', async () => {
    const input = await openPalette()
    // 5 entries: 0 → 1 → 2 → 3 → 4 → wraps to 0
    for (let i = 0; i < 5; i++) fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(push).toHaveBeenLastCalledWith('/arena/ai-coding')
  })

  it('ArrowUp from the top wraps to the last result', async () => {
    const input = await openPalette()
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'Enter' })
    // Browse order (empty query) is TYPE_ORDER: 3 arenas, then the page, then the product last.
    expect(push).toHaveBeenCalledWith('/arena/frontier-models/product/jev')
  })

  it('Escape closes the palette without navigating', async () => {
    const input = await openPalette()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByPlaceholderText('Search rankings, products, stories…')).toBeNull()
    expect(push).not.toHaveBeenCalled()
  })
})

describe('direct-match hoisting (founder 2026-09-23)', () => {
  it("querying 'jev' puts the label-prefix product FIRST even though arenas normally lead", async () => {
    const input = await openPalette()
    fireEvent.change(input, { target: { value: 'jev' } })
    // Enter opens the active (= first) result: the direct label match, not the sublabel-only arena.
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(push).toHaveBeenCalledWith('/arena/frontier-models/product/jev')
  })
})

describe('browse view Processes group (founder 2026-10-02)', () => {
  it('surfaces the pinned VS entry first and the full Processes group even when arenas fill the cap', async () => {
    // 45 arenas alone exceed MAX_RESULTS (40) — without reservation the process entries and
    // the VS pin would be sliced away before grouping.
    const manyArenas: SearchEntry[] = Array.from({ length: 45 }, (_, i) => ({
      type: 'arena' as const,
      label: `Arena ${i}`,
      sublabel: `${i} products`,
      href: `/arena/a${i}`,
    }))
    const entries: SearchEntry[] = [
      ...manyArenas,
      { type: 'process', label: 'All processes', sublabel: 'Every founder process', href: '/processes' },
      { type: 'process', label: 'Incorporate C-Corp', sublabel: 'Founder process · formation', href: '/processes/incorporate-c-corp' },
      { type: 'page', label: 'Open Startup Sim', sublabel: 'Simulate a startup journey', href: '/startup-sim' },
    ]
    fetchMock.mockResolvedValue(indexResponse(entries))
    render(<CommandPalette />)
    fireEvent.click(screen.getByRole('button', { name: 'Open search' }))
    await screen.findByText('Arena 0')
    // Pinned-first contract: the VS entry is row one.
    const rows = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-label') !== 'Open search')
    expect(rows[0].textContent).toContain('Open Startup Sim')
    // The Processes group header and both process rows render despite the arena flood.
    expect(screen.getByText('Processes')).toBeDefined()
    expect(screen.getByText('All processes')).toBeDefined()
    expect(screen.getByText('Incorporate C-Corp')).toBeDefined()
  })
})

describe('house icons in the palette (founder 2026-10-01)', () => {
  it('renders a `pi:` icon token as the custom duotone glyph, never as literal text', async () => {
    await openPalette()
    expect(document.querySelectorAll('svg[data-glyph="robot"]').length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toContain('pi:robot:violet')
  })
})

describe('lazy index fetch (docs/BUILD-SIZE.md problem 2, 2026-10-02)', () => {
  it('does not fetch until the palette first opens, then fetches /search-index.json exactly once', async () => {
    render(<CommandPalette />)
    expect(fetchMock).not.toHaveBeenCalled()
    const trigger = screen.getByRole('button', { name: 'Open search' })
    fireEvent.click(trigger)
    const input = await screen.findByPlaceholderText('Search rankings, products, stories…')
    await screen.findByText('AI Coding Agents')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/search-index.json')
    // Close and reopen: the loaded index is kept in state — no second fetch.
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.click(trigger)
    await screen.findByText('AI Coding Agents')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shows a loading state while the index is in flight', async () => {
    let resolve!: (value: Response) => void
    fetchMock.mockReturnValue(new Promise<Response>((r) => { resolve = r }))
    render(<CommandPalette />)
    fireEvent.click(screen.getByRole('button', { name: 'Open search' }))
    expect(screen.getByText('Loading search…')).toBeDefined()
    resolve(indexResponse(ENTRIES))
    await screen.findByText('AI Coding Agents')
    expect(screen.queryByText('Loading search…')).toBeNull()
  })

  it('on fetch failure shows the failure row, and reopening retries the fetch', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    render(<CommandPalette />)
    const trigger = screen.getByRole('button', { name: 'Open search' })
    fireEvent.click(trigger)
    const input = await screen.findByPlaceholderText('Search rankings, products, stories…')
    await screen.findByText(/Search is unavailable/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // Reopen retries: the default mock (set in beforeEach) now resolves with the index.
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.click(trigger)
    await screen.findByText('AI Coding Agents')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('treats a non-OK response as a failure (no silent empty palette)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) } as Response)
    render(<CommandPalette />)
    fireEvent.click(screen.getByRole('button', { name: 'Open search' }))
    await screen.findByText(/Search is unavailable/)
  })

  it('typing while the index loads ranks against it as soon as it arrives', async () => {
    let resolve!: (value: Response) => void
    fetchMock.mockReturnValue(new Promise<Response>((r) => { resolve = r }))
    render(<CommandPalette />)
    fireEvent.click(screen.getByRole('button', { name: 'Open search' }))
    const input = screen.getByPlaceholderText('Search rankings, products, stories…')
    fireEvent.change(input, { target: { value: 'jev' } })
    resolve(indexResponse(ENTRIES))
    await waitFor(() => expect(screen.queryByText('Loading search…')).toBeNull())
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(push).toHaveBeenCalledWith('/arena/frontier-models/product/jev')
  })
})
