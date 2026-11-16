// High-precision counterpart of capTable.ts. Formula sources: YC Post-Money
// Safe User Guide, Q&A B/D and Appendix II (https://www.ycombinator.com/documents).
// This interface retains full decimal precision during pricing, unlike the legacy
// four-decimal educational examples. Whole shares floor, pool top-ups ceil.
// Inputs describe a single proposed financing. MFN elections and note conversions
// must be resolved by the caller. No grants, transfers or legal actions are authorized.
import { Decimal } from "decimal.js";
import { z } from "zod";
import { entrySpec } from "./entryValidation";
import { addMonthsClamped, parseIso } from "./calendar";
const D = Decimal.clone({ precision: 60, rounding: Decimal.ROUND_HALF_UP });
const dec = (value: Decimal.Value = 0) => new D(value);
const sum = (values: Decimal.Value[]) => values.reduce<Decimal>((n, value) => n.plus(value), dec());
const fail = (message: string): never => { throw new RangeError(message); };
// Validated cash strings have at most 18 fractional places. Keep share decisions
// as exact integer ratios rather than dividing by rounded prices.
const moneyScale = BigInt(10) ** BigInt(18);
const moneyUnits = (value: string): bigint => {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole!) * moneyScale + BigInt(fraction.padEnd(18, "0"));
};
const percentage = (value: number): [bigint, bigint] => {
  const [whole, fraction = ""] = dec(value).toFixed().split(".");
  return [BigInt(whole! + fraction), BigInt(100) * BigInt(10) ** BigInt(fraction.length)];
};
const totalShares = (values: bigint[]) => values.reduce((total, value) => total + value, BigInt(0));

export type RoundResult = {
  pricePerShare: string;
  preMoney: string;
  newMoney: string;
  postMoney: string;
  poolIncrease: string;
  conversions: {
    securityId: string;
    holderId: string;
    shares: string;
    method: "cap" | "discount" | "round";
    price: string;
  }[];
  allocations: { holderId: string; shares: string; amount: string; unallocatedCash: string }[];
  fullyDilutedShares: string;
  poolPct: string;
  rounding: string;
};
export type DecimalRoundInput = {
  fullyDilutedShares: string;
  availablePoolShares: string;
  safes: { id: string; holderId: string; amount: string; cap?: string; discountPct?: number }[];
  preMoney: string;
  poolTargetPct: number;
  investments: { holderId: string; amount: string }[];
};
// Bounded decimal strings prevent Number precision loss and unbounded parse work.
const quantity = z.string().regex(/^(0|[1-9]\d{0,29})$/);
const amount = z.string().regex(/^(0|[1-9]\d{0,19})(\.\d{1,18})?$/);
const id = z.string().min(1).max(256);
export const modelDecimalRoundEntry = entrySpec("modelDecimalRound", [{
  name: "input",
  schema: z.object({
    fullyDilutedShares: quantity,
    availablePoolShares: quantity,
    preMoney: amount,
    poolTargetPct: z.number().min(0).max(100),
    safes: z.array(z.object({ id, holderId: id, amount, cap: amount.optional(),
      discountPct: z.number().min(0).lt(100).optional() })).max(10000),
    investments: z.array(z.object({ holderId: id, amount })).min(1).max(10000),
  }),
}]);
/**
 * YC post-money SAFE cap ownership = investment/cap; discount chooses the lower
 * conversion price. Pool top-up is solved against post-financing capitalization.
 * See capTable.ts for formula derivations and the legacy rounded-price contract.
 * Throws RangeError for invalid inputs, unsupported scale or nonconvergence.
 */
