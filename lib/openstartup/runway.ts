// Runway & burn — the second module of the open-startup toolkit (founder direction
// 2026-09-29: broaden business-logic beyond the cap-table engine).
//
// Pure, client-safe (no node builtins), deterministic. Registered in
// open-modules/README.md; exhaustively tested in lib/openstartup/__tests__/runway.test.ts
// with the arithmetic re-derived in comments.
//
// Source for the model (cited per function below): Paul Graham, "Default Alive or Default
// Dead?" (October 2015, https://paulgraham.com/aord.html — resources/registry.json id
// `pg-default-alive`): "assuming their expenses remain constant and their revenue growth is
// what it's been over the last several months, do they make it to profitability on the money
// they have left?" The essay links Trevor Blackwell's calculator as the reference
// implementation of exactly this projection (growth.tlb.org — unreachable over HTTPS when
// checked 2026-09-29, which is why the model is re-implemented here rather than linked).
//
// Model conventions (explicit):
// - Month 0 is "now": `monthlyRevenue` and `monthlyExpenses` are the current month's run
//   rates; the projection starts at month 1.
// - Revenue compounds at `revenueGrowthPctMoM`; expenses stay constant by default (the
//   essay's stated assumption) unless `expenseGrowthPctMoM` is given.
// - Net burn = expenses − revenue (gross burn is expenses alone). Cash is reduced by net
//   burn each month; a profitable month adds cash.
// - Trajectory money values are rounded to cents for stable, readable reports; status
//   decisions use the unrounded running totals.
// Educational model, not financial advice: it is the founder's job to know the real numbers.
// ---------------------------------------------------------------------------

function round2(x: number): number {
  return Math.round(x * 100) / 100
}

export interface RunwayInputs {
  /** Cash on hand now, in dollars. */
  cash: number
  /** Current monthly revenue run rate, in dollars (>= 0). */
  monthlyRevenue: number
  /** Current monthly operating expenses (gross burn), in dollars (>= 0). */
  monthlyExpenses: number
  /** Month-over-month revenue growth, in percent (10 → ×1.10 per month). */
  revenueGrowthPctMoM: number
  /** Month-over-month expense growth, in percent. Default 0 — the constant-expenses
   * assumption of "Default Alive or Default Dead?". */
  expenseGrowthPctMoM?: number
}

export interface TrajectoryMonth {
  /** 1-based projection month. */
  month: number
  revenue: number
  expenses: number
  /** expenses − revenue; negative once profitable. */
  netBurn: number
  endingCash: number
}

export type AliveStatus = 'default-alive' | 'default-dead' | 'indeterminate'

export interface DefaultAliveReport {
  /** default-alive: reaches a profitable month with cash never having gone below zero.
   * default-dead: cash goes below zero before the first profitable month.
   * indeterminate: neither event inside the horizon (rare: near-zero growth, deep cash). */
  status: AliveStatus
  /** First month with revenue >= expenses; null if not reached in the horizon. */
  monthsToProfitability: number | null
  /** First month whose ending cash is below zero; null if cash never runs out. */
  monthsToZeroCash: number | null
  /** The cash trough across the projection (dollars, cents-rounded). */
  minCash: number
  trajectory: TrajectoryMonth[]
}

function assertInputs(input: RunwayInputs): void {
  if (!(input.cash >= 0)) throw new RangeError('cash must be >= 0')
  if (!(input.monthlyRevenue >= 0)) throw new RangeError('monthlyRevenue must be >= 0')
  if (!(input.monthlyExpenses >= 0)) throw new RangeError('monthlyExpenses must be >= 0')
  if (!(input.revenueGrowthPctMoM > -100)) throw new RangeError('revenueGrowthPctMoM must be > -100')
  const eg = input.expenseGrowthPctMoM ?? 0
  if (!(eg > -100)) throw new RangeError('expenseGrowthPctMoM must be > -100')
}

/**
 * Months of runway at a constant net burn: cash / netMonthlyBurn — the naive figure every
 * founder quotes, kept as the baseline the growth-adjusted number is compared against.
 * Infinity when net burn <= 0 (already profitable: runway is not the binding constraint —
 * "Default Alive or Default Dead?" is about companies that haven't reached that point).
 */
export function simpleRunwayMonths(cash: number, netMonthlyBurn: number): number {
  if (!(cash >= 0)) throw new RangeError('cash must be >= 0')
  return netMonthlyBurn <= 0 ? Infinity : cash / netMonthlyBurn
}

/**
 * The default-alive test of Paul Graham's "Default Alive or Default Dead?" (October 2015):
 * hold expenses on their stated path (constant by default), compound revenue at its current
 * growth rate, and ask whether the company reaches profitability before the cash runs out.
 * `extraMonthlyExpenses(month)` lets callers layer scenario costs (see hiringImpact) without
 * changing the base inputs.
 */
