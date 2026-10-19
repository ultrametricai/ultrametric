// Textbook tests for the convertible-note module. Sources cited in the module header, all
// verified live 2026-10-01:
// - Cooley GO, "Calculating Share Price With Outstanding Convertible Notes or Safes"
//   (Derek Colla, last reviewed 2022-01-24) — its full worked example is replayed
//   number-for-number below: $8M pre-money, $10M post, $2M Series A, $1M of notes
//   (principal + accrued interest) at a 30% discount, 1,000,000 fully diluted shares.
// - Cooley GO, "Understanding the Valuation Cap" (last reviewed 2023-02-02): a $3M cap
//   against a $10M pre-financing valuation is a 70% discount.
// - Cooley GO, "Primer on Convertible Debt" (Peter Werner, last reviewed 2025-09-02):
//   a $1,000,000 note converting where the issuer is valued at $100 million → 1%.
// Interest arithmetic is hand-derived (the primer states conventions, not numbers):
//   $500,000 at 5% simple, actual/365, for exactly 365 days = $25,000.

import { describe, expect, it } from 'vitest'
import {
  NOTE_VS_SAFE,
  accruedSimpleInterest,
  capImpliedDiscountPct,
  convertNote,
  daysBetween,
  maturityStatus,
  noteBalance,
  noteConversionPrice,
  seriesPricingWithNotes,
  type ConvertibleNoteFields,
} from '../convertibleNote'

const NOTE: ConvertibleNoteFields = {
  name: 'Angel note',
  principal: 500_000,
  annualRatePct: 5,
  issuedOn: '2025-03-01',
  maturityOn: '2027-03-01',
}

describe('daysBetween (actual-day count, UTC)', () => {
  it('counts actual days, spanning months and a non-leap year', () => {
    expect(daysBetween('2025-03-01', '2026-03-01')).toBe(365)
    expect(daysBetween('2025-03-01', '2025-05-13')).toBe(73)
    expect(daysBetween('2025-03-01', '2025-03-01')).toBe(0)
  })

  it('rejects reversed ranges and malformed dates', () => {
    expect(() => daysBetween('2025-03-02', '2025-03-01')).toThrow(RangeError)
    expect(() => daysBetween('2025-02-30', '2025-03-01')).toThrow(RangeError)
    expect(() => daysBetween('03/01/2025', '2025-03-02')).toThrow(RangeError)
  })
})

describe('accruedSimpleInterest (simple, actual/basis — the only convention implemented)', () => {
  it('$500,000 at 5% for exactly 365 days accrues $25,000 (hand-derived)', () => {
    const a = accruedSimpleInterest(500_000, 5, '2025-03-01', '2026-03-01')
    expect(a.days).toBe(365)
    expect(a.basisDays).toBe(365)
    expect(a.interest).toBe(25_000)
    expect(a.total).toBe(525_000)
    // The note's own text controls compounding and basis — always flagged.
    expect(a.needsReview).toBe(true)
  })

  it('73 days is exactly a fifth of the year: 500,000 × 5% × 73/365 = $5,000', () => {
    expect(accruedSimpleInterest(500_000, 5, '2025-03-01', '2025-05-13').interest).toBe(5_000)
  })

  it('supports a 360-day basis: 180 days at 5% on $500,000 = $12,500', () => {
    // 500,000 × 0.05 × 180/360 = 12,500. 2025-03-01 + 180 days = 2025-08-28.
    const a = accruedSimpleInterest(500_000, 5, '2025-03-01', '2025-08-28', { basisDays: 360 })
    expect(a.days).toBe(180)
    expect(a.interest).toBe(12_500)
  })

  it('zero rate and zero days both accrue nothing', () => {
    expect(accruedSimpleInterest(500_000, 0, '2025-03-01', '2026-03-01').interest).toBe(0)
    expect(accruedSimpleInterest(500_000, 5, '2025-03-01', '2025-03-01').interest).toBe(0)
  })

  it('rejects non-positive principal and negative rates', () => {
    expect(() => accruedSimpleInterest(0, 5, '2025-03-01', '2026-03-01')).toThrow(RangeError)
    expect(() => accruedSimpleInterest(1, -1, '2025-03-01', '2026-03-01')).toThrow(RangeError)
  })

  it('a leap year accrues 366/365ths of the annual rate (actual-day convention)', () => {
    // 2024-01-01 → 2025-01-01 is 366 days: 500,000 × 5% × 366/365 = 25,068.49.
    const a = accruedSimpleInterest(500_000, 5, '2024-01-01', '2025-01-01')
    expect(a.days).toBe(366)
    expect(a.interest).toBe(25_068.49)
  })
})

