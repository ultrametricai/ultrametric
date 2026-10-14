import path from 'node:path'
import { z } from 'zod'
import {
  type Claim, ClaimsArraySchema, type Evidence, EvidenceSchema, ProductSchema, type Story, StorySchema,
} from '../../lib/schemas'
import { llmJson } from '../llm'
import { categoryDir, readJson, resolveCategories, writeJson } from '../paths'

const RawClaimSchema = z.object({
  text: z.string().min(1).max(160),
  evidenceId: z.string().min(1),
  storyIds: z.array(z.string().min(1)),
})

// The LLM only ever picks WHICH evidence item backs a claim and how to phrase it in plain
// words — it never invents the quote/url/tier itself. buildClaims below copies those verbatim
// from the cited evidence item, so every claim is traceable byte-for-byte to real evidence
// (see lib/schemas.ts's ClaimSchema doc comment).
const RawClaimsSchema = z.object({ claims: z.array(RawClaimSchema).min(0).max(60) })
type RawClaims = z.infer<typeof RawClaimsSchema>

const SYSTEM = `You extract every distinct capability CLAIM a product's own vendor materials make — what the vendor says the product can do, not whether it's actually true (a separate judging pass handles that).
You'll be given an evidence pack: each item is already a short verbatim quote pulled from the product's own claimed-docs or github materials, tagged with an id. Several items may describe the same underlying capability (e.g. worded differently on two doc pages) — merge those into ONE claim, citing whichever single item's quote most directly and specifically supports it. Do not invent capabilities the evidence doesn't state.
For each distinct capability claim, return:
- "text": a short plain-words restatement of the capability (<=160 chars, not a verbatim quote, no surrounding quote marks)
- "evidenceId": the id (from the pack) of the single evidence item whose quote backs this claim
- "storyIds": ids from the story taxonomy below whose capability this claim satisfies — usually zero or one, occasionally more. Leave EMPTY if no story in the list covers this claim; that's a real taxonomy gap and must be kept, not forced onto the nearest-but-wrong story.
Return at most 60 claims total. If there are more distinct capabilities than that, keep only the most substantive and specific ones (skip generic marketing fluff like "easy to use" or "powerful").
Return JSON: {"claims":[{"text":"...","evidenceId":"...","storyIds":["..."]}]}`

function claimsPrompt(productName: string, evidence: Evidence[], stories: Story[], extra = ''): string {
  const pack = evidence.map((e) => `[${e.id}] (${e.tier}) ${e.excerpt}`).join('\n')
  const storyList = stories.map((s) => `${s.id}: ${s.title}`).join('\n')
  return `Product: ${productName}\n\nEvidence pack (claimed-docs + github only):\n${pack}\n\nStory taxonomy:\n${storyList}\n${extra}`
}

export function validateClaimRules(raw: RawClaims, byId: Map<string, Evidence>, storyIds: Set<string>): string | null {
  for (const c of raw.claims) {
    if (!byId.has(c.evidenceId)) return `claim cites unknown evidence id "${c.evidenceId}"`
    for (const sid of c.storyIds) {
      if (!storyIds.has(sid)) return `claim cites unknown story id "${sid}"`
    }
  }
  return null
}

// Assembles final Claim objects: quote/url/sourceTier are always copied verbatim from the cited
// evidence item — never re-typed by the LLM — so every claim is byte-for-byte traceable to real
// evidence. Ids are sequential per product (`{productId}-claim-{n}`), 1-indexed in output order.
export function buildClaims(
  productId: string,
  raw: RawClaims,
  byId: Map<string, Evidence>,
  extractedAt: string,
): Claim[] {
  return raw.claims.map((c, i) => {
    const evidence = byId.get(c.evidenceId)!
    return {
      id: `${productId}-claim-${i + 1}`,
      text: c.text,
      quote: evidence.excerpt.length > 240 ? evidence.excerpt.slice(0, 240) : evidence.excerpt,
      url: evidence.url,
      sourceTier: evidence.tier as 'claimed-docs' | 'github',
      storyIds: c.storyIds,
      extractedAt,
    }
  })
}

// Claims are derived purely from a product's own claimed-docs/github evidence (monotonic —
// extract only ever adds to that pack, see pipeline/stages/extract.ts), so unlike judge's
// per-cell cache this stage is a plain idempotent full-replace: every run recomputes the whole
// claims file for a product from its current evidence pack, no staleness bookkeeping needed.
export async function runClaims({ category, product }: { category?: string; product?: string }): Promise<void> {
  let matched = 0
  for (const cat of resolveCategories(category)) {
    const dataDir = categoryDir(cat.id)
    const products = readJson(ProductSchema.array(), path.join(dataDir, 'products.json'))
    const stories = readJson(StorySchema.array(), path.join(dataDir, 'stories.json'))
    const storyIds = new Set(stories.map((s) => s.id))
    const targets = products.filter((p) => !product || p.id === product)
    matched += targets.length

    for (const p of targets) {
      const evidence = readJson(EvidenceSchema.array(), path.join(dataDir, 'evidence', `${p.id}.json`)).filter(
        (e) => e.tier === 'claimed-docs' || e.tier === 'github',
      )
      const byId = new Map(evidence.map((e) => [e.id, e]))
      const extractedAt = new Date().toISOString()

      let claims: Claim[]
      if (evidence.length === 0) {
        claims = []
      } else {
        let raw = await llmJson({ schema: RawClaimsSchema, system: SYSTEM, prompt: claimsPrompt(p.name, evidence, stories) })
        let violation = validateClaimRules(raw, byId, storyIds)
        if (violation) {
          raw = await llmJson({
            schema: RawClaimsSchema,
            system: SYSTEM,
            prompt: claimsPrompt(p.name, evidence, stories, `\nYour previous output violated a rule: ${violation}. Correct it.`),
          })
          violation = validateClaimRules(raw, byId, storyIds)
          if (violation) throw new Error(`claims: ${cat.id}/${p.id} still violates rules: ${violation}`)
        }
        claims = buildClaims(p.id, raw, byId, extractedAt)
      }

      const validated = ClaimsArraySchema.parse(claims)
      writeJson(path.join(dataDir, 'claims', `${p.id}.json`), validated)
      const mapped = validated.filter((c) => c.storyIds.length > 0).length
      console.log(`claims: ${cat.id}/${p.id} → ${validated.length} claims (${mapped} mapped, ${validated.length - mapped} taxonomy gaps)`)
    }
  }
  if (product && matched === 0) throw new Error(`unknown product: ${product}`)
}
