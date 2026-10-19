// Textbook tests for the Delaware franchise tax module. Two duties (the deadlines-module
// pattern): (1) every ruleId in DE_FRANCHISE_RULE_IDS resolves to a committed,
// jurisdiction-matched card in open-law/US-DE/ with primary sources; (2) the Division of
// Corporations' OWN published worked examples (corp.delaware.gov/frtaxcalc, verified live
// 2026-10-01) are replayed number-for-number — the default authorized-shares bill vs the
// recomputed assumed-par bill is the comparison the comparator exists for.

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  DE_FRANCHISE_PARAMS,
  DE_FRANCHISE_RULE_IDS,
  assumedParValueCapitalTax,
  authorizedSharesMethodTax,
  compareFranchiseTaxMethods,
  largeCorporateFilerTax,
} from '../deFranchiseTax'

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
  for (const [name, ref] of Object.entries(DE_FRANCHISE_RULE_IDS)) {
    it(`${name} → ${ref.ruleId}`, () => {
      const card = loadRuleCard(ref.jurisdiction, ref.ruleId)
      expect(card, `open-law/${ref.jurisdiction} must contain a card with id ${ref.ruleId}`).not.toBeNull()
      expect(card?.jurisdiction).toBe(ref.jurisdiction)
      expect(card?.kind).toBe('legal')
      expect(card?.source_ids.length).toBeGreaterThan(0)
    })
  }
})

describe('Authorized Shares Method (rule us-de.franchise-tax-authorized-shares-method)', () => {
  it("replays the Division's first published example: 10,005 shares -> $335 ($250 + $85)", () => {
    expect(authorizedSharesMethodTax(10_005).tax).toBe(335)
  })

  it("replays the Division's second published example: 100,000 shares -> $1,015 ($250 + $85 x 9)", () => {
    // 100,000 - 10,000 = 90,000 above the second tier; 90,000 / 10,000 = 9 full blocks.
    expect(authorizedSharesMethodTax(100_000).tax).toBe(1015)
  })

  it('tier boundaries: 5,000 -> $175 minimum; 5,001 and 10,000 -> $250; 10,001 -> $335', () => {
    expect(authorizedSharesMethodTax(1).tax).toBe(175)
    expect(authorizedSharesMethodTax(5000).tax).toBe(175)
    expect(authorizedSharesMethodTax(5001).tax).toBe(250)
    expect(authorizedSharesMethodTax(10_000).tax).toBe(250)
    expect(authorizedSharesMethodTax(10_001).tax).toBe(335) // "or part thereof"
    expect(authorizedSharesMethodTax(20_000).tax).toBe(335)
    expect(authorizedSharesMethodTax(20_001).tax).toBe(420)
  })

  it('the common startup table: 10,000,000 authorized shares -> $250 + $85 x 999 = $85,165', () => {
    // (10,000,000 - 10,000) / 10,000 = 999 blocks exactly.
    expect(authorizedSharesMethodTax(10_000_000).tax).toBe(85_165)
  })

  it('caps at the $200,000 maximum (8 Del. C. § 503(c))', () => {
    expect(authorizedSharesMethodTax(1_000_000_000).tax).toBe(DE_FRANCHISE_PARAMS.maxTax)
  })

  it('tax is monotonic in authorized shares and always within [min, max]', () => {
    let prev = 0
    for (const shares of [1, 5000, 5001, 9999, 10_000, 10_001, 55_000, 10 ** 6, 10 ** 8, 10 ** 10]) {
      const tax = authorizedSharesMethodTax(shares).tax
      expect(tax).toBeGreaterThanOrEqual(prev)
      expect(tax).toBeGreaterThanOrEqual(DE_FRANCHISE_PARAMS.minAuthorizedTax)
      expect(tax).toBeLessThanOrEqual(DE_FRANCHISE_PARAMS.maxTax)
      prev = tax
    }
  })

  it('every result demands review and flags the $5,000 installment threshold honestly', () => {
    const small = authorizedSharesMethodTax(5000)
    expect(small.needsReview).toBe(true)
    expect(small.quarterlyInstallmentsLikely).toBe(false)
    expect(authorizedSharesMethodTax(10_000_000).quarterlyInstallmentsLikely).toBe(true)
    expect(small.asOf).toBe(DE_FRANCHISE_PARAMS.asOf)
  })

  it('rejects non-positive and fractional share counts', () => {
    expect(() => authorizedSharesMethodTax(0)).toThrow(RangeError)
    expect(() => authorizedSharesMethodTax(100.5)).toThrow(RangeError)
  })
})

