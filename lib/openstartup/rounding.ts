// Shared share and price rounding for the open-startup modules (the YC Post-Money Safe User
// Guide conventions documented in capTable.ts: whole-share floors, 4-decimal prices).
// Pure, client-safe, and free of other module imports so consumers that vendor a subset of
// lib/openstartup can include it on its own.

export const PRICE_DECIMALS = 4

/** Floor to whole shares, with an epsilon nudge so float noise like 588235.249999999
 * (an exact .25 in decimal) does not floor one share low. */
export function floorShares(x: number): number {
  return Math.floor(x + 1e-7)
}

/** Round a price per share to PRICE_DECIMALS decimals (YC guide style: $1.1144). */
export function roundPrice(x: number): number {
  const f = 10 ** PRICE_DECIMALS
  return Math.round(x * f) / f
}
