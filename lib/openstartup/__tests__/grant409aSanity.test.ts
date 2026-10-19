// Textbook tests for the 409A grant sanity module. Two duties (the deadlines-module
// pattern): (1) every ruleId in RULE_IDS_409A resolves to a committed, jurisdiction-matched
// card in open-law/US-FED/ with primary sources — the module never asserts a legal condition
// without a dated card behind it; (2) the date and price arithmetic is re-derived by hand
// in comments. There is deliberately NO published valuation example to replay here: the
// module refuses to value companies (it takes the 409A FMV as input, equityComp's posture),
// so its citable anchors are the rule cards and the YC User Guide §B.6 term-sheet
// convention, not someone's worked appraisal.

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  PRESUMPTION_METHODS,
  RULE_IDS_409A,
  addUtcMonths,
  appraisalPresumptionCheck,
  checkMethodEligibility,
  fmvAgeCheck,
  grantSanityReport,
  penaltyIllustration409a,
  preferredCommonRatioIllustration,
  refreshTriggerChecklist,
  strikeFloorCheck,
} from '../grant409aSanity'

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

describe('every check resolves to a committed, jurisdiction-matched rule card', () => {
  for (const [name, ref] of Object.entries(RULE_IDS_409A)) {
    it(`${name} → ${ref.ruleId}`, () => {
      const card = loadRuleCard(ref.jurisdiction, ref.ruleId)
      expect(card, `open-law/${ref.jurisdiction} must contain a card with id ${ref.ruleId}`).not.toBeNull()
      expect(card?.jurisdiction).toBe(ref.jurisdiction)
      expect(card?.kind).toBe('legal')
      expect(card?.source_ids.length).toBeGreaterThan(0)
    })
  }
})

describe('addUtcMonths (the documented 12-month convention)', () => {
  it('adds calendar months in UTC', () => {
    expect(addUtcMonths('2025-09-15', 12)).toBe('2026-09-15')
    expect(addUtcMonths('2025-01-31', 1)).toBe('2025-03-03') // JS rollover, documented
  })

  it('a Feb 29 anniversary rolls to Mar 1 (documented convention)', () => {
    expect(addUtcMonths('2024-02-29', 12)).toBe('2025-03-01')
  })
})

describe('strikeFloorCheck (rule us-fed.409a-stock-right-exception)', () => {
  it('strike at or above the grant-date FMV passes — and still needs review (extra conditions)', () => {
    const atFmv = strikeFloorCheck(0.4, 0.4)
    expect(atFmv.level).toBe('pass')
    expect(atFmv.needsReview).toBe(true)
    expect(atFmv.ruleId).toBe('us-fed.409a-stock-right-exception')
    expect(strikeFloorCheck(0.5, 0.4).level).toBe('pass')
  })

  it('strike below the grant-date FMV fails the exercise-price condition as computed', () => {
    const f = strikeFloorCheck(0.39, 0.4)
    expect(f.level).toBe('fail')
    expect(f.note).toContain('BELOW')
  })

  it('refuses to run without a real (positive) FMV input — it never invents one', () => {
    expect(() => strikeFloorCheck(0.4, 0)).toThrow(/never computed here/)
    expect(() => strikeFloorCheck(-0.01, 0.4)).toThrow(RangeError)
  })
})

describe('fmvAgeCheck (rule us-fed.staleness: more than 12 months before the use date)', () => {
  it('exactly 12 months is not "more than 12 months": 2025-09-15 FMV is usable 2026-09-15', () => {
    const f = fmvAgeCheck('2025-09-15', '2026-09-15', { materialChangeSinceFmv: false })
    expect(f.staleAfter).toBe('2026-09-15')
    expect(f.level).toBe('pass')
    expect(f.needsReview).toBe(true) // 12 months is a ceiling, never a guarantee
  })

  it('one day past the window fails as computed', () => {
    const f = fmvAgeCheck('2025-09-15', '2026-09-16', { materialChangeSinceFmv: false })
    expect(f.level).toBe('fail')
    expect(f.note).toContain('stale after 2026-09-15')
  })

  it('a Feb 29 FMV date goes stale after Mar 1 (the documented month-addition convention)', () => {
    const f = fmvAgeCheck('2024-02-29', '2025-03-01', { materialChangeSinceFmv: false })
    expect(f.staleAfter).toBe('2025-03-01')
    expect(f.level).toBe('pass') // the boundary day is not "more than 12 months"
    expect(fmvAgeCheck('2024-02-29', '2025-03-02', { materialChangeSinceFmv: false }).level).toBe('fail')
  })

  it('staleness outranks the term-sheet flag: a stale FMV fails even with a term sheet', () => {
    expect(fmvAgeCheck('2025-08-01', '2026-10-05', { termSheetSignedSinceFmv: true }).level).toBe('fail')
  })

  it('a signed priced-round term sheet flags even a fresh FMV (User Guide §B.6 convention)', () => {
    const f = fmvAgeCheck('2026-08-01', '2026-09-15', { termSheetSignedSinceFmv: true, materialChangeSinceFmv: false })
    expect(f.level).toBe('flag')
    expect(f.note).toContain('term sheet')
  })

  it('a reported material change flags; unknown (the default) also flags', () => {
    expect(fmvAgeCheck('2026-08-01', '2026-09-15', { materialChangeSinceFmv: true }).level).toBe('flag')
    expect(fmvAgeCheck('2026-08-01', '2026-09-15').level).toBe('flag') // honest default
  })

  it('rejects a grant dated before the FMV', () => {
    expect(() => fmvAgeCheck('2026-09-15', '2026-09-14')).toThrow(RangeError)
  })
})

