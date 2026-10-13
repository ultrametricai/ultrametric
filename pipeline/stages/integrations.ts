// Integration-graph stage: for each product, extract "integrates with <other tracked product>"
// facts FROM THE EXISTING EVIDENCE CORPUS ONLY (no new crawling) and write
// rankings/{cat}/integrations.json (see lib/integrations.ts for the schema and graph helpers).
//
// Two-step honesty design, mirroring pipeline/stages/pricing.ts's mechanics:
// 1. Exact-name prefilter (code, no LLM): scan every evidence excerpt for word-boundary,
//    case-sensitive mentions of other tracked products' names (all ~289 fleet-wide, plus a small
//    curated alias list). Only evidence items that literally contain another product's name ever
//    reach the LLM, so calls stay bounded.
// 2. LLM classification of each candidate mention: real integration vs comparison vs
//    coincidence. The model returns ONLY the real integrations, each with a verbatim excerpt.
//    Enforced in code, not just prompted:
//    - every returned (evidenceId, targetProductId) must be one of the submitted candidates —
//      the model can never invent an edge to a product no evidence mentions;
//    - the excerpt must be found verbatim (same normalization as pricing's excerptFound) inside
//      that exact evidence item's own excerpt, and must itself contain the target's name;
//    - one corrective re-prompt on the first violation, then still-unverifiable items are
//      dropped individually. The edge's arena/sourceEvidenceId are stamped by code from the
//      matcher/candidate, never typed by the model.
import path from 'node:path'
import { z } from 'zod'
import {
  IntegrationsFileSchema,
  type IntegrationEdge,
  type ProductIntegrations,
} from '../../lib/integrations'
import { EvidenceSchema, ProductSchema, type Evidence, type Product } from '../../lib/schemas'
import { llmJson } from '../llm'
import { categoryDir, readCategories, readJson, resolveCategories, writeJson } from '../paths'
import { excerptFound } from './pricing'

// Curated "obvious alias" list: alternate surface forms a vendor's docs actually use for a
// tracked product. Conservative by design — an alias must be distinctive enough that a
// word-boundary, case-sensitive hit is plausibly about the tracked product (the LLM still
// classifies every hit; this list only controls what becomes a candidate at all).
export const NAME_ALIASES: Record<string, string[]> = {
  'Bun (package manager)': ['Bun'],
  'Gram (Speakeasy)': ['Gram'],
  'QuickBooks Online': ['QuickBooks'],
  'Salesforce Sales Cloud': ['Salesforce'],
  'Vue.js': ['Vue'],
  'Plausible Analytics': ['Plausible'],
  'ElevenLabs Agents': ['ElevenLabs'],
  'LiveKit Agents': ['LiveKit'],
  'Retell AI': ['Retell'],
  'Fireworks AI': ['Fireworks'],
  'Cerebras Inference': ['Cerebras'],
  'Modal Sandboxes': ['Modal'],
  'Fireflies.ai': ['Fireflies'],
  'ROS 2': ['ROS'],
}

export interface NameMatcher {
  alias: string
  productId: string
  productName: string
  arena: string
  pattern: RegExp
}

// Word-boundary, case-sensitive matcher per name/alias. `[\w.]` on both flanks (rather than \b)
// so "Exa" never fires inside "example.com" and "Jan" never inside "January" is still caught by
// case+boundary… almost: common-word capitalized names ("Make", "Linear", "Windows") DO fire —
// that's the LLM's job to classify as coincidence, not the prefilter's job to guess.
export function aliasPattern(alias: string): RegExp {
  return new RegExp(`(?<![\\w.])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w.])`, 'g')
}

// Fleet-wide matcher list, longest alias first — so a hit on "Vercel AI Gateway" suppresses the
// nested "Vercel" hit at the same position (see findCandidateMentions). A product tracked in
// multiple arenas (e.g. Square in payments + mobile-payments) keeps its first arena in
// categories.json order as the canonical link target.
export function buildNameMatchers(
  products: Array<{ id: string; name: string; arena: string }>,
): NameMatcher[] {
  const seen = new Set<string>()
  const matchers: NameMatcher[] = []
  for (const p of products) {
    for (const alias of [p.name, ...(NAME_ALIASES[p.name] ?? [])]) {
      if (seen.has(alias)) continue
      seen.add(alias)
      matchers.push({ alias, productId: p.id, productName: p.name, arena: p.arena, pattern: aliasPattern(alias) })
    }
  }
  return matchers.sort((a, b) => b.alias.length - a.alias.length)
}

