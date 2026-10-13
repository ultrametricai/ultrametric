// Textbook tests for the vesting module. Duties (the deadlines/grant409aSanity pattern):
// (1) every ruleId the module references resolves to a committed, jurisdiction-matched
// card; (2) every published worked example is replayed number-for-number — the Cooley GO
// standard 48/12 convention, Amazon's 5/15/40/40 back-loaded schedule (Forbes, Brumberg
// 2022-02-08), and the FAST Version 3 advisor grid (fi.co/fast, verified 2026-10-01);
// (3) the date and rounding conventions are re-derived by hand in comments; (4) the
// invariants hold (cumulative vesting never decreases, totals are exact, determinism).

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  AMAZON_BACKLOADED_RSU,
  FAST_GRID,
  RULE_IDS_VESTING,
  STANDARD_48_12,
  type VestingGrant,
  addMonthsClamped,
  applyAcceleration,
  cliffVesting,
  departureSummary,
  earlyExerciseSnapshot,
  fastAdvisorGrant,
  portfolioVestedAsOf,
  vestedAsOf,
  vestingEvents,
} from '../vesting'

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

describe('every referenced rule resolves to a committed, jurisdiction-matched card', () => {
  for (const [name, ref] of Object.entries(RULE_IDS_VESTING)) {
    it(`${name} → ${ref.ruleId}`, () => {
      const card = loadRuleCard(ref.jurisdiction, ref.ruleId)
      expect(card, `law/${ref.jurisdiction} must contain a card with id ${ref.ruleId}`).not.toBeNull()
      expect(card?.jurisdiction).toBe(ref.jurisdiction)
      expect(card?.source_ids.length).toBeGreaterThan(0)
    })
  }
})

describe('addMonthsClamped (the vesting-anniversary convention)', () => {
  it('ordinary anniversaries keep the day of month', () => {
    expect(addMonthsClamped('2026-01-15', 1)).toBe('2026-02-15')
    expect(addMonthsClamped('2026-01-15', 12)).toBe('2027-01-15')
    expect(addMonthsClamped('2026-11-15', 3)).toBe('2027-02-15')
  })

  it('CLAMPS to the last day of short months — never rolls into the next month', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsClamped('2024-01-31', 1)).toBe('2024-02-29') // leap year
    expect(addMonthsClamped('2026-08-31', 1)).toBe('2026-09-30')
    expect(addMonthsClamped('2024-02-29', 12)).toBe('2025-02-28')
  })

  it('rejects bad inputs', () => {
    expect(() => addMonthsClamped('2026-02-30', 1)).toThrow(RangeError)
    expect(() => addMonthsClamped('2026-01-15', -1)).toThrow(RangeError)
    expect(() => addMonthsClamped('jan 15', 1)).toThrow(RangeError)
  })
})

describe('the standard 4-year / 1-year-cliff monthly schedule (Cooley GO convention)', () => {
  // 4,800,000 shares so every monthly increment is exact: 4,800,000 / 48 = 100,000/month.
  const grant: VestingGrant = { shares: 4_800_000, commencement: '2026-01-15', schedule: STANDARD_48_12 }

  it('nothing vests before the cliff ("one year cliff" — Cooley GO)', () => {
    expect(vestedAsOf(grant, '2026-12-31').vestedShares).toBe(0)
    expect(vestedAsOf(grant, '2027-01-14').vestedShares).toBe(0)
  })

  it('exactly 25% vests AT the cliff (12/48 on the first anniversary, inclusive)', () => {
    const c = cliffVesting(grant)
    expect(c).toEqual({ date: '2027-01-15', shares: 1_200_000, cliff: true })
    expect(vestedAsOf(grant, '2027-01-15').vestedShares).toBe(1_200_000)
  })

  it('monthly thereafter: month 13 = 13/48, month 24 = 50%', () => {
    // floor(4,800,000 × 13/48) = 1,300,000
    expect(vestedAsOf(grant, '2027-02-15').vestedShares).toBe(1_300_000)
    expect(vestedAsOf(grant, '2028-01-15').vestedShares).toBe(2_400_000)
  })

  it('fully vested at month 48, and never more', () => {
    expect(vestedAsOf(grant, '2030-01-15').vestedShares).toBe(4_800_000)
    expect(vestedAsOf(grant, '2035-01-01').vestedShares).toBe(4_800_000)
  })

  it('cumulative-floor rounding: an odd share count floors per date and the final date takes the remainder', () => {
    const odd: VestingGrant = { shares: 1_000_000, commencement: '2026-01-15', schedule: STANDARD_48_12 }
    // Month 12: floor(1,000,000 × 12/48) = 250,000. Month 13: floor(1,000,000 × 13/48) =
    // floor(270,833.33) = 270,833 — the increment is 20,833, not a rounded 20,833.33.
    expect(vestedAsOf(odd, '2027-01-15').vestedShares).toBe(250_000)
    expect(vestedAsOf(odd, '2027-02-15').vestedShares).toBe(270_833)
    const events = vestingEvents(odd)
    expect(events[events.length - 1].cumulativeVested).toBe(1_000_000) // remainder lands on the final date
    expect(events.reduce((s, e) => s + e.sharesVested, 0)).toBe(1_000_000)
  })

  it('a month-31 commencement vests on clamped anniversaries', () => {
    const g: VestingGrant = { shares: 48_000, commencement: '2026-01-31', schedule: STANDARD_48_12 }
    const events = vestingEvents(g)
    expect(events[0].date).toBe('2027-01-31') // cliff
    expect(events[1].date).toBe('2027-02-28') // month 13, clamped
    expect(events[2].date).toBe('2027-03-31')
  })
})

