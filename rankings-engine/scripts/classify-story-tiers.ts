// Pricing-tier classifier: annotates every (product, story) cell the judge ruled full/partial
// with the plan tier the cited evidence says a buyer needs — free / paid / enterprise — or
// 'unknown' when the evidence never states gating. Writes open-rankings/{cat}/story-tiers.json (see
// lib/storyTiers.ts for the schema and the display-only contract: this NEVER feeds scoring,
// verdicts.json is never touched).
//
// Honesty rules mirror judge.ts's evidence-only discipline: the classifier sees ONLY the
// verdict's cited evidence excerpts plus the product's pricing evidence (pricing.json facts +
// pricing-page evidence items), must default to 'unknown', and every non-unknown tier must cite
// the specific evidence item that implies it (validated below — an uncited or unknown-id tier
// is rejected and re-asked, like judge.ts's correction rounds).
//
// Cost shape: one LLM call per product per chunk of ≤MAX_STORIES_PER_CALL stale cells (a
// product's whole story set usually fits in 1-2 calls), cached per cell by a hash over the
// verdict + its cited excerpts + the pricing evidence + prompt version, so re-runs are
// incremental and a mid-run crash resumes for free. UM_TIER_CONCURRENCY products run in
// parallel (default 4).
//
// Usage: tsx rankings-engine/scripts/classify-story-tiers.ts [--category <id>] [--product <id>] [--report]
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { isPricingUnavailable, PricingMapSchema, type ProductPricing } from '../../lib/pricing'
import { type Evidence, EvidenceSchema, ProductSchema, StorySchema, type Story, type Verdict, VerdictSchema } from '../../lib/schemas'
import { STORY_TIER_KINDS, type StoryTier, StoryTiersArraySchema } from '../../lib/storyTiers'
import { llmJson } from '../llm'
import { CACHE_DIR, categoryDir, readJson, resolveCategories, writeJson } from '../paths'

export const TIER_PROMPT_VERSION = 'v1'

// Chunk size per LLM call — small enough that ~25 entries of JSON with notes stay far from the
// output cap, big enough that most products classify in one or two calls.
const MAX_STORIES_PER_CALL = 20

// One item of the product-level pricing context shown to the classifier (and citable via
// tierEvidenceId): a pricing.json fact ("pricing-fact-N"), the honest "pricing unclear" record
// ("pricing-unavailable"), or a pricing-page evidence item (its real evidence id).
export interface PricingContextItem {
  id: string
  excerpt: string
  url?: string
}

// Evidence items whose URL is a pricing surface — the pricing pages inside evidence packs.
const PRICING_URL_RE = /\/pricing|\/plans\b|[./]pricing[./]|plans-and-pricing|billing\/pricing/i

export function pricingContextFor(pricingEntry: ProductPricing | undefined, evidence: Evidence[]): PricingContextItem[] {
  const items: PricingContextItem[] = []
  if (pricingEntry) {
    if (isPricingUnavailable(pricingEntry)) {
      items.push({ id: 'pricing-unavailable', excerpt: `Vendor pricing page could not be read honestly: ${pricingEntry.reason}` })
    } else {
      pricingEntry.facts.forEach((f, i) => {
        const notes = f.notes ? ` — ${f.notes}` : ''
        items.push({ id: `pricing-fact-${i + 1}`, excerpt: `${f.excerpt}${notes} (${f.tier} tier, ${f.unit})`, url: f.sourceUrl })
      })
    }
  }
  for (const e of evidence) {
    if (PRICING_URL_RE.test(e.url)) items.push({ id: e.id, excerpt: e.excerpt, url: e.url })
  }
  return items
}

// Cache key for one cell: any change to the verdict (including its rationale/citations), the
// cited excerpts themselves, the pricing context, or the prompt version re-classifies the cell;
// everything else (re-runs, unrelated evidence churn) is a cache hit.
export function tierCellHash(
  verdict: Verdict,
  cited: Evidence[],
  pricing: PricingContextItem[],
  promptVersion: string,
): string {
  const payload = JSON.stringify({
    storyId: verdict.storyId,
    verdict: verdict.verdict,
    quality: verdict.quality,
    rationale: verdict.rationale,
    evidenceIds: verdict.evidenceIds,
    cited: cited.map((e) => [e.id, e.excerpt]),
    pricing: pricing.map((p) => [p.id, p.excerpt]),
    promptVersion,
  })
  return crypto.createHash('sha256').update(payload).digest('hex')
}

