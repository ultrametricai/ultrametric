// Textbook tests for the § 1202 QSBS module. Duties: (1) every ruleId in QSBS_RULE_IDS
// resolves to a committed, jurisdiction-matched card in open-law/US-FED/ with primary
// sources; (2) the cap arithmetic replays the standard published worked example (greater
// of $10M or 10x basis — the example every reputable QSBS explainer uses), re-derived in
// comments directly from § 1202(b)(1); (3) the regime routing (the July 4, 2025
// applicable date from P.L. 119-21) is pinned at its boundaries.

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  QSBS_APPLICABLE_DATE,
  QSBS_PARAMS,
  QSBS_RULE_IDS,
  SECTION_1045_ROLLOVER,
  qsbsEligibilityChecklist,
  qsbsExclusionIllustration,
  qsbsExclusionPercentage,
  qsbsHoldingClock,
  qsbsPerIssuerCap,
} from '../qsbs'

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

describe('every condition resolves to a committed, jurisdiction-matched rule card', () => {
  for (const [name, ref] of Object.entries(QSBS_RULE_IDS)) {
    it(`${name} → ${ref.ruleId}`, () => {
      const card = loadRuleCard(ref.jurisdiction, ref.ruleId)
      expect(card, `open-law/${ref.jurisdiction} must contain a card with id ${ref.ruleId}`).not.toBeNull()
      expect(card?.jurisdiction).toBe(ref.jurisdiction)
      expect(card?.kind).toBe('legal')
      expect(card?.source_ids.length).toBeGreaterThan(0)
    })
  }
})

describe('qsbsEligibilityChecklist (rule us-fed.qsbs-eligibility)', () => {
  it('unknowns return needs_review; the active-business test ALWAYS does', () => {
    const r = qsbsEligibilityChecklist({ issuanceDate: '2022-03-01' })
    expect(r.overall).toBe('needs_review')
    expect(r.conditions.every((c) => c.status === 'needs_review')).toBe(true)
    expect(r.grossAssetCeilingApplied).toBe(50_000_000)
  })

  it('a computable failure flips overall to not-met (secondary purchase; assets over the ceiling; excluded field)', () => {
    expect(qsbsEligibilityChecklist({ issuanceDate: '2022-03-01', acquiredAtOriginalIssuance: false }).overall).toBe('not-met')
    expect(
      qsbsEligibilityChecklist({ issuanceDate: '2022-03-01', aggregateGrossAssetsAtIssuance: 50_000_001 }).overall,
    ).toBe('not-met')
    expect(qsbsEligibilityChecklist({ issuanceDate: '2022-03-01', inExcludedField: true }).overall).toBe('not-met')
  })

  it('even all-met computable conditions stay needs_review overall (never a QSBS opinion)', () => {
    const r = qsbsEligibilityChecklist({
      issuanceDate: '2022-03-01',
      isCCorporation: true,
      acquiredAtOriginalIssuance: true,
      aggregateGrossAssetsAtIssuance: 8_000_000,
      inExcludedField: false,
    })
    expect(r.overall).toBe('needs_review')
    expect(r.needsReview).toBe(true)
    expect(r.conditions.find((c) => c.condition.includes('Active business'))?.status).toBe('needs_review')
  })

  it('post-applicable-date issuances use the $75,000,000 ceiling (P.L. 119-21), flagged as indexed', () => {
    const r = qsbsEligibilityChecklist({ issuanceDate: '2025-08-01', aggregateGrossAssetsAtIssuance: 60_000_000 })
    expect(r.grossAssetCeilingApplied).toBe(75_000_000)
    expect(r.conditions.find((c) => c.condition.includes('gross assets'))?.status).toBe('met')
    expect(r.conditions.find((c) => c.condition.includes('gross assets'))?.note).toContain('indexed after 2026')
    // The same assets fail the classic $50M ceiling:
    expect(qsbsEligibilityChecklist({ issuanceDate: '2025-07-04', aggregateGrossAssetsAtIssuance: 60_000_000 }).overall).toBe('not-met')
  })
})

