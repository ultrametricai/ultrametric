import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { loadBusinessLogicMap } from './businessLogicMap'
import { loadArtifacts } from './processes'

// Company data fields (founder 2026-10-07: "company data fields figured out — e.g. Date of
// incorporation or things from the repo's business logic"). The registry
// (processes/company-fields.json) is a typed vocabulary of company-LEVEL data values with an
// honest derivation rule: a field exists here only because a committed open module's exported
// function genuinely takes it (lib/openstartup signatures, read, not imagined) AND a committed
// registry artifact establishes it — never speculative. Each field names:
//   - type: date | money | number | enum | string (enum fields carry their `values`);
//   - producedBy: the processes/artifacts.json artifact whose creation establishes the value
//     (the charter sets the authorized shares; the 409A report sets the common FMV);
//   - consumedBy: the lib/openstartup module functions that take it, each naming the real
//     exported function and the parameter/property (`input`) the value enters as.
// Totality is vitest-gated (lib/__tests__/companyFields.test.ts): every producedBy resolves in
// the artifact registry, every consumer module is a business-logic-map module, and every named
// function is a real exported function of that module file. Rendered as the "Data fields"
// section on /artifacts/[id] (fields this artifact establishes) and /open-modules/[id] (fields
// this module consumes). Published schema: schemas/company-fields.schema.json (generated,
// drift-tested).

export const COMPANY_FIELD_TYPES = ['date', 'money', 'number', 'enum', 'string'] as const
export type CompanyFieldType = (typeof COMPANY_FIELD_TYPES)[number]

// One (module, function, input) consumer: the committed open-module function that takes the
// field. `module` is a business-logic-map id (the lib/openstartup file basename); `function`
// must be a real exported function of that file (misspellings fail the vitest gate); `input`
// names the parameter or input-object property the value enters as — documentation of the
// exact seam, matched against the signature when the entry is curated.
export const CompanyFieldConsumerSchema = z.object({
  module: z.string().min(1),
  function: z.string().min(1),
  input: z.string().min(1),
})
export type CompanyFieldConsumer = z.infer<typeof CompanyFieldConsumerSchema>

export const CompanyFieldSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'field id must be kebab-case'),
    label: z.string().min(1),
    type: z.enum(COMPANY_FIELD_TYPES),
    // The closed value set — present exactly when type is 'enum' (vitest-gated pairing).
    values: z.string().min(1).array().min(2).optional(),
    description: z.string().min(1),
    // The processes/artifacts.json artifact whose creation establishes this value.
    producedBy: z.string().min(1),
    consumedBy: CompanyFieldConsumerSchema.array().min(1),
  })
  .strict()
export type CompanyField = z.infer<typeof CompanyFieldSchema>

export const CompanyFieldsRegistrySchema = z
  .object({
    $comment: z.string().optional(),
    fields: CompanyFieldSchema.array().min(1),
  })
  .strict()

const fieldsFile = () => path.join(process.cwd(), 'processes', 'company-fields.json')
let fieldsCache: CompanyField[] | null = null
export function loadCompanyFields(): CompanyField[] {
  if (!fieldsCache) {
    const parsed = CompanyFieldsRegistrySchema.parse(
      JSON.parse(fs.readFileSync(fieldsFile(), 'utf8')),
    ).fields
    const seen = new Set<string>()
    for (const f of parsed) {
      if (seen.has(f.id)) throw new Error(`duplicate company field id ${f.id}`)
      seen.add(f.id)
    }
    fieldsCache = parsed
  }
  return fieldsCache
}

// ---------------------------------------------------------------------------------------------
// Render rows (server-only, like the rest of this module): the registry resolved against the
// artifact registry and the business-logic map so the two page families link each other.

export interface ArtifactFieldRow {
  field: CompanyField
  // One entry per distinct consuming module, registry order, with its site page and the
  // function names the registry wires.
  consumers: Array<{ moduleId: string; moduleLabel: string; href: string; functions: string[] }>
}

/** The fields this artifact establishes (registry order) — the /artifacts/[id] table. */
export function fieldsEstablishedBy(artifactId: string): ArtifactFieldRow[] {
  const map = loadBusinessLogicMap()
  return loadCompanyFields()
    .filter((f) => f.producedBy === artifactId)
    .map((field) => {
      const consumers: ArtifactFieldRow['consumers'] = []
      for (const c of field.consumedBy) {
        const m = map[c.module]
        if (!m) throw new Error(`company field ${field.id}: unknown module ${c.module}`)
        const existing = consumers.find((x) => x.moduleId === c.module)
        if (existing) {
          if (!existing.functions.includes(c.function)) existing.functions.push(c.function)
        } else {
          consumers.push({
            moduleId: c.module,
            moduleLabel: m.label,
            href: `/open-modules/${c.module}`,
            functions: [c.function],
          })
        }
      }
      return { field, consumers }
    })
}

export interface ModuleFieldRow {
  field: CompanyField
  // The establishing artifact, linked.
  artifactId: string
  artifactLabel: string
  artifactHref: string
  // The module's functions that take the field, registry order.
  functions: string[]
}

/** The fields this module's functions consume (registry order) — the /open-modules/[id] table. */
export function fieldsConsumedByModule(moduleId: string): ModuleFieldRow[] {
  const artifactsById = new Map(loadArtifacts().map((a) => [a.id, a]))
  const rows: ModuleFieldRow[] = []
  for (const field of loadCompanyFields()) {
    const functions: string[] = []
    for (const c of field.consumedBy) {
      if (c.module === moduleId && !functions.includes(c.function)) functions.push(c.function)
    }
    if (functions.length === 0) continue
    const artifact = artifactsById.get(field.producedBy)
    if (!artifact) throw new Error(`company field ${field.id}: unknown artifact ${field.producedBy}`)
    rows.push({
      field,
      artifactId: artifact.id,
      artifactLabel: artifact.label,
      artifactHref: `/artifacts/${artifact.id}`,
      functions,
    })
  }
  return rows
}
