// Cross-arena YC-alumni ranking rows for /yc and /yc/[batch] (same lib-level row-builder shape
// as lib/icp.ts's buildIcpRanking): every tracked product carrying a verified `ycBatch` stamp
// (data/yc-batches.json via pipeline/scripts/yc-cross-reference.ts — matched by website domain,
// never by name), with the three headline scores its arena leaderboard already computed. This is
// the coverage caveat's data source: only YC companies WE track — not a YC-wide census.
// Coverage grows batch by batch via pipeline/scripts/yc-coverage-queue.ts.
import type { CategoryData } from './data'

export interface YcRow {
  productId: string
  productName: string
  type: 'oss' | 'commercial' | 'government'
  ycBatch: string
  arenaId: string
  arenaName: string
  agentReady: number | null
  agenticApp: number | null
  aiEra: number | null
}

// YC's official season codes, in within-year order: Winter, Spring (X, not S), Summer, Fall.
const SEASON_ORDER: Record<string, number> = { W: 0, X: 1, S: 2, F: 3 }
const SEASON_NAME: Record<string, string> = { W: 'Winter', X: 'Spring', S: 'Summer', F: 'Fall' }

// "W23" -> sortable ordinal (bigger = more recent); null for anything that isn't a batch code.
export function batchOrdinal(code: string): number | null {
  const m = /^([WXSF])(\d{2})$/.exec(code)
  if (!m) return null
  return (2000 + Number(m[2])) * 4 + SEASON_ORDER[m[1]]
}

// "W23" -> "Winter 2023" (YC founded 2005, so two-digit years are always 20xx).
export function batchLabel(code: string): string {
  const m = /^([WXSF])(\d{2})$/.exec(code)
  if (!m) return code
  return `${SEASON_NAME[m[1]]} 20${m[2]}`
}

// One row per YC-stamped product. A product tracked in more than one arena keeps the arena where
// its Overall score (aiEra) is highest (deterministic tiebreak: arena id) — same one-row-per-product
// dedupe the sitemap applies with seenProductIds.
export function buildYcRows(categories: CategoryData[]): YcRow[] {
  const byProduct = new Map<string, YcRow>()
  for (const data of categories) {
    for (const entry of data.rankings.leaderboard) {
      const product = data.products.find((p) => p.id === entry.productId)
      if (!product?.ycBatch) continue
      const row: YcRow = {
        productId: product.id,
        productName: product.name,
        type: product.type,
        ycBatch: product.ycBatch,
        arenaId: data.category.id,
        arenaName: data.category.name,
        agentReady: entry.agentReady,
        agenticApp: entry.agenticApp,
        aiEra: entry.aiEra,
      }
      const existing = byProduct.get(product.id)
      if (
        !existing ||
        (row.aiEra ?? -1) > (existing.aiEra ?? -1) ||
        ((row.aiEra ?? -1) === (existing.aiEra ?? -1) && row.arenaId < existing.arenaId)
      ) {
        byProduct.set(product.id, row)
      }
    }
  }
  return Array.from(byProduct.values())
}

// Batch ranking order: most agent-ready first (nulls last), then Built-in AI, then Overall score,
// then name — the "could an agent run this product" question the founder is asking per batch.
export function sortYcRows(rows: YcRow[]): YcRow[] {
  const key = (v: number | null) => (v === null ? -1 : v)
  return [...rows].sort(
    (a, b) =>
      key(b.agentReady) - key(a.agentReady) ||
      key(b.agenticApp) - key(a.agenticApp) ||
      key(b.aiEra) - key(a.aiEra) ||
      a.productName.localeCompare(b.productName),
  )
}

export interface YcBatchSummary {
  code: string
  label: string
  count: number
  leader: YcRow | null
}

// Every batch with at least one tracked product, newest first, with the batch's most
// agent-ready product as the headline.
export function ycBatchSummaries(rows: YcRow[]): YcBatchSummary[] {
  const byBatch = new Map<string, YcRow[]>()
  for (const row of rows) {
    if (!byBatch.has(row.ycBatch)) byBatch.set(row.ycBatch, [])
    byBatch.get(row.ycBatch)!.push(row)
  }
  return Array.from(byBatch.entries())
    .sort((a, b) => (batchOrdinal(b[0]) ?? -1) - (batchOrdinal(a[0]) ?? -1))
    .map(([code, members]) => ({
      code,
      label: batchLabel(code),
      count: members.length,
      leader: sortYcRows(members)[0] ?? null,
    }))
}
