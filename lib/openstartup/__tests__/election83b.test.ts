// Textbook tests for the 83(b) money-math module. Duties: (1) every ruleId in
// ELECTION_83B_RULE_IDS resolves to a committed, jurisdiction-matched card in open-law/US-FED/
// with primary sources; (2) ALL SIX published examples of Rev. Proc. 2012-29 § 5 are
// replayed number-for-number (the IRS's own 25,000-share fact pattern); (3) the rate
// arithmetic is re-derived by hand in comments. deadlines.ts owns the 30-day clock — the
// window itself is deliberately absent here.

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  ELECTION_83B_RULE_IDS,
  FORFEITURE_RISK_STATEMENT,
  compare83bScenario,
  earlyExercise83b,
  forfeitureAfterElection,
  scenarioTax83b,
} from '../election83b'

function loadRuleCard(jurisdiction: string, ruleId: string) {
  const dir = path.join(process.cwd(), 'open-law', jurisdiction)
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const card = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as {
      id: string
      kind: string
      jurisdiction: string
      source_ids: string[]
    }
    if (card.id === ruleId) return card
  }
  return null
}

describe('every computation resolves to a committed, jurisdiction-matched rule card', () => {
  for (const [name, ref] of Object.entries(ELECTION_83B_RULE_IDS)) {
    it(`${name} → ${ref.ruleId}`, () => {
      const card = loadRuleCard(ref.jurisdiction, ref.ruleId)
      expect(card, `open-law/${ref.jurisdiction} must contain a card with id ${ref.ruleId}`).not.toBeNull()
      expect(card?.jurisdiction).toBe(ref.jurisdiction)
      expect(card?.kind).toBe('legal')
      expect(card?.source_ids.length).toBeGreaterThan(0)
    })
  }
})

// Rev. Proc. 2012-29 § 5, the IRS's own fact pattern: 25,000 substantially nonvested
// shares transferred 2012-04-01, vesting 2014-04-01 when FMV is $40,000 ($1.60/share),
// sold in 2015 for $60,000 ($2.40/share).
const PAID_FACTS = { shares: 25_000, pricePaidPerShare: 1, fmvAtTransferPerShare: 1 } // Examples 1-3: E pays $25,000
const FREE_FACTS = { shares: 25_000, pricePaidPerShare: 0, fmvAtTransferPerShare: 1 } // Examples 4-6: F pays $0
const VESTING = [{ label: 'vest 2014-04-01', shares: 25_000, fmvPerShare: 1.6 }]

describe('compare83bScenario replays Rev. Proc. 2012-29 Examples 1, 2, 4, 5', () => {
  it('Example 1 (election, $25,000 paid at $25,000 FMV): $0 income now, nothing at vesting, basis $25,000', () => {
    const cmp = compare83bScenario(PAID_FACTS, VESTING)
    expect(cmp.withElection.incomeAtTransfer).toBe(0)
    expect(cmp.withElection.incomeAtVesting).toBe(0)
    expect(cmp.withElection.basis).toBe(25_000)
    expect(cmp.withElection.holdingPeriodBegins).toBe('transfer')
    expect(cmp.zeroSpreadAtTransfer).toBe(true) // the why-founders-file case
  })

  it('Example 2 (no election): $15,000 compensation at vesting ($40,000 − $25,000), basis $40,000', () => {
    const cmp = compare83bScenario(PAID_FACTS, VESTING)
    expect(cmp.withoutElection.incomeAtTransfer).toBe(0)
    expect(cmp.withoutElection.incomeAtVesting).toBe(15_000)
    expect(cmp.withoutElection.basis).toBe(40_000)
    expect(cmp.withoutElection.holdingPeriodBegins).toBe('each vesting event')
  })

  it('Example 4 (election, $0 paid): $25,000 compensation at transfer, basis $25,000', () => {
    const cmp = compare83bScenario(FREE_FACTS, VESTING)
    expect(cmp.withElection.incomeAtTransfer).toBe(25_000)
    expect(cmp.withElection.basis).toBe(25_000)
    expect(cmp.zeroSpreadAtTransfer).toBe(false)
  })

  it('Example 5 ($0 paid, no election): $40,000 compensation at vesting, basis $40,000', () => {
    const cmp = compare83bScenario(FREE_FACTS, VESTING)
    expect(cmp.withoutElection.incomeAtVesting).toBe(40_000)
    expect(cmp.withoutElection.basis).toBe(40_000)
  })

  it('carries the cited forfeiture risk statement and demands review', () => {
    const cmp = compare83bScenario(PAID_FACTS, VESTING)
    expect(cmp.riskStatement).toBe(FORFEITURE_RISK_STATEMENT)
    expect(cmp.needsReview).toBe(true)
    expect(cmp.ruleIds).toContain('us-fed.83b-scenario-arithmetic')
    expect(cmp.ruleIds).toContain('us-fed.restricted-property-holding-period')
  })

  it('an empty vesting scenario: without-election income and basis stay 0 until something vests', () => {
    const cmp = compare83bScenario(PAID_FACTS, [])
    expect(cmp.withoutElection.incomeAtVesting).toBe(0)
    expect(cmp.withoutElection.basis).toBe(0)
    expect(cmp.withElection.basis).toBe(25_000)
  })

  it('rejects a vesting scenario larger than the transfer', () => {
    expect(() => compare83bScenario(PAID_FACTS, [{ label: 'x', shares: 25_001, fmvPerShare: 1 }])).toThrow(RangeError)
  })
})

