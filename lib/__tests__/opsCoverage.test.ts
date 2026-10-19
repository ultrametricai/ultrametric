import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildArenaCoverage,
  buildCronHealth,
  buildDepthCoverage,
  buildNewsCoverage,
  parseWorkflowSchedule,
  untrackedVendorCensus,
} from '@/lib/opsCoverage'

// Aggregation units for the /ops dashboard, over a small synthetic fixture data dir (the
// lib/data.test.ts tmp-dir convention) — no dependence on the live fleet's exact numbers.

let tmp: string | undefined
afterEach(() => {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true })
  tmp = undefined
})

const NOW = Date.parse('2026-09-23T00:00:00Z')

function writeFixture(): string {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-ops-'))
  const w = (rel: string, value: unknown) => {
    const file = path.join(tmp!, rel)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value))
  }

  w('categories.json', [
    { id: 'alpha', name: 'Alpha Arena' },
    { id: 'beta', name: 'Beta Arena' }, // in categories.json but NOT populated
  ])
  w('alpha/products.json', [
    { id: 'p1', name: 'Product One' },
    { id: 'p2', name: 'Product Two' },
    { id: 'p3', name: 'Product Three' },
  ])
  w('alpha/evidence/p1.json', [
    { id: 'e1', tier: 'probe' },
    { id: 'e2', tier: 'claimed-docs' },
    { id: 'e3', tier: 'community' },
    { id: 'e4', tier: 'github' },
  ])
  w('alpha/evidence/p2.json', [{ id: 'f1', tier: 'claimed-docs' }, { id: 'f2', tier: 'claimed-docs' }])
  w('alpha/evidence/p3.json', []) // the thin tail
  w('alpha/verdicts.json', [
    { productId: 'p1', storyId: 's1', verdict: 'full', evidenceIds: ['e1'] }, // probe-backed
    { productId: 'p1', storyId: 's2', verdict: 'partial', evidenceIds: ['e2'] }, // docs only
    { productId: 'p2', storyId: 's1', verdict: 'none', evidenceIds: ['f1'] }, // docs only
    { productId: 'p2', storyId: 's2', verdict: 'na', evidenceIds: [] }, // excluded from denominator
  ])
  w('alpha/score-history.jsonl', '{"productId":"p1","date":"2026-09-20T00:00:00Z","aiEra":10}\n{"productId":"p1","date":"2026-09-22T05:00:00Z","aiEra":11}\n')
  w('spike-queue.json', {
    generatedAt: '2026-09-23T00:01:00Z',
    queue: [
      { arena: 'alpha', productId: 'p1', name: 'Product One', status: 'spiked', lastSpiked: '2026-09-13T00:00:00Z' },
      { arena: 'alpha', productId: 'p2', name: 'Product Two', status: 'spiked', lastSpiked: '2026-08-24T00:00:00Z' },
      { arena: 'alpha', productId: 'p3', name: 'Product Three', status: 'due', lastSpiked: null },
    ],
  })
  w('arena-roadmap.json', [
    { id: 'alpha', name: 'Alpha Arena', tier: 1, status: 'live' },
    { id: 'beta', name: 'Beta Arena', tier: 2, status: 'live' }, // roadmap drift: says live, unpopulated
    { id: 'gamma', name: 'Gamma Arena', tier: 2, status: 'planned' },
  ])
  w('vendor-news.json', {
    generatedAt: '2026-09-23T01:00:00Z',
    budget: { cap: 150, used: 42, exhausted: false },
    sources: [
      { productId: 'p1', arenaId: 'alpha', url: 'https://p1.com/blog', derived: false, method: 'rss', checkedAt: '2026-09-23T01:00:00Z', fetches: 1, items: 2 },
      { productId: 'p2', arenaId: 'alpha', url: 'https://p2.com/blog', derived: true, method: 'none', checkedAt: '2026-09-23T01:00:00Z', fetches: 1, items: 0 },
    ],
    items: [
      // agentic AND newer than p1's lastSpiked (2026-09-13) → re-spike
      { productId: 'p1', arenaId: 'alpha', title: 'Our MCP server is live', url: 'https://p1.com/blog/mcp', date: '2026-09-18', agentic: true },
      // agentic but OLDER than lastSpiked → not a re-spike reason
      { productId: 'p1', arenaId: 'alpha', title: 'Agent beta announced', url: 'https://p1.com/blog/beta', date: '2026-09-01', agentic: true },
      // not agentic → never a re-spike reason
      { productId: 'p1', arenaId: 'alpha', title: 'Pricing update', url: 'https://p1.com/blog/pricing', date: '2026-09-20', agentic: false },
      // dateless agentic on a NEVER-spiked product → counts (any agentic post is a reason)
      { productId: 'p3', arenaId: 'alpha', title: 'New SDK docs', url: 'https://p3.com/blog/sdk', date: null, agentic: true },
    ],
  })
  return tmp
}

