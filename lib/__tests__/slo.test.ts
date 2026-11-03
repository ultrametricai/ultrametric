import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { writeSloRun } from '../../rankings-engine/slo-history'
import {
  aggregateBySurface,
  classifyUp,
  currentlyDownSurfaces,
  formatUptimePct,
  hasMatureSloHistory,
  parseSloHistoryJsonl,
  combineSloHistory,
  loadSloHistory,
  loadSloSummaries,
  productSurfaceSlos,
  readSloHistorySources,
  SLO_HISTORY_DIR,
  SLO_HISTORY_FILE,
  summarizeSlo,
  type SloEntry,
} from '@/lib/slo'

function entry(overrides: Partial<SloEntry> & { date: string; up: boolean }): SloEntry {
  return {
    productId: 'stripe',
    arena: 'payments',
    surface: 'mcp',
    url: 'https://mcp.stripe.com/',
    status: overrides.up === false ? 0 : 200,
    ...overrides,
  }
}

const NOW = new Date('2026-10-08T12:00:00Z')

const temporary: string[] = []
function fixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'um-slo-'))
  temporary.push(dir)
  return dir
}
afterEach(() => {
  vi.restoreAllMocks()
  for (const dir of temporary.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})
const jsonl = (...entries: SloEntry[]) => entries.map(row => JSON.stringify(row)).join('\n') + '\n'

describe('SLO history storage', () => {
  const first = entry({ date: '2026-10-01T00:00:00.000Z', up: true })
  const second = entry({ date: '2026-10-02T00:00:00.000Z', up: false, status: 503 })

  it('supports absent, legacy-only and shard-only histories', () => {
    expect(loadSloHistory(fixture())).toEqual([])
    const legacy = fixture()
    fs.writeFileSync(path.join(legacy, SLO_HISTORY_FILE), jsonl(first))
    expect(loadSloHistory(legacy)).toEqual([first])
    const shards = fixture()
    writeSloRun([second], shards)
    expect(loadSloHistory(shards)).toEqual([second])
  })

  it('keeps legacy bytes, gives same-time retries distinct files and counts exact duplicate ingestion once', () => {
    const dir = fixture()
    const legacy = path.join(dir, SLO_HISTORY_FILE)
    const before = jsonl(first) + '\n'
    fs.writeFileSync(legacy, before)
    const a = writeSloRun([second], dir)!
    const b = writeSloRun([second], dir)!
    writeSloRun([first], dir) // copied legacy observation
    expect(a).not.toBe(b)
    expect(fs.readFileSync(legacy, 'utf8')).toBe(before)
    expect(fs.readFileSync(a, 'utf8')).toBe(jsonl(second))
    expect(fs.readdirSync(path.join(dir, SLO_HISTORY_DIR))).toHaveLength(3)
    expect(loadSloHistory(dir)).toEqual([first, second])
    expect(loadSloSummaries(dir, NOW)).toEqual(summarizeSlo([first, second], NOW))
    expect(productSurfaceSlos('payments', 'stripe', dir, NOW)[0]).toMatchObject({ checks: 2, windowUptimePct: 50, currentlyUp: false })
  })

  it('does not overwrite on a filename collision or create an empty run', () => {
    const dir = fixture()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000000')
    const file = writeSloRun([first], dir)!
    expect(() => writeSloRun([{ ...first, up: false }], dir)).toThrow(/EEXIST/)
    expect(fs.readFileSync(file, 'utf8')).toBe(jsonl(first))
    expect(fs.readdirSync(path.join(dir, SLO_HISTORY_DIR))).toHaveLength(1)
    expect(writeSloRun([], fixture())).toBeNull()
  })

  it('reports both sources for conflicting facts, extra fields, formatting or slash aliases', () => {
    const raw = JSON.stringify(first)
    for (const other of [JSON.stringify({ ...first, up: false }), JSON.stringify({ ...first, status: 201 }),
      JSON.stringify({ ...first, note: 'additional fact' }), ` ${raw}`, JSON.stringify({ ...first, url: first.url.replace(/\/$/, '') })]) {
      expect(() => combineSloHistory([{ source: 'legacy', text: raw }, { source: 'run', text: other }]))
        .toThrow(/Conflicting SLO observation.*legacy:1 and run:1/)
    }
    expect(combineSloHistory([{ source: 'legacy', text: raw }, { source: 'run', text: raw }])).toEqual([first])
  })

  it('preserves distinct observations and gives equal summaries for chronological and appended ordering', () => {
    const later = { ...first, date: '2026-10-03T00:00:00.000Z' }
    const variants = [{ ...first, arena: 'other' }, { ...first, productId: 'other' },
      { ...first, surface: 'openapi' as const }, { ...first, url: 'https://example.invalid/other' }]
    expect(parseSloHistoryJsonl(jsonl(first, ...variants))).toHaveLength(5)
    const chronological = parseSloHistoryJsonl(jsonl(first, second, later))
    const appended = parseSloHistoryJsonl(jsonl(later, first, second))
    expect(summarizeSlo(appended, NOW)).toEqual(summarizeSlo(chronological, NOW))
  })

  it('fails with a location for malformed shards and rejects invalid writer input before publishing', () => {
    const dir = fixture()
    fs.mkdirSync(path.join(dir, SLO_HISTORY_DIR))
    fs.writeFileSync(path.join(dir, SLO_HISTORY_DIR, 'bad.jsonl'), '\n{"date":"x"}\n')
    expect(() => loadSloHistory(dir)).toThrow(/bad.jsonl:2/)
    expect(() => writeSloRun([{ ...first, status: 1.5 }], fixture())).toThrow('Invalid SLO observation')
    expect(() => writeSloRun([first, second], fixture())).toThrow('one check timestamp')
  })

  it('schema-checks and checks conflicting identities across all committed history files', () => {
    expect(() => combineSloHistory(readSloHistorySources())).not.toThrow()
  })

  it('merges independently produced runs with ordinary Git and stages a shard-only change', () => {
    const root = fixture()
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
    git('init', '-q', '-b', 'main')
    git('config', 'user.name', 'SLO test'); git('config', 'user.email', 'slo@example.invalid')
    const data = path.join(root, 'open-rankings')
    fs.mkdirSync(data)
    fs.writeFileSync(path.join(data, SLO_HISTORY_FILE), jsonl(first))
    git('add', '.'); git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'base')
    git('switch', '-qc', 'run-a')
    writeSloRun([second], data)
    // Execute each workflow's real staging/change-detection prefix, without its
    // publication commands. Only the new untracked shard differs in this fixture.
    fs.mkdirSync(path.join(root, 'rankings-engine/cache'), { recursive: true })
    for (const workflow of ['story-runner', 'daily-snapshot']) {
      const source = fs.readFileSync(`.github/workflows/${workflow}.yml`, 'utf8')
      const step = source.slice(source.indexOf('      - name: Open PR if anything changed'))
      const stage = step.match(/^          git add .+$/m)![0].trim()
      const condition = step.match(/^          if (git diff .+); then$/m)![1]
      git('reset', '-q')
      execFileSync('sh', ['-c', stage], { cwd: root })
      expect(() => execFileSync('sh', ['-c', condition], { cwd: root })).toThrow()
    }
    git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'run a')
    git('switch', '-qc', 'run-b', 'main')
    const later = { ...first, date: '2026-10-03T00:00:00.000Z' }
    writeSloRun([later], data)
    git('add', 'open-rankings'); git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'run b')
    git('-c', 'core.hooksPath=/dev/null', 'merge', '--no-edit', 'run-a')
    expect(fs.readFileSync(path.join(data, SLO_HISTORY_FILE), 'utf8')).toBe(jsonl(first))
    expect(loadSloHistory(data)).toHaveLength(3)
    expect(loadSloSummaries(data, NOW)).toEqual(summarizeSlo([first, second, later], NOW))
  })
})

