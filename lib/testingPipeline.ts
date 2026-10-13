import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { evidenceById, verdictFor, type CategoryData } from './data-helpers'
import { verificationLevel } from './verification'
import type { Verdict } from './schemas'

// Data behind /pipeline — the public testing-pipeline transparency board. Its whole reason to
// exist is the question review sites never answer: "what have you NOT tested?" So the numbers
// here lead with the gaps: untested cells, the share of cells backed by hands-on probes, the
// most-wanted untested (product, story) pairs, and which arenas are next.
//
// Named testingPipeline (not pipeline) to avoid colliding with the top-level pipeline/ build
// tooling — this module is about *publishing* the pipeline's coverage, not running it.

// "Untested" for a single cell — the per-cell generalization of data-helpers'
// isGroupUntested: a zero-evidence none/na means we found nothing pro or con and never probed
// it, so the honest status is unknown, not failed/inapplicable-with-certainty.
export function isCellUntested(verdict: Verdict): boolean {
  return (verdict.verdict === 'none' || verdict.verdict === 'na') && verdict.evidenceIds.length === 0
}

export interface ArenaPipelineStats {
  arenaId: string
  arenaName: string
  products: number
  totalCells: number
  untestedCells: number
  untestedPct: number
  // Cells whose verdict cites at least one probe-tier evidence item (verificationLevel
  // 'tested' — the strict hands-on tier, deliberately narrower than the confidence layer's
  // probe-or-github testedShare).
  probedCells: number
  probedPct: number
}

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10)

export function arenaPipelineStats(data: CategoryData): ArenaPipelineStats {
  const evidence = evidenceById(data)
  let untested = 0
  let probed = 0
  let total = 0
  for (const p of data.products) {
    for (const s of data.stories) {
      const v = verdictFor(data, p.id, s.id)
      total++
      if (isCellUntested(v)) untested++
      if (verificationLevel(v, evidence) === 'tested') probed++
    }
  }
  return {
    arenaId: data.category.id,
    arenaName: data.category.name,
    products: data.products.length,
    totalCells: total,
    untestedCells: untested,
    untestedPct: pct(untested, total),
    probedCells: probed,
    probedPct: pct(probed, total),
  }
}

export interface SitePipelineTotals {
  arenas: number
  totalCells: number
  untestedCells: number
  untestedPct: number
  probedCells: number
  probedPct: number
}

export function sitePipelineTotals(stats: ArenaPipelineStats[]): SitePipelineTotals {
  const totalCells = stats.reduce((s, a) => s + a.totalCells, 0)
  const untestedCells = stats.reduce((s, a) => s + a.untestedCells, 0)
  const probedCells = stats.reduce((s, a) => s + a.probedCells, 0)
  return {
    arenas: stats.length,
    totalCells,
    untestedCells,
    untestedPct: pct(untestedCells, totalCells),
    probedCells,
    probedPct: pct(probedCells, totalCells),
  }
}

export interface MostWantedCell {
  arenaId: string
  arenaName: string
  productId: string
  productName: string
  storyId: string
  storyTitle: string
  weight: number
  stars: number | null
  // Ranking signal: story weight × a dampened popularity term. Stars are log-scaled so a
  // 100k-star product doesn't monopolize the whole list, and the +10 floor keeps
  // no-public-signal products rankable by weight alone rather than zeroed out.
  demand: number
}

export function untestedDemand(weight: number, stars: number | null): number {
  return weight * Math.log10((stars ?? 0) + 10)
}

// A single hugely-popular product with many untested heavy cells would otherwise fill the
// whole top-10 by itself (React alone has 10+ weight-3 untested cells) — cap per product so
// the list stays a to-do board, not one product's gap report.
export const MOST_WANTED_MAX_PER_PRODUCT = 2

// The site-wide top-N most-wanted untested (product, story) pairs: the cells whose testing
// would move the most-read scores the most — heavy stories on popular products that today
// rest on nothing at all.
export function mostWantedUntested(categories: CategoryData[], limit = 10): MostWantedCell[] {
  const cells: MostWantedCell[] = []
  for (const data of categories) {
    for (const p of data.products) {
      const stars = data.popularity[p.id]?.stars ?? null
      for (const s of data.stories) {
        const v = verdictFor(data, p.id, s.id)
        if (!isCellUntested(v)) continue
        cells.push({
          arenaId: data.category.id,
          arenaName: data.category.name,
          productId: p.id,
          productName: p.name,
          storyId: s.id,
          storyTitle: s.title,
          weight: s.weight,
          stars,
          demand: untestedDemand(s.weight, stars),
        })
      }
    }
  }
  const ranked = cells.sort(
    (a, b) => b.demand - a.demand || b.weight - a.weight || a.productId.localeCompare(b.productId) || a.storyId.localeCompare(b.storyId),
  )
  const perProduct = new Map<string, number>()
  const picked: MostWantedCell[] = []
  for (const c of ranked) {
    if (picked.length >= limit) break
    const used = perProduct.get(c.productId) ?? 0
    if (used >= MOST_WANTED_MAX_PER_PRODUCT) continue
    perProduct.set(c.productId, used + 1)
    picked.push(c)
  }
  return picked
}

// rankings/arena-roadmap.json entries — validated loosely (the file carries more editorial fields
// than the pipeline page needs; unknown keys pass through untouched).
export const RoadmapEntrySchema = z.looseObject({
  id: z.string().min(1),
  name: z.string().min(1),
  tier: z.number().int().min(1),
  status: z.enum(['live', 'planned']),
  rationale: z.string().optional(),
  aiEraAngle: z.string().optional(),
  candidateProducts: z.array(z.string()).optional(),
})

export type RoadmapEntry = z.infer<typeof RoadmapEntrySchema>

// "Next up": tier-1 roadmap entries still marked planned AND not already live on the site —
// the roadmap file can lag reality (an arena ships before its status flips), so the live
// category list is the tie-breaker, not the file.
export function nextUpArenas(liveArenaIds: ReadonlySet<string>, dataDir = path.join(process.cwd(), 'rankings')): RoadmapEntry[] {
  const raw = JSON.parse(fs.readFileSync(path.join(dataDir, 'arena-roadmap.json'), 'utf8'))
  const entries = RoadmapEntrySchema.array().parse(raw)
  return entries.filter((e) => e.tier === 1 && e.status === 'planned' && !liveArenaIds.has(e.id))
}
