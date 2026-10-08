import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { loadBusinessLogicMap } from './businessLogicMap'
import { loadArtifacts, loadProcesses, processSlug, type ProcessTask } from './processes'
import { areaOfTask, type Area } from './processRows'

// Company data fields (founder 2026-10-07: "company data fields figured out — e.g. Date of
// incorporation or things from the repo's business logic"; widened 2026-10-08: "a page that
// explains the specification of data fields like an EIN"). The registry
// (processes/company-fields.json) is a typed vocabulary of company-LEVEL data values with an
// honest derivation rule, widened once and deliberately for the identifier fields: a field
// exists here only because a committed registry artifact establishes it AND one of two
// committed consumption paths is real —
//   (a) a committed lib/openstartup exported function takes it (signatures read from the
//       module source, never imagined), listed in `consumedBy`; OR
//   (b) a committed corpus process requires-and-carries it: the establishing artifact sits in
//       the `requires` list of committed processes/corpus.json records, which consume the
//       value through the artifact (the EIN number entered on the bank KYC, the Delaware file
//       number the annual-report portal keys on). These fields carry no `consumedBy`; their
//       consuming processes are COMPUTED from the corpus requires edges, never hand-listed.
// Each field names:
//   - type: date | money | number | enum | string (enum fields carry their `values`);
//   - producedBy: the processes/artifacts.json artifact whose creation establishes the value
//     (the charter sets the authorized shares; the 409A report sets the common FMV; the IRS
//     EIN assignment sets the EIN itself);
//   - consumedBy (path (a) only): the lib/openstartup module functions that take it, each
//     naming the real exported function and the parameter/property (`input`) it enters as;
//   - spec: the field's specification (founder 2026-10-08) — the format sentence, a regex
//     `pattern` where the authority's format is strict, the authority's own documented
//     `example` where one exists (the IRS SS-4 instructions' 12-3456789; never an invented
//     number), the assigning/defining `authority`, the documents the value appears on
//     (`whereItAppears`), and `sources`: URL citations for the format claims, every URL
//     fetch-verified when curated.
// Totality is vitest-gated (lib/__tests__/companyFields.test.ts): every producedBy resolves in
// the artifact registry, every consumer module is a business-logic-map module, every named
// function is a real exported function of that module file, and every field without module
// consumers has real corpus requires edges on its establishing artifact. Rendered on
// /fields (index) and /fields/[id] (the spec page), as the "Data fields" section on
// /artifacts/[id] (fields this artifact establishes), and on /open-modules/[id] (fields this
// module consumes). Published schema: schemas/company-fields.schema.json (generated,
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

// One cited source for a spec's format claims: the authority's own page (IRS instructions,
// Delaware Division of Corporations portal, the statute). Every URL is fetch-verified when the
// entry is curated — the evidence doctrine's no-fabricated-URL rule.
export const CompanyFieldSpecSourceSchema = z
  .object({
    label: z.string().min(1),
    url: z.string().url(),
  })
  .strict()
export type CompanyFieldSpecSource = z.infer<typeof CompanyFieldSpecSourceSchema>

// The field's specification (founder 2026-10-08: "a page that explains the specification of
// data fields like an EIN"). `pattern` appears only where the authority's format is strict (the
// EIN's two-digits-hyphen-seven-digits; ISO dates as the committed module wire contract);
// `example` only where the authority publishes one (the SS-4 instructions' 12-3456789) — never
// a real-looking invented value. The pattern/example coherence is vitest-gated.
export const CompanyFieldSpecSchema = z
  .object({
    // The format as a human sentence — what shape the value takes.
    format: z.string().min(1),
    // Regex for the strict formats only; must compile and must match `example` when both exist.
    pattern: z.string().min(1).optional(),
    // The authority's own documented format example, verbatim from the cited source.
    example: z.string().min(1).optional(),
    // Who assigns or defines the value (EIN → IRS; file number → DE Division of Corporations).
    authority: z.string().min(1),
    // The documents and filings that carry the value.
    whereItAppears: z.string().min(1).array().min(1),
    sources: CompanyFieldSpecSourceSchema.array().min(1),
  })
  .strict()
