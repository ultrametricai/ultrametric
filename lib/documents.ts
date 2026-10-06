import fs from 'node:fs'
import path from 'node:path'

// Loader + validator for the open-documents map (open-documents/registry.json + open-documents/README.md).
// Same doctrine as lib/resources.ts: structural/referential invariants as a flat error list for
// the vitest gate (__tests__/documents.test.ts); pure validators take data so failure modes are
// testable; no network I/O — URL liveness is an editorial duty recorded via checked_on.
// Policy enforced socially, stated here for the record: link, never redistribute the documents.

export const DOCUMENT_USE_CASES = [
  'formation',
  'fundraising',
  'hiring',
  'commercial',
  'governance',
  'privacy',
  'open-source',
] as const
export type DocumentUseCase = (typeof DOCUMENT_USE_CASES)[number]

export const DOCUMENT_FORMATS = ['web-page', 'pdf', 'docx', 'xlsx', 'doc-generator', 'mixed'] as const
export type DocumentFormat = (typeof DOCUMENT_FORMATS)[number]

export interface OpenDocument {
  id: string
  name: string
  publisher: string
  url: string
  /** The published license/terms, honestly stated, including what still requires counsel. */
  license_note: string
  use_case: DocumentUseCase
  /** Descriptive, not a jurisdictions/-registry code: many standards are deliberately neutral. */
  jurisdiction: string
  format: DocumentFormat
  /** Document family id (founder 2026-10-06): groups the variants of one document object — the
   * YC SAFE's cap/discount/MFN/international forms plus its user guide and pro rata side letter
   * ('yc-safe'), the NVCA model financing suite ('nvca'). Always paired with `variant`; a family
   * needs at least two members (validated below). Family rows group on /open-documents and
   * mapped variants collapse into one object on /artifacts pages. */
  family?: string
  /** The short committed variant label a family member renders under ('cap', 'MFN', 'voting
   * agreement') — committed here so no page invents prose. Unique within its family. */
  variant?: string
  checked_on: string
}

export interface DocumentRegistry {
  updated_on: string
  /** The registry's stated review window: every checked_on must fall within this many days before updated_on. */
  review_window_days: number
  documents: OpenDocument[]
}

const ID_RE = /^[a-z0-9][a-z0-9.-]*$/
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isIsoDate(value: string): boolean {
  return ISO_DATE_RE.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
}

export function validateDocumentRegistry(doc: DocumentRegistry, asOf: Date): string[] {
  const errors: string[] = []
  if (!isIsoDate(doc.updated_on)) errors.push(`registry.updated_on: invalid ISO date ${JSON.stringify(doc.updated_on)}`)
  if (!Number.isInteger(doc.review_window_days) || doc.review_window_days <= 0) {
    errors.push(`registry.review_window_days: must be a positive integer, got ${JSON.stringify(doc.review_window_days)}`)
  }
  if (!Array.isArray(doc.documents) || doc.documents.length === 0) {
    errors.push('registry: no documents')
    return errors
  }
  const ids = new Set<string>()
  for (const d of doc.documents) {
    const where = `document ${d.id ?? '<missing id>'}`
    if (typeof d.id !== 'string' || !ID_RE.test(d.id)) errors.push(`${where}: invalid id`)
    else if (ids.has(d.id)) errors.push(`duplicate document id ${d.id}`)
    else ids.add(d.id)
    for (const key of ['name', 'publisher', 'license_note', 'jurisdiction'] as const) {
      if (typeof d[key] !== 'string' || d[key].trim().length === 0) errors.push(`${where}: missing ${key}`)
    }
    // NB: URLs may legitimately repeat — YC's SAFE variants all live on the one stable
    // /documents page because the per-file asset links are content-hashed and rotate.
    if (typeof d.url !== 'string' || !d.url.startsWith('https://')) errors.push(`${where}: require HTTPS URL`)
    if (!DOCUMENT_USE_CASES.includes(d.use_case)) errors.push(`${where}: unknown use_case ${JSON.stringify(d.use_case)}`)
    if (!DOCUMENT_FORMATS.includes(d.format)) errors.push(`${where}: unknown format ${JSON.stringify(d.format)}`)
    // family ⇔ variant: a family member must carry its committed short label (pages render the
    // label, never invent one), and a variant label is meaningless outside a family.
    if (d.family !== undefined || d.variant !== undefined) {
      if (typeof d.family !== 'string' || !ID_RE.test(d.family)) errors.push(`${where}: family must be a registry-style slug`)
      if (typeof d.variant !== 'string' || d.variant.trim().length === 0) errors.push(`${where}: family member needs a committed variant label`)
    }
    if (typeof d.checked_on !== 'string' || !isIsoDate(d.checked_on)) errors.push(`${where}: invalid checked_on`)
    else {
      if (new Date(`${d.checked_on}T00:00:00Z`) > asOf) errors.push(`${where}: checked_on is in the future`)
      // Currency invariant: a record's liveness check may not be older than the registry's
      // stated review window — a stale checked_on means the URL is due for re-verification.
      if (isIsoDate(doc.updated_on) && Number.isInteger(doc.review_window_days) && doc.review_window_days > 0) {
        const ageDays =
          (new Date(`${doc.updated_on}T00:00:00Z`).getTime() - new Date(`${d.checked_on}T00:00:00Z`).getTime()) /
          86_400_000
        if (ageDays > doc.review_window_days) {
          errors.push(`${where}: checked_on ${d.checked_on} is outside the ${doc.review_window_days}-day review window`)
        }
      }
    }
  }
  // Family invariants across the registry: a one-member family is a typo'd group, and duplicate
  // variant labels inside a family would render two identical chips for different documents.
  const families = new Map<string, Array<{ id: string; variant?: string }>>()
  for (const d of doc.documents) {
    if (typeof d.family === 'string') families.set(d.family, [...(families.get(d.family) ?? []), d])
  }
  for (const [family, members] of families) {
    if (members.length < 2) errors.push(`family ${family}: needs at least two members, got ${members.length}`)
    const labels = members.map((m) => m.variant).filter((v): v is string => typeof v === 'string')
    if (new Set(labels).size !== labels.length) errors.push(`family ${family}: duplicate variant labels`)
  }
  return errors
}

