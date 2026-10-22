// The 83(b) money math (founder directive 2026-10-01: "go super deep on business logic —
// tax mechanics, everything"). deadlines.ts owns the 30-day clock
// (election83bWindow, rule us-fed.83b-filing-period); THIS module owns the dollars.
//
// Pure, client-safe, deterministic. The arithmetic is Rev. Proc. 2012-29's own —
// rule `us-fed.83b-scenario-arithmetic` cites it, and the vitest gate
// (lib/openstartup/__tests__/election83b.test.ts) replays all six published examples
// number-for-number (25,000 shares, $25,000 paid / $0 paid, $40,000 vesting FMV, $60,000
// sale, the $25,000 repurchase forfeiture, and the no-loss $0-paid forfeiture).
//
// Interfaces consumed from the equity lane (vesting/anti-dilution/409A-method mechanics
// live there): vesting arrives as PLAIN INPUTS — the vesting-date FMV scenario values and
// share counts are explicit hypotheticals the caller supplies (a vesting schedule's output),
// and the early-exercise flag (`earlyExercised`) is the equity lane's; what that flag does
// to § 83 timing is computed here.
//
// Honest-scope notes:
// - TAX OUTCOMES DEPEND ON FACTS: every result is needsReview: true, educational, never
//   an authorization to file an election (which is irrevocable without IRS consent — rule
//   us-fed.83b-revocation).
// - Rates are INPUTS (ordinary and capital-gains rates as explicit hypotheticals); the
//   module never claims a current rate table.
// - FMV trajectories are labeled hypothetical scenarios. The module never invents an FMV.
// - The risk statement is the cited one: forfeit after electing and the income inclusion
//   is never recovered — no deduction, no credit, loss only to the extent amount paid
//   exceeds amount realized (Rev. Proc. 2012-29 § 4.03 and § 5, Examples 3 and 6).
// ---------------------------------------------------------------------------

import { z } from 'zod'
import { entrySpec } from './entryValidation'

/** The rule cards this module is allowed to cite. The vitest gate asserts every id
 * resolves to a committed card with the matching jurisdiction. */
export const ELECTION_83B_RULE_IDS = {
  scenarioArithmetic: { ruleId: 'us-fed.83b-scenario-arithmetic', jurisdiction: 'US-FED' },
  electionEffect: { ruleId: 'us-fed.83b-election-effect', jurisdiction: 'US-FED' },
  filingPeriod: { ruleId: 'us-fed.83b-filing-period', jurisdiction: 'US-FED' },
  revocation: { ruleId: 'us-fed.83b-revocation', jurisdiction: 'US-FED' },
  holdingPeriod: { ruleId: 'us-fed.restricted-property-holding-period', jurisdiction: 'US-FED' },
} as const

const DISCLAIMER =
  'Educational scenario arithmetic from explicit hypothetical inputs, not tax advice; it never authorizes filing an election (irrevocable without IRS consent) and the 30-day window is jurisdictional — deadlines.ts owns the clock.'

function round2(x: number): number {
  return Math.round(x * 100) / 100 + 0 // + 0 normalizes -0
}

function assertNonNegative(n: number, what: string): void {
  if (!(n >= 0)) throw new RangeError(`${what} must be >= 0`)
}

export interface RestrictedStockFacts {
  /** Shares transferred (substantially nonvested at transfer). */
  shares: number
  /** Amount paid per share (the founder purchase price / option strike). */
  pricePaidPerShare: number
  /** FMV per share at TRANSFER, determined without regard to lapse restrictions —
   * supplied, never computed here. */
  fmvAtTransferPerShare: number
}

export interface VestingScenarioEvent {
  /** Label, e.g. 'cliff' or '2027-04'. */
  label: string
  /** Shares vesting at this event — a vesting schedule's output, consumed as input. */
  shares: number
  /** HYPOTHETICAL FMV per share at this vesting event. */
  fmvPerShare: number
}

/** Structural schema of RestrictedStockFacts — the registry entry contract (field names
 * and types; value rules stay in the function). */
export const RestrictedStockFactsSchema = z.object({
  shares: z.number(),
  pricePaidPerShare: z.number(),
  fmvAtTransferPerShare: z.number(),
})

/** Structural schema of VestingScenarioEvent (open-modules/registry.json). */
export const VestingScenarioEventSchema = z.object({
  label: z.string(),
  shares: z.number(),
  fmvPerShare: z.number(),
})

/** Registered entrypoint arguments (open-modules/registry.json). */
export const compare83bScenarioEntry = entrySpec('compare83bScenario', [
  { name: 'facts', schema: RestrictedStockFactsSchema },
  { name: 'vestingScenario', schema: z.array(VestingScenarioEventSchema) },
])

