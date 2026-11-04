import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { parseSloHistoryJsonl, SLO_HISTORY_DIR, type SloEntry } from '../lib/slo'

// Each invocation gets a fresh UUID, including retries and local runs at the same time.
// Publish a complete file with an exclusive hard link: no partial JSONL is visible to
// readers, and a collision fails without replacing an existing observation file.
export function writeSloRun(entries: SloEntry[], dir: string): string | null {
  if (!entries.length) return null
  const text = entries.map(entry => JSON.stringify(entry)).join('\n') + '\n'
  parseSloHistoryJsonl(text)
  if (new Set(entries.map(entry => entry.date)).size !== 1) throw new Error('SLO run must have one check timestamp')
  const timestamp = new Date(entries[0].date).toISOString().replace(/[:.]/g, '-')
  const shards = path.join(dir, SLO_HISTORY_DIR)
  fs.mkdirSync(shards, { recursive: true })
  const file = path.join(shards, `${timestamp}-${crypto.randomUUID()}.jsonl`)
  const temporary = fs.mkdtempSync(path.join(shards, '.pending-'))
  try {
    const pending = path.join(temporary, 'run')
    fs.writeFileSync(pending, text, { flag: 'wx' })
    fs.linkSync(pending, file)
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true })
  }
  return file
}
