import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadDocumentRegistry, openDocumentById } from '@/lib/documents'

// Step documents (founder spike 2026-10-02, form_001 reference depth; extended the same day —
// "Processes link to the open documents"): corpus nodes may carry `documents: string[]` — ids
// into open-documents/registry.json (processes/README.md "Step documents"), now RENDERED as
// external-link chips on the process pages (components/ProcessDag.tsx). This is the
// referential-integrity gate the house standard demands for every cross-registry link
// (producesArtifact → artifacts.json, rule source_ids → sources/): a typo'd document id must
// fail loudly, not silently dangle — both ways (corpus id → registry record via the test
// below, and the render path throws on an unknown id via openDocumentById). Reads the RAW
// corpus so jurisdiction-conditional nodes are covered too.

const RAW = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../processes/corpus.json'), 'utf8'),
) as Array<{ id: string; dag: { nodes: Array<{ id: string; documents?: string[] }> } }>

const tagged = RAW.flatMap((t) =>
  t.dag.nodes.filter((n) => n.documents).map((n) => ({ task: t.id, node: n.id, documents: n.documents! })),
)

describe('step documents cross-reference', () => {
  it('every node documents id resolves in open-documents/registry.json', () => {
    const known = new Set(loadDocumentRegistry().documents.map((d) => d.id))
    for (const t of tagged) {
      expect(t.documents.length, `${t.task}/${t.node}`).toBeGreaterThan(0)
      for (const id of t.documents) {
        expect(known.has(id), `${t.task}/${t.node}: unknown document id ${id}`).toBe(true)
      }
      // No duplicate ids on one step.
      expect(new Set(t.documents).size, `${t.task}/${t.node}`).toBe(t.documents.length)
    }
  })

  it('the render lookup resolves every tagged id and throws on an unknown one (both ways)', () => {
    for (const t of tagged) {
      for (const id of t.documents) {
        expect(openDocumentById(id).url.startsWith('https://'), `${t.task}/${t.node}/${id}`).toBe(true)
      }
    }
    expect(() => openDocumentById('no-such-document')).toThrowError(/Unknown document id no-such-document/)
  })

  it('the spike landed: form_001 cites the Cooley DE package (+ the Orrick toolkit on bylaws/consents) and IRS Form 15620 on BOTH 83(b) steps', () => {
    const byNode = new Map(tagged.filter((t) => t.task === 'form_001').map((t) => [t.node, t.documents]))
    expect(byNode.get('n6')).toEqual(['cooley-incorporation-package-de', 'orrick-incorporation-toolkit'])
    expect(byNode.get('n7')).toEqual(['cooley-incorporation-package-de'])
    expect(byNode.get('n8a')).toEqual(['irs-form-15620'])
    expect(byNode.get('n8')).toEqual(['irs-form-15620'])
    expect(byNode.get('n4')).toEqual(['de-formation-instructions'])
  })

  it('the founder-named extensions landed (2026-10-02): SAFEs, term sheet, NVCA suite, offer letter, SS-4, NDAs, DPAs, 83(b)', () => {
    const byKey = new Map(tagged.map((t) => [`${t.task}/${t.node}`, t.documents]))
    expect(byKey.get('fund_001/n2')).toEqual([
      'yc-postmoney-safe-cap', 'yc-postmoney-safe-discount', 'yc-postmoney-safe-mfn', 'yc-safe-user-guide',
    ])
    expect(byKey.get('fund_002/n1')).toEqual(['yc-series-a-term-sheet'])
    expect(byKey.get('fund_002/n4')).toContain('nvca-stock-purchase-agreement')
    expect(byKey.get('hr_001/n1')).toEqual(['cooley-offer-letter'])
    expect(byKey.get('form_002/n3')).toEqual(['irs-form-ss4'])
    expect(byKey.get('legal_001/n2')).toContain('onenda')
    expect(byKey.get('comp_010/n4')).toContain('onedpa')
    expect(byKey.get('startup_002/n4b')).toEqual(['irs-form-15620'])
    expect(byKey.get('startup_002/n5')).toEqual(['irs-form-15620'])
    // Honest-extent pin: the obvious mappings, not forced totality — the corpus-wide count
    // stays in the curated band (the spike's 4 steps + the 2026-10-02 extension).
    expect(tagged.length).toBeGreaterThanOrEqual(15)
    expect(tagged.length).toBeLessThanOrEqual(40)
  })
})
