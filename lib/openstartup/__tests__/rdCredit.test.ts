// Textbook tests for the R&D tax-mechanics module. Duties: (1) every ruleId in
// RD_RULE_IDS resolves to a committed, jurisdiction-matched card in open-law/US-FED/ with
// primary sources; (2) the midpoint convention replays the widely published 5-year
// domestic example ($100,000 -> $10,000 in year one; the 10/20/20/20/20/10 pattern that
// follows directly from "ratably over the 5-year period beginning with the midpoint of
// the taxable year"); (3) the § 41(h)/Form 8974 mechanics are re-derived by hand.

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  QSB_GROSS_RECEIPTS_CEILING,
  RD_RULE_IDS,
  domesticSre2025Treatment,
  domesticSre5YearSchedule,
  foreignSre15YearSchedule,
  midpointAmortizationSchedule,
  payrollOffsetElectionCap,
  qsbPayrollOffsetEligibility,
  quarterlyOffsetApplication,
} from '../rdCredit'

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
  for (const [name, ref] of Object.entries(RD_RULE_IDS)) {
    it(`${name} → ${ref.ruleId}`, () => {
      const card = loadRuleCard(ref.jurisdiction, ref.ruleId)
      expect(card, `open-law/${ref.jurisdiction} must contain a card with id ${ref.ruleId}`).not.toBeNull()
      expect(card?.jurisdiction).toBe(ref.jurisdiction)
      expect(card?.kind).toBe('legal')
      expect(card?.source_ids.length).toBeGreaterThan(0)
    })
  }
})

describe('midpoint amortization (rule us-fed.research-expenditure-amortization)', () => {
  it('replays the published domestic 5-year example: $100,000 -> 10/20/20/20/20/10', () => {
    const s = domesticSre5YearSchedule(100_000)
    expect(s.schedule).toEqual([
      { year: 1, deduction: 10_000 }, // half of $20,000 — the midpoint convention
      { year: 2, deduction: 20_000 },
      { year: 3, deduction: 20_000 },
      { year: 4, deduction: 20_000 },
      { year: 5, deduction: 20_000 },
      { year: 6, deduction: 10_000 }, // the remaining half-year
    ])
    expect(s.needsReview).toBe(true)
  })

  it('foreign 15-year: year one is 1/30 of the amount, year sixteen closes the schedule', () => {
    const s = foreignSre15YearSchedule(300_000)
    expect(s.schedule[0]).toEqual({ year: 1, deduction: 10_000 }) // 300,000 / 30
    expect(s.schedule[1]).toEqual({ year: 2, deduction: 20_000 })
    expect(s.schedule).toHaveLength(16)
    expect(s.schedule[15].deduction).toBe(10_000)
  })

  it('schedules sum to the amount exactly, even with awkward cents', () => {
    for (const amount of [100_000, 33_333.33, 1, 999_999.97]) {
      const s = midpointAmortizationSchedule(amount, 5)
      const total = s.schedule.reduce((sum, y) => sum + y.deduction, 0)
      expect(Math.round(total * 100) / 100).toBe(amount)
    }
  })

  it('a 1-year period is two half-years (the smallest midpoint schedule)', () => {
    const s = midpointAmortizationSchedule(10_000, 1)
    expect(s.schedule).toEqual([
      { year: 1, deduction: 5000 },
      { year: 2, deduction: 5000 },
    ])
  })

  it('rejects non-positive amounts and periods', () => {
    expect(() => midpointAmortizationSchedule(0, 5)).toThrow(RangeError)
    expect(() => midpointAmortizationSchedule(100, 0)).toThrow(RangeError)
  })
})

describe('domesticSre2025Treatment (§ 174A, post-2024 taxable years)', () => {
  it('currently deductible with no election', () => {
    const r = domesticSre2025Treatment(250_000)
    expect(r.currentDeduction).toBe(250_000)
    expect(r.election).toBeUndefined()
    expect(r.note).toContain('Law in flux')
  })

  it('the § 174A(c) election: ratable over >= 60 months', () => {
    const r = domesticSre2025Treatment(120_000, { months: 60 })
    expect(r.currentDeduction).toBeNull()
    expect(r.election).toEqual({ months: 60, monthlyAmount: 2000 })
    expect(() => domesticSre2025Treatment(120_000, { months: 59 })).toThrow(/60 months/)
  })
})

