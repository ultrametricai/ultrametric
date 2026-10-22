import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { operationalSources } from '@/lib/__tests__/helpers/operational-sources'
import { z } from 'zod'
import { CompanyFieldsRegistrySchema } from '@/lib/companyFields'
import { shape } from '@/lib/founderOps'
import { ArtifactRegistrySchema, VendorRegistrySchema } from '@/lib/processes'
import { processDefinitionSchema } from '@/lib/shared-processes/catalog'
import {
  ARTIFACT_REGISTRY_SCHEMA_FILE, artifactRegistrySchemaJson,
  COMPANY_FIELDS_SCHEMA_FILE, companyFieldsSchemaJson,
  OPERATIONAL_PROCESS_SCHEMA_FILE, operationalProcessSchemaJson,
  PROCESS_SCHEMA_FILE, processSchemaJson, LEGACY_PROCESS_SCHEMA_FILE,
  VENDOR_REGISTRY_SCHEMA_FILE, vendorRegistrySchemaJson,
} from '../scripts/generate-corpus-schemas'

// Corpus lift stage 2: schemas/operational-process.schema.json is GENERATED from the zod source
// of truth (ProcessTaskSchema in lib/processes.ts) by scripts/generate-corpus-schemas.ts. These
// tests pin the two contracts that make the published schema trustworthy:
//   1. NO DRIFT — regenerating produces byte-identical committed output, so a zod-schema edit
//      that forgets to regenerate (or a hand-edit of the generated file) fails loudly.
//   2. THE CORPUS CONFORMS — every committed open-processes/corpus.json record validates against the
//      published schema with lib/founderOps.ts's shape() checker (the same structural validator
//      that gates the jurisdiction-scoped workflow layer), so the schema we publish is true of
//      the data we ship, not just of the code.

const ROOT = path.resolve(__dirname, '..')

