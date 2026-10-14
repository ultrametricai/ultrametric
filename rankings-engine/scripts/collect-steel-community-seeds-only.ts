// One-shot bring-up helper (browser-agents, 2026-09): collect-community for steel using ONLY the
// curated seeds from pipeline/seeds/community.json. The generic HN name-search corpus for
// "Steel" pulls unrelated steel-industry threads whose content trips the LLM's refusal path
// (stop_reason: "refusal" — reproduced 3x), so the stage's combined corpus can never parse.
// Same system prompt, same distillation contract, same replace-community-tier write as
// pipeline/stages/collect-community.ts — just without the name-search corpus.
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { type Evidence, EvidenceSchema } from '../../lib/schemas'
import { fetchWithRetry, htmlToMarkdown } from '../fetch-page'
import { llmJson } from '../llm'
import { categoryDir, readJson } from '../paths'

const CommunityItemsSchema = z.object({
  items: z.array(z.object({ url: z.string().url(), excerpt: z.string().min(10).max(400) })).min(0).max(20),
})

async function main() {
  const seeds = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'seeds', 'community.json'), 'utf8')) as Record<
    string,
    Record<string, string[]>
  >
  const urls = seeds['browser-agents']?.['steel'] ?? []
  if (urls.length === 0) throw new Error('no curated seeds for browser-agents/steel')
  const sources: { url: string; text: string }[] = []
  for (const url of urls) {
    sources.push({ url, text: htmlToMarkdown(await fetchWithRetry(url)).slice(0, 20_000) })
  }
  const corpus = sources.map((s) => `=== ${s.url} ===\n${s.text}`).join('\n\n').slice(0, 80_000)
  const system = `You distill community discussion about a software product into evidence items.
Each item: a real user experience or claim from the discussion (praise, complaint, workaround, comparison), paraphrased tightly or quoted, max 400 chars, with the URL it came from.
Exclude marketing, vendor statements, and speculation. Cover both positives and negatives.
These discussions may be about a DIFFERENT product that shares the name. Include an item ONLY if the discussion is clearly about Steel by Steel, Inc. (steel.dev), the Browser Automation for Agents product. If none qualify, return an empty items list.
Return JSON: {"items":[{"url":"...","excerpt":"..."}]}`
  const { items } = await llmJson({
    schema: CommunityItemsSchema,
    system,
    prompt: `Product: Steel\n\nDiscussions:\n\n${corpus}`,
    maxTokens: 8192,
  })
  const now = new Date().toISOString()
  const community: Evidence[] = items.map((item, i) => ({
    id: `steel-comm-${i + 1}`,
    tier: 'community',
    url: item.url,
    excerpt: item.excerpt,
    fetchedAt: now,
  }))
  const file = path.join(categoryDir('browser-agents'), 'evidence', 'steel.json')
  const existing = fs.existsSync(file) ? readJson(EvidenceSchema.array(), file) : []
  const merged = [...existing.filter((e) => e.tier !== 'community'), ...community]
  fs.writeFileSync(file, JSON.stringify(merged, null, 2) + '\n')
  console.log(`steel: wrote ${community.length} community items (seeds-only corpus, ${sources.length} sources)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