describe('quarterly and annual variants (Cooley GO: "monthly or quarterly increments")', () => {
  it('quarterly 48/12: 25% at the cliff, then 15/48 at month 15', () => {
    const g: VestingGrant = {
      shares: 4_800_000,
      commencement: '2026-01-15',
      schedule: { kind: 'periodic', totalMonths: 48, cliffMonths: 12, periodMonths: 3 },
    }
    const events = vestingEvents(g)
    expect(events[0]).toMatchObject({ date: '2027-01-15', cumulativeVested: 1_200_000 })
    expect(events[1]).toMatchObject({ date: '2027-04-15', cumulativeVested: 1_500_000 }) // 15/48
    expect(events[events.length - 1]).toMatchObject({ date: '2030-01-15', cumulativeVested: 4_800_000 })
    // No vesting between quarterly dates:
    expect(vestedAsOf(g, '2027-03-15').vestedShares).toBe(1_200_000)
  })

  it('annual 48/12: four equal 25% tranches', () => {
    const g: VestingGrant = {
      shares: 1_000,
      commencement: '2026-01-15',
      schedule: { kind: 'periodic', totalMonths: 48, cliffMonths: 12, periodMonths: 12 },
    }
    expect(vestingEvents(g).map((e) => [e.date, e.sharesVested])).toEqual([
      ['2027-01-15', 250],
      ['2028-01-15', 250],
      ['2029-01-15', 250],
      ['2030-01-15', 250],
    ])
  })
})

describe("Amazon's published back-loaded 5/15/40/40 schedule (Forbes, Brumberg 2022-02-08)", () => {
  // 1,000 RSUs commencing 2026-02-21: 5% at the end of year 1, 15% at the end of year 2,
  // then 20% every six months through years 3 and 4 — so the by-year totals are
  // 50 / 150 / 400 / 400 = 5% / 15% / 40% / 40%.
  const grant: VestingGrant = { shares: 1_000, commencement: '2026-02-21', schedule: AMAZON_BACKLOADED_RSU }

  it('replays the tranche dates and amounts number-for-number', () => {
    expect(vestingEvents(grant).map((e) => [e.date, e.sharesVested, e.cumulativeVested])).toEqual([
      ['2027-02-21', 50, 50], // 5% — year 1
      ['2028-02-21', 150, 200], // 15% — year 2
      ['2028-08-21', 200, 400], // 20% — year 3, six-month point
      ['2029-02-21', 200, 600], // 20% — year 3, twelve-month point
      ['2029-08-21', 200, 800], // 20% — year 4, six-month point
      ['2030-02-21', 200, 1000], // 20% — year 4, twelve-month point
    ])
  })

  it('by-year vesting is 5/15/40/40', () => {
    const atYear = (y: number) => vestedAsOf(grant, addMonthsClamped('2026-02-21', 12 * y)).vestedShares
    expect([atYear(1), atYear(2) - atYear(1), atYear(3) - atYear(2), atYear(4) - atYear(3)]).toEqual([50, 150, 400, 400])
  })

  it('tranche fractions must sum to 1', () => {
    const bad: VestingGrant = {
      shares: 100,
      commencement: '2026-01-01',
      schedule: { kind: 'tranches', tranches: [{ monthsFromStart: 12, fraction: 0.5 }] },
    }
    expect(() => vestingEvents(bad)).toThrow(/sum to 1/)
  })
})