describe('canonical process schema publication', () => {
  const committed = fs.readFileSync(PROCESS_SCHEMA_FILE, 'utf8')
  const schema = JSON.parse(committed)
  const published = z.fromJSONSchema(schema)
  const logo = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'open-processes/generate-a-brand-logo.json'), 'utf8'))

  it('publishes the canonical validator without drift or omitted fields', () => {
    expect(processSchemaJson()).toBe(committed)
    const { $schema, $defs, ...canonical } = z.toJSONSchema(processDefinitionSchema)
    expect(schema.$schema).toBe($schema)
    expect(schema.$id).toBe('https://raw.githubusercontent.com/ultrametricai/ultrametric/main/schemas/process.schema.json')
    expect(schema.oneOf).toEqual([{ $ref: '#/$defs/canonical' }, { $ref: '#/$defs/legacy' }])
    expect(schema.$defs.canonical).toEqual(canonical)
    for (const [name, definition] of Object.entries($defs ?? {})) expect(schema.$defs[name]).toEqual(definition)
    for (const variant of schema.$defs.canonical.anyOf) {
      expect(variant.required).toContain('entrySteps')
      expect(variant.properties.schemaVersion.const).toBe(1)
    }
  })

  it('preserves the complete canonical logo, including choices, edges, outputs and classifications', () => {
    const record = logo()
    expect(published.parse(record)).toEqual(processDefinitionSchema.parse(record))
    expect(published.parse(record)).toEqual(record)
    expect(record.metadata.produces).toEqual(['brand-logo'])
    expect(record.parts.find((part: { id: string }) => part.id === 'n2').metadata.producesArtifact).toBe('brand-logo')
    expect(record.parts[0].metadata).toMatchObject({ route: 'agent', reversibility: 'reversible' })
  })

  it('provides a canonical-only reference with its recursive definitions intact', () => {
    const canonical = z.fromJSONSchema({ $schema: schema.$schema, $defs: schema.$defs, $ref: '#/$defs/canonical' })
    expect(canonical.parse(logo())).toEqual(logo())
    const legacy = JSON.parse(fs.readFileSync(path.join(ROOT, 'open-processes/equity/us-de/409a-valuation.json'), 'utf8'))
    expect(canonical.safeParse(legacy).success).toBe(false)
  })

  it('publishes ordered chains with empty graph entries while preserving ordinary entry requirements', () => {
    const names = JSON.parse(fs.readFileSync(path.join(ROOT, 'open-processes/catalog.json'), 'utf8')).processes
    for (const name of names) {
      const record = JSON.parse(fs.readFileSync(path.join(ROOT, 'open-processes', `${name}.json`), 'utf8'))
      expect(published.parse(record)).toEqual(record)
      if (record.taskIds) {
        expect(record.entrySteps).toEqual([])
        expect(published.safeParse({ ...record, taskIds: [] }).success).toBe(false)
        expect(published.safeParse({ ...record, entrySteps: [record.parts[0].id] }).success).toBe(false)
      }
    }
  })

  it.each([
    ['missing entries', (record: ReturnType<typeof logo>) => { delete record.entrySteps }],
    ['empty entries', (record: ReturnType<typeof logo>) => { record.entrySteps = [] }],
    ['unknown version', (record: ReturnType<typeof logo>) => { record.schemaVersion = 2 }],
    ['invalid part kind', (record: ReturnType<typeof logo>) => { record.parts[0].kind = 'unknown' }],
    ['missing choice identity', (record: ReturnType<typeof logo>) => { delete record.parts[1].options[0].id }],
    ['missing edge target', (record: ReturnType<typeof logo>) => { delete record.links[0].to }],
    ['invalid edge option', (record: ReturnType<typeof logo>) => { record.links[1].option = 4 }],
    ['chain fields on an ordinary graph', (record: ReturnType<typeof logo>) => { record.taskIds = ['brand_002'] }],
  ])('matches the canonical validator when rejecting %s', (_, mutate) => {
    const record = logo()
    mutate(record)
    expect(processDefinitionSchema.safeParse(record).success).toBe(false)
    expect(published.safeParse(record).success).toBe(false)
  })

  it('the canonical-definition template stays a valid starting point', () => {
    // templates/canonical-process.json is the blank contributors copy to author an
    // open-processes/<slug>.json definition (CONTRIBUTING.md §5). The blank must stay
    // schema-valid when the canonical contract changes (templates/README.md rule).
    const template = JSON.parse(fs.readFileSync(path.join(ROOT, 'templates/canonical-process.json'), 'utf8'))
    expect(processDefinitionSchema.safeParse(template).success).toBe(true)
    expect(published.safeParse(template).success).toBe(true)
    // The template models the geo dimension: a step carrying geoResolutions with the
    // required US analog entry (lib/processes.ts load-enforces this on committed records).
    const geoStep = template.parts.find((part: { metadata: Record<string, unknown> }) => part.metadata.geoResolutions)
    expect(geoStep).toBeDefined()
    const resolutions = geoStep.metadata.geoResolutions as Array<{ country: string; kind: string }>
    expect(resolutions.find((r) => r.country === 'US')?.kind).toBe('analog')
  })

  it('keeps legacy records valid through the preserved contract and existing URL', () => {
    const legacy = JSON.parse(fs.readFileSync(LEGACY_PROCESS_SCHEMA_FILE, 'utf8'))
    const { $schema, $defs, ...legacyDefinition } = legacy
    expect(schema.$schema).toBe($schema)
    expect(schema.$defs.legacy).toEqual(legacyDefinition)
    for (const [name, definition] of Object.entries($defs)) expect(schema.$defs[name]).toEqual(definition)
    const directory = path.join(ROOT, 'open-processes/equity/us-de')
    for (const file of fs.readdirSync(directory).filter(file => file.endsWith('.json'))) {
      const record = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'))
      const errors: string[] = []
      shape(record, legacy, file, errors)
      shape(record, schema, file, errors)
      expect(errors).toEqual([])
      expect(published.parse(record)).toEqual(z.fromJSONSchema(legacy).parse(record))
    }
    const invalid = JSON.parse(fs.readFileSync(path.join(directory, '409a-valuation.json'), 'utf8'))
    delete invalid.automation_boundary
    expect(published.safeParse(invalid).success).toBe(false)
  })
})

