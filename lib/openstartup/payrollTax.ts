// Employer-side federal payroll tax mechanics (founder directive 2026-10-01). FEDERAL
// ONLY, by stated boundary: state unemployment insurance, state disability, local payroll
// taxes, and workers' compensation are OUT OF SCOPE — they exist, they are material, and
// this module says so rather than pretending a federal number is the loaded cost.
//
// Pure, client-safe, deterministic. Every rate and threshold is an asOf-dated parameter
// object backed by a rule card in open-law/US-FED/ citing the live-verified IRS guidance:
// - us-fed.fica-rates-2026 — Pub 15 (2026): social security 6.2% each on the $184,500
//   wage base; Medicare 1.45% each, no limit; Additional Medicare 0.9% withheld from
//   employees only over $200,000 (NO employer share).
// - us-fed.futa-2025 — Instructions for Form 940 (2025): 6.0% on the first $7,000, up to
//   5.4% state credit (net 0.6%, at most $42/employee), credit-reduction states flagged.
// The vitest gate (lib/openstartup/__tests__/payrollTax.test.ts) hand-derives the
// published maxima from the cited figures (employer social security max 6.2% x $184,500 =
// $11,439; full-credit FUTA max 0.6% x $7,000 = $42) and checks the piecewise arithmetic.
//
// Interfaces: salaries arrive as explicit annual wage inputs (the runway/hiring modules'
// outputs can feed them); this module never derives compensation. Everything is
// needsReview: true — wage bases and credit-reduction lists change every year, deposit
// schedules and Form 941/940 mechanics are separate obligations, and nothing here
// authorizes a deposit, filing, or withholding setup. Educational, not tax advice.
// ---------------------------------------------------------------------------

import { z } from 'zod'
import { entrySpec } from './entryValidation'

/** The rule cards this module is allowed to cite. The vitest gate asserts every id
 * resolves to a committed card with the matching jurisdiction. */
export const PAYROLL_RULE_IDS = {
  fica: { ruleId: 'us-fed.fica-rates-2026', jurisdiction: 'US-FED' },
  futa: { ruleId: 'us-fed.futa-2025', jurisdiction: 'US-FED' },
} as const

export const STATE_TAX_BOUNDARY =
  'Federal only: state unemployment insurance (SUTA), state disability/paid-leave programs, local payroll taxes, and workers\' compensation are out of scope here and can be material — price them separately.'

const DISCLAIMER =
  'Educational employer-cost arithmetic, not tax advice; deposit schedules and return filings are separate obligations and nothing here authorizes any of them.'

function round2(x: number): number {
  return Math.round(x * 100) / 100 + 0
}

function assertNonNegative(n: number, what: string): void {
  if (!(n >= 0)) throw new RangeError(`${what} must be >= 0`)
}

/** 2026 FICA parameters — rule `us-fed.fica-rates-2026` (Pub 15 (2026), verified
 * 2026-10-01). asOf-dated; never claimed current for any other year. */
export const FICA_2026 = {
  asOf: '2026-10-01',
  taxYear: 2026,
  socialSecurityRate: 0.062,
  socialSecurityWageBase: 184_500,
  medicareRate: 0.0145,
  additionalMedicareRate: 0.009,
  additionalMedicareWithholdingThreshold: 200_000,
  ...PAYROLL_RULE_IDS.fica,
} as const

/** 2025 FUTA parameters — rule `us-fed.futa-2025` (Instructions for Form 940 (2025),
 * verified 2026-10-01). */
export const FUTA_2025 = {
  asOf: '2026-10-01',
  taxYear: 2025,
  rate: 0.06,
  wageBase: 7000,
  maxStateCredit: 0.054,
  ...PAYROLL_RULE_IDS.futa,
} as const

export interface EmployerFicaResult {
  /** 6.2% x min(wages, wage base) — the employer share. */
  employerSocialSecurity: number
  /** 1.45% x wages, no limit — the employer share. */
  employerMedicare: number
  employerFicaTotal: number
  /** 0.9% x max(0, wages − $200,000): WITHHELD FROM THE EMPLOYEE, no employer share —
   * reported for completeness, NOT part of employerFicaTotal. */
  employeeAdditionalMedicareWithholding: number
  taxYear: number
  asOf: string
  ruleId: string
  jurisdiction: 'US-FED'
  needsReview: true
  note: string
}

/**
 * Employer FICA on one employee's annual wages — rule `us-fed.fica-rates-2026`.
 * The Additional Medicare 0.9% is employee-only withholding over $200,000 (no employer
 * match); it is computed and labeled separately so nobody books it as employer cost.
 */
export function employerFicaAnnual(annualWages: number, params = FICA_2026): EmployerFicaResult {
  assertNonNegative(annualWages, 'annualWages')
  const employerSocialSecurity = round2(params.socialSecurityRate * Math.min(annualWages, params.socialSecurityWageBase))
  const employerMedicare = round2(params.medicareRate * annualWages)
  const employeeAdditionalMedicareWithholding = round2(
    params.additionalMedicareRate * Math.max(0, annualWages - params.additionalMedicareWithholdingThreshold),
  )
  return {
    employerSocialSecurity,
    employerMedicare,
    employerFicaTotal: round2(employerSocialSecurity + employerMedicare),
    employeeAdditionalMedicareWithholding,
    taxYear: params.taxYear,
    asOf: params.asOf,
    ruleId: params.ruleId,
    jurisdiction: 'US-FED',
    needsReview: true,
    note: `${params.taxYear} figures (asOf ${params.asOf}); the wage base changes annually. The 0.9% Additional Medicare amount is employee withholding only. ${DISCLAIMER}`,
  }
}