describe('noteBalance', () => {
  it('principal + accrued interest at the as-of date', () => {
    const b = noteBalance(NOTE, '2026-03-01')
    expect(b.principal).toBe(500_000)
    expect(b.interest).toBe(25_000)
    expect(b.total).toBe(525_000)
  })
})

describe('noteConversionPrice (cap and discount "in the alternative" — Cooley GO primer)', () => {
  it('takes the lowest of round price, discount price, cap price', () => {
    // Round $1.00; 20% discount → $0.80; $4M cap over 10M shares → $0.40: cap wins.
    const p = noteConversionPrice({ roundPps: 1, discountPct: 20, cap: 4_000_000, capCapitalizationShares: 10_000_000 })
    expect(p.price).toBe(0.4)
    expect(p.method).toBe('cap')
    expect(p.discountPrice).toBe(0.8)
    expect(p.capPrice).toBe(0.4)
  })

  it('the discount wins when the round prices below the cap', () => {
    // $8M cap over 10M shares → $0.80 cap price; round $0.50 with 20% discount → $0.40.
    const p = noteConversionPrice({ roundPps: 0.5, discountPct: 20, cap: 8_000_000, capCapitalizationShares: 10_000_000 })
    expect(p.price).toBe(0.4)
    expect(p.method).toBe('discount')
  })

  it('no cap, no discount: the round price applies', () => {
    const p = noteConversionPrice({ roundPps: 1.1144 })
    expect(p.price).toBe(1.1144)
    expect(p.method).toBe('pps')
  })

  it('refuses a cap without the note\'s own capitalization share count (contract-specific)', () => {
    expect(() => noteConversionPrice({ roundPps: 1, cap: 4_000_000 })).toThrow(/capitalization/)
  })

  it('rejects out-of-range discounts and non-positive prices', () => {
    expect(() => noteConversionPrice({ roundPps: 0 })).toThrow(RangeError)
    expect(() => noteConversionPrice({ roundPps: 1, discountPct: 100 })).toThrow(RangeError)
    expect(() => noteConversionPrice({ roundPps: 1, discountPct: 0 })).toThrow(RangeError)
  })

  it('property: the effective price never exceeds the round price', () => {
    for (const d of [5, 15, 25, 50, 99]) {
      for (const cap of [1_000_000, 5_000_000, 50_000_000]) {
        const p = noteConversionPrice({ roundPps: 2, discountPct: d, cap, capCapitalizationShares: 10_000_000 })
        expect(p.price).toBeLessThanOrEqual(2)
        expect(p.price).toBeGreaterThan(0)
      }
    }
  })
})

describe('noteConversionPrice guards', () => {
  it('rejects a cap price that rounds to zero at 4 decimals', () => {
    expect(() =>
      noteConversionPrice({ roundPps: 1, cap: 40, capCapitalizationShares: 10_000_000 }),
    ).toThrow(/rounds to zero/)
  })
})

describe('capImpliedDiscountPct (Cooley GO, "Understanding the Valuation Cap")', () => {
  it('a $3M cap against a $10M pre-financing valuation is a 70% discount (article figure)', () => {
    expect(capImpliedDiscountPct(3_000_000, 10_000_000)).toBe(70)
  })

  it('0 when the round prices at or below the cap', () => {
    expect(capImpliedDiscountPct(10_000_000, 8_000_000)).toBe(0)
    expect(capImpliedDiscountPct(10_000_000, 10_000_000)).toBe(0)
  })
})