export interface ElectionPathResult {
  /** Ordinary compensation income in the transfer year. */
  incomeAtTransfer: number
  /** Ordinary compensation income across the vesting events (0 with an election). */
  incomeAtVesting: number
  /** Basis after all events: amount paid + ordinary income included. */
  basis: number
  /** When the capital-gain holding period begins — rule
   * us-fed.restricted-property-holding-period. */
  holdingPeriodBegins: 'transfer' | 'each vesting event'
}

export interface Comparison83b {
  withElection: ElectionPathResult
  withoutElection: ElectionPathResult
  /** True when income at transfer is $0 — the zero-spread common case: filing costs
   * nothing in current tax and starts the clocks (why founders file). */
  zeroSpreadAtTransfer: boolean
  ruleIds: string[]
  jurisdiction: 'US-FED'
  needsReview: true
  riskStatement: string
  note: string
}

/**
 * Tax-at-grant vs tax-at-vesting — rule `us-fed.83b-scenario-arithmetic`
 * (Rev. Proc. 2012-29 §§ 4.01-4.02, Examples 1/2/4/5):
 * - WITH the election: include (FMV at transfer − amount paid) now; nothing at vesting;
 *   basis = paid + included; holding period starts at transfer.
 * - WITHOUT: include (FMV at vesting − amount paid) per vesting event as ordinary income;
 *   basis = FMV at vesting; holding period starts at each vesting.
 * The vesting FMVs are explicit hypotheticals (a trajectory the caller supplies).
 */
export function compare83bScenario(
  facts: RestrictedStockFacts,
  vestingScenario: readonly VestingScenarioEvent[],
): Comparison83b {
  compare83bScenarioEntry.validate(facts, vestingScenario)
  if (!Number.isInteger(facts.shares) || facts.shares <= 0) throw new RangeError('shares must be a positive integer')
  assertNonNegative(facts.pricePaidPerShare, 'pricePaidPerShare')
  assertNonNegative(facts.fmvAtTransferPerShare, 'fmvAtTransferPerShare')
  const scenarioShares = vestingScenario.reduce((sum, e) => sum + e.shares, 0)
  if (scenarioShares > facts.shares) throw new RangeError('vesting scenario vests more shares than were transferred')
  for (const e of vestingScenario) {
    if (!Number.isInteger(e.shares) || e.shares <= 0) throw new RangeError(`event ${e.label}: shares must be a positive integer`)
    assertNonNegative(e.fmvPerShare, `event ${e.label}: fmvPerShare`)
  }

  const amountPaid = round2(facts.shares * facts.pricePaidPerShare)
  const incomeAtTransfer = round2(Math.max(0, facts.shares * (facts.fmvAtTransferPerShare - facts.pricePaidPerShare)))
  const withElection: ElectionPathResult = {
    incomeAtTransfer,
    incomeAtVesting: 0,
    basis: round2(amountPaid + incomeAtTransfer),
    holdingPeriodBegins: 'transfer',
  }
  const incomeAtVesting = round2(
    vestingScenario.reduce((sum, e) => sum + e.shares * Math.max(0, e.fmvPerShare - facts.pricePaidPerShare), 0),
  )
  const vestedPaid = round2(scenarioShares * facts.pricePaidPerShare)
  const withoutElection: ElectionPathResult = {
    incomeAtTransfer: 0,
    incomeAtVesting,
    basis: round2(vestedPaid + incomeAtVesting),
    holdingPeriodBegins: 'each vesting event',
  }
  return {
    withElection,
    withoutElection,
    zeroSpreadAtTransfer: incomeAtTransfer === 0,
    ruleIds: [
      ELECTION_83B_RULE_IDS.scenarioArithmetic.ruleId,
      ELECTION_83B_RULE_IDS.electionEffect.ruleId,
      ELECTION_83B_RULE_IDS.holdingPeriod.ruleId,
    ],
    jurisdiction: 'US-FED',
    needsReview: true,
    riskStatement: FORFEITURE_RISK_STATEMENT,
    note: `Vesting-date FMVs are a hypothetical trajectory, rates are not applied here (see scenarioTax83b), and the without-election basis covers only the shares in the scenario. ${DISCLAIMER}`,
  }
}

/** The cited risk, verbatim in substance — Rev. Proc. 2012-29 § 4.03 (the rule) and § 5, Examples 3 and 6:
 * elect, forfeit, and the inclusion is never recovered. */
export const FORFEITURE_RISK_STATEMENT =
  'If elected property is forfeited while substantially nonvested, no deduction is allowed for the forfeiture; the forfeiture is treated as a sale, with loss recognized only to the extent the amount paid exceeds the amount realized, and there is no deduction or credit for taxes paid because of the election (Rev. Proc. 2012-29 § 4.03 and § 5, Examples 3 and 6 — rule us-fed.83b-scenario-arithmetic).'

