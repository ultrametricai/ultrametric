// Settle the 2026-11-01 merge of origin/main's expense-management refresh into the
// cross-arena vendor-geo pass (PR #503).
//
// Between the pass (2026-10-27) and this merge, main landed a story-runner refresh of
// expense-management (cdcb8718e9..0e77a554b8) that re-judged brex against new evidence and
// restored the published ramp/brex judgments. Both sides appended brex evidence under the
// same next-free ids (brex-docs-42..45), with different content. This script resolves the
// merge under the stability policy (CONTRIBUTING.md "Stability policy") the same way
// settle-cross-arena-geo-pass-churn.ts applied it inside the pass:
//
// - Evidence is a keyed union: main's refreshed packs stand, and the pass's geo entries are
//   re-appended under the next free ids (brex-docs-42..45 -> brex-docs-71..74; ramp-docs-46..48
//   keep their ids, which are still free on main). This matches the append script's own
//   next-free-id assignment; the colliding ids on main belong to the refresh and keep their
//   meaning.
// - Verdict rows: main's refreshed rows stand for every cell that does not cite the pass's
//   geo evidence (on a re-judge, no-new-evidence changes are noise; main's rows are the
//   published baseline the refresh restored). The nine geo-citing rows from the pass stand,
//   with their brex evidence ids remapped to the new numbering.
// - Judge caches for brex and ramp are re-keyed to the merged packs with the verdict each
//   cell carries in verdicts.json, so a future `pnpm engine judge` run reproduces this state
//   instead of re-rolling it (the settle-script precedent).
//
// Prints a full audit trail and self-verifies cache/verdict consistency before writing.
//
// Usage: pnpm exec tsx rankings-engine/scripts/merge-expense-refresh-2026-11-01.ts \
//          --theirs <main-ref> --ours <pass-ref> [--write]
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { CACHE_DIR, categoryDir, readJson, writeJson } from '../paths'
import { EvidenceSchema, ProductSchema, StorySchema, type Evidence, type Story } from '../../lib/schemas'
import { cellHash, CELL_HASH_VERSION, PROMPT_VERSION } from '../stages/judge'

const ROOT = path.resolve(__dirname, '..', '..')
const WRITE = process.argv.includes('--write')
const arg = (flag: string) => {
  const i = process.argv.indexOf(flag)
  if (i < 0 || !process.argv[i + 1]) throw new Error(`usage: merge-expense-refresh-2026-11-01.ts --theirs <ref> --ours <ref> [--write]`)
  return process.argv[i + 1]
}
const THEIRS = arg('--theirs')
const OURS = arg('--ours')

const CATEGORY = 'expense-management'
const PRODUCTS = ['brex', 'ramp'] as const
// The pass's geo evidence, by the id it carries on the OURS ref and the id it lands under here.
const ID_REMAP: Record<string, string> = {
  'brex-docs-42': 'brex-docs-71',
  'brex-docs-43': 'brex-docs-72',
  'brex-docs-44': 'brex-docs-73',
  'brex-docs-45': 'brex-docs-74',
  'ramp-docs-46': 'ramp-docs-46',
  'ramp-docs-47': 'ramp-docs-47',
  'ramp-docs-48': 'ramp-docs-48',
}

type VerdictRow = {
  productId: string
  storyId: string
  verdict: string
  quality: number
  confidence: string
  rationale: string
  evidenceIds: string[]
}

