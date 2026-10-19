// Textbook tests for the cap-table engine. Every formula is exercised against the worked
// examples published in the YC Post-Money Safe User Guide (PDF linked from
// https://www.ycombinator.com/documents) — Quick Start Guide, Q&A §B/§D/§E, and the
// Appendix II pro-forma cap tables — with the arithmetic re-derived in comments so a
// reader can follow every number. Share counts follow the engine's documented convention
// (floor to whole shares, prices to 4 decimals), which reproduces the guide's printed
// figures exactly in both Appendix II scenarios we replay.

import { describe, expect, it } from 'vitest'
import {
  buildCapTable,
  estimateRoundDilution,
  floorShares,
  maxSafesPctWithProRata,
  poolIncreaseForRoundTarget,
  poolIncreaseForTarget,
  reportToCsv,
  reportToMarkdown,
  roundPrice,
  safeOwnershipPct,
  safeProRataAllocationPct,
  vestedShares,
  type CapTableEvent,
} from '../capTable'

// ---------------------------------------------------------------------------
// Rounding primitives
// ---------------------------------------------------------------------------

describe('rounding conventions', () => {
  it('floors share counts (you cannot issue a fractional share)', () => {
    expect(floorShares(588235.25)).toBe(588235) // guide: 11,764,705 × 5%
    expect(floorShares(1176470.5)).toBe(1176470) // guide: 11,764,705 × 10%
    expect(floorShares(4486719.31)).toBe(4486719) // guide: $5,000,000 / $1.1144
    expect(floorShares(448671.9)).toBe(448671) // guide: 4,486,719 × 10% pro rata
  })

  it('absorbs float noise below a whole-share boundary', () => {
    expect(floorShares(588236 - 1e-9)).toBe(588236)
  })

  it('rounds prices to 4 decimals, guide style ($1.1144, $0.6577)', () => {
    expect(roundPrice(15_000_000 / 13_459_705)).toBe(1.1144)
    expect(roundPrice(8_800_000 / 13_379_693)).toBe(0.6577)
  })
})

// ---------------------------------------------------------------------------
// Vesting — Cooley GO: monthly over 4 years with a 1-year cliff
// ---------------------------------------------------------------------------

describe('vestedShares', () => {
  const standard = { totalMonths: 48, cliffMonths: 12 }

  it('vests nothing before the cliff', () => {
    expect(vestedShares(4_800_000, standard, 0)).toBe(0)
    expect(vestedShares(4_800_000, standard, 11)).toBe(0)
  })

  it('vests exactly 25% at a 12-month cliff on a 48-month schedule', () => {
    // 4,800,000 × 12/48 = 1,200,000
    expect(vestedShares(4_800_000, standard, 12)).toBe(1_200_000)
  })

  it('then vests monthly: one extra 1/48 tranche per month', () => {
    expect(vestedShares(4_800_000, standard, 13)).toBe(1_300_000)
    expect(vestedShares(4_800_000, standard, 24)).toBe(2_400_000) // halfway
    expect(vestedShares(4_800_000, standard, 47)).toBe(4_700_000)
  })

  it('is fully vested at and beyond totalMonths', () => {
    expect(vestedShares(4_800_000, standard, 48)).toBe(4_800_000)
    expect(vestedShares(4_800_000, standard, 60)).toBe(4_800_000)
  })

  it('floors fractional tranches to whole shares', () => {
    // 1,000,000 × 13/48 = 270,833.33 → 270,833
    expect(vestedShares(1_000_000, standard, 13)).toBe(270_833)
  })

  it('rejects invalid schedules and amounts', () => {
    expect(() => vestedShares(-1, standard, 12)).toThrow(RangeError)
    expect(() => vestedShares(100, { totalMonths: 0, cliffMonths: 0 }, 1)).toThrow(RangeError)
    expect(() => vestedShares(100, { totalMonths: 12, cliffMonths: 24 }, 1)).toThrow(RangeError)
  })
})

// ---------------------------------------------------------------------------
// SAFE ownership — User Guide Quick Start §1–2
// ---------------------------------------------------------------------------

