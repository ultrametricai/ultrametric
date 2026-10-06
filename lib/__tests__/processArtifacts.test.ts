import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadDocumentRegistry } from '@/lib/documents'
import { loadArtifacts, loadProcesses } from '@/lib/processes'

// The artifact layer (founder depth wave part 2, 2026-10-01: typed inputs/outputs between
// processes). These tests pin the registry's honesty contract — the rules that make
// processes/artifacts.json a corpus-grounded vocabulary instead of a wishlist:
//   1. TOTALITY — every process carries explicit produces/requires (no zod default hides a
//      gap), and every artifact id used anywhere resolves in the registry.
//   2. ONE CANONICAL PRODUCER — each artifact names one producedBy; any other process claiming
//      it in `produces` must be a documented alsoProducedBy exception, and every documented
//      producer really does produce it.
//   3. NO INVENTED ARTIFACTS — every artifact comes into existence at a committed, named step
//      (node-level producesArtifact, set-equal per task to the task's produces, never on a
//      jurisdiction-conditional node) and is consumed by at least one OTHER process — or is
//      explicitly flagged terminal (both directions enforced).

const DATA_DIR = path.resolve(__dirname, '../../data')
// The RAW corpus — includes the jurisdiction-conditional nodes loadProcesses strips from the
// default view, so we can assert no producesArtifact ever hides on a conditional node.
const RAW = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, '..', 'processes', 'corpus.json'), 'utf8'),
) as Array<{
  id: string
  produces: string[]
  requires: string[]
  dag: { nodes: Array<{ id: string; producesArtifact?: string; jurisdictions?: string[] }> }
}>

const artifacts = loadArtifacts()
const byId = new Map(artifacts.map((a) => [a.id, a]))
const tasks = loadProcesses(DATA_DIR)
const taskIds = new Set(tasks.map((t) => t.id))

describe('artifact registry totality', () => {
  it('is corpus-sized (the founder expectation: roughly 40–80 canonical artifacts), ids unique', () => {
    expect(artifacts.length).toBe(81)
    expect(new Set(artifacts.map((a) => a.id)).size).toBe(artifacts.length)
  })

  it('every process carries explicit produces/requires arrays of known artifact ids', () => {
    expect(RAW.length).toBe(tasks.length)
    for (const t of RAW) {
      expect(Array.isArray(t.produces), `${t.id} produces`).toBe(true)
      expect(Array.isArray(t.requires), `${t.id} requires`).toBe(true)
      for (const aid of [...t.produces, ...t.requires]) {
        expect(byId.has(aid), `${t.id} references unknown artifact ${aid}`).toBe(true)
      }
      expect(new Set(t.produces).size, `${t.id} duplicate produces`).toBe(t.produces.length)
      expect(new Set(t.requires).size, `${t.id} duplicate requires`).toBe(t.requires.length)
    }
  })

  it('every producer process in the registry exists in the corpus', () => {
    for (const a of artifacts) {
      expect(taskIds.has(a.producedBy), `${a.id} producedBy ${a.producedBy}`).toBe(true)
      for (const p of a.alsoProducedBy ?? []) {
        expect(taskIds.has(p), `${a.id} alsoProducedBy ${p}`).toBe(true)
        expect(p, `${a.id}: alsoProducedBy must not repeat the canonical producer`).not.toBe(a.producedBy)
      }
    }
  })
})

describe('one canonical producer, documented exceptions', () => {
  const producesOf = new Map(RAW.map((t) => [t.id, new Set(t.produces)]))

  it('the canonical producer (and every documented exception) really lists the artifact in produces', () => {
    for (const a of artifacts) {
      expect(producesOf.get(a.producedBy)?.has(a.id), `${a.producedBy} must produce ${a.id}`).toBe(true)
      for (const p of a.alsoProducedBy ?? []) {
        expect(producesOf.get(p)?.has(a.id), `${p} is a documented producer of ${a.id}`).toBe(true)
      }
    }
  })

  it('no process produces an artifact it is not a documented producer of', () => {
    for (const t of RAW) {
      for (const aid of t.produces) {
        const a = byId.get(aid)!
        const documented = a.producedBy === t.id || (a.alsoProducedBy ?? []).includes(t.id)
        expect(documented, `${t.id} produces ${aid} without being producedBy/alsoProducedBy`).toBe(true)
      }
    }
  })

  it('no self-requires: a process never requires an artifact it produces', () => {
    for (const t of RAW) {
      const produced = new Set(t.produces)
      for (const aid of t.requires) {
        expect(produced.has(aid), `${t.id} self-requires ${aid}`).toBe(false)
      }
    }
  })
})

