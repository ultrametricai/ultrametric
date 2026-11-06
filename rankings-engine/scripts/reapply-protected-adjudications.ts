// Re-applies the protected human adjudications from docs/JUDGE-MIGRATION-2026-09-30-worklist.json
// to the judge cache after a labeled migration wave re-judges their arena, mirroring the
// 2026-09-30 driver's finalizeArena step (rankings-engine/scripts/migrate-judge-batch.ts):
// human adjudications outrank any model, so each entry's preservedVerdict is written back
// verbatim under the current cache scheme, and the worklist records what the fresh judge said.
// After this script, re-running `pnpm engine judge --category <id>` assembles verdicts.json
// from the (now fully current) cache without model calls.
//
// Usage: pnpm exec tsx rankings-engine/scripts/reapply-protected-adjudications.ts --category <id> --wave <label>
import fs from 'node:fs'
import path from 'node:path'
import { EvidenceSchema, StorySchema, VerdictSchema, type Verdict } from '../../lib/schemas'
import { cellHash, CELL_HASH_VERSION, PROMPT_VERSION } from '../stages/judge'
import { CACHE_DIR, categoryDir, readJson, resolveCategories, ROOT } from '../paths'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const category = arg('category')
const wave = arg('wave')
if (!category || !wave) {
  console.error('usage: tsx rankings-engine/scripts/reapply-protected-adjudications.ts --category <id> --wave <label>')
  process.exit(1)
}

const WORKLIST_FILE = path.join(ROOT, 'docs', 'JUDGE-MIGRATION-2026-09-30-worklist.json')
type WorklistEntry = {
  category: string
  productId: string
  storyId: string
  preservedVerdict: Verdict
  status: string
  freshJudgeSaid?: string
  action?: string
}
const worklist = JSON.parse(fs.readFileSync(WORKLIST_FILE, 'utf8')) as { entries: WorklistEntry[] }

const cat = resolveCategories(category)[0]
const dataDir = categoryDir(cat.id)
const stories = readJson(StorySchema.array(), path.join(dataDir, 'stories.json'))

let applied = 0
for (const entry of worklist.entries) {
  if (entry.category !== cat.id) continue
  const story = stories.find((s) => s.id === entry.storyId)
  if (!story) throw new Error(`worklist: unknown story ${cat.id}/${entry.storyId}`)
  const evidence = readJson(EvidenceSchema.array(), path.join(dataDir, 'evidence', `${entry.productId}.json`))
  const cacheFile = path.join(CACHE_DIR, 'judge', cat.id, entry.productId, `${entry.storyId}.json`)
  const fresh = fs.existsSync(cacheFile)
    ? (JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { verdict: Verdict }).verdict
    : undefined
  const preserved = VerdictSchema.parse(entry.preservedVerdict)
  if (fresh) {
    entry.freshJudgeSaid = `${fresh.verdict} q${fresh.quality} (conf ${fresh.confidence})`
    const agrees = fresh.verdict === preserved.verdict && fresh.quality === preserved.quality
    entry.action = agrees
      ? `preserved human adjudication through ${wave} (the fresh judge independently reached the same verdict/quality)`
      : `preserved human adjudication over the fresh judgment in ${wave} (human adjudications outrank any model)`
  } else {
    entry.action = `preserved human adjudication through ${wave} (no fresh verdict produced for this cell)`
  }
  entry.status = 'preserved'
  fs.writeFileSync(
    cacheFile,
    JSON.stringify({ hash: cellHash(story, evidence, PROMPT_VERSION), keyVersion: CELL_HASH_VERSION, verdict: preserved }, null, 2) + '\n',
  )
  applied += 1
  console.log(`${cat.id}/${entry.productId}:${entry.storyId}: preserved ${preserved.verdict} q${preserved.quality} (fresh judge said ${entry.freshJudgeSaid ?? 'nothing'})`)
}
if (applied === 0) throw new Error(`${cat.id}: no worklist entries for this category`)
fs.writeFileSync(WORKLIST_FILE, JSON.stringify(worklist, null, 2) + '\n')
console.log(`${cat.id}: re-applied ${applied} protected adjudications; worklist updated`)
