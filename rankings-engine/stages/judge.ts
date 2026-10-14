import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {
  type Evidence, EvidenceSchema, ProductSchema, type Story, StorySchema,
  type Verdict, VerdictBaseSchema, VerdictSchema,
} from '../../lib/schemas'
import { JUDGE_MODEL, llmJson } from '../llm'
import { CACHE_DIR, categoryDir, readJson, resolveCategories, writeJson } from '../paths'

// v4 (2026-09-30): the prompt TEXT is unchanged from v3 — the bump marks the judge model
// migration sonnet-5 → claude-opus-5-5 (docs/OPUS-5-5-JUDGE-PILOT.md, adopted). From v4 on the
// judge model id is also folded into the cellHash payload below, so any future model change is
// a first-class cache invalidator instead of silently keeping the previous model's verdicts.
export const PROMPT_VERSION = 'v4'

export function cellHash(story: Story, evidence: Evidence[], promptVersion: string, judgeModel: string = JUDGE_MODEL): string {
  const payload = JSON.stringify({
    storyId: story.id,
    title: story.title,
    evidence: evidence.map((e) => [e.id, e.excerpt]),
    promptVersion,
    // Added with v4 — see the PROMPT_VERSION note. Pre-v4 hashes were computed without this key.
    judgeModel,
  })
  return crypto.createHash('sha256').update(payload).digest('hex')
}

export function validateVerdictRules(verdict: Verdict, evidence: Evidence[]): string | null {
  const known = new Map(evidence.map((e) => [e.id, e]))
  for (const id of verdict.evidenceIds) {
    if (!known.has(id)) return `cites unknown evidence id "${id}"`
  }
  if (verdict.verdict !== 'none' && verdict.verdict !== 'na' && verdict.evidenceIds.length === 0) {
    return 'non-none verdict must cite evidence'
  }
  if (verdict.verdict === 'disputed') {
    const tiers = new Set(verdict.evidenceIds.map((id) => known.get(id)!.tier))
    if (tiers.size < 2) return 'disputed requires citations from at least two distinct tiers'
  }
  if ((verdict.verdict === 'none' || verdict.verdict === 'na') && verdict.quality !== 0) {
    return `${verdict.verdict} verdicts must have quality 0`
  }
  if (
    (verdict.verdict === 'full' || verdict.verdict === 'partial')
    && verdict.quality < 10
    && !/missing for (a )?10/i.test(verdict.rationale)
  ) {
    return 'quality below 10 must name the gap — the rationale must include "missing for 10: ..." listing the specific missing capabilities/evidence'
  }
  return null
}

// Exported so other consumers that need to re-run the EXACT judge prompt against current
// evidence (pipeline/scripts/calibration-check.ts, pipeline/scripts/uncertainty-pass.ts) do so
// verbatim rather than risking prompt drift from a hand-copied duplicate.
export const RawVerdictSchema = VerdictBaseSchema.omit({ productId: true, storyId: true })

