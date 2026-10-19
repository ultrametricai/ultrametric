// Textbook tests for the priced-round mechanics module. Worked examples replayed from the
// cited sources: the YC Post-Money Safe User Guide's Appendix II pro rata arithmetic
// (4,486,719 × 10% = 448,671), and the Springmeyer down-round example end-to-end through
// the anti-dilution composition. Hand-derived arithmetic is shown in comments; invariants
// (percentages sum to 100, secondaries never change fully diluted) are property-tested.

import { describe, expect, it } from 'vitest'
import type { CapTableRow } from '../capTable'
import { poolIncreaseForRoundTarget } from '../capTable'
import {
  downRoundModel,
  founderSecondary,
  hiringPlanPoolIncrease,
  hiringPlanPoolTopUp,
  maintainOwnership,
  poolTargetFromHiringPlan,
  proRataShares,
} from '../round'

describe('pro rata rights (YC User Guide §E / Appendix II)', () => {
  it('replays the Appendix II purchase: 4,486,719 round shares × 10% = 448,671', () => {
    expect(proRataShares(4_486_719, 10)).toBe(448_671)
  })

  it('maintaining ownership = buying your pro rata of the new issuance (x = s·N/F)', () => {
    // s = 1,000,000 of F = 10,000,000 (10%); round N = 2,500,000 at $2.00.
    // x = s·N/F = 250,000 shares; cost $500,000; (1.25M)/(12.5M) = 10% maintained;
    // declining leaves 1M/12.5M = 8%.
    const r = maintainOwnership({ holderShares: 1_000_000, fullyDilutedBefore: 10_000_000, roundShares: 2_500_000, pps: 2 })
    expect(r.pctBefore).toBeCloseTo(10, 10)
    expect(r.sharesNeeded).toBe(250_000)
    expect(r.dollarsNeeded).toBe(500_000)
    expect(r.pctIfExercised).toBeCloseTo(10, 10)
    expect(r.pctIfDeclined).toBeCloseTo(8, 10)
    expect(r.needsReview).toBe(true)
  })

  it('flooring means the maintained percentage can be a hair under (stated convention)', () => {
    const r = maintainOwnership({ holderShares: 1_000_000, fullyDilutedBefore: 9_999_999, roundShares: 333_333, pps: 1 })
    expect(r.sharesNeeded).toBe(proRataShares(333_333, r.pctBefore))
    expect(r.pctIfExercised).toBeLessThanOrEqual(r.pctBefore)
    expect(r.pctIfExercised).toBeGreaterThan(r.pctBefore - 0.001)
  })

  it('rejects malformed inputs', () => {
    expect(() => proRataShares(100, 101)).toThrow(RangeError)
    expect(() => maintainOwnership({ holderShares: 11, fullyDilutedBefore: 10, roundShares: 1, pps: 1 })).toThrow(RangeError)
  })
})

