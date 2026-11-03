import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { type Evidence, EvidenceSchema, ProductSchema } from '../../lib/schemas'
import { fetchWithRetry, htmlToMarkdown } from '../fetch-page'
import { llmJson } from '../llm'
import { categoryDir, readJson, resolveCategories, writeJson } from '../paths'
import { canonicalSource, sameEvidence, sourceHash } from '../evidence-source.mjs'

const CommunityItemsSchema = z.object({
  items: z.array(z.object({ url: z.string().url(), excerpt: z.string().min(10).max(400) })).min(0).max(20),
})

function buildSystemPrompt(name: string, vendor: string, siteDomain: string, categoryName: string): string {
  return `You distill community discussion about a software product into evidence items.
Each item: a real user experience or claim from the discussion (praise, complaint, workaround, comparison), paraphrased tightly or quoted, max 400 chars, with the URL it came from.
Exclude marketing, vendor statements, and speculation. Cover both positives and negatives.
These discussions may be about a DIFFERENT product that shares the name. Include an item ONLY if the discussion is clearly about ${name} by ${vendor} (${siteDomain}), the ${categoryName} product. If none qualify, return an empty items list.
Return JSON: {"items":[{"url":"...","excerpt":"..."}]}`
}

async function hnCorpus(name: string): Promise<{ url: string; text: string }[]> {
  let search: { hits: { objectID: string; title: string; num_comments: number }[] }
  try {
    search = JSON.parse(
      await fetchWithRetry(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(name)}&tags=story&hitsPerPage=5`),
    ) as { hits: { objectID: string; title: string; num_comments: number }[] }
  } catch (err) {
    console.warn(`collect-community: WARN HN search for "${name}" failed: ${(err as Error).message}`)
    return []
  }
  const out: { url: string; text: string }[] = []
  for (const hit of search.hits.filter((h) => h.num_comments > 0)) {
    try {
      const item = JSON.parse(await fetchWithRetry(`https://hn.algolia.com/api/v1/items/${hit.objectID}`)) as {
        title: string
        children: { text: string | null }[]
      }
      const comments = item.children
        .map((c) => (c.text ? htmlToMarkdown(c.text) : ''))
        .filter(Boolean)
        .slice(0, 30)
        .join('\n---\n')
      out.push({ url: `https://news.ycombinator.com/item?id=${hit.objectID}`, text: `# ${item.title}\n${comments}` })
    } catch (err) {
      console.warn(`collect-community: WARN hn item ${hit.objectID} failed: ${(err as Error).message}`)
    }
  }
  return out
}

export function mergeCommunityEvidence(productId: string, existing: Evidence[], items: Array<{ url: string; excerpt: string }>,
  sources: Array<{ url: string; text: string }>, now: string): Evidence[] {
  const digests = new Map(sources.map(source => [canonicalSource(source.url), sourceHash(source.text)]))
  const result = [...existing]
  const ids = new Set(existing.map(item => item.id))
  let index = 0
  for (const item of items) {
    const digest = digests.get(canonicalSource(item.url))
    if (!digest) throw new Error(`Community item cites an unfetched source: ${item.url}`)
    const candidate: Evidence = { ...item, id: '', tier: 'community', fetchedAt: now, sourceHash: digest }
    // An unchanged fetched discussion cannot become new support through another
    // model paraphrase. Missing results do not delete dated reports (#548/#556).
    if (existing.some(old => old.tier === 'community' && canonicalSource(old.url) === canonicalSource(item.url)
        && old.sourceHash === digest) || result.some(old => sameEvidence(old, candidate))) continue
    do { index++ } while (ids.has(`${productId}-comm-${index}`))
    candidate.id = `${productId}-comm-${index}`
    ids.add(candidate.id)
    result.push(candidate)
  }
  return result
}

export async function runCollectCommunity({ category, product }: { category?: string; product?: string }): Promise<void> {
  const seeds = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'seeds', 'community.json'), 'utf8')) as Record<
    string,
    Record<string, string[]>
  >

  let matched = 0
  for (const cat of resolveCategories(category)) {
    const dataDir = categoryDir(cat.id)
    const products = readJson(ProductSchema.array(), path.join(dataDir, 'products.json')).filter(
      (p) => !product || p.id === product,
    )
    matched += products.length
    const catSeeds = seeds[cat.id] ?? {}

    for (const p of products) {
      try {
        // Curated seeds go FIRST: the corpus below is capped at 80k chars, and for products
        // whose name is a common word (e.g. "Convex") the HN name-search returns off-topic
        // threads that would otherwise consume the whole budget before any hand-picked seed
        // is reached.
        const sources: { url: string; text: string }[] = []
        for (const url of catSeeds[p.id] ?? []) {
          try {
            sources.push({ url, text: htmlToMarkdown(await fetchWithRetry(url)).slice(0, 20_000) })
          } catch (err) {
            console.warn(`collect-community: WARN seed ${url} failed: ${(err as Error).message}`)
          }
        }
        const seedUrls = new Set(sources.map((s) => s.url))
        for (const source of await hnCorpus(`${p.name}`)) {
          if (!seedUrls.has(source.url)) sources.push(source)
        }
        if (sources.length === 0) {
          console.warn(`collect-community: WARN no community sources found for ${cat.id}/${p.id}; skipping`)
          continue
        }
        let siteDomain: string
        try {
          siteDomain = new URL(p.urls.site).hostname
        } catch {
          siteDomain = p.urls.site
        }
        const buildCorpus = (srcs: { url: string; text: string }[]) =>
          srcs.map((s) => `=== ${s.url} ===\n${s.text}`).join('\n\n').slice(0, 80_000)
        const distill = (srcs: { url: string; text: string }[]) =>
          llmJson({
            schema: CommunityItemsSchema,
            system: buildSystemPrompt(p.name, p.vendor, siteDomain, cat.name),
            prompt: `Product: ${p.name}\n\nDiscussions:\n\n${buildCorpus(srcs)}`,
            maxTokens: 8192,
          })
        let items: { url: string; excerpt: string }[]
        const seedCount = (catSeeds[p.id] ?? []).length
        try {
          ;({ items } = await distill(sources))
        } catch (err) {
          // Name-collision corpora can flood the pack with off-topic threads that the model
          // refuses to process at all (seen live: "Vapi" HN name-search returns vaping-illness
          // threads → stop_reason "refusal" on every attempt). When curated seeds exist, retry
          // once against the seed sources alone — they were hand-picked for the right product.
          const seedSources = sources.slice(0, seedCount)
          if (seedSources.length === 0) throw err
          console.warn(
            `collect-community: WARN ${cat.id}/${p.id} full corpus failed (${(err as Error).message}); retrying with ${seedSources.length} curated seed source(s) only`,
          )
          ;({ items } = await distill(seedSources))
        }
        const now = new Date().toISOString()
        const file = path.join(dataDir, 'evidence', `${p.id}.json`)
        const existing = fs.existsSync(file) ? readJson(EvidenceSchema.array(), file) : []
        writeJson(file, mergeCommunityEvidence(p.id, existing, items, sources, now))
        if (items.length === 0) {
          console.warn(
            `collect-community: WARN ${cat.id}/${p.id} → 0 community items qualified (of ${sources.length} sources); dated evidence preserved`,
          )
        } else {
          console.log(`collect-community: ${cat.id}/${p.id} → ${items.length} candidates from ${sources.length} sources`)
        }
      } catch (err) {
        console.warn(`collect-community: WARN ${cat.id}/${p.id} failed: ${(err as Error).message}`)
      }
    }
  }
  if (product && matched === 0) throw new Error(`unknown product: ${product}`)
}