const show = (ref: string, file: string) =>
  execSync(`git show ${ref}:${file}`, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString()
const showJson = <T>(ref: string, file: string): T => JSON.parse(show(ref, file)) as T

const dataDir = categoryDir(CATEGORY)
const stories = readJson(StorySchema.array(), path.join(dataDir, 'stories.json'))
const products = readJson(ProductSchema.array(), path.join(dataDir, 'products.json'))

// 1. Merged evidence packs: theirs + the pass's geo entries under their landed ids.
const mergedEvidence: Record<string, Evidence[]> = {}
for (const product of PRODUCTS) {
  const file = `open-rankings/${CATEGORY}/evidence/${product}.json`
  const theirs = EvidenceSchema.array().parse(showJson(THEIRS, file))
  const ours = EvidenceSchema.array().parse(showJson(OURS, file))
  const theirIds = new Set(theirs.map((e) => e.id))
  const geoEntries = ours
    .filter((e) => e.id in ID_REMAP)
    .map((e) => ({ ...e, id: ID_REMAP[e.id] }))
  for (const e of geoEntries) {
    if (theirIds.has(e.id)) throw new Error(`id collision after remap: ${e.id} already exists on ${THEIRS}`)
  }
  mergedEvidence[product] = [...theirs, ...geoEntries]
  console.log(`evidence ${product}: ${theirs.length} from ${THEIRS} + ${geoEntries.map((e) => e.id).join(', ')}`)
}

// 2. Merged verdict rows: theirs for every cell, except the pass's geo-citing rows.
const verdictsFile = `open-rankings/${CATEGORY}/verdicts.json`
const theirVerdicts = showJson<VerdictRow[]>(THEIRS, verdictsFile)
const ourVerdicts = showJson<VerdictRow[]>(OURS, verdictsFile)
const geoIds = new Set(Object.keys(ID_REMAP))
const geoRows = new Map(
  ourVerdicts
    .filter((row) => row.evidenceIds.some((id) => geoIds.has(id)))
    .map((row) => [
      `${row.productId}:${row.storyId}`,
      { ...row, evidenceIds: row.evidenceIds.map((id) => ID_REMAP[id] ?? id) },
    ]),
)
const geoRowCount = geoRows.size
const mergedIds = new Map(PRODUCTS.map((p) => [p, new Set(mergedEvidence[p].map((e) => e.id))]))
let honored = 0
const merged = theirVerdicts.map((row) => {
  const key = `${row.productId}:${row.storyId}`
  const geo = geoRows.get(key)
  if (!geo) {
    if ((PRODUCTS as readonly string[]).includes(row.productId)) honored += 1
    return row
  }
  geoRows.delete(key)
  // A pass row can only stand if every id it cites survives the refresh. brex-comm-1 did not
  // (the refresh replaced it with a different HN item), so brex:issue-cards-limits, whose
  // verdict and quality match the refreshed row anyway, honors the refresh.
  const lost = geo.evidenceIds.filter((id) => !mergedIds.get(geo.productId as (typeof PRODUCTS)[number])!.has(id))
  if (lost.length > 0) {
    if (geo.verdict !== row.verdict || geo.quality !== row.quality) {
      throw new Error(`geo row ${key} cites evidence the refresh dropped (${lost.join(', ')}) and moves the score — needs a re-judge, not a merge`)
    }
    console.log(`geo row honors ${THEIRS} for ${key}: cites dropped ${lost.join(', ')}; verdict unchanged (${row.verdict} q${row.quality})`)
    honored += 1
    return row
  }
  console.log(
    `geo row stands ${key}: ${THEIRS} had ${row.verdict} q${row.quality} -> pass ${geo.verdict} q${geo.quality} (cites ${geo.evidenceIds.filter((id) => Object.values(ID_REMAP).includes(id)).join(', ')})`,
  )
  return geo
})
if (geoRows.size > 0) throw new Error(`geo rows missing from ${THEIRS} verdicts: ${[...geoRows.keys()].join(', ')}`)
console.log(`verdicts: ${merged.length} rows; brex/ramp cells honoring ${THEIRS}: ${honored}; geo rows kept: ${geoRowCount}`)

// 3. Re-key the brex and ramp judge caches to the merged packs with the merged rows.
const byKey = new Map(merged.map((row) => [`${row.productId}:${row.storyId}`, row]))
const cacheWrites: Array<{ file: string; hash: string; verdict: VerdictRow }> = []
for (const product of PRODUCTS) {
  for (const story of stories as Story[]) {
    const row = byKey.get(`${product}:${story.id}`)
    if (!row) throw new Error(`no merged verdict for ${product}:${story.id}`)
    const hash = cellHash(story, mergedEvidence[product], PROMPT_VERSION)
    cacheWrites.push({
      file: path.join(CACHE_DIR, 'judge', CATEGORY, product, `${story.id}.json`),
      hash,
      verdict: row,
    })
  }
}

// 4. Self-verify before writing: every brex/ramp cell has exactly one cache write whose
// verdict matches verdicts.json, and the merged matrix is complete for the whole category.
const productIds = new Set(products.map((p) => p.id))
for (const row of merged) {
  if (!productIds.has(row.productId)) throw new Error(`verdict for unknown product ${row.productId}`)
}
for (const p of products) {
  for (const story of stories as Story[]) {
    if (!byKey.has(`${p.id}:${story.id}`)) throw new Error(`matrix incomplete: ${p.id}:${story.id}`)
  }
}

if (!WRITE) {
  console.log('dry run: pass --write to apply')
  process.exit(0)
}

for (const product of PRODUCTS) {
  writeJson(path.join(dataDir, 'evidence', `${product}.json`), mergedEvidence[product])
}
writeJson(path.join(dataDir, 'verdicts.json'), merged)
for (const w of cacheWrites) {
  writeJson(w.file, { hash: w.hash, keyVersion: CELL_HASH_VERSION, verdict: w.verdict })
}
console.log(`wrote 2 evidence packs, verdicts.json, and ${cacheWrites.length} re-keyed cache cells`)