describe('safeOwnershipPct (Quick Start §1–2)', () => {
  it('replays Quick Start §1: $1M target at 15% → $6.7M post-money cap', () => {
    // "$500k, then the ownership sold would be 0.5/6.7 = ~7.5%"
    expect(safeOwnershipPct(500_000, 6_700_000)).toBeCloseTo(7.46, 1)
    // "$800k … 0.8/6.7 = ~12%"
    expect(safeOwnershipPct(800_000, 6_700_000)).toBeCloseTo(11.94, 1)
    // "$1 million … 1/6.7 = ~15%"
    expect(safeOwnershipPct(1_000_000, 6_700_000)).toBeCloseTo(14.93, 1)
  })

  it('replays Quick Start §2: multiple caps simply add', () => {
    // "$500k / $5.5 million = ~9%" and "$500k / $8.3 million = ~6%" → she sold ~15%
    const a = safeOwnershipPct(500_000, 5_500_000)
    const b = safeOwnershipPct(500_000, 8_300_000)
    expect(a).toBeCloseTo(9.09, 2)
    expect(b).toBeCloseTo(6.02, 2)
    expect(a + b).toBeCloseTo(15.12, 1)
  })

  it('replays §D.2: raising the whole cap sells 100%', () => {
    // "$500k / $5 million = 10%" … "$2.5 million / $5 million = 50%" … "$5m / $5m = 100%"
    expect(safeOwnershipPct(500_000, 5_000_000)).toBe(10)
    expect(safeOwnershipPct(2_500_000, 5_000_000)).toBe(50)
    expect(safeOwnershipPct(5_000_000, 5_000_000)).toBe(100)
  })

  it('rejects nonsense', () => {
    expect(() => safeOwnershipPct(1, 0)).toThrow(RangeError)
    expect(() => safeOwnershipPct(-1, 100)).toThrow(RangeError)
  })
})

// ---------------------------------------------------------------------------
// Pro rata — User Guide Quick Start §3 and §E.3
// ---------------------------------------------------------------------------

describe('pro rata formulas', () => {
  it('replays the Quick Start §3 allocation formula', () => {
    // "Safe Pro Rata Allocation % = SeriesANewInvestors% / (100% − SafesWithProRata%)
    //  − SeriesANewInvestors%" → 25/(100−15)% − 25 = 29.41 − 25 = 4.41
    expect(safeProRataAllocationPct(25, 15)).toBeCloseTo(4.41, 2)
  })

  it('replays the full "Adding it all up" dilution table', () => {
    // Guide inputs: safes 15% (all with pro rata), new investors 25%, pool increase 10%.
    const est = estimateRoundDilution({
      safesPct: 15,
      safesWithProRataPct: 15,
      newInvestorsPct: 25,
      poolIncreasePct: 10,
    })
    // "Series A New Investors + Safes with pro rata: 25% + 4.41% = 29.41%"
    // "Series A dilution: 29.41% investments + 10% option pool = 39.41%"
    expect(est.proRataPct).toBeCloseTo(4.41, 2)
    expect(est.roundDilutionPct).toBeCloseTo(39.41, 2)
    // "Safe dilution: 15% × (100% − 39.41%) = 9.09%"
    expect(est.safesFinalPct).toBeCloseTo(9.09, 2)
  })

  it('replays §E.3: backsolving the pro rata budget', () => {
    // "raising 20% on safes, Series A new investors 25%, total round 28% → limit is
    //  100% − (25%/28%) = 10.7%. …about half of the safes, i.e. safes representing ~10%."
    expect(maxSafesPctWithProRata(25, 28)).toBeCloseTo(10.71, 1)
  })
})

// ---------------------------------------------------------------------------
// Option pool math
// ---------------------------------------------------------------------------

