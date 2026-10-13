// Pricing transparency stage: for each product in a covered arena (lib/pricing.ts's
// PRICING_ARENAS), fetch its pricing page, LLM-extract structured pricing facts in the arena's
// canonical agent-action units, and write rankings/{cat}/pricing.json.
//
// Honesty rules (enforced in code, not just prompted):
// - The LLM only ever reads the fetched page text we hand it; sourceUrl/fetchedAt are stamped
//   by code from the actual fetch, never typed by the model.
// - Every fact's excerpt must be found verbatim (whitespace/markdown-escaping normalized) in
//   the fetched page, and the fact's own figure (amountUsd/percent) must appear inside that
//   excerpt — a fact that fails either check after one corrective re-prompt is dropped.
// - No arithmetic: units are constrained to what the page can state directly (plus the
//   entry-plan sticker price); the prompt forbids converting/averaging and the excerpt check
//   makes an invented number unpayable.
// - A page that can't be read (bot wall, HTTP error) or is a JS shell with no static pricing
//   text is recorded as { unavailable: true, reason } — never guessed.
import path from 'node:path'
import { z } from 'zod'
import {
  allowedUnitsFor,
  ENTRY_PLAN_UNIT,
  PRICING_ARENAS,
  PricingMapSchema,
  type PricingFact,
  type PricingMap,
  type ProductPricing,
} from '../../lib/pricing'
import { ProductSchema, type Product } from '../../lib/schemas'
import { fetchWithRetry, htmlToMarkdown } from '../fetch-page'
import { llmJson } from '../llm'
import { categoryDir, readJson, resolveCategories, writeJson } from '../paths'

// A page whose readable text is thinner than this after markdown conversion is a JS-rendered
// shell (or an interstitial) — there's nothing there to extract honestly.
export const MIN_PAGE_CHARS = 400
// Cap what we send to the LLM: pricing tables live near the top of pricing pages.
export const MAX_PAGE_CHARS = 40000

const RawFactSchema = z.object({
  unit: z.string().min(1),
  amountUsd: z.number().min(0),
  percent: z.number().min(0).max(100).optional(),
  tier: z.enum(['free', 'usage', 'entry-paid']),
  notes: z.string().min(1).max(240).optional(),
  excerpt: z.string().min(8).max(320),
})

// `pageNote` is the model's honest "why not" when it returns zero facts (e.g. "all prices are
// behind a quote form") — it becomes the unavailable-reason, so it must be plain and factual.
export const RawPricingSchema = z.object({
  facts: RawFactSchema.array().max(8),
  pageNote: z.string().min(1).max(240).optional(),
})
export type RawPricing = z.infer<typeof RawPricingSchema>
export type RawFact = z.infer<typeof RawFactSchema>

const SYSTEM = `You extract PRICING FACTS from a vendor's own pricing page for a product-comparison index aimed at AI-agent operators. You will be given the page as markdown and a list of ALLOWED UNITS.

Hard rules — every one is checked mechanically after you answer:
1. Extract ONLY prices the page literally prints. NEVER convert units, multiply, average, blend, or otherwise derive a number. If the page prices in a unit not in the allowed list and mapping would need arithmetic, SKIP that price (exception: a monthly plan's sticker price may be recorded with the unit "${ENTRY_PLAN_UNIT}" and tier "entry-paid").
2. "excerpt" must be a VERBATIM contiguous quote from the page (8-320 chars) that contains the figure you extracted. Copy it exactly — no paraphrase, no stitching, no ellipses of your own.
3. "unit" must be exactly one of the allowed units.
4. "amountUsd" is the dollar figure exactly as printed (e.g. 0.30 for "$0.30"). For percentage prices (e.g. "2.9% + $0.30", "5.5% fee") put the percentage in "percent"; a pure-percent price has amountUsd 0.
5. "tier": "free" = a free tier/quota (amountUsd must be 0; describe the quota in notes), "usage" = a pay-as-you-go per-unit rate, "entry-paid" = the cheapest paid plan.
6. Return at most 8 facts. Prefer: the pay-as-you-go rate in the arena's PRIMARY unit first, one free-tier fact if a free tier exists, then the most agent-relevant others. When pricing is per-model or per-tier (e.g. inference per model, cards vs ACH), pick 1-3 representative rows and name which in "notes".
7. If the page prints no extractable pricing at all, return {"facts": [], "pageNote": "<one factual sentence why>"}.

Return JSON only: {"facts":[{"unit":"...","amountUsd":0.0,"percent":0.0,"tier":"...","notes":"...","excerpt":"..."}],"pageNote":"..."} ("percent"/"notes"/"pageNote" optional).`