export const SYSTEM = `You are the judge in a head-to-head product-comparison arena. Given ONE user story and ONE product's evidence pack, decide how well the product delivers that story.
Verdicts: "full" (clearly delivers), "partial" (delivers with significant caveats/extra tools), "none" (the axis applies but no evidence it delivers), "disputed" (vendor claims it but community/hands-on evidence CONCRETELY contradicts — requires citing both sides), "na" (the story's axis does not apply to this product at all).
"disputed" requires concrete contradicting evidence: a hands-on failure, a specific documented counter-example, or an independent report that the capability does not work as claimed. General community skepticism, worry, or open questions ("do people really trust this?", "is it really secure?") do NOT create a dispute — reflect them in confidence (and at most quality), never by downgrading a documented capability from full/partial to disputed.

## na vs none — decide in this exact order
1. Set the evidence pack aside. Ask: is this story a fair question for this KIND of product — could a product of this type conceivably ship this capability, such that a buyer comparing products of this kind might reasonably ask it?
2. If the question itself is a category error for this product's type (wrong axis), the verdict is "na" — regardless of what the evidence says about anything else.
3. Otherwise the axis APPLIES, and the verdict must be full/partial/disputed/none based on the evidence. Lack of evidence for an applicable capability is ALWAYS "none", never "na". A product that fails or does the opposite of an applicable axis is "none" (or "disputed"), never "na".
4. Exception to step 2: if the evidence shows the product actually ships the supposedly wrong-axis capability, the axis applies after all — judge that capability on its merits.
Both "none" and "na" must have quality 0.

Boundary examples:
- Story "commit and push code" for a VPN/network-connectivity tool → "na". Source control is entirely outside its product category — wrong axis, not "none".
- Story "connect an agent via an official MCP server" for a product that is ITSELF a coding agent/assistant → "na" (an agent is the MCP client role; serving tools to other agents is a different product role). Evidence that it can CONNECT TO or PLUG IN MCP servers is client-side and belongs to the separate MCP-client story — it does NOT make this server axis applicable and must never be credited here. The ONLY thing that flips this to applicable is explicit evidence the agent itself runs as an MCP server (e.g. a documented "mcp serve" subcommand or a first-party hosted MCP endpoint) — then judge that server mode normally ("full", or "partial" if deprecated/experimental). This "na" is specific to the agent role: for a product that is NOT itself an agent (a SaaS service, framework, platform, or tool with an official ecosystem), publishing an official MCP server is plausible, so the axis APPLIES and absence of one in evidence is "none", not "na".
- Story "official CLI for AI-native workflows" for a UI framework whose evidence never mentions one → "none", not "na". A framework's ecosystem could ship such a CLI; absence of evidence for an applicable capability is "none".
- Story "renders without virtual-DOM overhead" for a framework that explicitly uses a virtual DOM → "none", not "na". Rendering strategy is a fair axis for any UI framework; an applicable-but-failed axis is "none".

## Quality rubric (applies to full/partial/disputed; always 0 for none/na)
- 10: best-in-class — every element of the story as written is covered by strong evidence (in-depth first-party docs AND independent or hands-on corroboration); nothing material is missing.
- 9: fully delivers with rich documentation; exactly one minor gap (e.g. no independent corroboration, or one small edge of the story unevidenced).
- 7: clearly delivers the core of the story, but with real secondary gaps — parts of the story thin, undocumented, or only implied.
- 5: delivers roughly half the story, or delivers it only with substantial limitations/workarounds.
- 3: minimal, glancing support — a single thin mention; most of the story unevidenced.
- 1-2: barely counts.
REQUIREMENT: whenever quality is below 10, the rationale MUST name what is missing using the exact phrase "missing for 10: X, Y" — listing the specific missing capabilities or missing evidence. Never write that the product "fully supports" or "comprehensively delivers" the story while scoring below 10 unless the named gap explains the deduction.

## Evidence-relevance rule
A citation may only support or undermine a verdict if its content is ABOUT the story's subject. Off-topic material — general negative sentiment, unrelated security news, pricing complaints, criticism of other features — must be ignored entirely: it must not move the verdict or quality, must not appear in evidenceIds, and must not be mentioned in the rationale. Example: a news item about a vendor leaking its own source code says NOTHING about whether the product offers sandboxed execution — ignore it when judging a sandboxing story.

## Output
quality: 0-10 per the rubric (0 if none or na). confidence: high/medium/low based on evidence strength. rationale: 1-3 sentences (plus the required "missing for 10: ..." clause when quality < 10). evidenceIds: cite the specific items you relied on (empty only for "none" or "na").
Judge ONLY from the evidence pack. Absence of evidence for a mainstream capability of a well-known product may still only ever yield "none" — do not use outside knowledge.
Return JSON: {"verdict":"...","quality":N,"confidence":"...","rationale":"...","evidenceIds":["..."]}`

