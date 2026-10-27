import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CONFORMANCE_DIR,
  CONFORMANCE_MODULES,
  conformanceVectorJson,
  firstMismatch,
} from '../scripts/generate-conformance-vectors'

// The conformance-vector gate (open-modules/conformance/): the published vectors are the
// worked examples other implementations test against, so they must stay exactly what the
// generator produces and exactly what the live modules compute. Contracts pinned here:
//   1. NO DRIFT — regenerating every vector file reproduces the committed bytes (this also
//      re-executes every case through the live entrypoints at test time).
//   2. THE COMMITTED ARTIFACT PASSES — each committed JSON case, parsed from disk, replays
//      through its module's entrypoint and matches within its stated tolerance (guards
//      hand-edits to the JSON independently of the in-memory definitions).
//   3. REGISTRY AGREEMENT — every vector file calls the entrypoint registry.json documents
//      for that module, so inputSchema there describes `inputs` here.
//   4. PROVENANCE — every case carries a nonempty name, description, and source, unique
//      names per file, and the directory holds exactly the generated files plus README.md.

const ROOT = path.resolve(__dirname, '..')

interface CommittedCase {
  name: string
  description: string
  source: string
  tolerance?: number
  inputs: unknown[]
  expected: unknown
}

interface CommittedVectorFile {
  module: string
  entrypoint: string
  implementation: { file: string; sha256: string }
  readme: string
  cases: CommittedCase[]
}

const committedByModule = new Map<string, { raw: string; doc: CommittedVectorFile }>(
  CONFORMANCE_MODULES.map((def) => {
    const raw = fs.readFileSync(path.join(CONFORMANCE_DIR, `${def.id}.json`), 'utf8')
    return [def.id, { raw, doc: JSON.parse(raw) as CommittedVectorFile }]
  }),
)

describe('open-modules/conformance/', () => {
  it('holds exactly the generated vector files plus README.md', () => {
    const files = fs.readdirSync(CONFORMANCE_DIR).sort()
    const wanted = [...CONFORMANCE_MODULES.map((def) => `${def.id}.json`), 'README.md'].sort()
    expect(files).toEqual(wanted)
  })

  for (const def of CONFORMANCE_MODULES) {
    describe(def.id, () => {
      const committed = committedByModule.get(def.id)!

      it('regenerates byte-identical (no drift, no hand edits; every case re-executed)', () => {
        expect(conformanceVectorJson(def)).toBe(committed.raw)
      })

      it('every committed case passes against the live entrypoint within its tolerance', async () => {
        const ns: Record<string, unknown> = await import(`../lib/openstartup/${def.id}.ts`)
        const fn = ns[committed.doc.entrypoint]
        expect(typeof fn, `${def.id}: committed entrypoint ${committed.doc.entrypoint}`).toBe('function')
        for (const c of committed.doc.cases) {
          const result = (fn as (...args: unknown[]) => unknown)(...structuredClone(c.inputs))
          const mismatch = firstMismatch(c.expected, result, c.tolerance ?? 0)
          expect(mismatch, `${def.id}/${c.name}: ${mismatch}`).toBeNull()
        }
      })

      it('every case carries provenance: unique name, description, source', () => {
        const names = new Set<string>()
        expect(committed.doc.cases.length).toBeGreaterThan(0)
        for (const c of committed.doc.cases) {
          expect(c.name.length, `${def.id}: case name`).toBeGreaterThan(0)
          expect(names.has(c.name), `${def.id}: duplicate case name ${c.name}`).toBe(false)
          names.add(c.name)
          expect(c.description.length, `${def.id}/${c.name}: description`).toBeGreaterThan(0)
          expect(c.source.length, `${def.id}/${c.name}: source`).toBeGreaterThan(0)
        }
      })
    })
  }

  it('every vector file calls the entrypoint registry.json documents for its module', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'open-modules', 'registry.json'), 'utf8')) as {
      modules: { id: string; entrypoint: { function: string } }[]
    }
    const registered = new Map(registry.modules.map((m) => [m.id, m.entrypoint.function]))
    for (const def of CONFORMANCE_MODULES) {
      const { doc } = committedByModule.get(def.id)!
      expect(registered.has(def.id), `${def.id}: not a registered module`).toBe(true)
      expect(doc.entrypoint, `${def.id}: entrypoint diverges from registry.json`).toBe(registered.get(def.id))
      expect(doc.module).toBe(def.id)
      expect(doc.implementation.file).toBe(`lib/openstartup/${def.id}.ts`)
    }
  })
})