// One prefilter hit: this evidence item of `sourceProductId` literally contains
// `targetName` (via `matchedAlias`). Everything here is code-derived — the LLM only ever
// classifies these, it can't add to them.
export interface CandidateMention {
  evidenceId: string
  evidenceExcerpt: string
  targetProductId: string
  targetName: string
  targetArena: string
  matchedAlias: string
}

export function findCandidateMentions(
  sourceProductId: string,
  evidence: Evidence[],
  matchers: NameMatcher[],
): CandidateMention[] {
  const out: CandidateMention[] = []
  const seen = new Set<string>()
  for (const item of evidence) {
    // Ranges already claimed by a longer alias in this excerpt — a mention of "Claude Code"
    // must not also become a "Claude" candidate.
    const covered: Array<[number, number]> = []
    for (const m of matchers) {
      if (m.productId === sourceProductId) continue // self-mentions are not integrations
      m.pattern.lastIndex = 0
      let hit: RegExpExecArray | null
      let found = false
      while ((hit = m.pattern.exec(item.excerpt)) !== null) {
        const start = hit.index
        const end = start + hit[0].length
        if (covered.some(([s, e]) => start >= s && end <= e)) continue
        covered.push([start, end])
        found = true
      }
      if (!found) continue
      const key = `${item.id}::${m.productId}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        evidenceId: item.id,
        evidenceExcerpt: item.excerpt,
        targetProductId: m.productId,
        targetName: m.productName,
        targetArena: m.arena,
        matchedAlias: m.alias,
      })
    }
  }
  return out
}

// ---- LLM classification ----

const RawIntegrationSchema = z.object({
  evidenceId: z.string().min(1),
  targetProductId: z.string().min(1),
  excerpt: z.string().min(8).max(400),
})

export const RawIntegrationsSchema = z.object({
  integrations: RawIntegrationSchema.array().max(60),
})
export type RawIntegration = z.infer<typeof RawIntegrationSchema>
export type RawIntegrations = z.infer<typeof RawIntegrationsSchema>

const SYSTEM = `You classify CANDIDATE MENTIONS for a product-integration graph. Each candidate is an excerpt from one product's collected evidence (its own docs, GitHub, community posts) that literally contains another tracked product's name. Your job: keep ONLY the mentions that state a REAL INTEGRATION, and drop comparisons and coincidences. Every answer is checked mechanically.

A mention is a REAL INTEGRATION only when the text states the source product connects to, works with, syncs/imports/exports with, embeds, is built on, or ships a plugin/SDK/connector/built-in support for the target product as part of its functionality.

NOT an integration:
- comparison / positioning ("alternative to X", "vs X", "faster than X", "unlike X", migration marketing);
- coincidence: the name is used as an ordinary word ("make", "linear", "windows" in a generic sense) or refers to a DIFFERENT product that happens to share the name (each candidate lists the tracked target's vendor arena — if the text means something else, drop it);
- mere platform availability ("available on macOS and Windows", "runs in the browser") — OS/runtime availability alone is not a product-to-product integration (a stated integration with a platform feature, e.g. a Slack app or macOS Keychain sync, does count);
- the target's name appearing only inside a URL, package path, or code identifier with no stated relationship.

Hard rules — checked in code after you answer:
1. Return ONLY candidates from the provided list, identified by their exact evidenceId AND targetProductId. Never invent either.
2. "excerpt" must be a VERBATIM contiguous quote (8-400 chars) from THAT candidate's evidence text, containing the target product's name and the words that state the integration. No paraphrase, no stitching, no your own ellipses.
3. When several candidates state the same integration, return each one you can back verbatim (the pipeline keeps the first verified per target).
4. If NO candidate states a real integration, return {"integrations": []}.

Return JSON only: {"integrations":[{"evidenceId":"...","targetProductId":"...","excerpt":"..."}]}`

export function integrationsPrompt(product: Product, arenaName: string, candidates: CandidateMention[], extra = ''): string {
  const lines = candidates.map(
    (c, i) =>
      `${i + 1}. evidenceId: ${c.evidenceId} · targetProductId: ${c.targetProductId} (${c.targetName}, tracked in the ${c.targetArena} arena; matched as "${c.matchedAlias}")\n   evidence text: ${c.evidenceExcerpt}`,
  )
  return [
    `Source product: ${product.name} (vendor: ${product.vendor}, arena: ${arenaName})`,
    extra,
    `Candidate mentions (${candidates.length}):`,
    lines.join('\n'),
  ].filter(Boolean).join('\n\n')
}

// First rule violation for one returned integration, or null when clean. Mirrors
// pipeline/stages/pricing.ts's factViolation → corrective-re-prompt → per-item drop pattern.
export function integrationViolation(raw: RawIntegration, candidates: CandidateMention[]): string | null {
  const candidate = candidates.find(
    (c) => c.evidenceId === raw.evidenceId && c.targetProductId === raw.targetProductId,
  )
  if (!candidate) {
    return `(${raw.evidenceId}, ${raw.targetProductId}) is not one of the submitted candidates`
  }
  if (!excerptFound(raw.excerpt, candidate.evidenceExcerpt)) {
    return `excerpt is not a verbatim quote from evidence ${raw.evidenceId}: "${raw.excerpt.slice(0, 80)}"`
  }
  const aliasRe = aliasPattern(candidate.matchedAlias)
  if (!aliasRe.test(raw.excerpt)) {
    return `excerpt for ${raw.targetProductId} does not contain the matched name "${candidate.matchedAlias}": "${raw.excerpt.slice(0, 80)}"`
  }
  return null
}

export function validateIntegrations(raw: RawIntegrations, candidates: CandidateMention[]): string | null {
  for (const item of raw.integrations) {
    const violation = integrationViolation(item, candidates)
    if (violation) return violation
  }
  return null
}

// Verified raws → final edges: one edge per target product (first verified mention wins), with
// arena stamped by code from the candidate (never typed by the model), in candidate order for
// determinism.
export function buildIntegrationEdges(kept: RawIntegration[], candidates: CandidateMention[]): IntegrationEdge[] {
  const byTarget = new Map<string, IntegrationEdge>()
  for (const raw of kept) {
    if (byTarget.has(raw.targetProductId)) continue
    const candidate = candidates.find(
      (c) => c.evidenceId === raw.evidenceId && c.targetProductId === raw.targetProductId,
    )
    if (!candidate) continue
    byTarget.set(raw.targetProductId, {
      productId: candidate.targetProductId,
      arena: candidate.targetArena,
      sourceEvidenceId: candidate.evidenceId,
      excerpt: raw.excerpt,
    })
  }
  return [...byTarget.values()]
}

// Keep each classification call bounded: a product with a huge candidate list (workflow hubs
// mention dozens of tracked names) is classified in chunks.
export const MAX_CANDIDATES_PER_CALL = 40

export interface ExtractionResult {
  edges: IntegrationEdge[]
  droppedFabrications: number
}

// One product's classification: LLM → validate → one corrective re-prompt on violation → drop
// any still-unverifiable items individually → assemble edges. Pure over its inputs, so tests
// can drive it with a mocked LLM client (pipeline/llm.ts's setClientForTests).
export async function extractIntegrations(opts: {
  product: Product
  arenaName: string
  candidates: CandidateMention[]
}): Promise<ExtractionResult> {
  const edges: IntegrationEdge[] = []
  let droppedFabrications = 0
  for (let i = 0; i < opts.candidates.length; i += MAX_CANDIDATES_PER_CALL) {
    const chunk = opts.candidates.slice(i, i + MAX_CANDIDATES_PER_CALL)
    const prompt = (extra?: string) => integrationsPrompt(opts.product, opts.arenaName, chunk, extra)
    let raw = await llmJson({ schema: RawIntegrationsSchema, system: SYSTEM, prompt: prompt() })
    const violation = validateIntegrations(raw, chunk)
    if (violation) {
      raw = await llmJson({
        schema: RawIntegrationsSchema,
        system: SYSTEM,
        prompt: prompt(
          `Your previous output violated a rule: ${violation}. Correct it — drop any integration you cannot back with a verbatim quote from its own candidate's evidence text.`,
        ),
      })
    }
    const kept = raw.integrations.filter((item) => integrationViolation(item, chunk) === null)
    droppedFabrications += raw.integrations.length - kept.length
    // Cross-chunk dedupe: a target already claimed by an earlier chunk keeps its first edge.
    const seen = new Set(edges.map((e) => e.productId))
    edges.push(...buildIntegrationEdges(kept, chunk).filter((e) => !seen.has(e.productId)))
  }
  if (droppedFabrications > 0) {
    console.warn(`integrations: ${opts.product.id} dropped ${droppedFabrications} unverifiable item(s)`)
  }
  return { edges, droppedFabrications }
}

