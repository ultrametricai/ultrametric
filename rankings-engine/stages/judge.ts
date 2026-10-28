import type Anthropic from '@anthropic-ai/sdk'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { z } from 'zod'
import {
  type Evidence, EvidenceSchema, ProductSchema, type Story, StorySchema,
  type Verdict, VerdictBaseSchema, VerdictSchema,
} from '../../lib/schemas'
import { clearBatchState, runMessageBatches } from '../batch-llm'
import { DEFAULT_MAX_TOKENS, extractJson, JUDGE_MODEL, llmJson } from '../llm'
import { CACHE_DIR, categoryDir, readJson, resolveCategories, writeJson } from '../paths'

// v5 (2026-10-19): adds the founder-ratified partial-credit boundary to the prompt — partial
// requires the product's OWN documented capability for the story being judged; user-side
// workarounds, host-platform capabilities, developer building blocks, adjacent controls, and
// claims mapped from a different story earn no credit, and a webhooks story requires
// registrable outbound HTTP callbacks. Bumping this constant is the designed invalidation
// path: every cached verdict misses cleanly and re-judges under the new rubric on its next
// judge touch. (v4, 2026-09-30, marked the sonnet-5 → claude-opus-5-5 judge-model migration;
// from v4 on the judge model id is folded into the cellHash payload below, so any future
// model change is a first-class cache invalidator instead of silently keeping the previous
// model's verdicts.)
export const PROMPT_VERSION = 'v5'

// Versions the hashed material itself, independent of prompt/model changes: bumping it makes
// every cache entry written under an older key format miss cleanly (and re-judge) instead of
// mismatching against a payload it was never computed over. v2 (2026-10-19) folded each
// evidence item's tier and url into the hash — both reach the judge prompt (judgePrompt's
// pack line), so a tier- or url-only evidence correction must invalidate the cached verdict
// rather than silently reuse it. Committed pre-v2 cache files stay untouched on disk; they
// simply stop matching.
export const CELL_HASH_VERSION = 'v2'