describe('option-pool sizing from a hiring plan (Rewarding Talent approach)', () => {
  const plan = poolTargetFromHiringPlan(
    [
      { role: 'VP Engineering', grantPctOfFullyDiluted: 1.0 },
      { role: 'Senior engineer ×4', grantPctOfFullyDiluted: 1.6 },
      { role: 'Designer', grantPctOfFullyDiluted: 0.4 },
    ],
    1.0,
  )

  it('sums the planned grants plus a stated buffer — never invents a benchmark', () => {
    expect(plan.plannedPct).toBeCloseTo(3.0, 10)
    expect(plan.targetPoolPct).toBeCloseTo(4.0, 10)
    expect(plan.needsReview).toBe(true)
    expect(plan.note).toContain('founder dilution')
  })

  it('tops up outside a round via the cited cap-table pool algebra', () => {
    // Hand derivation of x = (t·FD − unissued)/(1 − t) at t = 10%: FD 9,000,000, unissued
    // 500,000 → (900,000 − 500,000)/0.9 = 444,444.4 → ceil 444,445, and the target is met:
    // (500,000 + 444,445)/(9,000,000 + 444,445) = 10.0000%.
    const tenPct = poolTargetFromHiringPlan([{ role: 'team', grantPctOfFullyDiluted: 8.5 }], 1.5)
    expect(tenPct.targetPoolPct).toBeCloseTo(10, 10)
    const x = hiringPlanPoolTopUp(tenPct, 9_000_000, 500_000)
    expect(x).toBe(444_445)
    expect(((500_000 + x) / (9_000_000 + x)) * 100).toBeGreaterThanOrEqual(10)
  })

  it('inside a round it is exactly the cap-table in-round pool shuffle', () => {
    const tenPct = poolTargetFromHiringPlan([{ role: 'team', grantPctOfFullyDiluted: 10 }])
    const round = { fdPostConversion: 11_764_705, unissued: 0, preMoney: 15_000_000, postMoney: 20_000_000 }
    expect(hiringPlanPoolIncrease(tenPct, round)).toBe(
      poolIncreaseForRoundTarget(round.fdPostConversion, round.unissued, 10, round.preMoney, round.postMoney),
    )
  })

  it('rejects empty plans and unreachable targets', () => {
    expect(() => poolTargetFromHiringPlan([])).toThrow(RangeError)
    expect(() => poolTargetFromHiringPlan([{ role: 'x', grantPctOfFullyDiluted: 99 }], 2)).toThrow(RangeError)
  })
})