describe('appraisalPresumptionCheck (rule us-fed.independent-appraisal-presumption)', () => {
  it('within 12 months: the presumption MAY be available — rebuttable, conditions unverified', () => {
    const f = appraisalPresumptionCheck('2025-01-10', '2026-01-09')
    expect(f.level).toBe('pass')
    expect(f.windowEnds).toBe('2026-01-10')
    expect(f.note).toContain('rebuttable')
    expect(f.needsReview).toBe(true)
  })

  it('outside the window: unavailable on timing as computed', () => {
    expect(appraisalPresumptionCheck('2025-01-10', '2026-01-11').level).toBe('fail')
  })
})

describe('preferredCommonRatioIllustration (rule us-fed.reasonable-method caveat)', () => {
  it('is labeled an illustration and never a valuation', () => {
    // Guide-sourced inputs (Appendix II p.21): Series A at $1.1144 vs a $0.34 per-share
    // Safe Preferred liquidation figure used here as a stand-in FMV input. The ratio
    // 1.1144 / 0.34 = 3.2776 is hand-derived — the guide does not publish 409A ratios.
    const r = preferredCommonRatioIllustration(1.1144, 0.34)
    expect(r.kind).toBe('illustration')
    expect(r.producesValuation).toBe(false)
    expect(r.ratio).toBe(3.2776)
    expect(r.level).toBe('pass')
    expect(r.note).toContain('never a valuation')
  })

  it('flags the unusual case: common FMV at or above the preferred price', () => {
    expect(preferredCommonRatioIllustration(1, 1.25).level).toBe('flag')
    expect(preferredCommonRatioIllustration(1, 1).level).toBe('flag')
  })

  it('rejects non-positive prices', () => {
    expect(() => preferredCommonRatioIllustration(0, 1)).toThrow(RangeError)
    expect(() => preferredCommonRatioIllustration(1, 0)).toThrow(RangeError)
  })
})

describe('grantSanityReport', () => {
  const CLEAN = {
    strikePerShare: 0.4,
    fmvPerShare: 0.4,
    fmvAsOf: '2026-08-01',
    grantOn: '2026-09-15',
    independentAppraisalOn: '2026-08-01',
    materialChangeSinceFmv: false as const,
    termSheetSignedSinceFmv: false,
    preferredRoundPps: 1.1144,
  }

  it('a clean grant passes every check — and the report still demands review', () => {
    const r = grantSanityReport(CLEAN)
    expect(r.findings.map((f) => f.check)).toEqual([
      'strike-floor',
      'fmv-age',
      'appraisal-presumption-window',
      'preferred-common-ratio',
    ])
    expect(r.worstLevel).toBe('pass')
    expect(r.producesValuation).toBe(false)
    expect(r.needsReview).toBe(true)
    expect(r.disclaimer).toContain('not a valuation')
  })

  it('worstLevel escalates: a term sheet flags, a below-FMV strike fails', () => {
    expect(grantSanityReport({ ...CLEAN, termSheetSignedSinceFmv: true }).worstLevel).toBe('flag')
    expect(grantSanityReport({ ...CLEAN, strikePerShare: 0.39 }).worstLevel).toBe('fail')
  })

  it('optional checks are skipped when their inputs are absent', () => {
    const r = grantSanityReport({
      strikePerShare: 0.4,
      fmvPerShare: 0.4,
      fmvAsOf: '2026-08-01',
      grantOn: '2026-09-15',
      materialChangeSinceFmv: false,
    })
    expect(r.findings.map((f) => f.check)).toEqual(['strike-floor', 'fmv-age'])
  })

  it('is deterministic', () => {
    expect(grantSanityReport(CLEAN)).toEqual(grantSanityReport(CLEAN))
  })
})

// ---------------------------------------------------------------------------
// Extension (equity-mechanics pass): presumption methods, eligibility, refresh
// triggers, penalty illustration
// ---------------------------------------------------------------------------

