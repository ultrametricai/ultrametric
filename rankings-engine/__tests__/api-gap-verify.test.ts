import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ROOT } from '../paths'

// The committed generic verifier harness (rankings-engine/scripts/api-gap-verify.py) is
// the fail-closed core of the dated wave scripts: nothing unverified is ever appended,
// failures withhold the item with a disposition, and the ledger's `cells` carry ONLY
// verified appends (staleness-scan reads cells for gap suppression, so an unverified row
// must keep the product flagged).

const SCRIPT = path.join(ROOT, 'rankings-engine', 'scripts', 'api-gap-verify.py')

interface Scenario {
  items?: Array<Record<string, unknown>>
  negativeChecks?: Record<string, Array<string | [string, number[]]>>
  postChecks?: Record<string, Record<string, unknown>>
  tlsMismatchChecks?: Record<string, Record<string, unknown>>
  withheld?: Array<Record<string, unknown>>
  needsHuman?: Array<Record<string, unknown>>
  deferred?: Array<Record<string, unknown>>
  fixture: Record<string, Record<string, unknown>>
  pack?: Array<Record<string, unknown>>
  /** Earlier committed wave ledgers, keyed by file name, for the carry-forward. */
  priorLedgers?: Record<string, Record<string, unknown>>
  verdicts?: Array<Record<string, unknown>>
}

interface LedgerRow {
  arena: string
  product: string
  storyId: string
  disposition: string
  evidenceId?: string
  note?: string
  reason?: string
}

interface Ledger {
  cells: LedgerRow[]
  withheld: LedgerRow[]
  needsHuman: Array<{ product: string }>
  deferred: Array<{ product: string }>
}

interface PackRow {
  id: string
  tier: string
  url: string
  excerpt: string
  fetchedAt: string
}

const baseItem = {
  arena: 'widgets',
  product: 'widget',
  storyId: 'api-machine-spec',
  id: 'widget-apigap-machine-spec-20261112',
  tier: 'claimed-docs',
  url: 'https://docs.widget.example.com/openapi.json',
  markers: ['"openapi": "3.1.0"', '"title": "Widget API"'],
  excerpt: 'Published machine-readable API description with a verified title.',
}

function run(scenario: Scenario): { ledger: Ledger; pack: PackRow[]; md: string; issue: string | null; stdout: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'api-gap-verify-'))
  const evidenceDir = path.join(dir, 'open-rankings', 'widgets', 'evidence')
  fs.mkdirSync(evidenceDir, { recursive: true })
  fs.writeFileSync(path.join(evidenceDir, 'widget.json'), JSON.stringify(scenario.pack ?? [], null, 2) + '\n')
  fs.writeFileSync(path.join(dir, 'open-rankings', 'widgets', 'verdicts.json'), JSON.stringify(scenario.verdicts ?? []) + '\n')
  const reportsDir = path.join(dir, 'reports', 'evidence-parity')
  fs.mkdirSync(reportsDir, { recursive: true })
  for (const [name, content] of Object.entries(scenario.priorLedgers ?? {})) {
    fs.writeFileSync(path.join(reportsDir, name), JSON.stringify(content) + '\n')
  }
  const manifest = {
    wave: 'api-gap-repair ci wave 2026-11-12',
    date: '2026-11-12',
    scan: 'offline staleness scan fixture: 1 gap row after ledger suppression',
    picked: [],
    deferred: scenario.deferred ?? [{ arena: 'terminals', product: 'iterm2', staleness: 80, reason: 'settlement-aware pass pending' }],
    needsHuman: scenario.needsHuman ?? [{ arena: 'product-feedback', product: 'foreloop', staleness: 70, reason: 'own product pending ruling' }],
    items: scenario.items ?? [baseItem],
    withheld: scenario.withheld ?? [],
    negativeChecks: scenario.negativeChecks ?? {},
    postChecks: scenario.postChecks ?? {},
    tlsMismatchChecks: scenario.tlsMismatchChecks ?? {},
    hostDelays: {},
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest))
  fs.writeFileSync(path.join(dir, 'fixture.json'), JSON.stringify(scenario.fixture))
  const ledgerFile = path.join(dir, 'ledger.json')
  const mdFile = path.join(dir, 'ledger.md')
  const issueFile = path.join(dir, 'issue.md')
  const stdout = execFileSync('python3', [
    SCRIPT,
    '--manifest', path.join(dir, 'manifest.json'),
    '--ledger', ledgerFile,
    '--ledger-md', mdFile,
    '--issue-body', issueFile,
    '--root', dir,
    '--fixture', path.join(dir, 'fixture.json'),
  ], { encoding: 'utf8' })
  return {
    ledger: JSON.parse(fs.readFileSync(ledgerFile, 'utf8')),
    pack: JSON.parse(fs.readFileSync(path.join(evidenceDir, 'widget.json'), 'utf8')),
    md: fs.readFileSync(mdFile, 'utf8'),
    issue: fs.existsSync(issueFile) ? fs.readFileSync(issueFile, 'utf8') : null,
    stdout,
  }
}

