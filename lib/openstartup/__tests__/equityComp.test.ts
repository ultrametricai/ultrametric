// Textbook tests for the offer / equity-comp scenario module. Conventions cited in the
// module header (Holloway Guide to Equity Compensation; Index Ventures' Rewarding Talent;
// the 409A strike-price floor via open-law/US-FED/us-fed-409a-stock-right-exception.json).
// The worked example is chosen so every number derives by hand:
//   Company: 10,000,000 fully diluted. Offer: 50,000 options at a $0.40 strike (409A FMV).
//   Grant size: 50,000 / 10,000,000 = 0.50%.
//   Exit A ($100M, 20% further dilution): FD_exit = 10,000,000 / 0.8 = 12,500,000
//     PPS = 100,000,000 / 12,500,000 = $8.00; ownership 50,000/12,500,000 = 0.40%
//     gross = 50,000 × 8.00 = $400,000; exercise = 50,000 × 0.40 = $20,000; net = $380,000.
//   Exit B ($100M, no dilution): PPS $10.00 → gross $500,000, net $480,000.
//   Exit C ($3M, no dilution): PPS $0.30 < $0.40 strike → under water, net $0.

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  commonSharePriceAtExit,
  grantExitOutcome,
  grantOwnershipPct,
  offerScenarioTable,
  optionSpread,
  vestedExitOutcome,
  type OfferGrant,
} from '../equityComp'

const GRANT: OfferGrant = { optionShares: 50_000, strikePerShare: 0.4, fullyDilutedShares: 10_000_000 }

describe('the 409A strike-price convention is backed by a committed rule card', () => {
  it('open-law/US-FED holds us-fed.409a-stock-right-exception with primary sources', () => {
    const card = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'open-law/US-FED/us-fed-409a-stock-right-exception.json'), 'utf8'),
    ) as { id: string; kind: string; source_ids: string[] }
    expect(card.id).toBe('us-fed.409a-stock-right-exception')
    expect(card.kind).toBe('legal')
    expect(card.source_ids.length).toBeGreaterThan(0)
  })
})

describe('grantOwnershipPct (the Rewarding Talent sizing convention)', () => {
  it('50,000 of 10,000,000 fully diluted is 0.50%', () => {
    expect(grantOwnershipPct(50_000, 10_000_000)).toBe(0.5)
  })

  it('rejects a zero denominator', () => {
    expect(() => grantOwnershipPct(1, 0)).toThrow(RangeError)
  })
})

describe('commonSharePriceAtExit and optionSpread (Holloway basics)', () => {
  it('divides exit value by fully diluted shares at the 4-decimal price convention', () => {
    expect(commonSharePriceAtExit(100_000_000, 12_500_000)).toBe(8)
    expect(commonSharePriceAtExit(15_000_000, 13_459_705)).toBe(1.1144) // capTable guide figure
  })

  it('spread is shares × max(0, price − strike): never negative', () => {
    expect(optionSpread(50_000, 0.4, 8)).toBe(380_000)
    expect(optionSpread(50_000, 0.4, 0.3)).toBe(0) // under water
    expect(optionSpread(50_000, 0.4, 0.4)).toBe(0) // at the money
  })
})

