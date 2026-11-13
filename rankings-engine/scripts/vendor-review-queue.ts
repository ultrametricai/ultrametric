// Reconstruct unresolved review work from retained reports, independent of today's scan.
// Automated triage can add evidence but cannot clear a request for human review.
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { TriageReportSchema, buildTriageMarkdown, type Disposition, type TriageReport } from './radar-triage'
import { buildNeedsHumanIssue } from './needs-human-issue'

export const ReviewLedgerSchema = z.object({
  schemaVersion: z.literal(1),
  // Older issues may contain decisions not yet migrated. Do not reopen them by inference.
  reportsFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  decisions: z.array(z.object({
    key: z.string(), outcome: z.enum(['approved', 'rejected', 'deferred']),
    reason: z.string().min(1), evidence: z.array(z.string().url()).min(1),
    decidedBy: z.string().min(1), decidedAt: z.string().datetime(),
  })),
  placementCorrections: z.array(z.object({
    key: z.string(), arena: z.string().nullable(), reason: z.string().min(1),
    evidence: z.array(z.string().url()).min(1),
  })),
}).superRefine((ledger, ctx) => {
  for (const field of ['decisions', 'placementCorrections'] as const) {
    const keys = ledger[field].map((row) => row.key)
    if (new Set(keys).size !== keys.length) ctx.addIssue({ code: 'custom', message: `duplicate ${field} keys` })
  }
})
export type ReviewLedger = z.infer<typeof ReviewLedgerSchema>
export type ReviewSource = { path: string; report: TriageReport }
export type ReviewCase = { disposition: Disposition; reports: string[] }

export function buildReviewQueue(sources: ReviewSource[], ledger: ReviewLedger): ReviewCase[] {
  const cases = new Map<string, ReviewCase>()
  const decisions = new Map(ledger.decisions.map((d) => [d.key, d]))
  // Stable ordering makes retries and reordered imports produce the same queue.
  for (const source of [...sources].sort((a, b) => a.report.generatedAt.localeCompare(b.report.generatedAt) || a.path.localeCompare(b.path))) {
    if (source.report.generatedAt.slice(0, 10) < ledger.reportsFrom) continue
    for (const disposition of source.report.dispositions) {
      if (disposition.status !== 'needs-human') continue
      const prior = cases.get(disposition.key)
      cases.set(disposition.key, {
        disposition: structuredClone(disposition),
        reports: [...new Set([...(prior?.reports ?? []), source.path])].sort(),
      })
    }
  }
  return [...cases.values()].filter(({ disposition }) => {
    const decision = decisions.get(disposition.key)
    return !decision || decision.outcome === 'deferred'
  }).map((entry) => {
    const correction = ledger.placementCorrections.find((c) => c.key === entry.disposition.key)
    if (correction) entry.disposition = {
      ...entry.disposition, arena: correction.arena, criterion: 'ranking-fit',
      reason: `${correction.reason} Original review requirement: ${entry.disposition.reason}`,
      evidence: [...entry.disposition.evidence, ...correction.evidence], bringup: null,
    }
    const decision = decisions.get(entry.disposition.key)
    if (decision?.outcome === 'deferred') entry.disposition.reason += ` Deferred by ${decision.decidedBy}: ${decision.reason}`
    return entry
  }).sort((a, b) => a.disposition.key.localeCompare(b.disposition.key))
}

// Review decisions are not permission for the automatic bring-up path. A prior review
// requirement survives later popularity changes and lexical reclassification.
export function guardAutomaticBringup(report: TriageReport, sources: ReviewSource[], ledger: ReviewLedger): TriageReport {
  const reviewedKeys = new Set(sources.flatMap((source) => source.report.dispositions
    .filter((row) => row.status === 'needs-human').map((row) => row.key)))
  for (const row of [...ledger.decisions, ...ledger.placementCorrections]) reviewedKeys.add(row.key)
  return { ...report, dispositions: report.dispositions.map((row) => {
    if (row.status !== 'auto-approved' || !reviewedKeys.has(row.key)) return row
    return { ...row, status: 'skipped' as const, bringup: null,
      reason: 'Prior human-review requirement or recorded decision: automatic re-triage does not authorize bring-up. Use a separate reviewed bring-up after reconciling the review ledger.',
      evidence: [...row.evidence, 'rankings-engine/vendor-review-ledger.json'],
    }
  }) }
}

