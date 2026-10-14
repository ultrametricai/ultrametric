// Pricing-tier annotation layer: schema + loader + display helpers for
// open-rankings/{cat}/story-tiers.json — for each (product, story) cell the judge ruled full/partial,
// which plan tier the cited evidence says a buyer needs ("what can be done for free, paid,
// enterprise"). Produced by rankings-engine/scripts/classify-story-tiers.ts, an LLM classifier that
// reads ONLY the verdict's cited evidence excerpts plus the product's pricing evidence
// (open-rankings/{cat}/pricing.json facts + pricing-page evidence items) under strict honesty rules:
// 'unknown' whenever the evidence never states gating — never guessed from reputation — and
// every non-unknown tier must cite the evidence item that implies it (tierEvidenceId) plus a
// one-liner quoting the gating evidence (tierNote, e.g. "SSO on Enterprise plan only").
//
// This is an ANNOTATION, never a judging input: verdicts, quality, and every score in
// lib/scoring.ts are computed without it (same display-only contract as popularity/pricing).
// The schema lives here (not lib/schemas.ts) so this lane owns its own file — same
// tolerant-optional load contract as lib/pricing.ts: a missing story-tiers.json is an empty
// list, never an error, and display code renders absence as absence.
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

// Kept as its own exported union so client components (components/TierChip.tsx,
// lib/compareStories.ts) can type against it via type-only imports without pulling this
// module's node:fs/zod into the client bundle.
export type StoryTierKind = 'free' | 'paid' | 'enterprise' | 'unknown'

export const STORY_TIER_KINDS = ['free', 'paid', 'enterprise', 'unknown'] as const

export const StoryTierSchema = z.object({
  productId: z.string().min(1),
  storyId: z.string().min(1),
  tier: z.enum(STORY_TIER_KINDS),
  // One-liner quoting/tightly paraphrasing the gating evidence ("SSO on Enterprise plan only").
  tierNote: z.string().min(1).max(240).optional(),
  // The single evidence item the classification rests on: a cited evidence id from the verdict,
  // a pricing-page evidence id, or a pricing.json fact pseudo-id ("pricing-fact-1").
  tierEvidenceId: z.string().min(1).optional(),
}).refine((t) => t.tier !== 'unknown' || (t.tierNote === undefined && t.tierEvidenceId === undefined), {
  message: 'unknown tiers must not carry a tierNote/tierEvidenceId — nothing was found to quote',
}).refine((t) => t.tier === 'unknown' || (t.tierNote !== undefined && t.tierEvidenceId !== undefined), {
  message: 'non-unknown tiers must cite their gating evidence (tierNote + tierEvidenceId)',
})

// open-rankings/{cat}/story-tiers.json shape: one entry per (product, story) cell with a full/partial
// verdict — 'unknown' entries are kept in the file (honest "evidence doesn't state gating"),
// cells with none/disputed/na verdicts are simply absent (nothing delivered to gate).
export const StoryTiersArraySchema = StoryTierSchema.array()

export type StoryTier = z.infer<typeof StoryTierSchema>

export function storyTierKey(productId: string, storyId: string): string {
  return `${productId}:${storyId}`
}

const DEFAULT_DIR = () => path.join(process.cwd(), 'open-rankings')
const tiersCache = new Map<string, StoryTier[]>()

// Same tolerant-optional contract as lib/pricing.ts's loadPricing: no story-tiers.json (arena
// not classified yet) resolves to an empty list, never an error.
export function loadStoryTiers(categoryId: string, dir: string = DEFAULT_DIR()): StoryTier[] {
  const cacheKey = `${dir}::${categoryId}`
  const hit = tiersCache.get(cacheKey)
  if (hit) return hit
  const file = path.join(dir, categoryId, 'story-tiers.json')
  const tiers = fs.existsSync(file) ? StoryTiersArraySchema.parse(JSON.parse(fs.readFileSync(file, 'utf8'))) : []
  tiersCache.set(cacheKey, tiers)
  return tiers
}

// `${productId}:${storyId}` -> entry, for O(1) row stamping in buildStoryVerdictRows.
export function storyTiersByCell(tiers: StoryTier[]): ReadonlyMap<string, StoryTier> {
  return new Map(tiers.map((t) => [storyTierKey(t.productId, t.storyId), t]))
}

// Counts for the product page's "What's free" summary line. Only the classified (non-unknown)
// buckets are headline-worthy; `unknown` is reported too so the line can stay honest about how
// much of the delivered surface the evidence never priced.
export interface TierCounts {
  free: number
  paid: number
  enterprise: number
  unknown: number
}

export function tierCountsFor(tiers: StoryTier[], productId: string): TierCounts {
  const counts: TierCounts = { free: 0, paid: 0, enterprise: 0, unknown: 0 }
  for (const t of tiers) {
    if (t.productId === productId) counts[t.tier] += 1
  }
  return counts
}