describe('classifyUp', () => {
  it('counts 2xx as up', () => {
    expect(classifyUp(200)).toBe(true)
    expect(classifyUp(204)).toBe(true)
  })

  it('counts auth-gated / method-fussy answers as up (the surface is alive)', () => {
    for (const status of [400, 401, 403, 405, 406, 429]) expect(classifyUp(status)).toBe(true)
  })

  it('counts 404/410, 5xx and no-response as down', () => {
    for (const status of [0, 404, 410, 500, 502, 503]) expect(classifyUp(status)).toBe(false)
  })
})

describe('parseSloHistoryJsonl', () => {
  it('parses lines and tolerates blank lines', () => {
    const text =
      '{"date":"2026-09-08T00:00:00Z","productId":"stripe","arena":"payments","surface":"mcp","url":"https://mcp.stripe.com/","up":true,"status":401}\n\n'
    const entries = parseSloHistoryJsonl(text)
    expect(entries).toHaveLength(1)
    expect(entries[0].surface).toBe('mcp')
    expect(entries[0].up).toBe(true)
  })

  it('rejects malformed lines (the file is machine-written only)', () => {
    expect(() => parseSloHistoryJsonl('{"date":"x"}')).toThrow()
  })
})

describe('summarizeSlo', () => {
  it('computes window uptime per (arena, product, surface) series', () => {
    const entries = [
      entry({ date: '2026-09-10T00:00:00Z', up: true }),
      entry({ date: '2026-09-20T00:00:00Z', up: false, status: 503 }),
      entry({ date: '2026-09-30T00:00:00Z', up: true }),
      entry({ date: '2026-10-05T00:00:00Z', up: true }),
    ]
    const [s] = summarizeSlo(entries, NOW)
    expect(s.checks).toBe(4)
    expect(s.windowChecks).toBe(4)
    expect(s.windowUptimePct).toBe(75)
    expect(s.currentlyUp).toBe(true)
    expect(s.downSince).toBeNull()
    expect(s.firstDate).toBe('2026-09-10T00:00:00Z')
  })

  it('excludes checks older than the window from the percentage', () => {
    const entries = [
      entry({ date: '2026-08-01T00:00:00Z', up: false, status: 404 }), // outside 30d of NOW
      entry({ date: '2026-09-20T00:00:00Z', up: true }),
      entry({ date: '2026-10-01T00:00:00Z', up: true }),
    ]
    const [s] = summarizeSlo(entries, NOW)
    expect(s.checks).toBe(3)
    expect(s.windowChecks).toBe(2)
    expect(s.windowUptimePct).toBe(100)
  })

  it('reports downSince as the start of the trailing consecutive-down run', () => {
    const entries = [
      entry({ date: '2026-09-25T00:00:00Z', up: true }),
      entry({ date: '2026-10-01T00:00:00Z', up: false, status: 404 }),
      entry({ date: '2026-10-07T00:00:00Z', up: false, status: 404 }),
    ]
    const [s] = summarizeSlo(entries, NOW)
    expect(s.currentlyUp).toBe(false)
    expect(s.downSince).toBe('2026-10-01T00:00:00Z')
    expect(s.lastStatus).toBe(404)
    expect(currentlyDownSurfaces([s])).toHaveLength(1)
  })

  it('keeps distinct surfaces of the same product as separate series, sorted', () => {
    const entries = [
      entry({ date: '2026-10-01T00:00:00Z', up: true, surface: 'mcp' }),
      entry({ date: '2026-10-01T00:00:00Z', up: false, status: 404, surface: 'llms-txt', url: 'https://docs.stripe.com/llms.txt' }),
    ]
    const summaries = summarizeSlo(entries, NOW)
    expect(summaries.map((s) => s.surface)).toEqual(['llms-txt', 'mcp'])
    expect(summaries[0].currentlyUp).toBe(false)
    expect(summaries[1].currentlyUp).toBe(true)
  })

  it('keeps two distinct URLs of the same surface as separate series (docs-MCP vs API-MCP)', () => {
    const entries = [
      entry({ date: '2026-10-01T00:00:00Z', up: true, url: 'https://api.example.com/mcp' }),
      entry({ date: '2026-10-01T00:00:00Z', up: false, status: 503, url: 'https://docs.example.com/mcp' }),
    ]
    const summaries = summarizeSlo(entries, NOW)
    expect(summaries).toHaveLength(2)
    expect(summaries.map((s) => s.currentlyUp)).toEqual([true, false])
  })

  it('treats trailing-slash URL variants as one series', () => {
    const entries = [
      entry({ date: '2026-10-01T00:00:00Z', up: true, url: 'https://mcp.stripe.com/' }),
      entry({ date: '2026-10-02T00:00:00Z', up: true, url: 'https://mcp.stripe.com' }),
    ]
    expect(summarizeSlo(entries, NOW)).toHaveLength(1)
  })

  it('sorts entries by timestamp before summarizing (append order not assumed)', () => {
    const entries = [
      entry({ date: '2026-10-05T00:00:00Z', up: true }),
      entry({ date: '2026-10-01T00:00:00Z', up: false, status: 500 }),
    ]
    const [s] = summarizeSlo(entries, NOW)
    expect(s.currentlyUp).toBe(true)
    expect(s.downSince).toBeNull()
  })
})

