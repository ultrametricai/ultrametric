import { describe, expect, it } from 'vitest'
import type { CatalogProcess } from '../shared-processes/catalog'
import type { Part, Reference } from '../shared-processes/schema'
import { projectChain, projectJurisdiction, projectOperational, referenceFields } from '../shared-processes/projection'

const part = (fields: Partial<Part> = {}): Part => ({
  id: 'prepare', kind: 'step', title: 'Prepare', guidance: null, when: null, ref: null,
  options: [], references: [], notes: [], metadata: { route: 'person', estimatedMinutes: 8 }, ...fields,
})
const process = (fields: Partial<CatalogProcess> = {}): CatalogProcess => ({
  slug: 'fixture-process', entrySteps: ['prepare'], record: {
    schemaVersion: 1, id: 'fixture', kind: 'process', title: 'Fixture process', summary: 'Fixture summary',
    outcomes: ['Prepared'], guidance: null, parts: [part()], links: [], references: [], notes: [],
    metadata: { phase: 'operate', activeMinutes: 8, totalEstimatedMinutes: 8, custom: { retained: true } },
  }, ...fields,
})

describe('canonical projection contracts', () => {
  it('maps each reference role to the existing consumer field', () => {
    const references: Reference[] = [
      { kind: 'vendor', role: 'involves', id: 'one' }, { kind: 'vendor', role: 'involves', id: 'two' },
      { kind: 'vendor', role: 'stated-vendor', id: 'chosen' }, { kind: 'vendor', role: 'candidate', id: 'candidate' },
      { kind: 'category', role: 'rankings', id: 'primary' }, { kind: 'category', role: 'additional-rankings', id: 'extra' },
      { kind: 'rule', role: 'evidence', id: 'rule' }, { kind: 'product', role: 'additional-candidate', id: 'arena/product' },
      { kind: 'url', role: 'legacy-action-link', url: 'https://example.test/action', title: 'Act', description: null },
      { kind: 'url', role: 'legacy-signup-link', url: 'https://example.test/signup', title: null, description: null },
      { kind: 'source', role: 'evidence', id: 'source' },
    ]
    expect(referenceFields(references)).toEqual({
      vendors: ['one', 'two'], vendor: 'chosen', vendorOptions: ['candidate'], optionsArenaId: 'primary',
      extraOptionArenas: ['extra'], rule_ids: ['rule'], extraOptionRefs: [{ arenaId: 'arena', productId: 'product' }],
      actionUrl: 'https://example.test/action', actionLabel: 'Act', signupUrl: 'https://example.test/signup',
    })
  })

  it('preserves metadata, default precedence, nested alternatives, conditions, references and edges', () => {
    const input = process()
    input.record.references = [{ kind: 'vendor', role: 'involves', id: 'record-vendor' }]
    input.record.parts = [part({
      kind: 'decision', references: [{ kind: 'category', role: 'rankings', id: 'arena' }], options: [
        { id: 'default', title: 'Default', summary: '', when: null, parts: [], notes: [],
          references: [{ kind: 'vendor', role: 'stated-vendor', id: 'default-vendor' }],
          metadata: { route: 'agent', estimatedMinutes: 3, retainedDefault: 'yes' } },
        { id: 'manual', title: 'Manual', summary: 'Review it', when: 'needs review',
          metadata: { context: { entity: 'fixture' }, custom: ['method'] }, notes: [],
          references: [{ kind: 'vendor', role: 'candidate', id: 'manual-vendor' }],
          parts: [part({ id: 'review', title: 'Review', metadata: { route: 'person', retainedNested: true } })] },
      ],
    }), part({ id: 'conditional', title: 'Conditional', metadata: { jurisdictions: ['us-de'], estimatedMinutes: 2 } })]
    input.record.links = [{ from: 'prepare', to: 'conditional', when: 'Delaware', option: 'manual' }]
    expect(projectOperational(input, [input])).toEqual({
      phase: 'operate', activeMinutes: 8, totalEstimatedMinutes: 8, custom: { retained: true },
      vendors: ['record-vendor'], id: 'fixture', title: 'Fixture process', description: 'Fixture summary',
      dag: { nodes: [
        { id: 'prepare', label: 'Prepare', route: 'agent', estimatedMinutes: 3, retainedDefault: 'yes',
          optionsArenaId: 'arena', vendor: 'default-vendor', methods: [
            { id: 'manual', label: 'Manual', summary: 'Review it', custom: ['method'], vendorOptions: ['manual-vendor'],
              context: { entity: 'fixture', when: 'needs review' },
              subSteps: [{ id: 'review', label: 'Review', route: 'person', retainedNested: true }] },
          ] },
        { id: 'conditional', label: 'Conditional', jurisdictions: ['us-de'], estimatedMinutes: 2 },
      ], edges: [{ from: 'prepare', to: 'conditional', when: 'Delaware', option: 'manual' }] },
    })
  })

  it('resolves reference IDs to canonical slugs and rejects missing targets', () => {
    const input = process()
    input.record.parts = [part({ kind: 'reference', ref: 'target' })]
    const target = process({ slug: 'target-slug' })
    target.record.id = 'target'
    expect(projectOperational(input, [input, target])?.dag.nodes[0].processRef).toBe('target-slug')
    expect(() => projectOperational(input, [input])).toThrow('unresolved reference target')
  })

  it('withholds aggregate timing when a main step has unknown timing', () => {
    const input = process()
    input.record.parts[0].metadata = { custom: true }
    const result = projectOperational(input, [input])!
    expect(result).not.toHaveProperty('activeMinutes')
    expect(result).not.toHaveProperty('totalEstimatedMinutes')
    expect(result.dag.nodes[0]).toEqual({ custom: true, id: 'prepare', label: 'Prepare' })
    input.record.parts[0].metadata.jurisdictions = ['us-de']
    expect(projectOperational(input, [input])).toHaveProperty('totalEstimatedMinutes', 8)
  })

  it('preserves ordered chain membership and metadata without projecting it as an operational task', () => {
    const input = process({ taskIds: ['second', 'first'], entrySteps: [] })
    expect(projectChain(input)).toEqual({
      phase: 'operate', activeMinutes: 8, totalEstimatedMinutes: 8, custom: { retained: true },
      id: 'fixture', name: 'Fixture process', tagline: 'Fixture summary', taskIds: ['second', 'first'],
    })
    expect(projectOperational(input, [input])).toBeNull()
    expect(projectChain(process())).toBeNull()
  })

  it('retains the separately published jurisdiction workflow shape', () => {
    const input = process()
    input.record.metadata = { applicability: { entity_jurisdiction: 'us-de' }, version: 1 }
    input.record.references = [{ kind: 'rule', role: 'evidence', id: 'rule' }]
    expect(projectJurisdiction(input)).toEqual({
      applicability: { entity_jurisdiction: 'us-de' }, version: 1, rule_ids: ['rule'],
      id: 'fixture', title: 'Fixture process', summary: 'Fixture summary', outputs: ['Prepared'],
      steps: [{ id: 'prepare', action: 'Prepare', route: 'person', estimatedMinutes: 8 }],
    })
    expect(projectOperational(input, [input])).toBeNull()
    expect(projectJurisdiction(process())).toBeNull()
  })
})
