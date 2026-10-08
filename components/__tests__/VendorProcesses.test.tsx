// @vitest-environment jsdom
// Pins for the product page's "Processes this product serves" section (components/
// VendorProcesses.tsx) after the founder's 2026-10-08 compaction: the table (Phase / Role /
// Best step fit columns, the caption line, the per-step receipt sub-rows) is gone — the section
// is a compact inline clickable list of just the process names, each linking its process page
// with the existing ?via=<arenaId>:<productId> lens. The computer-use-only split keeps its
// honest collapsed <details>. Renders against the real committed corpus — same data the static
// pages build from.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import VendorProcesses from '@/components/VendorProcesses'
import { processesForVendor } from '@/lib/vendorProcesses'

// mercury (startup-banking) is the corpus's canonical multi-appearance vendor — step-ranked,
// canonical, and api-calls appearances all exist (see lib/__tests__/vendorProcesses.test.ts).
const ARENA = 'startup-banking'
const PRODUCT = 'mercury'

describe('VendorProcesses — founder 2026-10-08 compaction', () => {
  it('renders a names-only inline list: every appearance links its process page with the ?via= lens', () => {
    const { container } = render(<VendorProcesses arenaId={ARENA} productId={PRODUCT} productName="Mercury" />)
    expect(screen.getByText('Processes this product serves')).toBeTruthy()
    const rows = processesForVendor(ARENA, PRODUCT)
    expect(rows.length).toBeGreaterThan(1)
    for (const a of rows) {
      const link = container.querySelector(`a[href="/processes/${a.slug}?via=${ARENA}:${PRODUCT}"]`)
      expect(link, `${a.taskId}: process name must link its page with the ?via lens`).not.toBeNull()
      expect(link!.textContent).toContain(a.title)
    }
    // Exactly one link per appearance — the per-step receipt sub-links are gone (display only:
    // the step scores and receipts live on the process pages the names link to).
    expect(container.querySelectorAll('a[href^="/processes/"]').length).toBe(rows.length)
  })

  it('the table is gone: no Best step fit / Role / Phase columns, no table element, no scores', () => {
    const { container } = render(<VendorProcesses arenaId={ARENA} productId={PRODUCT} productName="Mercury" />)
    expect(container.querySelector('table')).toBeNull()
    expect(screen.queryByText('Best step fit')).toBeNull()
    expect(screen.queryByText('Role')).toBeNull()
    expect(screen.queryByText('Phase')).toBeNull()
    expect(container.textContent).not.toContain('/100')
  })

  it('the caption line ("Where {name} comes up across our founder operating processes") is gone', () => {
    const { container } = render(<VendorProcesses arenaId={ARENA} productId={PRODUCT} productName="Mercury" />)
    expect(container.textContent).not.toContain('Where Mercury comes up')
    // (The GeoMark's SVG <title> still names the founder operating processes — that is the
    // heading's derivation mark, not the removed caption sentence.)
    expect(container.textContent).not.toContain('in reverse')
    expect(container.querySelector('a[href="/processes"]')).toBeNull()
  })

  it('computer-use-only appearances stay collapsed behind the honest details summary, never inline', () => {
    const rows = processesForVendor(ARENA, PRODUCT)
    const cuOnly = rows.filter((a) => a.kinds.length === 1 && a.kinds[0] === 'computer-use')
    const { container } = render(<VendorProcesses arenaId={ARENA} productId={PRODUCT} productName="Mercury" />)
    if (cuOnly.length === 0) {
      expect(container.querySelector('details')).toBeNull()
      return
    }
    const details = container.querySelector('details')!
    expect(details).not.toBeNull()
    expect(details.querySelector('summary')!.textContent).toContain('computer-use-only')
    expect(details.querySelector('summary')!.textContent).toContain(String(cuOnly.length))
    for (const a of cuOnly) {
      const link = container.querySelector(`a[href="/processes/${a.slug}?via=${ARENA}:${PRODUCT}"]`)!
      expect(details.contains(link), `${a.taskId}: computer-use-only name must sit inside the details`).toBe(true)
    }
  })

  it('renders nothing for a product with no appearances', () => {
    const { container } = render(
      <VendorProcesses arenaId="payments" productId="definitely-not-a-product" productName="Nobody" />,
    )
    expect(container.innerHTML).toBe('')
  })
})
