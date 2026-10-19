// Priced-round composer — the YC Post-Money Safe User Guide Appendix II Example 1
// pro-forma replayed END TO END through the one narrative replay, stage by stage: the
// term-sheet economics (fund_002 n1), the closing wires-and-issuance (n7), the post-close
// table (n9), then the composed waterfall and down-round previews. Every closing figure is
// the guide's own number — the same ones capTable.test.ts re-derives function by function;
// here we prove the COMPOSITION reproduces them and that the composer invents no arithmetic
// of its own (composition-equality tests against the underlying modules).

import { describe, expect, it } from 'vitest'
import { buildCapTable, type CapTableEvent, estimateRoundDilution } from '../capTable'
import { downRoundModel } from '../round'
import {
  downRoundPreview, postCloseLiquidityCheck, replayPricedRound, termSheetEconomics,
} from '../roundComposer'

// ABC, Inc. — User Guide Appendix II Example 1. Founders 9,250,000; 300,000 options
// outstanding; 350,000 promised; 100,000 unissued pool → 10,000,000 FD. Investor A:
// $200,000 safe at $4m post (5%). Investor B: $800,000 safe at $8m post (10%), pro rata.
const HISTORY: CapTableEvent[] = [
  { kind: 'found', founders: [{ name: 'Founders', shares: 9_250_000 }], poolShares: 750_000 },
  { kind: 'grant', name: 'Options outstanding', shares: 300_000 },
  { kind: 'grant', name: 'Promised options', shares: 350_000 },
  { kind: 'safe', name: 'Investor A', amount: 200_000, cap: 4_000_000 },
  { kind: 'safe', name: 'Investor B', amount: 800_000, cap: 8_000_000, proRata: true },
]
const ROUND = { name: 'Series A', preMoney: 15_000_000, newMoney: 5_000_000, poolShares: 1_695_000 }

describe('termSheetEconomics (stage: fund_002 n1)', () => {
  it('post-money and the % the new money buys (Quick Start §2)', () => {
    const t = termSheetEconomics({ preMoney: 15_000_000, newMoney: 5_000_000 })
    expect(t.postMoney).toBe(20_000_000)
    expect(t.newInvestorsPct).toBe(25)
    expect(t.needsReview).toBe(true)
  })

  it('replays the Quick Start §3 "Adding it all up" worked example via capTable.estimateRoundDilution', () => {
    // Guide: 15% safes all with pro rata, 25% new money, 10% pool → pro rata 4.41%,
    // round dilution 39.41%, safes end at 9.09%.
    const t = termSheetEconomics({
      preMoney: 15_000_000, newMoney: 5_000_000, safesPct: 15, safesWithProRataPct: 15, poolIncreasePct: 10,
    })
    expect(t.dilution!.proRataPct).toBeCloseTo(4.41, 2)
    expect(t.dilution!.roundDilutionPct).toBeCloseTo(39.41, 2)
    expect(t.dilution!.safesFinalPct).toBeCloseTo(9.09, 2)
    // Composition equality: byte-for-byte the underlying module's own answer.
    expect(t.dilution).toEqual(
      estimateRoundDilution({ safesPct: 15, safesWithProRataPct: 15, newInvestorsPct: 25, poolIncreasePct: 10 }),
    )
  })

  it('rejects non-positive money', () => {
    expect(() => termSheetEconomics({ preMoney: 0, newMoney: 1 })).toThrow(RangeError)
    expect(() => termSheetEconomics({ preMoney: 1, newMoney: 0 })).toThrow(RangeError)
  })
})

