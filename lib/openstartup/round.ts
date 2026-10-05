// Priced-round mechanics beyond the cap-table engine — the tenth module of the
// open-startup toolkit (founder direction 2026-10-01: "go super deep on business logic").
//
// Pure, client-safe (no node builtins), deterministic. Registered in
// open-modules/README.md; tested in lib/openstartup/__tests__/round.test.ts. This module
// deliberately REUSES the cap-table module's types and helpers (CapTableRow, floorShares,
// roundPrice, the pool algebra) and the anti-dilution module's adjustments — no parallel
// cap-table representation.
//
// Sources (each formula's doc comment cites the specific one):
// - YC Post-Money Safe User Guide (PDF linked from https://www.ycombinator.com/documents,
//   Feb 2023 edition, verified 2026-10-01): pro rata rights are the right to buy into the
//   Equity Financing "in proportion to as-converted ownership" (§E); the Appendix II
//   arithmetic — pro rata purchase = round shares × ownership percentage (4,486,719 × 10%
//   = 448,671) — is replayed in the tests.
// - Index Ventures, Rewarding Talent (https://www.indexventures.com/rewarding-talent/ —
//   resource id `index-rewarding-talent`): size the option pool bottom-up from the hiring
//   plan using the book's published grant grids, instead of defaulting to a flat
//   percentage. The grid VALUES stay in the book — this module takes the planned per-hire
//   percentages as input and does the arithmetic; the pool algebra itself is the
//   cap-table module's cited poolIncreaseForTarget / poolIncreaseForRoundTarget.
// - Bryan Springmeyer, "Anti-Dilution Provisions in Venture Capital Transactions"
//   (https://www.calstartuplawfirm.com/business-lawyer-blog/anti-dilution-provisions.php,
//   verified 2026-10-01): the down-round worked example the down-round model replays
//   end-to-end (8M founders/pool + 4M Series A at $2.00; 5M new shares at $1.00; broad-based
//   adjustment to $1.7059 → 4,689,606 as-converted shares).
// - Cooley GO glossary, "Secondary Sale" (https://www.cooleygo.com/glossary/secondary-sale/,
//   verified 2026-10-01): "the sale by an existing stockholder of shares of a private
//   company to a third party" — the company issues no new shares and receives no proceeds,
//   so a founder secondary dilutes NO ONE: fully diluted is unchanged, only the seller's
//   (down) and buyer's (up) positions move.
//
// Rounding conventions: whole shares floor (floorShares), prices to 4 decimals
// (roundPrice), dollars to cents — all the cap-table module's stated conventions.
// Educational model, not legal advice.
// ---------------------------------------------------------------------------

import { type CapTableRow, floorShares, poolIncreaseForRoundTarget, poolIncreaseForTarget, roundPrice } from './capTable'
import { type AdjustmentBasis, type AdjustmentResult, type DilutiveIssuance, applyAntiDilution } from './antiDilution'

function round2(x: number): number {
  return Math.round(x * 100) / 100
}

// ---------------------------------------------------------------------------
// Pro rata rights
// ---------------------------------------------------------------------------

/**
 * Pro rata purchase in an Equity Financing: floor(round shares × as-converted ownership %)
 * — the YC User Guide Appendix II arithmetic ("Investor B's pro rata = Total Series A
 * Shares × pro rata ownership percentage": 4,486,719 × 10% = 448,671), the same convention
 * the cap-table engine applies on conversion.
 */
export function proRataShares(roundShares: number, asConvertedOwnershipPct: number): number {
  if (!(roundShares >= 0)) throw new RangeError('roundShares must be >= 0')
  if (!(asConvertedOwnershipPct >= 0 && asConvertedOwnershipPct <= 100)) throw new RangeError('ownership pct must be in [0, 100]')
  return floorShares(roundShares * (asConvertedOwnershipPct / 100))
}

export interface MaintainOwnershipReport {
  /** Ownership before the round (0–100). */
  pctBefore: number
  /** Shares the holder must buy = its pro rata of the new issuance. */
  sharesNeeded: number
  /** Dollars needed at the round price (cents). */
  dollarsNeeded: number
  pctIfExercised: number
  pctIfDeclined: number
  needsReview: true
}