// ---- stage runner ----

function loadFleetProducts(): Array<{ id: string; name: string; arena: string }> {
  const out: Array<{ id: string; name: string; arena: string }> = []
  for (const cat of readCategories()) {
    const file = path.join(categoryDir(cat.id), 'products.json')
    let products: Product[]
    try {
      products = readJson(ProductSchema.array(), file)
    } catch {
      continue // arena not populated yet
    }
    for (const p of products) out.push({ id: p.id, name: p.name, arena: cat.id })
  }
  return out
}

// Modest parallelism across products — the work is one (occasionally two) LLM calls each.
const CONCURRENCY = 4

export async function runIntegrations({ category, product }: { category?: string; product?: string }): Promise<void> {
  const matchers = buildNameMatchers(loadFleetProducts())
  // `--category` accepts a comma-separated list, so a fleet run can be batched into a few
  // bounded invocations (every other stage takes a single id; extra ids are harmless there).
  const cats = category
    ? category.split(',').flatMap((c) => resolveCategories(c.trim()))
    : resolveCategories()
  let matched = 0
  let totalEdges = 0
  let totalDropped = 0

  for (const cat of cats) {
    const dataDir = categoryDir(cat.id)
    let products: Product[]
    try {
      products = readJson(ProductSchema.array(), path.join(dataDir, 'products.json'))
    } catch {
      continue // arena not populated yet
    }
    const targets = products.filter((p) => !product || p.id === product)
    matched += targets.length
    if (targets.length === 0) continue

    const integrationsFile = path.join(dataDir, 'integrations.json')
    // Merge into the existing file so --product re-runs only replace that product's entry.
    const existing = new Map<string, ProductIntegrations>(
      (() => {
        try { return readJson(IntegrationsFileSchema, integrationsFile) } catch { return [] }
      })().map((e) => [e.productId, e]),
    )

    const queue = [...targets]
    const run = async () => {
      for (let p = queue.shift(); p; p = queue.shift()) {
        const evidence = readJson(EvidenceSchema.array(), path.join(dataDir, 'evidence', `${p.id}.json`))
        const candidates = findCandidateMentions(p.id, evidence, matchers)
        if (candidates.length === 0) {
          existing.delete(p.id)
          continue
        }
        const { edges, droppedFabrications } = await extractIntegrations({ product: p, arenaName: cat.name, candidates })
        totalDropped += droppedFabrications
        totalEdges += edges.length
        if (edges.length === 0) existing.delete(p.id)
        else existing.set(p.id, { productId: p.id, integratesWith: edges })
        console.log(
          `integrations: ${cat.id}/${p.id} → ${candidates.length} candidate(s), ${edges.length} verified edge(s)${
            edges.length ? `: ${edges.map((e) => e.productId).slice(0, 6).join(', ')}` : ''
          }`,
        )
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, run))

    // Keep only entries for products that still exist, in products.json order.
    const ordered = products.flatMap((p) => existing.get(p.id) ?? [])
    writeJson(integrationsFile, IntegrationsFileSchema.parse(ordered))
  }
  if (product && matched === 0) throw new Error(`unknown product: ${product}`)
  console.log(`integrations: done — ${totalEdges} directed edge(s) written, ${totalDropped} unverifiable item(s) dropped`)
}
