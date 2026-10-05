import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { verdictFor, type CategoryData } from './data-helpers'
import { weightedPercent } from './scoring'
import type { Story } from './schemas'

// ICP lenses (data/icp-types.json): ~10 cross-arena buyer types — not company-size tiers but
// genuinely different ways of weighing the same evidence (an open-source purist and an
// Built-in AI startup read the same verdict matrix and reach different shortlists). Each lens
// declares an *emphasis*: the story personas that matter to that buyer plus per-theme/per-group
// weight multipliers. lib/icp.ts then re-weights the SAME canonical verdicts (never re-judging
// anything — see icpScore below) into a per-ICP cross-arena ranking rendered at /icp/[type].
//
// Deliberately NOT part of canonical scoring: lib/scoring.ts's Overall score is untouched. An ICP
// score is a derived, clearly-labeled re-weighting, same spirit as lib/personaStacks.ts (one
// persona within one arena) but cross-arena and multiplier-based.

const MultiplierSchema = z.number().positive().max(10)

export const IcpEmphasisSchema = z.object({
  // Story personas this buyer identifies with — a persona match multiplies a story's weight by
  // PERSONA_EMPHASIS_MULTIPLIER and marks the story as emphasized (in-scope for this lens).
  personas: z.array(z.string().min(1)).min(1),
  // Theme id -> weight multiplier. Listing a theme marks its stories emphasized even at
  // multiplier 1 (the lens explicitly cares about that axis).
  themeWeights: z.record(z.string().min(1), MultiplierSchema),
  // Optional: restrict the lens to open-source products entirely (open-source-purist) —
  // commercial products are excluded (null), not scored low.
  requireOss: z.boolean().optional(),
  // Optional finer-grained emphasis at the story-group level (agent-access, self-hosting,
  // audit-trail, …) — groups are cross-arena vocabulary just like themes.
  groupWeights: z.record(z.string().min(1), MultiplierSchema).optional(),
})

export const IcpTypeSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'icp id must be kebab-case'),
  name: z.string().min(1),
  tagline: z.string().min(1),
  emphasis: IcpEmphasisSchema,
})

export const IcpTypesSchema = z.array(IcpTypeSchema).min(1).superRefine((icps, ctx) => {
  const seen = new Set<string>()
  for (const icp of icps) {
    if (seen.has(icp.id)) ctx.addIssue({ code: 'custom', message: `duplicate icp id ${icp.id}` })
    seen.add(icp.id)
  }
})

export type IcpType = z.infer<typeof IcpTypeSchema>
export type IcpEmphasis = z.infer<typeof IcpEmphasisSchema>

export function loadIcpTypes(dataDir = path.join(process.cwd(), 'data')): IcpType[] {
  const raw = JSON.parse(fs.readFileSync(path.join(dataDir, 'icp-types.json'), 'utf8'))
  return IcpTypesSchema.parse(raw)
}

// How much a persona match is worth, relative to a story this buyer type has no stake in.
// Kept moderate so a lens with both persona and theme emphasis blends rather than being
// dominated by whichever axis lists more stories.
export const PERSONA_EMPHASIS_MULTIPLIER = 2

// A story is *emphasized* for an ICP when the lens has any stake in it: the buyer identifies
// with its persona, or its theme/group is explicitly listed in the emphasis. Everything else is
// out of scope for the lens (not weighted at 0 — simply not scored), which is what makes the
// exclusion rule below honest: a product whose only strengths are outside the lens has nothing
// to say to this buyer, rather than a padded-out score.
export function isEmphasized(story: Story, icp: IcpType): boolean {
  const e = icp.emphasis
  return (
    e.personas.includes(story.persona) ||
    story.theme in e.themeWeights ||
    (e.groupWeights !== undefined && story.group in e.groupWeights)
  )
}

// Effective weight of an emphasized story under an ICP lens: the canonical story weight
// multiplied by every matching emphasis (persona × theme × group). Null for non-emphasized
// stories (out of scope, see isEmphasized).
export function icpStoryWeight(story: Story, icp: IcpType): number | null {
  if (!isEmphasized(story, icp)) return null
  const e = icp.emphasis
  const persona = e.personas.includes(story.persona) ? PERSONA_EMPHASIS_MULTIPLIER : 1
  const theme = e.themeWeights[story.theme] ?? 1
  const group = e.groupWeights?.[story.group] ?? 1
  return story.weight * persona * theme * group
}