describe('down-round model — the Springmeyer example end-to-end', () => {
  // Before: 8M founder/pool shares + 4M Series A preferred (1:1, OIP = CP = $2.00) = 12M.
  const rows: CapTableRow[] = [
    { id: 'founders', name: 'Founders + pool', group: 'founder', shares: 8_000_000, pct: null },
    { id: 'series-a', name: 'Series A', group: 'investor', shares: 4_000_000, pct: null },
  ]
  const seriesA = { seriesName: 'Series A', originalIssuePrice: 2, conversionPriceBefore: 2 }
  const downRound = { newShares: 5_000_000, considerationDollars: 5_000_000, investorName: 'Series B' }

  it('broad-based: CP $2.00 → $1.7059, Series A 4,000,000 → 4,689,606 as-converted', () => {
    const r = downRoundModel(rows, [{ ...seriesA, basis: 'broad-based' }], downRound)
    expect(r.pps).toBe(1)
    expect(r.adjustments[0].conversionPriceAfter).toBe(1.7059)
    expect(r.adjustments[0].asConvertedAfter).toBe(4_689_606)
    // Post-round as-converted FD = 8,000,000 + 4,689,606 + 5,000,000 = 17,689,606.
    expect(r.fullyDilutedAfter).toBe(17_689_606)
    const founders = r.rows.find((x) => x.name === 'Founders + pool')
    const a = r.rows.find((x) => x.name === 'Series A')
    const b = r.rows.find((x) => x.name === 'Series B')
    // Who absorbs the dilution: the unprotected founders fall from 66.67% to
    // 8,000,000/17,689,606 = 45.22%; protected Series A holds 26.51% instead of the
    // unprotected 4,000,000/17,000,000 = 23.53%.
    expect(founders?.pctBefore).toBeCloseTo(66.6667, 3)
    expect(founders?.pctAfter).toBeCloseTo(45.2244, 3)
    expect(a?.pctAfter).toBeCloseTo(26.5106, 3)
    expect(b?.pctAfter).toBeCloseTo(28.265, 3)
    expect(r.rows.reduce((s, x) => s + x.pctAfter, 0)).toBeCloseTo(100, 9)
  })

  it('narrow-based protects more: CP → $1.4444, 5,538,631 shares', () => {
    const r = downRoundModel(rows, [{ ...seriesA, basis: 'narrow-based' }], downRound)
    expect(r.adjustments[0].conversionPriceAfter).toBe(1.4444)
    expect(r.adjustments[0].asConvertedAfter).toBe(5_538_631)
    expect(r.fullyDilutedAfter).toBe(8_000_000 + 5_538_631 + 5_000_000)
  })

  it('with no protected series, the round is plain dilution (12M → 17M, 33.33% → 23.53%)', () => {
    const r = downRoundModel(rows, [], downRound)
    expect(r.fullyDilutedAfter).toBe(17_000_000)
    expect(r.rows.find((x) => x.name === 'Series A')?.pctAfter).toBeCloseTo(23.5294, 3)
  })

  it('the unissued pool stays out of the broad base by default, in by flag', () => {
    const withPool: CapTableRow[] = [...rows, { id: 'pool', name: 'Option pool (unissued)', group: 'pool', shares: 1_000_000, pct: null }]
    const excl = downRoundModel(withPool, [{ ...seriesA, basis: 'broad-based' }], downRound)
    const incl = downRoundModel(withPool, [{ ...seriesA, basis: 'broad-based' }], downRound, { includeUnissuedPoolInBase: true })
    // Excluded: base 12M → $1.7059 (unchanged from the no-pool replay). Included: base 13M
    // → CP2 = 2 × (13M + 2.5M)/(13M + 5M) = 2 × 15.5/18 = 1.7222 — larger base, smaller
    // adjustment.
    expect(excl.adjustments[0].conversionPriceAfter).toBe(1.7059)
    expect(incl.adjustments[0].conversionPriceAfter).toBe(1.7222)
    expect(incl.adjustments[0].conversionPriceAfter).toBeGreaterThan(excl.adjustments[0].conversionPriceAfter)
  })

  it('a pre-adjusted series: as-converted rows feed the base, preferredShares feeds the adjustment', () => {
    // Series A already adjusted once (OIP $2.00, CP before $1.60): its 4,000,000 preferred
    // convert as 5,000,000 shares, so the row carries 5,000,000 (as-converted — module doc
    // comment) and the broad base is 8M + 5M = 13M. The adjustment itself runs on the
    // 4,000,000 PREFERRED shares (NVCA conversion mechanics: as-converted = preferred ×
    // OIP/CP) — feeding the as-converted count in would convert the holding twice.
    // CP2 = 1.6 × (13M + 5M/1.6)/(13M + 5M) = 1.6 × 16,125,000/18,000,000 = $1.4333;
    // as-converted after = floor(4,000,000 × 2/1.4333) = 5,581,525.
    const adjustedRows: CapTableRow[] = [
      { id: 'founders', name: 'Founders + pool', group: 'founder', shares: 8_000_000, pct: null },
      { id: 'series-a', name: 'Series A', group: 'investor', shares: 5_000_000, pct: null },
    ]
    const r = downRoundModel(
      adjustedRows,
      [{ seriesName: 'Series A', originalIssuePrice: 2, conversionPriceBefore: 1.6, preferredShares: 4_000_000, basis: 'broad-based' }],
      downRound,
    )
    expect(r.adjustments[0].conversionPriceAfter).toBe(1.4333)
    expect(r.adjustments[0].asConvertedAfter).toBe(5_581_525)
    expect(r.fullyDilutedAfter).toBe(8_000_000 + 5_581_525 + 5_000_000)
  })

  it('rejects a pre-adjusted spec without preferredShares — the double-conversion trap', () => {
    expect(() =>
      downRoundModel(
        rows,
        [{ seriesName: 'Series A', originalIssuePrice: 2, conversionPriceBefore: 1.6, basis: 'broad-based' }],
        downRound,
      ),
    ).toThrow(/preferredShares/)
  })

  it('rejects a zero-share or zero-dollar issuance even with no protected series (no Infinity price)', () => {
    expect(() =>
      downRoundModel(rows, [], { newShares: 0, considerationDollars: 5_000_000, investorName: 'Series B' }),
    ).toThrow(RangeError)
    expect(() =>
      downRoundModel(rows, [], { newShares: 5_000_000, considerationDollars: 0, investorName: 'Series B' }),
    ).toThrow(RangeError)
  })

  it('rejects unresolved SAFEs (null shares) and unknown series names', () => {
    const withSafe: CapTableRow[] = [...rows, { id: 's', name: 'SAFE (as-converted est.)', group: 'investor', shares: null, pct: 10 }]
    expect(() => downRoundModel(withSafe, [], downRound)).toThrow(/convert SAFEs first/)
    expect(() => downRoundModel(rows, [{ ...seriesA, seriesName: 'Series Z', basis: 'broad-based' }], downRound)).toThrow(
      /no matching row/,
    )
  })
})

