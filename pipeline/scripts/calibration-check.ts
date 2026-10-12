// Golden-cell calibration harness (Lane A, judge calibration + uncertainty). Re-runs the ACTUAL
// judge prompt (imported verbatim from pipeline/stages/judge.ts — never a hand-copied
// duplicate that could drift) against the CURRENT on-disk evidence pack for a small, hand-picked
// set of cells whose correct verdict is already known (see pipeline/golden/golden-cells.json —
// runtime-verified probes, applicability corrections, wrong-axis na's, and a few unambiguous
// full/none cells). This is a REGRESSION gate on the judge's calibration, not a test of the data:
// if the current judge disagrees with a golden verdict tier, either the judge (prompt/model) has
// drifted, or the evidence pack changed underneath the golden call — either way, it's signal to
// investigate, not something this script auto-fixes.
//
// Costs ~1 live LLM call per golden cell (no caching, by design — this must reflect what the
// judge would do RIGHT NOW). Deliberately NOT part of `pnpm test` (money, not determinism) —
// a manual/cron gate: `pnpm calibrate`.
//
// Pass criterion: verdict TIER must match exactly (na is just as strict as every other tier —
// there's no tolerance band for "close enough" on a categorical field). quality is reported for
// context (0-10 scale) but is allowed to vary — the golden set doesn't pin an expected quality,
// only a rationale for why the tier is known-correct. Exits non-zero when more than 2 of the
// golden cells mismatch.
import path from 'node:path'
import { z } from 'zod'
import {
  EvidenceSchema, ProductSchema, StorySchema, VerdictBaseSchema, type Verdict,
} from '../../lib/schemas'
import { llmJson } from '../llm'
import { categoryDir, readJson } from '../paths'
import { judgePrompt, RawVerdictSchema, SYSTEM } from '../stages/judge'

// Structural schema for pipeline/golden/golden-cells.json — a pipeline-internal test fixture,
// not a rankings/ file consumed by the app, so it doesn't warrant a lib/schemas.ts entry. Reuses
// VerdictBaseSchema's verdict enum so a golden cell can never target a verdict tier the real
// judge couldn't itself produce.
const GoldenCellSchema = z.object({
  category: z.string().min(1),
  productId: z.string().min(1),
  storyId: z.string().min(1),
  expectedVerdict: VerdictBaseSchema.shape.verdict,
  why: z.string().min(1),
})
type GoldenCell = z.infer<typeof GoldenCellSchema>

const MISMATCH_TOLERANCE = 2

async function main(): Promise<void> {
  const goldenPath = path.join(__dirname, '..', 'golden', 'golden-cells.json')
  const golden = readJson(GoldenCellSchema.array(), goldenPath)

  const rows: Array<{ cell: GoldenCell; got: Verdict['verdict']; quality: number; pass: boolean }> = []

  for (const cell of golden) {
    const dataDir = categoryDir(cell.category)
    const products = readJson(ProductSchema.array(), path.join(dataDir, 'products.json'))
    const stories = readJson(StorySchema.array(), path.join(dataDir, 'stories.json'))
    const product = products.find((p) => p.id === cell.productId)
    if (!product) throw new Error(`calibration-check: unknown product ${cell.category}/${cell.productId}`)
    const story = stories.find((s) => s.id === cell.storyId)
    if (!story) throw new Error(`calibration-check: unknown story ${cell.category}/${cell.storyId}`)
    const evidence = readJson(EvidenceSchema.array(), path.join(dataDir, 'evidence', `${cell.productId}.json`))

    const raw = await llmJson({ schema: RawVerdictSchema, system: SYSTEM, prompt: judgePrompt(product.name, story, evidence) })
    const pass = raw.verdict === cell.expectedVerdict
    rows.push({ cell, got: raw.verdict, quality: raw.quality, pass })
    console.log(
      `${pass ? 'PASS' : 'FAIL'} ${cell.category}/${cell.productId}:${cell.storyId} — expected ${cell.expectedVerdict}, got ${raw.verdict} (q${raw.quality})`,
    )
  }

  const mismatches = rows.filter((r) => !r.pass)
  console.log('\n=== calibration report ===')
  console.log(`${rows.length - mismatches.length}/${rows.length} golden cells matched`)
  if (mismatches.length > 0) {
    console.log('\nMismatches (signal to investigate — NOT auto-fixed by this script):')
    for (const m of mismatches) {
      console.log(`  - ${m.cell.category}/${m.cell.productId}:${m.cell.storyId}: expected ${m.cell.expectedVerdict}, got ${m.got} (q${m.quality})`)
      console.log(`    golden rationale: ${m.cell.why}`)
    }
  }

  if (mismatches.length > MISMATCH_TOLERANCE) {
    console.log(`\n${mismatches.length} mismatches > tolerance of ${MISMATCH_TOLERANCE} — FAILING.`)
    process.exit(1)
  }
  console.log(`\n${mismatches.length} mismatch(es) within tolerance of ${MISMATCH_TOLERANCE} — OK.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