describe('PRESUMPTION_METHODS (structured, cited data — Treas. Reg. § 1.409A-1(b)(5)(iv)(B)(2))', () => {
  it('encodes the three methods, each with a committed rule card and stated conditions', () => {
    expect(PRESUMPTION_METHODS.map((m) => m.method)).toEqual(['independent-appraisal', 'binding-formula', 'illiquid-startup'])
    for (const m of PRESUMPTION_METHODS) {
      expect(loadRuleCard(m.jurisdiction, m.ruleId), m.ruleId).not.toBeNull()
      expect(m.conditions.length).toBeGreaterThan(0)
      expect(m.needsReview).toBe(true)
    }
  })

  it('the illiquid-startup route carries the regulation’s actual conditions', () => {
    const il = PRESUMPTION_METHODS.find((m) => m.method === 'illiquid-startup')!
    const text = il.conditions.join(' ')
    expect(text).toContain('written report')
    expect(text).toContain('significant knowledge, experience, education, or training')
    expect(text).toContain('10 years')
    expect(text).toContain('established securities market')
    expect(text).toContain('right of first refusal')
    expect(text).toContain('90 days')
    expect(text).toContain('180 days')
  })
})

describe('checkMethodEligibility (explicit inputs; judgments always flag)', () => {
  const CLEAN_ILLIQUID = {
    businessConductedSince: '2022-03-01',
    hasPubliclyTradedEquity: false,
    stockSubjectToPutCallOrObligation: false as const,
    valuationEvidencedByWrittenReport: true,
    valuerQualified: true as const,
    anticipatesChangeInControlWithin90Days: false as const,
    anticipatesPublicOfferingWithin180Days: false as const,
  }

  it('only methods with supplied inputs appear — nothing silently passes', () => {
    expect(checkMethodEligibility({ grantOn: '2026-10-05' }).methods).toEqual([])
    const r = checkMethodEligibility({ grantOn: '2026-10-05', illiquidStartup: CLEAN_ILLIQUID })
    expect(r.methods.map((m) => m.method)).toEqual(['illiquid-startup'])
    expect(r.producesValuation).toBe(false)
  })

  it('independent appraisal: the 12-month window via the existing check', () => {
    const inWindow = checkMethodEligibility({ grantOn: '2026-10-05', independentAppraisalOn: '2026-01-10' })
    expect(inWindow.methods[0].level).toBe('pass')
    const outOfWindow = checkMethodEligibility({ grantOn: '2026-10-05', independentAppraisalOn: '2025-10-01' })
    expect(outOfWindow.methods[0].level).toBe('fail')
  })

  it('binding formula: the § 1.83-5 standard always flags; inconsistency fails', () => {
    const consistent = checkMethodEligibility({
      grantOn: '2026-10-05',
      bindingFormula: { valuedSameMannerForAllTransfers: true },
    })
    expect(consistent.methods[0].level).toBe('flag') // the legal standard is never passed here
    expect(consistent.methods[0].findings.map((f) => f.check)).toContain('formula-83-5-standard')
    const inconsistent = checkMethodEligibility({
      grantOn: '2026-10-05',
      bindingFormula: { valuedSameMannerForAllTransfers: false },
    })
    expect(inconsistent.methods[0].level).toBe('fail')
  })

  it('illiquid startup: a clean set of explicit assertions passes every computed/reported condition', () => {
    const r = checkMethodEligibility({ grantOn: '2026-10-05', illiquidStartup: CLEAN_ILLIQUID })
    expect(r.methods[0].level).toBe('pass')
    expect(r.methods[0].findings).toHaveLength(7)
    for (const f of r.methods[0].findings) expect(f.needsReview).toBe(true)
  })

  it('the 10-year clock is computed: business since 2016-09-01 reaches 10 years before a 2026-10-05 grant', () => {
    const r = checkMethodEligibility({
      grantOn: '2026-10-05',
      illiquidStartup: { ...CLEAN_ILLIQUID, businessConductedSince: '2016-09-01' },
    })
    const ten = r.methods[0].findings.find((f) => f.check === 'illiquid-ten-year')!
    expect(ten.level).toBe('fail')
    expect(ten.note).toContain('2026-09-01') // the computed 10-year date
    // One month later a 2016-11-01 start is still under 10 years at grant:
    const ok = checkMethodEligibility({
      grantOn: '2026-10-05',
      illiquidStartup: { ...CLEAN_ILLIQUID, businessConductedSince: '2016-11-01' },
    })
    expect(ok.methods[0].findings.find((f) => f.check === 'illiquid-ten-year')?.level).toBe('pass')
  })

  it('route-killing conditions fail; unknowns flag', () => {
    const publicCo = checkMethodEligibility({
      grantOn: '2026-10-05',
      illiquidStartup: { ...CLEAN_ILLIQUID, hasPubliclyTradedEquity: true },
    })
    expect(publicCo.methods[0].level).toBe('fail')
    const cic = checkMethodEligibility({
      grantOn: '2026-10-05',
      illiquidStartup: { ...CLEAN_ILLIQUID, anticipatesChangeInControlWithin90Days: true },
    })
    expect(cic.methods[0].level).toBe('fail')
    const unknowns = checkMethodEligibility({
      grantOn: '2026-10-05',
      illiquidStartup: { ...CLEAN_ILLIQUID, valuerQualified: 'unknown', anticipatesPublicOfferingWithin180Days: 'unknown' },
    })
    expect(unknowns.methods[0].level).toBe('flag')
  })
})