describe('qsbsHoldingClock (rules us-fed.qsbs-exclusion-percentage, us-fed.restricted-property-holding-period)', () => {
  it('vested at acquisition: clock starts at acquisition (option stock: at exercise)', () => {
    const c = qsbsHoldingClock({ acquisitionDate: '2022-03-01' })
    expect(c.clockStart).toBe('2022-03-01')
    expect(c.milestones).toEqual([{ label: 'more-than-5-years requirement', date: '2027-03-01' }])
  })

  it('83(b) interplay: with the election the clock starts at transfer; without, at vesting', () => {
    const withElection = qsbsHoldingClock({
      acquisitionDate: '2022-03-01',
      substantiallyNonvestedAtAcquisition: true,
      election83bFiled: true,
    })
    expect(withElection.clockStart).toBe('2022-03-01')
    const without = qsbsHoldingClock({
      acquisitionDate: '2022-03-01',
      substantiallyNonvestedAtAcquisition: true,
      election83bFiled: false,
      vestingDate: '2026-03-01',
    })
    expect(without.clockStart).toBe('2026-03-01')
    expect(without.milestones[0].date).toBe('2031-03-01') // 5 years later than the elected path
  })

  it('incomplete 83(b)/vesting facts: the clock cannot be placed', () => {
    const c = qsbsHoldingClock({ acquisitionDate: '2022-03-01', substantiallyNonvestedAtAcquisition: true })
    expect(c.clockStart).toBeNull()
    expect(c.milestones).toEqual([])
  })

  it('post-applicable-date stock gets the 3/4/5-year tier milestones', () => {
    const c = qsbsHoldingClock({ acquisitionDate: '2025-08-01' })
    expect(c.milestones.map((m) => m.date)).toEqual(['2028-08-01', '2029-08-01', '2030-08-01'])
  })
})

describe('qsbsExclusionPercentage (rule us-fed.qsbs-exclusion-percentage)', () => {
  it('classic 100% stock (acquired 2010-09-28 .. 2025-07-04) needs MORE than 5 years', () => {
    expect(qsbsExclusionPercentage('2019-01-01', '2024-01-02').percentage).toBe(100)
    // Exactly 5 years is not "more than 5 years" — and it is flagged as a boundary.
    const exact = qsbsExclusionPercentage('2019-01-01', '2024-01-01')
    expect(exact.percentage).toBe(0)
    expect(exact.boundary).toBe(true)
  })

  it('pins the statutory date boundaries: 50% / 75% / 100% regimes', () => {
    expect(qsbsExclusionPercentage('2009-02-17', '2026-01-01')).toMatchObject({ percentage: 50, regime: 'pre-2009-50' })
    expect(qsbsExclusionPercentage('2009-02-18', '2026-01-01')).toMatchObject({ percentage: 75, regime: '2009-75' })
    expect(qsbsExclusionPercentage('2010-09-27', '2026-01-01')).toMatchObject({ percentage: 75, regime: '2009-75' })
    expect(qsbsExclusionPercentage('2010-09-28', '2026-01-01')).toMatchObject({ percentage: 100, regime: '2010-100' })
    expect(qsbsExclusionPercentage(QSBS_APPLICABLE_DATE, '2031-01-01')).toMatchObject({ percentage: 100, regime: '2010-100' })
  })

  it('post-applicable-date stock: the P.L. 119-21 tiers (50/75/100 at 3/4/5 years)', () => {
    const acq = '2025-07-05'
    expect(qsbsExclusionPercentage(acq, '2028-07-04').percentage).toBe(0) // under 3 years
    expect(qsbsExclusionPercentage(acq, '2028-07-05')).toMatchObject({ percentage: 50, boundary: true })
    expect(qsbsExclusionPercentage(acq, '2029-07-05').percentage).toBe(75)
    expect(qsbsExclusionPercentage(acq, '2030-07-05').percentage).toBe(100)
    expect(qsbsExclusionPercentage(acq, '2030-07-04').percentage).toBe(75)
  })

  it('rejects malformed dates and a disposition before acquisition', () => {
    expect(() => qsbsExclusionPercentage('2020-1-1', '2026-01-01')).toThrow(RangeError)
    expect(() => qsbsExclusionPercentage('2020-01-01', '2019-12-31')).toThrow(RangeError)
  })

  it('a too-early sale points at the § 1045 rollover instead of silence', () => {
    expect(qsbsExclusionPercentage('2019-01-01', '2022-01-01').note).toContain('us-fed.qsbs-1045-rollover')
  })
})

