// Settle unsupported target-product churn from the scoped PR #563 evidence repair.
//
// The 2026-11-03 scoped judge reran every Zoom Scribe and turbopuffer cell after
// adding omitted first-party machine-API evidence. Most Zoom changes cited those
// new rows and stand. turbopuffer's api-machine-spec change also stands. These 14
// cells do not:
//
// - eleven turbopuffer cells either cite no changed evidence or map the new
//   OpenAPI rows onto the adjacent interactive-docs story;
// - Zoom's one-off batch-job primitives do not satisfy autonomous automations;
// - Zoom gained no concurrency-limit evidence, so batch-concurrency cannot rise;
// - the new API catalog does not justify lowering the already-supported streaming
//   endpoint quality.
//
// The committed PR head before the repair is the baseline. This script is
// deliberately explicit and fail-closed: every target must be either at the exact
// expected re-roll label/quality or already equal to its baseline row, and each
// cache verdict must match the working verdict before replacement. Cache hashes
// are preserved so the adjudication remains stable for the unchanged evidence.
//
// Usage:
//   pnpm exec tsx rankings-engine/scripts/settle-submissions-489-490-scoped-judge-churn-2026-11-03.ts
//   pnpm exec tsx rankings-engine/scripts/settle-submissions-489-490-scoped-judge-churn-2026-11-03.ts --write

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const WRITE = process.argv.includes('--write')
const BASELINE_REF = '962395fb227e6167699d96ef700b657688513aee'

type VerdictLabel = 'full' | 'partial' | 'none' | 'disputed' | 'na'

type VerdictRow = {
  productId: string
  storyId: string
  verdict: VerdictLabel
  quality: number
  confidence: 'high' | 'medium' | 'low'
  rationale: string
  evidenceIds: string[]
}

type Target = {
  category: 'speech-to-text' | 'vector-databases'
  productId: 'zoom-scribe' | 'turbopuffer'
  storyId: string
  from: [VerdictLabel, number]
  to: [VerdictLabel, number]
  reason: string
}

const TARGETS: Target[] = [
  {
    category: 'speech-to-text', productId: 'zoom-scribe',
    storyId: 'agentic-autonomous-automation', from: ['partial', 4], to: ['none', 0],
    reason: 'one-off batch jobs are developer primitives, not configurable autonomous automations',
  },
  {
    category: 'speech-to-text', productId: 'zoom-scribe',
    storyId: 'batch-concurrency', from: ['partial', 5], to: ['partial', 3],
    reason: 'new lifecycle evidence still gives no concurrent-job limits or scheduling behavior',
  },
  {
    category: 'speech-to-text', productId: 'zoom-scribe',
    storyId: 'streaming-endpoint', from: ['full', 8], to: ['full', 9],
    reason: 'the new API catalog does not contradict or weaken the existing streaming evidence',
  },
  {
    category: 'vector-databases', productId: 'turbopuffer',
    storyId: 'api-interactive-docs', from: ['partial', 3], to: ['none', 0],
    reason: 'a downloadable OpenAPI file is not an interactive reference with runnable requests',
  },
  {
    category: 'vector-databases', productId: 'turbopuffer',
    storyId: 'backup-restore-snapshots', from: ['full', 7], to: ['partial', 6],
    reason: 'unchanged evidence; restore remains implied rather than documented',
  },
  {
    category: 'vector-databases', productId: 'turbopuffer',
    storyId: 'bulk-import-export', from: ['partial', 4], to: ['partial', 5],
    reason: 'unchanged evidence re-roll',
  },
  {
    category: 'vector-databases', productId: 'turbopuffer',
    storyId: 'hybrid-dense-sparse-search', from: ['full', 9], to: ['full', 8],
    reason: 'unchanged evidence re-roll',
  },
  {
    category: 'vector-databases', productId: 'turbopuffer',
    storyId: 'integrated-embedding-generation', from: ['full', 8], to: ['full', 7],
    reason: 'unchanged evidence re-roll',
  },
  {
    category: 'vector-databases', productId: 'turbopuffer',
    storyId: 'live-upserts-freshness', from: ['full', 8], to: ['full', 7],
    reason: 'unchanged evidence re-roll',
  },
  {
    category: 'vector-databases', productId: 'turbopuffer',
    storyId: 'managed-cloud-offering', from: ['full', 7], to: ['partial', 6],
    reason: 'unchanged evidence re-roll',
  },
  {
    category: 'vector-databases', productId: 'turbopuffer',
    storyId: 'metadata-filtered-search', from: ['full', 7], to: ['full', 8],
    reason: 'unchanged evidence re-roll',
  },
  {
    category: 'vector-databases', productId: 'turbopuffer',
    storyId: 'multi-tenant-isolation', from: ['full', 7], to: ['partial', 5],
    reason: 'unchanged evidence re-roll',
  },
  {
    category: 'vector-databases', productId: 'turbopuffer',
    storyId: 'openness-self-host', from: ['partial', 3], to: ['none', 0],
    reason: 'unchanged BYOC mention does not establish self-hosting the core product',
  },
  {
    category: 'vector-databases', productId: 'turbopuffer',
    storyId: 'published-latency-benchmarks', from: ['partial', 4], to: ['partial', 5],
    reason: 'unchanged evidence re-roll',
  },
]

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T
}

