import { describe, expect, it } from 'vitest'
import { bestVocabArena, countVocabHits, RADAR_TOP, radarReportFromQueue, registrableApex, type YcQueue } from '../scripts/yc-coverage-queue'
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

describe('registrableApex', () => {
  it('strips subdomains down to the registrable apex', () => {
    expect(registrableApex('foo.com')).toBe('foo.com')
    expect(registrableApex('app.foo.com')).toBe('foo.com')
  })

  it('keeps three labels under multi-label public suffixes (the digistain.co.uk -> docs.co.uk bug)', () => {
    expect(registrableApex('digistain.co.uk')).toBe('digistain.co.uk')
    expect(registrableApex('app.digistain.co.uk')).toBe('digistain.co.uk')
    expect(registrableApex('shop.foo.com.au')).toBe('foo.com.au')
  })
})

describe('countVocabHits', () => {
  const words = ['device', 'devices', 'screen\\b'].map((w) => ({ word: w, re: new RegExp(`\\b(${w})`, 'i') }))

  it('counts one hit when singular/plural vocab pairs match the same occurrence (the "Medical Devices" bug)', () => {
    expect(countVocabHits('Medical Devices', words)).toBe(1)
  })

  it('still counts distinct matched words separately', () => {
    expect(countVocabHits('a device with a screen', words)).toBe(2)
  })
})

describe('bestVocabArena', () => {
  const compile = (vocab: Record<string, string[]>) =>
    new Map(
      Object.entries(vocab).map(([arena, words]) => [
        arena,
        words.map((w) => ({ word: w, re: new RegExp(`\\b(${w})`, 'i') })),
      ]),
    )

  it('more distinct hits wins outright', () => {
    const vocab = compile({ 'design-tools': ['design', 'layer'], 'ai-coding': ['coding'] })
    expect(bestVocabArena('The design system layer for coding agents', vocab)).toEqual({ arena: 'design-tools', hits: 2 })
  })

  it('at equal hits, the arena matched earliest in the text wins (description beats trailing tags: the zeroheight case)', () => {
    // Text layout mirrors the real composition: one-liner first, tag labels after.
    const text = 'The design system layer for coding agents Developer Tools SaaS Design Tools'
    const vocab = compile({
      'agent-frameworks': ['agent', 'tool'],
      'design-tools': ['design', 'layer'],
    })
    // Both arenas have 2 distinct hits; design-tools matches at offset 4 ('design'),
    // agent-frameworks first at offset 35 ('agent').
    expect(bestVocabArena(text, vocab)).toEqual({ arena: 'design-tools', hits: 2 })
  })

  it('returns null below the two-hit floor', () => {
    const vocab = compile({ 'design-tools': ['design', 'layer'] })
    expect(bestVocabArena('generic marketing copy', vocab)).toBeNull()
  })
})

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
