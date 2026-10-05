// Regenerates the table block in processes/SITUATIONS.md from processes/corpus.json (the
// kind=situation records), between the markers lib/situationsDoc.ts defines. The prose around
// the block is authored; only the block is machine-owned. Drift gate:
// __tests__/situations.test.ts (same README-sync pattern open-documents/ uses).
//
// Usage: pnpm exec tsx scripts/generate-situations-md.ts
import fs from 'node:fs'
import path from 'node:path'
import {
  renderSituationsTable, situationRecords, SITUATIONS_DOC, TABLE_END, TABLE_START,
} from '../lib/situationsDoc'

const file = path.join(process.cwd(), SITUATIONS_DOC)
const current = fs.readFileSync(file, 'utf8')
const start = current.indexOf(TABLE_START)
const end = current.indexOf(TABLE_END)
if (start === -1 || end === -1 || end < start) {
  throw new Error(`${SITUATIONS_DOC}: table markers not found — restore them before regenerating`)
}
const records = situationRecords()
const next = current.slice(0, start) + renderSituationsTable(records) + current.slice(end + TABLE_END.length)
fs.writeFileSync(file, next)
console.log(`situations: wrote ${records.length} rows into ${SITUATIONS_DOC}`)