function baselineRows(category: string): VerdictRow[] {
  const file = `open-rankings/${category}/verdicts.json`
  const raw = execFileSync('git', ['show', `${BASELINE_REF}:${file}`], {
    cwd: ROOT,
    maxBuffer: 64 * 1024 * 1024,
  })
  return JSON.parse(raw.toString('utf8')) as VerdictRow[]
}

function sameRow(a: VerdictRow, b: VerdictRow): boolean {
  return a.productId === b.productId
    && a.storyId === b.storyId
    && a.verdict === b.verdict
    && a.quality === b.quality
    && a.confidence === b.confidence
    && a.rationale === b.rationale
    && a.evidenceIds.length === b.evidenceIds.length
    && a.evidenceIds.every((id, index) => id === b.evidenceIds[index])
}

function key(row: Pick<VerdictRow, 'productId' | 'storyId'>): string {
  return `${row.productId}:${row.storyId}`
}

function assertLabel(row: VerdictRow, expected: [VerdictLabel, number], context: string): void {
  if (row.verdict !== expected[0] || row.quality !== expected[1]) {
    throw new Error(
      `${context}: expected ${expected[0]}/q${expected[1]}, got ${row.verdict}/q${row.quality}`,
    )
  }
}

function main(): void {
  const categories = [...new Set(TARGETS.map((target) => target.category))]
  const currentByCategory = new Map<string, VerdictRow[]>()
  const baselineByCategory = new Map<string, Map<string, VerdictRow>>()

  for (const category of categories) {
    currentByCategory.set(
      category,
      readJson<VerdictRow[]>(path.join(ROOT, 'open-rankings', category, 'verdicts.json')),
    )
    baselineByCategory.set(
      category,
      new Map(baselineRows(category).map((row) => [key(row), row])),
    )
  }

  let pending = 0
  let already = 0

  for (const target of TARGETS) {
    const rows = currentByCategory.get(target.category)!
    const rowIndex = rows.findIndex(
      (row) => row.productId === target.productId && row.storyId === target.storyId,
    )
    if (rowIndex < 0) throw new Error(`${target.category}/${target.productId}:${target.storyId}: row missing`)

    const baseline = baselineByCategory.get(target.category)!.get(
      `${target.productId}:${target.storyId}`,
    )
    if (!baseline) throw new Error(`${target.category}/${target.productId}:${target.storyId}: baseline missing`)
    assertLabel(baseline, target.to, `${target.category}/${target.productId}:${target.storyId} baseline`)

    const current = rows[rowIndex]
    const cacheFile = path.join(
      ROOT,
      'rankings-engine',
      'cache',
      'judge',
      target.category,
      target.productId,
      `${target.storyId}.json`,
    )
    const cache = readJson<{ hash: string; keyVersion?: string; verdict: VerdictRow }>(cacheFile)

    if (sameRow(current, baseline) && sameRow(cache.verdict, baseline)) {
      already++
      console.log(`ALREADY ${target.category}/${target.productId}:${target.storyId} ${baseline.verdict}/q${baseline.quality}`)
      continue
    }

    assertLabel(current, target.from, `${target.category}/${target.productId}:${target.storyId} working verdict`)
    if (!sameRow(cache.verdict, current)) {
      throw new Error(`${target.category}/${target.productId}:${target.storyId}: cache and verdicts.json disagree`)
    }

    pending++
    console.log(
      `SETTLE ${target.category}/${target.productId}:${target.storyId} `
      + `${current.verdict}/q${current.quality} -> ${baseline.verdict}/q${baseline.quality} — ${target.reason}`,
    )

    if (WRITE) {
      rows[rowIndex] = { ...baseline }
      const originalHash = cache.hash
      cache.verdict = { ...baseline }
      fs.writeFileSync(cacheFile, `${JSON.stringify(cache, null, 2)}\n`)
      const reread = readJson<{ hash: string; verdict: VerdictRow }>(cacheFile)
      if (reread.hash !== originalHash || !sameRow(reread.verdict, baseline)) {
        throw new Error(`${target.category}/${target.productId}:${target.storyId}: cache write verification failed`)
      }
    }
  }

  if (WRITE) {
    for (const category of categories) {
      const file = path.join(ROOT, 'open-rankings', category, 'verdicts.json')
      fs.writeFileSync(file, `${JSON.stringify(currentByCategory.get(category), null, 2)}\n`)
    }
  }

  console.log(`${pending} target cell(s) ${WRITE ? 'settled' : 'would settle'}; ${already} already settled`)
  console.log(WRITE ? 'Applied and verified.' : 'Dry run only — pass --write to apply.')
}

main()