function pricingPrompt(product: Product, arenaName: string, primaryUnit: string, allowedUnits: string[], pageText: string, extra = ''): string {
  return [
    `Product: ${product.name} (vendor: ${product.vendor})`,
    `Arena: ${arenaName}`,
    `PRIMARY unit: ${primaryUnit}`,
    `ALLOWED UNITS: ${allowedUnits.map((u) => `"${u}"`).join(', ')}`,
    extra,
    `Pricing page (markdown):`,
    pageText,
  ].filter(Boolean).join('\n\n')
}

// Whitespace + markdown-escape normalization for verbatim-excerpt matching: turndown escapes
// characters like _ * [ ] and the LLM usually un-escapes when quoting, so strip markdown
// syntax/escape characters and collapse whitespace on BOTH sides before the includes() check.
// Digits, "$", "%", "." — the load-bearing parts of a pricing quote — are never touched.
export function normalizeForMatch(s: string): string {
  return s.replace(/[\\*_`#|>~]/g, '').replace(/\s+/g, ' ').trim()
}

export function excerptFound(excerpt: string, pageText: string): boolean {
  const needle = normalizeForMatch(excerpt)
  return needle.length > 0 && normalizeForMatch(pageText).includes(needle)
}

// The extracted figure must appear inside its own excerpt (commas stripped so "1,000" matches
// 1000). Free-tier zero-dollar facts are exempt — their excerpt describes a quota, not a price.
export function amountAppearsInExcerpt(fact: Pick<RawFact, 'amountUsd' | 'percent' | 'tier' | 'excerpt'>): boolean {
  const haystack = fact.excerpt.replace(/,/g, '')
  const renderings = (n: number) => [String(n), n.toFixed(2), n.toFixed(1), n.toFixed(3)]
  const checks: boolean[] = []
  if (fact.amountUsd > 0) checks.push(renderings(fact.amountUsd).some((r) => haystack.includes(r)))
  if (fact.percent !== undefined && fact.percent > 0) checks.push(renderings(fact.percent).some((r) => haystack.includes(r)))
  return checks.length === 0 || checks.every(Boolean)
}

// First rule violation across the raw facts, or null when clean. Mirrors
// pipeline/stages/claims.ts's validateClaimRules → corrective-re-prompt pattern.
export function factViolation(fact: RawFact, allowedUnits: string[], pageText: string): string | null {
  if (!allowedUnits.includes(fact.unit)) return `unit "${fact.unit}" is not in the allowed list`
  if (fact.unit === ENTRY_PLAN_UNIT && fact.tier !== 'entry-paid') return `unit "${ENTRY_PLAN_UNIT}" requires tier "entry-paid"`
  if (fact.tier === 'free' && fact.amountUsd !== 0) return 'free-tier facts must have amountUsd 0'
  if (fact.amountUsd === 0 && fact.percent === undefined && fact.tier !== 'free') return 'a non-free fact must carry a price (amountUsd > 0 or percent)'
  if (!excerptFound(fact.excerpt, pageText)) return `excerpt is not a verbatim quote from the page: "${fact.excerpt.slice(0, 80)}"`
  if (!amountAppearsInExcerpt(fact)) return `the extracted figure does not appear in its own excerpt: "${fact.excerpt.slice(0, 80)}"`
  return null
}

export function validatePricingFacts(raw: RawPricing, allowedUnits: string[], pageText: string): string | null {
  for (const fact of raw.facts) {
    const violation = factViolation(fact, allowedUnits, pageText)
    if (violation) return violation
  }
  return null
}

// Assembles the final entry: sourceUrl/fetchedAt stamped from the actual fetch (never typed by
// the LLM). Zero surviving facts collapse to an honest unavailable record.
export function buildPricingEntry(
  facts: RawFact[],
  opts: { sourceUrl: string; fetchedAt: string; emptyReason: string },
): ProductPricing {
  if (facts.length === 0) {
    return { unavailable: true, reason: opts.emptyReason, sourceUrl: opts.sourceUrl, fetchedAt: opts.fetchedAt }
  }
  const stamped: PricingFact[] = facts.map((f) => ({
    unit: f.unit,
    amountUsd: f.amountUsd,
    ...(f.percent !== undefined ? { percent: f.percent } : {}),
    tier: f.tier,
    ...(f.notes ? { notes: f.notes } : {}),
    sourceUrl: opts.sourceUrl,
    excerpt: f.excerpt,
    fetchedAt: opts.fetchedAt,
  }))
  return { facts: stamped }
}

// One product's extraction against one fetched page: LLM → validate → one corrective re-prompt
// on violation → drop any still-unverifiable facts individually (an invented excerpt must never
// sink the verified ones) → assemble. Pure over its inputs, so tests can drive it with a mocked
// LLM client (pipeline/llm.ts's setClientForTests).
export async function extractPricing(opts: {
  product: Product
  arenaId: string
  arenaName: string
  pageText: string
  sourceUrl: string
  fetchedAt: string
}): Promise<ProductPricing> {
  const allowedUnits = allowedUnitsFor(opts.arenaId)
  const primaryUnit = PRICING_ARENAS[opts.arenaId].primary
  const prompt = (extra?: string) =>
    pricingPrompt(opts.product, opts.arenaName, primaryUnit, allowedUnits, opts.pageText, extra)

  let raw = await llmJson({ schema: RawPricingSchema, system: SYSTEM, prompt: prompt() })
  const violation = validatePricingFacts(raw, allowedUnits, opts.pageText)
  if (violation) {
    raw = await llmJson({
      schema: RawPricingSchema,
      system: SYSTEM,
      prompt: prompt(`Your previous output violated a rule: ${violation}. Correct it — drop any fact you cannot back with a verbatim on-page excerpt.`),
    })
  }
  const kept = raw.facts.filter((f) => factViolation(f, allowedUnits, opts.pageText) === null)
  const dropped = raw.facts.length - kept.length
  if (dropped > 0) console.warn(`pricing: ${opts.arenaId}/${opts.product.id} dropped ${dropped} unverifiable fact(s)`)
  const emptyReason =
    raw.facts.length === 0
      ? (raw.pageNote ?? 'no extractable unit pricing printed on the page')
      : 'extracted figures could not be verified verbatim against the page'
  return buildPricingEntry(kept, { sourceUrl: opts.sourceUrl, fetchedAt: opts.fetchedAt, emptyReason })
}

// Pricing-page candidates, most-authoritative first: the curated businessModel.url (already a
// pricing link where curated), then the well-known /pricing path off the site root.
export function candidatePricingUrls(product: Product): string[] {
  const site = product.urls.site.replace(/\/$/, '')
  const candidates = [product.businessModel?.url, `${site}/pricing`, product.urls.site]
  return [...new Set(candidates.filter((u): u is string => Boolean(u)))]
}

async function fetchPricingPage(product: Product): Promise<{ pageText: string; sourceUrl: string } | { failReason: string }> {
  let lastError = ''
  for (const url of candidatePricingUrls(product)) {
    try {
      const markdown = htmlToMarkdown(await fetchWithRetry(url, 1))
      if (normalizeForMatch(markdown).length >= MIN_PAGE_CHARS) {
        return { pageText: markdown.slice(0, MAX_PAGE_CHARS), sourceUrl: url }
      }
      lastError = `page at ${url} renders as a JS shell — no static pricing text to verify against`
    } catch (err) {
      lastError = `fetch failed for ${url}: ${err instanceof Error ? err.message : String(err)}`
    }
  }
  return { failReason: lastError || 'no pricing page candidates' }
}

export async function runPricing({ category, product }: { category?: string; product?: string }): Promise<void> {
  const covered = resolveCategories(category).filter((c) => c.id in PRICING_ARENAS)
  if (category && covered.length === 0) {
    throw new Error(`category ${category} is not a pricing-covered arena (see lib/pricing.ts's PRICING_ARENAS)`)
  }
  let matched = 0
  for (const cat of covered) {
    const dataDir = categoryDir(cat.id)
    const products = readJson(ProductSchema.array(), path.join(dataDir, 'products.json'))
    const targets = products.filter((p) => !product || p.id === product)
    matched += targets.length
    const pricingFile = path.join(dataDir, 'pricing.json')
    // Merge into the existing map so --product re-runs only replace that product's entry.
    const map: PricingMap = (() => {
      try { return readJson(PricingMapSchema, pricingFile) } catch { return {} }
    })()

    for (const p of targets) {
      const fetchedAt = new Date().toISOString()
      const page = await fetchPricingPage(p)
      let entry: ProductPricing
      if ('failReason' in page) {
        entry = { unavailable: true, reason: page.failReason.slice(0, 300), sourceUrl: candidatePricingUrls(p)[0], fetchedAt }
      } else {
        entry = await extractPricing({ product: p, arenaId: cat.id, arenaName: cat.name, pageText: page.pageText, sourceUrl: page.sourceUrl, fetchedAt })
      }
      map[p.id] = entry
      const summary = 'facts' in entry
        ? `${entry.facts.length} fact(s): ${entry.facts.map((f) => `${f.amountUsd || (f.percent !== undefined ? `${f.percent}%` : 'free')} ${f.unit}`).slice(0, 3).join(' · ')}`
        : `unclear (${entry.reason})`
      console.log(`pricing: ${cat.id}/${p.id} → ${summary}`)
    }

    // Keep only entries for products that still exist, in products.json order.
    const ordered: PricingMap = {}
    for (const p of products) if (map[p.id]) ordered[p.id] = map[p.id]
    writeJson(pricingFile, PricingMapSchema.parse(ordered))
  }
  if (product && matched === 0) throw new Error(`unknown product: ${product}`)
}