describe('option pool sizing', () => {
  it('standalone top-up hits the post-increase target exactly (never under)', () => {
    // (0 + x)/(10,000,000 + x) = 10% → x = 1,000,000/0.9 = 1,111,111.1 → ceil 1,111,112
    const x = poolIncreaseForTarget(10_000_000, 0, 10)
    expect(x).toBe(1_111_112)
    expect((x / (10_000_000 + x)) * 100).toBeGreaterThanOrEqual(10)
    // Already at target → no increase
    expect(poolIncreaseForTarget(10_000_000, 1_500_000, 10)).toBe(0)
  })

  it('in-round pool shuffle matches Appendix II Example 1 inputs', () => {
    // Guide: FD post conversion 11,764,705, existing unissued 100,000, target 10% of
    // post-close, pre $15m / post $20m. Exact minimum:
    //   k = 0.10 × 20/15 = 2/15; P = (k×11,764,705 − 100,000)/(1−k) = 22,029,410/13
    //     = exactly 1,694,570 → the pool lands at exactly 10.0000% post-close:
    //   (100,000 + 1,694,570) / ((11,764,705 + 1,694,570) × 20/15) = 1,794,570/17,945,700
    // The guide hand-rounds the same quantity to 1,695,000 — we compute the exact value.
    const p = poolIncreaseForRoundTarget(11_764_705, 100_000, 10, 15_000_000, 20_000_000)
    expect(p).toBe(1_694_570)
    expect(Math.abs(p - 1_695_000)).toBeLessThan(500)
  })

  it('rejects unreachable targets', () => {
    expect(() => poolIncreaseForRoundTarget(10_000_000, 0, 80, 10_000_000, 20_000_000)).toThrow(RangeError)
    expect(() => poolIncreaseForTarget(10_000_000, 0, 100)).toThrow(RangeError)
  })
})

// ---------------------------------------------------------------------------
// Appendix II, Example 1 — the canonical post-money worked example, end to end
// ---------------------------------------------------------------------------

// ABC, Inc. before the round: Founders 9,250,000 common; 300,000 options outstanding;
// 350,000 promised options; 100,000 unissued pool → 10,000,000 fully diluted.
// Investor A: $200,000 safe at $4m post-money cap (5%). Investor B: $800,000 safe at
// $8m post-money cap (10%), with the pro rata side letter.
function abcIncEvents(priced: Extract<CapTableEvent, { kind: 'priced' }>): CapTableEvent[] {
  return [
    { kind: 'found', founders: [{ name: 'Founders', shares: 9_250_000 }], poolShares: 750_000 },
    { kind: 'grant', name: 'Options outstanding', shares: 300_000 },
    { kind: 'grant', name: 'Promised options', shares: 350_000 },
    { kind: 'safe', name: 'Investor A', amount: 200_000, cap: 4_000_000 },
    { kind: 'safe', name: 'Investor B', amount: 800_000, cap: 8_000_000, proRata: true },
    priced,
  ]
}