/**
 * Maintaining ownership through a round IS buying your pro rata of the new issuance —
 * the YC User Guide §E framing made explicit by algebra: keeping s/F = (s+x)/(F+N)
 * solves to x = s·N/F, which is exactly ownership% × round shares. So "how many dollars
 * to keep my percentage" = pro rata shares × PPS. Floored to whole shares, so the
 * maintained percentage can be a hair under the original (stated, not hidden).
 */
export function maintainOwnership(input: {
  holderShares: number
  /** Fully diluted BEFORE the new issuance (after any SAFE conversion / pool increase —
   * the base the round shares are added to). */
  fullyDilutedBefore: number
  /** New shares issued in the round (primary only — secondaries issue nothing, see
   * founderSecondary). */
  roundShares: number
  pps: number
}): MaintainOwnershipReport {
  const { holderShares: s, fullyDilutedBefore: f, roundShares: n, pps } = input
  if (!(s >= 0) || !(f > 0) || s > f) throw new RangeError('need 0 <= holderShares <= fullyDilutedBefore, fullyDilutedBefore > 0')
  if (!(n >= 0) || !(pps > 0)) throw new RangeError('roundShares must be >= 0 and pps > 0')
  const pctBefore = (s / f) * 100
  const x = proRataShares(n, pctBefore)
  return {
    pctBefore,
    sharesNeeded: x,
    dollarsNeeded: round2(x * pps),
    pctIfExercised: ((s + x) / (f + n)) * 100,
    pctIfDeclined: (s / (f + n)) * 100,
    needsReview: true,
  }
}

// ---------------------------------------------------------------------------
// Option-pool sizing from a hiring plan
// ---------------------------------------------------------------------------

export interface PlannedHire {
  role: string
  /** Planned grant as % of post-round fully diluted — take the number from a published
   * grant grid (Rewarding Talent's, resource id `index-rewarding-talent`); this module
   * never invents a benchmark. */
  grantPctOfFullyDiluted: number
}

export interface HiringPlanPool {
  hires: PlannedHire[]
  /** Σ grant percentages. */
  plannedPct: number
  bufferPct: number
  /** plannedPct + bufferPct — the pool target to hand to the cap-table pool algebra. */
  targetPoolPct: number
  needsReview: true
  note: string
}

/**
 * Bottom-up pool target: Σ(planned grants as % of fully diluted) + a stated buffer —
 * Rewarding Talent's approach of sizing the ESOP from the hiring plan (using its published
 * grant grids for the per-role numbers) instead of defaulting to a flat percentage, which
 * the YC User Guide's Quick Start §3 shows is founder dilution wherever it exceeds the
 * real need. The result feeds capTable.poolIncreaseForTarget (outside a round) or
 * poolIncreaseForRoundTarget (inside one) — both already cited there.
 */
export function poolTargetFromHiringPlan(hires: readonly PlannedHire[], bufferPct = 0): HiringPlanPool {
  if (hires.length === 0) throw new RangeError('at least one planned hire required')
  if (!(bufferPct >= 0)) throw new RangeError('bufferPct must be >= 0')
  let plannedPct = 0
  for (const h of hires) {
    if (!(h.grantPctOfFullyDiluted > 0)) throw new RangeError(`${h.role}: grantPctOfFullyDiluted must be > 0`)
    plannedPct += h.grantPctOfFullyDiluted
  }
  const targetPoolPct = plannedPct + bufferPct
  if (targetPoolPct >= 100) throw new RangeError('pool target must be < 100% of fully diluted')
  return {
    hires: [...hires],
    plannedPct,
    bufferPct,
    targetPoolPct,
    needsReview: true,
    note:
      `Pool target ${targetPoolPct.toFixed(2)}% = planned grants ${plannedPct.toFixed(2)}% + buffer ${bufferPct.toFixed(2)}%. ` +
      `Per-role sizes belong to a published grant grid (Rewarding Talent); every point of pool above the real hiring ` +
      `need is founder dilution (YC User Guide Quick Start §3).`,
  }
}

/** The hiring-plan target applied inside a priced round — a thin composition over
 * capTable.poolIncreaseForRoundTarget (cited there; the in-round "pool shuffle"). */
export function hiringPlanPoolIncrease(
  plan: HiringPlanPool,
  round: { fdPostConversion: number; unissued: number; preMoney: number; postMoney: number },
): number {
  return poolIncreaseForRoundTarget(round.fdPostConversion, round.unissued, plan.targetPoolPct, round.preMoney, round.postMoney)
}

/** The hiring-plan target applied outside a round — composition over
 * capTable.poolIncreaseForTarget (cited there). */
