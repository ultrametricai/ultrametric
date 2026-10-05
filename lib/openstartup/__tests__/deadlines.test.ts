// Textbook tests for the compliance deadline calendar. Two duties: (1) every deadline's
// day-count arithmetic matches the cited rule card's statement, re-derived in comments;
// (2) every ruleId in DEADLINE_RULE_IDS resolves to a committed card in rules/<jurisdiction>/
// whose id and jurisdiction match — the module never hardcodes a day count without a dated,
// primary-sourced card behind it (open-modules/README.md contract).

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  DEADLINE_RULE_IDS,
  complianceCalendar,
  deFranchiseTaxDue,
  election83bWindow,
  form941Due,
  form1120Due,
} from '../deadlines'

function loadRuleCard(jurisdiction: string, ruleId: string) {
  const dir = path.join(process.cwd(), 'rules', jurisdiction)
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const card = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as { id: string; jurisdiction: string }
    if (card.id === ruleId) return card
  }
  return null
}

describe('every deadline resolves to a committed, jurisdiction-matched rule card', () => {
  for (const [name, ref] of Object.entries(DEADLINE_RULE_IDS)) {
    it(`${name} → ${ref.ruleId}`, () => {
      const card = loadRuleCard(ref.jurisdiction, ref.ruleId)
      expect(card, `rules/${ref.jurisdiction} must contain a card with id ${ref.ruleId}`).not.toBeNull()
      expect(card?.jurisdiction).toBe(ref.jurisdiction)
    })
  }
})

describe('deFranchiseTaxDue (8 Del. C. §§ 502(a)/504(a): on or before March 1)', () => {
  it('tax year N is due March 1 of N+1', () => {
    expect(deFranchiseTaxDue(2026).due).toBe('2027-03-01')
  })

  it('always needs review: the amount is a computation, not a constant', () => {
    const d = deFranchiseTaxDue(2026)
    expect(d.needsReview).toBe(true)
    expect(d.note).toContain('assumed-par-value')
    expect(d.ruleId).toBe('us-de.franchise-tax-annual-report')
  })

  it('flags weekend landings: 2026-03-01 is a Sunday', () => {
    expect(deFranchiseTaxDue(2025).due).toBe('2026-03-01')
    expect(new Date('2026-03-01T00:00:00Z').getUTCDay()).toBe(0) // proves the premise
    expect(deFranchiseTaxDue(2025).note).toContain('weekend')
  })

  it('rejects non-year input', () => {
    expect(() => deFranchiseTaxDue(26)).toThrow(RangeError)
  })
})

describe('form1120Due (i1120 When To File: 15th day of the 4th month)', () => {
  it('calendar-year 2026 → April 15, 2027 (a Thursday: no weekend flag)', () => {
    const d = form1120Due('2026-12-31')
    expect(d.due).toBe('2027-04-15')
    expect(new Date('2027-04-15T00:00:00Z').getUTCDay()).toBe(4)
    expect(d.needsReview).toBe(false)
    expect(d.ruleId).toBe('us-fed.1120-filing-deadline')
  })

  it('June 30 fiscal year uses the 3rd month and always needs review (statutory exception)', () => {
    // Months after 2026-06-30: Jul, Aug, Sep → September 15, 2026.
    const d = form1120Due('2026-06-30')
    expect(d.due).toBe('2026-09-15')
    expect(d.needsReview).toBe(true)
    expect(d.note).toContain('June 30')
  })

  it('handles year rollover: fiscal year ending 2026-09-30 → January 15, 2027', () => {
    expect(form1120Due('2026-09-30').due).toBe('2027-01-15')
  })

  it('rejects malformed and impossible dates', () => {
    expect(() => form1120Due('2026-13-01')).toThrow(RangeError)
    expect(() => form1120Due('2026-02-30')).toThrow(RangeError)
    expect(() => form1120Due('12/31/2026')).toThrow(RangeError)
  })
})

describe('form941Due (i941: last day of the month after the quarter)', () => {
  it('replays the instructions’ own table for 2026', () => {
    expect(form941Due(2026, 1).due).toBe('2026-04-30')
    expect(form941Due(2026, 2).due).toBe('2026-07-31')
    expect(form941Due(2026, 3).due).toBe('2026-10-31')
    expect(form941Due(2026, 4).due).toBe('2027-01-31') // rolls into the next year
  })

  it('flags the weekend landings the 2026 table produces', () => {
    // 2026-10-31 is a Saturday; 2027-01-31 is a Sunday.
    expect(new Date('2026-10-31T00:00:00Z').getUTCDay()).toBe(6)
    expect(form941Due(2026, 3).needsReview).toBe(true)
    expect(form941Due(2026, 4).needsReview).toBe(true)
    // 2026-04-30 is a Thursday: nominal date stands.
    expect(form941Due(2026, 1).needsReview).toBe(false)
  })

  it('rejects bad quarters', () => {
    expect(() => form941Due(2026, 5 as unknown as 1)).toThrow(RangeError)
  })
})

describe('election83bWindow (Form 15620: no later than 30 days after the transfer)', () => {
  it('day 30 is transfer + 30 calendar days', () => {
    // Jan 15 + 30 days: 16 remaining January days + 14 February days = Feb 14.
    expect(election83bWindow('2026-01-15').due).toBe('2026-02-14')
  })

  it('counts through a leap February', () => {
    // 2028 is a leap year: Jan 31 + 29 (all of February) + 1 = Mar 1.
    expect(election83bWindow('2028-01-31').due).toBe('2028-03-01')
  })

  it('is ALWAYS needsReview — the transfer date is a legal determination', () => {
    const d = election83bWindow('2026-03-02')
    expect(d.due).toBe('2026-04-01')
    expect(d.needsReview).toBe(true)
    expect(d.ruleId).toBe('us-fed.83b-filing-period')
    expect(d.note).toContain('file well before day 30')
  })

  it('mentions the next-business-day rule when day 30 is a weekend', () => {
    // 2026-01-15 + 30 = 2026-02-14, a Saturday.
    expect(new Date('2026-02-14T00:00:00Z').getUTCDay()).toBe(6)
    expect(election83bWindow('2026-01-15').note).toContain('next-business-day')
  })
})

describe('complianceCalendar', () => {
  it('lays out the 2026 clock for a calendar-year DE C corp with payroll', () => {
    const entries = complianceCalendar('2026-01-01', '2026-12-31', { hasPayroll: true })
    expect(entries.map((e) => [e.id, e.due])).toEqual([
      ['form-941-2025-q4', '2026-01-31'],
      ['de-franchise-tax-2025', '2026-03-01'],
      ['form-1120-2025', '2026-04-15'],
      ['form-941-2026-q1', '2026-04-30'],
      ['form-941-2026-q2', '2026-07-31'],
      ['form-941-2026-q3', '2026-10-31'],
    ])
    // Every entry carries its rule card.
    for (const e of entries) expect(e.ruleId.length).toBeGreaterThan(0)
  })

  it('omits payroll deadlines for companies without payroll', () => {
    const entries = complianceCalendar('2026-01-01', '2026-12-31')
    expect(entries.map((e) => e.id)).toEqual(['de-franchise-tax-2025', 'form-1120-2025'])
  })

  it('rejects inverted ranges', () => {
    expect(() => complianceCalendar('2026-06-01', '2026-01-01')).toThrow(RangeError)
  })

  it('is deterministic', () => {
    expect(complianceCalendar('2025-01-01', '2027-12-31', { hasPayroll: true })).toEqual(
      complianceCalendar('2025-01-01', '2027-12-31', { hasPayroll: true }),
    )
  })
})
