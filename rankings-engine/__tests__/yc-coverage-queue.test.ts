import { describe, expect, it } from 'vitest'
import { RADAR_TOP, radarReportFromQueue, type YcQueue } from '../scripts/yc-coverage-queue'
import { RadarReportSchema } from '../scripts/vendor-radar'

// Pure unit for the queue → radar-triage hand-off: the weekly YC lane emits its top queue
// candidates in the radar report shape so radar-triage.ts applies the same approval criteria
// (same convention as vendor-radar.test.ts — no network, fixtures only).

function queueOf(n: number): YcQueue {
  return {
    generatedAt: '2026-10-21T00:00:00.000Z',
    source: 'https://yc-oss.github.io/api/companies/all.json',
    batchWindow: { from: 'W16', to: 'F26' },
    httpChecked: true,
    batches: [],
    candidates: Array.from({ length: n }, (_, i) => ({
      slug: `co-${i}`,
      name: `Co ${i}`,
      batch: 'Fall 2026',
      code: 'F26',
      website: `https://co-${i}.dev`,
      domain: `co-${i}.dev`,
      oneLiner: 'Browser agents for ops teams',
      arena: 'browser-agents',
      fitSource: i === 0 ? ('classified' as const) : ('vocab' as const),
      fitScore: i === 0 ? 1 : 0.55,
      vocabHits: i === 0 ? 3 : 2,
      docsChecked: [`https://docs.co-${i}.dev/`],
      docsHits: i % 2 === 0 ? [`https://docs.co-${i}.dev/`] : [],
      docsScore: i % 2 === 0 ? 0.25 : 0,
      recency: 1,
      score: 1 - i * 0.01,
    })),
  }
}

describe('radarReportFromQueue', () => {
  it('round-trips the radar report schema, keyed by product domain, capped at RADAR_TOP with honest overflow', () => {
    const report = RadarReportSchema.parse(radarReportFromQueue(queueOf(RADAR_TOP + 3), '2026-10-21'))
    expect(report.candidates).toHaveLength(RADAR_TOP)
    expect(report.skipped.overflow).toBe(3)
    expect(report.candidates[0].key).toBe('domain:co-0.dev')
    expect(report.sources[0].kind).toBe('yc-directory')
  })

  it('evidence is verbatim-derived: directory source, batch, fit source with real lexical hits, docs probes', () => {
    const report = radarReportFromQueue(queueOf(2), '2026-10-21')
    const [classified, vocab] = report.candidates
    expect(classified.sources[0].url).toBe('https://www.ycombinator.com/companies/co-0')
    expect(classified.sources[0].evidence).toContain('batch Fall 2026')
    expect(classified.sources[0].evidence).toContain('fit: classified (3 vocab hits)')
    expect(classified.sources[0].evidence).toContain('docs probes answering: https://docs.co-0.dev/')
    expect(classified.matchedArenas).toEqual([{ arena: 'browser-agents', hits: 3, keywords: [] }])
    expect(vocab.sources[0].evidence).toContain('fit: vocab (2 vocab hits)')
    expect(vocab.sources[0].evidence).toContain('docs probes answering: none')
    expect(vocab.firstSeen).toBe('2026-10-21')
  })
})