describe('scenarioTax83b replays the Examples\' sale arithmetic ($60,000 sale in 2015)', () => {
  it('Examples 1 vs 2: capital gain $35,000 with the election vs $15,000 ordinary + $20,000 gain without', () => {
    const s = scenarioTax83b({
      facts: PAID_FACTS,
      vestingScenario: VESTING,
      salePricePerShare: 2.4,
      ordinaryRate: 0.37,
      capitalGainsRate: 0.2,
    })
    expect(s.withElection.capitalGain).toBe(35_000) // $60,000 − $25,000 basis (Example 1)
    expect(s.withoutElection.capitalGain).toBe(20_000) // $60,000 − $40,000 basis (Example 2)
    // Hand-derived at the hypothetical rates: with = 0.2 x 35,000 = $7,000;
    // without = 0.37 x 15,000 + 0.2 x 20,000 = 5,550 + 4,000 = $9,550; savings $2,550.
    expect(s.withElection.totalTax).toBe(7000)
    expect(s.withoutElection.totalTax).toBe(9550)
    expect(s.electionSavings).toBe(2550)
  })

  it('Examples 4 vs 5: gain $35,000 with vs $20,000 without, after $25,000 vs $40,000 ordinary', () => {
    const s = scenarioTax83b({
      facts: FREE_FACTS,
      vestingScenario: VESTING,
      salePricePerShare: 2.4,
      ordinaryRate: 0.37,
      capitalGainsRate: 0.2,
    })
    // With: 0.37 x 25,000 + 0.2 x 35,000 = 9,250 + 7,000 = 16,250.
    // Without: 0.37 x 40,000 + 0.2 x 20,000 = 14,800 + 4,000 = 18,800.
    expect(s.withElection.capitalGain).toBe(35_000)
    expect(s.withoutElection.capitalGain).toBe(20_000)
    expect(s.withElection.totalTax).toBe(16_250)
    expect(s.withoutElection.totalTax).toBe(18_800)
    expect(s.electionSavings).toBe(2550)
  })

  it('a falling trajectory can make the election LOSE — the arithmetic is honest both ways', () => {
    // FMV falls to $0.50 at vesting, sale at $0.50: with election nothing was included
    // (zero spread) but basis stays $25,000 -> $12,500 capital LOSS (tax 0 here, losses
    // not netted); without election: income at vesting $0 (FMV < paid, floored), basis
    // $25,000... Hand-derived: without: income 0, basis = 25,000 + 0 = 25,000 -> same
    // loss. Election savings 0 in this shape.
    const s = scenarioTax83b({
      facts: PAID_FACTS,
      vestingScenario: [{ label: 'vest', shares: 25_000, fmvPerShare: 0.5 }],
      salePricePerShare: 0.5,
      ordinaryRate: 0.37,
      capitalGainsRate: 0.2,
    })
    expect(s.withElection.capitalGain).toBe(-12_500)
    expect(s.withElection.totalTax).toBe(0)
    expect(s.electionSavings).toBe(0)
  })

  it('rejects rates outside [0, 1]', () => {
    expect(() =>
      scenarioTax83b({ facts: PAID_FACTS, vestingScenario: VESTING, salePricePerShare: 1, ordinaryRate: 37, capitalGainsRate: 0.2 }),
    ).toThrow(RangeError)
  })

  it('rejects a partial vesting scenario — the two paths would sell unequal share counts', () => {
    // With only 10,000 of 25,000 shares vested, the with-election path would sell all
    // 25,000 while the without-election path can sell only the vested 10,000 — the
    // electionSavings comparison would mix sale quantities, so the scenario is rejected.
    expect(() =>
      scenarioTax83b({
        facts: PAID_FACTS,
        vestingScenario: [{ label: 'cliff', shares: 10_000, fmvPerShare: 1.6 }],
        salePricePerShare: 2.4,
        ordinaryRate: 0.37,
        capitalGainsRate: 0.2,
      }),
    ).toThrow(/vest all/)
  })
})