describe('FAST advisor grants (Founder Institute FAST Agreement, Version 3 - July 2026)', () => {
  it('encodes the published grid exactly', () => {
    expect(FAST_GRID.pct.standard).toEqual({ 'pre-seed': 0.5, seed: 0.25, 'series-a': 0.1 })
    expect(FAST_GRID.pct.expert).toEqual({ 'pre-seed': 1.0, seed: 0.75, 'series-a': 0.5 })
    expect(FAST_GRID.vesting).toEqual({ totalMonths: 24, cliffMonths: 3 })
  })

  it('a pre-seed expert advisor on a 10,000,000-share table gets 1% = 100,000 shares, 24/3 monthly', () => {
    const g = fastAdvisorGrant('pre-seed', 'expert', 10_000_000, '2026-03-01')
    expect(g.shares).toBe(100_000)
    expect(g.gridPct).toBe(1.0)
    // Three-month cliff: floor(100,000 × 3/24) = 12,500 vests on 2026-06-01, nothing before.
    expect(vestedAsOf(g, '2026-05-31').vestedShares).toBe(0)
    expect(vestedAsOf(g, '2026-06-01').vestedShares).toBe(12_500)
    expect(vestedAsOf(g, '2028-03-01').vestedShares).toBe(100_000)
  })

  it('a seed standard advisor gets 0.25%', () => {
    expect(fastAdvisorGrant('seed', 'standard', 10_000_000, '2026-03-01').shares).toBe(25_000)
  })
})

describe('departure: the unvested-repurchase summary (Cooley GO, Founder departures)', () => {
  it('a founder leaving at month 18 of 48/12 keeps 18/48 vested; the rest is repurchasable', () => {
    const g: VestingGrant = { shares: 4_800_000, commencement: '2026-01-15', schedule: STANDARD_48_12 }
    const d = departureSummary(g, '2027-07-15')
    expect(d.vestedShares).toBe(1_800_000)
    expect(d.repurchasableShares).toBe(3_000_000)
    expect(d.needsReview).toBe(true)
    expect(d.note).toContain('repurchase')
  })

  it('leaving before the cliff forfeits everything ("no stock is vested" — Cooley GO)', () => {
    const g: VestingGrant = { shares: 4_800_000, commencement: '2026-01-15', schedule: STANDARD_48_12 }
    expect(departureSummary(g, '2026-11-01').vestedShares).toBe(0)
  })

  it('termination caps vesting even when measured later', () => {
    const g: VestingGrant = { shares: 4_800_000, commencement: '2026-01-15', schedule: STANDARD_48_12 }
    const p = vestedAsOf(g, '2029-01-15', '2027-07-15')
    expect(p.vestedShares).toBe(1_800_000)
    expect(p.measuredOn).toBe('2027-07-15')
  })
})

describe('acceleration (Cooley GO, "Pulling the Trigger(s)")', () => {
  const grant: VestingGrant = { shares: 4_800_000, commencement: '2026-01-15', schedule: STANDARD_48_12 }

  it('single trigger, full: the sale alone accelerates all unvested shares', () => {
    // Sale at month 24: 2,400,000 vested, 2,400,000 unvested → all accelerate.
    const o = applyAcceleration(grant, { trigger: 'single', acceleration: { kind: 'full' } }, { saleOn: '2028-01-15' })
    expect(o.triggered).toBe(true)
    expect(o.vestedBeforeAcceleration).toBe(2_400_000)
    expect(o.acceleratedShares).toBe(2_400_000)
    expect(o.unvestedRemaining).toBe(0)
  })

  it('double trigger requires the termination to FOLLOW the sale', () => {
    const policy = { trigger: 'double' as const, acceleration: { kind: 'full' as const } }
    expect(applyAcceleration(grant, policy, { saleOn: '2028-01-15' }).triggered).toBe(false)
    expect(
      applyAcceleration(grant, policy, { saleOn: '2028-01-15', terminationWithoutCauseOn: '2028-01-01' }).triggered,
    ).toBe(false) // termination BEFORE the sale is not the double-trigger formulation
    const o = applyAcceleration(grant, policy, { saleOn: '2028-01-15', terminationWithoutCauseOn: '2028-04-15' })
    expect(o.triggered).toBe(true)
    expect(o.effectiveOn).toBe('2028-04-15')
    // Vested at month 27 = floor(4.8M × 27/48) = 2,700,000; the remaining 2,100,000 accelerate.
    expect(o.vestedBeforeAcceleration).toBe(2_700_000)
    expect(o.acceleratedShares).toBe(2_100_000)
  })

  it('percentOfUnvested: 50% of the unvested shares, floored', () => {
    const o = applyAcceleration(
      grant,
      { trigger: 'single', acceleration: { kind: 'percentOfUnvested', pct: 50 } },
      { saleOn: '2028-01-15' },
    )
    expect(o.acceleratedShares).toBe(1_200_000) // 50% of 2,400,000
    expect(o.unvestedRemaining).toBe(1_200_000)
  })

  it('monthsOfService: 12 extra months of credit, capped at the unvested balance', () => {
    // Sale at month 24: vested 2,400,000. Credit 12 months → as-if month 36 = 3,600,000.
    const o = applyAcceleration(
      grant,
      { trigger: 'single', acceleration: { kind: 'monthsOfService', months: 12 } },
      { saleOn: '2028-01-15' },
    )
    expect(o.acceleratedShares).toBe(1_200_000)
    expect(o.vestedAfterAcceleration).toBe(3_600_000)
    // Credit past the end of the schedule caps at full vesting:
    const late = applyAcceleration(
      grant,
      { trigger: 'single', acceleration: { kind: 'monthsOfService', months: 36 } },
      { saleOn: '2029-01-15' }, // month 36: 3,600,000 vested
    )
    expect(late.vestedAfterAcceleration).toBe(4_800_000)
  })

  it('rejects malformed specs', () => {
    expect(() =>
      applyAcceleration(grant, { trigger: 'single', acceleration: { kind: 'percentOfUnvested', pct: 0 } }, { saleOn: '2028-01-15' }),
    ).toThrow(RangeError)
    expect(() =>
      applyAcceleration(grant, { trigger: 'single', acceleration: { kind: 'monthsOfService', months: 0 } }, { saleOn: '2028-01-15' }),
    ).toThrow(RangeError)
  })
})