export function modelDecimalRound(input: DecimalRoundInput): RoundResult {
  modelDecimalRoundEntry.validate(input);
  if (dec(input.preMoney).lte(0)) fail("preMoney must be positive.");
  if (dec(input.availablePoolShares).gt(input.fullyDilutedShares))
    fail("availablePoolShares exceeds fullyDilutedShares.");
  if (new Set(input.safes.map(s => s.id)).size !== input.safes.length)
    fail("SAFE ids must be unique.");
  for (const safe of input.safes) {
    if (dec(safe.amount).lte(0)) fail("SAFE amount must be positive.");
    if (safe.cap !== undefined && dec(safe.cap).lte(safe.amount))
      fail("SAFE cap must exceed its investment.");
  }
  for (const investment of input.investments)
    if (dec(investment.amount).lte(0)) fail("Investment amount must be positive.");
  const { safes } = input;
  const terms = input;
  const pre = dec(terms.preMoney);
  const cash = sum(terms.investments.map((x) => x.amount));
  const fd = dec(input.fullyDilutedShares);
  if (fd.lte(0)) fail("A round requires existing shares.");
  if (sum(safes.map((s) => (s.cap ? dec(s.amount).div(s.cap) : 0))).gte(1))
    fail("SAFE caps allocate 100% or more before the round.");
  if (
    sum(safes.map((s) => dec(s.amount).div(dec(1).minus(dec(s.discountPct ?? 0).div(100))))).gte(
      pre,
    )
  )
    fail("SAFE price claims reach the pre-money valuation.");
  const preUnits = moneyUnits(terms.preMoney);
  const cashUnits = totalShares(terms.investments.map(x => moneyUnits(x.amount)));
  const fdShares = BigInt(input.fullyDilutedShares);
  const available = BigInt(input.availablePoolShares);
  const [targetNumerator, targetDenominator] = percentage(terms.poolTargetPct);
  const targetCapital = targetNumerator * (preUnits + cashUnits);
  const poolDenominator = targetDenominator * preUnits - targetCapital;
  if (poolDenominator <= BigInt(0)) fail("The pool target is unreachable at this valuation.");
  const safeTerms = safes.map(s => ({
    amount: moneyUnits(s.amount), cap: s.cap === undefined ? undefined : moneyUnits(s.cap),
    discount: percentage(s.discountPct ?? 0),
  }));
  let conversion = safes.map(() => BigInt(0));
  let increase = BigInt(0);
  let pricingShares = BigInt(0);
  let converged = false;
  const routes: ("cap" | "discount" | "round")[] = [];
  for (let iteration = 0; iteration < 2000; iteration++) {
    const totalConversion = totalShares(conversion);
    const company = fdShares + totalConversion;
    const poolNumerator = targetCapital * company - available * targetDenominator * preUnits;
    increase = poolNumerator > BigInt(0) ? (poolNumerator + poolDenominator - BigInt(1)) / poolDenominator : BigInt(0);
    pricingShares = company + increase;
    const next = safes.map((s, i) => {
      const term = safeTerms[i]!;
      const [discountNumerator, discountDenominator] = term.discount;
      const byPrice = term.amount * pricingShares * discountDenominator
        / (preUnits * (discountDenominator - discountNumerator));
      const byCap = term.cap === undefined ? BigInt(0)
        : term.amount * (fdShares + totalConversion - (conversion[i] ?? BigInt(0))) / (term.cap - term.amount);
      routes[i] = byCap >= byPrice && s.cap ? "cap" : s.discountPct ? "discount" : "round";
      return byCap > byPrice ? byCap : byPrice;
    });
    if (next.every((n, i) => n === conversion[i])) {
      converged = true;
      break;
    }
    conversion = next;
  }
  if (!converged) fail("SAFE conversion did not converge. Use a reviewed conversion schedule.");
  if (conversion.some(shares => shares <= BigInt(0)))
    fail("A SAFE converts to less than one whole share. Use a reviewed conversion schedule.");
  const price = pre.div(pricingShares.toString());
  if (price.toDecimalPlaces(18).lte(0))
    fail("The share price is below the supported decimal scale.");
  const allocations = terms.investments.map(x => {
    const numerator = moneyUnits(x.amount) * pricingShares;
    const shares = numerator / preUnits;
    if (shares <= BigInt(0)) fail("An investment is too small to buy one whole share.");
    const remainder = numerator - shares * preUnits;
    return {
      holderId: x.holderId,
      shares: shares.toString(),
      amount: x.amount,
      unallocatedCash: dec(remainder.toString()).div((pricingShares * moneyScale).toString()).toFixed(18),
    };
  });
  const fullyDiluted = fdShares + totalShares(conversion) + increase
    + totalShares(allocations.map(a => BigInt(a.shares)));
  return {
    pricePerShare: price.toFixed(18),
    preMoney: terms.preMoney,
    newMoney: cash.toFixed(),
    postMoney: pre.plus(cash).toFixed(),
    poolIncrease: increase.toString(),
    conversions: safes.map((s, i) => ({
      securityId: s.id,
      holderId: s.holderId,
      shares: (conversion[i] ?? BigInt(0)).toString(),
      method: routes[i] ?? "round",
      price: dec(s.amount)
        .div((conversion[i] ?? BigInt(1)).toString())
        .toFixed(18),
    })),
    allocations,
    fullyDilutedShares: fullyDiluted.toString(),
    poolPct: dec((available + increase).toString()).div(fullyDiluted.toString()).times(100).toFixed(8),
    rounding:
      "Whole shares floor and pool increases ceil using exact integer ratios; prices calculate at 60 significant digits and display at 18 decimal places. Residual cash is reported.",
  };
}

/**
 * Monthly vesting convention from Cooley GO, Founder's Stock, Vesting and Founder
 * Departures (https://www.cooleygo.com/founder-basics-founders-stock/).
 * Cumulative whole shares floor. Calendar anniversaries clamp to month end;
 * termination caps the accrual date. Contract terms determine applicability.
 */
export function vestedMonthlyShares(input: {
  shares: string; start: string; months: number; cliffMonths?: number;
  asOf: string; terminatedAt?: string;
}): string {
  const parsed = z.object({
    shares: quantity, start: z.string(), months: z.number().int().min(1).max(1200),
    cliffMonths: z.number().int().min(0).max(1200).optional(), asOf: z.string(),
    terminatedAt: z.string().optional(),
  }).safeParse(input);
  if (!parsed.success) fail(`vestedMonthlyShares: ${parsed.error.message}`);
  parseIso(input.start, "start");
  parseIso(input.asOf, "asOf");
  if (input.terminatedAt !== undefined) parseIso(input.terminatedAt, "terminatedAt");
  if ((input.cliffMonths ?? 0) > input.months) fail("Cliff exceeds the vesting duration.");
  const at = input.terminatedAt && input.terminatedAt < input.asOf ? input.terminatedAt : input.asOf;
  if (at < input.start) return "0";
  let elapsed = 0;
  while (elapsed < input.months && addMonthsClamped(input.start, elapsed + 1) <= at) elapsed++;
  if (elapsed < (input.cliffMonths ?? 0)) return "0";
  return (BigInt(input.shares) * BigInt(elapsed) / BigInt(input.months)).toString();
}