describe('forfeitureAfterElection replays Examples 3 and 6', () => {
  it('Example 3: repurchase at the $25,000 purchase price → $0 gain, nothing to deduct', () => {
    const f = forfeitureAfterElection({ shares: 25_000, pricePaidPerShare: 1, fmvAtTransferPerShare: 1, repurchasePricePerShare: 1 })
    expect(f.amountRealized).toBe(25_000)
    expect(f.gainOrLoss).toBe(0)
    expect(f.unrecoveredInclusion).toBe(0) // zero spread was included
    expect(f.note).toContain('no deduction')
  })

  it('Example 6: $0-paid shares forfeited for nothing → no loss, and the $25,000 inclusion is never recovered', () => {
    const f = forfeitureAfterElection({ shares: 25_000, pricePaidPerShare: 0, fmvAtTransferPerShare: 1, repurchasePricePerShare: 0 })
    expect(f.amountRealized).toBe(0)
    expect(f.gainOrLoss).toBe(0) // loss limited to amount paid (0) over amount realized (0)
    expect(f.unrecoveredInclusion).toBe(25_000)
  })

  it('a repurchase above the elected basis is a gain measured against basis, with the inclusion still unrecovered', () => {
    // Paid $1/share, FMV $2 at transfer (inclusion $25,000), repurchased at $3/share:
    // basis $50,000, realized $75,000 → gain $25,000; the $25,000 inclusion is separate.
    const f = forfeitureAfterElection({ shares: 25_000, pricePaidPerShare: 1, fmvAtTransferPerShare: 2, repurchasePricePerShare: 3 })
    expect(f.gainOrLoss).toBe(25_000)
    expect(f.unrecoveredInclusion).toBe(25_000)
  })

  it('loss is capped at amount paid minus amount realized (§ 1.83-2(a))', () => {
    // Paid $25,000, repurchased for $10,000: loss = $15,000 — not basis-based.
    const f = forfeitureAfterElection({ shares: 25_000, pricePaidPerShare: 1, fmvAtTransferPerShare: 2, repurchasePricePerShare: 0.4 })
    expect(f.gainOrLoss).toBe(-15_000)
    expect(f.unrecoveredInclusion).toBe(25_000) // the $1 spread x 25,000, never recovered
  })
})

describe('earlyExercise83b (equity-lane flag consumed as input)', () => {
  it('zero-spread early exercise: $0 locked in for both NSO income and ISO AMT inclusion', () => {
    const r = earlyExercise83b({ earlyExercised: true, shares: 10_000, strikePerShare: 0.4, fmvAtExercisePerShare: 0.4 })
    expect(r.nsoIncomeWithElection).toBe(0)
    expect(r.isoAmtInclusionWithElection).toBe(0)
    expect(r.ruleIds).toContain('us-fed.iso-amt-adjustment')
    expect(r.note).toContain('deadlines.election83bWindow')
  })

  it('a positive spread is locked at exercise, not repriced at vesting', () => {
    const r = earlyExercise83b({ earlyExercised: true, shares: 10_000, strikePerShare: 0.4, fmvAtExercisePerShare: 1 })
    expect(r.nsoIncomeWithElection).toBe(6000)
  })

  it('refuses to run without the equity lane reporting an actual early exercise', () => {
    expect(() => earlyExercise83b({ earlyExercised: false, shares: 100, strikePerShare: 1, fmvAtExercisePerShare: 1 })).toThrow(
      /earlyExercised: true/,
    )
  })
})
