import { describe, expect, it } from 'vitest'
import { EvidenceSchema, StorySchema, VerdictSchema } from '../../lib/schemas'
import fixtures from './fixtures/refresh-regressions.json'
import { canonicalSource, newSourceSupport, sameEvidence, sourceHash, supportDisappeared } from '../evidence-source.mjs'
import { unsupportedFlips } from '../scripts/check-refresh-stability.mjs'
import { mergeProbeEvidence } from '../stages/probe'
import { mergeCommunityEvidence } from '../stages/collect-community'
import { validateExtractionSources } from '../stages/extract'
import { RawVerdictSchema, validateVerdictRules } from '../stages/judge'
import { validateClaimRules } from '../stages/claims'

describe('review regression source fixtures', () => {
  it('#548 blocks the unchanged-evidence Databricks grade change', () => {
    const c = fixtures.cases.find(c => c.pr === 548 && c.after.productId === 'databricks')!
    expect(unsupportedFlips([c.before], [c.after], { databricks: c.beforeEvidence }, { databricks: c.afterEvidence })).toEqual([c.after])
  })

  it('#556 retains all recorded Reclaim and Motion runtime probes without a preserve flag', () => {
    const recorded = EvidenceSchema.array().parse(fixtures.recordedProbes556)
    expect(recorded).toHaveLength(4)
    expect(recorded.every(item => item.preserve === undefined)).toBe(true)
    expect(mergeProbeEvidence(recorded, [])).toEqual(recorded)
  })

  it('#556 treats Hacker News API and discussion URLs as one source', () => {
    const old = { id: 'reclaim-comm-3', tier: 'community', url: 'https://hn.algolia.com/api/v1/items/23760278', excerpt: 'A dated report about scheduled tasks.' }
    const renamed = { ...old, id: 'reclaim-comm-5-refresh-d79e83007fa29573', url: 'https://news.ycombinator.com/item?id=23760278' }
    expect(canonicalSource(old.url)).toBe(renamed.url)
    expect(sameEvidence(old, renamed)).toBe(true)
    expect(supportDisappeared(old, [renamed])).toBe(false)
    expect(newSourceSupport(renamed, [old])).toBe(false)
    expect(supportDisappeared(old, [{ ...renamed, excerpt: 'A different model paraphrase.' }])).toBe(false)
  })

  it('#567 and #548 adjacent-feature credits cannot satisfy the new response contract', () => {
    for (const c of fixtures.cases.filter(c => c.pr === 567 || c.after.storyId === 'dataset-marketplace')) {
      const row = VerdictSchema.parse(c.after)
      const story = StorySchema.parse(c.story)
      const evidence = EvidenceSchema.array().parse(c.afterEvidence)
      expect(RawVerdictSchema.safeParse(row).success).toBe(false) // original replies lacked an auditable support decision
      const unsupported = { ...row, support: { subject: story.title, relation: 'adjacent' as const, coverage: 'none' as const,
        citations: evidence.filter(item => row.evidenceIds.includes(item.id)).map(item => ({ evidenceId: item.id, quote: item.excerpt })) } }
      expect(validateVerdictRules(unsupported, evidence, story)).toMatch(/direct support/)
      expect(validateVerdictRules({ ...unsupported, verdict: 'disputed' }, evidence, story)).toMatch(/direct support/)
    }
  })

  it('#567 FAQ questions cannot turn into a capability claim or extracted assertion', () => {
    const faq = EvidenceSchema.parse(fixtures.faq567)
    expect(validateClaimRules({ claims: [{ text: 'Supports a feature', evidenceId: faq.id, storyIds: [] }] }, new Map([[faq.id, faq]]), new Set())).toMatch(/questions/)
    expect(() => validateExtractionSources({ stories: [{ persona: 'developer', title: 'As a developer, I can use this feature', quote: faq.excerpt, sourceKey: 'docs' }] }, { docs: faq.excerpt })).toThrow(/affirmative/)
  })
})

