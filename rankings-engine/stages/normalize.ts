import fs from 'node:fs'
import path from 'node:path'
import { type Story, StorySchema } from '../../lib/schemas'
import {
  AGENTIC_FEATURE_STORIES,
  AGENTIC_STORIES,
  API_QUALITY_STORIES,
  AUTOMATION_STORIES,
  OPENNESS_STORIES,
  PRIVACY_STORIES,
} from '../agentic-stories'
import { llmJson } from '../llm'
import { CACHE_DIR, categoryDir, resolveCategories, writeJson } from '../paths'
import { PROMPT_VERSION } from './judge'

// Canonical lens themes injected verbatim below — kept out of the LLM-facing theme list
// (categories.json's `themes`) so the model never authors competing stories for them, but
// filtered here too as a belt-and-suspenders guard against theme/id collisions.
const CANON_THEMES = new Set(['agenticness', 'openness', 'automation-depth', 'privacy-posture'])
const CANON_ID_PREFIXES = ['agentic-', 'api-', 'openness-', 'automation-', 'privacy-']

// Pure post-processing of the LLM's candidate taxonomy: drops any LLM-authored story that
// duplicates a canonical lens (by theme or id prefix), appends the canon verbatim, dedupes ids
// (throwing on collision), and sorts theme → group → id for stable diffs.
//
// Stamps `origin` provenance on every story: LLM-authored survivors get {kind:'normalized',
// promptVersion, recordedAt}, canonical lens injections get {kind:'canonical', recordedAt}.
// `origin` is never part of cellHash (judge.ts) so this can't affect judge caching.
export function assembleTaxonomy(llmStories: Story[], recordedAt: string = new Date().toISOString()): Story[] {
  const filtered = llmStories
    .filter((s) => !CANON_THEMES.has(s.theme) && !CANON_ID_PREFIXES.some((prefix) => s.id.startsWith(prefix)))
    .map((s) => ({ ...s, origin: { kind: 'normalized' as const, promptVersion: PROMPT_VERSION, recordedAt } }))
  const canon = [
    ...AGENTIC_STORIES,
    ...AGENTIC_FEATURE_STORIES,
    ...API_QUALITY_STORIES,
    ...OPENNESS_STORIES,
    ...AUTOMATION_STORIES,
    ...PRIVACY_STORIES,
  ].map((s) => ({ ...s, origin: { kind: 'canonical' as const, recordedAt } }))
  const combined = [...filtered, ...canon]

  const ids = new Set<string>()
  for (const s of combined) {
    if (ids.has(s.id)) throw new Error(`normalize: duplicate story id "${s.id}"`)
    ids.add(s.id)
  }

  return combined.sort(
    (a, b) => a.theme.localeCompare(b.theme) || a.group.localeCompare(b.group) || a.id.localeCompare(b.id),
  )
}

function systemPrompt(categoryName: string, personas: string[], themes: string[]): string {
  return `You design a canonical user-story taxonomy for comparing products in the "${categoryName}" category.
Input: candidate user stories extracted from several competing products' own materials.
Output: 25-52 canonical stories that TOGETHER cover what all products claim, with duplicates merged and product-specific phrasing neutralized. Every story must be judgeable for ANY product in the category (never mention a product name).
Cluster stories into kebab-case \`group\`s under themes. Be granular — one capability per story (e.g. separate stories for TOTP-app 2FA vs hardware-key 2FA).
You MUST include at least 3 stories with persona "ai-native" describing AI-driven capabilities within this category's own domain (e.g. AI automating a core in-app task for that persona) — beyond generic agent-access and API quality, which are canonical and injected separately: DO NOT write stories about public APIs, official CLIs, MCP servers, webhooks, SDKs, agent-oriented docs, interactive API references, machine-readable API specs, API versioning/deprecation policy, or sandbox environments, and do not write agentic-access or api-quality stories.
Personas must be drawn from: ${personas.join(', ')}.
Fields: id (kebab-case, stable, descriptive), persona (one of the personas above), title ("As a <persona>, I can <specific capability>"), theme (one of: ${themes.join(', ')}), group (kebab-case cluster id under the theme), weight (3 = core daily-driver need, 2 = important, 1 = nice-to-have).
Return JSON: array of story objects.`
}

export async function runNormalize({ category }: { category?: string; product?: string }): Promise<void> {
  if (!category) {
    throw new Error('usage: pnpm pipeline normalize --category <id>')
  }
  const [cat] = resolveCategories(category)
  const dataDir = categoryDir(cat.id)

  const verdictsPath = path.join(dataDir, 'verdicts.json')
  if (fs.existsSync(verdictsPath) && (process.env.UM_FORCE_NORMALIZE ?? process.env.PA_FORCE_NORMALIZE) !== '1') {
    const verdicts = JSON.parse(fs.readFileSync(verdictsPath, 'utf8')) as { rationale?: string }[]
    const allSample = Array.isArray(verdicts) && verdicts.every((v) => typeof v.rationale === 'string' && v.rationale.includes('SAMPLE:'))
    if (!allSample) {
      throw new Error(
        `normalize: real verdicts exist for ${cat.id} and would be invalidated. Re-run with UM_FORCE_NORMALIZE=1, then re-run judge for all products in this category.`,
      )
    }
  }

  const extractDir = path.join(CACHE_DIR, 'extract', cat.id)
  if (!fs.existsSync(extractDir)) throw new Error(`normalize: no extract caches for ${cat.id} — run extract first`)
  const inputs = fs.readdirSync(extractDir).map((f) => {
    const productId = f.replace(/\.json$/, '')
    const candidates = JSON.parse(fs.readFileSync(path.join(extractDir, f), 'utf8')) as { persona: string; title: string }[]
    return `## ${productId}\n${candidates.map((c) => `- (${c.persona}) ${c.title}`).join('\n')}`
  })
  if (inputs.length < 2) throw new Error(`normalize: need extracts from at least 2 products for ${cat.id}`)

  const themes = cat.themes ?? []
  const llmStories = await llmJson({
    schema: StorySchema.array().min(25).max(52),
    system: systemPrompt(cat.name, cat.personas, themes),
    prompt: `Category: ${cat.name}.\n\nCandidate stories by product:\n\n${inputs.join('\n\n')}`,
    maxTokens: 12288,
  })

  const assembled = assembleTaxonomy(llmStories)
  // Ceiling raised 64→76→80 to make room for the canonical lens stories injected by
  // assembleTaxonomy above: 13 agenticness (agent-access + agentic-features + api-quality),
  // plus 4 each of openness, automation-depth, and privacy-posture — 29 canonical total.
  const stories = StorySchema.array().min(30).max(80).parse(assembled)
  writeJson(path.join(dataDir, 'stories.json'), stories)
  console.log(`normalize: wrote ${stories.length} canonical stories for ${cat.id}`)
}
