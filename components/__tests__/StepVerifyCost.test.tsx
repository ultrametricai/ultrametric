// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { costChipText, StepCostChip } from '@/components/StepVerifyCost'
import type { StepCost } from '@/lib/processes'

// Depth wave part 1 display: the muted cost chip whose face carries the number and its as-of
// date — the honesty contract rendered, not just stored. (The '✓ verify:' line left the step
// blocks — founder 2026-10-07; verify stays corpus data.)

const DE_FEE: StepCost = {
  usd: 109,
  kind: 'government-fee',
  source: 'https://corpfiles.delaware.gov/Fee_Schedule/AugustFee2026.pdf',
  asOf: '2026-10-01',
  note: 'Minimum — varies based on stock.',
}

describe('StepCostChip', () => {
  it('shows the fee with its kind and as-of date on the chip face, linked to the source', () => {
    const { getByRole } = render(<StepCostChip cost={DE_FEE} />)
    const chip = getByRole('link')
    expect(chip.textContent).toBe('$109 government fee · as of 2026-10-01')
    expect(chip.getAttribute('href')).toBe(DE_FEE.source)
    // Tooltip carries the honesty contract: where the number was read, when, and the caveat.
    expect(chip.getAttribute('title')).toContain('corpfiles.delaware.gov')
    expect(chip.getAttribute('title')).toContain('2026-10-01')
    expect(chip.getAttribute('title')).toContain('varies based on stock')
  })

  it("spells free as 'free' and a usd-null entry as 'cost varies' — never a guessed number", () => {
    expect(
      costChipText({ usd: 0, kind: 'free', source: 'https://www.irs.gov/x', asOf: '2026-10-01' }),
    ).toBe('free · as of 2026-10-01')
    expect(
      costChipText({ usd: null, kind: 'typical-vendor-price', source: 'https://www.uspto.gov/x', asOf: '2026-10-01' }),
    ).toBe('cost varies · as of 2026-10-01')
  })
})
