import fs from 'node:fs'
import path from 'node:path'

// Loader + validator for the citation registry (citations/registry.json, one registry of
// every cited source in two roles) and the distilled open-law/LAWS.md. Follows the
// lib/founderOps.ts pattern: structural and referential invariants only, returned as a
// flat error list so the vitest gate (__tests__/citations.test.ts) can assert an empty
// array. The pure validators take data, not paths, so tests can exercise failure modes
// without touching the committed corpus.
//
// Role split: 'authority' entries (legal authorities and dated practice sources) are
// validated by lib/founderOps.ts against schemas/citation.schema.json alongside the rule
// cards that cite them; this module validates the 'reading' entries (the canonical
// startup reading) and the LAWS.md citation resolution, which may cite either role.
//
// Deliberately deterministic: URL liveness is an editorial duty recorded via checked_on
// (see citations/README.md); nothing here performs network I/O.

export const READING_KINDS = [
  'essay',
  'guide',
  'handbook',
  'library',
  'primary-source',
  'document-repository',
] as const

export type ReadingKind = (typeof READING_KINDS)[number]

export interface ReadingCitation {
  id: string
  role: 'reading'
  title: string
  author: string
  url: string
  kind: ReadingKind
  topics: string[]
  note: string
  published_on: string | null
  checked_on: string
}

export interface AuthorityCitation {
  id: string
  role: 'authority'
  publisher: string
  title: string
  kind: string
  url: string
  locator: string
  issued_on: string | null
  checked_on: string
  jurisdiction: string
  note: string
}

export type Citation = ReadingCitation | AuthorityCitation

export interface CitationRegistry {
  updated_on: string
  citations: Citation[]
}

export interface StartupLaw {
  /** Global 1-based number, continuous across stages. */
  number: number
  /** The `## ` stage heading the law appears under. */
  stage: string
  title: string
  /** Registry ids cited on the law's `Sources:` line. */
  sourceIds: string[]
}

export const LAWS_MIN = 25
export const LAWS_MAX = 40