export function hiringPlanPoolTopUp(plan: HiringPlanPool, fullyDiluted: number, unissued: number): number {
  return poolIncreaseForTarget(fullyDiluted, unissued, plan.targetPoolPct)
}

// ---------------------------------------------------------------------------
// Down-round modeling (composes the anti-dilution module)
// ---------------------------------------------------------------------------

export interface ProtectedSeriesSpec {
  /** Must match the row's `name` in the snapshot rows (the cap-table engine issues
   * preferred as 1:1 rows, so the row's share count IS the preferred share count). */
  seriesName: string
  originalIssuePrice: number
  /** Conversion price before this round (= OIP if never adjusted). */
  conversionPriceBefore: number
  basis: AdjustmentBasis
}

export interface DownRoundHolderRow {
  name: string
  group: CapTableRow['group']
  sharesBefore: number
  /** As-converted shares after the round (adjusted for protected series; unchanged for
   * everyone else; the new investor appears with the new shares). */
  sharesAfter: number
  pctBefore: number
  pctAfter: number
}

export interface DownRoundReport {
  pps: number
  rows: DownRoundHolderRow[]
  adjustments: AdjustmentResult[]
  fullyDilutedBefore: number
  fullyDilutedAfter: number
  needsReview: true
  notes: string[]
}

/**
 * A dilutive priced round over an existing table, composing the anti-dilution module:
 * every protected series' conversion price adjusts per its basis (the broad base computed
 * from the table: all non-pool rows — common, options as-exercised, preferred as-converted;
 * the unissued pool excluded by default per the Springmeyer base definition, includable by
 * flag where the charter's definition counts it), as-converted counts move to
 * AdjustmentResult.asConvertedAfter, and the new investor's shares land on top. The
 * Springmeyer example replays end-to-end in the tests. Percentages are of as-converted
 * fully diluted; whether SAFes/notes also convert, and every carve-out, is deal text —
 * needsReview.
 *
 * Who absorbs the dilution: everyone whose conversion price did NOT adjust — founders,
 * options, and any unprotected series — their pctAfter falls by both the new money AND the
 * protected series' additional as-converted shares.
 */
export function downRoundModel(
  rows: readonly CapTableRow[],
  protectedSeries: readonly ProtectedSeriesSpec[],
  issuance: DilutiveIssuance & { investorName: string },
  options?: { includeUnissuedPoolInBase?: boolean },
): DownRoundReport {
  const concrete = rows.filter((r) => r.shares !== null)
  if (concrete.length !== rows.length) throw new RangeError('rows must have concrete share counts (convert SAFEs first)')
  if (concrete.length === 0) throw new RangeError('at least one row required')
  const fdBefore = concrete.reduce((s, r) => s + (r.shares as number), 0)
  if (!(fdBefore > 0)) throw new RangeError('fully diluted before must be > 0')
  const base = concrete.reduce(
    (s, r) => s + (r.group === 'pool' && !options?.includeUnissuedPoolInBase ? 0 : (r.shares as number)),
    0,
  )

  const adjustments: AdjustmentResult[] = []
  const afterShares = new Map<string, number>()
  for (const spec of protectedSeries) {
    const row = concrete.find((r) => r.name === spec.seriesName)
    if (!row) throw new RangeError(`protected series ${spec.seriesName}: no matching row`)
    const adj = applyAntiDilution(
      {
        name: spec.seriesName,
        preferredShares: row.shares as number,
        originalIssuePrice: spec.originalIssuePrice,
        conversionPriceBefore: spec.conversionPriceBefore,
      },
      issuance,
      spec.basis,
      spec.basis === 'broad-based' ? base : undefined,
    )
    adjustments.push(adj)
    afterShares.set(spec.seriesName, adj.asConvertedAfter)
  }

  const fdAfter =
    concrete.reduce((s, r) => s + (afterShares.get(r.name) ?? (r.shares as number)), 0) + issuance.newShares
  const holderRows: DownRoundHolderRow[] = concrete.map((r) => {
    const before = r.shares as number
    const after = afterShares.get(r.name) ?? before
    return {
      name: r.name,
      group: r.group,
      sharesBefore: before,
      sharesAfter: after,
      pctBefore: (before / fdBefore) * 100,
      pctAfter: (after / fdAfter) * 100,
    }
  })
  holderRows.push({
    name: issuance.investorName,
    group: 'investor',
    sharesBefore: 0,
    sharesAfter: issuance.newShares,
    pctBefore: 0,
    pctAfter: (issuance.newShares / fdAfter) * 100,
  })

  return {
    pps: roundPrice(issuance.considerationDollars / issuance.newShares),
    rows: holderRows,
    adjustments,
    fullyDilutedBefore: fdBefore,
    fullyDilutedAfter: fdAfter,
    needsReview: true,
    notes: [
      'Anti-dilution adjustments per the anti-dilution module (NVCA model COD weighted average / full ratchet); exempt-issuance carve-outs and pay-to-play conditions are charter text, not applied here.',
      'The dilution lands on every unadjusted holder — founders, options, unprotected series — via both the new shares and the protected series’ additional as-converted shares.',
      options?.includeUnissuedPoolInBase
        ? 'Unissued pool INCLUDED in the weighted-average base (charter-definition flag).'
        : 'Unissued pool excluded from the weighted-average base (the Springmeyer base definition); flag it in where the charter counts it.',
    ],
  }
}