describe('qsbsPerIssuerCap (rule us-fed.qsbs-per-issuer-cap)', () => {
  it('replays the standard published worked example: $2M basis → cap = max($10M, $20M) = $20M', () => {
    // § 1202(b)(1): greater of (A) $10,000,000 and (B) 10 x $2,000,000 = $20,000,000.
    const r = qsbsPerIssuerCap({ acquisitionDate: '2020-01-01', basisOfStockDisposed: 2_000_000 })
    expect(r.dollarLimb).toBe(10_000_000)
    expect(r.tenTimesBasisLimb).toBe(20_000_000)
    expect(r.cap).toBe(20_000_000)
    expect(r.governingLimb).toBe('ten-times-basis')
  })

  it('a nominal founder basis leaves the $10M dollar limb governing', () => {
    const r = qsbsPerIssuerCap({ acquisitionDate: '2020-01-01', basisOfStockDisposed: 10_000 })
    expect(r.cap).toBe(10_000_000)
    expect(r.governingLimb).toBe('dollar')
  })

  it('prior-year eligible gain reduces only the dollar limb (§ 1202(b)(1)(A))', () => {
    const r = qsbsPerIssuerCap({ acquisitionDate: '2020-01-01', basisOfStockDisposed: 100_000, priorYearEligibleGain: 9_500_000 })
    expect(r.dollarLimb).toBe(500_000)
    expect(r.tenTimesBasisLimb).toBe(1_000_000)
    expect(r.cap).toBe(1_000_000)
  })

  it('post-applicable-date stock uses the $15,000,000 base; MFS halves the dollar limb', () => {
    expect(qsbsPerIssuerCap({ acquisitionDate: '2025-08-01', basisOfStockDisposed: 0 }).cap).toBe(15_000_000)
    expect(
      qsbsPerIssuerCap({ acquisitionDate: '2020-01-01', basisOfStockDisposed: 0, marriedFilingSeparately: true }).cap,
    ).toBe(5_000_000)
    expect(QSBS_PARAMS.postApplicableDate.capBase).toBe(15_000_000)
  })

  it('MFS halves the post-applicable-date dollar limb to $7,500,000 (§ 1202(b)(3)(A)(ii))', () => {
    expect(
      qsbsPerIssuerCap({ acquisitionDate: '2025-08-01', basisOfStockDisposed: 0, marriedFilingSeparately: true }).cap,
    ).toBe(7_500_000)
  })

  it('prior-year gain can exhaust the dollar limb; 10x basis still governs', () => {
    const r = qsbsPerIssuerCap({ acquisitionDate: '2020-01-01', basisOfStockDisposed: 1000, priorYearEligibleGain: 10_000_000 })
    expect(r.dollarLimb).toBe(0)
    expect(r.cap).toBe(10_000)
  })
})

describe('qsbsExclusionIllustration — the whole arithmetic, labeled', () => {
  it('$30M gain, $2M basis, 100% stock held > 5 years: exclude $20M, $10M stays taxable', () => {
    const r = qsbsExclusionIllustration({
      gain: 30_000_000,
      acquisitionDate: '2019-06-01',
      dispositionDate: '2026-01-15',
      basisOfStockDisposed: 2_000_000,
    })
    expect(r.eligibleGain).toBe(20_000_000)
    expect(r.exclusionPercentage).toBe(100)
    expect(r.excludedGain).toBe(20_000_000)
    expect(r.taxableGain).toBe(10_000_000)
    expect(r.kind).toBe('illustration')
    expect(r.needsReview).toBe(true)
    expect(r.note).toContain('eligibility is a separate')
  })

  it('post-applicable-date stock at the 4-year tier: 75% of the capped gain', () => {
    const r = qsbsExclusionIllustration({
      gain: 4_000_000,
      acquisitionDate: '2025-08-01',
      dispositionDate: '2029-09-01',
      basisOfStockDisposed: 100_000,
    })
    // Cap = max($15M, $1M) = $15M; eligible = $4M; excluded = 75% = $3M; taxable $1M.
    expect(r.eligibleGain).toBe(4_000_000)
    expect(r.excludedGain).toBe(3_000_000)
    expect(r.taxableGain).toBe(1_000_000)
  })

  it('under the minimum holding: nothing excluded, everything taxable', () => {
    const r = qsbsExclusionIllustration({
      gain: 1_000_000,
      acquisitionDate: '2024-01-01',
      dispositionDate: '2026-01-01',
      basisOfStockDisposed: 50_000,
    })
    expect(r.excludedGain).toBe(0)
    expect(r.taxableGain).toBe(1_000_000)
  })

  it('is deterministic', () => {
    const inputs = { gain: 1, acquisitionDate: '2019-06-01', dispositionDate: '2026-01-15', basisOfStockDisposed: 1 }
    expect(qsbsExclusionIllustration(inputs)).toEqual(qsbsExclusionIllustration(inputs))
  })
})

describe('SECTION_1045_ROLLOVER (rule us-fed.qsbs-1045-rollover)', () => {
  it('is explained and cited, never computed', () => {
    expect(SECTION_1045_ROLLOVER.computed).toBe(false)
    expect(SECTION_1045_ROLLOVER.ruleId).toBe('us-fed.qsbs-1045-rollover')
    expect(SECTION_1045_ROLLOVER.summary).toContain('60 days')
    expect(SECTION_1045_ROLLOVER.summary).toContain('more than 6 months')
  })
})