export function defaultAliveReport(
  input: RunwayInputs,
  options?: { horizonMonths?: number; extraMonthlyExpenses?: (month: number) => number },
): DefaultAliveReport {
  assertInputs(input)
  const horizon = options?.horizonMonths ?? 120
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 1200) throw new RangeError('horizonMonths must be 1..1200')
  const extra = options?.extraMonthlyExpenses ?? (() => 0)
  const g = 1 + input.revenueGrowthPctMoM / 100
  const ge = 1 + (input.expenseGrowthPctMoM ?? 0) / 100

  const trajectory: TrajectoryMonth[] = []
  let cash = input.cash
  let minCash = input.cash
  let monthsToProfitability: number | null = null
  let monthsToZeroCash: number | null = null

  for (let m = 1; m <= horizon; m++) {
    const revenue = input.monthlyRevenue * g ** m
    const addl = extra(m)
    if (!(addl >= 0)) throw new RangeError(`extraMonthlyExpenses(${m}) must be >= 0`)
    const expenses = input.monthlyExpenses * ge ** m + addl
    const netBurn = expenses - revenue
    cash -= netBurn
    if (cash < minCash) minCash = cash
    trajectory.push({ month: m, revenue: round2(revenue), expenses: round2(expenses), netBurn: round2(netBurn), endingCash: round2(cash) })
    if (monthsToProfitability === null && revenue >= expenses) monthsToProfitability = m
    if (monthsToZeroCash === null && cash < 0) monthsToZeroCash = m
    // Both questions answered: the report is decidable, stop projecting.
    if (monthsToProfitability !== null && (monthsToZeroCash !== null || cash >= 0)) break
  }

  const status: AliveStatus =
    monthsToProfitability !== null && (monthsToZeroCash === null || monthsToZeroCash > monthsToProfitability)
      ? 'default-alive'
      : monthsToZeroCash !== null
        ? 'default-dead'
        : 'indeterminate'

  return { status, monthsToProfitability, monthsToZeroCash, minCash: round2(minCash), trajectory }
}

/**
 * Growth-adjusted runway: the month cash actually runs out once compounding revenue is
 * credited against the burn — the honest version of cash/burn for a growing company.
 * Returns null when cash never runs out inside the horizon (default alive, or indeterminate
 * with the trough still positive).
 */
export function growthAdjustedRunwayMonths(input: RunwayInputs, options?: { horizonMonths?: number }): number | null {
  return defaultAliveReport(input, options).monthsToZeroCash
}

export interface HirePlan {
  /** Fully loaded monthly cost per hire, in dollars (> 0). */
  monthlyCost: number
  /** 1-based projection month the cost starts. */
  startMonth: number
  /** Number of identical hires (default 1). */
  count?: number
}

export interface HiringImpact {
  base: DefaultAliveReport
  withHires: DefaultAliveReport
  /** monthsToZeroCash delta (negative = runway lost). Null when either side never runs out. */
  runwayDeltaMonths: number | null
  /** The essay's warning made concrete: the plan flips the company from default alive to
   * default dead ("hiring too fast... the company is now default dead"). */
  becomesDefaultDead: boolean
}

/**
 * Hiring-impact scenario: replay the default-alive projection with a hiring plan layered on
 * top of base expenses. Hire costs are flat from their start month (they do not compound
 * with expenseGrowthPctMoM — a hire is a known commitment, not a trend). Per the essay,
 * overhiring is the usual mechanism by which a default-alive company becomes default dead;
 * this function measures exactly that flip.
 */
export function hiringImpact(input: RunwayInputs, hires: HirePlan[], options?: { horizonMonths?: number }): HiringImpact {
  for (const h of hires) {
    if (!(h.monthlyCost > 0)) throw new RangeError('hire monthlyCost must be > 0')
    if (!Number.isInteger(h.startMonth) || h.startMonth < 1) throw new RangeError('hire startMonth must be a month >= 1')
    if (h.count !== undefined && (!Number.isInteger(h.count) || h.count < 1)) throw new RangeError('hire count must be >= 1')
  }
  const base = defaultAliveReport(input, options)
  const withHires = defaultAliveReport(input, {
    ...options,
    extraMonthlyExpenses: (m) => hires.reduce((s, h) => s + (m >= h.startMonth ? h.monthlyCost * (h.count ?? 1) : 0), 0),
  })
  const runwayDeltaMonths =
    base.monthsToZeroCash !== null && withHires.monthsToZeroCash !== null
      ? withHires.monthsToZeroCash - base.monthsToZeroCash
      : null
  return {
    base,
    withHires,
    runwayDeltaMonths,
    becomesDefaultDead: base.status === 'default-alive' && withHires.status === 'default-dead',
  }
}
