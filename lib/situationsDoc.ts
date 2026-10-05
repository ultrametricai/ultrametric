import fs from 'node:fs'
import path from 'node:path'
import { loadProcesses } from '@/lib/processes'

// processes/SITUATIONS.md ↔ corpus sync (founder 2026-10-02: situations get their own repo
// surface). Same doctrine as the open-documents/README.md gate (lib/documents.ts): the listing
// lives in markdown for humans, the truth lives in processes/corpus.json (kind: 'situation'),
// and a drift test (__tests__/situations.test.ts) keeps the two byte-identical — the table
// block between the markers is GENERATED (scripts/generate-situations-md.ts), so the list can
// never go stale. Pure validators take data so failure modes are testable; no network I/O.

export const SITUATIONS_DOC = 'processes/SITUATIONS.md'
export const TABLE_START = '<!-- situations:table:start (generated — scripts/generate-situations-md.ts) -->'
export const TABLE_END = '<!-- situations:table:end -->'

export interface SituationDocRecord {
  id: string
  title: string
  trigger: string
  urgency: 'hours' | 'days' | 'weeks'
  geoScope: 'global' | 'us' | 'us-state'
}

const URGENCY_ORDER = ['hours', 'days', 'weeks'] as const

/** The corpus situations in the one honest display order (the /situations index order):
 * urgency hours → days → weeks, then title. */
export function situationRecords(): SituationDocRecord[] {
  return loadProcesses()
    .filter((t) => t.kind === 'situation')
    .map((t) => ({
      id: t.id,
      title: t.title,
      trigger: t.trigger!,
      urgency: t.urgency!,
      geoScope: t.geoScope,
    }))
    .sort(
      (a, b) =>
        URGENCY_ORDER.indexOf(a.urgency) - URGENCY_ORDER.indexOf(b.urgency)
        || a.title.localeCompare(b.title),
    )
}

/** The exact generated table block (markers included) — the generator writes it, the drift
 * test requires the committed file to contain it verbatim. */
export function renderSituationsTable(records: SituationDocRecord[]): string {
  const rows = records.map(
    (r) => `| \`${r.id}\` | ${r.title} | ${r.trigger} | ${r.urgency} | ${r.geoScope} |`,
  )
  return [
    TABLE_START,
    '',
    `The ${records.length} situations, hottest clock first (urgency, then title — the /situations order):`,
    '',
    '| id | Situation | Trigger | Urgency | Geo |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
    TABLE_END,
  ].join('\n')
}

/** Drift gate: the committed markdown must contain the exact generated table block, and every
 * backticked sit id anywhere in the doc must resolve to a live corpus situation. */
export function validateSituationsDoc(markdown: string, records: SituationDocRecord[]): string[] {
  const errors: string[] = []
  const start = markdown.indexOf(TABLE_START)
  const end = markdown.indexOf(TABLE_END)
  if (start === -1 || end === -1 || end < start) {
    errors.push(`SITUATIONS.md: missing the generated table markers (${TABLE_START} … ${TABLE_END})`)
    return errors
  }
  const committed = markdown.slice(start, end + TABLE_END.length)
  if (committed !== renderSituationsTable(records)) {
    errors.push(
      'SITUATIONS.md: the generated table block has drifted from processes/corpus.json — rerun scripts/generate-situations-md.ts',
    )
  }
  const known = new Set(records.map((r) => r.id))
  for (const m of markdown.matchAll(/`(sit_[a-z0-9_]+)`/g)) {
    if (!known.has(m[1])) errors.push(`SITUATIONS.md: cites unknown situation id ${m[1]}`)
  }
  return errors
}

/** The full gate over the committed file. Empty array = pass. */
export function validateSituations(): string[] {
  const markdown = fs.readFileSync(path.join(process.cwd(), SITUATIONS_DOC), 'utf8')
  return validateSituationsDoc(markdown, situationRecords())
}