// ---------------------------------------------------------------------------
// Secondary sales
// ---------------------------------------------------------------------------

export interface SecondaryReport {
  rows: CapTableRow[]
  sharesTransferred: number
  /** Always equal before/after — a secondary issues nothing (Cooley GO glossary). */
  fullyDiluted: number
  /** Cents, when a price per share is supplied; proceeds go to the SELLER, not the company. */
  sellerProceeds?: number
  needsReview: true
  note: string
}

/**
 * Founder (or any holder) secondary: "the sale by an existing stockholder of shares of a
 * private company to a third party" (Cooley GO glossary, Secondary Sale). The company
 * issues no new shares and receives no proceeds, so NOBODY dilutes — fully diluted is
 * unchanged and every non-party's percentage is exactly what it was; only the seller's
 * stake falls and the buyer's rises, by the same share count. In a round, the buyer's
 * total position is simply primary (new, dilutive) + secondary (transferred, not dilutive)
 * — model the primary with the cap-table engine or downRoundModel and the secondary here.
 * Transfer restrictions, ROFRs, and the 409A implications of a secondary price are deal
 * and valuation questions — needsReview.
 */
export function founderSecondary(
  rows: readonly CapTableRow[],
  sellerName: string,
  buyerName: string,
  sharesSold: number,
  ppsPaid?: number,
): SecondaryReport {
  if (!(sharesSold > 0) || !Number.isFinite(sharesSold)) throw new RangeError('sharesSold must be > 0')
  if (ppsPaid !== undefined && !(ppsPaid > 0)) throw new RangeError('ppsPaid must be > 0 when supplied')
  const n = floorShares(sharesSold)
  const seller = rows.find((r) => r.name === sellerName)
  if (!seller || seller.shares === null) throw new RangeError(`seller ${sellerName}: no row with concrete shares`)
  if (seller.shares < n) throw new RangeError(`seller ${sellerName}: cannot sell ${n} of ${seller.shares} shares`)
  if (sellerName === buyerName) throw new RangeError('buyer and seller must differ')

  const out: CapTableRow[] = rows.map((r) => ({ ...r }))
  const sellerOut = out.find((r) => r.name === sellerName) as CapTableRow & { shares: number }
  sellerOut.shares = (sellerOut.shares as number) - n
  const buyer = out.find((r) => r.name === buyerName)
  if (buyer) {
    if (buyer.shares === null) throw new RangeError(`buyer ${buyerName}: row has no concrete shares`)
    buyer.shares += n
  } else {
    out.push({ id: `secondary-${buyerName}`, name: buyerName, group: 'investor', shares: n, pct: null })
  }
  const fd = out.reduce((s, r) => s + (r.shares ?? 0), 0)
  for (const r of out) if (r.shares !== null && fd > 0) r.pct = (r.shares / fd) * 100

  return {
    rows: out,
    sharesTransferred: n,
    fullyDiluted: fd,
    sellerProceeds: ppsPaid !== undefined ? round2(n * ppsPaid) : undefined,
    needsReview: true,
    note:
      `Secondary transfer of ${n.toLocaleString('en-US')} shares ${sellerName} → ${buyerName}: no new shares, no company ` +
      `proceeds, no dilution (Cooley GO glossary, Secondary Sale) — every non-party percentage is unchanged. Transfer ` +
      `restrictions, ROFRs, and 409A implications of the secondary price are deal/valuation questions.`,
  }
}
