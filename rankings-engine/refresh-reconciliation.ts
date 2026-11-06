import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { isDeepStrictEqual as equal } from 'node:util'
import { z } from 'zod'
import { EvidenceSchema, ProductSchema, StorySchema, VerdictSchema, type Evidence, type Verdict } from '../lib/schemas'
import { sameEvidence } from './evidence-source.mjs'
import { unsupportedFlips } from './scripts/check-refresh-stability.mjs'
import { CELL_HASH_VERSION, PROMPT_VERSION, cellHash, validateVerdictRules } from './stages/judge'

const key = (row: Verdict) => `${row.productId}:${row.storyId}`
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const identifier = /^[a-z0-9][a-z0-9_-]*$/
const sha = /^[a-f0-9]{40}$/
const Cache = z.object({ hash: z.string(), keyVersion: z.string(), verdict: VerdictSchema })
const Ledger = z.object({
  version: z.literal(2), arena: z.string(), identity: z.string(),
  retained: z.array(z.object({ cell: z.string(), origin: z.string().regex(sha), decisionBaseline: z.string().regex(sha) }).strict()),
}).strict()
type Snapshot = {
  products: z.infer<typeof ProductSchema>[], stories: z.infer<typeof StorySchema>[],
  rows: Verdict[], packs: Record<string, Evidence[]>, caches: Record<string, unknown>,
}
export type ReconciliationReport = {
  arena: string; baseline: string; retained: string[]; accepted: string[];
  blocked: Array<{ cell: string; reason: string }>;
}
export class ReconciliationError extends Error {
  constructor(public report: ReconciliationReport) {
    super(`Refresh reconciliation blocked: ${report.blocked.map(item => `${item.cell}: ${item.reason}`).join('; ')}`)
  }
}

// This identity includes the full evidence (including source digests), catalog, canonical
// decisions and raw caches. A ledger is never authority alone: origin Git data is checked too.
const identity = (snapshot: Snapshot) => digest(snapshot)
const supportIntact = (row: Verdict, before: Evidence[], after: Evidence[]) => row.evidenceIds.every(id => {
  const old = before.find(item => item.id === id), current = after.find(item => item.id === id)
  return old && current && sameEvidence(old, current)
})
function validCache(snapshot: Snapshot, row: Verdict): boolean {
  const cache = Cache.safeParse(snapshot.caches[key(row)])
  const story = snapshot.stories.find(item => item.id === row.storyId)
  return Boolean(story && cache.success && cache.data.keyVersion === CELL_HASH_VERSION
    && cache.data.hash === cellHash(story, snapshot.packs[row.productId], PROMPT_VERSION)
    && equal(cache.data.verdict, row))
}