// What the LLM returns per cell — product/story stamping and unknown-normalization happen in
// code, mirroring judge.ts's RawVerdictSchema split.
export const RawTierEntrySchema = z.object({
  storyId: z.string().min(1),
  tier: z.enum(STORY_TIER_KINDS),
  tierNote: z.string().min(1).max(240).optional(),
  tierEvidenceId: z.string().min(1).optional(),
})
export const RawTierArraySchema = RawTierEntrySchema.array()
export type RawTierEntry = z.infer<typeof RawTierEntrySchema>

// 'unknown' carries no note/evidence by contract (lib/storyTiers.ts's schema) — models often
// volunteer a "no gating stated" note; normalize it away rather than round-tripping a retry.
export function normalizeTierEntry(productId: string, raw: RawTierEntry): StoryTier {
  if (raw.tier === 'unknown') return { productId, storyId: raw.storyId, tier: 'unknown' }
  return { productId, storyId: raw.storyId, tier: raw.tier, tierNote: raw.tierNote, tierEvidenceId: raw.tierEvidenceId }
}

// Rule validation (beyond schema shape), same contract as judge.ts's validateVerdictRules:
// returns a human-readable violation for the correction round, or null when clean.
export function validateTierEntries(
  entries: RawTierEntry[],
  expectedStoryIds: string[],
  allowedIdsFor: (storyId: string) => ReadonlySet<string>,
): string | null {
  const expected = new Set(expectedStoryIds)
  const seen = new Set<string>()
  for (const e of entries) {
    if (!expected.has(e.storyId)) return `entry for unexpected story "${e.storyId}"`
    if (seen.has(e.storyId)) return `duplicate entry for story "${e.storyId}"`
    seen.add(e.storyId)
    if (e.tier !== 'unknown') {
      if (!e.tierNote) return `story "${e.storyId}": tier "${e.tier}" must carry a tierNote quoting the gating evidence`
      if (!e.tierEvidenceId) return `story "${e.storyId}": tier "${e.tier}" must cite tierEvidenceId — the evidence item that implies the tier`
      if (!allowedIdsFor(e.storyId).has(e.tierEvidenceId)) {
        return `story "${e.storyId}": tierEvidenceId "${e.tierEvidenceId}" is not among that story's cited evidence or the pricing evidence`
      }
    }
  }
  for (const id of expectedStoryIds) {
    if (!seen.has(id)) return `missing entry for story "${id}"`
  }
  return null
}

export const SYSTEM = `You annotate product-comparison verdicts with a pricing-tier dimension: for each user story a product delivers (the judge already ruled full/partial), decide which plan tier a buyer needs for that capability, judging ONLY from the evidence provided.
Tiers:
- "free": the evidence states the capability is available at no cost — a free plan/tier, a free quota that covers the story's core use, or free open-source self-hosting.
- "paid": the evidence states it requires paying — any paid plan (starter/pro/team) or pure usage-based pricing with no free tier covering it.
- "enterprise": the evidence states it is gated to an enterprise/business/custom-contract plan (e.g. "SSO on Enterprise plan only", "contact sales").
- "unknown": the evidence does not state plan gating for this capability. THIS IS THE DEFAULT.
STRICT honesty rules:
- Never guess from general knowledge, product reputation, or vibes ("this vendor probably charges for that"). If no provided excerpt states or directly implies the gating for THIS story's capability, the answer is "unknown".
- A product being commercial does NOT make every capability "paid": the gating must be stated for the capability, or be pricing that unavoidably applies to all use of the product (e.g. a per-transaction fee on a payments API applies to every payment story).
- Product-wide pricing evidence (the "Pricing evidence" block) may only be applied to a story when it clearly covers that story's capability — a free tier for the core product does not make an add-on story free.
- For every non-unknown tier you MUST return: tierEvidenceId — the id of the ONE evidence item (a story's cited excerpt or a pricing item) that implies the tier — and tierNote, a one-liner (max 240 chars) quoting or tightly paraphrasing the gating evidence.
- For "unknown", omit tierNote and tierEvidenceId entirely.
- This is an annotation layer only: it never changes verdicts or scores.
Return JSON: an array with EXACTLY one entry per story listed, in any order:
[{"storyId":"...","tier":"free|paid|enterprise|unknown","tierNote":"...","tierEvidenceId":"..."}]`

export function tierPrompt(
  productName: string,
  cells: Array<{ story: Story; verdict: Verdict; cited: Evidence[] }>,
  pricing: PricingContextItem[],
  extra = '',
): string {
  const pricingBlock = pricing.length > 0
    ? pricing.map((p) => `[${p.id}] ${p.excerpt}${p.url ? ` — ${p.url}` : ''}`).join('\n')
    : '(no pricing evidence collected for this product)'
  const storyBlocks = cells.map(({ story, verdict, cited }) => {
    const citedBlock = cited.length > 0
      ? cited.map((e) => `  [${e.id}] (${e.tier}) ${e.excerpt}`).join('\n')
      : '  (no cited excerpts)'
    return `Story ${story.id}: ${story.title}\nVerdict: ${verdict.verdict} q${verdict.quality}/10 — ${verdict.rationale}\nCited evidence:\n${citedBlock}`
  })
  return `Product: ${productName}\n\nPricing evidence:\n${pricingBlock}\n\nStories to classify (${cells.length}):\n\n${storyBlocks.join('\n\n')}\n${extra}`
}