// One product's score through an ICP lens: weightedPercent (the exact canonical normalization
// from lib/scoring.ts — never a reimplementation) over the product's emphasized cells, with
// each story's weight replaced by its ICP-effective weight. Returns null — repo convention for
// "nothing to score", never 0 — when:
//   - the lens requires OSS and the product is commercial, or
//   - the product has zero applicable (non-na) emphasized cells.
// A 0 remains reserved for "we looked and it genuinely fails everything this buyer cares about".
export function icpScore(data: CategoryData, productId: string, icp: IcpType): number | null {
  if (icp.emphasis.requireOss) {
    const product = data.products.find((p) => p.id === productId)
    if (!product || product.type !== 'oss') return null
  }
  const cells: Array<{ verdict: ReturnType<typeof verdictFor>; story: Story }> = []
  for (const story of data.stories) {
    const weight = icpStoryWeight(story, icp)
    if (weight === null) continue
    // weightedPercent only reads story.weight — hand it a clone carrying the ICP-effective
    // weight so numerator and denominator use the identical multiplied weight. (StorySchema
    // constrains weight to int 1..3 at parse time, but the TS type is plain number, so a
    // derived non-integer weight is fine for this in-memory clone.)
    cells.push({ verdict: verdictFor(data, productId, story.id), story: { ...story, weight } })
  }
  return weightedPercent(cells)
}

// The lens's 2-3 headline dimensions for the ranking table: its most-emphasized themes,
// strongest multiplier first (ties alphabetical for a stable render).
export function icpTopThemes(icp: IcpType, limit = 3): string[] {
  return Object.entries(icp.emphasis.themeWeights)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([theme]) => theme)
}

export interface IcpRankingRow {
  productId: string
  productName: string
  type: 'oss' | 'commercial' | 'government'
  arenaId: string
  arenaName: string
  score: number
  // Canonical (un-multiplied) per-theme scores for icpTopThemes, aligned by index; null when
  // the product's arena has no applicable cells for that theme.
  dimensions: Array<number | null>
  // How many applicable emphasized cells the score rests on — surfaced so a thin-evidence
  // score reads as thin.
  applicable: number
  // Verified shutdown note (ProductSchema.shutdown) — the lens is a ranking, so the row stays
  // and is tagged (lib/shutdown.ts), never dropped.
  shutdown?: string
}

// A lens ranking row must rest on at least this many applicable emphasized cells. Without a
// floor, a product with exactly one emphasized cell (a single 9/10 privacy story, say) posts a
// 90 and tops the lens over products judged on twenty emphasized cells — technically correct,
// practically misleading. Three is deliberately low: enough to kill the single-cell fluke
// without shrinking niche lenses to nothing.
export const MIN_ICP_APPLICABLE = 3

// Cross-arena ranking through one ICP lens. Products that resolve to a null icpScore, or with
// fewer than MIN_ICP_APPLICABLE applicable emphasized cells, are excluded entirely (the
// null-not-zero convention: out-of-scope products don't sort to the bottom, they leave the
// room).
export function buildIcpRanking(categories: CategoryData[], icp: IcpType): IcpRankingRow[] {
  const themes = icpTopThemes(icp)
  const rows: IcpRankingRow[] = []
  for (const data of categories) {
    for (const product of data.products) {
      const score = icpScore(data, product.id, icp)
      if (score === null) continue
      const cells = data.stories
        .filter((s) => isEmphasized(s, icp))
        .map((s) => ({ verdict: verdictFor(data, product.id, s.id), story: s }))
      const applicable = cells.filter((c) => c.verdict.verdict !== 'na').length
      if (applicable < MIN_ICP_APPLICABLE) continue
      const dimensions = themes.map((theme) =>
        weightedPercent(
          data.stories
            .filter((s) => s.theme === theme)
            .map((s) => ({ verdict: verdictFor(data, product.id, s.id), story: s })),
        ),
      )
      rows.push({
        productId: product.id,
        productName: product.name,
        type: product.type,
        arenaId: data.category.id,
        arenaName: data.category.name,
        score,
        dimensions,
        applicable,
        shutdown: product.shutdown,
      })
    }
  }
  return rows.sort((a, b) => b.score - a.score || b.applicable - a.applicable || a.productId.localeCompare(b.productId))
}
