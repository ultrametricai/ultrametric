// Textbook tests for the ISO/NSO exercise tax-mechanics module. Duties (the
// deadlines-module pattern): (1) every ruleId in OPTION_TAX_RULE_IDS resolves to a
// committed, jurisdiction-matched card in open-law/US-FED/ with primary sources; (2) the
// published worked examples are replayed number-for-number — Treas. Reg. § 1.422-4(d)
// Examples 1-3 for the $100,000 limit, and Rev. Proc. 2024-40 § 2.11's complete-phaseout
// amounts as the arithmetic check on the AMT exemption phaseout; (3) the remaining
// arithmetic is re-derived by hand in comments against the cited statutory rules.

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  AMT_PARAMS_2025,
  ISO_ANNUAL_LIMIT,
  OPTION_TAX_RULE_IDS,
  SUPPLEMENTAL_WITHHOLDING_2026,
  amtExposureIllustration,
  iso100kAttribution,
  isoDisposition,
  isoExerciseOutcome,
  nsoExerciseIncome,
  supplementalWithholdingIllustration,
} from '../optionTax'

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
  for (const [name, ref] of Object.entries(OPTION_TAX_RULE_IDS)) {
    it(`${name} → ${ref.ruleId}`, () => {
      const card = loadRuleCard(ref.jurisdiction, ref.ruleId)
      expect(card, `open-law/${ref.jurisdiction} must contain a card with id ${ref.ruleId}`).not.toBeNull()
      expect(card?.jurisdiction).toBe(ref.jurisdiction)
      expect(card?.kind).toBe('legal')
      expect(card?.source_ids.length).toBeGreaterThan(0)
    })
  }
})

describe('nsoExerciseIncome (rule us-fed.nso-spread-ordinary-income)', () => {
  it('spread at exercise is ordinary income; basis = cost + income (Pub 525)', () => {
    // 1,000 shares x ($5 FMV − $1 strike) = $4,000; basis = $1,000 + $4,000 = $5,000.
    const r = nsoExerciseIncome({ shares: 1000, strikePerShare: 1, fmvPerShare: 5 })
    expect(r.ordinaryIncome).toBe(4000)
    expect(r.exerciseCost).toBe(1000)
    expect(r.basisAfterExercise).toBe(5000)
    expect(r.needsReview).toBe(true)
  })

  it('an amount paid for the option itself reduces the inclusion', () => {
    expect(nsoExerciseIncome({ shares: 1000, strikePerShare: 1, fmvPerShare: 5, amountPaidForOption: 500 }).ordinaryIncome).toBe(3500)
  })

  it('under water floors at 0 and refuses a missing FMV', () => {
    expect(nsoExerciseIncome({ shares: 100, strikePerShare: 5, fmvPerShare: 1 }).ordinaryIncome).toBe(0)
    expect(() => nsoExerciseIncome({ shares: 100, strikePerShare: 1, fmvPerShare: 0 })).toThrow(/never computed here/)
  })
})

describe('supplementalWithholdingIllustration (rule us-fed.supplemental-wage-withholding-2026)', () => {
  it('22% optional flat rate below the $1M cumulative threshold', () => {
    const r = supplementalWithholdingIllustration(100_000)
    expect(r.withholding).toBe(22_000)
    expect(r.mandatoryRatePortion).toBe(0)
    expect(r.kind).toBe('illustration')
  })

  it('a payment straddling $1M splits 22% / 37% on the right pieces', () => {
    // $950k already paid: $50k of this payment stays at 22% ($11,000); the $150k excess
    // over $1,000,000 is at the mandatory 37% ($55,500). Total $66,500.
    const r = supplementalWithholdingIllustration(200_000, 950_000)
    expect(r.flatRatePortion).toBe(11_000)
    expect(r.mandatoryRatePortion).toBe(55_500)
    expect(r.withholding).toBe(66_500)
  })

  it('entirely over the threshold: all 37%', () => {
    expect(supplementalWithholdingIllustration(100_000, 2_000_000).withholding).toBe(37_000)
  })

  it('the published 2026 parameters are the defaults, asOf-dated', () => {
    expect(SUPPLEMENTAL_WITHHOLDING_2026.optionalFlatRate).toBe(0.22)
    expect(SUPPLEMENTAL_WITHHOLDING_2026.mandatoryRateOverThreshold).toBe(0.37)
    expect(SUPPLEMENTAL_WITHHOLDING_2026.mandatoryThreshold).toBe(1_000_000)
    expect(SUPPLEMENTAL_WITHHOLDING_2026.asOf).toBe('2026-10-01')
  })
})

