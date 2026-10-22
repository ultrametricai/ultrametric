// Delaware franchise tax — both published computation methods, exactly (founder directive
// 2026-10-01: "go super deep on business logic — tax mechanics, everything").
//
// Pure, client-safe, deterministic. Every formula here is a dated rule card in open-law/US-DE/
// citing the primary sources (8 Del. C. § 503 and the Division of Corporations' own
// calculation page, corp.delaware.gov/frtaxcalc — both verified live 2026-10-01):
// - us-de.franchise-tax-authorized-shares-method — the $175/$250/+$85-per-10,000 tiers, the
//   $200,000 maximum, the $250,000 Large Corporate Filer amount, and the Division's two
//   worked examples (10,005 shares -> $335; 100,000 shares -> $1,015), replayed
//   number-for-number in lib/openstartup/__tests__/deFranchiseTax.test.ts.
// - us-de.franchise-tax-assumed-par-method — the Division's published steps 1-5 and its
//   worked example (assumed par $2.061856, assumed par value capital $3,311,856, tax
//   $1,600), replayed number-for-number.
// - us-de.franchise-tax-annual-report (existing card) — the March 1 due date and the
//   $5,000+ quarterly-installment rule this module flags but does not schedule
//   (deadlines.ts owns the calendar).
//
// Interfaces consumed from the equity/cap-table layer: authorized share counts, par values,
// and issued share totals are PLAIN INPUTS here (capTable.ts or your records produce them);
// this module never derives a capitalization.
//
// Honest-scope notes:
// - Amounts carry an asOf date and every result is needsReview: true — franchise tax rates
//   and thresholds change by statute and are never claimed current (rule-card caveats).
// - Total gross assets = the corporation's U.S. Form 1120 Schedule L figure, a reporting
//   input this repo cannot derive.
// - No-par stock is out of scope for the assumed par method (the Division: the authorized
//   shares method "will always result in the lesser tax" for no-par corporations) — the
//   function refuses rather than guessing the statute's assumed-no-par-capital rules.
// - Large Corporate Filer status is surfaced as a fixed-amount computation; the § 503(c)
//   qualification conditions (exchange listing, revenue/asset thresholds) are NOT verified.
// - Rounding is explicit: the assumed par is rounded half-up to 6 decimal places — the
//   Division says "carrying to 6 decimal places" and its example ($1,000,000 / 485,000 =
//   2.06185567... -> $2.061856) matches rounding, not truncation (truncation would give
//   2.061855). Tax over $1,000,000 of assumed par value capital rounds UP to the next
//   million before applying $400 per million.
// - The annual report filing fee, late penalty, and interest are separate and not computed.
// - Educational decision support, not tax advice; this module never authorizes a filing or
//   payment. The "which method is cheaper" comparator proposes, a human files.
// ---------------------------------------------------------------------------

import { z } from 'zod'
import { entrySpec } from './entryValidation'

/** The rule cards this module is allowed to cite. The vitest gate asserts every id
 * resolves to a committed card with the matching jurisdiction. */
export const DE_FRANCHISE_RULE_IDS = {
  authorizedShares: { ruleId: 'us-de.franchise-tax-authorized-shares-method', jurisdiction: 'US-DE' },
  assumedPar: { ruleId: 'us-de.franchise-tax-assumed-par-method', jurisdiction: 'US-DE' },
  annualReport: { ruleId: 'us-de.franchise-tax-annual-report', jurisdiction: 'US-DE' },
} as const

/** Published amounts, asOf-dated (rule cards above; verified live 2026-10-01). Never
 * claimed current — needsReview on every result. */
export const DE_FRANCHISE_PARAMS = {
  asOf: '2026-10-01',
  /** $175 where authorized capital stock does not exceed 5,000 shares (§ 503(a)). */
  tier1MaxShares: 5000,
  tier1Tax: 175,
  /** $250 where more than 5,000 but not more than 10,000 shares (§ 503(a)). */
  tier2MaxShares: 10_000,
  tier2Tax: 250,
  /** "the further sum of $85 on each 10,000 shares or part thereof" above 10,000. */
  perBlockTax: 85,
  blockShares: 10_000,
  /** § 503(c): not more than $200,000 nor less than $175. */
  maxTax: 200_000,
  minAuthorizedTax: 175,
  /** Assumed par value capital method: $400 per $1,000,000 or fraction thereof; $400 min. */
  assumedParRatePerMillion: 400,
  assumedParMinTax: 400,
  /** § 503(c) Large Corporate Filer fixed amount (conditions NOT verified here). */
  largeCorporateFilerTax: 250_000,
  /** Prior-year liability at or above this adds quarterly tentative installments
   * (rule us-de.franchise-tax-annual-report, 8 Del. C. § 504(a)). */
  quarterlyInstallmentThreshold: 5000,
} as const

