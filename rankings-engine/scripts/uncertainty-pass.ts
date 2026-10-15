// Multi-judge uncertainty pass (Lane A, judge calibration + uncertainty). For arenas where the
// #1 and #2 leaderboard products are within CLOSE_RACE_THRESHOLD Overall score points of each other, the
// ranking is a "close race" — worth knowing how much of that gap is real signal vs. judge noise.
// For each qualifying arena, re-judges BOTH contenders' decisive cells (every story under the
// agenticness theme: agent-access, agentic-features, api-quality — the axes that feed the Arena
// Score's agentReady/agenticApp/apiQuality components) two ADDITIONAL times against the same
// on-disk evidence pack, and records agreement across those 2 fresh samples plus the tier already
// cached in verdicts.json.
//
// Writes open-rankings/{cat}/uncertainty.json (array of UncertaintyEntry — see lib/schemas.ts). Entirely
// additive/display-only: never touches verdicts.json, never feeds lib/scoring.ts, and a category
// that isn't a close race gets no file at all (see lib/data.ts's tolerant-optional load).
//
// Costs ~2 live LLM calls per decisive cell per qualifying product — deliberately NOT part of
// `pnpm test`. Usage: pnpm exec tsx rankings-engine/scripts/uncertainty-pass.ts [--category a,b,c]
//   --category (comma-separated allowlist) limits the pass to specific arenas — added for the
//   2026-09-30 opus-5-5 judge migration, whose memo prescribes re-measuring the noise model on
//   a ~100-cell SAMPLE under the new judge (~$8) rather than every qualifying arena (35 arenas
//   qualified post-migration ≈ $95): measure a few arenas, then rebuild intervals from
//   opus-measured files only.
import fs from 'node:fs'
import path from 'node:path'
import {
  type Evidence, EvidenceSchema, ProductSchema, RankingsSchema, type Story, StorySchema,
  type UncertaintyEntry, type Verdict, VerdictSchema,
} from '../../lib/schemas'
import { agreementOf, isCloseRace } from '../../lib/uncertainty'
import { llmJson } from '../llm'
import { categoryDir, readCategories, readJson, writeJson } from '../paths'
import { judgePrompt, RawVerdictSchema, SYSTEM } from '../stages/judge'

const CLOSE_RACE_THRESHOLD = 3.0

// One resample may still fail transiently (overload, non-JSON prose) even after llmJson's own
// retries — a dropped sample is fine for a 3-sample agreement estimate, a crashed fleet pass is
// not, so retry twice then return null and let the caller count only the samples that landed.
async function judgeOnce(productName: string, story: Story, evidence: Evidence[]): Promise<Verdict['verdict'] | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const raw = await llmJson({ schema: RawVerdictSchema, system: SYSTEM, prompt: judgePrompt(productName, story, evidence) })
      return raw.verdict
    } catch (err) {
      console.warn(`uncertainty: sample failed for ${productName}:${story.id} (attempt ${attempt + 1}): ${err instanceof Error ? err.message.slice(0, 120) : err}`)
      await new Promise((r) => setTimeout(r, 15_000 * (attempt + 1)))
    }
  }
  return null
}

async function main(): Promise<void> {
  const catFlag = process.argv.indexOf('--category')
  const only = catFlag >= 0 ? new Set(process.argv[catFlag + 1].split(',')) : undefined
  const categories = readCategories().filter((c) => !only || only.has(c.id))
  if (only && categories.length !== only.size) throw new Error('uncertainty-pass: unknown category in --category list')
  const summary: string[] = []

  for (const cat of categories) {
    const dataDir = categoryDir(cat.id)
    const rankingsPath = path.join(dataDir, 'rankings.json')
    if (!fs.existsSync(rankingsPath)) continue
    const rankings = readJson(RankingsSchema, rankingsPath)
    const [top1, top2] = rankings.leaderboard
    if (!top1 || !top2) continue

    if (!isCloseRace(top1.aiEra, top2.aiEra, CLOSE_RACE_THRESHOLD)) {
      const diff = top1.aiEra === null || top2.aiEra === null ? 'n/a' : Math.abs(top1.aiEra - top2.aiEra).toFixed(1)
      summary.push(`${cat.id}: not a close race (Δ${diff}) — skipped`)
      continue
    }

    const diff = Math.abs(top1.aiEra! - top2.aiEra!).toFixed(1)
    console.log(`\nuncertainty: ${cat.id} QUALIFIES — ${top1.productId} vs ${top2.productId} (Δ${diff} Overall score points)`)

    const products = readJson(ProductSchema.array(), path.join(dataDir, 'products.json'))
    const stories = readJson(StorySchema.array(), path.join(dataDir, 'stories.json'))
    const verdicts = readJson(VerdictSchema.array(), path.join(dataDir, 'verdicts.json'))
    // The "decisive canon": every story under the agenticness theme, which spans all three
    // groups that feed the Overall score's agent-readiness components (agent-access -> agentReady,
    // agentic-features -> agenticApp, api-quality -> apiQuality).
    const decisive = stories.filter((s) => s.theme === 'agenticness')

    const entries: UncertaintyEntry[] = []
    let splitCount = 0

    for (const productId of [top1.productId, top2.productId]) {
      const product = products.find((p) => p.id === productId)
      if (!product) throw new Error(`uncertainty-pass: unknown product ${cat.id}/${productId}`)
      const evidence = readJson(EvidenceSchema.array(), path.join(dataDir, 'evidence', `${productId}.json`))

      for (const story of decisive) {
        const cached = verdicts.find((v) => v.productId === productId && v.storyId === story.id)
        if (!cached) {
          console.warn(`uncertainty-pass: no cached verdict for ${cat.id}/${productId}:${story.id} — skipping`)
          continue
        }
        const extra1 = await judgeOnce(product.name, story, evidence)
        const extra2 = await judgeOnce(product.name, story, evidence)
        if (extra1 === null || extra2 === null) {
          console.warn(`uncertainty-pass: dropped ${cat.id}/${productId}:${story.id} — a resample failed persistently`)
          continue
        }
        const judgments: [Verdict['verdict'], Verdict['verdict'], Verdict['verdict']] = [cached.verdict, extra1, extra2]
        const agreement = agreementOf(judgments)
        if (agreement !== '3/3') splitCount++
        entries.push({ productId, storyId: story.id, judgments, agreement })
        console.log(`  ${productId}:${story.id} → [${judgments.join(', ')}] (${agreement})`)
      }
    }

    writeJson(path.join(dataDir, 'uncertainty.json'), entries)
    const rate = entries.length > 0 ? ((splitCount / entries.length) * 100).toFixed(0) : '0'
    summary.push(`${cat.id}: QUALIFIED (Δ${diff}) — ${entries.length} decisive cells, ${splitCount} split (${rate}% disagreement)`)
  }

  console.log('\n=== uncertainty pass summary ===')
  console.log(summary.join('\n'))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