describe('aggregateBySurface', () => {
  it('folds multi-endpoint series into one row: combined %, up only when all up', () => {
    const entries = [
      entry({ date: '2026-09-20T00:00:00Z', up: true, url: 'https://api.example.com/mcp' }),
      entry({ date: '2026-10-01T00:00:00Z', up: true, url: 'https://api.example.com/mcp' }),
      entry({ date: '2026-09-20T00:00:00Z', up: true, url: 'https://docs.example.com/mcp' }),
      entry({ date: '2026-10-01T00:00:00Z', up: false, status: 404, url: 'https://docs.example.com/mcp' }),
    ]
    const rows = aggregateBySurface(summarizeSlo(entries, NOW))
    expect(rows).toHaveLength(1)
    expect(rows[0].windowChecks).toBe(4)
    expect(rows[0].windowUptimePct).toBe(75)
    expect(rows[0].currentlyUp).toBe(false)
    expect(rows[0].downSince).toBe('2026-10-01T00:00:00Z')
    expect(rows[0].lastStatus).toBe(404)
  })

  it('passes single-endpoint series through untouched', () => {
    const rows = aggregateBySurface(summarizeSlo([entry({ date: '2026-10-01T00:00:00Z', up: true })], NOW))
    expect(rows).toHaveLength(1)
    expect(rows[0].windowUptimePct).toBe(100)
  })
})

describe('hasMatureSloHistory', () => {
  it('requires 7 days of tracking before a percentage may be quoted', () => {
    const young = summarizeSlo([entry({ date: '2026-10-05T00:00:00Z', up: true })], NOW)[0]
    expect(hasMatureSloHistory(young, NOW)).toBe(false)
    const mature = summarizeSlo(
      [entry({ date: '2026-09-30T00:00:00Z', up: true }), entry({ date: '2026-10-05T00:00:00Z', up: true })],
      NOW,
    )[0]
    expect(hasMatureSloHistory(mature, NOW)).toBe(true)
  })
})

describe('formatUptimePct', () => {
  it('drops trailing .0 and keeps real decimals', () => {
    expect(formatUptimePct(100)).toBe('100%')
    expect(formatUptimePct(99.4)).toBe('99.4%')
  })
})