export interface FranchiseTaxResult {
  method: 'authorized-shares' | 'assumed-par-value-capital' | 'large-corporate-filer'
  /** Whole dollars (every published amount and example is whole-dollar). */
  tax: number
  ruleId: string
  jurisdiction: 'US-DE'
  /** The date the amounts were last verified against the cited sources. */
  asOf: string
  /** Always true: amounts change by statute, Large-Corporate-Filer and no-par facts are
   * unverified, and nothing here authorizes a filing or payment. */
  needsReview: true
  /** True when this liability would put next year's bill on the § 504(a) quarterly
   * tentative-installment schedule (threshold flagged, never scheduled here). */
  quarterlyInstallmentsLikely: boolean
  note: string
}

function assertPositiveInt(n: number, what: string): void {
  if (!Number.isInteger(n) || n <= 0) throw new RangeError(`${what} must be a positive integer`)
}

function finish(
  method: FranchiseTaxResult['method'],
  tax: number,
  ruleId: string,
  note: string,
): FranchiseTaxResult {
  return {
    method,
    tax,
    ruleId,
    jurisdiction: 'US-DE',
    asOf: DE_FRANCHISE_PARAMS.asOf,
    needsReview: true,
    quarterlyInstallmentsLikely: tax >= DE_FRANCHISE_PARAMS.quarterlyInstallmentThreshold,
    note: `${note} Amounts as of ${DE_FRANCHISE_PARAMS.asOf}; verify against the live statute and corp.delaware.gov before paying. Annual report fee, penalties, and interest are separate.`,
  }
}

/**
 * Authorized Shares Method — rule `us-de.franchise-tax-authorized-shares-method`
 * (8 Del. C. § 503(a), (c); Division worked examples replayed in the tests):
 * <=5,000 shares: $175; 5,001-10,000: $250; each additional 10,000 shares OR PART THEREOF:
 * +$85; capped at $200,000. This is the method the Division's annual bill uses by default.
 */
export function authorizedSharesMethodTax(authorizedShares: number): FranchiseTaxResult {
  assertPositiveInt(authorizedShares, 'authorizedShares')
  const p = DE_FRANCHISE_PARAMS
  let tax: number
  if (authorizedShares <= p.tier1MaxShares) tax = p.tier1Tax
  else if (authorizedShares <= p.tier2MaxShares) tax = p.tier2Tax
  else tax = p.tier2Tax + p.perBlockTax * Math.ceil((authorizedShares - p.tier2MaxShares) / p.blockShares)
  tax = Math.min(tax, p.maxTax)
  return finish(
    'authorized-shares',
    tax,
    DE_FRANCHISE_RULE_IDS.authorizedShares.ruleId,
    `Authorized Shares Method on ${authorizedShares.toLocaleString('en-US')} authorized shares. The Division bills this method by default; the assumed par value capital method may be lower (compareFranchiseTaxMethods).`,
  )
}

export interface AuthorizedShareClass {
  /** Authorized (not issued) shares of this class. */
  shares: number
  /** Par value per share in dollars. Must be > 0 — no-par stock is out of scope (module header). */
  parValue: number
}

export interface AssumedParInputs {
  /** Total gross assets — the U.S. Form 1120 Schedule L total-asset figure (rule caveat). */
  totalGrossAssets: number
  /** Total issued shares (all classes). */
  totalIssuedShares: number
  /** Every authorized class with its par value. */
  authorizedClasses: readonly AuthorizedShareClass[]
}

/** Structural schema of AssumedParInputs — the registry entry contract (field names and
 * types; value rules, including the no-par refusal, stay in the function). */
export const AssumedParInputsSchema = z.object({
  totalGrossAssets: z.number(),
  totalIssuedShares: z.number(),
  authorizedClasses: z.array(z.object({ shares: z.number(), parValue: z.number() })),
})

/** Registered entrypoint arguments (open-modules/registry.json). */
export const compareFranchiseTaxMethodsEntry = entrySpec('compareFranchiseTaxMethods', [
  { name: 'inputs', schema: AssumedParInputsSchema },
])

const assumedParValueCapitalTaxEntry = entrySpec('assumedParValueCapitalTax', [
  { name: 'inputs', schema: AssumedParInputsSchema },
])

export interface AssumedParResult extends FranchiseTaxResult {
  /** Gross assets / issued shares, rounded half-up to 6 decimal places (Division step 1). */
  assumedPar: number
  /** Division step 4 sum, rounded to cents. */
  assumedParValueCapital: number
  /** The millions figure the $400 rate applies to (rounded up when over $1,000,000). */
  taxableMillions: number
}

function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6
}

function round2(x: number): number {
  return Math.round(x * 100) / 100
}

/**
 * Assumed Par Value Capital Method — rule `us-de.franchise-tax-assumed-par-method`
 * (8 Del. C. § 503(a); the Division's published steps 1-5 and worked example replayed
 * number-for-number in the tests):
 *   1. assumed par = gross assets / issued shares, carried to 6 decimal places;
 *   2. authorized shares with par < assumed par count at the assumed par;
 *   3. authorized shares with par > assumed par count at their own par (par == assumed par
 *      is numerically identical either way);
 *   4. the sum is the assumed par value capital;
 *   5. tax = $400 per $1,000,000 or fraction thereof (rounded UP to the next million when
 *      over $1,000,000), minimum $400, maximum $200,000.
 */
