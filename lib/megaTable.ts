// Server-side row builder for components/MegaTable.tsx (the homepage's global mega-table over
// every product in every arena). Deliberately produces a flat, minimal MegaTableRow per product
// — no evidence, verdicts, stories, or claims — since this gets serialized as a client-component
// prop and every extra field is bundle weight the table's columns never use.
import arenaIcons from '../data/arena-icons.json'
import { computeAccessGlyphs, type AccessGlyph } from './accessGlyphs'
import { confidenceFor } from './confidence'
import { isGroupUntested, type CategoryData } from './data-helpers'
import { loadFamilies } from './families'
import { computeHotFlags } from './hotProducts'
import { hasLogo } from './logos'
import { type MegaTableAccessGlyph, type MegaTableRow } from './megaTableSort'
import { metricTrendDelta } from './scoreHistory'
import { aiEraBandFor, loadScoreIntervals } from './scoreIntervals'

function toClientGlyph(glyph: AccessGlyph, arenaId: string, productId: string): MegaTableAccessGlyph {
  return {
    char: glyph.char,
    className: glyph.className,
    title: glyph.title,
    href: `/arena/${arenaId}/product/${productId}#story-${glyph.storyId}`,
  }
}

// Hardware-class arenas (naDimensions suppresses agentReady — a CPU/GPU has no agent-drivable
// surface of its own) are EXCLUDED from the homepage company/product rankings (founder
// 2026-09-25: "Intel Core Ultra 7 258V under 'most agent-ready' makes no sense"). They keep
// their own arena pages, the /arenas directory, and /experiments views — just not this table.
export function isHardwareClass(data: CategoryData): boolean {
  return (data.category.naDimensions ?? []).includes('agentReady')
}

export function buildMegaTableRows(categories: CategoryData[]): MegaTableRow[] {
  const rows: MegaTableRow[] = []
  categories = categories.filter((d) => !isHardwareClass(d))
  // 🔥 flags (see lib/hotProducts.ts) are global per product — computed once over the whole
  // fleet, then serialized as a plain reason string per row.
  const hotFlags = computeHotFlags(categories)
  // Founder 2026-09-16: the homepage table defaults to COMPANIES — a multi-product family
  // shows only its parent row (one Stripe, not Stripe + Issuing + Tax + Treasury + …). Sub-
  // product rows are still BUILT, flagged isFamilySubProduct, and hidden client-side behind
  // the "Include all products of companies" toggle (components/MegaTable.tsx). A judged
  // sub-product always stays fully ranked in its own arena.
  const familySubProducts = new Set<string>()
  for (const family of loadFamilies()) {
    for (const sub of family.subProducts) {
      const ref = sub.arenaRef
      if (ref && ref.productId !== family.parent.productId) {
        familySubProducts.add(`${ref.arenaId}:${ref.productId}`)
      }
    }
  }
  for (const data of categories) {
    const productById = new Map(data.products.map((p) => [p.id, p]))
    const intervals = loadScoreIntervals(data.category.id)
    for (const entry of data.rankings.leaderboard) {
      const product = productById.get(entry.productId)
      if (!product) continue
      const isFamilySubProduct = familySubProducts.has(`${data.category.id}:${product.id}`) || undefined
      const glyphs = computeAccessGlyphs(data, product.id)
      const arenaId = data.category.id
      rows.push({
        productId: product.id,
        name: product.name,
        vendor: product.vendor,
        githubUrl: product.urls.github,
        type: product.type,
        arenaId: data.category.id,
        arenaName: data.category.name,
        hasLogo: hasLogo(product.id),
        initScore: entry.aiEra,
        agentReady: entry.agentReady,
        agenticApp: entry.agenticApp,
        apiQuality: entry.apiQuality,
        apiUntested: isGroupUntested(data, product.id, 'api-quality'),
        agentReadyUntested: isGroupUntested(data, product.id, 'agent-access'),
        agenticAppUntested: isGroupUntested(data, product.id, 'agentic-features'),
        popularity: data.popularity[product.id]?.stars ?? null,
        hotReason: hotFlags.get(product.id)?.reason ?? null,
        ycBatch: product.ycBatch,
        enterprise: product.enterprise,
        shutdown: product.shutdown,
        isFamilySubProduct,
        naDimensions: data.category.naDimensions,
        trendDelta: metricTrendDelta(arenaId, product.id, 'aiEra'),
        agentReadyTrendDelta: metricTrendDelta(arenaId, product.id, 'agentReady'),
        confidence: confidenceFor(data, product.id),
        interval: aiEraBandFor(intervals, product.id) ?? null,
        access: {
          MCP: toClientGlyph(glyphs.MCP, arenaId, product.id),
          CLI: toClientGlyph(glyphs.CLI, arenaId, product.id),
          API: toClientGlyph(glyphs.API, arenaId, product.id),
        },
      })
    }
  }
  // One row per product in the default companies view: a product judged in several arenas
  // (airwallex: payments + startup-banking; brex/ramp/foreloop likewise) keeps its best-scoring
  // arena row; the others are flagged isSecondaryArena and hidden behind the same "Include all
  // products of companies" toggle as family sub-rows. Founder 2026-09-21. Family-sub rows are
  // skipped in the best-row election so a parent never loses its row to a hidden sub.
  const bestByProduct = new Map<string, MegaTableRow>()
  for (const row of rows) {
    if (row.isFamilySubProduct) continue
    const best = bestByProduct.get(row.productId)
    const score = row.initScore ?? -1
    const bestScore = best?.initScore ?? -1
    if (
      !best ||
      score > bestScore ||
      (score === bestScore && (row.popularity ?? 0) > (best.popularity ?? 0))
    ) {
      bestByProduct.set(row.productId, row)
    }
  }
  for (const row of rows) {
    if (!row.isFamilySubProduct && bestByProduct.get(row.productId) !== row) {
      row.isSecondaryArena = true
    }
  }
  return rows
}

export interface MegaTableArenaOption {
  id: string
  name: string
  // Legacy emoji arena icon (data/arena-icons.json) — since the house icon sweep (founder
  // 2026-10-08) it decorates ONLY the below-sm native <option> labels, where SVG can't render;
  // the desktop scope listbox renders the house glyph via arenaIcon() instead.
  icon?: string
}

export function buildMegaTableArenaOptions(categories: CategoryData[]): MegaTableArenaOption[] {
  return categories.filter((d) => !isHardwareClass(d)).map((data) => ({
    id: data.category.id,
    name: data.category.name,
    icon: (arenaIcons as Record<string, string>)[data.category.id],
  }))
}
