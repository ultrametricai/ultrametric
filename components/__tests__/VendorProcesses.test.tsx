// @vitest-environment jsdom
// Pins for the product page's "Processes this product serves" table (components/
// VendorProcesses.tsx) after the founder's 2026-10-02 declutter: the per-step "via: …" receipts
// line and the visible 'canonical vendor' label are gone (both stay corpus data — the role
// tooltip still explains every kind), and the score column is named for what the number is
// ("Best step fit": the product's highest judged per-step relevance score in the process).
// Renders against the real committed corpus — same data the static pages build from.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import VendorProcesses from '@/components/VendorProcesses'
import { processesForVendor } from '@/lib/vendorProcesses'

// mercury (startup-banking) is the corpus's canonical multi-appearance vendor — step-ranked,
// canonical, and api-calls appearances all exist (see lib/__tests__/vendorProcesses.test.ts).
const ARENA = 'startup-banking'
const PRODUCT = 'mercury'

describe('VendorProcesses — founder 2026-10-02 declutter', () => {
  it('renders the table with process links and scores for a vendor with appearances', () => {
    const { container } = render(<VendorProcesses arenaId={ARENA} productId={PRODUCT} productName="Mercury" />)
    expect(screen.getByText('Processes this product serves')).toBeTruthy()
    const processLinks = [...container.querySelectorAll('a[href^="/processes/"]')]
    expect(processLinks.length).toBeGreaterThan(1)
    // Scores still render as N/100 cells.
    expect(container.textContent).toContain('/100')
  })

  it('the score column is named "Best step fit" and its tooltip explains the number (not "Best step score")', () => {
    render(<VendorProcesses arenaId={ARENA} productId={PRODUCT} productName="Mercury" />)
    const headers = screen.getAllByText('Best step fit')
    expect(headers.length).toBeGreaterThan(0)
    for (const h of headers) {
      // One-clause tooltip since the founder 2026-10-02 sweep — still says the number is the
      // highest judged per-step score, derived from judged verdicts.
      expect(h.getAttribute('title')).toMatch(/Highest judged step score/)
      expect(h.getAttribute('title')).toMatch(/judged verdicts/)
    }
    expect(screen.queryByText('Best step score')).toBeNull()
  })

  it('the per-step "via: …" detail line is gone from every row', () => {
    const { container } = render(<VendorProcesses arenaId={ARENA} productId={PRODUCT} productName="Mercury" />)
    expect(container.textContent).not.toContain('via:')
  })

  it('per-step receipts (founder 2026-10-02 depth): every judged served step on its own line, linked to the process page anchor, score /100', () => {
    const { container } = render(<VendorProcesses arenaId={ARENA} productId={PRODUCT} productName="Mercury" />)
    const rows = processesForVendor(ARENA, PRODUCT)
    const withSteps = rows.filter((a) => a.servedSteps.length > 0)
    expect(withSteps.length).toBeGreaterThan(0)
    for (const a of withSteps) {
      for (const s of a.servedSteps) {
        // One line per served step, the step name deep-linking to its block on the process page.
        const link = container.querySelector(`a[href="/processes/${a.slug}#step-${a.taskId}-${s.nodeId}"]`)
        expect(link, `${a.taskId}/${s.nodeId}: served-step line must link to its process-page anchor`).not.toBeNull()
        expect(link!.textContent).toBe(s.label)
        expect(link!.closest('li')?.textContent).toContain(`${s.score}/100`)
      }
    }
    // Only judged, committed step mappings — appearances with no judged served steps (canonical/
    // api-calls/computer-use-only) get no sub-rows at all.
    const stepLines = container.querySelectorAll('tbody li')
    expect(stepLines.length).toBe(rows.reduce((n, a) => n + a.servedSteps.length, 0))
  })

  it('the "canonical vendor" label never renders, but the role tooltip still explains the canonical kind', () => {
    const { container } = render(<VendorProcesses arenaId={ARENA} productId={PRODUCT} productName="Mercury" />)
    expect(container.textContent).not.toContain('canonical vendor')
    // mercury IS canonical somewhere in the corpus — honesty moves to the tooltip, not deletion.
    const canonicalRow = processesForVendor(ARENA, PRODUCT).find((a) => a.kinds.includes('canonical'))
    expect(canonicalRow).toBeDefined()
    const tooltips = [...container.querySelectorAll('[title^="How this product comes up here"]')]
    expect(tooltips.some((el) => (el.getAttribute('title') ?? '').includes('canonical call target'))).toBe(true)
  })

  it('dropping the canonical label never mislabels a row as a computer-use attempt', () => {
    // The old fallback chain would have claimed '🖥 computer-use attempt' for canonical-only
    // rows once 'canonical vendor' stopped rendering — pin that the attempt line appears at
    // most once per appearance that actually HAS the computer-use kind.
    const rows = processesForVendor(ARENA, PRODUCT)
    const cuRows = rows.filter((a) => a.kinds.includes('computer-use')).length
    const { container } = render(<VendorProcesses arenaId={ARENA} productId={PRODUCT} productName="Mercury" />)
    const attempts = (container.textContent?.match(/computer-use attempt/g) ?? []).length
    expect(attempts).toBeLessThanOrEqual(cuRows)
  })
})
