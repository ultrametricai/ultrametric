// Product-scoped na/none harmonization for bring-up lanes — the same deterministic rule and
// cache-edit mechanism as na-harmonize.ts (see its header for the rule and provenance), but
// restricted to ONE product: the newly judged entrant. Bring-up lanes keep incumbents
// byte-identical via the judge cellHash cache, so where a story's na/none split involves
// incumbent cells, those are left as judged (flagged for a dedicated harmonization lane) and
// only the entrant's na cells flip. This is the conservative direction for the entrant: each
// flip turns a denominator-excluded na into a scoring none (RunAnywhere precedent, 2026-09-25:
// "na-harmonize (against the new product)").
//
// Usage: pnpm exec tsx pipeline/scripts/na-harmonize-product.ts --category <id> --product <id> [--write]
import fs from 'node:fs'
import path from 'node:path'
import { EvidenceSchema, StorySchema, VerdictBaseSchema, type Verdict } from '../../lib/schemas'
import { categoryDir, readJson } from '../paths'
import { cellHash, PROMPT_VERSION, validateVerdictRules } from '../stages/judge'

const WRITE = process.argv.includes('--write')
const categoryFlag = process.argv.indexOf('--category')
const CATEGORY = categoryFlag >= 0 ? process.argv[categoryFlag + 1] : undefined
const productFlag = process.argv.indexOf('--product')
const PRODUCT = productFlag >= 0 ? process.argv[productFlag + 1] : undefined
if (!CATEGORY || !PRODUCT) {
  console.error('usage: pnpm exec tsx pipeline/scripts/na-harmonize-product.ts --category <id> --product <id> [--write]')
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
  let incumbentNasSkipped = 0
  for (const [storyId, arr] of byStory) {
    const positives = arr.filter((v) => v.verdict === 'full' || v.verdict === 'partial' || v.verdict === 'disputed')
    const nas = arr.filter((v) => v.verdict === 'na')
    const nones = arr.filter((v) => v.verdict === 'none')
    const soleNa = positives.length + nas.length === arr.length
    if (positives.length > 0 && nas.length > 0 && (nones.length > 0 || soleNa)) {
      for (const v of nas) {
        if (v.productId === PRODUCT) flips.push({ productId: v.productId, storyId })
        else incumbentNasSkipped++
      }
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
  console.log(
    `${flips.length} ${PRODUCT} cells ${WRITE ? 'written' : 'planned'} (${incumbentNasSkipped} incumbent na cells left as judged); `
    + `re-run \`pnpm pipeline judge --category ${CATEGORY}\` to reassemble verdicts.json`,
  )
  if (!WRITE) console.log('Dry run only — pass --write to apply.')
}

main()