describe('no invented artifacts — committed steps and real consumers', () => {
  it('per task, the node-level producesArtifact tags are exactly the task produces set (and never on a conditional node)', () => {
    for (const t of RAW) {
      const tagged: string[] = []
      for (const n of t.dag.nodes) {
        if (!n.producesArtifact) continue
        expect(n.jurisdictions, `${t.id}/${n.id}: producesArtifact on a jurisdiction-conditional node would vanish from the default view`).toBeUndefined()
        tagged.push(n.producesArtifact)
      }
      expect(new Set(tagged).size, `${t.id}: one birth step per artifact`).toBe(tagged.length)
      expect([...new Set(tagged)].sort(), `${t.id}: produces vs node tags`).toEqual([...t.produces].sort())
    }
  })

  it('every artifact is consumed by at least one other process, or explicitly terminal — never both', () => {
    const consumers = new Map<string, string[]>()
    for (const t of RAW) {
      for (const aid of t.requires) {
        consumers.set(aid, [...(consumers.get(aid) ?? []), t.id])
      }
    }
    for (const a of artifacts) {
      const external = (consumers.get(a.id) ?? []).filter((c) => c !== a.producedBy)
      if (a.terminal) {
        expect(external, `terminal artifact ${a.id} must have no consumers`).toEqual([])
      } else {
        expect(external.length, `${a.id} needs a consumer or an explicit terminal flag`).toBeGreaterThan(0)
      }
    }
  })

  it('the typed layer parses through the site loader (required fields, no defaults)', () => {
    // loadProcesses throws on any record missing produces/requires — totality by construction;
    // the assertions above exist to name offenders precisely.
    expect(loadProcesses(DATA_DIR).length).toBe(146)
  })
})

// The registered-document joint (founder 2026-10-06: classic document objects — the deliberate
// flip of the 2026-10-05 absence pin in app/artifacts/__tests__/page.test.tsx): an artifact may
// name the open-documents/registry.json records whose registered template genuinely IS its form.
// Same referential-integrity bar as every cross-registry link (step documents → registry,
// producesArtifact → artifacts.json): a typo'd id fails loudly, and the mapping stays sparse —
// honest absence for every artifact with no registered template, never an invented
// correspondence.
describe('artifact documents — registered templates', () => {
  const registered = new Set(loadDocumentRegistry().documents.map((d) => d.id))
  const mapped = artifacts.filter((a) => a.documents)

  it('every artifact documents id resolves in open-documents/registry.json, no duplicates per artifact', () => {
    for (const a of mapped) {
      expect(a.documents!.length, a.id).toBeGreaterThan(0)
      expect(new Set(a.documents).size, `${a.id}: duplicate document ids`).toBe(a.documents!.length)
      for (const id of a.documents!) {
        expect(registered.has(id), `${a.id}: unknown document id ${id}`).toBe(true)
      }
    }
  })

  it('the mapping stays sparse — only artifacts whose template is genuinely registered carry the field', () => {
    // Band, not an exact count: new registry templates may map, but a mapping sweep that claims
    // most of the registry (bank accounts and chat workspaces have no document template) is a
    // fabrication signal.
    expect(mapped.length).toBeGreaterThanOrEqual(10)
    expect(mapped.length).toBeLessThanOrEqual(25)
    for (const id of ['domain', 'bank-account', 'company-email', 'payroll-account', 'cloud-infrastructure']) {
      expect(byId.get(id)!.documents, `${id} has no registered template — honest absence`).toBeUndefined()
    }
  })

  it('the founder-named anchors landed: the 83(b), the SAFE with variants, the bylaws packages, the NDA standards', () => {
    expect(byId.get('83b-election')!.documents).toEqual(['irs-form-15620'])
    expect(byId.get('executed-safes')!.documents).toEqual([
      'yc-postmoney-safe-cap',
      'yc-postmoney-safe-discount',
      'yc-postmoney-safe-mfn',
      'yc-safe-intl-variants',
    ])
    expect(byId.get('bylaws')!.documents).toEqual(['cooley-incorporation-package-de', 'orrick-incorporation-toolkit'])
    expect(byId.get('executed-nda')!.documents).toContain('onenda')
    expect(byId.get('ein')!.documents).toEqual(['irs-form-ss4'])
  })
})
