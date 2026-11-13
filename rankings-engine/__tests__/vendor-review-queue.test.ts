import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildReviewQueue, guardAutomaticBringup, loadReviewSources, renderReviewQueue, ReviewLedgerSchema, type ReviewLedger, type ReviewSource } from '../scripts/vendor-review-queue'
import type { Disposition } from '../scripts/radar-triage'

const ledger: ReviewLedger = { schemaVersion: 1, reportsFrom: '2026-11-12', decisions: [], placementCorrections: [] }
function source(key: string, day: string, status: Disposition['status'] = 'needs-human'): ReviewSource {
  return { path: `reports/vendor-radar/runs/${day}-${key}-triage.json`, report: {
    generatedAt: `${day}T08:00:00Z`, policy: 'policy', dispositions: [{
      key, name: key, url: 'https://example.com', arena: 'ai-coding', status,
      criterion: 'shipped-product', reason: 'Review popularity', evidence: [], bringup: null,
    }],
  } }
}

describe('durable vendor review queue', () => {
  it('retains disjoint candidates on later days and empty scan days', () => {
    const first = source('old', '2026-11-12')
    const next = source('new', '2026-11-13')
    const empty = { ...next, report: { ...next.report, dispositions: [] } }
    expect(buildReviewQueue([first, next, empty], ledger).map((c) => c.disposition.key)).toEqual(['new', 'old'])
    expect(buildReviewQueue([first, empty], ledger).map((c) => c.disposition.key)).toEqual(['old'])
  })
  it('does not resolve human review from a later automated skip or approval', () => {
    for (const status of ['skipped', 'auto-approved'] as const) {
      expect(buildReviewQueue([source('x', '2026-11-12'), source('x', '2026-11-13', status)], ledger)).toHaveLength(1)
    }
  })
  it('preserves explicit cited human decisions across new scans', () => {
    const decision = { key: 'x', outcome: 'rejected' as const, reason: 'Not suitable',
      evidence: ['https://github.com/org/repo/issues/1#issuecomment-123'], decidedBy: 'maintainer', decidedAt: '2026-11-12T09:00:00Z' }
    for (const outcome of ['approved', 'rejected'] as const) {
      const decided = { ...ledger, decisions: [{ ...decision, outcome }] }
      expect(buildReviewQueue([source('x', '2026-11-12'), source('x', '2026-11-13')], decided)).toEqual([])
      expect(decided.decisions[0].outcome).toBe(outcome)
    }
    expect(buildReviewQueue([source('x', '2026-11-12')], { ...ledger, decisions: [{ ...decision, outcome: 'deferred' }] })).toHaveLength(1)
  })
  it('withholds later auto-approval from bring-up after any prior human review', () => {
    const previous = source('x', '2026-11-12')
    const current = source('x', '2026-11-13', 'auto-approved').report
    const guarded = guardAutomaticBringup(current, [previous], ledger)
    expect(guarded.dispositions[0]).toMatchObject({ status: 'skipped', bringup: null })
    expect(current.dispositions[0].status).toBe('auto-approved')
    expect(guardAutomaticBringup(current, [], ledger).dispositions[0].status).toBe('auto-approved')
    for (const outcome of ['approved', 'rejected', 'deferred'] as const) {
      const decided = { ...ledger, decisions: [{ key: 'x', outcome, reason: 'Human call',
        evidence: ['https://example.com/decision'], decidedBy: 'maintainer', decidedAt: '2026-11-12T09:00:00Z' }] }
      expect(guardAutomaticBringup(current, [], decided).dispositions[0].status).toBe('skipped')
    }
    const correction = { ...ledger, placementCorrections: [{ key: 'x', arena: null, reason: 'Wrong fit', evidence: ['https://example.com/docs'] }] }
    expect(guardAutomaticBringup(current, [], correction).dispositions[0].status).toBe('skipped')
  })
  it('deduplicates reports and produces stable ordering without mutating evidence', () => {
    const sources = [source('b', '2026-11-12'), source('a', '2026-11-13'), source('b', '2026-11-13')]
    const before = JSON.stringify(sources)
    expect(buildReviewQueue([...sources, sources[0]], ledger)).toEqual(buildReviewQueue([...sources].reverse(), ledger))
    expect(JSON.stringify(sources)).toBe(before)
  })
  it('does not reopen older human calls whose dispositions have not been migrated', () => {
    expect(buildReviewQueue([source('old', '2026-11-11')], ledger)).toEqual([])
  })
  it('applies cited category corrections without approving the vendor', () => {
    const corrected = { ...ledger, placementCorrections: [{ key: 'x', arena: null, reason: 'Unsupported category', evidence: ['https://example.com/docs'] }] }
    const queue = buildReviewQueue([source('x', '2026-11-12')], corrected)
    expect(queue[0].disposition).toMatchObject({ arena: null, criterion: 'ranking-fit', status: 'needs-human', bringup: null })
    expect(renderReviewQueue(queue)).toContain('https://example.com/docs')
  })
  it('validates cited decisions and rejects duplicate decision keys', () => {
    expect(ReviewLedgerSchema.safeParse({ ...ledger, decisions: [{ key: 'x', outcome: 'approved' }] }).success).toBe(false)
    const correction = { key: 'x', arena: null, reason: 'Bad category', evidence: ['https://example.com'] }
    expect(ReviewLedgerSchema.safeParse({ ...ledger, placementCorrections: [correction, correction] }).success).toBe(false)
  })
  it('loads immutable and imported triage history, and fails on malformed reports', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vendor-review-'))
    try {
      for (const dir of ['reports/vendor-radar/runs', 'reports/radar-imports/files/hash/reports/vendor-radar']) {
        fs.mkdirSync(path.join(root, dir), { recursive: true })
        fs.writeFileSync(path.join(root, dir, 'test-triage.json'), JSON.stringify(source('x', '2026-11-12').report))
      }
      expect(loadReviewSources(root)).toHaveLength(2)
      fs.writeFileSync(path.join(root, 'reports/vendor-radar/runs/bad-triage.json'), '{}')
      expect(() => loadReviewSources(root)).toThrow()
    } finally { fs.rmSync(root, { recursive: true, force: true }) }
  })
  it('restores the verified superseded candidates and corrects NOIR in the committed corpus', () => {
    const root = path.resolve(__dirname, '../..')
    const saved = ReviewLedgerSchema.parse(JSON.parse(fs.readFileSync(path.join(root, 'rankings-engine/vendor-review-ledger.json'), 'utf8')))
    const queue = buildReviewQueue(loadReviewSources(root), saved)
    for (const key of ['domain:reavideo.ai', 'domain:misterdownloadmanager.com', 'domain:openidea.sh']) {
      // Later explicit decisions legitimately remove a candidate from pending review.
      if (!saved.decisions.some((d) => d.key === key && d.outcome !== 'deferred')) expect(queue.some((c) => c.disposition.key === key)).toBe(true)
    }
    const noir = queue.find((c) => c.disposition.key === 'domain:verlintas.dev')
    if (noir) expect(noir.disposition.arena).toBeNull()
  })
  it('removes date-based supersession from the vendor workflow', () => {
    const workflow = fs.readFileSync(path.resolve(__dirname, '../../.github/workflows/vendor-radar.yml'), 'utf8')
    expect(workflow).not.toContain('close-superseded.ts')
    expect(workflow).toContain('TITLE="vendor-radar: unresolved review queue"')
    expect(workflow).toContain('name: Rebuild durable vendor review queue')
    expect(workflow).toContain('gh issue comment "$EXISTING" --body-file')
    expect(workflow).not.toContain('gh issue edit "$EXISTING" --body-file')
  })
})