describe('convertNote', () => {
  it('primer micro-example: a $1,000,000 note at a $100M valuation converts to 1%', () => {
    // Issuer valued at $100M with 100,000,000 shares → $1.00/share; no cap or discount.
    // $1,000,000 / $1.00 = 1,000,000 shares of 100,000,000 + 1,000,000 ≈ 1% (the primer
    // quotes the ownership outcome, not a share count).
    const zeroInterest: ConvertibleNoteFields = { name: 'n', principal: 1_000_000, annualRatePct: 0, issuedOn: '2025-01-01' }
    const c = convertNote(zeroInterest, '2026-01-01', { roundPps: 1 })
    expect(c.shares).toBe(1_000_000)
    expect((c.shares / (100_000_000 + c.shares)) * 100).toBeCloseTo(1, 1)
  })

  it('interest converts on the same terms as principal by default', () => {
    // Balance $525,000 at 2026-03-01; 20% discount off $1.00 → $0.80; 525,000/0.80 = 656,250.
    const c = convertNote(NOTE, '2026-03-01', { roundPps: 1, discountPct: 20 })
    expect(c.amountConverted).toBe(525_000)
    expect(c.interestRepaid).toBe(0)
    expect(c.conversionPrice).toBe(0.8)
    expect(c.shares).toBe(656_250)
    expect(c.needsReview).toBe(true)
  })

  it("interestTreatment 'repay' converts principal only and repays the interest in cash", () => {
    const c = convertNote(NOTE, '2026-03-01', { roundPps: 1, discountPct: 20, interestTreatment: 'repay' })
    expect(c.amountConverted).toBe(500_000)
    expect(c.interestRepaid).toBe(25_000)
    expect(c.shares).toBe(625_000) // 500,000 / 0.80
  })
})

describe('maturityStatus (surfaced, never decided)', () => {
  it('before maturity: not matured, balance accrued to the as-of date', () => {
    const m = maturityStatus(NOTE, '2026-03-01')
    expect(m.matured).toBe(false)
    expect(m.balance).toBe(525_000)
    expect(m.needsReview).toBe(true)
    expect(m.publishedPaths).toHaveLength(3)
  })

  it('at/after maturity: matured, balance frozen at the maturity date (the amount due)', () => {
    const m = maturityStatus(NOTE, '2028-01-01')
    expect(m.matured).toBe(true)
    // 2025-03-01 → 2027-03-01 is 730 days: 500,000 × 5% × 730/365 = 50,000.
    expect(m.balance).toBe(550_000)
  })

  it('throws when the note has no maturity date', () => {
    expect(() => maturityStatus({ ...NOTE, maturityOn: undefined }, '2026-01-01')).toThrow(RangeError)
  })
})

// ---------------------------------------------------------------------------
// The Cooley GO three-method worked example, number-for-number
// ---------------------------------------------------------------------------