describe('buildDepthCoverage', () => {
  it('aggregates per-arena depth: median/min evidence, probe-backed %, thin tail, spike ages', () => {
    const dir = writeFixture()
    const depth = buildDepthCoverage(dir, NOW)

    expect(depth.fleet.arenas).toBe(1) // beta has no verdicts.json — not populated
    expect(depth.fleet.products).toBe(3)
    expect(depth.fleet.verdicts).toBe(4)
    expect(depth.fleet.evidenceItems).toBe(6)
    // Non-na verdicts: 3; probe/github-backed: p1:s1 only → 33%.
    expect(depth.fleet.probeBackedPct).toBe(33)
    expect(depth.fleet.neverSpiked).toBe(1)

    const alpha = depth.arenas[0]
    expect(alpha.arenaId).toBe('alpha')
    expect(alpha.medianEvidence).toBe(2) // counts [0, 2, 4]
    expect(alpha.minEvidence).toBe(0)
    expect(alpha.minEvidenceProductId).toBe('p3')
    expect(alpha.probeBackedPct).toBe(33)
    // Fleet 10th percentile over [0,2,4] → 0, so only p3 is flagged.
    expect(alpha.bottomDecile).toEqual([{ productId: 'p3', name: 'Product Three', evidence: 0 }])
    expect(alpha.neverSpiked).toBe(1)
    expect(alpha.oldestSpikeDays).toBe(30) // p2, spiked 2026-08-24
    expect(alpha.stalestProductId).toBe('p2')
  })
})

describe('untrackedVendorCensus', () => {
  it('counts steps per unmapped vendor and implies the arena from optionsArenaId', () => {
    const census = untrackedVendorCensus([
      { vendor: 'gusto' }, // mapped in VENDOR_ARENA → excluded
      { vendor: 'zz-unmapped', optionsArenaId: 'payroll' },
      { vendorOptions: ['zz-unmapped', 'yy-unmapped'], optionsArenaId: 'email-marketing' },
      { vendorOptions: ['zz-unmapped'] },
    ])
    expect(census).toEqual([
      // 3 steps, payroll and email-marketing tie 1-1 → first-seen highest count wins (payroll)
      { vendor: 'zz-unmapped', label: 'Zz Unmapped', steps: 3, impliedArena: 'payroll' },
      { vendor: 'yy-unmapped', label: 'Yy Unmapped', steps: 1, impliedArena: 'email-marketing' },
    ])
  })
})

describe('buildArenaCoverage', () => {
  it('reports live vs roadmap and both drift directions; census degrades without a corpus', () => {
    const dir = writeFixture()
    const cov = buildArenaCoverage(dir)
    expect(cov.liveArenas).toBe(1)
    expect(cov.plannedArenas).toEqual([{ id: 'gamma', name: 'Gamma Arena', tier: 2, status: 'planned' }])
    expect(cov.liveNotPopulated).toEqual(['beta'])
    expect(cov.populatedNotInRoadmap).toEqual([])
    expect(cov.untrackedVendors).toEqual([]) // fixture resolves no open-processes/corpus.json — honest empty
  })
})

describe('parseWorkflowSchedule / buildCronHealth', () => {
  it('extracts name, cron lines, and non-schedule triggers', () => {
    const wf = parseWorkflowSchedule('spike-engine.yml', [
      'name: spike-engine',
      'on:',
      '  workflow_dispatch:',
    ].join('\n'))
    expect(wf).toEqual({ file: 'spike-engine.yml', name: 'spike-engine', crons: [], triggers: ['workflow_dispatch'] })

    const daily = parseWorkflowSchedule('daily.yml', [
      'name: daily-snapshot',
      'on:',
      '  schedule:',
      "    - cron: '43 5 * * *' # daily 05:43 UTC",
      '  workflow_dispatch:',
    ].join('\n'))
    expect(daily.crons).toEqual(['43 5 * * *'])
    expect(daily.triggers).toEqual(['workflow_dispatch'])
  })

  it('infers last-run evidence from committed artifacts and names the session-cron convention', () => {
    const dir = writeFixture()
    const health = buildCronHealth('/nonexistent-repo-root', dir)
    expect(health.workflows).toEqual([]) // no workflows dir at that root — honest empty
    expect(health.sessionCronNote).toMatch(/session cron/)
    const byLabel = Object.fromEntries(health.lastRuns.map((r) => [r.label, r.date]))
    expect(byLabel['Score history (story-runner / engines)']).toBe('2026-09-22T05:00:00Z')
    expect(byLabel['Spike queue re-rank (session cron)']).toBe('2026-09-23T00:01:00Z')
    expect(byLabel['Vendor news watcher (session cron)']).toBe('2026-09-23T01:00:00Z')
    expect(byLabel['Staleness scan (accuracy-engine, Wednesdays)']).toBe(null) // file absent
  })
})

describe('buildNewsCoverage', () => {
  it('joins news items with spike state and builds the re-spike cross-signal honestly', () => {
    const dir = writeFixture()
    const news = buildNewsCoverage(dir)
    expect(news.generatedAt).toBe('2026-09-23T01:00:00Z')
    expect(news.sourcesChecked).toBe(2)
    expect(news.productsWithSource).toBe(1) // p2's derived guess answered nothing
    expect(news.feedSources).toBe(1)
    expect(news.items).toHaveLength(4)
    expect(news.agenticCount).toBe(3)
    expect(news.items[0].productName).toBe('Product One') // joined from the spike queue

    // p1: only the 2026-09-18 post beats lastSpiked 2026-09-13; p3: never spiked, dateless counts.
    expect(news.respike.map((r) => r.productId)).toEqual(['p1', 'p3'])
    expect(news.respike[0]).toMatchObject({
      productId: 'p1',
      lastSpiked: '2026-09-13T00:00:00Z',
      newestAgenticDate: '2026-09-18',
      title: 'Our MCP server is live',
    })
    expect(news.respike[1]).toMatchObject({ productId: 'p3', lastSpiked: null, newestAgenticDate: null })
  })

  it('degrades to an honest empty state when vendor-news.json does not exist yet', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-ops-'))
    const news = buildNewsCoverage(tmp)
    expect(news.generatedAt).toBe(null)
    expect(news.items).toEqual([])
    expect(news.respike).toEqual([])
  })
})