describe('Appendix II Example 1 — $5m Series A at $15m pre ($20m post)', () => {
  const report = buildCapTable(
    abcIncEvents({
      kind: 'priced',
      name: 'Series A',
      preMoney: 15_000_000,
      newMoney: 5_000_000,
      poolShares: 1_695_000, // the guide's stated option pool increase
    }),
  )
  const final = report.snapshots[report.snapshots.length - 1]
  const round = final.round!

  it('runs without error', () => {
    expect(report.error).toBeUndefined()
    expect(round).toBeDefined()
  })

  it('estimates 15% sold before the round (5% + 10%), shown as-converted', () => {
    // Post-safe snapshot: founders 92.5% × (100% − 15%) = 78.62% — the guide's
    // post-conversion fully-diluted figure for Founders.
    const afterSafes = report.snapshots[4]
    const founders = afterSafes.rows.find((r) => r.id === 'founder-Founders')!
    expect(founders.pct).toBeCloseTo(78.62, 1)
    const safeB = afterSafes.rows.find((r) => r.id === 'safe-Investor B')!
    expect(safeB.pct).toBeCloseTo(10, 5)
    expect(safeB.shares).toBeNull()
  })

  it('converts both safes at their caps via the shared Company Capitalization', () => {
    // CC = 10,000,000 / (100% − 15%) = 11,764,705 (guide). Then:
    //   Investor A = 11,764,705 × 5%  = 588,235 shares
    //   Investor B = 11,764,705 × 10% = 1,176,470 shares
    const [a, b] = round.conversions
    expect(a.method).toBe('cap')
    expect(a.shares).toBe(588_235)
    expect(b.method).toBe('cap')
    expect(b.shares).toBe(1_176_470)
  })

  it('reproduces the guide’s effective per-share prices ($0.3400 / $0.6800)', () => {
    // $200,000 / 588,235 = $0.34 and $800,000 / 1,176,470 = $0.68 — the Safe Preferred
    // "conversion price" column in the guide's sub-series comparison table.
    expect(round.conversions[0].effectivePrice).toBeCloseTo(0.34, 4)
    expect(round.conversions[1].effectivePrice).toBeCloseTo(0.68, 4)
  })

  it('prices the round at $1.1144 (pre ÷ (post-conversion FD + pool increase))', () => {
    // $15,000,000 / (11,764,705 + 1,695,000) = $1.1144
    expect(round.pps).toBe(1.1144)
    // "The Company will sell 4,486,719 shares ($5,000,000 / $1.1144)"
    expect(round.roundShares).toBe(4_486_719)
  })

  it('carves Investor B’s pro rata out of the round (10% of the new shares)', () => {
    // "Investor B's pro rata = 4,486,719 × 10% = 448,671 shares … for $499,998.97"
    const b = round.conversions[1]
    expect(b.postConversionPct).toBeCloseTo(10, 4) // 1,176,470 / 11,764,705
    expect(b.proRataShares).toBe(448_671)
    expect(b.proRataCost!).toBeCloseTo(499_998.97, 0) // 448,671 × $1.1144 = $499,998.96
    // Investor A has no side letter
    expect(round.conversions[0].proRataShares).toBeUndefined()
  })

  it('matches the guide’s final cap table', () => {
    const rows = Object.fromEntries(final.rows.map((r) => [r.id, r]))
    // Investor B holds conversion + pro rata: 1,176,470 + 448,671 = 1,625,141 (guide)
    expect(rows['safe-Investor B'].shares).toBe(1_625_141)
    expect(rows['safe-Investor A'].shares).toBe(588_235)
    // New investors ex-pro-rata: 4,486,719 − 448,671 = 4,038,048
    // (the guide splits this as lead 3,589,375 + other new investors 448,673)
    expect(rows['round-Series A'].shares).toBe(4_038_048)
    // Pool: 100,000 existing + 1,695,000 increase = 1,795,000 → 10.00% of fully diluted
    expect(rows['pool'].shares).toBe(1_795_000)
    // Total fully diluted 17,946,424 (guide's final table)
    expect(final.fullyDilutedShares).toBe(17_946_424)
    // Founders end at 51.54% fully diluted (guide): 9,250,000 / 17,946,424
    expect(rows['founder-Founders'].pct).toBeCloseTo(51.54, 2)
    expect(rows['pool'].pct).toBeCloseTo(10.0, 2)
  })

  it('ownership sums to 100% after every event', () => {
    for (const snap of report.snapshots) {
      const total = snap.rows.reduce((s, r) => s + (r.pct ?? 0), 0)
      expect(total).toBeCloseTo(100, 6)
    }
  })
})

// ---------------------------------------------------------------------------
// Appendix II, Example 1 Q5 — low-valuation round: mixed cap / PPS conversion
// ---------------------------------------------------------------------------

describe('Appendix II Example 1 Q5 — $2.2m Series Seed at $8.8m pre ($11m post)', () => {
  const report = buildCapTable(
    abcIncEvents({
      kind: 'priced',
      name: 'Series Seed',
      preMoney: 8_800_000,
      newMoney: 2_200_000,
      poolShares: 1_573_000, // the guide's stated pool increase for this scenario
    }),
  )
  const round = report.snapshots[report.snapshots.length - 1].round!

  it('prices the round at $0.6577', () => {
    expect(report.error).toBeUndefined()
    expect(round.pps).toBe(0.6577)
  })

  it('Investor B beats its cap at the round price (guide: “(1) Series Seed PPS” wins)', () => {
    // At-cap the safe would get ~1,176,703 shares; at the round price it gets
    // $800,000 / $0.6577 = 1,216,360.04 → 1,216,360 — the guide's exact figure.
    const b = round.conversions[1]
    expect(b.method).toBe('pps')
    expect(b.shares).toBe(1_216_360)
    // "In this scenario, Investor B's safe converted into 10.3% ownership versus the 10%
    //  implied by its $8m post-money valuation cap."
    expect(b.postConversionPct).toBeCloseTo(10.3, 1)
  })

  it('Investor A still converts at its cap, with B’s actual shares in the denominator', () => {
    // Guide: CC = (10,000,000 + Investor B's shares) / (100% − 5%) = 11,806,694, and
    // Investor A = CC × 5% = 590,334 shares of Series Seed-1 Preferred.
    const a = round.conversions[0]
    expect(a.method).toBe('cap')
    expect(a.shares).toBe(590_334)
  })
})