describe('replayPricedRound — Appendix II Example 1, stage by stage', () => {
  const replay = replayPricedRound(HISTORY, ROUND)

  it('runs clean and derives the term sheet from the history itself', () => {
    expect(replay.error).toBeUndefined()
    expect(replay.termSheet.postMoney).toBe(20_000_000)
    expect(replay.termSheet.newInvestorsPct).toBe(25)
    // SAFEs on the table: 5% + 10% as-converted, 10% of it holding pro rata.
    expect(replay.termSheet.dilution).toEqual(
      estimateRoundDilution({ safesPct: 15, safesWithProRataPct: 10, newInvestorsPct: 25, poolIncreasePct: 0 }),
    )
  })

  it('closing stage (n7): PPS $1.1144, 4,486,719 cash shares, the guide’s conversions', () => {
    const c = replay.closing!
    expect(c.round.pps).toBe(1.1144)
    expect(c.round.roundShares).toBe(4_486_719)
    expect(c.round.poolIncreaseShares).toBe(1_695_000)
    expect(c.conversions.map((x) => x.shares)).toEqual([588_235, 1_176_470])
    expect(c.conversions.map((x) => x.method)).toEqual(['cap', 'cap'])
  })

  it('closing stage: the wires to verify — new investors + Investor B’s pro rata, nothing for the SAFEs', () => {
    const c = replay.closing!
    // New investors ex pro rata: 4,486,719 − 448,671 = 4,038,048 shares at $1.1144.
    expect(c.wires[0]).toEqual({
      holder: 'Series A — new investors',
      shares: 4_038_048,
      dollars: Math.round(4_038_048 * 1.1144 * 100) / 100,
    })
    // "Investor B's pro rata … for $499,998.96" (448,671 × $1.1144; the guide prints $499,998.97).
    expect(c.wires[1].holder).toBe('Investor B (pro rata)')
    expect(c.wires[1].shares).toBe(448_671)
    expect(c.wires[1].dollars).toBeCloseTo(499_998.97, 0)
    expect(c.wires).toHaveLength(2) // SAFE conversions wire nothing
    // Σ wires lands within one PPS of the $5m new money (floored shares — stated).
    expect(c.wireTotal).toBeLessThanOrEqual(5_000_000)
    expect(c.wireTotal).toBeGreaterThan(5_000_000 - 2 * 1.1144 - 0.02)
  })

  it('post-close stage (n9): the guide’s final table, FD 17,946,424, founders 51.54%, pool 10%', () => {
    const p = replay.postClose!
    expect(p.fullyDilutedShares).toBe(17_946_424)
    const rows = Object.fromEntries(p.rows.map((r) => [r.id, r]))
    expect(rows['safe-Investor B'].shares).toBe(1_625_141) // conversion + pro rata
    expect(rows['safe-Investor A'].shares).toBe(588_235)
    expect(rows['round-Series A'].shares).toBe(4_038_048)
    expect(rows['pool'].shares).toBe(1_795_000)
    expect(rows['founder-Founders'].pct).toBeCloseTo(51.54, 2)
    expect(rows['pool'].pct).toBeCloseTo(10.0, 2)
    // New preferred = cash shares + SAFE conversions (pro rata already inside roundShares):
    expect(p.newPreferredShares).toBe(4_486_719 + 588_235 + 1_176_470)
    // Conversion terms at close: CP = OIP = PPS, ratio 1.0 (antiDilution baseline).
    expect(p.conversionPriceAtClose).toBe(1.1144)
    expect(p.conversionRatioAtClose).toBe(1)
  })

  it('is exactly the cap-table engine’s own fold — no parallel arithmetic', () => {
    const direct = buildCapTable([...HISTORY, { kind: 'priced', ...ROUND }])
    expect(replay.snapshots).toEqual(direct.snapshots)
    expect(replay.postClose!.rows).toEqual(direct.snapshots.at(-1)!.rows)
  })

  it('surfaces engine errors instead of masking them (snapshots preserved)', () => {
    // A grant with no pool fails inside the engine's fold; invalid round money, by
    // contrast, throws up front in termSheetEconomics (fail fast, documented).
    const bad = replayPricedRound(
      [
        { kind: 'found', founders: [{ name: 'F', shares: 1_000_000 }] },
        { kind: 'grant', name: 'Oops', shares: 10 },
      ],
      { name: 'A', preMoney: 4_000_000, newMoney: 1_000_000 },
    )
    expect(bad.error).toBeDefined()
    expect(bad.error!.eventIndex).toBe(1)
    expect(bad.closing).toBeUndefined()
    expect(bad.postClose).toBeUndefined()
    expect(bad.snapshots).toHaveLength(1)
    expect(() => replayPricedRound([], { name: 'A', preMoney: -1, newMoney: 5 })).toThrow(RangeError)
  })

  it('rejects a history that already contains a priced round', () => {
    expect(() =>
      replayPricedRound([...HISTORY, { kind: 'priced', name: 'Seed', preMoney: 8_800_000, newMoney: 2_200_000 }], ROUND),
    ).toThrow(RangeError)
  })
})

