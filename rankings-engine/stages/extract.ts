import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { type Evidence, EvidenceSchema, type Product, ProductSchema } from '../../lib/schemas'
import { llmJson } from '../llm'
import { CACHE_DIR, categoryDir, readJson, resolveCategories, writeJson } from '../paths'

export const ExtractionSchema = z.object({
  stories: z
    .array(
      z.object({
        persona: z.string().min(1),
        title: z.string().min(1),
        quote: z.string().min(1),
        sourceKey: z.string().regex(/^(site|docs|changelog|github|extra-\d+)$/),
      }),
    )
    .min(5)
    .max(40),
})
export type Extraction = z.infer<typeof ExtractionSchema>
export type CandidateStory = { persona: string; title: string; evidenceId: string }

// Resolves a candidate's sourceKey (one of site/docs/changelog/github, or extra-N for the
// Nth urls.extra entry) to the actual URL it was crawled from, falling back to the site
// url if the referenced source is missing (e.g. an out-of-range extra index).
function resolveSourceUrl(sourceKey: string, sourceUrls: Product['urls']): string {
  const extraMatch = sourceKey.match(/^extra-(\d+)$/)
  if (extraMatch) {
    return sourceUrls.extra?.[Number(extraMatch[1])] ?? sourceUrls.site
  }
  return sourceUrls[sourceKey as 'site' | 'docs' | 'changelog' | 'github'] ?? sourceUrls.site
}

