import { describe, expect, it } from 'vitest'
import {
  loadLoreCitations,
  validateLoreCitations,
  validateLoreCitationsFile,
  type LoreCitation,
  type LoreCitationsDoc,
} from '@/lib/lore'

// The lore-citations gate: open-lore/citations.json carries the citation-only works the
// distilled laws (open-law/LAWS.md) cite that are not library-worthy — resource
// registries, agency portals, umbrella sites. One place per work: anything curated into
// open-lore/library.json lives there alone, so this registry may not duplicate a library
// id or URL. Deterministic — URL liveness is editorial, recorded via checked_on (see
// open-lore/README.md).

const AS_OF = new Date('2026-10-14T00:00:00Z')

describe('lore citations (open-lore/citations.json)', () => {
  it('the committed registry passes every invariant, including no overlap with the library', () => {
    expect(validateLoreCitationsFile(AS_OF)).toEqual([])
  })

  it('keeps the works the laws cite that have no library home', () => {
    const ids = new Set(loadLoreCitations().citations.map((c) => c.id))
    expect(ids.size).toBeGreaterThanOrEqual(20)
    for (const id of ['irs-form-15620', 'de-franchise-tax', 'nvca-model-docs', 'index-rewarding-talent', 'steve-blank']) {
      expect(ids.has(id), `registry must keep ${id}`).toBe(true)
    }
    // Works deduplicated into the library stay out: the library entry is canonical.
    for (const id of ['pg-do-things-that-dont-scale', 'pg-default-alive', 'yc-documents', 'holloway-equity-guide']) {
      expect(ids.has(id), `${id} was folded into open-lore/library.json`).toBe(false)
    }
  })

  it('marks government records primary-source, matching the authority doctrine', () => {
    for (const c of loadLoreCitations().citations) {
      if (c.url.includes('.gov/')) expect(c.kind, `${c.id} is a government record`).toBe('primary-source')
    }
  })
})

describe('lore-citation validators (failure modes)', () => {
  const record = (over: Partial<LoreCitation> = {}): LoreCitation => ({
    id: 'ok-record',
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
  const doc = (...citations: LoreCitationsDoc['citations']): LoreCitationsDoc => ({ updated_on: '2026-09-29', citations })
  const emptyLibrary = { entries: [] }

  it('rejects duplicate ids, plain-HTTP URLs, unknown kinds, and future checks', () => {
    expect(validateLoreCitations(doc(record(), record()), emptyLibrary, AS_OF).join(';')).toContain('duplicate citation id')
    expect(validateLoreCitations(doc(record({ url: 'http://example.com' })), emptyLibrary, AS_OF).join(';')).toContain('HTTPS')
    expect(
      validateLoreCitations(doc(record({ kind: 'blog' as unknown as 'essay' })), emptyLibrary, AS_OF).join(';'),
    ).toContain('unknown kind')
    expect(validateLoreCitations(doc(record({ checked_on: '2027-01-01' })), emptyLibrary, AS_OF).join(';')).toContain('future')
  })

  it('rejects a record whose id or URL duplicates a library entry', () => {
    const byId = { entries: [{ id: 'ok-record', url: 'https://example.org/other' }] }
    expect(validateLoreCitations(doc(record()), byId, AS_OF).join(';')).toContain('duplicates a library entry id')
    const byUrl = { entries: [{ id: 'other-id', url: 'https://www.example.com/x/' }] }
    expect(validateLoreCitations(doc(record()), byUrl, AS_OF).join(';')).toContain('duplicates a library entry URL')
  })
})
