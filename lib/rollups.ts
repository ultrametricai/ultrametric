import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import type { Product, Rankings } from './schemas'

// Country/area rollups for arenas whose products carry ProductSchema's `country`/`area` tags
// (government-services Phase 2, docs/vendor-research/government-agenticness-world.md §5.2).
// Derived, never authored: every number here is a mean over the arena's computed Overall
// scores (leaderboard aiEra) for the judged agencies tagged into each (country, area) cell —
// change verdicts or evidence and re-derive, never this file's output. Emitted by the derive
// stage as data/<cat>/rollups.json and reproduced byte-for-byte by recompute-check.

// The areas a country overall is averaged over. Fixed by design (§5.2): rollups compare only
// matched areas, so roster composition cannot move a country's overall score; a country gets an
// overall only when every matched area has at least one judged agency. Adding a fifth area
// later means adding it here AND rostering it for every country in the same change.
export const MATCHED_AREAS = ['company-registry', 'tax', 'ip-office', 'immigration'] as const

export const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  UK: 'United Kingdom',
  IN: 'India',
  DE: 'Germany',
  FR: 'France',
  PT: 'Portugal',
  CA: 'Canada',
}

export const AREA_NAMES: Record<string, string> = {
  'company-registry': 'Company registry',
  tax: 'Tax authority',
  'ip-office': 'IP office',
  immigration: 'Immigration',
  procurement: 'Procurement',
}

const CellSchema = z.object({
  // Mean Overall score (leaderboard aiEra) over the cell's judged agencies; null when every
  // agency's aiEra is null (nothing to average — never coerced to 0).
  score: z.number().min(0).max(100).nullable(),
  productIds: z.array(z.string().min(1)).min(1),
})

export const RollupsSchema = z.object({
  generatedAt: z.string().datetime(),
  matchedAreas: z.array(z.string().min(1)),
  countries: z.array(
    z.object({
      country: z.string().min(1),
      // Mean over the matched areas' cell scores; null unless the country has a judged agency
      // in every matched area (partial coverage must not masquerade as a national score).
      overall: z.number().min(0).max(100).nullable(),
      areas: z.record(z.string(), CellSchema),
    }),
  ),
  // One board per area present in the roster (matched or not): one row per country, the same
  // cell scores as above, ranked. The founder's cross-country comparison (e.g. IP India vs
  // USPTO) is a row pair here.
  areaBoards: z.record(z.string(), z.array(CellSchema.extend({ country: z.string().min(1) }))),
})

export type Rollups = z.infer<typeof RollupsSchema>

const round1 = (n: number) => Math.round(n * 10) / 10

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return round1(values.reduce((a, b) => a + b, 0) / values.length)
}

// Pure derivation over (tagged products, computed rankings). Returns null when the arena has no
// country/area-tagged products at all (every other arena), so callers can skip emission.
export function buildRollups(products: Product[], rankings: Rankings): Rollups | null {
  for (const p of products) {
    if (!!p.country !== !!p.area) {
      throw new Error(`rollups: product ${p.id} must set country and area together`)
    }
  }
  const tagged = products.filter((p) => p.country && p.area)
  if (tagged.length === 0) return null

  const aiEraById = new Map(rankings.leaderboard.map((e) => [e.productId, e.aiEra]))
  for (const p of tagged) {
    if (!aiEraById.has(p.id)) throw new Error(`rollups: product ${p.id} missing from leaderboard`)
  }

  // (country, area) cells. productIds sorted for stable output.
  const cellKey = (c: string, a: string) => `${c}:${a}`
  const cells = new Map<string, { country: string; area: string; productIds: string[] }>()
  for (const p of tagged) {
    const key = cellKey(p.country!, p.area!)
    const cell = cells.get(key) ?? { country: p.country!, area: p.area!, productIds: [] }
    cell.productIds.push(p.id)
    cells.set(key, cell)
  }
  const cellScore = (productIds: string[]): number | null =>
    mean(productIds.map((id) => aiEraById.get(id)!).filter((v): v is number => v !== null))

  const countryCodes = [...new Set(tagged.map((p) => p.country!))].sort()
  const areas = [...new Set(tagged.map((p) => p.area!))].sort()

  const countries = countryCodes
    .map((country) => {
      const areaEntries: Record<string, { score: number | null; productIds: string[] }> = {}
      for (const area of areas) {
        const cell = cells.get(cellKey(country, area))
        if (!cell) continue
        const productIds = [...cell.productIds].sort()
        areaEntries[area] = { score: cellScore(productIds), productIds }
      }
      const matchedScores = MATCHED_AREAS.map((a) => areaEntries[a]?.score)
      const complete = matchedScores.every((s): s is number => s !== undefined && s !== null)
      return {
        country,
        overall: complete ? mean(matchedScores as number[]) : null,
        areas: areaEntries,
      }
    })
    .sort((x, y) => {
      if (x.overall === null && y.overall === null) return x.country.localeCompare(y.country)
      if (x.overall === null) return 1
      if (y.overall === null) return -1
      return y.overall - x.overall || x.country.localeCompare(y.country)
    })

  const areaBoards: Rollups['areaBoards'] = {}
  for (const area of areas) {
    areaBoards[area] = countries
      .flatMap((c) => {
        const cell = c.areas[area]
        // Key order matches RollupsSchema's CellSchema.extend shape (score, productIds, country):
        // derive writes the zod-parsed object, and recompute-check compares JSON.stringify output.
        return cell ? [{ score: cell.score, productIds: cell.productIds, country: c.country }] : []
      })
      .sort((x, y) => {
        if (x.score === null && y.score === null) return x.country.localeCompare(y.country)
        if (x.score === null) return 1
        if (y.score === null) return -1
        return y.score - x.score || x.country.localeCompare(y.country)
      })
  }

  return { generatedAt: rankings.generatedAt, matchedAreas: [...MATCHED_AREAS], countries, areaBoards }
}

// Tolerant-optional loader, same contract as lib/scoreIntervals.ts's: most arenas have no
// rollups.json at all, and display code renders no country section when the file is absent.
export function loadRollups(categoryId: string, dir: string = path.join(process.cwd(), 'data')): Rollups | null {
  const file = path.join(dir, categoryId, 'rollups.json')
  if (!fs.existsSync(file)) return null
  return RollupsSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')))
}
