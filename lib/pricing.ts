// Pricing transparency index: schema + loader + display helpers for open-rankings/{cat}/pricing.json —
// what agent-driven usage of a product actually costs, normalized into the arena's canonical
// per-action unit (see PRICING_ARENAS below). Produced by pipeline/stages/pricing.ts, which
// LLM-extracts pricing facts from the vendor's own pricing page under hard honesty rules:
// every fact carries a verbatim excerpt (verified to appear on the fetched page), the URL it
// came from, and a fetch date — and the pipeline never converts, averages, or derives a price
// the page didn't literally print. Products whose pricing page is a JS shell, bot-walled, or
// simply doesn't state unit prices are recorded as { unavailable: true, reason } honestly.
//
// The schema lives here (not lib/schemas.ts) so this lane owns its own file — same
// tolerant-optional load contract as popularity/claims in lib/data.ts: a missing pricing.json
// is an empty map, never an error, and display code renders absence as absence.
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

// The arenas where "price per agent action" is a meaningful, comparable unit — each with its
// canonical primary unit (what the leaderboard column leads with) plus the sibling units the
// vendor pages actually price in (e.g. inference is quoted per 1M *input* vs *output* tokens).
// A fact's unit must be one of these (or ENTRY_PLAN_UNIT) — enforced by the pricing stage.
export const PRICING_ARENAS: Record<string, { primary: string; units: readonly string[] }> = {
  'payments': { primary: 'per transaction', units: ['per transaction'] },
  'inference-providers': { primary: 'per 1M tokens', units: ['per 1M tokens', 'per 1M input tokens', 'per 1M output tokens'] },
  'ai-search-apis': { primary: 'per 1k searches', units: ['per 1k searches', 'per search'] },
  'web-scraping': { primary: 'per 1k pages', units: ['per 1k pages', 'per page', 'per browser-hour'] },
  'voice-agents': { primary: 'per minute', units: ['per minute'] },
  'model-gateways': { primary: 'gateway fee', units: ['gateway fee', 'per 1M tokens', 'per request'] },
  'vector-databases': { primary: 'per 1M vectors/month', units: ['per 1M vectors/month', 'per 1M vector dimensions/month', 'per GB-month', 'per GiB written', 'per TB queried'] },
  // Some clouds (CoreWeave) only print whole-node prices — 'per instance-hour' records those
  // honestly instead of mislabeling an 8-GPU node price as a per-GPU rate (dividing by the GPU
  // count would be computing a price the page never printed).
  'gpu-clouds': { primary: 'per GPU-hour', units: ['per GPU-hour', 'per instance-hour'] },
  'serverless-databases': { primary: 'per GB-month', units: ['per GB-month', 'per compute-hour', 'per 1M rows read'] },
}

// Universal escape hatch for pages that only price in monthly plans (no per-unit rate printed):
// the entry plan's sticker price recorded as-is beats a per-unit number we'd have to derive.
export const ENTRY_PLAN_UNIT = 'per month (entry plan)'

export function allowedUnitsFor(arenaId: string): string[] {
  const arena = PRICING_ARENAS[arenaId]
  return arena ? [...arena.units, ENTRY_PLAN_UNIT] : []
}

// One extracted pricing fact. `amountUsd` + optional `percent` mirror how the page itself
// states the price — a payments fee like "2.9% + $0.30" keeps both parts verbatim (percent 2.9,
// amountUsd 0.30) rather than being collapsed into a computed blended figure we never extracted.
// `excerpt` is a verbatim quote from the fetched page containing the figure (verified by the
// stage, see pipeline/stages/pricing.ts's excerptFound); `sourceUrl`/`fetchedAt` are stamped by
// code from the actual fetch, never typed by the LLM.
export const PricingFactSchema = z.object({
  unit: z.string().min(1),
  amountUsd: z.number().min(0),
  percent: z.number().min(0).max(100).optional(),
  tier: z.enum(['free', 'usage', 'entry-paid']),
  notes: z.string().min(1).max(240).optional(),
  sourceUrl: z.string().url(),
  excerpt: z.string().min(8).max(320),
  fetchedAt: z.string().datetime(),
}).refine((f) => f.tier !== 'free' || f.amountUsd === 0, {
  message: 'free-tier facts must have amountUsd 0',
}).refine((f) => f.amountUsd > 0 || f.percent !== undefined || f.tier === 'free', {
  message: 'a non-free fact must carry a price (amountUsd > 0 or percent)',
})

// open-rankings/{cat}/pricing.json value per product: either ≥1 verified facts, or an honest
// "pricing unclear" record with the reason (JS-shell page, bot wall, no printed unit prices).
export const ProductPricingSchema = z.union([
  z.object({
    unavailable: z.literal(true),
    reason: z.string().min(1).max(300),
    sourceUrl: z.string().url().optional(),
    fetchedAt: z.string().datetime(),
  }),
  z.object({
    facts: PricingFactSchema.array().min(1).max(8),
  }),
])

// open-rankings/{cat}/pricing.json shape: productId -> ProductPricing. A product absent from the map has
// simply not been through the pricing stage yet — display code renders nothing, not "unclear".
export const PricingMapSchema = z.record(z.string(), ProductPricingSchema)

