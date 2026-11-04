import { describe, expect, it } from 'vitest'
import { buildNeedsHumanIssue, needsHumanRows } from '../scripts/needs-human-issue'
import type { Disposition, TriageReport } from '../scripts/radar-triage'

// The generator workflows file an issue only when the triage routed a candidate to a human;
// auto-approved and skipped dispositions ride the scan PR body. These tests pin that contract:
// a triage without needs-human rows builds no issue at all.

function disposition(overrides: Partial<Disposition> = {}): Disposition {
  return {
    key: 'domain:driftbase.dev',
    name: 'Driftbase',
    url: 'https://driftbase.dev',
    arena: 'browser-agents',
    status: 'auto-approved',
    criterion: null,
    reason: 'existing-arena fit',
    evidence: [],
    bringup: null,
    ...overrides,
  }
}

function triage(dispositions: Disposition[]): TriageReport {
  return {
    generatedAt: '2026-10-23T08:31:00.000Z',
    policy: 'policies/AGENT_POLICY.md#vendor-radar-candidate-approval',
    dispositions,
  }
}

describe('needsHumanRows', () => {
  it('keeps only the needs-human dispositions', () => {
    const rows = needsHumanRows(
      triage([
        disposition(),
        disposition({ key: 'domain:skip.me', name: 'SkipMe', status: 'skipped', criterion: 'docs-surface', reason: 'no docs' }),
        disposition({ key: 'domain:call.me', name: 'CallMe', status: 'needs-human', criterion: 'founder-affiliation', reason: 'affiliated' }),
      ]),
    )
    expect(rows.map((r) => r.name)).toEqual(['CallMe'])
  })
})

describe('buildNeedsHumanIssue', () => {
  it('returns null when nothing needs a human — no issue gets filed', () => {
    expect(buildNeedsHumanIssue(triage([]), 'vendor-radar')).toBeNull()
    expect(
      buildNeedsHumanIssue(
        triage([disposition(), disposition({ key: 'domain:skip.me', name: 'SkipMe', status: 'skipped', criterion: 'ranking-fit', reason: 'weak fit' })]),
        'vendor-radar',
      ),
    ).toBeNull()
  })

  it('renders only the needs-human rows, with their evidence and the policy reference', () => {
    const body = buildNeedsHumanIssue(
      triage([
        disposition({ key: 'domain:auto.ok', name: 'AutoOk' }),
        disposition({
          key: 'domain:affiliated.dev',
          name: 'Affiliated',
          url: 'https://affiliated.dev',
          status: 'needs-human',
          criterion: 'founder-affiliation',
          reason: 'founder-affiliated products require human review, disclosure, and a bias audit',
          evidence: ['https://affiliated.dev — HTTP 200'],
        }),
        disposition({
          key: 'github:x/anomaly',
          name: 'Anomaly',
          url: 'https://github.com/x/anomaly',
          status: 'needs-human',
          criterion: 'shipped-product',
          reason: 'star velocity ~900/day exceeds the anomaly floor',
          evidence: [],
        }),
      ]),
      'yc-coverage',
    )
    expect(body).not.toBeNull()
    expect(body).toContain('## yc-coverage: candidates needing a human call — 2026-10-23')
    expect(body).toContain('2 of 3 triaged candidates need a human decision')
    expect(body).toContain('`policies/AGENT_POLICY.md#vendor-radar-candidate-approval`')
    expect(body).toContain('| [Affiliated](https://affiliated.dev) | `browser-agents` | founder-affiliation |')
    expect(body).toContain('| [Anomaly](https://github.com/x/anomaly) |')
    expect(body).toContain('- **Affiliated**')
    expect(body).toContain('  - https://affiliated.dev — HTTP 200')
    // Auto-approved rows stay off the issue: they ride the scan PR body.
    expect(body).not.toContain('AutoOk')
    expect(body).not.toContain('undefined')
  })

  it('keeps singular/plural agreement for a single-candidate triage', () => {
    const body = buildNeedsHumanIssue(
      triage([disposition({ status: 'needs-human', criterion: 'founder-affiliation', reason: 'affiliated' })]),
      'vendor-radar',
    )
    expect(body).toContain('1 of 1 triaged candidate needs a human decision')
  })
})