// ---------------------------------------------------------------------------
// Discount and cap-and-discount safes — Appendix I
// ---------------------------------------------------------------------------

describe('discount safes (Appendix I §1–2)', () => {
  // Constructed example (arithmetic below): 10,000,000 FD pre-round, one $500,000
  // discount-only safe at 20% (Discount Rate 80%), $3m round at $12m pre, no pool change.
  // Fixed point: PPS = $12,000,000/(10,000,000+s) rounds to $1.1375 at s = 549,450;
  // Discount Price = $1.1375 × 80% = $0.9100; s = floor($500,000/$0.9100) = 549,450 ✓
  const events: CapTableEvent[] = [
    { kind: 'found', founders: [{ name: 'F', shares: 9_000_000 }], poolShares: 1_000_000 },
    { kind: 'safe', name: 'Angel', amount: 500_000, discountPct: 20 },
    { kind: 'priced', name: 'Series A', preMoney: 12_000_000, newMoney: 3_000_000 },
  ]
  const round = buildCapTable(events).snapshots.at(-1)!.round!

  it('converts at the Discount Price (PPS × Discount Rate)', () => {
    const c = round.conversions[0]
    expect(round.pps).toBe(1.1375)
    expect(c.method).toBe('discount')
    expect(c.appliedDiscountPct).toBe(20)
    expect(c.shares).toBe(549_450)
    // and that beats converting at the round PPS: floor($500,000/$1.1375) = 439,560
    expect(c.shares).toBeGreaterThan(439_560)
    // effective price = $500,000 / 549,450 = $0.9100 (the 20%-discounted PPS)
    expect(c.effectivePrice).toBeCloseTo(0.91, 3)
  })

  it('cap-and-discount: the cap wins at a high valuation', () => {
    // $200k at $4m cap (5%) + 20% discount; $10m round at $40m pre. Cap-based:
    // CC = 10,000,000/0.95 = 10,526,315 → 526,315 shares. PPS ≈ $3.80 → at-PPS 52,631,
    // discounted $3.04 → 65,789. The cap is ~8× better.
    const r = buildCapTable([
      { kind: 'found', founders: [{ name: 'F', shares: 10_000_000 }] },
      { kind: 'safe', name: 'Seed', amount: 200_000, cap: 4_000_000, discountPct: 20 },
      { kind: 'priced', name: 'Series A', preMoney: 40_000_000, newMoney: 10_000_000 },
    ]).snapshots.at(-1)!.round!
    expect(r.conversions[0].method).toBe('cap')
    expect(r.conversions[0].shares).toBe(526_315)
    expect(r.conversions[0].appliedCap).toBe(4_000_000)
  })

  it('cap-and-discount: the discount wins at a low valuation', () => {
    // Same safe, $1m round at $4m pre: cap-based still 526,315 but the discount now
    // yields more — "whichever calculation is most advantageous to the investor."
    const r = buildCapTable([
      { kind: 'found', founders: [{ name: 'F', shares: 10_000_000 }] },
      { kind: 'safe', name: 'Seed', amount: 200_000, cap: 4_000_000, discountPct: 20 },
      { kind: 'priced', name: 'Series A', preMoney: 4_000_000, newMoney: 1_000_000 },
    ]).snapshots.at(-1)!.round!
    expect(r.conversions[0].method).toBe('discount')
    expect(r.conversions[0].shares).toBeGreaterThan(526_315)
  })
})

// ---------------------------------------------------------------------------
// MFN — Appendix I §3
// ---------------------------------------------------------------------------

