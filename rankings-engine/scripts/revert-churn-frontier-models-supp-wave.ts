// Surgical, auditable revert of judge re-roll churn introduced by the frontier-models
// docs-evidence supplement re-judge (append-frontier-models-docs-evidence.py, 2026-09-22).
// Same ruling as revert-churn-api-quality-wave.ts: a re-judged cell whose verdict or quality
// changed while citing NO evidence id new to the wave (this wave's ids all match /-supp-/) is
// re-roll noise, not an evidence-driven change, and is reverted to its prior state. The prior
// state is the .pa-tmp/verdicts-pre-supp-wave.json snapshot (this lane's worktree has no
// pre-wave commit to diff against — the whole arena is new on this branch). Patches both
// verdicts.json and the matching judge cache files in place (same hash, reverted verdict
// object) so a future `pnpm pipeline judge` run doesn't resurrect the churn.
//
// Usage: pnpm exec tsx pipeline/scripts/revert-churn-frontier-models-supp-wave.ts [--write]
import fs from 'node:fs'
import path from 'node:path'
import { EvidenceSchema, StorySchema, type Verdict } from '../../lib/schemas'
import { categoryDir, readJson } from '../paths'
import { cellHash, PROMPT_VERSION } from '../stages/judge'

const ROOT = path.resolve(__dirname, '..', '..')
const WRITE = process.argv.includes('--write')
const CAT = 'frontier-models'
const NEW_ID_MARKER = '-supp-'

type Row = Verdict

const dataDir = categoryDir(CAT)
const current: Row[] = JSON.parse(fs.readFileSync(path.join(dataDir, 'verdicts.json'), 'utf8'))
const old: Row[] = JSON.parse(fs.readFileSync(path.join(ROOT, '.pa-tmp', 'verdicts-pre-supp-wave.json'), 'utf8'))
const oldByKey = new Map(old.map((v) => [`${v.productId}:${v.storyId}`, v]))
const stories = readJson(StorySchema.array(), path.join(dataDir, 'stories.json'))
const storyById = new Map(stories.map((s) => [s.id, s]))

let reverted = 0
let kept = 0
const out: Row[] = current.map((v) => {
  const prior = oldByKey.get(`${v.productId}:${v.storyId}`)
  if (!prior) return v
  if (prior.verdict === v.verdict && prior.quality === v.quality) return v
  const citesNew = (v.evidenceIds ?? []).some((id) => id.includes(NEW_ID_MARKER))
  if (citesNew) {
    kept++
    console.log(`KEEP   ${v.productId}:${v.storyId} ${prior.verdict}/q${prior.quality} -> ${v.verdict}/q${v.quality} (cites supp evidence)`)
    return v
  }
  reverted++
  console.log(`REVERT ${v.productId}:${v.storyId} ${v.verdict}/q${v.quality} -> ${prior.verdict}/q${prior.quality} (no new citation)`)
  return { ...prior }
})

console.log(`${kept} kept, ${reverted} reverted`)

if (WRITE) {
  fs.writeFileSync(path.join(dataDir, 'verdicts.json'), JSON.stringify(out, null, 2) + '\n')
  // Patch judge cache in place with the CURRENT cellHash so a future judge run keeps the
  // reverted verdict instead of resurrecting the churn.
  const evidenceByProduct = new Map<string, import('../../lib/schemas').Evidence[]>()
  for (const v of out) {
    const cur = current.find((c) => c.productId === v.productId && c.storyId === v.storyId)
    if (!cur || (cur.verdict === v.verdict && cur.quality === v.quality)) continue
    const story = storyById.get(v.storyId)
    if (!story) continue
    let evidence = evidenceByProduct.get(v.productId)
    if (!evidence) {
      evidence = readJson(EvidenceSchema.array(), path.join(dataDir, 'evidence', `${v.productId}.json`))
      evidenceByProduct.set(v.productId, evidence)
    }
    const hash = cellHash(story, evidence, PROMPT_VERSION)
    const cacheFile = path.join(ROOT, 'pipeline', 'cache', 'judge', CAT, v.productId, `${v.storyId}.json`)
    fs.writeFileSync(cacheFile, JSON.stringify({ hash, verdict: v }, null, 2) + '\n')
  }
  console.log('WROTE verdicts.json + cache patches')
} else {
  console.log('Dry run only — pass --write to apply.')
}