describe('Assumed Par Value Capital Method (rule us-de.franchise-tax-assumed-par-method)', () => {
  // The Division's OWN published example, replayed number-for-number:
  // gross assets $1,000,000; issued 485,000; authorized 1,000,000 x $1.00 par and
  // 250,000 x $5.00 par.
  const DIVISION_EXAMPLE = {
    totalGrossAssets: 1_000_000,
    totalIssuedShares: 485_000,
    authorizedClasses: [
      { shares: 1_000_000, parValue: 1 },
      { shares: 250_000, parValue: 5 },
    ],
  }

  it("replays the Division's published example step by step", () => {
    const r = assumedParValueCapitalTax(DIVISION_EXAMPLE)
    // Step 1: 1,000,000 / 485,000 = 2.06185567... carried to 6 decimals -> 2.061856
    expect(r.assumedPar).toBe(2.061856)
    // Step 2: $1.00 par < assumed par -> 1,000,000 x 2.061856 = 2,061,856
    // Step 3: $5.00 par > assumed par -> 250,000 x 5 = 1,250,000
    // Step 4: 2,061,856 + 1,250,000 = 3,311,856
    expect(r.assumedParValueCapital).toBe(3_311_856)
    // Step 5: over $1,000,000 -> round UP to 4 million -> 4 x $400 = $1,600
    expect(r.taxableMillions).toBe(4)
    expect(r.tax).toBe(1600)
    expect(r.needsReview).toBe(true)
  })

  it('the 6-decimal carry matches rounding, not truncation (module-header note)', () => {
    // 1,000,000 / 485,000 = 2.0618556701...; truncation would give 2.061855 and a
    // different capital. The Division's published 2.061856 pins the convention.
    expect(assumedParValueCapitalTax(DIVISION_EXAMPLE).assumedPar).not.toBe(2.061855)
  })

  it('at or under $1,000,000 of assumed par value capital the minimum $400 applies', () => {
    const r = assumedParValueCapitalTax({
      totalGrossAssets: 50_000,
      totalIssuedShares: 100_000,
      authorizedClasses: [{ shares: 1_000_000, parValue: 0.0001 }],
    })
    // assumed par = 0.5; all par (0.0001) < 0.5 -> capital = 1,000,000 x 0.5 = 500,000
    expect(r.assumedParValueCapital).toBe(500_000)
    expect(r.tax).toBe(400)
  })

  it('an exact-million capital does not round up: $3,000,000 -> 3 x $400 = $1,200', () => {
    const r = assumedParValueCapitalTax({
      totalGrossAssets: 3_000_000,
      totalIssuedShares: 1_000_000,
      authorizedClasses: [{ shares: 1_000_000, parValue: 0.01 }],
    })
    // assumed par = 3.000000; capital = 1,000,000 x 3 = 3,000,000 exactly.
    expect(r.taxableMillions).toBe(3)
    expect(r.tax).toBe(1200)
  })

  it('caps at $200,000 and refuses no-par or zero-par classes (out of scope, rule caveat)', () => {
    const big = assumedParValueCapitalTax({
      totalGrossAssets: 1e12,
      totalIssuedShares: 1_000_000,
      authorizedClasses: [{ shares: 1_000_000, parValue: 0.01 }],
    })
    expect(big.tax).toBe(200_000)
    expect(() =>
      assumedParValueCapitalTax({
        totalGrossAssets: 1_000_000,
        totalIssuedShares: 1000,
        authorizedClasses: [{ shares: 1000, parValue: 0 }],
      }),
    ).toThrow(/no-par/)
  })

  it('a class whose par equals the assumed par counts identically under either step', () => {
    // assumed par = 2,000,000 / 1,000,000 = 2.000000; 500,000 × $2.00 = $1,000,000 either way.
    const r = assumedParValueCapitalTax({
      totalGrossAssets: 2_000_000,
      totalIssuedShares: 1_000_000,
      authorizedClasses: [{ shares: 500_000, parValue: 2 }],
    })
    expect(r.assumedPar).toBe(2)
    expect(r.assumedParValueCapital).toBe(1_000_000)
    expect(r.tax).toBe(400) // exactly $1,000,000 → 1 million → the $400 minimum
  })

  it('rejects a negative par value the same way as a zero one', () => {
    expect(() =>
      assumedParValueCapitalTax({
        totalGrossAssets: 1_000_000,
        totalIssuedShares: 1000,
        authorizedClasses: [{ shares: 1000, parValue: -0.01 }],
      }),
    ).toThrow(/no-par/)
  })

  it('rejects non-positive assets, shares, and empty class lists', () => {
    expect(() =>
      assumedParValueCapitalTax({ totalGrossAssets: 0, totalIssuedShares: 1, authorizedClasses: [{ shares: 1, parValue: 1 }] }),
    ).toThrow(RangeError)
    expect(() =>
      assumedParValueCapitalTax({ totalGrossAssets: 1, totalIssuedShares: 0, authorizedClasses: [{ shares: 1, parValue: 1 }] }),
    ).toThrow(RangeError)
    expect(() =>
      assumedParValueCapitalTax({ totalGrossAssets: 1, totalIssuedShares: 1, authorizedClasses: [] }),
    ).toThrow(RangeError)
  })
})