// Normalizes an excerpt for cross-run dedup: trim, lowercase, collapse internal whitespace.
// Deliberately looser than exact-string equality so re-extracting against a slightly
// reformatted crawl (e.g. different turndown whitespace) still recognizes the same claim.
function normalizeExcerpt(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

// Highest `-{abbrev}-N` suffix already in use across `items`, so freshly minted ids never
// collide with ids retained from a prior run.
function maxIndex(items: Evidence[], abbrev: 'docs' | 'gh'): number {
  const tier = abbrev === 'gh' ? 'github' : 'claimed-docs'
  let max = 0
  for (const e of items) {
    if (e.tier !== tier) continue
    const m = e.id.match(/-(\d+)$/)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max
}

// Builds this run's claimed-docs/github evidence from a fresh extraction, UNIONED with
// `existingDocsGh` (that product's claimed-docs/github evidence from a prior extract run, if
// any — community/probe tiers are handled separately by the caller). This makes re-running
// extract against an expanded corpus monotonic rather than a wholesale replacement: a single
// LLM extraction pass over a bigger corpus has no guarantee it re-surfaces every previously
// captured claim, so silently dropping the old pack on every re-run would let real,
// still-true evidence disappear by chance. Matching is by normalized excerpt equality
// (see normalizeExcerpt): a match reuses the EXISTING item's id (so citations by
// upstream verdicts/tests stay stable across runs); a genuinely new excerpt gets a fresh
// sequential id continuing from the existing pack's max index per tier abbreviation.
export function buildEvidence(
  productId: string,
  extraction: Extraction,
  sourceUrls: Product['urls'],
  fetchedAt: string,
  existingDocsGh: Evidence[] = [],
): { candidates: CandidateStory[]; evidence: Evidence[] } {
  const evidence: Evidence[] = [...existingDocsGh]
  const byNormExcerpt = new Map<string, string>() // normalized excerpt -> evidenceId (existing + newly minted this run)
  for (const e of existingDocsGh) byNormExcerpt.set(normalizeExcerpt(e.excerpt), e.id)
  const byQuote = new Map<string, string>() // exact-quote dedup within this run's own extraction output
  const counters = { docs: maxIndex(existingDocsGh, 'docs'), gh: maxIndex(existingDocsGh, 'gh') }

  const candidates = extraction.stories.map((s) => {
    const norm = normalizeExcerpt(s.quote)
    let evidenceId = byQuote.get(s.quote) ?? byNormExcerpt.get(norm)
    if (!evidenceId) {
      const isGithub = s.sourceKey === 'github'
      const abbrev = isGithub ? 'gh' : 'docs'
      counters[abbrev]++
      evidenceId = `${productId}-${abbrev}-${counters[abbrev]}`
      evidence.push({
        id: evidenceId,
        tier: isGithub ? 'github' : 'claimed-docs',
        url: resolveSourceUrl(s.sourceKey, sourceUrls),
        excerpt: s.quote,
        fetchedAt,
      })
      byNormExcerpt.set(norm, evidenceId)
    }
    byQuote.set(s.quote, evidenceId)
    return { persona: s.persona, title: s.title, evidenceId }
  })
  return { candidates, evidence }
}

const SYSTEM = `You extract user stories from a software product's own marketing and documentation.
A user story is a concrete capability a user gains: "As a <persona>, I can <do something specific>."
Only include capabilities the materials actually claim. Each story needs a short verbatim-ish quote (max 200 chars) from the materials as evidence and which source file it came from.
Personas must be drawn from: developer, designer, switcher, power-user.
Sources are labeled "=== SOURCE <key> ===" in the materials below; use that exact key. Besides site/docs/changelog/github, a source may be labeled extra-0, extra-1, etc. (additional vendor pages) — use the matching extra-N key, not "docs" or "site", when a quote comes from one of those.
Return JSON: {"stories":[{"persona":"...","title":"As a ..., I can ...","quote":"...","sourceKey":"site|docs|changelog|github|extra-N"}]}`

export async function runExtract({ category, product }: { category?: string; product?: string }): Promise<void> {
  let matched = 0
  for (const cat of resolveCategories(category)) {
    const dataDir = categoryDir(cat.id)
    const products = readJson(ProductSchema.array(), path.join(dataDir, 'products.json')).filter(
      (p) => !product || p.id === product,
    )
    matched += products.length

    for (const p of products) {
      const crawlDir = path.join(CACHE_DIR, 'crawl', cat.id, p.id)
      if (!fs.existsSync(crawlDir)) throw new Error(`extract: no crawl cache for ${cat.id}/${p.id} — run crawl first`)
      const files = fs.readdirSync(crawlDir)
      // Fair per-source budget: a single oversized source (e.g. a years-long changelog)
      // must not consume the whole corpus and silently starve every other crawled source
      // (docs, github, urls.extra pages) out of the extraction prompt. Each source gets an
      // equal share of the total cap; smaller sources naturally use less.
      const perSourceCap = Math.max(1, Math.floor(60_000 / files.length))
      const parts = files.map((f) => {
        const key = f.replace(/\.md$/, '')
        const body = fs.readFileSync(path.join(crawlDir, f), 'utf8').slice(0, perSourceCap)
        return `=== SOURCE ${key} ===\n${body}`
      })
      const corpus = parts.join('\n\n')

      const extraction = await llmJson({
        schema: ExtractionSchema,
        system: SYSTEM,
        prompt: `Product: ${p.name} (${p.vendor})\n\nMaterials:\n\n${corpus}`,
        maxTokens: 8192,
      })

      const evidenceFile = path.join(dataDir, 'evidence', `${p.id}.json`)
      const existing = fs.existsSync(evidenceFile) ? readJson(EvidenceSchema.array(), evidenceFile) : []
      const kept = existing.filter((e) => e.tier === 'community' || e.tier === 'probe')
      const existingDocsGh = existing.filter((e) => e.tier === 'claimed-docs' || e.tier === 'github')

      const { candidates, evidence } = buildEvidence(p.id, extraction, p.urls, new Date().toISOString(), existingDocsGh)

      writeJson(evidenceFile, [...evidence, ...kept])
      writeJson(path.join(CACHE_DIR, 'extract', cat.id, `${p.id}.json`), candidates)
      console.log(`extract: ${cat.id}/${p.id} → ${candidates.length} candidate stories, ${evidence.length} evidence items`)
    }
  }
  if (product && matched === 0) throw new Error(`unknown product: ${product}`)
}