interface CacheEntry {
  hash: string
  entry: StoryTier
}

type ProductCache = Record<string, CacheEntry>

function cacheFileFor(categoryId: string, productId: string): string {
  return path.join(CACHE_DIR, 'story-tiers', categoryId, `${productId}.json`)
}

function readProductCache(file: string): ProductCache {
  if (!fs.existsSync(file)) return {}
  return JSON.parse(fs.readFileSync(file, 'utf8')) as ProductCache
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

interface Cell {
  story: Story
  verdict: Verdict
  cited: Evidence[]
  hash: string
}

// Classifies every stale eligible cell of one product, updating its cache file after each
// chunk (resume-safe). Returns the number of LLM calls made.
async function classifyProduct(
  categoryId: string,
  productId: string,
  productName: string,
  cells: Cell[],
  pricing: PricingContextItem[],
): Promise<number> {
  const cacheFile = cacheFileFor(categoryId, productId)
  const cache = readProductCache(cacheFile)
  const stale = cells.filter((c) => cache[c.story.id]?.hash !== c.hash)
  if (stale.length === 0) return 0

  const pricingIds = new Set(pricing.map((p) => p.id))
  let calls = 0
  for (const batch of chunk(stale, MAX_STORIES_PER_CALL)) {
    const byStory = new Map(batch.map((c) => [c.story.id, c]))
    const allowedIdsFor = (storyId: string): ReadonlySet<string> => {
      const cell = byStory.get(storyId)
      if (!cell) return pricingIds
      return new Set([...cell.cited.map((e) => e.id), ...pricingIds])
    }
    const expected = batch.map((c) => c.story.id)

    let raw = await llmJson({ schema: RawTierArraySchema, system: SYSTEM, prompt: tierPrompt(productName, batch, pricing) })
    calls += 1
    let violation = validateTierEntries(raw, expected, allowedIdsFor)
    // Same correction-round posture as judge.ts: up to three explicit re-asks before failing.
    for (let round = 0; violation && round < 3; round++) {
      raw = await llmJson({
        schema: RawTierArraySchema,
        system: SYSTEM,
        prompt: tierPrompt(productName, batch, pricing, `\nYour previous answer violated a rule: ${violation}. Correct it. Return one entry per story listed; non-unknown tiers must cite a listed evidence id.`),
      })
      calls += 1
      violation = validateTierEntries(raw, expected, allowedIdsFor)
    }
    if (violation) throw new Error(`classify-story-tiers: ${categoryId}/${productId} still violates rules: ${violation}`)

    for (const entry of raw) {
      cache[entry.storyId] = { hash: byStory.get(entry.storyId)!.hash, entry: normalizeTierEntry(productId, entry) }
    }
    writeJson(cacheFile, cache)
    const known = raw.filter((e) => e.tier !== 'unknown').length
    console.log(`tiers: ${categoryId}/${productId} — classified ${raw.length} cells (${known} gated, ${raw.length - known} unknown)`)
  }
  return calls
}

// Minimal promise pool: run tasks with at most `limit` in flight.
async function runPool<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let next = 0
  async function worker(): Promise<void> {
    while (next < tasks.length) {
      const i = next++
      results[i] = await tasks[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()))
  return results
}

interface ArenaCoverage {
  arena: string
  cells: number
  free: number
  paid: number
  enterprise: number
  unknown: number
}

function coverageFor(categoryId: string): ArenaCoverage | null {
  const file = path.join(categoryDir(categoryId), 'story-tiers.json')
  if (!fs.existsSync(file)) return null
  const tiers = readJson(StoryTiersArraySchema, file)
  const c: ArenaCoverage = { arena: categoryId, cells: tiers.length, free: 0, paid: 0, enterprise: 0, unknown: 0 }
  for (const t of tiers) c[t.tier] += 1
  return c
}

function printCoverage(categoryIds: string[]): void {
  let cells = 0
  let classified = 0
  for (const id of categoryIds) {
    const c = coverageFor(id)
    if (!c) {
      console.log(`coverage: ${id} — no story-tiers.json`)
      continue
    }
    const known = c.free + c.paid + c.enterprise
    cells += c.cells
    classified += known
    const pct = c.cells === 0 ? 0 : Math.round((known / c.cells) * 100)
    console.log(`coverage: ${c.arena} — ${c.cells} cells: ${c.free} free / ${c.paid} paid / ${c.enterprise} enterprise / ${c.unknown} unknown (${pct}% classified)`)
  }
  const pct = cells === 0 ? 0 : Math.round((classified / cells) * 1000) / 10
  console.log(`coverage: TOTAL — ${cells} cells, ${classified} classified (${pct}%), ${cells - classified} unknown`)
}

export async function runClassifier({ category, product }: { category?: string; product?: string }): Promise<void> {
  const concurrency = Number(process.env.UM_TIER_CONCURRENCY ?? process.env.PA_TIER_CONCURRENCY ?? 4)
  let totalCalls = 0
  const processed: string[] = []

  for (const cat of resolveCategories(category)) {
    const dataDir = categoryDir(cat.id)
    if (!fs.existsSync(path.join(dataDir, 'verdicts.json'))) continue
    const products = readJson(ProductSchema.array(), path.join(dataDir, 'products.json'))
    const stories = readJson(StorySchema.array(), path.join(dataDir, 'stories.json'))
    const verdicts = readJson(VerdictSchema.array(), path.join(dataDir, 'verdicts.json'))
    const pricingFile = path.join(dataDir, 'pricing.json')
    const pricingMap = fs.existsSync(pricingFile) ? readJson(PricingMapSchema, pricingFile) : {}
    const storyById = new Map(stories.map((s) => [s.id, s]))
    const targets = products.filter((p) => !product || p.id === product)

    const productCells = new Map<string, { name: string; cells: Cell[]; pricing: PricingContextItem[] }>()
    for (const p of products) {
      const evidence = readJson(EvidenceSchema.array(), path.join(dataDir, 'evidence', `${p.id}.json`))
      const evidenceMap = new Map(evidence.map((e) => [e.id, e]))
      const pricing = pricingContextFor(pricingMap[p.id], evidence)
      const cells: Cell[] = []
      for (const v of verdicts) {
        if (v.productId !== p.id) continue
        if (v.verdict !== 'full' && v.verdict !== 'partial') continue
        const story = storyById.get(v.storyId)
        if (!story) continue
        const cited = v.evidenceIds.map((id) => evidenceMap.get(id)).filter((e): e is Evidence => e !== undefined)
        cells.push({ story, verdict: v, cited, hash: tierCellHash(v, cited, pricing, TIER_PROMPT_VERSION) })
      }
      productCells.set(p.id, { name: p.name, cells, pricing })
    }

    const tasks = targets.map(({ id, name }) => () => {
      const pc = productCells.get(id)!
      return classifyProduct(cat.id, id, name ?? pc.name, pc.cells, pc.pricing)
    })
    const calls = await runPool(tasks, concurrency)
    totalCalls += calls.reduce((a, b) => a + b, 0)

    // Assemble story-tiers.json from ALL cached cells for this category (not just targets),
    // same posture as judge.ts: never write a partial file.
    const all: StoryTier[] = []
    let incomplete = false
    for (const p of products) {
      const pc = productCells.get(p.id)!
      const cache = readProductCache(cacheFileFor(cat.id, p.id))
      for (const cell of pc.cells) {
        const cached = cache[cell.story.id]
        if (!cached || cached.hash !== cell.hash) {
          console.warn(`tiers: matrix incomplete for ${cat.id} — missing/stale ${p.id}:${cell.story.id}; not writing story-tiers.json`)
          incomplete = true
          break
        }
        all.push(cached.entry)
      }
      if (incomplete) break
    }
    if (incomplete) continue

    all.sort((x, y) => x.productId.localeCompare(y.productId) || x.storyId.localeCompare(y.storyId))
    writeJson(path.join(dataDir, 'story-tiers.json'), StoryTiersArraySchema.parse(all))
    processed.push(cat.id)
    console.log(`tiers: wrote ${all.length} entries for ${cat.id}`)
  }

  console.log(`tiers: done — ${totalCalls} LLM calls this run`)
  printCoverage(processed.length > 0 ? processed : resolveCategories(category).map((c) => c.id))
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i === -1 ? undefined : process.argv[i + 1]
}

// tsx entrypoint — skipped when imported by tests (same pattern as other pipeline scripts).
if (require.main === module) {
  if (process.argv.includes('--report')) {
    printCoverage(resolveCategories(arg('--category')).map((c) => c.id))
  } else {
    runClassifier({ category: arg('--category'), product: arg('--product') }).catch((err) => {
      console.error(err)
      process.exit(1)
    })
  }
}
