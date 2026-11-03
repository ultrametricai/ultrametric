// Discovery dedupe only. Neither a scan nor a roster selection proves processing or merge.
import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { ROOT } from './paths'

export const SEEN_LEDGER_FILE = path.join(ROOT, 'rankings-engine', 'radar-seen.json')
export const DISCOVERIES_DIR = path.join(ROOT, 'rankings-engine', 'radar-discoveries')
export const SeenEntrySchema = z.object({
  key: z.string(), name: z.string(), firstSeen: z.string(), sources: z.array(z.string()),
})
export type SeenEntry = z.infer<typeof SeenEntrySchema>
export const SeenLedgerSchema = z.object({
  _comment: z.string().optional(), updatedAt: z.string(), seen: SeenEntrySchema.array(),
})
export type SeenLedger = z.infer<typeof SeenLedgerSchema>
const ReportReferenceSchema = z.object({
  path: z.string().regex(/^reports\/(vendor-radar|launch-watch)\/(?:runs\/)?[a-zA-Z0-9._-]+\.json$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
})
export const DiscoveryRecordSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.enum(['scan', 'roster-selection']),
  producer: z.enum(['vendor-radar', 'launch-watch']),
  runId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  generatedAt: z.string(),
  report: ReportReferenceSchema,
  seen: SeenEntrySchema.array(),
}).strict()
export type DiscoveryRecord = z.infer<typeof DiscoveryRecordSchema>

export function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

// The Actions attempt distinguishes retries; the UUID also distinguishes repeated local
// invocations (and repeated invocations in one job). Report and discovery use the same ID.
export function createRadarRunId(now = new Date()): string {
  const run = process.env.GITHUB_RUN_ID
  const attempt = process.env.GITHUB_RUN_ATTEMPT ?? '1'
  return `${now.toISOString().slice(0, 10)}-${run && /^\d+$/.test(run) && /^\d+$/.test(attempt) ? `${run}-${attempt}` : 'local'}-${randomUUID()}`
}

export function loadSeenLedger(file = SEEN_LEDGER_FILE): SeenLedger | null {
  if (!fs.existsSync(file)) return null
  try {
    return SeenLedgerSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')))
  } catch (err) {
    throw new Error(`radar: invalid seen-ledger ${file}; refusing to run: ${String(err)}`)
  }
}

export function mergeSeenEntries(lists: SeenEntry[][]): SeenEntry[] {
  const byKey = new Map<string, SeenEntry>()
  for (const e of lists.flat()) {
    const prior = byKey.get(e.key)
    if (!prior) {
      byKey.set(e.key, { ...e, sources: [...new Set(e.sources)].sort() })
      continue
    }
    if (e.firstSeen < prior.firstSeen || (e.firstSeen === prior.firstSeen && e.name < prior.name)) {
      prior.firstSeen = e.firstSeen
      prior.name = e.name
    }
    prior.sources = [...new Set([...prior.sources, ...e.sources])].sort()
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key))
}

// Return whether bytes were newly retained. Identical imports are idempotent; a collision
// fails closed even when the caller only needs to know whether to record new provenance.
export function writeImmutable(file: string, data: string | Buffer): boolean {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  try {
    fs.writeFileSync(file, data, { flag: 'wx' })
    return true
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
    if (!fs.readFileSync(file).equals(Buffer.from(data))) throw new Error(`radar: immutable file conflict: ${file}`)
    return false
  }
}

export function writeDiscovery(record: DiscoveryRecord, root = ROOT): void {
  const parsed = DiscoveryRecordSchema.parse(record)
  validateReport(parsed, root)
  writeImmutable(path.join(root, 'rankings-engine/radar-discoveries', `${parsed.producer}-${parsed.runId}-${parsed.kind}.json`), JSON.stringify(parsed, null, 2) + '\n')
}

function validateReport(record: DiscoveryRecord, root: string): void {
  const data = fs.readFileSync(path.join(root, record.report.path))
  if (sha256(data) !== record.report.sha256) throw new Error(`radar: report hash mismatch: ${record.report.path}`)
  const report = JSON.parse(data.toString()) as { candidates?: { key: string }[]; dispositions?: { key: string }[]; laterLaunches?: SeenEntry[] }
  const keys = new Set([
    ...(report.candidates ?? []), ...(report.dispositions ?? []), ...(report.laterLaunches ?? []),
  ].map((c) => c.key))
  for (const entry of record.seen) {
    if (!keys.has(entry.key)) throw new Error(`radar: ${entry.key} is absent from ${record.report.path}`)
  }
}

// Legacy snapshots remain byte-for-byte, including metadata. Their keys mean only "seen".
export function importLegacyLedger(data: Buffer, root = ROOT): { path: string; created: boolean } {
  SeenLedgerSchema.parse(JSON.parse(data.toString()))
  const relative = `rankings-engine/radar-discoveries/legacy/${sha256(data)}.json`
  return { path: relative, created: writeImmutable(path.join(root, relative), data) }
}

export function loadSeenEntries(root = ROOT): SeenEntry[] {
  const lists = [loadSeenLedger(path.join(root, 'rankings-engine/radar-seen.json'))?.seen ?? []]
  const dir = path.join(root, 'rankings-engine/radar-discoveries')
  if (!fs.existsSync(dir)) return mergeSeenEntries(lists)
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith('.json')) continue
    const record = DiscoveryRecordSchema.parse(JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')))
    validateReport(record, root)
    lists.push(record.seen)
  }
  const legacy = path.join(dir, 'legacy')
  if (fs.existsSync(legacy)) {
    for (const name of fs.readdirSync(legacy).sort()) {
      if (!name.endsWith('.json')) continue
      const data = fs.readFileSync(path.join(legacy, name))
      if (name !== `${sha256(data)}.json`) throw new Error(`radar: legacy snapshot hash mismatch: ${name}`)
      lists.push(SeenLedgerSchema.parse(JSON.parse(data.toString())).seen)
    }
  }
  return mergeSeenEntries(lists)
}