describe('MFN safes (Appendix I §3)', () => {
  it('adopts the full term set of a more favorable LATER safe', () => {
    // MFN $100k issued first; later safe $400k at $4m cap. At a rich Series A the MFN
    // elects the $4m cap (ownership 100k/4m = 2.5%). Simultaneous solve (own 2.5% + 10%):
    //   s_mfn = 100,000,000/350 = 285,714 and s_later = 1,142,857
    // (equivalently CC = 10,000,000/0.875 = 11,428,571; 2.5% and 10% of it).
    const r = buildCapTable([
      { kind: 'found', founders: [{ name: 'F', shares: 10_000_000 }] },
      { kind: 'safe', name: 'MFN angel', amount: 100_000, mfn: true },
      { kind: 'safe', name: 'Seed lead', amount: 400_000, cap: 4_000_000 },
      { kind: 'priced', name: 'Series A', preMoney: 40_000_000, newMoney: 10_000_000 },
    ]).snapshots.at(-1)!.round!
    const mfn = r.conversions[0]
    expect(mfn.method).toBe('cap')
    expect(mfn.appliedCap).toBe(4_000_000)
    expect(mfn.mfnAdoptedFrom).toBe('Seed lead')
    expect(mfn.shares).toBe(285_714)
    expect(r.conversions[1].shares).toBe(1_142_857)
  })

  it('does not adopt terms from EARLIER safes, and falls back to the round PPS', () => {
    // The MFN provision covers safes the company subsequently issues. With only an
    // earlier capped safe, the MFN converts like uncapped/no-discount: at the round PPS
    // ("the investor receives the same shares of preferred stock as the new money
    // investors … at the same price").
    const r = buildCapTable([
      { kind: 'found', founders: [{ name: 'F', shares: 10_000_000 }] },
      { kind: 'safe', name: 'Seed lead', amount: 400_000, cap: 4_000_000 },
      { kind: 'safe', name: 'MFN angel', amount: 100_000, mfn: true },
      { kind: 'priced', name: 'Series A', preMoney: 40_000_000, newMoney: 10_000_000 },
    ]).snapshots.at(-1)!.round!
    const mfn = r.conversions[1]
    expect(mfn.method).toBe('pps')
    expect(mfn.mfnAdoptedFrom).toBeUndefined()
    expect(mfn.shares).toBe(floorShares(100_000 / r.pps))
  })
})

// ---------------------------------------------------------------------------
// Event validation and error reporting
// ---------------------------------------------------------------------------