export interface ForfeitureOutcome {
  /** Amount paid for the forfeited shares. */
  amountPaid: number
  /** What the company pays on repurchase/forfeiture (0 for a straight forfeiture). */
  amountRealized: number
  /** Gain (never from the elected inclusion) or loss — loss capped at paid − realized. */
  gainOrLoss: number
  /** The elected inclusion that is NOT recovered. */
  unrecoveredInclusion: number
  ruleId: string
  jurisdiction: 'US-FED'
  needsReview: true
  note: string
}

/**
 * Forfeiture after an election — rule `us-fed.83b-scenario-arithmetic` (Rev. Proc.
 * 2012-29 § 4.03; Example 3: $25,000 repurchase of $25,000-basis shares → $0 gain;
 * Example 6: $0-paid shares forfeited for nothing → no loss, no credit).
 */
export function forfeitureAfterElection(inputs: {
  shares: number
  pricePaidPerShare: number
  fmvAtTransferPerShare: number
  /** Per-share amount the company pays on the forfeiture/repurchase (0 if nothing). */
  repurchasePricePerShare: number
}): ForfeitureOutcome {
  if (!Number.isInteger(inputs.shares) || inputs.shares <= 0) throw new RangeError('shares must be a positive integer')
  assertNonNegative(inputs.pricePaidPerShare, 'pricePaidPerShare')
  assertNonNegative(inputs.fmvAtTransferPerShare, 'fmvAtTransferPerShare')
  assertNonNegative(inputs.repurchasePricePerShare, 'repurchasePricePerShare')
  const amountPaid = round2(inputs.shares * inputs.pricePaidPerShare)
  const amountRealized = round2(inputs.shares * inputs.repurchasePricePerShare)
  // § 1.83-2(a): loss only to the extent amount paid exceeds amount realized; a
  // forced-repurchase "gain" above basis is rare but computed symmetrically against the
  // elected basis (paid + inclusion) — Example 3's $25,000 − $25,000 = $0 uses basis.
  const inclusion = round2(Math.max(0, inputs.shares * (inputs.fmvAtTransferPerShare - inputs.pricePaidPerShare)))
  const basis = round2(amountPaid + inclusion)
  const gainOrLoss = amountRealized >= basis ? round2(amountRealized - basis) : round2(0 - Math.max(0, amountPaid - amountRealized))
  return {
    amountPaid,
    amountRealized,
    gainOrLoss,
    unrecoveredInclusion: inclusion,
    ...ELECTION_83B_RULE_IDS.scenarioArithmetic,
    needsReview: true,
    note: `${FORFEITURE_RISK_STATEMENT} ${DISCLAIMER}`,
  }
}

export interface ScenarioTax83b {
  withElection: { ordinaryTax: number; capitalGain: number; capitalGainsTax: number; totalTax: number }
  withoutElection: { ordinaryTax: number; capitalGain: number; capitalGainsTax: number; totalTax: number }
  /** totalTax(without) − totalTax(with): positive means the election saved tax IN THIS
   * HYPOTHETICAL. The forfeiture risk is the price of that bet. */
  electionSavings: number
  ruleIds: string[]
  needsReview: true
  note: string
}

/**
 * Full scenario arithmetic with RATES AS INPUTS — rule `us-fed.83b-scenario-arithmetic`.
 * Sells everything at a hypothetical price after full vesting (both paths assume the sale
 * is beyond the relevant holding periods; character/timing nuances are the caveat's).
 * The vesting scenario must vest ALL the transferred shares: a partial scenario would have
 * the two paths sell unequal share counts (unvested shares cannot be sold) and the
 * electionSavings comparison would mix sale quantities, so it is rejected.
 * Replays Rev. Proc. 2012-29 Examples 1/2 and 4/5 gain arithmetic in the tests.
 */