/** Scheduled producer only. No model calls, cache rewrites, evidence edits or derivation. */
export function reconcileRefresh({ arena, baseline, root = process.cwd() }: { arena: string; baseline: string; root?: string }): ReconciliationReport {
  if (!identifier.test(arena) || !sha.test(baseline)) throw new Error('Expected an arena and pinned 40-character baseline SHA')
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }).trim()
  const dir = `open-rankings/${arena}`
  const ledgerPath = `rankings-engine/cache/refresh-retention/${arena}/decisions.json`
  // Check every path component, including dangling links and temporary write targets.
  // This is a local checkout guard, not a defense against concurrent filesystem mutation.
  const regularPath = (file: string) => {
    const target = path.resolve(root, file)
    const relative = path.relative(path.resolve(root), target)
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Path escapes checkout: ${file}`)
    const parts = target.split(path.sep).filter(Boolean)
    let current = path.parse(target).root
    for (let i = 0; i < parts.length; i++) {
      current = path.join(current, parts[i])
      let stat: fs.Stats
      try { stat = fs.lstatSync(current) } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
        throw error
      }
      if (stat.isSymbolicLink() || (i < parts.length - 1 ? !stat.isDirectory() : !stat.isFile())) {
        throw new Error(`Expected regular file and directory parents: ${file}`)
      }
    }
    return target
  }
  const snapshots = new Map<string, Map<string, unknown>>()
  const historical = (ref: string) => {
    let files = snapshots.get(ref)
    if (files) return files
    const entries = git('ls-tree', '-r', ref, '--', dir, `rankings-engine/cache/judge/${arena}`, ledgerPath)
      .split('\n').filter(Boolean).map(line => {
        const match = /^(100644) blob ([a-f0-9]{40})\t(.+)$/.exec(line)
        if (!match) throw new Error('Baseline contains a non-regular arena file')
        return { oid: match[2], file: match[3] }
      }).filter(entry => entry.file.endsWith('.json'))
    const output = execFileSync('git', ['cat-file', '--batch'], {
      cwd: root, input: entries.map(entry => entry.oid).join('\n') + '\n', maxBuffer: 128 * 1024 * 1024,
    })
    files = new Map(); let offset = 0
    for (const entry of entries) {
      const end = output.indexOf(10, offset)
      const header = output.subarray(offset, end).toString('utf8').split(' ')
      const size = Number(header[2])
      if (header[0] !== entry.oid || header[1] !== 'blob' || !Number.isSafeInteger(size) || size < 0) throw new Error('Invalid Git object response')
      offset = end + 1
      files.set(entry.file, JSON.parse(output.subarray(offset, offset + size).toString('utf8')))
      offset += size + 1
    }
    snapshots.set(ref, files)
    return files
  }
  const read = (ref: string | null, file: string, optional = false): unknown => {
    if (ref) {
      const files = historical(ref)
      if (!files.has(file)) {
        if (optional) return null
        throw new Error(`Missing baseline file: ${file}`)
      }
      return files.get(file)
    }
    const target = regularPath(file)
    if (!fs.existsSync(target) && optional) return null
    if (!fs.lstatSync(target).isFile()) throw new Error(`Expected a regular current file: ${file}`)
    return JSON.parse(fs.readFileSync(target, 'utf8'))
  }
  const load = (ref: string | null): Snapshot => {
    const products = ProductSchema.array().parse(read(ref, `${dir}/products.json`))
    const stories = StorySchema.array().parse(read(ref, `${dir}/stories.json`))
    for (const collection of [products, stories]) {
      if (new Set(collection.map(item => item.id)).size !== collection.length
          || collection.some(item => !identifier.test(item.id))) throw new Error('Unsafe or duplicate catalog identifiers')
    }
    const rows = VerdictSchema.array().parse(read(ref, `${dir}/verdicts.json`))
    if (new Set(rows.map(key)).size !== rows.length || rows.length !== products.length * stories.length
        || rows.some(row => !products.some(p => p.id === row.productId) || !stories.some(s => s.id === row.storyId))) {
      throw new Error('Verdict matrix must contain every catalog cell exactly once')
    }
    const packs: Snapshot['packs'] = {}, caches: Snapshot['caches'] = {}
    for (const product of products) {
      packs[product.id] = EvidenceSchema.array().parse(read(ref, `${dir}/evidence/${product.id}.json`))
      if (new Set(packs[product.id].map(item => item.id)).size !== packs[product.id].length) throw new Error('Duplicate evidence IDs')
    }
    for (const row of rows) caches[key(row)] = read(ref, `rankings-engine/cache/judge/${arena}/${row.productId}/${row.storyId}.json`, true)
    return { products, stories, rows, packs, caches }
  }
  const report: ReconciliationReport = { arena, baseline, retained: [], accepted: [], blocked: [] }
  let before: Snapshot, current: Snapshot
  try {
    git('merge-base', '--is-ancestor', baseline, 'HEAD')
    before = load(baseline); current = load(null)
    if (!equal(before.products, current.products) || !equal(before.stories, current.stories)) throw new Error('Roster or story taxonomy changed; dedicated review required')
  } catch (error) {
    report.blocked.push({ cell: `${arena}/*`, reason: String(error) })
    throw new ReconciliationError(report)
  }
  const oldRows = new Map(before.rows.map(row => [key(row), row]))
  const unsupported = new Set(unsupportedFlips(before.rows, current.rows, before.packs, current.packs).map(key))
  const retained: z.infer<typeof Ledger>['retained'] = []
  const origins = new Map<string, Snapshot>()
  // The model origin proves the retained judgment; the decision baseline proves
  // which evidence was already known when the raw proposal was rejected. These can
  // differ after repeated refreshes. Both must resolve to verified Git ancestors.
  const originFor = (row: Verdict): string => {
    if (validCache(before, row)) return baseline
    const ledger = Ledger.parse(read(baseline, ledgerPath))
    if (ledger.arena !== arena || ledger.identity !== identity(before)
        || new Set(ledger.retained.map(item => item.cell)).size !== ledger.retained.length) throw new Error('Retained baseline identity mismatch')
    const entry = ledger.retained.find(item => item.cell === key(row))
    if (!entry || entry.origin === baseline) throw new Error('Missing retained baseline origin')
    if (entry.decisionBaseline === baseline) throw new Error('Decision baseline must be a proper ancestor')
    git('merge-base', '--is-ancestor', entry.decisionBaseline, baseline)
    git('merge-base', '--is-ancestor', entry.origin, entry.decisionBaseline)
    let source = origins.get(entry.origin)
    if (!source) { source = load(entry.origin); origins.set(entry.origin, source) }
    let comparison = origins.get(entry.decisionBaseline)
    if (!comparison) { comparison = load(entry.decisionBaseline); origins.set(entry.decisionBaseline, comparison) }
    const previous = comparison.rows.find(item => key(item) === key(row))
    const original = source.rows.find(item => key(item) === key(row))
    const raw = Cache.parse(before.caches[key(row)]).verdict
    if (!equal(source.products, before.products) || !equal(source.stories, before.stories)
        || !equal(comparison.products, before.products) || !equal(comparison.stories, before.stories)
        || !equal(previous, row) || !equal(original, row) || !validCache(source, row) || !validCache(before, raw)
        || !supportIntact(row, source.packs[row.productId], comparison.packs[row.productId])
        || !supportIntact(row, comparison.packs[row.productId], before.packs[row.productId])
        || validateVerdictRules(raw, before.packs[row.productId], before.stories.find(item => item.id === row.storyId))
        || !unsupportedFlips([row], [raw], comparison.packs, before.packs).length) {
      throw new Error('Retained baseline origin does not prove this decision')
    }
    return entry.origin
  }
  const rows = current.rows.map(row => {
    const cell = key(row), story = current.stories.find(item => item.id === row.storyId)!
    try {
      if (!validCache(current, row)) throw new Error('Proposal does not match current-input raw judge cache')
      const invalid = validateVerdictRules(row, current.packs[row.productId], story)
      if (invalid) throw new Error(`Invalid proposal: ${invalid}`)
      if (!unsupported.has(cell)) { report.accepted.push(cell); return row }
      const old = oldRows.get(cell)!
      if (!supportIntact(old, before.packs[row.productId], current.packs[row.productId])) throw new Error('Prior cited source or excerpt changed or disappeared')
      const invalidOld = validateVerdictRules(old, current.packs[row.productId], story)
      if (invalidOld) throw new Error(`Prior verdict is invalid under current story/rubric: ${invalidOld}`)
      const origin = originFor(old)
      retained.push({ cell, origin, decisionBaseline: baseline }); report.retained.push(cell)
      return old
    } catch (error) {
      report.blocked.push({ cell, reason: error instanceof Error ? error.message : String(error) })
      return row
    }
  })
  try {
    for (const file of [ledgerPath, `${dir}/verdicts.json`]) {
      regularPath(file); regularPath(`${file}.tmp`)
    }
  } catch (error) {
    report.blocked.push({ cell: `${arena}/*`, reason: String(error) })
  }
  if (report.blocked.length) throw new ReconciliationError(report)
  const ledger: z.infer<typeof Ledger> = { version: 2, arena, identity: identity({ ...current, rows }), retained }
  // All cells are planned and validated before either canonical output is touched.
  // A crash between writes leaves an identity mismatch, which fails closed next run.
  const write = (file: string, value: unknown) => {
    const target = regularPath(file)
    regularPath(`${file}.tmp`)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(`${target}.tmp`, JSON.stringify(value, null, 2) + '\n')
    fs.renameSync(`${target}.tmp`, target)
  }
  write(ledgerPath, ledger)
  write(`${dir}/verdicts.json`, rows)
  return report
}