export interface FutaResult {
  /** Wages subject to FUTA: min(wages, $7,000). */
  futaWages: number
  /** Gross 6.0% before any state credit. */
  grossFuta: number
  /** The credit actually applied (rate supplied, capped at 5.4%). */
  creditApplied: number
  netFuta: number
  taxYear: number
  asOf: string
  ruleId: string
  jurisdiction: 'US-FED'
  needsReview: true
  note: string
}

/**
 * FUTA on one employee's annual wages — rule `us-fed.futa-2025`: 6.0% on the first
 * $7,000, employer-paid only. The state credit is an INPUT (default: the full 5.4%,
 * which assumes timely state unemployment payments in a non-credit-reduction state —
 * exactly the facts the rule card says change annually), capped at the 5.4% maximum.
 */
export function futaAnnual(
  annualWages: number,
  options?: { stateCreditRate?: number },
  params = FUTA_2025,
): FutaResult {
  assertNonNegative(annualWages, 'annualWages')
  const credit = options?.stateCreditRate ?? params.maxStateCredit
  if (!(credit >= 0 && credit <= params.maxStateCredit)) {
    throw new RangeError(`stateCreditRate must be in [0, ${params.maxStateCredit}] (the published maximum credit)`)
  }
  const futaWages = Math.min(annualWages, params.wageBase)
  const grossFuta = round2(params.rate * futaWages)
  const creditApplied = round2(credit * futaWages)
  return {
    futaWages,
    grossFuta,
    creditApplied,
    netFuta: round2(grossFuta - creditApplied),
    taxYear: params.taxYear,
    asOf: params.asOf,
    ruleId: params.ruleId,
    jurisdiction: 'US-FED',
    needsReview: true,
    note: `${params.taxYear} figures (asOf ${params.asOf}); the full credit assumes timely state payments in a non-credit-reduction state — credit-reduction status is a yearly determination (Schedule A). ${DISCLAIMER}`,
  }
}

/** Structural schemas of the asOf-dated parameter objects (overrides mirror FICA_2026 /
 * FUTA_2025 field for field). */
export const FicaParamsSchema = z.object({
  asOf: z.string(),
  taxYear: z.number(),
  socialSecurityRate: z.number(),
  socialSecurityWageBase: z.number(),
  medicareRate: z.number(),
  additionalMedicareRate: z.number(),
  additionalMedicareWithholdingThreshold: z.number(),
  ruleId: z.string(),
  jurisdiction: z.string(),
})

export const FutaParamsSchema = z.object({
  asOf: z.string(),
  taxYear: z.number(),
  rate: z.number(),
  wageBase: z.number(),
  maxStateCredit: z.number(),
  ruleId: z.string(),
  jurisdiction: z.string(),
})

/** Registered entrypoint arguments (open-modules/registry.json). */
export const employerPayrollCostAnnualEntry = entrySpec('employerPayrollCostAnnual', [
  { name: 'annualWages', schema: z.number() },
  {
    name: 'options',
    schema: z.object({
      stateCreditRate: z.number().optional(),
      ficaParams: FicaParamsSchema.optional(),
      futaParams: FutaParamsSchema.optional(),
    }),
    optional: true,
  },
])

export interface EmployerPayrollCost {
  annualWages: number
  fica: EmployerFicaResult
  futa: FutaResult
  /** Wages + employer FICA + net FUTA — the FEDERAL-only employer total. */
  federalEmployerTotal: number
  /** federalEmployerTotal / annualWages − 1, the federal-only load factor (0 wages → null). */
  federalLoadFactor: number | null
  ruleIds: string[]
  needsReview: true
  outOfScope: string
  note: string
}

/**
 * Per-employee annual employer cost from an explicit salary input — both rule cards.
 * FEDERAL ONLY and says so: the out-of-scope boundary (state UI/disability/local,
 * workers' comp, benefits) rides on every result, because the honest answer to "what
 * does a hire cost" is more than this number.
 */
export function employerPayrollCostAnnual(
  annualWages: number,
  options?: { stateCreditRate?: number; ficaParams?: typeof FICA_2026; futaParams?: typeof FUTA_2025 },
): EmployerPayrollCost {
  employerPayrollCostAnnualEntry.validate(annualWages, options)
  const fica = employerFicaAnnual(annualWages, options?.ficaParams ?? FICA_2026)
  const futa = futaAnnual(annualWages, { stateCreditRate: options?.stateCreditRate }, options?.futaParams ?? FUTA_2025)
  const federalEmployerTotal = round2(annualWages + fica.employerFicaTotal + futa.netFuta)
  return {
    annualWages,
    fica,
    futa,
    federalEmployerTotal,
    federalLoadFactor: annualWages > 0 ? Math.round((federalEmployerTotal / annualWages - 1) * 10_000) / 10_000 : null,
    ruleIds: [PAYROLL_RULE_IDS.fica.ruleId, PAYROLL_RULE_IDS.futa.ruleId],
    needsReview: true,
    outOfScope: STATE_TAX_BOUNDARY,
    note: `Mixed asOf years by necessity (FICA ${fica.taxYear}, FUTA ${futa.taxYear} — each the latest verified publication); benefits and equity are not taxes and not here. ${DISCLAIMER}`,
  }
}