const ID_RE = /^[a-z0-9][a-z0-9.-]*$/
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isIsoDate(value: string): boolean {
  return ISO_DATE_RE.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export function validateCitationRegistry(doc: CitationRegistry, asOf: Date): string[] {
  const errors: string[] = []
  if (!isIsoDate(doc.updated_on)) errors.push(`registry.updated_on: invalid ISO date ${JSON.stringify(doc.updated_on)}`)
  if (!Array.isArray(doc.citations) || doc.citations.length === 0) {
    errors.push('registry: no citations')
    return errors
  }
  const ids = new Set<string>()
  const readingUrls = new Set<string>()
  for (const c of doc.citations) {
    const where = `citation ${c.id ?? '<missing id>'}`
    if (typeof c.id !== 'string' || !ID_RE.test(c.id)) errors.push(`${where}: invalid id`)
    else if (ids.has(c.id)) errors.push(`duplicate citation id ${c.id}`)
    else ids.add(c.id)
    if (c.role !== 'reading' && c.role !== 'authority') {
      errors.push(`${where}: unknown role ${JSON.stringify((c as { role?: unknown }).role)}`)
      continue
    }
    // Authority entries are schema- and doctrine-checked by lib/founderOps.ts; only the
    // registry-wide id invariants apply here.
    if (c.role !== 'reading') continue
    const r = c
    for (const key of ['title', 'author', 'note'] as const) {
      if (typeof r[key] !== 'string' || r[key].trim().length === 0) errors.push(`${where}: missing ${key}`)
    }
    if (typeof r.url !== 'string' || !r.url.startsWith('https://')) errors.push(`${where}: require HTTPS URL`)
    else if (readingUrls.has(r.url)) errors.push(`${where}: duplicate URL ${r.url}`)
    else readingUrls.add(r.url)
    if (!READING_KINDS.includes(r.kind)) errors.push(`${where}: unknown kind ${JSON.stringify(r.kind)}`)
    if (!Array.isArray(r.topics) || r.topics.length === 0) errors.push(`${where}: topics must be non-empty`)
    else if (r.topics.some((t) => typeof t !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(t))) {
      errors.push(`${where}: topics must be lowercase slugs`)
    }
    if (r.published_on !== null && (typeof r.published_on !== 'string' || !isIsoDate(r.published_on))) {
      errors.push(`${where}: published_on must be null or an ISO date`)
    }
    if (typeof r.checked_on !== 'string' || !isIsoDate(r.checked_on)) errors.push(`${where}: invalid checked_on`)
    else if (new Date(`${r.checked_on}T00:00:00Z`) > asOf) errors.push(`${where}: checked_on is in the future`)
  }
  return errors
}

/** The reading-role entries (the canonical startup reading list). */
export function readingCitations(doc: CitationRegistry): ReadingCitation[] {
  return doc.citations.filter((c): c is ReadingCitation => c.role === 'reading')
}

// ---------------------------------------------------------------------------
// LAWS.md
// ---------------------------------------------------------------------------

/**
 * Parse open-law/LAWS.md. Grammar (kept deliberately rigid so drift is caught):
 *   `## <stage>` opens a lifecycle stage;
 *   `### <n>. <title>` opens law n (global, continuous numbering);
 *   a law body must contain exactly one `Sources:` line citing backticked registry ids.
 */
export function parseStartupLaws(markdown: string): { laws: StartupLaw[]; errors: string[] } {
  const laws: StartupLaw[] = []
  const errors: string[] = []
  let stage: string | null = null
  let current: StartupLaw | null = null
  let currentHasSources = false

  const finish = () => {
    if (current && !currentHasSources) errors.push(`law ${current.number} (${current.title}): missing Sources line`)
    current = null
    currentHasSources = false
  }

  for (const line of markdown.split('\n')) {
    const stageMatch = /^## (?!#)(.+)$/.exec(line)
    if (stageMatch) {
      finish()
      stage = stageMatch[1].trim()
      continue
    }
    const lawMatch = /^### (\d+)\. (.+)$/.exec(line)
    if (lawMatch) {
      finish()
      if (!stage) errors.push(`law "${lawMatch[2]}": appears before any stage heading`)
      current = { number: Number(lawMatch[1]), stage: stage ?? '', title: lawMatch[2].trim(), sourceIds: [] }
      laws.push(current)
      continue
    }
    const sourcesMatch = /^Sources:\s*(.+)$/.exec(line.trim())
    if (sourcesMatch) {
      if (!current) {
        errors.push('Sources line outside any law')
        continue
      }
      if (currentHasSources) errors.push(`law ${current.number}: multiple Sources lines`)
      currentHasSources = true
      const cited = [...sourcesMatch[1].matchAll(/`([^`]+)`/g)].map((m) => m[1])
      if (cited.length === 0) errors.push(`law ${current.number}: Sources line cites nothing`)
      current.sourceIds = cited
    }
  }
  finish()
  return { laws, errors }
}

export function validateStartupLaws(markdown: string, registry: CitationRegistry): string[] {
  const { laws, errors } = parseStartupLaws(markdown)
  const known = new Set(registry.citations.map((c) => c.id))
  if (laws.length < LAWS_MIN || laws.length > LAWS_MAX) {
    errors.push(`laws: expected ${LAWS_MIN}-${LAWS_MAX}, found ${laws.length}`)
  }
  laws.forEach((law, i) => {
    if (law.number !== i + 1) errors.push(`law ${law.number} (${law.title}): expected number ${i + 1}`)
    for (const id of law.sourceIds) {
      if (!known.has(id)) errors.push(`law ${law.number} (${law.title}): unknown source id ${id}`)
    }
    const dupes = law.sourceIds.filter((id, j) => law.sourceIds.indexOf(id) !== j)
    if (dupes.length > 0) errors.push(`law ${law.number}: duplicate citation ${dupes[0]}`)
  })
  const titles = new Set<string>()
  for (const law of laws) {
    if (titles.has(law.title)) errors.push(`duplicate law title "${law.title}"`)
    titles.add(law.title)
  }
  return errors
}

// ---------------------------------------------------------------------------
// Filesystem entry points (the committed corpus)
// ---------------------------------------------------------------------------

const ROOT = process.cwd()

export function loadCitationRegistry(): CitationRegistry {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'citations/registry.json'), 'utf8')) as CitationRegistry
}

export function loadStartupLawsMarkdown(): string {
  return fs.readFileSync(path.join(ROOT, 'open-law/LAWS.md'), 'utf8')
}

/** The full gate: registry invariants + LAWS.md citation resolution. Empty array = pass. */
export function validateCitations(asOf?: Date): string[] {
  const registry = loadCitationRegistry()
  const markdown = loadStartupLawsMarkdown()
  return [...validateCitationRegistry(registry, asOf ?? new Date()), ...validateStartupLaws(markdown, registry)]
}
