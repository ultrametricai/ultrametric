// Stage 2 of the YC ingestion lane: for every PENDING modern-batch (W23–S26) company in
// open-rankings/yc-map.json (yc-fetch stamps new companies pending: true; judged entries are
// never re-spent or overwritten), ask the LLM to map it to (a) an EXISTING arena id it genuinely competes in, (b) a proposed new
// arena it clusters with peers under, or (c) null (not a software product ranked meaningfully —
// hardware, biotech, services, marketplaces). Batches ~40 companies per call and runs
// SEQUENTIALLY (not in parallel) so each call can see the running list of already-proposed arena
// names and reuse one instead of coining a near-duplicate — the #1 risk with LLM-clustered
// category names is fragmentation ("ai-legal" vs "legal-ai" vs "legaltech-ai" for the same
// cluster). Checkpoints after every batch (both open-rankings/yc-map.json and a progress marker in
// rankings-engine/cache/yc/, gitignored) so a killed/resumed run picks up where it left off instead of
// re-spending LLM calls. Run with: tsx rankings-engine/scripts/yc-classify.ts
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { type YcCompany, YcMapSchema } from '../../lib/schemas'
import { llmJson } from '../llm'
import { ROOT, writeJson } from '../paths'

const YC_MAP_PATH = path.join(ROOT, 'open-rankings', 'yc-map.json')
const PROGRESS_PATH = path.join(ROOT, 'rankings-engine', 'cache', 'yc', 'classify-progress.json')
const CATEGORIES_PATH = path.join(ROOT, 'open-rankings', 'categories.json')
const BATCH_SIZE = 40

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/

function loadCategories(): { id: string; name: string; description: string }[] {
  return JSON.parse(fs.readFileSync(CATEGORIES_PATH, 'utf8'))
}

function loadProgress(): Set<string> {
  if (!fs.existsSync(PROGRESS_PATH)) return new Set()
  return new Set(JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8')) as string[])
}

function saveProgress(done: Set<string>) {
  writeJson(PROGRESS_PATH, Array.from(done))
}

function systemPrompt(arenas: { id: string; name: string; description: string }[]): string {
  const arenaList = arenas.map((a) => `- ${a.id}: ${a.description}`).join('\n')
  return `You classify Y Combinator companies onto Ultrametric's arena taxonomy.

EXISTING ARENAS (use the exact id if a company genuinely competes here — i.e. a buyer evaluating products in this arena would seriously consider this company as an alternative):
${arenaList}

For each company, decide exactly ONE of:
(a) mappedArena = one of the existing arena ids above, if the company is a real head-to-head competitor in that arena (proposedArena must be null).
(b) proposedArena = a NEW kebab-case category name (lowercase, hyphen-separated, e.g. "ai-legal-assistants"), if the company is a software PRODUCT that clusters with other companies in a coherent, ranking-worthy category not covered above (mappedArena must be null). Prefer REUSING an exact name from the "already-proposed arena names" list below if the company fits one of them — do not coin a near-duplicate name for the same cluster.
(c) both null — if the company is not a software product that could be meaningfully ranked against peers: hardware, biotech/life sciences, physical/consumer goods, professional services, staffing/recruiting agencies, marketplaces/e-commerce, real estate, non-profit, or otherwise a one-off business rather than a category of comparable software products.

Be conservative with (a): only map to an existing arena if it's a genuine competitor, not just tangentially related. Be conservative with (b): only propose a new arena when you can tell (from the batch of companies you're given, plus the running list) that at least 2-3 companies would cluster there — a category of one is null, not a proposedArena.

Return ONLY JSON: {"results":[{"slug":"...","mappedArena":"..."|null,"proposedArena":"..."|null}, ...]} with exactly one result per input company, in the same order, keyed by "slug".`
}

function userPrompt(batch: YcCompany[], alreadyProposed: string[]): string {
  const companies = batch
    .map((c) => `- slug=${c.slug} | ${c.name} | ${c.oneLiner || '(no one-liner)'} | tags: ${c.tags.join(', ') || 'none'}`)
    .join('\n')
  const proposedList = alreadyProposed.length
    ? `\nAlready-proposed arena names so far (reuse one of these if it fits, exact spelling):\n${alreadyProposed.sort().join(', ')}\n`
    : '\n(No arenas proposed yet — you are free to coin the first ones.)\n'
  return `Companies to classify:\n${companies}\n${proposedList}`
}

const ResultSchema = z.object({
  slug: z.string().min(1),
  mappedArena: z.string().nullable(),
  proposedArena: z.string().nullable(),
})

async function main() {
  const categories = loadCategories()
  const arenaIds = new Set(categories.map((c) => c.id))
  const system = systemPrompt(categories)

  const map: YcCompany[] = YcMapSchema.parse(JSON.parse(fs.readFileSync(YC_MAP_PATH, 'utf8')))
  const bySlug = new Map(map.map((c) => [c.slug, c]))
  const done = loadProgress()
  const alreadyProposed = new Set<string>()
  for (const c of map) if (c.proposedArena) alreadyProposed.add(c.proposedArena)

  // Work = entries the committed map marks pending (yc-fetch stamps new companies; a judged
  // entry is never pending — lib/schemas.ts) minus this run's own checkpoint. The committed flag,
  // not the gitignored progress cache, is the source of truth: a fresh CI runner re-judges
  // nothing already judged, and judged verdicts are never overwritten.
  const pending = map.filter((c) => c.pending === true && !done.has(c.slug))
  console.log(`${map.length} total, ${map.length - pending.length - done.size} already classified, ${pending.length} pending.`)

  const batches: YcCompany[][] = []
  for (let i = 0; i < pending.length; i += BATCH_SIZE) batches.push(pending.slice(i, i + BATCH_SIZE))

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    const schema = z.object({ results: z.array(ResultSchema).length(batch.length) })
    const prompt = userPrompt(batch, Array.from(alreadyProposed))
    process.stdout.write(`Batch ${i + 1}/${batches.length} (${batch.length} companies)... `)
    const { results } = await llmJson({ schema, system, prompt, maxTokens: 8192 })

    const wantedSlugs = new Set(batch.map((c) => c.slug))
    for (const r of results) {
      if (!wantedSlugs.has(r.slug)) continue // ignore hallucinated slugs, keep company unclassified
      const company = bySlug.get(r.slug)
      if (!company) continue

      let mappedArena = r.mappedArena
      let proposedArena = r.proposedArena
      if (mappedArena && !arenaIds.has(mappedArena)) mappedArena = null // reject invented arena ids
      if (proposedArena && !KEBAB.test(proposedArena)) proposedArena = null // reject malformed names
      if (mappedArena && proposedArena) proposedArena = null // schema forbids both; prefer the existing-arena mapping

      company.mappedArena = mappedArena
      company.proposedArena = proposedArena
      delete company.pending // judged — null/null from here on means "not rankable", not "awaiting"
      if (proposedArena) alreadyProposed.add(proposedArena)
      done.add(r.slug)
    }
    // Anything the LLM silently dropped from its own response still counts as "attempted" within
    // this run so the loop doesn't retry it forever on a model that consistently mis-sizes its
    // output for one slug. Its pending flag stays set, so a later run gets another attempt.
    for (const c of batch) done.add(c.slug)

    writeJson(YC_MAP_PATH, YcMapSchema.parse(map))
    saveProgress(done)
    console.log('done.')
  }

  console.log(`\nClassification complete: ${map.length} companies processed.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
