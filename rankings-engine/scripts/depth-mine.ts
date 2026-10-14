// Lane B depth-mining: for one category, mines NEW candidate stories from three sources —
// (1) unmapped vendor claims (claims/*.json entries with empty storyIds — capabilities our
//     taxonomy doesn't cover), (2) demand-side signal (fresh HN Algolia comment search per
//     product + the community-tier evidence already collected), (3) an expert-buyer gap
//     review of the current taxonomy (pricing traps, migration, scale limits, reliability).
// Each source gets its own LLM pass, told about ALL existing stories (so it can avoid
// duplicates) and instructed to keep only concrete, judgeable, product-neutral stories.
// Candidates are deduped against existing stories (id + a cheap token-overlap semantic check)
// and against each other, given `origin`, appended to stories.json (sorted, canon untouched),
// and a summary is written to pipeline/cache/depth/<category>.json for review.
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import {
  ClaimsArraySchema, EvidenceSchema, ProductSchema, type Story, StorySchema,
} from '../../lib/schemas'
import { fetchWithRetry, htmlToMarkdown } from '../fetch-page'
import { llmJson } from '../llm'
import { CACHE_DIR, categoryDir, readJson, resolveCategories, writeJson } from '../paths'

const DEPTH_PROMPT_VERSION = 'v2-depth'

const CandidateStorySchema = StorySchema.omit({ origin: true })
const CandidatesSchema = z.object({ stories: z.array(CandidateStorySchema).min(0).max(8) })

// Kebab-case prefixes reserved for the 29 canonical (never-LLM-authored) stories injected by
// pipeline/agentic-stories.ts (see normalize.ts's CANON_ID_PREFIXES). A depth-mined story that
// happened to land on one of these would look like a canonical lens story and would get
// silently dropped if normalize.ts ever re-ran for this category — so we nudge any collision
// to a lookalike-but-distinct prefix instead of failing.
const CANON_ID_PREFIXES: [string, string][] = [
  ['agentic-', 'agent-'],
  ['automation-', 'workflow-'],
  ['privacy-', 'confidentiality-'],
  ['openness-', 'open-access-'],
  ['api-', 'interface-'],
]

function sanitizeId(id: string): string {
  for (const [prefix, replacement] of CANON_ID_PREFIXES) {
    if (id.startsWith(prefix)) return replacement + id.slice(prefix.length)
  }
  return id
}

function existingList(stories: Story[]): string {
  return stories.map((s) => `${s.id} [${s.theme}/${s.group}]: ${s.title}`).join('\n')
}

function commonRules(categoryName: string, personas: string[], themes: string[]): string {
  return `Category: "${categoryName}". Personas must be one of: ${personas.join(', ')}. theme must be one of: ${themes.join(', ')}.
Fields: id (kebab-case, stable, descriptive, NOT already used below, NOT starting with "agentic-", "automation-", "privacy-", "openness-", or "api-" — those prefixes are reserved), persona, title ("As a <persona>, I can <specific capability>" or "...I know <concrete fact>" for pricing/limits), theme, group (kebab-case cluster id under the theme — reuse an existing group where it fits), weight (3=core daily-driver need, 2=important, 1=nice-to-have).
Every story MUST be judgeable from public evidence (docs, changelog, GitHub, community discussion) and MUST be product-neutral — never mention a specific product/vendor name in id or title. Do not duplicate (by id or by meaning) any story already in the taxonomy below.
Return AT MOST 7 stories: only the most valuable and clearly distinct ones. Do not pad to hit a count — 3 excellent stories beats 7 mediocre ones.
Existing taxonomy (do not duplicate these):
${'{{EXISTING}}'}
Return JSON: {"stories":[{...}]}`
}

async function hnComments(query: string, hitsPerPage = 20): Promise<string[]> {
  try {
    const search = JSON.parse(
      await fetchWithRetry(
        `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=comment&hitsPerPage=${hitsPerPage}`,
      ),
    ) as { hits: { comment_text: string | null; story_title: string | null }[] }
    return search.hits
      .map((h) => h.comment_text)
      .filter((t): t is string => !!t)
      .map((t) => htmlToMarkdown(t).trim())
      .filter((t) => t.length > 20)
  } catch (err) {
    console.warn(`depth-mine: WARN HN comment search "${query}" failed: ${(err as Error).message}`)
    return []
  }
}

