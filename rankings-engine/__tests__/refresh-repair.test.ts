import { describe, expect, it } from 'vitest'
import { allowed, mergeData, projection, restoreChurn, rowAtLine } from '../refresh-repair'
import type { Evidence, Verdict } from '../../lib/schemas'
const old: Verdict = { productId: 'vendor', storyId: 'story', verdict: 'partial', quality: 5, confidence: 'high', rationale: 'missing for 10: callback documentation', evidenceIds: ['old'] }
const evidence = (id: string): Evidence => ({ id, tier: 'claimed-docs', url: 'https://example.invalid/docs', excerpt: 'Documented behavior', fetchedAt: '2026-10-30T00:00:00Z' })
describe('refresh repair policy', () => {
  it('restores a previous judged cell for unsupported grade and quality churn', () => {
    const proposed = { ...old, verdict: 'full' as const, quality: 9 }
    const result = restoreChurn([old], [proposed], { vendor: [evidence('old')] }, { vendor: [evidence('old')] })
    expect(result.rows).toEqual([old]); expect(result.restored).toEqual(['vendor:story'])
  })
  it('preserves changed grades citing new evidence', () => {
    const proposed = { ...old, quality: 9, evidenceIds: ['new'] }
    expect(restoreChurn([old], [proposed], { vendor: [evidence('old')] }, { vendor: [evidence('new')] }).rows).toEqual([proposed])
  })
  it('blocks restoration when old citations disappeared', () => {
    const proposed = { ...old, quality: 9, evidenceIds: [] }
    const result = restoreChurn([old], [proposed], { vendor: [evidence('old')] }, { vendor: [] })
    expect(result.blocked).toEqual(['vendor:story']); expect(result.restored).toEqual([])
  })
  it('restricts writes to one arena, caches and declared projections', () => {
    expect(allowed('open-rankings/email/verdicts.json', 'email')).toBe(true)
    expect(allowed('rankings-engine/cache/judge/email/vendor/story.json', 'email')).toBe(true)
    for (const file of ['.github/workflows/ci.yml', 'package.json', 'open-rankings/email/../../lib/schemas.ts', 'open-rankings/email/evil.ts', 'open-rankings/payments/verdicts.json']) expect(allowed(file, 'email')).toBe(false)
    expect(projection('open-rankings/email/score-history.jsonl', 'email')).toBe(true)
    expect(projection('open-rankings/email/evidence/vendor.json', 'email')).toBe(false)
  })
  it('does not discard concurrent canonical edits', () => {
    expect(() => mergeData('old', 'new main', 'new PR', 'evidence.json')).toThrow('Concurrent source edits')
    expect(mergeData('old', 'old', 'new PR', 'evidence.json')).toBe('new PR')
    expect(mergeData('old', 'new main', 'old', 'evidence.json')).toBe('new main')
    expect(mergeData('old', 'old', null, 'evidence.json')).toBeNull()
  })
  it('unions append-only uptime while rejecting rewritten history', () => {
    expect(mergeData('a\n', 'a\nb\n', 'a\nc\n', 'open-rankings/slo-history.jsonl')).toBe('a\nb\nc\n')
    expect(() => mergeData('a\n', 'b\n', 'a\nc\n', 'open-rankings/slo-history.jsonl')).toThrow()
  })
  it('maps an inline review to the exact original cell', () => {
    const other = { ...old, storyId: 'other' }
    const text = JSON.stringify([old, other], null, 2)
    const line = text.split('\n').findIndex(line => line.includes('"other"')) + 1
    expect(rowAtLine(text, line)?.storyId).toBe('other')
    expect(rowAtLine(text, 1)).toBeNull()
    expect(() => rowAtLine(JSON.stringify([old]), 1)).toThrow('Cannot map')
  })
})