describe('largeCorporateFilerTax (8 Del. C. § 503(c), existence surfaced only)', () => {
  it('returns the fixed $250,000 and says qualification is unverified', () => {
    const r = largeCorporateFilerTax()
    expect(r.tax).toBe(250_000)
    expect(r.needsReview).toBe(true)
    expect(r.note).toContain('NOT verified')
  })
})

describe('compareFranchiseTaxMethods — both published methods on the Division’s example', () => {
  it("the Division's example company: default bill $10,790, recomputed $1,600, saving $9,190", () => {
    const cmp = compareFranchiseTaxMethods({
      totalGrossAssets: 1_000_000,
      totalIssuedShares: 485_000,
      authorizedClasses: [
        { shares: 1_000_000, parValue: 1 },
        { shares: 250_000, parValue: 5 },
      ],
    })
    // Authorized Shares Method on 1,250,000 total authorized:
    // $250 + $85 x ceil(1,240,000 / 10,000) = $250 + $85 x 124 = $10,790.
    expect(cmp.authorizedShares.tax).toBe(10_790)
    expect(cmp.assumedPar.tax).toBe(1600)
    expect(cmp.cheaper).toBe('assumed-par-value-capital')
    expect(cmp.saving).toBe(9190)
    expect(cmp.needsReview).toBe(true)
    expect(cmp.note).toContain('never an authorization')
  })

  it('reports the default bill as cheaper when it is (tiny authorization, huge assets)', () => {
    const cmp = compareFranchiseTaxMethods({
      totalGrossAssets: 50_000_000,
      totalIssuedShares: 1000,
      authorizedClasses: [{ shares: 1000, parValue: 0.01 }],
    })
    // Authorized: 1,000 shares -> $175. Assumed par = 50,000; capital = 50,000,000 ->
    // 50 x $400 = $20,000. The default bill wins.
    expect(cmp.authorizedShares.tax).toBe(175)
    expect(cmp.assumedPar.tax).toBe(20_000)
    expect(cmp.cheaper).toBe('authorized-shares')
    expect(cmp.saving).toBe(19_825)
  })

  it('is deterministic', () => {
    const inputs = {
      totalGrossAssets: 1_000_000,
      totalIssuedShares: 485_000,
      authorizedClasses: [
        { shares: 1_000_000, parValue: 1 },
        { shares: 250_000, parValue: 5 },
      ],
    }
    expect(compareFranchiseTaxMethods(inputs)).toEqual(compareFranchiseTaxMethods(inputs))
  })
})
