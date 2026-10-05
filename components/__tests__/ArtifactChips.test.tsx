// @vitest-environment jsdom
// The Produces header row on /processes/[slug] (founder depth wave part 2, 2026-10-01): the
// typed artifact layer rendered as house chips. The 'Needs:' row no longer renders (founder
// 2026-10-02 — display only: artifactChipRows still serializes the requires side untouched).
// Produces chips on the producer's own page stay unlinked, and a documented exception
// producer's chip points back at the canonical page (the LLC page's EIN → Get EIN).
import { render, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ArtifactChips from '@/components/ArtifactChips'
import { artifactChipRows } from '@/lib/processDeps'
import { loadProcesses } from '@/lib/processes'

const tasks = loadProcesses()
const byId = new Map(tasks.map((t) => [t.id, t]))

describe('ArtifactChips', () => {
  it("never renders the 'Needs:' row (founder 2026-10-02) — the requires DATA still rides in the rows prop untouched", () => {
    const task = byId.get('form_002')!
    const rows = artifactChipRows(task)
    // The underlying typed layer is intact — this is a display-only removal.
    expect(rows.needs.length).toBeGreaterThan(0)
    const { container } = render(<ArtifactChips rows={rows} />)
    expect(within(container).queryByText('Needs:')).toBeNull()
    // No chip from the needs side leaks in: Get EIN requires the Certificate of Incorporation.
    expect(within(container).queryByText('Certificate of Incorporation')).toBeNull()
  })

  it('renders the Produces chip unlinked on the canonical producer page itself', () => {
    const task = byId.get('form_002')!
    const { container } = render(<ArtifactChips rows={artifactChipRows(task)} />)
    expect(within(container).getByText('Produces:')).toBeTruthy()
    const ein = within(container).getByText('EIN')
    expect(ein.closest('a')).toBeNull()
    expect(ein.getAttribute('title')).toContain('Produced right here')
  })

  it('links a documented exception producer back to the canonical page (LLC page EIN → Get EIN)', () => {
    const llc = byId.get('form_011')!
    const { container } = render(<ArtifactChips rows={artifactChipRows(llc)} />)
    const ein = within(container).getByText('EIN')
    expect(ein.closest('a')?.getAttribute('href')).toBe('/processes/get-ein')
  })

  it('renders nothing for a process that produces no registry artifact — even when it still NEEDS some', () => {
    const empty = tasks.find((t) => t.requires.length === 0 && t.produces.length === 0)
    expect(empty, 'corpus honesty: some processes genuinely have no registry I/O').toBeTruthy()
    const { container } = render(<ArtifactChips rows={artifactChipRows(empty!)} />)
    expect(container.innerHTML).toBe('')
    // Produces-only gate: a consumer-only process (requires without produces) renders nothing.
    const consumerOnly = tasks.find((t) => t.requires.length > 0 && t.produces.length === 0)
    expect(consumerOnly, 'corpus honesty: some processes only consume artifacts').toBeTruthy()
    const consumer = render(<ArtifactChips rows={artifactChipRows(consumerOnly!)} />)
    expect(consumer.container.innerHTML).toBe('')
  })
})
