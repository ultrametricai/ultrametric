// Labels the score-history rows a labeled migration wave just appended, per the convention in
// docs/JUDGE-MIGRATION-2026-09-30.md and lib/schemas.ts (ScoreHistoryEntrySchema.note): score
// discontinuities that reflect a judge or rubric change, not an evidence change, carry a
// provenance note. The derive stage appends unlabeled rows stamped with rankings.generatedAt;
// this script adds the wave's note to exactly those rows (same arena, same timestamp, no note
// yet) and touches nothing else in the series. Idempotent: a re-run finds no unlabeled rows at
// that timestamp and exits loudly instead of double-labeling.
//
// Usage: pnpm exec tsx rankings-engine/scripts/label-score-history-note.ts --category <id> --note <text>
import fs from 'node:fs'
import path from 'node:path'
import { RankingsSchema, ScoreHistoryEntrySchema } from '../../lib/schemas'
import { categoryDir, readJson, resolveCategories } from '../paths'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const category = arg('category')
const note = arg('note')
if (!category || !note) {
  console.error('usage: tsx rankings-engine/scripts/label-score-history-note.ts --category <id> --note <text>')
  process.exit(1)
}

const cat = resolveCategories(category)[0]
const dataDir = categoryDir(cat.id)
const generatedAt = readJson(RankingsSchema, path.join(dataDir, 'rankings.json')).generatedAt
const file = path.join(dataDir, 'score-history.jsonl')
const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)

let labeled = 0
const out = lines.map((line) => {
  const row = ScoreHistoryEntrySchema.parse(JSON.parse(line))
  if (row.date !== generatedAt || row.note !== undefined) return line
  labeled += 1
  return JSON.stringify(ScoreHistoryEntrySchema.parse({ ...row, note }))
})
if (labeled === 0) {
  throw new Error(
    `${cat.id}: no unlabeled score-history rows at ${generatedAt}; run derive first (or the rows are already labeled)`,
  )
}
fs.writeFileSync(file, out.join('\n') + '\n')
console.log(`${cat.id}: labeled ${labeled} score-history rows at ${generatedAt}`)