describe('refresh / evergreen composition (Rewarding Talent practice: additive new grants)', () => {
  it('a refresh grant adds its own schedule; nothing about the old grant changes', () => {
    const initial: VestingGrant = { name: 'initial', shares: 48_000, commencement: '2026-01-15', schedule: STANDARD_48_12 }
    const refresh: VestingGrant = { name: 'refresh', shares: 24_000, commencement: '2028-01-15', schedule: STANDARD_48_12 }
    // At 2029-01-15: initial is at month 36 = 36,000; refresh at month 12 (its cliff) = 6,000.
    const p = portfolioVestedAsOf([initial, refresh], '2029-01-15')
    expect(p.grants).toEqual([
      { name: 'initial', vested: 36_000, unvested: 12_000 },
      { name: 'refresh', vested: 6_000, unvested: 18_000 },
    ])
    expect(p.vestedShares).toBe(42_000)
    expect(p.unvestedShares).toBe(30_000)
  })
})

describe('early exercise — the 83(b)/tax-module interface (stated, never computed)', () => {
  const grant: VestingGrant = {
    shares: 48_000,
    commencement: '2026-01-15',
    schedule: STANDARD_48_12,
    earlyExercisable: true,
  }

  it('reports the restricted (unvested) share count and points at the tax module and deadline rule', () => {
    const s = earlyExerciseSnapshot(grant, '2026-07-15') // pre-cliff: everything restricted
    expect(s.vestedShares).toBe(0)
    expect(s.restrictedShares).toBe(48_000)
    expect(s.ruleId).toBe('us-fed.83b-filing-period')
    expect(s.taxInterface).toContain('tax module')
    expect(s.taxInterface).toContain('deadlines.election83bWindow')
    expect(s.needsReview).toBe(true)
  })

  it('refuses when the grant is not early-exercisable (a plan term, not a default)', () => {
    expect(() => earlyExerciseSnapshot({ ...grant, earlyExercisable: false }, '2026-07-15')).toThrow(/earlyExercisable/)
  })
})

describe('properties', () => {
  const grants: VestingGrant[] = [
    { shares: 1_000_000, commencement: '2026-01-31', schedule: STANDARD_48_12 },
    { shares: 999, commencement: '2026-02-28', schedule: { kind: 'periodic', totalMonths: 36, cliffMonths: 6, periodMonths: 3 } },
    { shares: 1_000, commencement: '2026-02-21', schedule: AMAZON_BACKLOADED_RSU },
    { shares: 7, commencement: '2026-06-01', schedule: { kind: 'periodic', totalMonths: 48, cliffMonths: 0, periodMonths: 1 } },
  ]

  it('cumulative vesting never decreases, increments are non-negative, totals are exact', () => {
    for (const g of grants) {
      const events = vestingEvents(g)
      let prev = 0
      for (const e of events) {
        expect(e.sharesVested).toBeGreaterThanOrEqual(0)
        expect(e.cumulativeVested).toBeGreaterThanOrEqual(prev)
        prev = e.cumulativeVested
      }
      expect(events[events.length - 1].cumulativeVested).toBe(Math.floor(g.shares))
      expect(events.reduce((s, e) => s + e.sharesVested, 0)).toBe(Math.floor(g.shares))
    }
  })

  it('vestedAsOf agrees with the event list at every event date', () => {
    for (const g of grants) {
      for (const e of vestingEvents(g)) {
        expect(vestedAsOf(g, e.date).vestedShares).toBe(e.cumulativeVested)
      }
    }
  })

  it('is deterministic', () => {
    for (const g of grants) {
      expect(vestingEvents(g)).toEqual(vestingEvents(g))
    }
  })
})