export function loadReviewSources(root: string): ReviewSource[] {
  const sources: ReviewSource[] = []
  function visit(dir: string): void {
    if (!fs.existsSync(dir)) return
    for (const file of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, file.name)
      if (file.isDirectory()) visit(full)
      else if (file.name.endsWith('-triage.json') && full.includes(`${path.sep}vendor-radar${path.sep}`)) {
        // Malformed reports fail closed instead of silently dropping pending candidates.
        sources.push({ path: path.relative(root, full).split(path.sep).join('/'),
          report: TriageReportSchema.parse(JSON.parse(fs.readFileSync(full, 'utf8'))) })
      }
    }
  }
  visit(path.join(root, 'reports/vendor-radar'))
  visit(path.join(root, 'reports/radar-imports/files'))
  return sources
}

export function renderReviewQueue(queue: ReviewCase[]): string {
  const body = buildNeedsHumanIssue({ generatedAt: '1970-01-01',
    policy: 'policies/AGENT_POLICY.md#vendor-radar-candidate-approval',
    dispositions: queue.map((entry) => entry.disposition),
  }, 'vendor-radar')
  const header = '## Vendor review queue\n\nUnresolved requests are carried across scans. A new scan or issue closure does not resolve them. Record a cited human decision in `rankings-engine/vendor-review-ledger.json`; approval here does not run bring-up or publish rankings.\n\n'
  if (!body) return header + 'No pending candidates in the migrated queue. Older issues are retained separately until their decisions are reconciled.\n'
  return header + body.replace(/^## .*\n\n/, '') + '\n\n### Source reports\n' + queue.map((entry) =>
    `- \`${entry.disposition.key}\`: ${entry.reports.map((report) => `\`${report}\``).join(', ')}`).join('\n') + '\n'
}

if (require.main === module) {
  const args = process.argv.slice(2)
  const out = args[args.indexOf('--out') + 1]
  if (!args.includes('--out') || !out) throw new Error('usage: vendor-review-queue.ts --out <issue.md>')
  const root = process.cwd()
  const ledger = ReviewLedgerSchema.parse(JSON.parse(fs.readFileSync(path.join(root, 'rankings-engine/vendor-review-ledger.json'), 'utf8')))
  const sources = loadReviewSources(root)
  if (args.includes('--triage')) {
    const triagePath = args[args.indexOf('--triage') + 1]
    const mdPath = args[args.indexOf('--triage-md') + 1]
    if (!triagePath || !args.includes('--triage-md') || !mdPath) throw new Error('--triage requires a path and --triage-md')
    if (fs.existsSync(triagePath)) {
      const current = TriageReportSchema.parse(JSON.parse(fs.readFileSync(triagePath, 'utf8')))
      const guarded = guardAutomaticBringup(current, sources, ledger)
      fs.writeFileSync(triagePath, JSON.stringify(guarded, null, 2) + '\n')
      fs.writeFileSync(mdPath, buildTriageMarkdown(guarded) + '\n')
    }
  }
  const queue = buildReviewQueue(sources, ledger)
  fs.writeFileSync(out, renderReviewQueue(queue))
  if (args.includes('--count')) {
    const countPath = args[args.indexOf('--count') + 1]
    if (!countPath) throw new Error('--count requires a path')
    fs.writeFileSync(countPath, `${queue.length}\n`)
  }
  console.log(`vendor-review-queue: ${queue.length} pending candidates`)
}
