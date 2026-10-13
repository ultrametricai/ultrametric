// Textbook tests for the employer-side federal payroll tax module. Duties: (1) every
// ruleId in PAYROLL_RULE_IDS resolves to a committed, jurisdiction-matched card in
// law/US-FED/ with primary sources; (2) the maxima implied by the cited published
// figures are hand-derived and pinned (6.2% x $184,500 = $11,439 employer social security
// maximum for 2026; 0.6% x $7,000 = $42 full-credit FUTA maximum); (3) the piecewise
// arithmetic (wage base cap, $200,000 Additional Medicare threshold, credit bounds) is
// re-derived in comments.

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  FICA_2026,
  FUTA_2025,
  PAYROLL_RULE_IDS,
  STATE_TAX_BOUNDARY,
  employerFicaAnnual,
  employerPayrollCostAnnual,
  futaAnnual,
} from '../payrollTax'

function loadRuleCard(jurisdiction: string, ruleId: string) {
  const dir = path.join(process.cwd(), 'law', jurisdiction)
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
  for (const [name, ref] of Object.entries(PAYROLL_RULE_IDS)) {
    it(`${name} → ${ref.ruleId}`, () => {
      const card = loadRuleCard(ref.jurisdiction, ref.ruleId)
      expect(card, `law/${ref.jurisdiction} must contain a card with id ${ref.ruleId}`).not.toBeNull()
      expect(card?.jurisdiction).toBe(ref.jurisdiction)
      expect(card?.kind).toBe('legal')
      expect(card?.source_ids.length).toBeGreaterThan(0)
    })
  }
})

describe('employerFicaAnnual (rule us-fed.fica-rates-2026)', () => {
  it('a $120,000 salary: 6.2% + 1.45% employer shares, no Additional Medicare', () => {
    // SS: 0.062 x 120,000 = 7,440; Medicare: 0.0145 x 120,000 = 1,740; total 9,180.
    const r = employerFicaAnnual(120_000)
    expect(r.employerSocialSecurity).toBe(7440)
    expect(r.employerMedicare).toBe(1740)
    expect(r.employerFicaTotal).toBe(9180)
    expect(r.employeeAdditionalMedicareWithholding).toBe(0)
    expect(r.needsReview).toBe(true)
  })

  it('pins the published-figure maximum: employer social security caps at 6.2% x $184,500 = $11,439', () => {
    expect(employerFicaAnnual(184_500).employerSocialSecurity).toBe(11_439)
    expect(employerFicaAnnual(500_000).employerSocialSecurity).toBe(11_439) // wage base cap
    expect(employerFicaAnnual(184_499).employerSocialSecurity).toBeLessThan(11_439)
  })

  it('Medicare has no wage base; Additional Medicare 0.9% starts over $200,000 and is employee-only', () => {
    // $500,000: employer Medicare = 7,250; employee additional = 0.009 x 300,000 = 2,700.
    const r = employerFicaAnnual(500_000)
    expect(r.employerMedicare).toBe(7250)
    expect(r.employeeAdditionalMedicareWithholding).toBe(2700)
    // And it is NOT in the employer total: 11,439 + 7,250 = 18,689.
    expect(r.employerFicaTotal).toBe(18_689)
  })

  it('the $200,000 withholding threshold is exact', () => {
    expect(employerFicaAnnual(200_000).employeeAdditionalMedicareWithholding).toBe(0)
    expect(employerFicaAnnual(200_001).employeeAdditionalMedicareWithholding).toBe(0.01)
  })
})

describe('futaAnnual (rule us-fed.futa-2025)', () => {
  it('pins the published-figure maximum: full-credit net FUTA is 0.6% x $7,000 = $42', () => {
    // Gross 6.0% x 7,000 = 420; credit 5.4% x 7,000 = 378; net 42.
    const r = futaAnnual(120_000)
    expect(r.futaWages).toBe(7000)
    expect(r.grossFuta).toBe(420)
    expect(r.creditApplied).toBe(378)
    expect(r.netFuta).toBe(42)
  })

  it('below the wage base the tax is proportional', () => {
    // $5,000 of wages: gross 300, credit 270, net 30.
    const r = futaAnnual(5000)
    expect(r.netFuta).toBe(30)
  })

  it('a reduced state credit (credit-reduction state) raises net FUTA; the credit is bounded', () => {
    // 5.4% − 0.3% reduction = 5.1% credit: net = (0.060 − 0.051) x 7,000 = $63.
    expect(futaAnnual(50_000, { stateCreditRate: 0.051 }).netFuta).toBe(63)
    expect(() => futaAnnual(50_000, { stateCreditRate: 0.055 })).toThrow(RangeError)
    expect(() => futaAnnual(50_000, { stateCreditRate: -0.01 })).toThrow(RangeError)
  })

  it('zero credit: the full 6.0% ($420 at the base)', () => {
    expect(futaAnnual(50_000, { stateCreditRate: 0 }).netFuta).toBe(420)
  })
})

describe('employerPayrollCostAnnual — per-employee annual arithmetic with the stated boundary', () => {
  it('a $120,000 hire: wages + $9,180 FICA + $42 FUTA = $129,222 federal-only total', () => {
    const r = employerPayrollCostAnnual(120_000)
    expect(r.federalEmployerTotal).toBe(129_222)
    // Load factor: 129,222 / 120,000 − 1 = 0.07685.
    expect(r.federalLoadFactor).toBe(0.0769)
    expect(r.ruleIds).toEqual(['us-fed.fica-rates-2026', 'us-fed.futa-2025'])
  })

  it('states its out-of-scope boundary on every result', () => {
    const r = employerPayrollCostAnnual(120_000)
    expect(r.outOfScope).toBe(STATE_TAX_BOUNDARY)
    expect(r.outOfScope).toContain('out of scope')
    expect(r.needsReview).toBe(true)
  })

  it('zero wages: zero taxes, null load factor', () => {
    const r = employerPayrollCostAnnual(0)
    expect(r.federalEmployerTotal).toBe(0)
    expect(r.federalLoadFactor).toBeNull()
  })

  it('parameter objects carry asOf dates and the published figures', () => {
    expect(FICA_2026).toMatchObject({ taxYear: 2026, socialSecurityWageBase: 184_500, asOf: '2026-10-01' })
    expect(FUTA_2025).toMatchObject({ taxYear: 2025, rate: 0.06, wageBase: 7000, maxStateCredit: 0.054 })
  })

  it('is deterministic', () => {
    expect(employerPayrollCostAnnual(185_000)).toEqual(employerPayrollCostAnnual(185_000))
  })
})