describe('buildCapTable validation', () => {
  it('reports the failing event and keeps earlier snapshots', () => {
    const r = buildCapTable([
      { kind: 'found', founders: [{ name: 'F', shares: 1_000_000 }] },
      { kind: 'grant', name: 'CTO', shares: 500_000 }, // no pool exists
    ])
    expect(r.snapshots).toHaveLength(1)
    expect(r.error?.eventIndex).toBe(1)
    expect(r.error?.message).toMatch(/pool/)
  })

  it('rejects founding twice, empty founders, and safes before founding', () => {
    expect(
      buildCapTable([
        { kind: 'found', founders: [{ name: 'F', shares: 1 }] },
        { kind: 'found', founders: [{ name: 'G', shares: 1 }] },
      ]).error?.eventIndex,
    ).toBe(1)
    expect(buildCapTable([{ kind: 'found', founders: [] }]).error?.eventIndex).toBe(0)
    expect(buildCapTable([{ kind: 'safe', name: 'S', amount: 1, cap: 10 }]).error?.eventIndex).toBe(0)
  })

  it('rejects a safe whose amount reaches its post-money cap (100%+ sold)', () => {
    const r = buildCapTable([
      { kind: 'found', founders: [{ name: 'F', shares: 1_000_000 }] },
      { kind: 'safe', name: 'S', amount: 5_000_000, cap: 5_000_000 },
    ])
    expect(r.error?.eventIndex).toBe(1)
  })

  it('rejects safes that cumulatively sell 100% (§D.2 negative-founder guard)', () => {
    const r = buildCapTable([
      { kind: 'found', founders: [{ name: 'F', shares: 1_000_000 }] },
      { kind: 'safe', name: 'S1', amount: 3_000_000, cap: 5_000_000 }, // 60%
      { kind: 'safe', name: 'S2', amount: 2_500_000, cap: 5_000_000 }, // +50% = 110%
    ])
    expect(r.error?.eventIndex).toBe(2)
  })

  it('rejects uncapped/discount SAFEs whose price-route claims reach the pre-money (no conversion price exists)', () => {
    // $5m uncapped SAFE on a $4m pre-money: price-route conversion shares live inside the
    // pre-money fully diluted, so the claim exceeds 100% of it — without the guard the
    // fixed-point sweep settles on a 4-decimal rounding artifact instead of erroring.
    const r = buildCapTable([
      { kind: 'found', founders: [{ name: 'F', shares: 10_000_000 }] },
      { kind: 'safe', name: 'Big', amount: 5_000_000 },
      { kind: 'priced', name: 'A', preMoney: 4_000_000, newMoney: 1_000_000 },
    ])
    expect(r.error?.eventIndex).toBe(2)
    // A discount-only SAFE is grossed up: $1m at 20% claims $1.25m of a $1.2m pre-money.
    const d = buildCapTable([
      { kind: 'found', founders: [{ name: 'F', shares: 10_000_000 }] },
      { kind: 'safe', name: 'D', amount: 1_000_000, discountPct: 20 },
      { kind: 'priced', name: 'A', preMoney: 1_200_000, newMoney: 1_000_000 },
    ])
    expect(d.error?.eventIndex).toBe(2)
    // Under the pre-money the same SAFE still converts normally.
    const ok = buildCapTable([
      { kind: 'found', founders: [{ name: 'F', shares: 10_000_000 }] },
      { kind: 'safe', name: 'D', amount: 1_000_000, discountPct: 20 },
      { kind: 'priced', name: 'A', preMoney: 12_000_000, newMoney: 1_000_000 },
    ])
    expect(ok.error).toBeUndefined()
  })

  it('a CAPPED SAFE is held to the same pre-money feasibility guard (the price route is always on its menu)', () => {
    // $6m on a $100m post-money cap sells only 6% — the §D.2 capped guard passes — but the
    // SAFE still converts at the MOST advantageous route, and its price-route claim ($6m)
    // exceeds the $5m pre-money: no conversion price exists, so the round must be refused
    // instead of settling on a rounding artifact.
    const r = buildCapTable([
      { kind: 'found', founders: [{ name: 'F', shares: 10_000_000 }] },
      { kind: 'safe', name: 'Big', amount: 6_000_000, cap: 100_000_000 },
      { kind: 'priced', name: 'A', preMoney: 5_000_000, newMoney: 1_000_000 },
    ])
    expect(r.error?.eventIndex).toBe(2)
    expect(r.error?.message).toMatch(/pre-money/)
    // The same SAFE under a sufficient pre-money converts normally (at its cap route).
    const ok = buildCapTable([
      { kind: 'found', founders: [{ name: 'F', shares: 10_000_000 }] },
      { kind: 'safe', name: 'Big', amount: 6_000_000, cap: 100_000_000 },
      { kind: 'priced', name: 'A', preMoney: 50_000_000, newMoney: 10_000_000 },
    ])
    expect(ok.error).toBeUndefined()
  })

  it('grants cannot exceed the unissued pool; grants do not change fully diluted', () => {
    const ok = buildCapTable([
      { kind: 'found', founders: [{ name: 'F', shares: 9_000_000 }], poolShares: 1_000_000 },
      { kind: 'grant', name: 'Team', shares: 400_000 },
    ])
    expect(ok.error).toBeUndefined()
    expect(ok.snapshots.at(-1)!.fullyDilutedShares).toBe(10_000_000)
    const bad = buildCapTable([
      { kind: 'found', founders: [{ name: 'F', shares: 9_000_000 }], poolShares: 1_000_000 },
      { kind: 'grant', name: 'Team', shares: 1_000_001 },
    ])
    expect(bad.error?.eventIndex).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Property tests — ownership always sums to 100%, no negative shares, over a seeded
// pseudo-random space of event lists
// ---------------------------------------------------------------------------

describe('properties over randomized scenarios', () => {
  // Deterministic LCG so failures are reproducible.
  function lcg(seed: number): () => number {
    let s = seed >>> 0
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0
      return s / 2 ** 32
    }
  }

  it('every valid snapshot sums to 100% with no negative rows (60 seeded cases)', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const rng = lcg(seed * 2654435761)
      const events: CapTableEvent[] = [
        {
          kind: 'found',
          founders: [
            { name: 'A', shares: 1_000_000 + Math.floor(rng() * 9_000_000) },
            { name: 'B', shares: 1_000_000 + Math.floor(rng() * 9_000_000) },
          ],
          poolShares: Math.floor(rng() * 2_000_000),
        },
      ]
      const nSafes = 1 + Math.floor(rng() * 4)
      for (let i = 0; i < nSafes; i++) {
        const style = rng()
        events.push({
          kind: 'safe',
          name: `S${i}`,
          amount: 50_000 + Math.floor(rng() * 950_000),
          cap: style < 0.7 ? 3_000_000 + Math.floor(rng() * 17_000_000) : undefined,
          discountPct: style >= 0.4 && style < 0.9 ? 5 + Math.floor(rng() * 30) : undefined,
          mfn: style >= 0.9 || undefined,
          proRata: rng() < 0.3 || undefined,
        })
      }
      events.push({
        kind: 'priced',
        name: 'Round',
        preMoney: 5_000_000 + Math.floor(rng() * 45_000_000),
        newMoney: 1_000_000 + Math.floor(rng() * 9_000_000),
        poolTargetPct: rng() < 0.7 ? Math.floor(rng() * 15) : undefined,
      })

      const report = buildCapTable(events)
      // Cumulative cap ownership can exceed 100% by construction; then the reported
      // error IS the correct behavior. Otherwise every snapshot must be conservative.
      if (report.error) continue
      for (const snap of report.snapshots) {
        let pctSum = 0
        let anyUnknown = false
        for (const row of snap.rows) {
          if (row.shares !== null) {
            expect(row.shares).toBeGreaterThanOrEqual(0)
            expect(Number.isInteger(row.shares)).toBe(true)
          }
          if (row.pct === null) anyUnknown = true
          else pctSum += row.pct
        }
        // Uncapped safes have indeterminate ownership pre-round; the known rows then
        // sum to ≤ 100. Otherwise the table must sum to exactly 100.
        if (anyUnknown) expect(pctSum).toBeLessThanOrEqual(100 + 1e-6)
        else expect(pctSum).toBeCloseTo(100, 6)
      }
      const round = report.snapshots.at(-1)!.round!
      expect(round.pps).toBeGreaterThan(0)
      for (const c of round.conversions) {
        expect(c.shares).toBeGreaterThanOrEqual(0)
        // A capped safe never converts below its cap-implied share count.
        if (c.appliedCap) expect(c.method).toBe('cap')
      }
    }
  })

  it('pool target is met after a target-based priced round', () => {
    const report = buildCapTable(
      abcIncEvents({
        kind: 'priced',
        name: 'Series A',
        preMoney: 15_000_000,
        newMoney: 5_000_000,
        poolTargetPct: 10,
      }),
    )
    const final = report.snapshots.at(-1)!
    const pool = final.rows.find((r) => r.id === 'pool')!
    expect(pool.pct!).toBeGreaterThanOrEqual(10 - 0.01)
    expect(pool.pct!).toBeLessThan(10.2)
    // Exact minimum computed for the guide's inputs (guide hand-rounds to 1,695,000):
    expect(final.round!.poolIncreaseShares).toBe(1_694_570)
  })
})

// ---------------------------------------------------------------------------
// CSV / markdown exports
// ---------------------------------------------------------------------------

describe('exports', () => {
  const report = buildCapTable([
    { kind: 'found', founders: [{ name: 'Ada, PhD', shares: 8_000_000 }], poolShares: 2_000_000 },
    { kind: 'safe', name: 'Angel', amount: 500_000, cap: 5_000_000 },
  ])

  it('CSV has a header, quotes commas, and one line per row of the final snapshot', () => {
    const csv = reportToCsv(report)
    const lines = csv.trimEnd().split('\n')
    expect(lines[0]).toBe('holder,group,shares,ownership_pct')
    expect(lines).toHaveLength(1 + report.snapshots.at(-1)!.rows.length)
    expect(csv).toContain('"Ada, PhD"')
    expect(reportToCsv({ snapshots: [] })).toBe('holder,group,shares,ownership_pct\n')
  })

  it('markdown renders every snapshot and carries the disclaimer + source', () => {
    const md = reportToMarkdown(report)
    expect(md).toContain('## Founding')
    expect(md).toContain('## SAFE: Angel')
    expect(md).toContain('educational, not legal advice')
    expect(md).toContain('ycombinator.com/documents')
    expect(md).toContain('| Ada, PhD |')
  })
})