describe('operational-process schema publication', () => {
  const committed = fs.readFileSync(OPERATIONAL_PROCESS_SCHEMA_FILE, 'utf8')

  it('regenerating produces byte-identical committed output (no drift)', () => {
    expect(operationalProcessSchemaJson()).toBe(committed)
  })

  it('is a draft-2020-12 object schema with the corpus\'s load-bearing requireds', () => {
    const schema = JSON.parse(committed)
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
    expect(schema.type).toBe('object')
    // The score orderings + the GEO dimension are required by construction — the schema must
    // publish that, or external validators would accept an untagged process our loader rejects.
    // timeOrder left the required set with the Situations classification (founder 2026-10-01):
    // it is required on kind 'process' and forbidden on kind 'situation', a kind-conditional
    // invariant loadProcesses enforces at load time (the published schema stays a plain shape).
    for (const key of ['id', 'title', 'geoScope', 'cadence', 'annoyance', 'risk', 'growthImpact', 'dag']) {
      expect(schema.required, `required ${key}`).toContain(key)
    }
    expect(schema.required).not.toContain('timeOrder')
    // The situation classification is published: kind (zod-defaulted 'process'), the trigger
    // sentence, and the urgency clock.
    expect(schema.properties.kind?.enum ?? schema.properties.kind?.anyOf).toBeDefined()
    expect(schema.properties.trigger).toBeDefined()
    expect(schema.properties.urgency?.enum).toEqual(['hours', 'days', 'weeks'])
  })

  it('every canonical operational projection validates against the published schema via shape()', () => {
    const schema = JSON.parse(committed)
    const corpus = operationalSources(ROOT)
    expect(Array.isArray(corpus)).toBe(true)
    expect(corpus.length).toBeGreaterThanOrEqual(100)
    const errors: string[] = []
    for (const record of corpus) {
      shape(record as Parameters<typeof shape>[0], schema, `process ${(record as { id?: string })?.id ?? '?'}`, errors)
    }
    expect(errors).toEqual([])
  })
})

// The vendor-registry schema (SSOT migration, founder audit 2026-09-30): same two contracts —
// no drift, and the committed registry conforms to what we publish.
describe('process vendor-registry schema publication', () => {
  const committed = fs.readFileSync(VENDOR_REGISTRY_SCHEMA_FILE, 'utf8')

  it('regenerating produces byte-identical committed output (no drift)', () => {
    expect(vendorRegistrySchemaJson()).toBe(committed)
  })

  it('the committed registry conforms: shape() on the published schema + the zod source', () => {
    const schema = JSON.parse(committed)
    const registry = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'open-processes', 'vendor-registry.json'), 'utf8'),
    )
    const errors: string[] = []
    shape(registry, schema, 'vendor registry', errors)
    expect(errors).toEqual([])
    // shape() is the shallow published-contract checker (it doesn't walk record entries) — the
    // zod source of truth validates every entry strictly, exactly as the site loader does.
    expect(() => VendorRegistrySchema.parse(registry)).not.toThrow()
    expect(Object.keys(registry.vendors).length).toBeGreaterThanOrEqual(150)
  })
})

// The artifact-registry schema (founder depth wave part 2, 2026-10-01): same two contracts —
// no drift, and the committed registry conforms to what we publish. The artifact layer's
// SEMANTIC invariants (one canonical producer, producer steps exist, consumed-or-terminal) are
// corpus-tested in lib/__tests__/processArtifacts.test.ts; this file pins only the published
// contract.
describe('process artifact-registry schema publication', () => {
  const committed = fs.readFileSync(ARTIFACT_REGISTRY_SCHEMA_FILE, 'utf8')

  it('regenerating produces byte-identical committed output (no drift)', () => {
    expect(artifactRegistrySchemaJson()).toBe(committed)
  })

  it('the committed registry conforms: shape() on the published schema + the zod source', () => {
    const schema = JSON.parse(committed)
    const registry = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'open-artifacts', 'registry.json'), 'utf8'),
    )
    const errors: string[] = []
    shape(registry, schema, 'artifact registry', errors)
    expect(errors).toEqual([])
    expect(() => ArtifactRegistrySchema.parse(registry)).not.toThrow()
    expect(registry.artifacts.length).toBeGreaterThanOrEqual(40)
  })
})

// The company-fields schema (founder 2026-10-07: typed company data fields): same two
// contracts — no drift, and the committed registry conforms. The registry's SEMANTIC
// invariants (producedBy resolves, every consumer is a real exported function) are tested in
// lib/__tests__/companyFields.test.ts; this file pins only the published contract.
describe('company-fields schema publication', () => {
  const committed = fs.readFileSync(COMPANY_FIELDS_SCHEMA_FILE, 'utf8')

  it('regenerating produces byte-identical committed output (no drift)', () => {
    expect(companyFieldsSchemaJson()).toBe(committed)
  })

  it('the committed registry conforms: shape() on the published schema + the zod source', () => {
    const schema = JSON.parse(committed)
    const registry = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'open-artifacts', 'fields.json'), 'utf8'),
    )
    const errors: string[] = []
    shape(registry, schema, 'company fields', errors)
    expect(errors).toEqual([])
    expect(() => CompanyFieldsRegistrySchema.parse(registry)).not.toThrow()
    expect(registry.fields.length).toBeGreaterThanOrEqual(10)
  })
})