describe('source provenance', () => {
  const old = { id: 'old', tier: 'community' as const, url: 'https://example.invalid/discussion', excerpt: 'Original summary.', fetchedAt: '2026-11-01T00:00:00Z', sourceHash: sourceHash('Fetched discussion') }
  it('a new label, paraphrase or timestamp on unchanged source text cannot support a new score', () => {
    expect(newSourceSupport({ ...old, id: 'new', excerpt: 'Another summary.', fetchedAt: '2026-11-03T00:00:00Z' }, [old])).toBe(false)
    expect(newSourceSupport({ ...old, id: 'new', excerpt: 'New observation.', sourceHash: sourceHash('Changed fetched discussion') }, [old])).toBe(true)
    expect(sourceHash('Fetched\n discussion')).toBe(old.sourceHash)
    expect(newSourceSupport({ ...old, id: 'new', excerpt: 'Another summary.' }, [{ ...old, sourceHash: undefined }])).toBe(false)
  })
  it('a missing community extraction preserves the dated source record', () => {
    expect(mergeCommunityEvidence('vendor', [old], [], [], '2026-11-03T00:00:00Z')).toEqual([old])
    expect(mergeCommunityEvidence('vendor', [old], [{ url: old.url, excerpt: 'Another summary.' }], [{ url: old.url, text: 'Fetched discussion' }], '2026-11-03T00:00:00Z')).toEqual([old])
  })
  it('changed community sources append observations and never reuse a prior identity', () => {
    const before = { ...old, id: 'vendor-comm-1' }
    const merged = mergeCommunityEvidence('vendor', [before], [{ url: old.url, excerpt: 'New observation.' }], [{ url: old.url, text: 'Changed discussion' }], '2026-11-03T00:00:00Z')
    expect(merged[0]).toEqual(before)
    expect(merged[1].id).toBe('vendor-comm-2')
    expect(merged[1].sourceHash).toBe(sourceHash('Changed discussion'))
    expect(() => mergeCommunityEvidence('vendor', [before], [{ url: 'https://unfetched.invalid', excerpt: 'Invented' }], [], '2026-11-03T00:00:00Z')).toThrow(/unfetched/)
  })
  it('extraction requires an actual quotation from the named source', () => {
    const extraction = { stories: [{ persona: 'developer', title: 'As a developer, I can isolate test jobs', quote: 'Jobs execute in an isolated sandbox.', sourceKey: 'docs' }] }
    expect(() => validateExtractionSources(extraction, { docs: 'Jobs execute in an isolated sandbox. Separate credentials are required.' })).not.toThrow()
    expect(() => validateExtractionSources(extraction, { docs: 'The dry-run flag previews commands.' })).toThrow(/verbatim/)
    expect(() => validateExtractionSources(extraction, { site: extraction.stories[0].quote })).toThrow(/verbatim/)
  })
})

describe('mechanical capability support', () => {
  const c = fixtures.cases[0]
  const story = StorySchema.parse(c.story)
  const evidence = [{ id: 'fixture-docs', tier: 'claimed-docs' as const, url: 'https://example.invalid/sandbox', fetchedAt: '2026-11-03T00:00:00Z', excerpt: 'Jobs execute in an isolated sandbox using test credentials.' }]
  const row = { ...VerdictSchema.parse(c.after), support: { subject: story.title, relation: 'direct' as const, coverage: 'partial' as const,
    citations: [{ evidenceId: 'fixture-docs', quote: evidence[0].excerpt }] }, evidenceIds: ['fixture-docs'] }
  it('accepts direct partial support but rejects full credit for incomplete coverage', () => {
    expect(validateVerdictRules(row, evidence, story)).toBeNull()
    expect(validateVerdictRules({ ...row, verdict: 'full' }, evidence, story)).toMatch(/complete/)
  })
  it('rejects invented quotes, a different story, and questions presented as support', () => {
    expect(validateVerdictRules({ ...row, support: { ...row.support, citations: [{ evidenceId: 'fixture-docs', quote: 'All jobs are free.' }] } }, evidence, story)).toMatch(/verbatim/)
    expect(validateVerdictRules({ ...row, support: { ...row.support, subject: 'A different story' } }, evidence, story)).toMatch(/exact story/)
    const question = 'Can jobs run in a sandbox?'
    expect(validateVerdictRules({ ...row, support: { ...row.support, citations: [{ evidenceId: 'fixture-docs', quote: question }] } }, [{ ...evidence[0], excerpt: question }], story)).toMatch(/questions/)
  })
})
