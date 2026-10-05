import { describe, expect, it } from 'vitest'
import {
  DOCUMENT_USE_CASES,
  loadDocumentRegistry,
  validateDocumentReadme,
  validateDocumentRegistry,
  validateDocuments,
  type DocumentRegistry,
} from '@/lib/documents'

// The open-documents map gates: every committed record is well-formed, dated, HTTPS, and the
// README's grouped tables stay in sync with the registry. Link-don't-redistribute is policy
// (open-documents/README.md); nothing here fetches the documents.

// Pinned to the registry's updated_on (the latest verification pass).
const AS_OF = new Date('2026-10-02T00:00:00Z')

describe('documents corpus', () => {
  it('the committed registry + README pass every invariant', () => {
    expect(validateDocuments(AS_OF)).toEqual([])
  })

  it('covers every use case with the anchor documents', () => {
    const registry = loadDocumentRegistry()
    const byUseCase = new Map<string, number>()
    for (const d of registry.documents) byUseCase.set(d.use_case, (byUseCase.get(d.use_case) ?? 0) + 1)
    for (const uc of DOCUMENT_USE_CASES) {
      expect(byUseCase.get(uc) ?? 0, `use case ${uc} must not be empty`).toBeGreaterThan(0)
    }
    const ids = new Set(registry.documents.map((d) => d.id))
    for (const id of [
      'yc-postmoney-safe-cap',
      'yc-safe-user-guide',
      'yc-series-a-term-sheet',
      // The NVCA suite is enumerated per document (the old single blob row is gone).
      'nvca-stock-purchase-agreement',
      'nvca-voting-agreement',
      'cooley-series-seed-package',
      'cooley-ciiaa',
      'commonpaper-mutual-nda',
      'saft-form',
      'irs-form-15620',
      'kiss-500-global',
      'eu-scc-international-transfers',
      'uk-idta-addendum',
      'apache-icla',
      'onedpa',
    ]) {
      expect(ids.has(id), `registry must keep ${id}`).toBe(true)
    }
  })

  it('every record carries an honest license/terms note (no bare links)', () => {
    for (const d of loadDocumentRegistry().documents) {
      expect(d.license_note.length, `${d.id} license_note`).toBeGreaterThan(30)
    }
  })
})

describe('documents validators (failure modes)', () => {
  const record = (over: Partial<DocumentRegistry['documents'][number]> = {}) => ({
    id: 'ok-doc',
    name: 'A document',
    publisher: 'A publisher',
    url: 'https://example.com/doc',
    license_note: 'Freely published under the publisher’s terms; counsel still required.',
    use_case: 'formation' as const,
    jurisdiction: 'US',
    format: 'pdf' as const,
    checked_on: '2026-09-30',
    ...over,
  })
  const reg = (...documents: DocumentRegistry['documents']): DocumentRegistry => ({
    updated_on: '2026-09-30',
    review_window_days: 120,
    documents,
  })

  it('rejects duplicate ids, non-HTTPS URLs, unknown enums, and future checks', () => {
    expect(validateDocumentRegistry(reg(record(), record()), AS_OF).join(';')).toContain('duplicate document id')
    expect(validateDocumentRegistry(reg(record({ url: 'http://example.com' })), AS_OF).join(';')).toContain('HTTPS')
    expect(
      validateDocumentRegistry(reg(record({ use_case: 'marketing' as unknown as 'formation' })), AS_OF).join(';'),
    ).toContain('unknown use_case')
    expect(
      validateDocumentRegistry(reg(record({ format: 'zip' as unknown as 'pdf' })), AS_OF).join(';'),
    ).toContain('unknown format')
    expect(validateDocumentRegistry(reg(record({ checked_on: '2027-01-01' })), AS_OF).join(';')).toContain('future')
  })

  it('enforces the currency invariant: checked_on within the stated review window', () => {
    // 2026-01-01 is 272 days before updated_on 2026-09-30 — outside a 120-day window.
    expect(validateDocumentRegistry(reg(record({ checked_on: '2026-01-01' })), AS_OF).join(';')).toContain(
      'outside the 120-day review window',
    )
    // Exactly at the edge of the window passes (120 days before 2026-09-30 is 2026-06-02).
    expect(validateDocumentRegistry(reg(record({ checked_on: '2026-06-02' })), AS_OF)).toEqual([])
    // And a registry without a stated window is itself invalid.
    const noWindow = { ...reg(record()), review_window_days: 0 }
    expect(validateDocumentRegistry(noWindow, AS_OF).join(';')).toContain('review_window_days')
  })

  it('catches README drift in every direction: missing rows, ghost rows, and unlinked rows', () => {
    const registry = reg(record({ id: 'present-doc' }))
    expect(validateDocumentReadme('no table at all', registry).join(';')).toContain(
      'missing table row for registry id present-doc',
    )
    const rogue = '| `present-doc` | [x](https://example.com/doc) |\n| `ghost-doc` | y |'
    expect(validateDocumentReadme(rogue, registry).join(';')).toContain('unknown id ghost-doc')
    // A row that names the document without LINKING its canonical URL is drift too (founder
    // 2026-10-02: the documents layer links OUT to the real documents on the web).
    const unlinked = '| `present-doc` | x |'
    expect(validateDocumentReadme(unlinked, registry).join(';')).toContain(
      'row present-doc must link its canonical URL https://example.com/doc',
    )
    // A row linking a DIFFERENT URL than the committed, checked_on-dated one fails the same way.
    const wrongUrl = '| `present-doc` | [x](https://example.com/other) |'
    expect(validateDocumentReadme(wrongUrl, registry).join(';')).toContain('must link its canonical URL')
    // The committed-shape row passes clean.
    expect(validateDocumentReadme('| `present-doc` | [x](https://example.com/doc) |', registry)).toEqual([])
  })
})