describe('isoExerciseOutcome (rules us-fed.iso-exercise-no-regular-income, us-fed.iso-amt-adjustment)', () => {
  it('no regular-tax income; the spread is the AMT inclusion; dual basis', () => {
    // 10,000 shares x ($4 − $0.40) = $36,000 spread; regular basis $4,000; AMT basis $40,000.
    const r = isoExerciseOutcome({ shares: 10_000, strikePerShare: 0.4, fmvPerShare: 4 })
    expect(r.regularTaxIncome).toBe(0)
    expect(r.amtIncomeAdjustment).toBe(36_000)
    expect(r.regularTaxBasis).toBe(4000)
    expect(r.amtBasis).toBe(40_000)
    expect(r.ruleIds).toContain('us-fed.iso-amt-adjustment')
  })

  it("the equity lane's early-exercise flag defers the AMT inclusion (§ 83 timing)", () => {
    const r = isoExerciseOutcome({ shares: 10_000, strikePerShare: 0.4, fmvPerShare: 4, substantiallyVestedAtExercise: false })
    expect(r.amtIncomeAdjustment).toBeNull()
    expect(r.amtBasis).toBeNull()
    expect(r.note).toContain('83(b)')
  })
})

describe('iso100kAttribution (rule us-fed.iso-100k-limit, Treas. Reg. § 1.422-4(d))', () => {
  it('Example 1: $100,000 first exercisable each year, every year — all ISO', () => {
    const grants = Array.from({ length: 10 }, (_, i) => ({
      id: `g${2004 + i}`,
      grantDate: `${2004 + i}-01-02`,
      grantDateFmvPerShare: 10,
      firstExercisable: [{ year: 2004 + i, shares: 10_000 }], // 10,000 x $10 = $100,000
    }))
    const r = iso100kAttribution(grants)
    for (const slice of r.slices) {
      expect(slice.nsoShares).toBe(0)
      expect(slice.isoValue).toBe(ISO_ANNUAL_LIMIT)
    }
    expect(Object.values(r.remainingByYear)).toEqual(Array.from({ length: 10 }, () => 0))
  })

  it('Example 2: $100,000 (April) + $75,000 (December) both first exercisable in 2004 — the later grant is entirely nonstatutory', () => {
    const r = iso100kAttribution([
      { id: 'y-corp', grantDate: '2004-04-01', grantDateFmvPerShare: 1, firstExercisable: [{ year: 2004, shares: 100_000 }] },
      { id: 'z-corp', grantDate: '2004-12-31', grantDateFmvPerShare: 1, firstExercisable: [{ year: 2004, shares: 75_000 }] },
    ])
    const y = r.slices.find((s) => s.grantId === 'y-corp')
    const z = r.slices.find((s) => s.grantId === 'z-corp')
    expect(y).toMatchObject({ isoValue: 100_000, nsoValue: 0 })
    expect(z).toMatchObject({ isoValue: 0, nsoValue: 75_000 })
  })

  it('Example 3: acceleration pulls $150,000 into 2004 — $60,000 ISO, then $40,000/$10,000 bifurcation, then $40,000 nonstatutory, in grant order', () => {
    // Option 1 (April, $60,000), Option 2 (May, $50,000, accelerated into 2004 — the
    // acceleration is already reflected in the firstExercisable input per the module
    // contract), Option 3 (June, $40,000). $10 grant-date FMV per share throughout.
    const r = iso100kAttribution([
      { id: 'opt3', grantDate: '2004-06-01', grantDateFmvPerShare: 10, firstExercisable: [{ year: 2004, shares: 4000 }] },
      { id: 'opt1', grantDate: '2004-04-01', grantDateFmvPerShare: 10, firstExercisable: [{ year: 2004, shares: 6000 }] },
      { id: 'opt2', grantDate: '2004-05-01', grantDateFmvPerShare: 10, firstExercisable: [{ year: 2004, shares: 5000 }] },
    ])
    // Input order deliberately shuffled: § 422(d)(2) sorts by grant date.
    expect(r.slices.map((s) => s.grantId)).toEqual(['opt1', 'opt2', 'opt3'])
    expect(r.slices[0]).toMatchObject({ isoValue: 60_000, nsoValue: 0 })
    expect(r.slices[1]).toMatchObject({ isoValue: 40_000, nsoValue: 10_000, isoShares: 4000, nsoShares: 1000 })
    expect(r.slices[2]).toMatchObject({ isoValue: 0, nsoValue: 40_000 })
    expect(r.remainingByYear[2004]).toBe(0)
  })

  it('a fractional boundary share falls to the NSO side (documented conservative split)', () => {
    // $100,000 budget / $3 per share = 33,333.33 shares -> 33,333 ISO shares ($99,999),
    // the straddling share is NSO.
    const r = iso100kAttribution([
      { id: 'g', grantDate: '2026-01-15', grantDateFmvPerShare: 3, firstExercisable: [{ year: 2026, shares: 40_000 }] },
    ])
    expect(r.slices[0].isoShares).toBe(33_333)
    expect(r.slices[0].isoValue).toBe(99_999)
    expect(r.slices[0].nsoShares).toBe(6667)
  })

  it('attribution is per calendar year: the budget resets', () => {
    const r = iso100kAttribution([
      {
        id: 'g',
        grantDate: '2026-01-15',
        grantDateFmvPerShare: 10,
        firstExercisable: [
          { year: 2026, shares: 12_000 }, // $120,000 -> $100k ISO / $20k NSO
          { year: 2027, shares: 8000 }, // $80,000 -> all ISO
        ],
      },
    ])
    expect(r.slices.find((s) => s.year === 2026)).toMatchObject({ isoValue: 100_000, nsoValue: 20_000 })
    expect(r.slices.find((s) => s.year === 2027)).toMatchObject({ isoValue: 80_000, nsoValue: 0 })
    expect(r.remainingByYear[2027]).toBe(20_000)
  })
})