describe('grantExitOutcome (worked example)', () => {
  it('Exit A: $100M with 20% further dilution → net $380,000 pre-tax', () => {
    const o = grantExitOutcome(GRANT, { label: 'A', exitValuation: 100_000_000, extraDilutionPct: 20 })
    expect(o.fullyDilutedAtExit).toBe(12_500_000)
    expect(o.sharePriceAtExit).toBe(8)
    expect(o.ownershipAtExitPct).toBeCloseTo(0.4, 10) // 0.50% diluted by 20%
    expect(o.grossValue).toBe(400_000)
    expect(o.exerciseCost).toBe(20_000)
    expect(o.netBeforeTax).toBe(380_000)
    // The proxy is honest about itself: preferences and taxes are out of scope.
    expect(o.needsReview).toBe(true)
  })

  it('Exit B: $100M with no further dilution → net $480,000', () => {
    const o = grantExitOutcome(GRANT, { label: 'B', exitValuation: 100_000_000 })
    expect(o.sharePriceAtExit).toBe(10)
    expect(o.netBeforeTax).toBe(480_000)
  })

  it('Exit C: $3M is under water at a $0.40 strike → net $0 (nobody exercises)', () => {
    const o = grantExitOutcome(GRANT, { label: 'C', exitValuation: 3_000_000 })
    expect(o.sharePriceAtExit).toBe(0.3)
    expect(o.grossValue).toBe(15_000)
    expect(o.netBeforeTax).toBe(0)
  })

  it('property: net value is monotone in exit valuation and never negative', () => {
    let prev = -1
    for (const v of [0, 1_000_000, 4_000_000, 10_000_000, 100_000_000, 1_000_000_000]) {
      const o = grantExitOutcome(GRANT, { label: 'p', exitValuation: v, extraDilutionPct: 25 })
      expect(o.netBeforeTax).toBeGreaterThanOrEqual(0)
      expect(o.netBeforeTax).toBeGreaterThanOrEqual(prev)
      prev = o.netBeforeTax
    }
  })

  it('rejects impossible dilution and negative valuations', () => {
    expect(() => grantExitOutcome(GRANT, { label: 'x', exitValuation: 1, extraDilutionPct: 100 })).toThrow(RangeError)
    expect(() => grantExitOutcome(GRANT, { label: 'x', exitValuation: -1 })).toThrow(RangeError)
    expect(() => grantExitOutcome({ ...GRANT, optionShares: 0 }, { label: 'x', exitValuation: 1 })).toThrow(RangeError)
  })
})

describe('offerScenarioTable', () => {
  it('renders the offer conversation across scenarios in order', () => {
    const rows = offerScenarioTable(GRANT, [
      { label: 'downside', exitValuation: 3_000_000 },
      { label: 'base', exitValuation: 100_000_000, extraDilutionPct: 20 },
      { label: 'upside', exitValuation: 1_000_000_000, extraDilutionPct: 33 },
    ])
    expect(rows.map((r) => r.label)).toEqual(['downside', 'base', 'upside'])
    expect(rows[1].netBeforeTax).toBe(380_000)
    // Upside: FD = floor(10,000,000/0.67) = 14,925,373; PPS = round(1e9/14,925,373) = $67.00
    // gross = 50,000 × 67.00 = 3,350,166.50? No — PPS rounds to 4 decimals: 66.9999822 →
    // 67.0000; gross = 3,350,000; net = 3,330,000.
    expect(rows[2].sharePriceAtExit).toBe(67)
    expect(rows[2].netBeforeTax).toBe(3_330_000)
  })
})

describe('vestedExitOutcome (48/12 standard schedule from the cap-table module)', () => {
  it('at month 24, half the grant is vested: net = 25,000 × (8.00 − 0.40) = $190,000', () => {
    const v = vestedExitOutcome(GRANT, { label: 'A', exitValuation: 100_000_000, extraDilutionPct: 20 }, 24)
    expect(v.vestedShares).toBe(25_000)
    expect(v.vestedNetBeforeTax).toBe(190_000)
  })

  it('before the cliff, nothing is vested', () => {
    const v = vestedExitOutcome(GRANT, { label: 'A', exitValuation: 100_000_000 }, 11)
    expect(v.vestedShares).toBe(0)
    expect(v.vestedNetBeforeTax).toBe(0)
  })

  it('under water, vested or not, the pre-tax value is zero', () => {
    const v = vestedExitOutcome(GRANT, { label: 'C', exitValuation: 3_000_000 }, 48)
    expect(v.vestedShares).toBe(50_000)
    expect(v.vestedNetBeforeTax).toBe(0)
  })
})
