import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { parseArgs } from 'node:util'
import { loadProcessCatalog, validateExecutionCoverage } from '../../lib/shared-processes/catalog'
import { executionOf, requiresExecutionApproval, type Execution } from '../../lib/execution'
import type { Part } from '../../lib/shared-processes/schema'

const { values } = parseArgs({ options: { output: { type: 'string' }, baseline: { type: 'string' } } })
const { processes } = loadProcessCatalog()
validateExecutionCoverage(processes.map(process => process.record))
const rows: Array<{ process: string; scope: string; title: string | null; legacyRoute: unknown; signature: boolean; approval: unknown; execution: Execution }> = []
let explicitApprovals = 0
for (const process of processes) {
  function add(scope: string, title: string | null, metadata: Record<string, unknown>) {
    const execution = executionOf(metadata)
    if (execution && requiresExecutionApproval(metadata)) explicitApprovals++
    if (execution) rows.push({ process: process.slug, scope, title, legacyRoute: metadata.route ?? null, signature: metadata.legalSignature === true,
      approval: metadata.approval ?? metadata.approvalRequired ?? null, execution })
  }
  function visit(parts: Part[], scope: string) {
    for (const part of parts) {
      const key = `${scope}/${part.id}`
      add(key, part.title, part.metadata)
      for (const option of part.options) { add(`${key}/${option.id}`, option.title, option.metadata); visit(option.parts, `${key}/${option.id}`) }
    }
  }
  visit(process.record.parts, process.record.id)
}
const categories: Record<string, number> = {}
for (const row of rows) categories[row.execution.category ?? 'unresolved'] = (categories[row.execution.category ?? 'unresolved'] ?? 0) + 1
const report = { records: processes.length, assessedRecords: new Set(rows.map(row => row.process)).size, scopes: rows.length, categories,
  reviewRequired: rows.filter(row => row.execution.reviewRequired).length, signatures: rows.filter(row => row.signature).length,
  explicitApprovals, rows }
if (values.baseline) {
  const baseline = JSON.parse(readFileSync(values.baseline, 'utf8')) as { records: Record<string, string> }
  const strip = (value: unknown): unknown => Array.isArray(value) ? value.map(strip) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'execution').sort(([a], [b]) => a.localeCompare(b, 'en', { sensitivity: 'variant' })).map(([key, item]) => [key, strip(item)])) : value
  // JSON property order is irrelevant to this comparison. The baseline contains
  // canonical source hashes, allowing exact preservation without relying on git availability.
  for (const file of Object.keys(baseline.records)) {
    const value = strip(JSON.parse(readFileSync(file, 'utf8')))
    const stable = (v: unknown): string => Array.isArray(v) ? `[${v.map(stable).join(',')}]` : v && typeof v === 'object'
      ? `{${Object.keys(v).sort().map(key => `${JSON.stringify(key)}:${stable((v as Record<string, unknown>)[key])}`).join(',')}}` : JSON.stringify(v)
    const hash = createHash('sha256').update(stable(value)).digest('hex')
    if (hash !== baseline.records[file]) throw new Error(`${file}: non-execution content differs from migration baseline`)
  }
}
if (values.output) writeFileSync(values.output, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ ...report, rows: undefined }, null, 2))