export function cellHash(story: Story, evidence: Evidence[], promptVersion: string, judgeModel: string = JUDGE_MODEL): string {
  const payload = JSON.stringify({
    keyVersion: CELL_HASH_VERSION,
    storyId: story.id,
    title: story.title,
    // Everything about an evidence item that reaches the prompt: id, tier, url, excerpt.
    evidence: evidence.map((e) => [e.id, e.tier, e.url, e.excerpt]),
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
// evidence (rankings-engine/scripts/calibration-check.ts, rankings-engine/scripts/uncertainty-pass.ts) do so
// verbatim rather than risking prompt drift from a hand-copied duplicate.
export const RawVerdictSchema = VerdictBaseSchema.omit({ productId: true, storyId: true })

export const SYSTEM = `You are the judge in a head-to-head product-comparison arena. Given ONE user story and ONE product's evidence pack, decide how well the product delivers that story.
Verdicts: "full" (clearly delivers), "partial" (delivers with significant caveats/extra tools), "none" (the axis applies but no evidence it delivers), "disputed" (vendor claims it but community/hands-on evidence CONCRETELY contradicts — requires citing both sides), "na" (the story's axis does not apply to this product at all).
"disputed" requires concrete contradicting evidence: a hands-on failure, a specific documented counter-example, or an independent report that the capability does not work as claimed. General community skepticism, worry, or open questions ("do people really trust this?", "is it really secure?") do NOT create a dispute — reflect them in confidence (and at most quality), never by downgrading a documented capability from full/partial to disputed.

## Partial-credit boundary
"partial" requires the product's OWN documented capability for THIS story, with only its depth or extent unproven. The following earn NO credit toward the story — alone they leave the verdict at "none":
- User-side workarounds: a user's external tools or manual arrangements that approximate the capability.
- Host-platform capabilities: features of the platform the product runs on, not of the product itself.
- Developer building blocks: primitives a developer could use to CONSTRUCT the capability, as opposed to the capability itself.
- Adjacent controls or features: a related-but-different switch or behavior.
- Claims mapped from a different story: evidence about another story's capability does not transfer to this one.
A webhooks story requires documented, registrable outbound HTTP callbacks that a programmatic consumer can receive. Chat-app notifications (Slack/Discord integrations) do NOT qualify.

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

export type RawVerdict = z.infer<typeof RawVerdictSchema>

// One cache-miss (product, story) cell, carrying everything both transports need: the
// prompt inputs, the cache key, and where the verdict lands.
export interface JudgeCell {
  catId: string
  productId: string
  productName: string
  story: Story
  evidence: Evidence[]
  hash: string
  cacheFile: string
}

// Judges one cell to a rule-clean verdict. `initialRaw` is the batch transport's
// already-parsed first verdict; when absent the first verdict is fetched interactively.
// Either way, rule violations go through the same interactive correction rounds — up to
// three, because one round proved brittle at fleet scale (a model that phrases the
// rubric clause loosely once tends to comply on the next explicit ask).
export async function resolveCellVerdict(cell: JudgeCell, initialRaw?: RawVerdict): Promise<Verdict> {
  let raw = initialRaw
    ?? await llmJson({ schema: RawVerdictSchema, system: SYSTEM, prompt: judgePrompt(cell.productName, cell.story, cell.evidence) })
  let verdict: Verdict = { ...raw, productId: cell.productId, storyId: cell.story.id }
  let violation = validateVerdictRules(verdict, cell.evidence)
  for (let round = 0; violation && round < 3; round++) {
    raw = await llmJson({
      schema: RawVerdictSchema,
      system: SYSTEM,
      prompt: judgePrompt(cell.productName, cell.story, cell.evidence, `\nYour previous verdict violated a rule: ${violation}. Correct it. If quality is below 10, the rationale MUST contain the literal phrase "missing for 10:" followed by the specific gaps.`),
    })
    verdict = { ...raw, productId: cell.productId, storyId: cell.story.id }
    violation = validateVerdictRules(verdict, cell.evidence)
  }
  if (violation) throw new Error(`judge: ${cell.catId}/${cell.productId}:${cell.story.id} still violates rules: ${violation}`)
  return verdict
}

function writeCellCache(cell: JudgeCell, verdict: Verdict): void {
  writeJson(cell.cacheFile, { hash: cell.hash, keyVersion: CELL_HASH_VERSION, verdict })
  console.log(`judge: ${cell.catId}/${cell.productId}:${cell.story.id} → ${verdict.verdict} q${verdict.quality}`)
}

// The batch request for a cell is byte-for-byte the interactive first attempt — same
// model, output cap, system prompt, and single-user-message shape. Only the transport
// (and the per-token price) differs.
export function cellBatchParams(cell: JudgeCell): Anthropic.Messages.MessageCreateParamsNonStreaming {
  return {
    model: JUDGE_MODEL,
    max_tokens: DEFAULT_MAX_TOKENS,
    system: SYSTEM,
    messages: [{ role: 'user', content: judgePrompt(cell.productName, cell.story, cell.evidence) }],
  }
}

// Parses a batch-completed Message with the same mechanics llmJson applies to an
// interactive response: truncation is a failure, text blocks are joined, extractJson
// recovers the object, and the raw verdict must validate against RawVerdictSchema.
// Returns undefined on any miss — the cell then falls back to the interactive path.
export function parseBatchVerdict(message: Anthropic.Message): RawVerdict | undefined {
  if (message.stop_reason === 'max_tokens') return undefined
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
  const json = extractJson(text)
  if (json === undefined) return undefined
  const parsed = RawVerdictSchema.safeParse(json)
  return parsed.success ? parsed.data : undefined
}

// The batch custom_id folds the cell's identity (category, product, story) into the
// cellHash. The hash alone is not enough: two products with identical evidence packs
// share a cellHash, and a resumed run whose first cell was already cached would
// otherwise apply the stored response — judged under the other product's name — to the
// wrong product. Stable across runs, so a resumed poll still matches its stored batch,
// and re-keyed whenever the hash changes, so stale stored results never apply.
export function batchCustomId(cell: JudgeCell): string {
  return crypto.createHash('sha256').update(`${cell.catId}/${cell.productId}/${cell.story.id}:${cell.hash}`).digest('hex')
}

// Fetches first verdicts for the given cells through the Message Batches API (half the
// interactive per-token price), keyed by batchCustomId. Cells the batch fails,
// truncates, or returns unparseable are absent from the map and fall back to the
// interactive path in judgeCells, so a batch run converges on exactly the cells an
// interactive run would have written.
export async function batchPrefillVerdicts(cells: JudgeCell[], stateFile: string): Promise<Map<string, RawVerdict>> {
  const prefilled = new Map<string, RawVerdict>()
  if (cells.length === 0) return prefilled
  const byId = new Map<string, JudgeCell>(cells.map((cell) => [batchCustomId(cell), cell]))
  const requests = [...byId].map(([custom_id, cell]) => ({ custom_id, params: cellBatchParams(cell) }))
  const results = await runMessageBatches({ requests, stateFile })
  for (const [id, result] of results) {
    const cell = byId.get(id)!
    if (result.type !== 'succeeded') {
      console.warn(`judge: batch cell ${cell.catId}/${cell.productId}:${cell.story.id} ${result.type}${result.reason ? ` (${result.reason})` : ''} — falling back to interactive`)
      continue
    }
    const raw = parseBatchVerdict(result.message)
    if (raw === undefined) {
      console.warn(`judge: batch cell ${cell.catId}/${cell.productId}:${cell.story.id} returned no valid verdict JSON — falling back to interactive`)
      continue
    }
    prefilled.set(id, raw)
  }
  return prefilled
}

// Judges every cell and writes it through the single cache-write path. `prefilled`
// carries the batch transport's first verdicts, keyed by batchCustomId; cells without
// one run interactively, which is also the default transport when `prefilled` is absent.
export async function judgeCells(cells: JudgeCell[], prefilled?: Map<string, RawVerdict>): Promise<void> {
  for (const cell of cells) {
    const verdict = await resolveCellVerdict(cell, prefilled?.get(batchCustomId(cell)))
    writeCellCache(cell, verdict)
  }
}

export async function runJudge({ category, product, batch }: { category?: string; product?: string; batch?: boolean }): Promise<void> {
  let matched = 0
  const cats = resolveCategories(category)

  // Collect every cache-miss cell across the run's scope first, so batch mode can submit
  // them as one message batch; the interactive default judges the same cells in order.
  const cellsByCat = new Map<string, JudgeCell[]>()
  for (const cat of cats) {
    const dataDir = categoryDir(cat.id)
    const products = readJson(ProductSchema.array(), path.join(dataDir, 'products.json'))
    const stories = readJson(StorySchema.array(), path.join(dataDir, 'stories.json'))
    const targets = products.filter((p) => !product || p.id === product)
    matched += targets.length

    const cells: JudgeCell[] = []
    for (const p of targets) {
      const evidence = readJson(EvidenceSchema.array(), path.join(dataDir, 'evidence', `${p.id}.json`))
      for (const story of stories) {
        const cacheFile = path.join(CACHE_DIR, 'judge', cat.id, p.id, `${story.id}.json`)
        const hash = cellHash(story, evidence, PROMPT_VERSION)
        if (fs.existsSync(cacheFile)) {
          const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { hash: string; keyVersion?: string }
          // An entry written under an older key format (no/other keyVersion) is a clean miss.
          if (cached.keyVersion === CELL_HASH_VERSION && cached.hash === hash) continue
        }
        cells.push({ catId: cat.id, productId: p.id, productName: p.name, story, evidence, hash, cacheFile })
      }
    }
    cellsByCat.set(cat.id, cells)
  }

  // One state file per (category, product) scope: a re-run of the same interrupted
  // invocation resumes its in-flight batches instead of resubmitting.
  const stateFile = path.join(CACHE_DIR, 'judge-batches', `${category ?? 'all'}--${product ?? 'all'}.json`)
  const prefilled = batch
    ? await batchPrefillVerdicts([...cellsByCat.values()].flat(), stateFile)
    : undefined

  for (const cat of cats) {
    // Judge, then assemble, one category at a time: a failure in a later category must
    // not cost an earlier, fully judged category its verdicts.json update.
    await judgeCells(cellsByCat.get(cat.id) ?? [], prefilled)

    const dataDir = categoryDir(cat.id)
    const products = readJson(ProductSchema.array(), path.join(dataDir, 'products.json'))
    const stories = readJson(StorySchema.array(), path.join(dataDir, 'stories.json'))

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
        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { hash: string; keyVersion?: string; verdict: unknown }
        if (cached.keyVersion !== CELL_HASH_VERSION) {
          // Pre-CELL_HASH_VERSION entry: a clean miss, not evidence staleness — the matrix is
          // simply not fully judged under the current key format yet.
          console.warn(`judge: matrix incomplete for ${cat.id} — ${p.id}:${story.id} cached under an older key format; not writing verdicts.json (re-run judge --category ${cat.id} --product ${p.id})`)
          incomplete = true
          break
        }
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
  // Every cell in scope is cached now; the recorded batch ids have served their purpose.
  if (batch) clearBatchState(stateFile)
  if (product && matched === 0) throw new Error(`unknown product: ${product}`)
}