export function scenarioTax83b(inputs: {
  facts: RestrictedStockFacts
  vestingScenario: readonly VestingScenarioEvent[]
  /** Hypothetical sale price per share after vesting. */
  salePricePerShare: number
  /** Explicit hypothetical rates in [0, 1] — never a claimed-current rate table. */
  ordinaryRate: number
  capitalGainsRate: number
}): ScenarioTax83b {
  const { facts } = inputs
  for (const [k, v] of Object.entries({ ordinaryRate: inputs.ordinaryRate, capitalGainsRate: inputs.capitalGainsRate })) {
    if (!(v >= 0 && v <= 1)) throw new RangeError(`${k} must be in [0, 1]`)
  }
  assertNonNegative(inputs.salePricePerShare, 'salePricePerShare')
  const cmp = compare83bScenario(facts, inputs.vestingScenario)
  const vestedShares = inputs.vestingScenario.reduce((sum, e) => sum + e.shares, 0)
  if (vestedShares !== facts.shares) {
    throw new RangeError(
      `the vesting scenario must vest all ${facts.shares} transferred shares (it vests ${vestedShares}): the sale ` +
        `comparison sells after full vesting, and a partial scenario would sell unequal share counts across the two paths`,
    )
  }
  const saleProceeds = round2(facts.shares * inputs.salePricePerShare)

  const withGain = round2(saleProceeds - cmp.withElection.basis)
  const withoutGain = round2(saleProceeds - cmp.withoutElection.basis)
  const withElection = {
    ordinaryTax: round2(cmp.withElection.incomeAtTransfer * inputs.ordinaryRate),
    capitalGain: withGain,
    capitalGainsTax: round2(Math.max(0, withGain) * inputs.capitalGainsRate),
    totalTax: 0,
  }
  withElection.totalTax = round2(withElection.ordinaryTax + withElection.capitalGainsTax)
  const withoutElection = {
    ordinaryTax: round2(cmp.withoutElection.incomeAtVesting * inputs.ordinaryRate),
    capitalGain: withoutGain,
    capitalGainsTax: round2(Math.max(0, withoutGain) * inputs.capitalGainsRate),
    totalTax: 0,
  }
  withoutElection.totalTax = round2(withoutElection.ordinaryTax + withoutElection.capitalGainsTax)
  return {
    withElection,
    withoutElection,
    electionSavings: round2(withoutElection.totalTax - withElection.totalTax),
    ruleIds: cmp.ruleIds,
    needsReview: true,
    note: `Hypothetical rates applied to hypothetical FMVs; both paths sell all ${facts.shares.toLocaleString('en-US')} shares after the scenario fully vests. Losses are not netted against other income here. ${DISCLAIMER}`,
  }
}

export interface EarlyExercise83bNote {
  /** Equity lane's flag, echoed: this analysis only applies when the plan allows early
   * exercise and it happened (the stock received is substantially nonvested). */
  earlyExercised: boolean
  /** NSO: ordinary income locked in by the election (spread at exercise). */
  nsoIncomeWithElection: number
  /** ISO: the regular-tax election amount is the same arithmetic but § 421 keeps it out
   * of regular income; the election matters for the AMT inclusion (§ 56(b)(3) applies
   * § 83 timing — optionTax.ts computes the AMT side). */
  isoAmtInclusionWithElection: number
  ruleIds: string[]
  needsReview: true
  note: string
}

/**
 * Early exercise + 83(b) interplay — rules `us-fed.83b-scenario-arithmetic` (Rev. Proc.
 * 2012-29 § 2.04 permits the election on substantially nonvested stock received by
 * exercising an option without a readily ascertainable FMV) and
 * `us-fed.iso-amt-adjustment` via optionTax.ts. Consumes the equity lane's early-exercise
 * flag; at a zero spread (strike = FMV, the common early-exercise case) the election
 * locks in $0 ordinary income (NSO) / $0 AMT inclusion (ISO) and starts the capital-gain
 * clock at transfer.
 */
export function earlyExercise83b(inputs: {
  earlyExercised: boolean
  shares: number
  strikePerShare: number
  fmvAtExercisePerShare: number
}): EarlyExercise83bNote {
  if (!inputs.earlyExercised) {
    throw new RangeError('earlyExercise83b applies only when the equity lane reports earlyExercised: true (stock received substantially nonvested)')
  }
  if (!Number.isInteger(inputs.shares) || inputs.shares <= 0) throw new RangeError('shares must be a positive integer')
  assertNonNegative(inputs.strikePerShare, 'strikePerShare')
  assertNonNegative(inputs.fmvAtExercisePerShare, 'fmvAtExercisePerShare')
  const spread = round2(Math.max(0, inputs.shares * (inputs.fmvAtExercisePerShare - inputs.strikePerShare)))
  return {
    earlyExercised: true,
    nsoIncomeWithElection: spread,
    isoAmtInclusionWithElection: spread,
    ruleIds: [ELECTION_83B_RULE_IDS.scenarioArithmetic.ruleId, ELECTION_83B_RULE_IDS.filingPeriod.ruleId, 'us-fed.iso-amt-adjustment'],
    needsReview: true,
    note: `Election on the exercise-received stock: NSO ordinary income (or ISO AMT inclusion) locks at the $${spread.toLocaleString('en-US')} exercise spread instead of repricing at each vesting; at zero spread that is $0 now with the forfeiture risk as the price. The 30-day window runs from the exercise transfer (deadlines.election83bWindow). ${FORFEITURE_RISK_STATEMENT} ${DISCLAIMER}`,
  }
}
