// Generic arena-bring-up na/none harmonization — the parameterized successor of
// terminals-na-harmonize.ts (same rule, same documented cache-edit mechanism), used for the
// inference-providers and auth-platforms bring-ups. The documented judge-v3 weakness (na/none
// boundary instability) shows up as like products getting different wrong-axis calls on the
// SAME story. Deterministic rule, mirroring the judge SYSTEM prompt's own na-vs-none ladder:
//
//   For each story where (a) at least one product holds a positive verdict (full/partial/
//   disputed) — proving a product of this kind can conceivably ship the capability, so the
//   axis applies to the KIND — and (b) the non-positive products SPLIT between "none" and
//   "na", OR every non-positive product is "na" (the sole-na case: when every peer is
//   positive, that is the strongest possible in-arena proof the axis applies — added at the
//   workflow-automation/observability bring-up after temporal:agentic-mcp-server sat na
//   against four full peers), flip the "na" cells to "none" (lack of evidence for an
//   applicable axis is always none, per SYSTEM prompt step 3).
//
//   Mixed na/none stories with NO positive peer are left alone (no in-arena proof the axis
//   applies to the kind).
//
// Cache-edit mechanism (same as apply-mcp-server-na.ts / terminals-na-harmonize.ts): hand-write
// the verdict and stamp the cache file with the CURRENT cellHash so `pnpm pipeline judge`
// treats it as already judged. Score impact is strictly conservative: every flip turns a
// denominator-excluded na into a scoring none (quality 0), removing the null-renormalization
// windfall for products with no evidence on applicable axes.
//
// Usage: pnpm exec tsx pipeline/scripts/na-harmonize.ts --category <id> [--write]
import fs from 'node:fs'
import path from 'node:path'
import { EvidenceSchema, StorySchema, VerdictBaseSchema, type Verdict } from '../../lib/schemas'
import { categoryDir, readJson } from '../paths'
import { cellHash, PROMPT_VERSION, validateVerdictRules } from '../stages/judge'

const WRITE = process.argv.includes('--write')
const categoryFlag = process.argv.indexOf('--category')
const CATEGORY = categoryFlag >= 0 ? process.argv[categoryFlag + 1] : undefined
if (!CATEGORY) {
  console.error('usage: pnpm exec tsx pipeline/scripts/na-harmonize.ts --category <id> [--write]')
  process.exit(1)
}

const RATIONALE =
  'The axis applies to this product kind (peer products hold positive or none verdicts on this story), so lack of evidence for an applicable capability is "none", never "na". (na/none harmonized at arena bring-up — see pipeline/scripts/na-harmonize.ts.)'

function main(): void {
  const dataDir = categoryDir(CATEGORY!)
  const stories = readJson(StorySchema.array(), path.join(dataDir, 'stories.json'))
  const verdicts = readJson(VerdictBaseSchema.array(), path.join(dataDir, 'verdicts.json'))

  const byStory = new Map<string, typeof verdicts>()
  for (const v of verdicts) {
    const arr = byStory.get(v.storyId) ?? []
    arr.push(v)
    byStory.set(v.storyId, arr)
  }

  const flips: { productId: string; storyId: string }[] = []
  for (const [storyId, arr] of byStory) {
    const positives = arr.filter((v) => v.verdict === 'full' || v.verdict === 'partial' || v.verdict === 'disputed')
    const nas = arr.filter((v) => v.verdict === 'na')
    const nones = arr.filter((v) => v.verdict === 'none')
    const soleNa = positives.length + nas.length === arr.length
    if (positives.length > 0 && nas.length > 0 && (nones.length > 0 || soleNa)) {
      for (const v of nas) flips.push({ productId: v.productId, storyId })
    }
  }

  for (const flip of flips) {
    const story = stories.find((s) => s.id === flip.storyId)
    if (!story) throw new Error(`story ${flip.storyId} not found`)
    const evidence = readJson(EvidenceSchema.array(), path.join(dataDir, 'evidence', `${flip.productId}.json`))
    const hash = cellHash(story, evidence, PROMPT_VERSION)
    const verdict: Verdict = {
      verdict: 'none',
      quality: 0,
      confidence: 'high',
      rationale: RATIONALE,
      evidenceIds: [],
      productId: flip.productId,
      storyId: flip.storyId,
    }
    const violation = validateVerdictRules(verdict, evidence)
    if (violation) throw new Error(`${flip.productId}:${flip.storyId} violates rules: ${violation}`)
    const cacheFile = path.join('pipeline', 'cache', 'judge', CATEGORY!, flip.productId, `${flip.storyId}.json`)
    console.log(`${WRITE ? 'WRITE' : 'DRY RUN'}: ${flip.productId}:${flip.storyId} na -> none (hash ${hash.slice(0, 12)}...)`)
    if (WRITE) {
      fs.writeFileSync(cacheFile, JSON.stringify({ hash, verdict }, null, 2) + '\n')
    }
  }
  console.log(`${flips.length} cells ${WRITE ? 'written' : 'planned'}; re-run \`pnpm pipeline judge --category ${CATEGORY}\` to reassemble verdicts.json`)
  if (!WRITE) console.log('Dry run only — pass --write to apply.')
}

main()