describe('postCloseLiquidityCheck — the table just signed, at a sale price', () => {
  const replay = replayPricedRound(HISTORY, ROUND)

  it('preference basis = every dollar actually paid for preferred', () => {
    const check = postCloseLiquidityCheck(replay, 50_000_000)
    // wires (new cash + pro rata) + the two SAFE purchase amounts
    expect(check.preferenceBasis).toBeCloseTo(replay.closing!.wireTotal + 1_000_000, 2)
  })

  it('high sale: everything converts, proceeds sum exactly to the price', () => {
    const check = postCloseLiquidityCheck(replay, 50_000_000)
    const w = check.waterfall
    expect(w.rows.reduce((s, r) => s + r.total, 0)).toBeCloseTo(50_000_000, 2)
    const pref = w.rows.find((r) => r.kind === 'preferred')!
    expect(pref.decision).toBe('convert')
    // As-converted ≈ its share of the residual (pool excluded): preferred holds
    // 6,251,424 of 16,151,424 participating shares.
    expect(pref.total / 50_000_000).toBeCloseTo(6_251_424 / 16_151_424, 4)
    expect(w.unissuedPoolSharesExcluded).toBe(1_795_000)
    expect(check.indifferencePrice).toBeGreaterThan(check.preferenceBasis)
  })

  it('low sale: the series takes its 1x preference instead', () => {
    const check = postCloseLiquidityCheck(replay, 8_000_000)
    const pref = check.waterfall.rows.find((r) => r.kind === 'preferred')!
    expect(pref.decision).toBe('preference')
    expect(pref.total).toBeCloseTo(check.preferenceBasis, 2)
    expect(check.waterfall.rows.reduce((s, r) => s + r.total, 0)).toBeCloseTo(8_000_000, 2)
    expect(check.waterfall.rows.every((r) => r.total >= 0)).toBe(true)
  })

  it('refuses a replay without a closing', () => {
    const bad = replayPricedRound(
      [
        { kind: 'found', founders: [{ name: 'F', shares: 1_000_000 }] },
        { kind: 'grant', name: 'Oops', shares: 10 },
      ],
      { name: 'A', preMoney: 4_000_000, newMoney: 1_000_000 },
    )
    expect(() => postCloseLiquidityCheck(bad, 1_000_000)).toThrow(RangeError)
  })
})

describe('downRoundPreview — the anti-dilution clause quantified on the post-close table', () => {
  const replay = replayPricedRound(HISTORY, ROUND)
  // A $3m down round at $0.50 — well under the $1.1144 conversion price.
  const issuance = { newShares: 6_000_000, considerationDollars: 3_000_000, investorName: 'Series B (down)' }

  it('adjusts the new-money series down, bounded by CP1, and matches round.downRoundModel exactly', () => {
    const preview = downRoundPreview(replay, issuance)
    const adj = preview.adjustments[0]
    expect(adj.seriesName).toBe('Series A — new investors')
    expect(adj.conversionPriceAfter).toBeLessThan(1.1144)
    expect(adj.conversionPriceAfter).toBeGreaterThan(0.5)
    // Composition equality against the underlying module with the same spec.
    const direct = downRoundModel(
      replay.postClose!.rows,
      [{ seriesName: 'Series A — new investors', originalIssuePrice: 1.1144, conversionPriceBefore: 1.1144, basis: 'broad-based' }],
      issuance,
    )
    expect(preview).toEqual(direct)
  })

  it('full ratchet drops the conversion price to the new price exactly', () => {
    const preview = downRoundPreview(replay, issuance, 'full-ratchet')
    expect(preview.adjustments[0].conversionPriceAfter).toBe(0.5)
  })

  it('protects SAFE sub-series only via extraProtected, at their own effective prices', () => {
    const preview = downRoundPreview(replay, issuance, 'broad-based', [
      { seriesName: 'Investor A', originalIssuePrice: 0.34, conversionPriceBefore: 0.34, basis: 'broad-based' },
    ])
    // The $0.50 issuance is ABOVE Investor A's $0.34 conversion price — no adjustment for
    // it, while the $1.1144 new-money series still adjusts.
    expect(preview.adjustments.find((a) => a.seriesName === 'Investor A')!.adjusted).toBe(false)
    expect(preview.adjustments[0].adjusted).toBe(true)
  })
})
