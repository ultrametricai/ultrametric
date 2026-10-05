// Server-side builders for /everything (app/everything/page.tsx) — the power view: the whole
// catalog on one page. One pass over loadAll()'s CategoryData[] produces lean, serializable rows
// (same discipline as lib/megaTable.ts: no evidence/verdicts/stories cross the wire — every
// extra field is bundle weight). The product rows feed the page's only client component
// (components/EverythingCatalog.tsx, via the pure helpers in lib/everythingFacets.ts); the
// process/stack/lens rows render server-side and never hydrate.
import { hasLogo } from './logos'
import { computeAccessGlyphs } from './accessGlyphs'
import { resolveAllStacks } from './aiStacks'
import { confidenceFor } from './confidence'
import type { CategoryData } from './data-helpers'
import type { EverythingRow } from './everythingFacets'
import { loadIcpTypes } from './icp'
import { loadProcesses, processSlug, taskCeiling, phaseRank, VENDOR_ARENA, vendorLabel, vendorProductId } from './processes'
import { metricTrendDelta } from './scoreHistory'

// Rows come out in categories.json order, each arena's slice in leaderboard order — the
// contract lib/everythingFacets.ts's groupRowsByArena leans on (first row per arena = leader).
export function buildEverythingRows(categories: CategoryData[]): EverythingRow[] {
  const rows: EverythingRow[] = []
  for (const data of categories) {
    const productById = new Map(data.products.map((p) => [p.id, p]))
    const arenaId = data.category.id
    for (const entry of data.rankings.leaderboard) {
      const product = productById.get(entry.productId)
      if (!product) continue
      const glyphs = computeAccessGlyphs(data, product.id)
      rows.push({
        productId: product.id,
        name: product.name,
        vendor: product.vendor,
        arenaId,
        arenaName: data.category.name,
        oss: product.type === 'oss',
        hasLogo: hasLogo(product.id),
        score: entry.aiEra,
        agentReady: entry.agentReady,
        agenticApp: entry.agenticApp,
        grade: confidenceFor(data, product.id).grade,
        access: `${glyphs.MCP.char}${glyphs.CLI.char}${glyphs.API.char}`,
        trend: metricTrendDelta(arenaId, product.id, 'aiEra'),
      })
    }
  }
  return rows
}

export interface EverythingProcessRow {
  slug: string
  title: string
  phase: string
  /** Agent ceiling % (share of steps an agent can run today). */
  pct: number
  agentSteps: number
  totalSteps: number
  /** Up to two vendor chips — mapped-to-arena vendors first (they link to the judged product page). */
  vendors: Array<{ label: string; arenaId: string | null; productId: string }>
}

export function buildEverythingProcessRows(dir?: string): EverythingProcessRow[] {
  const tasks = [...loadProcesses(dir)].sort(
    (a, b) => phaseRank(a.phase) - phaseRank(b.phase) || a.title.localeCompare(b.title),
  )
  return tasks.map((t) => {
    const c = taskCeiling(t)
    const unique = [...new Set(t.vendors)]
    const chips = [
      ...unique.filter((v) => VENDOR_ARENA[v]),
      ...unique.filter((v) => !VENDOR_ARENA[v]),
    ].slice(0, 2)
    return {
      slug: processSlug(t.title),
      title: t.title,
      phase: t.phase,
      pct: c.pct,
      agentSteps: c.agentSteps,
      totalSteps: c.totalSteps,
      vendors: chips.map((v) => ({ label: vendorLabel(v), arenaId: VENDOR_ARENA[v] ?? null, productId: vendorProductId(v) })),
    }
  })
}

export interface EverythingStackRow {
  id: string
  name: string
  slotCount: number
  /** Resolved pick names, in slot order (editorial slots use their editorial name). */
  picks: string[]
}

export function buildEverythingStackRows(categories: CategoryData[], dataDir?: string): EverythingStackRow[] {
  return resolveAllStacks(categories, dataDir).map((s) => ({
    id: s.id,
    name: s.name,
    slotCount: s.slots.length,
    picks: s.slots
      .map((slot) => slot.productName ?? slot.editorialName)
      .filter((n): n is string => n !== null),
  }))
}

export interface EverythingLensRow {
  id: string
  name: string
  tagline: string
}

export function buildEverythingLensRows(dataDir?: string): EverythingLensRow[] {
  return loadIcpTypes(dataDir).map((icp) => ({ id: icp.id, name: icp.name, tagline: icp.tagline }))
}