export function judgePrompt(productName: string, story: Story, evidence: Evidence[], extra = ''): string {
  const pack = evidence
    .map((e) => `[${e.id}] (${e.tier}) ${e.excerpt} — ${e.url}`)
    .join('\n')
  return `Product: ${productName}\n\nUser story: ${story.title}\n(persona: ${story.persona}, theme: ${story.theme})\n\nEvidence pack:\n${pack}\n${extra}`
}

export async function runJudge({ category, product }: { category?: string; product?: string }): Promise<void> {
  let matched = 0
  for (const cat of resolveCategories(category)) {
    const dataDir = categoryDir(cat.id)
    const products = readJson(ProductSchema.array(), path.join(dataDir, 'products.json'))
    const stories = readJson(StorySchema.array(), path.join(dataDir, 'stories.json'))
    const targets = products.filter((p) => !product || p.id === product)
    matched += targets.length

    for (const p of targets) {
      const evidence = readJson(EvidenceSchema.array(), path.join(dataDir, 'evidence', `${p.id}.json`))
      for (const story of stories) {
        const cacheFile = path.join(CACHE_DIR, 'judge', cat.id, p.id, `${story.id}.json`)
        const hash = cellHash(story, evidence, PROMPT_VERSION)
        if (fs.existsSync(cacheFile)) {
          const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { hash: string }
          if (cached.hash === hash) continue
        }

        let raw = await llmJson({ schema: RawVerdictSchema, system: SYSTEM, prompt: judgePrompt(p.name, story, evidence) })
        let verdict: Verdict = { ...raw, productId: p.id, storyId: story.id }
        let violation = validateVerdictRules(verdict, evidence)
        // Up to three correction rounds — one round proved brittle at fleet scale (a model that
        // phrases the rubric clause loosely once tends to comply on the next explicit ask).
        for (let round = 0; violation && round < 3; round++) {
          raw = await llmJson({
            schema: RawVerdictSchema,
            system: SYSTEM,
            prompt: judgePrompt(p.name, story, evidence, `\nYour previous verdict violated a rule: ${violation}. Correct it. If quality is below 10, the rationale MUST contain the literal phrase "missing for 10:" followed by the specific gaps.`),
          })
          verdict = { ...raw, productId: p.id, storyId: story.id }
          violation = validateVerdictRules(verdict, evidence)
        }
        if (violation) throw new Error(`judge: ${cat.id}/${p.id}:${story.id} still violates rules: ${violation}`)
        writeJson(cacheFile, { hash, verdict })
        console.log(`judge: ${cat.id}/${p.id}:${story.id} → ${verdict.verdict} q${verdict.quality}`)
      }
    }

    // Assemble verdicts.json from ALL cached cells for this category (not just targets)
    const all: Verdict[] = []
    let incomplete = false
    for (const p of products) {
      const currentEvidence = readJson(EvidenceSchema.array(), path.join(dataDir, 'evidence', `${p.id}.json`))
      for (const story of stories) {
        const cacheFile = path.join(CACHE_DIR, 'judge', cat.id, p.id, `${story.id}.json`)
        if (!fs.existsSync(cacheFile)) {
          console.warn(`judge: matrix incomplete for ${cat.id} — missing ${p.id}:${story.id}; not writing verdicts.json`)
          incomplete = true
          break
        }
        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { hash: string; verdict: unknown }
        const currentHash = cellHash(story, currentEvidence, PROMPT_VERSION)
        if (cached.hash !== currentHash) {
          throw new Error(`judge: stale cached verdict for ${cat.id}/${p.id}:${story.id} — evidence changed; re-run judge --category ${cat.id} --product ${p.id}`)
        }
        all.push(VerdictSchema.parse(cached.verdict))
      }
      if (incomplete) break
    }
    if (incomplete) continue

    all.sort((x, y) => x.productId.localeCompare(y.productId) || x.storyId.localeCompare(y.storyId))
    writeJson(path.join(dataDir, 'verdicts.json'), all)
    console.log(`judge: wrote ${all.length} verdicts for ${cat.id}`)
  }
  if (product && matched === 0) throw new Error(`unknown product: ${product}`)
}
