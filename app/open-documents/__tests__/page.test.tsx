// @vitest-environment jsdom
// /open-documents (founder 2026-10-03, with the documents/ → open-documents/ rename): the
// registry rendered as a browsable index. Every registry record gets a row whose link IS the
// record's canonical URL (link, never redistribute — same invariant the repo README gate
// enforces in lib/documents.ts validateDocumentReadme), grouped by use_case.
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import OpenDocumentsPage from '@/app/open-documents/page'
import { DOCUMENT_USE_CASES, loadDocumentRegistry } from '@/lib/documents'

describe('/open-documents', () => {
  const registry = loadDocumentRegistry()

  it('renders every registry record as a row linking its canonical URL', () => {
    const { container } = render(<OpenDocumentsPage />)
    const rows = container.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(registry.documents.length)
    for (const d of registry.documents) {
      expect(
        container.querySelector(`a[href="${d.url}"]`),
        `${d.id} must link its canonical URL`,
      ).not.toBeNull()
    }
  })

  it('groups records under their use_case headings, registry order within each group', () => {
    const { container } = render(<OpenDocumentsPage />)
    const headings = [...container.querySelectorAll('h2')].map((h) => h.textContent)
    const nonEmpty = DOCUMENT_USE_CASES.filter((u) => registry.documents.some((d) => d.use_case === u))
    expect(headings).toHaveLength(nonEmpty.length)
    // One table per non-empty use case, sized to its group.
    const tables = container.querySelectorAll('table')
    expect(tables).toHaveLength(nonEmpty.length)
    nonEmpty.forEach((u, i) => {
      const group = registry.documents.filter((d) => d.use_case === u)
      expect(tables[i].querySelectorAll('tbody tr'), u).toHaveLength(group.length)
    })
  })
})