describe('refreshTriggerChecklist (rule us-fed.staleness + the YC §B.6 term-sheet convention)', () => {
  it('all-clear explicit answers inside the window: no refresh recommended (still needs review)', () => {
    const r = refreshTriggerChecklist('2026-08-01', '2026-10-05', {
      termSheetSigned: false,
      financingClosed: false,
      materialBusinessChange: false,
    })
    expect(r.worstLevel).toBe('pass')
    expect(r.refreshRecommended).toBe(false)
    expect(r.needsReview).toBe(true)
  })

  it('the honest default (nothing asserted) flags and recommends confirming', () => {
    const r = refreshTriggerChecklist('2026-08-01', '2026-10-05')
    expect(r.worstLevel).toBe('flag')
    expect(r.refreshRecommended).toBe(true)
  })

  it('a stale FMV fails as computed; a signed term sheet flags even a fresh one', () => {
    expect(refreshTriggerChecklist('2025-08-01', '2026-10-05', { financingClosed: false, materialBusinessChange: false }).worstLevel).toBe('fail')
    const ts = refreshTriggerChecklist('2026-08-01', '2026-10-05', {
      termSheetSigned: true,
      financingClosed: false,
      materialBusinessChange: false,
    })
    expect(ts.worstLevel).toBe('flag')
    expect(ts.findings[0].note).toContain('term sheet')
  })

  it('a closed financing is a refresh trigger', () => {
    const r = refreshTriggerChecklist('2026-08-01', '2026-10-05', {
      termSheetSigned: false,
      financingClosed: true,
      materialBusinessChange: false,
    })
    expect(r.findings.find((f) => f.check === 'refresh-financing-closed')?.level).toBe('fail')
    expect(r.refreshRecommended).toBe(true)
  })
})

describe('penaltyIllustration409a (rule us-fed.409a-penalty-additions, IRC § 409A(a)(1)(B))', () => {
  it('20% of the hypothetical includible amount: $100,000 → $20,000', () => {
    const p = penaltyIllustration409a({ includibleCompensation: 100_000 })
    expect(p.additionalTax20Pct).toBe(20_000)
    expect(p.premiumInterestIllustration).toBeUndefined()
    expect(p.kind).toBe('illustration')
    expect(p.producesValuation).toBe(false)
    expect(p.ruleId).toBe('us-fed.409a-penalty-additions')
    expect(p.note).toContain('Not a tax computation')
  })

  it('sums multiple hypothetical underpayment rows', () => {
    // 50,000 × (7+1)% × 2 + 10,000 × (4+1)% × 1 = 8,000 + 500 = 8,500.
    const p = penaltyIllustration409a({
      includibleCompensation: 100_000,
      hypotheticalUnderpayments: [
        { underpayment: 50_000, underpaymentRatePct: 7, yearsOutstanding: 2 },
        { underpayment: 10_000, underpaymentRatePct: 4, yearsOutstanding: 1 },
      ],
    })
    expect(p.premiumInterestIllustration).toBe(8_500)
  })

  it('premium interest at (stated rate + 1 point), simple: $50,000 at 7% for 2 years → $8,000', () => {
    // 50,000 × (7 + 1)% × 2 = 8,000 — the "+1 percentage point" of § 409A(a)(1)(B)(ii).
    const p = penaltyIllustration409a({
      includibleCompensation: 100_000,
      hypotheticalUnderpayments: [{ underpayment: 50_000, underpaymentRatePct: 7, yearsOutstanding: 2 }],
    })
    expect(p.premiumInterestIllustration).toBe(8_000)
  })

  it('refuses to invent the includible amount', () => {
    expect(() => penaltyIllustration409a({ includibleCompensation: 0 })).toThrow(/explicit hypothetical/)
    expect(() =>
      penaltyIllustration409a({
        includibleCompensation: 1,
        hypotheticalUnderpayments: [{ underpayment: -1, underpaymentRatePct: 7, yearsOutstanding: 1 }],
      }),
    ).toThrow(RangeError)
  })
})