describe('isoDisposition (rule us-fed.iso-holding-periods-disqualifying)', () => {
  const BASE = {
    grantDate: '2024-01-10',
    exerciseDate: '2025-02-01',
    shares: 1000,
    strikePerShare: 1,
    fmvAtExercisePerShare: 5,
  }

  it('qualifying (after both anniversaries): everything over cost is capital gain', () => {
    // 2y from grant = 2026-01-10; 1y from exercise = 2026-02-01. Sale 2026-06-01 for $7,000:
    // ordinary 0; capital gain $7,000 − $1,000 = $6,000.
    const r = isoDisposition({ ...BASE, dispositionDate: '2026-06-01', amountRealized: 7000 })
    expect(r.kind).toBe('qualifying')
    expect(r.ordinaryIncome).toBe(0)
    expect(r.capitalGainOrLoss).toBe(6000)
    expect(r.holdingPeriodEnds).toEqual({ twoYearsFromGrant: '2026-01-10', oneYearFromExercise: '2026-02-01' })
  })

  it('disqualifying at a gain: the full exercise spread is ordinary; remainder capital (§ 421(b))', () => {
    // Sale 2025-12-01 (inside both periods) for $7,000: spread = 1,000 x $4 = $4,000
    // ordinary; basis $1,000 + $4,000 = $5,000; capital gain $2,000.
    const r = isoDisposition({ ...BASE, dispositionDate: '2025-12-01', amountRealized: 7000 })
    expect(r.kind).toBe('disqualifying')
    expect(r.ordinaryIncome).toBe(4000)
    expect(r.regularTaxBasis).toBe(5000)
    expect(r.capitalGainOrLoss).toBe(2000)
  })

  it('disqualifying sale below exercise-date FMV: § 422(c)(2) caps ordinary income at amount realized − cost', () => {
    // Sale for $3,000 < $5,000 FMV-at-exercise value: ordinary = min($4,000, $3,000 − $1,000)
    // = $2,000; basis $3,000; capital 0.
    const r = isoDisposition({ ...BASE, dispositionDate: '2025-12-01', amountRealized: 3000 })
    expect(r.ordinaryIncome).toBe(2000)
    expect(r.capitalGainOrLoss).toBe(0)
    expect(r.note).toContain('422(c)(2)')
  })

  it('disqualifying sale below cost: ordinary income floors at 0, the rest is capital loss', () => {
    const r = isoDisposition({ ...BASE, dispositionDate: '2025-12-01', amountRealized: 800 })
    expect(r.ordinaryIncome).toBe(0)
    expect(r.capitalGainOrLoss).toBe(-200)
  })

  it('§ 422(c)(2) is NOT applied when the loss would not be recognized (wash/related-party)', () => {
    const r = isoDisposition({ ...BASE, dispositionDate: '2025-12-01', amountRealized: 3000, lossWouldBeRecognized: false })
    expect(r.ordinaryIncome).toBe(4000) // full spread
  })

  it('an exact-anniversary disposition is treated as disqualifying and flagged as a boundary', () => {
    const r = isoDisposition({ ...BASE, dispositionDate: '2026-02-01', amountRealized: 7000 })
    expect(r.kind).toBe('disqualifying')
    expect(r.anniversaryBoundary).toBe(true)
    expect(r.note).toContain('day-counting')
  })
})