export type CompanyFieldSpec = z.infer<typeof CompanyFieldSpecSchema>

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
    // Absent exactly for the identifier fields consumed through the artifact requires edges
    // (derivation path (b) above) — the vitest gate holds the either-or honest.
    consumedBy: CompanyFieldConsumerSchema.array().min(1).optional(),
    spec: CompanyFieldSpecSchema,
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
      for (const c of field.consumedBy ?? []) {
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
    for (const c of field.consumedBy ?? []) {
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

// ---------------------------------------------------------------------------------------------
// /fields page family (founder 2026-10-08: "a page that explains the specification of data
// fields like an EIN — map those out in the repo, and draw the content from the repo into the
// site"): one page per registry field, everything read back from the committed registry —
// the spec block verbatim, the establishing artifact linked, and the consumption side shown on
// whichever committed path justifies the field: the open-module functions (consumedBy), or the
// corpus processes whose `requires` carries the establishing artifact (the identifier path,
// COMPUTED from processes/corpus.json, never hand-listed).

export interface FieldProcessLink {
  id: string
  title: string
  href: string
  area: Area
}

export interface FieldPageData {
  field: CompanyField
  // The establishing artifact (registry producedBy), linked to its /artifacts page.
  artifact: { id: string; label: string; href: string }
  // Distinct consuming modules with their functions — same resolution as fieldsEstablishedBy.
  consumers: ArtifactFieldRow['consumers']
  // Every corpus process whose `requires` carries the establishing artifact, corpus order —
  // the requires-and-carries consumption path the identifier fields are derived from.
  requiringProcesses: FieldProcessLink[]
}

const processLink = (t: ProcessTask): FieldProcessLink => ({
  id: t.id,
  title: t.title,
  href: `/processes/${processSlug(t.title)}`,
  area: areaOfTask(t),
})

let fieldPagesCache: FieldPageData[] | null = null
export function loadFieldPages(): FieldPageData[] {
  if (!fieldPagesCache) {
    const artifactsById = new Map(loadArtifacts().map((a) => [a.id, a]))
    const processes = loadProcesses()
    fieldPagesCache = loadCompanyFields().map((field) => {
      const artifact = artifactsById.get(field.producedBy)
      if (!artifact) throw new Error(`company field ${field.id}: unknown artifact ${field.producedBy}`)
      const row = fieldsEstablishedBy(field.producedBy).find((r) => r.field.id === field.id)
      return {
        field,
        artifact: { id: artifact.id, label: artifact.label, href: `/artifacts/${artifact.id}` },
        consumers: row?.consumers ?? [],
        requiringProcesses: processes
          .filter((t) => t.requires.includes(field.producedBy))
          .map(processLink),
      }
    })
  }
  return fieldPagesCache
}

export function findFieldPage(id: string): FieldPageData | undefined {
  return loadFieldPages().find((p) => p.field.id === id)
}

// The /fields index grouping: one group per field type, in a reading order that puts the
// founder-named identifiers first. Labels are functional (what the group holds), computed
// membership only — a field is grouped by its committed `type`, never hand-sorted.
export const FIELD_GROUPS: ReadonlyArray<{ label: string; type: CompanyFieldType }> = [
  { label: 'Identifiers', type: 'string' },
  { label: 'Dates', type: 'date' },
  { label: 'Money', type: 'money' },
  { label: 'Counts and rates', type: 'number' },
  { label: 'Flags', type: 'enum' },
]

export function companyFieldGroups(): Array<{ label: string; fields: CompanyField[] }> {
  const fields = loadCompanyFields()
  return FIELD_GROUPS.map((g) => ({
    label: g.label,
    fields: fields.filter((f) => f.type === g.type),
  })).filter((g) => g.fields.length > 0)
}