describe('founder secondary (Cooley GO glossary, Secondary Sale)', () => {
  const rows: CapTableRow[] = [
    { id: 'f', name: 'Founder', group: 'founder', shares: 8_000_000, pct: null },
    { id: 'a', name: 'Series A', group: 'investor', shares: 4_000_000, pct: null },
  ]

  it('nobody dilutes: fully diluted unchanged, non-party percentages identical', () => {
    const r = founderSecondary(rows, 'Founder', 'New Investor', 1_000_000, 1.5)
    expect(r.fullyDiluted).toBe(12_000_000) // unchanged
    expect(r.sharesTransferred).toBe(1_000_000)
    expect(r.sellerProceeds).toBe(1_500_000) // to the SELLER, never the company
    const founder = r.rows.find((x) => x.name === 'Founder')
    const buyer = r.rows.find((x) => x.name === 'New Investor')
    const a = r.rows.find((x) => x.name === 'Series A')
    expect(founder?.shares).toBe(7_000_000)
    expect(buyer?.shares).toBe(1_000_000)
    expect(a?.pct).toBeCloseTo((4_000_000 / 12_000_000) * 100, 10) // exactly what it was
    expect(r.note).toContain('no dilution')
  })

  it('an existing buyer row just grows', () => {
    const r = founderSecondary(rows, 'Founder', 'Series A', 500_000)
    expect(r.rows.find((x) => x.name === 'Series A')?.shares).toBe(4_500_000)
    expect(r.fullyDiluted).toBe(12_000_000)
  })

  it('rejects overselling, self-dealing, and bad prices', () => {
    expect(() => founderSecondary(rows, 'Founder', 'X', 8_000_001)).toThrow(RangeError)
    expect(() => founderSecondary(rows, 'Founder', 'Founder', 1)).toThrow(RangeError)
    expect(() => founderSecondary(rows, 'Missing', 'X', 1)).toThrow(RangeError)
    expect(() => founderSecondary(rows, 'Founder', 'X', 1, 0)).toThrow(RangeError)
  })

  it('does not mutate the input rows', () => {
    const before = JSON.parse(JSON.stringify(rows))
    founderSecondary(rows, 'Founder', 'New Investor', 1_000_000)
    expect(rows).toEqual(before)
  })

  it('null-share SAFE rows keep their estimate and the table still sums to 100%', () => {
    // A capped-SAFE estimate of 10% scales the concrete rows by the 90% remainder (the
    // cap-table engine's §D.5 snapshot convention): Founder 60%, Series A 30%, SAFE 10%.
    // After the secondary the SAFE keeps its 10%, Series A keeps its 30%, and the seller's
    // 60% splits 52.5% / 7.5% between seller and buyer — total still 100%.
    const withSafe: CapTableRow[] = [
      { id: 'f', name: 'Founder', group: 'founder', shares: 8_000_000, pct: 60 },
      { id: 'a', name: 'Series A', group: 'investor', shares: 4_000_000, pct: 30 },
      { id: 's', name: 'SAFE (as-converted est.)', group: 'investor', shares: null, pct: 10 },
    ]
    const r = founderSecondary(withSafe, 'Founder', 'New Investor', 1_000_000)
    expect(r.rows.find((x) => x.name === 'SAFE (as-converted est.)')?.pct).toBe(10)
    expect(r.rows.find((x) => x.name === 'Series A')?.pct).toBeCloseTo(30, 9)
    expect(r.rows.find((x) => x.name === 'Founder')?.pct).toBeCloseTo(52.5, 9)
    expect(r.rows.find((x) => x.name === 'New Investor')?.pct).toBeCloseTo(7.5, 9)
    expect(r.rows.reduce((s, x) => s + (x.pct ?? 0), 0)).toBeCloseTo(100, 9)
  })
})