describe('amtExposureIllustration (rules us-fed.iso-amt-adjustment, us-fed.amt-exemption-2025)', () => {
  it("replays Rev. Proc. 2024-40's complete-phaseout amounts: threshold + exemption / 0.25", () => {
    // Published complete-phaseout AMTI (the exemption hits exactly 0 there):
    const published: Record<string, number> = {
      joint: 1_800_700,
      single: 978_750,
      marriedFilingSeparately: 900_350,
      estateOrTrust: 225_300,
    }
    for (const [status, completeAt] of Object.entries(published) as [keyof typeof AMT_PARAMS_2025.byStatus, number][]) {
      const s = AMT_PARAMS_2025.byStatus[status]
      expect(s.phaseoutThreshold + s.exemption / AMT_PARAMS_2025.phaseoutRate).toBe(completeAt)
      const r = amtExposureIllustration({ amtiExcludingIso: completeAt, isoSpread: 0, filingStatus: status })
      expect(r.exemptionAfterPhaseout).toBe(0)
    }
  })

  it('below the threshold the full exemption applies; 26% up to the breakpoint', () => {
    // Single, AMTI $200,000 + $0 spread: exemption $88,100; taxable excess $111,900;
    // TMT = 26% x 111,900 = $29,094.
    const r = amtExposureIllustration({ amtiExcludingIso: 200_000, isoSpread: 0, filingStatus: 'single' })
    expect(r.exemptionAfterPhaseout).toBe(88_100)
    expect(r.taxableExcess).toBe(111_900)
    expect(r.tentativeMinimumTax).toBe(29_094)
  })

  it('a large ISO spread phases out the exemption and crosses into the 28% bracket', () => {
    // Single, $150,000 base + $600,000 spread = $750,000 AMTI.
    // Exemption: 88,100 − 0.25 x (750,000 − 626,350) = 88,100 − 30,912.50 = 57,187.50.
    // Taxable excess: 692,812.50. TMT = 0.26 x 239,100 + 0.28 x 453,712.50
    // = 62,166 + 127,039.50 = 189,205.50.
    const r = amtExposureIllustration({ amtiExcludingIso: 150_000, isoSpread: 600_000, filingStatus: 'single' })
    expect(r.exemptionAfterPhaseout).toBe(57_187.5)
    expect(r.taxableExcess).toBe(692_812.5)
    expect(r.tentativeMinimumTax).toBe(189_205.5)
    expect(r.producesFilingComputation).toBe(false)
    expect(r.needsReview).toBe(true)
  })

  it('amtOverRegularTax compares against a supplied hypothetical regular tax, floored at 0', () => {
    const r = amtExposureIllustration({ amtiExcludingIso: 150_000, isoSpread: 600_000, filingStatus: 'single', regularTaxForComparison: 160_000 })
    expect(r.amtOverRegularTax).toBe(29_205.5)
    const low = amtExposureIllustration({ amtiExcludingIso: 100_000, isoSpread: 0, filingStatus: 'single', regularTaxForComparison: 160_000 })
    expect(low.amtOverRegularTax).toBe(0)
  })

  it('is labeled an illustration and is deterministic', () => {
    const inputs = { amtiExcludingIso: 150_000, isoSpread: 600_000, filingStatus: 'single' as const }
    expect(amtExposureIllustration(inputs).kind).toBe('illustration')
    expect(amtExposureIllustration(inputs)).toEqual(amtExposureIllustration(inputs))
  })
})