/** The README's grouped tables must stay in sync: every registry id appears in the README,
 * every backticked slug in a README table row resolves to a registry id, and every table row
 * links OUT to its record's canonical URL (founder 2026-10-02: the public documents layer must
 * link to the actual documents on the web — names without links are drift). */
export function validateDocumentReadme(readme: string, registry: DocumentRegistry): string[] {
  const errors: string[] = []
  const byId = new Map(registry.documents.map((d) => [d.id, d]))
  for (const id of byId.keys()) {
    // Every record gets a TABLE row (not just a prose mention) — the row is what carries the
    // clickable canonical link checked below.
    if (!readme.includes(`| \`${id}\` |`)) errors.push(`README: missing table row for registry id ${id}`)
  }
  for (const line of readme.split('\n')) {
    const m = /^\| `([^`]+)` \|/.exec(line.trim())
    if (!m) continue
    const doc = byId.get(m[1])
    if (!doc) {
      errors.push(`README: table row cites unknown id ${m[1]}`)
      continue
    }
    // The row's Document cell must be a markdown link to the committed, checked_on-dated
    // canonical URL — the registry record, not a re-typed (driftable) copy of it.
    if (!line.includes(`](${doc.url})`)) {
      errors.push(`README: row ${doc.id} must link its canonical URL ${doc.url}`)
    }
  }
  return errors
}

const ROOT = process.cwd()

export function loadDocumentRegistry(): DocumentRegistry {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'open-documents/registry.json'), 'utf8')) as DocumentRegistry
}

// Cached id → record lookup for the render path (ProcessDag's per-step document chips read it
// once per build, not once per chip). Same memo idiom as lib/stepPrompts.ts.
let byIdCache: Map<string, OpenDocument> | null = null

/** The registry record for a step-level document id (DagNode.documents) — throws on an unknown
 * id so a typo'd corpus reference fails the BUILD loudly, the same bar the corpus test
 * (lib/__tests__/processDocuments.test.ts) enforces. */
export function openDocumentById(id: string): OpenDocument {
  if (byIdCache === null) {
    byIdCache = new Map(loadDocumentRegistry().documents.map((d) => [d.id, d]))
  }
  const doc = byIdCache.get(id)
  if (!doc) throw new Error(`Unknown document id ${id} — not in open-documents/registry.json`)
  return doc
}

/** The full gate: registry invariants + README/registry sync. Empty array = pass. */
export function validateDocuments(asOf?: Date): string[] {
  const registry = loadDocumentRegistry()
  const readme = fs.readFileSync(path.join(ROOT, 'open-documents/README.md'), 'utf8')
  return [...validateDocumentRegistry(registry, asOf ?? new Date()), ...validateDocumentReadme(readme, registry)]
}
