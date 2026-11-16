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
  const pool = { available: input.availablePoolShares };
  const pre = dec(terms.preMoney);
  const cash = sum(terms.investments.map((x) => x.amount));
  const fd = dec(input.fullyDilutedShares);
  if (fd.lte(0)) fail("A round requires existing shares.");
  const t = dec(terms.poolTargetPct).div(100);
  const k = t.times(pre.plus(cash)).div(pre);
  if (k.gte(1)) fail("The pool target is unreachable at this valuation.");
  if (sum(safes.map((s) => (s.cap ? dec(s.amount).div(s.cap) : 0))).gte(1))
    fail("SAFE caps allocate 100% or more before the round.");
  if (
    sum(safes.map((s) => dec(s.amount).div(dec(1).minus(dec(s.discountPct ?? 0).div(100))))).gte(
      pre,
    )
  )
    fail("SAFE price claims reach the pre-money valuation.");
  let conversion = safes.map(() => dec());
  let increase = dec();
  let price = dec();
  let converged = false;
  const routes: ("cap" | "discount" | "round")[] = [];
  for (let iteration = 0; iteration < 2000; iteration++) {
    const totalConversion = sum(conversion);
    const company = fd.plus(totalConversion);
    increase = D.max(0, k.times(company).minus(pool.available).div(dec(1).minus(k))).ceil();
    price = pre.div(company.plus(increase));
    const next = safes.map((s, i) => {
      const byPrice = dec(s.amount)
        .div(price.times(dec(1).minus(dec(s.discountPct ?? 0).div(100))))
        .floor();
      const fraction = s.cap ? dec(s.amount).div(s.cap) : dec();
      const byCap = s.cap
        ? fraction
            .times(fd.plus(totalConversion.minus(conversion[i] ?? 0)))
            .div(dec(1).minus(fraction))
            .floor()
        : dec();
      routes[i] = byCap.gte(byPrice) && s.cap ? "cap" : s.discountPct ? "discount" : "round";
      return D.max(byCap, byPrice);
    });
    if (next.every((n, i) => n.eq(conversion[i] ?? 0))) {
      converged = true;
      break;
    }
    conversion = next;
  }
  if (!converged) fail("SAFE conversion did not converge. Use a reviewed conversion schedule.");
  if (conversion.some((shares) => shares.lte(0)))
    fail("A SAFE converts to less than one whole share. Use a reviewed conversion schedule.");
  if (price.toDecimalPlaces(18).lte(0))
    fail("The share price is below the supported decimal scale.");
  const allocations = terms.investments.map((x) => {
    const shares = dec(x.amount).div(price).floor();
    if (shares.lte(0)) fail("An investment is too small to buy one whole share.");
    return {
      holderId: x.holderId,
      shares: shares.toFixed(0),
      amount: x.amount,
      unallocatedCash: dec(x.amount).minus(shares.times(price)).toFixed(18),
    };
  });
  const fullyDiluted = fd
    .plus(sum(conversion))
    .plus(increase)
    .plus(sum(allocations.map((a) => a.shares)));
  return {
    pricePerShare: price.toFixed(18),
    preMoney: terms.preMoney,
    newMoney: cash.toFixed(),
    postMoney: pre.plus(cash).toFixed(),
    poolIncrease: increase.toFixed(0),
    conversions: safes.map((s, i) => ({
      securityId: s.id,
      holderId: s.holderId,
      shares: (conversion[i] ?? dec()).toFixed(0),
      method: routes[i] ?? "round",
      price: dec(s.amount)
        .div(conversion[i] ?? 1)
        .toFixed(18),
    })),
    allocations,
    fullyDilutedShares: fullyDiluted.toFixed(0),
    poolPct: dec(pool.available).plus(increase).div(fullyDiluted).times(100).toFixed(8),
    rounding:
      "Whole shares floor; pool increases ceil; prices calculate at 60 significant digits and display at 18 decimal places. Residual cash is reported.",
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
  return dec(input.shares).times(elapsed).div(input.months).floor().toFixed(0);
}