describe('seriesPricingWithNotes (Cooley GO, Colla: $8M pre, $2M new, $1M notes, 30% discount, 1M shares)', () => {
  const INPUT = {
    preMoney: 8_000_000,
    newMoney: 2_000_000,
    noteBalanceConverting: 1_000_000,
    discountPct: 30,
    preRoundFullyDiluted: 1_000_000,
  }
  const out = seriesPricingWithNotes(INPUT)

  it('pre-money method: $8.00 / $5.60, ownership 70% / 12.50% / 17.50%', () => {
    const m = out['pre-money']
    expect(m.pps).toBe(8) // 8,000,000 / 1,000,000
    expect(m.conversionPrice).toBe(5.6) // 8.00 × 0.70
    expect(m.noteShares).toBe(178_571) // floor(1,000,000 / 5.60)
    expect(m.newMoneyShares).toBe(250_000) // 2,000,000 / 8.00
    expect(m.ownershipPct.existing).toBeCloseTo(70, 3)
    expect(m.ownershipPct.notes).toBeCloseTo(12.5, 3)
    expect(m.ownershipPct.newMoney).toBeCloseTo(17.5, 3)
  })

  it('percentage-ownership method: $6.57 / $4.60, ownership 65.71% / 14.29% / 20%', () => {
    // pps = (8,000,000 − 1,000,000/0.70) / 1,000,000 = 6.571428… → $6.5714 (the article
    // prints $6.57); conversion price 6.5714 × 0.70 = $4.60.
    const m = out['percentage-ownership']
    expect(m.pps).toBe(6.5714)
    expect(m.conversionPrice).toBe(4.6)
    expect(m.noteShares).toBe(217_391) // floor(1,000,000 / 4.60)
    expect(m.ownershipPct.existing).toBeCloseTo(65.71, 2)
    expect(m.ownershipPct.notes).toBeCloseTo(14.29, 2)
    expect(m.ownershipPct.newMoney).toBeCloseTo(20, 2)
  })

  it('dollars-invested method: $7.57 / $5.30, ownership 68.83% / 12.99% / 18.18%', () => {
    // pps = (8,000,000 + 1,000,000 − 1,000,000/0.70) / 1,000,000 = 7.571428… → $7.5714;
    // conversion price 7.5714 × 0.70 = $5.30. New money = 2/11 of post = 18.18%.
    const m = out['dollars-invested']
    expect(m.pps).toBe(7.5714)
    expect(m.conversionPrice).toBe(5.3)
    expect(m.noteShares).toBe(188_679) // floor(1,000,000 / 5.30)
    expect(m.ownershipPct.existing).toBeCloseTo(68.83, 2)
    expect(m.ownershipPct.notes).toBeCloseTo(12.99, 2)
    expect(m.ownershipPct.newMoney).toBeCloseTo(18.18, 2)
  })

  it("the article's key insight: without a discount, dollars-invested leaves the new investors' percentage unchanged", () => {
    const noDiscount = seriesPricingWithNotes({ ...INPUT, discountPct: 0 })
    // New investors own newMoney / (pre + new + notes) = 2/11 = 18.18% either way.
    expect(noDiscount['dollars-invested'].ownershipPct.newMoney).toBeCloseTo((2 / 11) * 100, 2)
  })

  it('property: each method sums to 100% and never produces negative shares', () => {
    for (const m of Object.values(out)) {
      const { existing, notes, newMoney } = m.ownershipPct
      expect(existing + notes + newMoney).toBeCloseTo(100, 8)
      expect(m.noteShares).toBeGreaterThanOrEqual(0)
      expect(m.newMoneyShares).toBeGreaterThanOrEqual(0)
    }
  })

  it('rejects a note balance too large for the pre-money (price would go non-positive)', () => {
    expect(() =>
      seriesPricingWithNotes({ ...INPUT, noteBalanceConverting: 6_000_000 }),
    ).toThrow(RangeError)
  })
})

describe('seriesPricingWithNotes edges', () => {
  it('a zero note balance collapses every method to the plain round price', () => {
    const out = seriesPricingWithNotes({
      preMoney: 8_000_000,
      newMoney: 2_000_000,
      noteBalanceConverting: 0,
      discountPct: 30,
      preRoundFullyDiluted: 1_000_000,
    })
    for (const m of Object.values(out)) {
      expect(m.pps).toBe(8)
      expect(m.noteShares).toBe(0)
    }
  })
})

describe('NOTE_VS_SAFE (structural differences, each line cited)', () => {
  it('covers maturity, interest, priority, and the conversion trigger with sources', () => {
    expect(NOTE_VS_SAFE.map((d) => d.topic)).toEqual(['maturity', 'interest', 'priority', 'conversion trigger'])
    for (const d of NOTE_VS_SAFE) {
      expect(d.source.length).toBeGreaterThan(0)
      expect(d.note.length).toBeGreaterThan(0)
      expect(d.safe.length).toBeGreaterThan(0)
    }
  })
})
