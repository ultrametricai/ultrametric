import { describe, expect, it } from 'vitest'
import {
  LAWS_MAX,
  LAWS_MIN,
  loadCitationRegistry,
  loadStartupLawsMarkdown,
  parseStartupLaws,
  readingCitations,
  validateCitationRegistry,
  validateCitations,
  validateStartupLaws,
  type CitationRegistry,
  type ReadingCitation,
} from '@/lib/citations'

// The citation-registry gates: the committed registry and open-law/LAWS.md must satisfy every
// structural and referential invariant (unique ids across both roles, HTTPS URLs, dated
// checks, every law citation resolving to a registry record). Deterministic — liveness
// checks are editorial, recorded via checked_on (see citations/README.md).

const AS_OF = new Date('2026-10-03T00:00:00Z')

describe('citation registry', () => {
  it('the committed registry + LAWS.md pass every invariant', () => {
    expect(validateCitations(AS_OF)).toEqual([])
  })

  it('carries both roles: rule-card authorities and the curated reading canon', () => {
    const registry = loadCitationRegistry()
    const ids = new Set(registry.citations.map((c) => c.id))
    expect(readingCitations(registry).length).toBeGreaterThanOrEqual(30)
    expect(registry.citations.some((c) => c.role === 'authority')).toBe(true)
    // Reading canon: PG essays, YC library/documents, and government primary sources.
    for (const id of ['pg-do-things-that-dont-scale', 'pg-default-alive', 'yc-documents', 'irs-form-15620', 'de-franchise-tax', 'nvca-model-docs']) {
      expect(ids.has(id), `registry must keep ${id}`).toBe(true)
    }
    // Authority side: the rule cards' primary authorities resolve here too.
    for (const id of ['de-dgcl-503', 'irs-form-15620-2025']) {
      expect(ids.has(id), `registry must keep ${id}`).toBe(true)
    }
    // Government reading records are marked primary-source, matching the authority doctrine.
    for (const r of readingCitations(registry)) {
      if (r.url.includes('.gov/')) expect(r.kind, `${r.id} is a government record`).toBe('primary-source')
    }
  })

  it(`distils ${LAWS_MIN}-${LAWS_MAX} laws, each grouped under a lifecycle stage with resolving citations`, () => {
    const { laws, errors } = parseStartupLaws(loadStartupLawsMarkdown())
    expect(errors).toEqual([])
    expect(laws.length).toBeGreaterThanOrEqual(LAWS_MIN)
    expect(laws.length).toBeLessThanOrEqual(LAWS_MAX)
    const ids = new Set(loadCitationRegistry().citations.map((c) => c.id))
    for (const law of laws) {
      expect(law.stage.length, `law ${law.number} needs a stage`).toBeGreaterThan(0)
      expect(law.sourceIds.length, `law ${law.number} needs citations`).toBeGreaterThan(0)
      for (const id of law.sourceIds) expect(ids.has(id), `law ${law.number} cites unknown ${id}`).toBe(true)
    }
    // The aphorisms keep their attribution: the two headline laws cite their actual origins.
    const byTitle = new Map(laws.map((l) => [l.title, l]))
    expect(byTitle.get("Do things that don't scale")?.sourceIds).toContain('pg-do-things-that-dont-scale')
    expect(byTitle.get('Make something people want')?.sourceIds).toContain('yc-essential-startup-advice')
  })
})

describe('citation validators (failure modes)', () => {
  const record = (over: Partial<ReadingCitation> = {}): ReadingCitation => ({
    id: 'ok-record',
    role: 'reading',
    title: 'A title',
    author: 'An author',
    url: 'https://example.com/x',
    kind: 'essay',
    topics: ['topic'],
    note: 'A note.',
    published_on: null,
    checked_on: '2026-09-29',
    ...over,
  })
  const reg = (...citations: CitationRegistry['citations']): CitationRegistry => ({ updated_on: '2026-09-29', citations })

  it('rejects duplicate ids, plain-HTTP URLs, unknown kinds and roles, and future checks', () => {
    expect(validateCitationRegistry(reg(record(), record()), AS_OF).join(';')).toContain('duplicate citation id')
    expect(validateCitationRegistry(reg(record({ url: 'http://example.com' })), AS_OF).join(';')).toContain('HTTPS')
    expect(
      validateCitationRegistry(reg(record({ kind: 'blog' as unknown as 'essay' })), AS_OF).join(';'),
    ).toContain('unknown kind')
    expect(
      validateCitationRegistry(reg(record({ role: 'secondary' as unknown as 'reading' })), AS_OF).join(';'),
    ).toContain('unknown role')
    expect(validateCitationRegistry(reg(record({ checked_on: '2027-01-01' })), AS_OF).join(';')).toContain('future')
  })

  it('rejects laws with unresolved citations, no citations, or broken numbering', () => {
    const registry = reg(record({ id: 'real-source' }))
    const unknown = '## Stage\n\n### 1. A law\nBody.\nSources: `ghost-id`\n'
    expect(validateStartupLaws(unknown, registry).join(';')).toContain('unknown source id ghost-id')
    const uncited = '## Stage\n\n### 1. A law\nBody with no sources line.\n'
    expect(validateStartupLaws(uncited, registry).join(';')).toContain('missing Sources line')
    const misnumbered = '## Stage\n\n### 2. A law\nBody.\nSources: `real-source`\n'
    expect(validateStartupLaws(misnumbered, registry).join(';')).toContain('expected number 1')
    // And a too-short list is itself an error (the 25-40 corpus contract).
    expect(validateStartupLaws('## Stage\n\n### 1. Only law\nBody.\nSources: `real-source`\n', registry).join(';')).toContain('expected 25-40')
  })
})