async function mineClaims(
  categoryName: string,
  personas: string[],
  themes: string[],
  stories: Story[],
  claimsByProduct: { productId: string; text: string; quote: string }[],
): Promise<Story[]> {
  if (claimsByProduct.length === 0) return []
  const rules = commonRules(categoryName, personas, themes).replace('{{EXISTING}}', existingList(stories))
  const system = `You design ADDITIONS to a canonical user-story taxonomy for comparing ${categoryName} products. You'll be given vendor capability claims that our current taxonomy has no story for (a real gap, not extracted evidence to judge). Turn the MEANINGFUL, non-marketing ones into 4-7 new, product-neutral, judgeable stories that generalize the capability (not "does X the way vendor Y does it" — the underlying capability any competitor could plausibly offer). Skip claims that are pure marketing fluff, are already covered by an existing story's meaning even if worded differently, or are so vendor-specific/idiosyncratic that no other product in the category could sensibly be judged on it.\n${rules}`
  const prompt = `Unmapped vendor claims (across products in this category, product identity stripped where possible):\n${claimsByProduct.map((c) => `- ${c.text} (claim quote: "${c.quote}")`).join('\n')}`
  const { stories: candidates } = await llmJson({ schema: CandidatesSchema, system, prompt, maxTokens: 8192 })
  return candidates.map((c) => ({ ...c, id: sanitizeId(c.id), origin: { kind: 'normalized' as const, promptVersion: DEPTH_PROMPT_VERSION, recordedAt: new Date().toISOString() } }))
}

async function mineDemand(
  categoryName: string,
  personas: string[],
  themes: string[],
  stories: Story[],
  demandCorpus: string,
): Promise<Story[]> {
  if (!demandCorpus.trim()) return []
  const rules = commonRules(categoryName, personas, themes).replace('{{EXISTING}}', existingList(stories))
  const system = `You mine recurring USER INTENTS from real developer/buyer discussion (HN comments, community threads) about products in the "${categoryName}" category — things people actually ask ("how do I...", "can it...", "why won't it...", "does it support...", "is there a way to..."). Distill 4-7 NEW, product-neutral, judgeable stories that capture recurring intents/pain-points NOT already covered by an existing story. Ignore one-off complaints, product-specific bugs, and anything not judgeable from public evidence for ANY product in the category.\n${rules}`
  const prompt = `Community discussion excerpts:\n${demandCorpus.slice(0, 60_000)}`
  const { stories: candidates } = await llmJson({ schema: CandidatesSchema, system, prompt, maxTokens: 8192 })
  return candidates.map((c) => ({ ...c, id: sanitizeId(c.id), origin: { kind: 'mined' as const, promptVersion: DEPTH_PROMPT_VERSION, recordedAt: new Date().toISOString() } }))
}

async function mineGaps(
  categoryName: string,
  personas: string[],
  themes: string[],
  stories: Story[],
): Promise<Story[]> {
  const rules = commonRules(categoryName, personas, themes).replace('{{EXISTING}}', existingList(stories))
  const system = `You are an expert buyer evaluating products in the "${categoryName}" category. Given the current story taxonomy below, list BLIND SPOTS an expert buyer would ask about before committing — pricing traps (overage fees, seat minimums, usage caps), migration/lock-in (data export, switching cost), scale limits (rate limits, concurrency caps, large-workspace behavior), and reliability/operational concerns (uptime SLA, incident history, support responsiveness, backwards-compat/versioning policy). Return 4-7 NEW stories, but ONLY concrete ones that are actually judgeable from public evidence for any product in the category (docs, pricing page, status page, changelog, community reports) — skip anything vague or purely subjective.\n${rules}`
  const prompt = `Give the taxonomy gap-review stories now.`
  const { stories: candidates } = await llmJson({ schema: CandidatesSchema, system, prompt, maxTokens: 8192 })
  return candidates.map((c) => ({ ...c, id: sanitizeId(c.id), origin: { kind: 'mined' as const, promptVersion: DEPTH_PROMPT_VERSION, recordedAt: new Date().toISOString() } }))
}

function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/^as an? [a-z-]+, i (can|know) /, '')
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2),
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const inter = [...a].filter((t) => b.has(t)).length
  const union = new Set([...a, ...b]).size
  return union === 0 ? 0 : inter / union
}

