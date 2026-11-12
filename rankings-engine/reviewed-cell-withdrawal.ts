/** Dormant planning primitive. No CLI, writes, workflow hook, or publication authority.
 * Trust pins must come from an independently authenticated main/review controller,
 * never from the proof, PR checkout, review comment, or proposed adjudication.
 * Activation, producer receipts and canonical review gates require separate approval.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { isDeepStrictEqual as equal } from 'node:util'
import { z } from 'zod'
import { EvidenceSchema, ProductSchema, StorySchema, VerdictSchema, type Verdict } from '../lib/schemas'
import { prepareRetainedRepair } from './refresh-reconciliation'
import { CELL_HASH_VERSION, PROMPT_VERSION, cellHash, validateVerdictRules } from './stages/judge'

const sha = z.string().regex(/^[a-f0-9]{40}$/)
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const id = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/)
const cell = z.string().regex(/^[a-z0-9][a-z0-9_-]*:[a-z0-9][a-z0-9_-]*$/)
const binding = z.object({
  repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/), repositoryUrl: z.string().min(1),
  pullRequest: z.number().int().positive(), arena: id, baseline: sha, head: sha,
  baselineSnapshot: hash, currentSnapshot: hash,
}).strict()
const decision = z.object({
  cell, findingId: z.string().min(1), findingDigest: hash, decision: z.literal('withdraw-to-authenticated-baseline'),
  baselineRowHash: hash, baselineRawCacheHash: hash, currentRowHash: hash, currentRawCacheHash: hash,
}).strict()
const adjudication = z.object({
  version: z.literal(1), status: z.literal('approved'), binding,
  reviewer: z.string().min(1), decisions: z.array(decision).min(1),
}).strict()
const trustSchema = z.object({
  repository: binding.shape.repository, repositoryUrl: z.string().min(1),
  pullRequest: binding.shape.pullRequest, arena: id, baseline: sha, head: sha,
  main: sha, adjudicationPath: z.string().regex(/^rankings-engine\/reviewed-withdrawals\/[a-z0-9_-]+\.json$/),
  adjudicationHash: hash,
}).strict()
export type WithdrawalTrust = z.infer<typeof trustSchema>
const proofSchema = z.object({
  version: z.literal(1), kind: z.literal('reviewed-cell-withdrawal'), binding,
  authority: z.object({ main: sha, path: z.string(), hash, reviewer: z.string().min(1) }).strict(),
  decisions: z.array(decision).min(1), candidateSnapshot: hash,
}).strict()
export type WithdrawalProof = z.infer<typeof proofSchema>
const bytesHash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
const valueHash = (value: unknown) => bytesHash(JSON.stringify(value))
const key = (row: Verdict) => `${row.productId}:${row.storyId}`
// File content is base64, preserving even non-UTF8 ancillary blobs exactly.
type Files = Record<string, string>
const filesHash = (files: Files) => valueHash(Object.keys(files).sort().map(file => [file, files[file]]))

function context(root: string, trust: WithdrawalTrust) {
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, maxBuffer: 128 * 1024 * 1024 })
  for (const ref of [trust.main, trust.baseline, trust.head]) {
    if (git('rev-parse', '--verify', `${ref}^{commit}`).toString().trim() !== ref) throw new Error('Commit pin mismatch')
  }
  if (git('remote', 'get-url', 'origin').toString().trim() !== trust.repositoryUrl) throw new Error('Repository origin mismatch')
  // No moving branch name is accepted. The caller authenticates that main is current.
  git('merge-base', '--is-ancestor', trust.baseline, trust.head)
  git('merge-base', '--is-ancestor', trust.baseline, trust.main)
  if (git('merge-base', '--all', trust.main, trust.head).toString().trim() !== trust.baseline) {
    throw new Error('Baseline must be the unique main/head merge base')
  }
  const readFiles = (ref: string, paths: string[], include: (file: string) => boolean = () => true): Files => {
    const files: Files = Object.create(null)
    const entries = git('ls-tree', '-rz', '--full-tree', ref, '--', ...paths).toString().split('\0').filter(Boolean)
    for (const entry of entries) {
      if (!include(entry.slice(entry.indexOf('\t') + 1))) continue
      const match = /^100644 blob ([a-f0-9]{40})\t([^\n]+)$/.exec(entry)
      if (!match) throw new Error('Snapshot requires regular Git blobs')
      files[match[2]] = git('cat-file', 'blob', match[1]).toString('base64')
    }
    return files
  }
  const text = (files: Files, file: string) => {
    if (!Object.hasOwn(files, file)) throw new Error(`Missing committed file: ${file}`)
    return Buffer.from(files[file], 'base64').toString('utf8')
  }
  const dir = `open-rankings/${trust.arena}`
  const cachePath = (row: Verdict) => `rankings-engine/cache/judge/${trust.arena}/${row.productId}/${row.storyId}.json`
  const snapshot = (ref: string) => {
    const files = readFiles(ref, [dir, 'rankings-engine/cache'], file => file === dir || file.startsWith(`${dir}/`)
      || new RegExp(`^rankings-engine/cache/[^/]+/${trust.arena}(?:/|$)`).test(file))
    const json = (file: string): unknown => JSON.parse(text(files, file))
    const products = ProductSchema.array().parse(json(`${dir}/products.json`))
    const stories = StorySchema.array().parse(json(`${dir}/stories.json`))
    // Preserve original objects after schema validation; parsing must not silently strip fields.
    const rows = json(`${dir}/verdicts.json`) as Verdict[]
    VerdictSchema.array().parse(rows)
    for (const collection of [products, stories]) {
      if (collection.some(item => !id.safeParse(item.id).success) || new Set(collection.map(item => item.id)).size !== collection.length) throw new Error('Invalid catalog')
    }
    if (!products.length || !stories.length || rows.length !== products.length * stories.length
        || new Set(rows.map(key)).size !== rows.length
        || rows.some(row => !products.some(p => p.id === row.productId) || !stories.some(s => s.id === row.storyId))) throw new Error('Incomplete or duplicate matrix')
    const packs = Object.fromEntries(products.map(product => {
      const pack = EvidenceSchema.array().parse(json(`${dir}/evidence/${product.id}.json`))
      if (new Set(pack.map(e => e.id)).size !== pack.length) throw new Error('Duplicate evidence')
      return [product.id, pack]
    }))
    const authenticate = (row: Verdict) => {
      const raw = json(cachePath(row))
      const cache = z.object({ hash: z.string(), keyVersion: z.string(), verdict: z.unknown() }).parse(raw)
      VerdictSchema.parse(cache.verdict)
      const story = stories.find(s => s.id === row.storyId)!
      if (cache.keyVersion !== CELL_HASH_VERSION || cache.hash !== cellHash(story, packs[row.productId], PROMPT_VERSION)
          || !equal(cache.verdict, row) || validateVerdictRules(row, packs[row.productId], story)) throw new Error(`Unauthenticated row/cache: ${key(row)}`)
      return bytesHash(Buffer.from(files[cachePath(row)], 'base64'))
    }
    return { files, rows, packs, stories, authenticate }
  }
  return { readFiles, text, dir, snapshot }
}

/** Read committed snapshots and trusted main adjudication. Returns a proposal in memory only. */
export function planReviewedWithdrawal(root: string, trustedPins: WithdrawalTrust) {
  const trust = trustSchema.parse(trustedPins)
  const ctx = context(root, trust)
  const authorityBytes = ctx.text(ctx.readFiles(trust.main, [trust.adjudicationPath]), trust.adjudicationPath)
  if (bytesHash(authorityBytes) !== trust.adjudicationHash) throw new Error('Adjudication digest mismatch')
  const authority = adjudication.parse(JSON.parse(authorityBytes))
  const before = ctx.snapshot(trust.baseline), current = ctx.snapshot(trust.head)
  const mainFiles = ctx.readFiles(trust.main, ['verdicts.json', 'products.json', 'stories.json'].map(file => `${ctx.dir}/${file}`))
  const mainRows = JSON.parse(ctx.text(mainFiles, `${ctx.dir}/verdicts.json`)) as Verdict[]
  VerdictSchema.array().parse(mainRows)
  if (new Set(mainRows.map(key)).size !== mainRows.length) throw new Error('Duplicate main verdict cell')
  const bound = binding.parse({ repository: trust.repository, repositoryUrl: trust.repositoryUrl, pullRequest: trust.pullRequest,
    arena: trust.arena, baseline: trust.baseline, head: trust.head,
    baselineSnapshot: filesHash(before.files), currentSnapshot: filesHash(current.files) })
  if (!equal(authority.binding, bound)) throw new Error('Stale or mismatched adjudication binding')
  for (const file of ['products.json', 'stories.json']) {
    if (before.files[`${ctx.dir}/${file}`] !== current.files[`${ctx.dir}/${file}`]
        || before.files[`${ctx.dir}/${file}`] !== mainFiles[`${ctx.dir}/${file}`]) throw new Error('Catalog or rubric changed')
  }
  if (new Set(authority.decisions.map(d => d.cell)).size !== authority.decisions.length) throw new Error('Duplicate adjudicated cell')
  // Authenticate source retention against trusted-main ancestry before composing a
  // withdrawal. Preserve its original bytes: its identity describes the source,
  // and the existing production verifier will intentionally reject this output.
  for (const source of [before, current]) {
    const retained = prepareRetainedRepair({ arena: trust.arena, main: trust.main, root,
      targets: authority.decisions.map(d => d.cell),
      candidate: file => Object.hasOwn(source.files, file) ? ctx.text(source.files, file) : null })
    for (const row of source.rows) if (!retained?.cells.has(key(row))) source.authenticate(row)
  }
  const replacements = new Map<string, Verdict>()
  for (const d of authority.decisions) {
    const previous = before.rows.find(row => key(row) === d.cell), proposed = current.rows.find(row => key(row) === d.cell)
    if (previous && !equal(previous, mainRows.find(row => key(row) === d.cell))) throw new Error('Trusted main target decision changed since baseline')
    if (!previous || !proposed || previous.verdict !== 'none' || previous.quality !== 0
        || previous.evidenceIds.length !== 0 || previous.support?.relation !== 'absent'
        || previous.support.coverage !== 'none' || previous.support.citations.length !== 0
        || !['partial', 'full'].includes(proposed.verdict) || proposed.quality <= 0) throw new Error('Withdrawal requires none/0 baseline and positive current proposal')
    if (before.authenticate(previous) !== d.baselineRawCacheHash || current.authenticate(proposed) !== d.currentRawCacheHash
        || valueHash(previous) !== d.baselineRowHash || valueHash(proposed) !== d.currentRowHash) throw new Error('Adjudicated row/cache digest mismatch')
    if (validateVerdictRules(previous, current.packs[previous.productId], current.stories.find(s => s.id === previous.storyId))) throw new Error('Baseline row invalid under current inputs')
    replacements.set(d.cell, previous)
  }
  const rows = current.rows.map(row => replacements.get(key(row)) ?? row)
  const files = { ...current.files, [`${ctx.dir}/verdicts.json`]: Buffer.from(JSON.stringify(rows, null, 2) + '\n').toString('base64') }
  const proof: WithdrawalProof = { version: 1, kind: 'reviewed-cell-withdrawal', binding: bound,
    authority: { main: trust.main, path: trust.adjudicationPath, hash: trust.adjudicationHash, reviewer: authority.reviewer },
    decisions: authority.decisions, candidateSnapshot: filesHash(files) }
  return { proof, files, rows }
}

/** Rebuild from independent trust pins; a supplied proof cannot approve itself. */
export function verifyReviewedWithdrawal(root: string, trustedPins: WithdrawalTrust, proof: unknown, candidateFiles: Record<string, string>): void {
  const parsed = proofSchema.parse(proof)
  const expected = planReviewedWithdrawal(root, trustedPins)
  if (!equal(parsed, expected.proof) || !equal(candidateFiles, expected.files)) throw new Error('Withdrawal proof or candidate mismatch')
}