export function assumedParValueCapitalTax(inputs: AssumedParInputs): AssumedParResult {
  assumedParValueCapitalTaxEntry.validate(inputs)
  const p = DE_FRANCHISE_PARAMS
  if (!(inputs.totalGrossAssets > 0)) throw new RangeError('totalGrossAssets must be > 0')
  assertPositiveInt(inputs.totalIssuedShares, 'totalIssuedShares')
  if (inputs.authorizedClasses.length === 0) throw new RangeError('authorizedClasses must be non-empty')
  for (const cls of inputs.authorizedClasses) {
    assertPositiveInt(cls.shares, 'authorized class shares')
    if (!(cls.parValue > 0)) {
      throw new RangeError(
        'no-par (or zero-par) stock is out of scope for the assumed par value capital method here — the Division notes the authorized shares method always results in the lesser tax for no-par corporations (rule us-de.franchise-tax-assumed-par-method caveat)',
      )
    }
  }
  const assumedPar = round6(inputs.totalGrossAssets / inputs.totalIssuedShares)
  let capital = 0
  for (const cls of inputs.authorizedClasses) {
    capital += cls.shares * (cls.parValue < assumedPar ? assumedPar : cls.parValue)
  }
  const assumedParValueCapital = round2(capital)
  const taxableMillions =
    assumedParValueCapital > 1_000_000 ? Math.ceil(assumedParValueCapital / 1_000_000) : 1
  const tax = Math.min(Math.max(taxableMillions * p.assumedParRatePerMillion, p.assumedParMinTax), p.maxTax)
  const base = finish(
    'assumed-par-value-capital',
    tax,
    DE_FRANCHISE_RULE_IDS.assumedPar.ruleId,
    `Assumed Par Value Capital Method: assumed par $${assumedPar} on ${inputs.totalIssuedShares.toLocaleString('en-US')} issued shares; assumed par value capital $${assumedParValueCapital.toLocaleString('en-US')} -> ${taxableMillions} million(s) x $${p.assumedParRatePerMillion}. Gross assets must be the Form 1120 Schedule L figure.`,
  )
  return { ...base, assumedPar, assumedParValueCapital, taxableMillions }
}

/**
 * Large Corporate Filer — 8 Del. C. § 503(c): a national-exchange-listed corporation
 * meeting the consolidated revenue/asset conditions pays a FIXED $250,000. This function
 * surfaces the amount; it cannot verify qualification (listing, $750M revenue/assets with
 * $250M minimums) — that is exactly the needs-review question.
 */
export function largeCorporateFilerTax(): FranchiseTaxResult {
  return finish(
    'large-corporate-filer',
    DE_FRANCHISE_PARAMS.largeCorporateFilerTax,
    DE_FRANCHISE_RULE_IDS.authorizedShares.ruleId,
    'Large Corporate Filer fixed amount (8 Del. C. § 503(c)). Qualification conditions (exchange listing, consolidated revenue/asset thresholds) are NOT verified here.',
  )
}

export interface MethodComparison {
  cheaper: 'authorized-shares' | 'assumed-par-value-capital'
  /** Whole dollars saved by paying the cheaper method instead of the other. */
  saving: number
  authorizedShares: FranchiseTaxResult
  assumedPar: AssumedParResult
  ruleIds: string[]
  needsReview: true
  note: string
}

/**
 * The Division bills the Authorized Shares Method by default, and a startup with a large
 * authorized pool but small assets usually owes far less under the Assumed Par Value
 * Capital Method (both rule cards' caveats say exactly this). Computes both published
 * methods and reports which is cheaper. Proposes only — the corporation elects the method
 * on its own annual report filing.
 */
export function compareFranchiseTaxMethods(inputs: AssumedParInputs): MethodComparison {
  compareFranchiseTaxMethodsEntry.validate(inputs)
  const totalAuthorized = inputs.authorizedClasses.reduce((sum, c) => sum + c.shares, 0)
  const authorized = authorizedSharesMethodTax(totalAuthorized)
  const assumedPar = assumedParValueCapitalTax(inputs)
  const cheaper = assumedPar.tax < authorized.tax ? 'assumed-par-value-capital' : 'authorized-shares'
  const saving = Math.abs(authorized.tax - assumedPar.tax)
  return {
    cheaper,
    saving,
    authorizedShares: authorized,
    assumedPar,
    ruleIds: [DE_FRANCHISE_RULE_IDS.authorizedShares.ruleId, DE_FRANCHISE_RULE_IDS.assumedPar.ruleId],
    needsReview: true,
    note: `Pay the lesser method on the annual report (due March 1 — rule ${DE_FRANCHISE_RULE_IDS.annualReport.ruleId}; deadlines.ts owns the calendar). ${cheaper === 'assumed-par-value-capital' ? `Assumed par value capital saves $${saving.toLocaleString('en-US')} over the default bill.` : 'The default authorized-shares bill is already the lesser amount.'} Decision support only — never an authorization to file or pay.`,
  }
}