export type PricingFact = z.infer<typeof PricingFactSchema>
export type ProductPricing = z.infer<typeof ProductPricingSchema>
export type PricingUnavailable = Extract<ProductPricing, { unavailable: true }>
export type PricingAvailable = Extract<ProductPricing, { facts: PricingFact[] }>
export type PricingMap = z.infer<typeof PricingMapSchema>

export function isPricingUnavailable(entry: ProductPricing): entry is PricingUnavailable {
  return 'unavailable' in entry && entry.unavailable === true
}

const DEFAULT_DIR = () => path.join(process.cwd(), 'open-rankings')
const pricingCache = new Map<string, PricingMap>()

// Same tolerant-optional contract as lib/data.ts's popularity load: no pricing.json (arena not
// covered, or stage not run yet) resolves to an empty map, never an error.
export function loadPricing(categoryId: string, dir: string = DEFAULT_DIR()): PricingMap {
  const cacheKey = `${dir}::${categoryId}`
  const hit = pricingCache.get(cacheKey)
  if (hit) return hit
  const file = path.join(dir, categoryId, 'pricing.json')
  const map = fs.existsSync(file) ? PricingMapSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8'))) : {}
  pricingCache.set(cacheKey, map)
  return map
}

// "$0.59", "2.9% + $0.30", "5.5%", "free" — always the extracted numbers verbatim (String(n)
// keeps exactly the digits stored, e.g. 0.008 → "$0.008"), never a computed blend.
export function formatFactAmount(fact: Pick<PricingFact, 'amountUsd' | 'percent' | 'tier'>): string {
  const usd = `$${String(fact.amountUsd)}`
  // A zero percent is only informative on its own ("0% markup") — as a "+ $0.49" prefix it
  // would misread a plain fixed fee as a rate structure.
  if (fact.percent !== undefined && fact.percent > 0 && fact.amountUsd > 0) return `${String(fact.percent)}% + ${usd}`
  if (fact.percent !== undefined && fact.amountUsd === 0) return `${String(fact.percent)}%`
  if (fact.amountUsd === 0 && fact.tier === 'free') return 'free'
  return usd
}

// "per 1M tokens" → "1M tokens" for compact "$X / 1M tokens" rendering; unit labels that aren't
// "per …" phrases (e.g. "gateway fee") pass through unchanged.
export function unitShortLabel(unit: string): string {
  return unit.startsWith('per ') ? unit.slice(4) : unit
}

// Serializable cell for the (client-side) leaderboard table's "$ / unit" column.
export type PricingCell =
  | { label: string; unit: string; tier: PricingFact['tier']; sourceUrl: string; asOf: string }
  | { unclear: true; reason: string }

// Deterministic headline pick for one product: cheapest usage-tier fact in the arena's primary
// unit, else cheapest usage fact in any unit, else cheapest entry-paid plan, else the free-tier
// note. Selection only — never arithmetic on the extracted figures.
export function pricingCellFor(entry: ProductPricing, arenaId: string): PricingCell | null {
  if (isPricingUnavailable(entry)) return { unclear: true, reason: entry.reason }
  const primary = PRICING_ARENAS[arenaId]?.primary
  const cost = (f: PricingFact) => f.amountUsd + (f.percent ?? 0)
  const byCost = (a: PricingFact, b: PricingFact) => cost(a) - cost(b)
  const usage = entry.facts.filter((f) => f.tier === 'usage').sort(byCost)
  const pick =
    usage.find((f) => f.unit === primary) ??
    usage[0] ??
    entry.facts.filter((f) => f.tier === 'entry-paid').sort(byCost)[0] ??
    entry.facts.find((f) => f.tier === 'free')
  if (!pick) return null
  return {
    // "free tier", not "free": a headline cell must not read as "usage is free" when the only
    // extracted fact is a free quota.
    label: pick.tier === 'free' ? 'free tier' : formatFactAmount(pick),
    unit: unitShortLabel(pick.unit),
    tier: pick.tier,
    sourceUrl: pick.sourceUrl,
    asOf: pick.fetchedAt.slice(0, 10),
  }
}

// Coverage stats for the /pipeline transparency board: of the products in covered arenas that
// exist on disk, how many have extracted facts vs an honest "unclear" record vs no run yet.
export interface PricingCoverage {
  coveredArenas: number
  coveredProducts: number
  extracted: number
  unclear: number
}

export function pricingCoverage(
  arenas: Array<{ arenaId: string; productIds: string[] }>,
  dir: string = DEFAULT_DIR(),
): PricingCoverage {
  const covered = arenas.filter((a) => a.arenaId in PRICING_ARENAS)
  let extracted = 0
  let unclear = 0
  let coveredProducts = 0
  for (const arena of covered) {
    const map = loadPricing(arena.arenaId, dir)
    coveredProducts += arena.productIds.length
    for (const pid of arena.productIds) {
      const entry = map[pid]
      if (!entry) continue
      if (isPricingUnavailable(entry)) unclear += 1
      else extracted += 1
    }
  }
  return { coveredArenas: covered.length, coveredProducts, extracted, unclear }
}