const specBody = '{"openapi": "3.1.0", "info": {"title": "Widget API"}}'

describe('api-gap-verify.py', () => {
  it('appends a live-verified item and records it as the only ledger cell', () => {
    const { ledger, pack, md } = run({
      fixture: { [baseItem.url]: { status: 200, body: specBody } },
    })
    expect(pack).toHaveLength(1)
    expect(pack[0]).toMatchObject({ id: baseItem.id, tier: 'claimed-docs', url: baseItem.url, excerpt: baseItem.excerpt })
    expect(pack[0].fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(ledger.cells).toHaveLength(1)
    expect(ledger.cells[0]).toMatchObject({ arena: 'widgets', product: 'widget', storyId: 'api-machine-spec', disposition: 'evidence-appended', evidenceId: baseItem.id })
    expect(ledger.withheld).toEqual([])
    expect(md).toContain('| widget | widgets | 1 | 0 |')
  })

  it('withholds on a non-200 status, never writes the pack, and queues the failure in the issue body', () => {
    const { ledger, pack, issue } = run({ fixture: { [baseItem.url]: { status: 404, body: '' } } })
    expect(pack).toEqual([])
    expect(ledger.cells).toEqual([])
    expect(ledger.withheld).toHaveLength(1)
    expect(ledger.withheld[0].disposition).toBe('withheld-verification-failed')
    expect(ledger.withheld[0].reason).toContain('returned 404')
    expect(issue).toContain('withheld-verification-failed')
    expect(issue).toContain('api-machine-spec')
  })

  it('withholds when a marker rotated out of the page (fail-closed)', () => {
    const { ledger, pack } = run({
      fixture: { [baseItem.url]: { status: 200, body: '{"openapi": "3.2.0", "info": {"title": "Widget API"}}' } },
    })
    expect(pack).toEqual([])
    expect(ledger.withheld[0].reason).toContain('does not contain')
  })

  it('treats a non-zero curl exit as no clean read', () => {
    const { ledger } = run({ fixture: { [baseItem.url]: { status: 200, body: specBody, exit: 28 } } })
    expect(ledger.cells).toEqual([])
    expect(ledger.withheld[0].reason).toContain('returned 0')
  })

  it('replays NEGATIVE_CHECKS with exact expected statuses before appending', () => {
    const fixture = {
      [baseItem.url]: { status: 200, body: specBody },
      'https://docs.widget.example.com/swagger.json': { status: 200, body: 'resurrected' },
      'https://docs.widget.example.com/private.json': { status: 401, body: '' },
    }
    const negativeChecks = {
      [baseItem.id]: ['https://docs.widget.example.com/swagger.json'] as Array<string | [string, number[]]>,
    }
    const failed = run({ fixture, negativeChecks })
    expect(failed.pack).toEqual([])
    expect(failed.ledger.withheld[0].reason).toContain('expected one of [404]')

    const passing = run({
      fixture,
      negativeChecks: { [baseItem.id]: [['https://docs.widget.example.com/private.json', [401]]] },
    })
    expect(passing.pack).toHaveLength(1)
  })

  it('replays recorded POST probes with exact status and response markers', () => {
    const postChecks = {
      [baseItem.id]: { url: 'https://api.widget.example.com/mcp', payload: '{"method":"initialize"}', expectedStatus: 200, markers: ['-32603'] },
    }
    const ok = run({
      fixture: {
        [baseItem.url]: { status: 200, body: specBody },
        'POST https://api.widget.example.com/mcp': { status: 200, body: '{"error":{"code":-32603}}' },
      },
      postChecks,
    })
    expect(ok.pack).toHaveLength(1)
    const drifted = run({
      fixture: {
        [baseItem.url]: { status: 200, body: specBody },
        'POST https://api.widget.example.com/mcp': { status: 500, body: '' },
      },
      postChecks,
    })
    expect(drifted.pack).toEqual([])
    expect(drifted.ledger.withheld[0].reason).toContain('expected 200')
  })

  it('replays TLS-mismatch counter-checks', () => {
    const tlsMismatchChecks = {
      [baseItem.id]: { host: 'spec.widget.example.com', url: 'https://spec.widget.example.com/openapi.json', recordedWrongName: 'unrelated.example.org' },
    }
    const ok = run({
      fixture: {
        [baseItem.url]: { status: 200, body: specBody },
        'TLS spec.widget.example.com': { exit: 60, cert: 'subject=CN = unrelated.example.org' },
      },
      tlsMismatchChecks,
    })
    expect(ok.pack).toHaveLength(1)
    const drifted = run({
      fixture: {
        [baseItem.url]: { status: 200, body: specBody },
        'TLS spec.widget.example.com': { exit: 0, cert: '' },
      },
      tlsMismatchChecks,
    })
    expect(drifted.pack).toEqual([])
    expect(drifted.ledger.withheld[0].reason).toContain('expected a TLS verification failure')
  })

  it('withholds an item that declares no verification at all (fail-closed by construction)', () => {
    const { ledger, pack } = run({
      items: [{ ...baseItem, markers: [] }],
      fixture: { [baseItem.url]: { status: 200, body: specBody } },
    })
    expect(pack).toEqual([])
    expect(ledger.withheld[0].reason).toContain('no live verification')
  })

  it('contains a raising check as a withheld item instead of stopping the wave', () => {
    const { ledger, pack } = run({
      // A malformed postChecks spec raises KeyError inside the check; the wave must
      // withhold the item and still write the ledger.
      postChecks: { [baseItem.id]: { payload: '{}' } },
      fixture: { [baseItem.url]: { status: 200, body: specBody } },
    })
    expect(pack).toEqual([])
    expect(ledger.cells).toEqual([])
    expect(ledger.withheld[0].reason).toContain('verification raised KeyError')
  })

  it('never duplicates an id already in the pack', () => {
    const existing = { id: baseItem.id, tier: 'claimed-docs', url: baseItem.url, excerpt: 'earlier row', fetchedAt: '2026-11-01T00:00:00.000Z' }
    const { ledger, pack } = run({
      fixture: { [baseItem.url]: { status: 200, body: specBody } },
      pack: [existing],
    })
    expect(pack).toHaveLength(1)
    expect(pack[0].excerpt).toBe('earlier row')
    expect(ledger.cells[0].note).toBe('already present')
  })

  it('carries manifest withheld rows (needs-research) and routing into the ledger and the issue body, outside cells', () => {
    const withheld = [{ arena: 'widgets', product: 'widget', storyId: 'api-sandbox', disposition: 'needs-research', reason: 'No mechanically verifiable surface for this story.' }]
    const { ledger, md, issue } = run({
      fixture: { [baseItem.url]: { status: 200, body: specBody } },
      withheld,
    })
    expect(ledger.cells.map((c: { storyId: string }) => c.storyId)).toEqual(['api-machine-spec'])
    expect(ledger.withheld).toEqual(withheld)
    expect(ledger.needsHuman[0].product).toBe('foreloop')
    expect(ledger.deferred[0].product).toBe('iterm2')
    expect(md).toContain('foreloop')
    expect(md).toContain('iterm2')
    expect(issue).toContain('| widget | widgets | api-sandbox | needs-research |')
    expect(issue).toContain('foreloop')
    expect(issue).toContain('iterm2')
  })

  it('writes no issue body when nothing needs a human', () => {
    const { issue, ledger } = run({
      items: [baseItem],
      withheld: [],
      needsHuman: [],
      deferred: [],
      fixture: { [baseItem.url]: { status: 200, body: specBody } },
    })
    expect(ledger.cells).toHaveLength(1)
    expect(issue).toBeNull()
  })

  it('carries outstanding withheld rows forward from earlier committed ledgers', () => {
    const { issue, ledger } = run({
      items: [],
      withheld: [],
      needsHuman: [],
      deferred: [],
      fixture: {},
      priorLedgers: {
        '2026-11-05-api-quality-ci.json': {
          cells: [],
          withheld: [
            // Still unresolved: no covering cell anywhere, verdict cites nothing.
            { arena: 'widgets', product: 'widget', storyId: 'api-sandbox', disposition: 'needs-research', reason: 'No mechanically verifiable surface.' },
            // Covered later by a wave cell: resolved, must not carry.
            { arena: 'widgets', product: 'widget', storyId: 'api-interactive-docs', disposition: 'needs-research', reason: 'No mechanically verifiable surface.' },
            // Verdict now cites evidence: resolved through a research wave, must not carry.
            { arena: 'widgets', product: 'widget', storyId: 'api-versioning-policy', disposition: 'needs-research', reason: 'No mechanically verifiable surface.' },
          ],
        },
        '2026-11-06-api-quality-wave99.json': {
          cells: [{ arena: 'widgets', product: 'widget', storyId: 'api-interactive-docs', disposition: 'checked-still-absent' }],
          withheld: [],
        },
      },
      verdicts: [
        { productId: 'widget', storyId: 'api-versioning-policy', verdict: 'partial', quality: 5, evidenceIds: ['later-row'] },
        { productId: 'widget', storyId: 'api-sandbox', verdict: 'none', quality: 0, evidenceIds: [] },
      ],
    })
    expect(ledger.withheld).toEqual([]) // the carry-forward feeds the ISSUE, not this run's ledger
    expect(issue).toContain('| widget | widgets | api-sandbox | needs-research |')
    expect(issue).toContain('carried forward from 2026-11-05-api-quality-ci.json')
    expect(issue).not.toContain('api-interactive-docs')
    expect(issue).not.toContain('api-versioning-policy')
  })

  it('drops a carried row once this run appends evidence for the same cell', () => {
    const { ledger, issue } = run({
      items: [baseItem], // appends api-machine-spec this run
      withheld: [],
      needsHuman: [{ arena: 'product-feedback', product: 'foreloop', reason: 'own product pending ruling' }],
      deferred: [],
      fixture: { [baseItem.url]: { status: 200, body: specBody } },
      priorLedgers: {
        '2026-11-05-api-quality-ci.json': {
          cells: [],
          withheld: [
            { arena: 'widgets', product: 'widget', storyId: 'api-machine-spec', disposition: 'withheld-verification-failed', reason: 'returned 404 last week' },
          ],
        },
      },
    })
    expect(ledger.cells.map((c) => c.storyId)).toEqual(['api-machine-spec'])
    expect(issue).not.toContain('returned 404 last week')
    expect(issue).not.toContain('api-machine-spec')
  })
})