// Drops candidates whose id collides with an existing/already-accepted story, or whose title
// is a near-duplicate (token-overlap Jaccard > 0.55) of any existing/already-accepted story.
function dedupe(existing: Story[], candidates: Story[]): { kept: Story[]; dropped: { story: Story; reason: string }[] } {
  const kept: Story[] = []
  const dropped: { story: Story; reason: string }[] = []
  const seenIds = new Set(existing.map((s) => s.id))
  const seenTokens = existing.map((s) => ({ id: s.id, tokens: titleTokens(s.title) }))
  for (const c of candidates) {
    if (seenIds.has(c.id)) {
      dropped.push({ story: c, reason: `id collision with existing story "${c.id}"` })
      continue
    }
    const cTokens = titleTokens(c.title)
    const nearDup = seenTokens.find((s) => jaccard(s.tokens, cTokens) > 0.55)
    if (nearDup) {
      dropped.push({ story: c, reason: `near-duplicate of existing story "${nearDup.id}"` })
      continue
    }
    seenIds.add(c.id)
    seenTokens.push({ id: c.id, tokens: cTokens })
    kept.push(c)
  }
  return { kept, dropped }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const categoryFlag = args.indexOf('--category')
  const category = categoryFlag >= 0 ? args[categoryFlag + 1] : undefined
  if (!category) throw new Error('usage: tsx pipeline/scripts/depth-mine.ts --category <id>')

  const [cat] = resolveCategories(category)
  const dataDir = categoryDir(cat.id)
  const themes = cat.themes ?? []
  const stories = readJson(StorySchema.array(), path.join(dataDir, 'stories.json'))
  const products = readJson(ProductSchema.array(), path.join(dataDir, 'products.json'))

  // Source 1: unmapped claims across all products.
  const unmappedClaims: { productId: string; text: string; quote: string }[] = []
  for (const p of products) {
    const claimsFile = path.join(dataDir, 'claims', `${p.id}.json`)
    if (!fs.existsSync(claimsFile)) continue
    const claims = readJson(ClaimsArraySchema, claimsFile)
    for (const c of claims.filter((c) => c.storyIds.length === 0)) {
      unmappedClaims.push({ productId: p.id, text: c.text, quote: c.quote })
    }
  }
  console.log(`depth-mine: ${cat.id} — ${unmappedClaims.length} unmapped claims found`)

  // Source 2: demand-side — fresh HN comment search per product + existing community evidence.
  const demandParts: string[] = []
  for (const p of products) {
    const comments = await hnComments(`${p.name} ${cat.name}`)
    if (comments.length > 0) {
      demandParts.push(`=== HN comments mentioning ${p.name} ===\n${comments.slice(0, 15).join('\n---\n')}`)
    }
    const evidenceFile = path.join(dataDir, 'evidence', `${p.id}.json`)
    if (fs.existsSync(evidenceFile)) {
      const evidence = readJson(EvidenceSchema.array(), evidenceFile).filter((e) => e.tier === 'community')
      if (evidence.length > 0) {
        demandParts.push(`=== Community evidence already collected for ${p.name} ===\n${evidence.map((e) => e.excerpt).join('\n')}`)
      }
    }
  }
  const demandCorpus = demandParts.join('\n\n')
  console.log(`depth-mine: ${cat.id} — demand corpus ${demandCorpus.length} chars from ${products.length} products`)

  const claimsStories = await mineClaims(cat.name, cat.personas, themes, stories, unmappedClaims)
  console.log(`depth-mine: ${cat.id} — claims pass produced ${claimsStories.length} candidates`)
  const demandStories = await mineDemand(cat.name, cat.personas, themes, stories, demandCorpus)
  console.log(`depth-mine: ${cat.id} — demand pass produced ${demandStories.length} candidates`)
  const gapStories = await mineGaps(cat.name, cat.personas, themes, stories)
  console.log(`depth-mine: ${cat.id} — gap pass produced ${gapStories.length} candidates`)

  // Dedupe sequentially: claims -> demand -> gap, each checked against existing + all
  // previously-kept candidates from earlier sources in this run.
  let running = stories
  const dc1 = dedupe(running, claimsStories)
  running = [...running, ...dc1.kept]
  const dc2 = dedupe(running, demandStories)
  running = [...running, ...dc2.kept]
  const dc3 = dedupe(running, gapStories)

  const accepted = { claims: dc1.kept, mined: dc2.kept, gap: dc3.kept }
  const droppedAll = [...dc1.dropped, ...dc2.dropped, ...dc3.dropped]

  const summary = {
    category: cat.id,
    counts: { claims: accepted.claims.length, mined: accepted.mined.length, gap: accepted.gap.length },
    accepted,
    dropped: droppedAll.map((d) => ({ id: d.story.id, title: d.story.title, reason: d.reason })),
  }
  const outFile = path.join(CACHE_DIR, 'depth', `${cat.id}.json`)
  writeJson(outFile, summary)
  console.log(
    `depth-mine: ${cat.id} → accepted ${accepted.claims.length} claims + ${accepted.mined.length} mined + ${accepted.gap.length} gap = ${
      accepted.claims.length + accepted.mined.length + accepted.gap.length
    } new stories (dropped ${droppedAll.length} dupes); summary at ${outFile}`,
  )

  // Inject into stories.json: append + sort, canon and existing stories untouched.
  const merged = [...stories, ...accepted.claims, ...accepted.mined, ...accepted.gap]
  const ids = new Set<string>()
  for (const s of merged) {
    if (ids.has(s.id)) throw new Error(`depth-mine: duplicate story id "${s.id}" after merge`)
    ids.add(s.id)
  }
  const sorted = StorySchema.array().parse(merged).sort(
    (a, b) => a.theme.localeCompare(b.theme) || a.group.localeCompare(b.group) || a.id.localeCompare(b.id),
  )
  writeJson(path.join(dataDir, 'stories.json'), sorted)
  console.log(`depth-mine: ${cat.id} — wrote ${sorted.length} total stories (was ${stories.length})`)
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