describe('qsbPayrollOffsetEligibility (rule us-fed.rd-payroll-offset)', () => {
  it('unknown history → needs_review; qualified research is NEVER established here', () => {
    const r = qsbPayrollOffsetEligibility({ grossReceiptsCurrentYear: 1_000_000 })
    expect(r.overall).toBe('needs_review')
    expect(r.note).toContain('§ 41(d)')
  })

  it('rejects negative gross receipts and fractional prior election years', () => {
    expect(() => qsbPayrollOffsetEligibility({ grossReceiptsCurrentYear: -1 })).toThrow(RangeError)
    expect(() => qsbPayrollOffsetEligibility({ grossReceiptsCurrentYear: 0, priorElectionYears: 1.5 })).toThrow(RangeError)
  })

  it('computable failures flip to not-met: receipts at the ceiling, early receipts, 5 prior elections', () => {
    expect(qsbPayrollOffsetEligibility({ grossReceiptsCurrentYear: QSB_GROSS_RECEIPTS_CEILING }).overall).toBe('not-met')
    expect(
      qsbPayrollOffsetEligibility({ grossReceiptsCurrentYear: 1, hadGrossReceiptsBeforeFiveYearPeriod: true }).overall,
    ).toBe('not-met')
    expect(qsbPayrollOffsetEligibility({ grossReceiptsCurrentYear: 1, priorElectionYears: 5 }).overall).toBe('not-met')
  })

  it('all computable conditions met still leaves overall needs_review', () => {
    const r = qsbPayrollOffsetEligibility({
      grossReceiptsCurrentYear: 4_999_999,
      hadGrossReceiptsBeforeFiveYearPeriod: false,
      priorElectionYears: 4,
    })
    expect(r.conditions.map((c) => c.status)).toEqual(['met', 'met', 'met'])
    expect(r.overall).toBe('needs_review')
  })
})

describe('payrollOffsetElectionCap (§ 41(h))', () => {
  it('$250,000, increased by $250,000 for taxable years beginning after 2022', () => {
    expect(payrollOffsetElectionCap(false)).toBe(250_000)
    expect(payrollOffsetElectionCap(true)).toBe(500_000)
  })
})

describe('quarterlyOffsetApplication (Form 8974 mechanics)', () => {
  it('SS first (election\'s first $250k is SS-only), Medicare for the rest, carryforward after both — hand-derived', () => {
    // $500,000 election: SS pool $250,000, Medicare pool $250,000.
    // Q1: SS liability $30,000 -> SS pool 220,000; Medicare liability $7,000 -> pool 243,000.
    // Q2: SS $40,000 -> 180,000; Medicare $9,000 -> 234,000.
    const r = quarterlyOffsetApplication({
      electedAmount: 500_000,
      taxYearBeginsAfter2022: true,
      quarters: [
        { label: '2026-Q2', employerSocialSecurityTax: 30_000, employerMedicareTax: 7000 },
        { label: '2026-Q3', employerSocialSecurityTax: 40_000, employerMedicareTax: 9000 },
      ],
    })
    expect(r.quarters[0]).toEqual({ label: '2026-Q2', appliedToSocialSecurity: 30_000, appliedToMedicare: 7000, carryforwardAfter: 463_000 })
    expect(r.quarters[1]).toEqual({ label: '2026-Q3', appliedToSocialSecurity: 40_000, appliedToMedicare: 9000, carryforwardAfter: 414_000 })
    expect(r.totalApplied).toBe(86_000)
    expect(r.remaining).toBe(414_000)
  })

  it('a pre-2023 election is social-security-only: Medicare liability goes untouched', () => {
    const r = quarterlyOffsetApplication({
      electedAmount: 250_000,
      taxYearBeginsAfter2022: false,
      quarters: [{ label: '2022-Q4', employerSocialSecurityTax: 50_000, employerMedicareTax: 20_000 }],
    })
    expect(r.quarters[0].appliedToSocialSecurity).toBe(50_000)
    expect(r.quarters[0].appliedToMedicare).toBe(0)
  })

  it('the per-quarter SS application never exceeds $250,000 or the quarter\'s liability', () => {
    const r = quarterlyOffsetApplication({
      electedAmount: 500_000,
      taxYearBeginsAfter2022: true,
      quarters: [{ label: 'q', employerSocialSecurityTax: 400_000, employerMedicareTax: 0 }],
    })
    expect(r.quarters[0].appliedToSocialSecurity).toBe(250_000) // SS pool exhausted, not liability
  })

  it('rejects negative quarterly liabilities', () => {
    expect(() =>
      quarterlyOffsetApplication({
        electedAmount: 100_000,
        taxYearBeginsAfter2022: true,
        quarters: [{ label: 'q1', employerSocialSecurityTax: -1, employerMedicareTax: 0 }],
      }),
    ).toThrow(RangeError)
  })

  it('refuses an election above the statutory cap', () => {
    expect(() =>
      quarterlyOffsetApplication({ electedAmount: 300_000, taxYearBeginsAfter2022: false, quarters: [] }),
    ).toThrow(/cap/)
  })

  it('conservation: totalApplied + remaining === electedAmount', () => {
    const r = quarterlyOffsetApplication({
      electedAmount: 437_654.32,
      taxYearBeginsAfter2022: true,
      quarters: [
        { label: 'q1', employerSocialSecurityTax: 123_456.78, employerMedicareTax: 11_111.11 },
        { label: 'q2', employerSocialSecurityTax: 98_765.43, employerMedicareTax: 22_222.22 },
      ],
    })
    expect(Math.round((r.totalApplied + r.remaining) * 100) / 100).toBe(437_654.32)
  })
})
