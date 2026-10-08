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

  it('family rows group together in their table and carry their committed variant labels', () => {
    const { container } = render(<OpenDocumentsPage />)
    // Contiguity: the rows of one family sit adjacent (pulled to the family's first registry
    // position inside its use-case table) — the SAFE reads as one object with variants.
    const rowNames = [...container.querySelectorAll('tbody tr td:first-child a')].map((a) => a.textContent)
    const families = new Map<string, string[]>()
    for (const d of registry.documents) {
      if (d.family) families.set(d.family, [...(families.get(d.family) ?? []), d.name])
    }
    expect(families.size).toBeGreaterThan(0)
    for (const [family, names] of families) {
      const positions = names.map((n) => rowNames.indexOf(n))
      expect(Math.min(...positions), `${family}: every member renders a row`).toBeGreaterThanOrEqual(0)
      expect(Math.max(...positions) - Math.min(...positions), `${family}: rows must be contiguous`).toBe(names.length - 1)
    }
    // Every family row shows its committed variant label — never invented, never missing.
    const chips = [...container.querySelectorAll('span[title^="Variant in the"]')].map((s) => s.textContent)
    expect(chips.sort()).toEqual(
      registry.documents.filter((d) => d.variant).map((d) => d.variant!).sort(),
    )
  })

  it("heads the publisher column 'Vendor'; committed mappings link their judged product with its logo", () => {
    const { container } = render(<OpenDocumentsPage />)
    const headers = [...container.querySelectorAll('thead th')].map((th) => th.textContent)
    expect(headers).toContain('Vendor')
    expect(headers).not.toContain('Publisher')
    // The mapping is COMMITTED (registry publisherProductId), never guessed: Cooley GO is the
    // judged startup-law-firms product, so its rows link the product page and wear its logo.
    expect(registry.documents.some((d) => d.publisherProductId === 'cooley')).toBe(true)
    const cooleyLink = container.querySelector('a[href="/arena/startup-law-firms/product/cooley"]')
    expect(cooleyLink).not.toBeNull()
    expect(cooleyLink!.querySelector('img[alt="Cooley logo"]')).not.toBeNull()
    // Honest fallback: Y Combinator is not a judged product — plain name, no internal link,
    // no logo invented.
    expect(registry.documents.find((d) => d.publisher === 'Y Combinator')!.publisherProductId).toBeUndefined()
    expect(container.querySelector('img[alt="Y Combinator logo"]')).toBeNull()
    const ycInternalLinks = [...container.querySelectorAll('tbody a')].filter(
      (a) => a.textContent?.includes('Y Combinator') && a.getAttribute('href')?.startsWith('/'),
    )
    expect(ycInternalLinks).toEqual([])
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
