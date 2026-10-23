import fs from 'node:fs'
import path from 'node:path'

// Loader + validator for the distilled startup laws (open-law/LAWS.md). Follows the
// lib/founderOps.ts pattern: structural and referential invariants only, returned as a
// flat error list so the vitest gate (__tests__/laws.test.ts) can assert an empty array.
// The pure validators take data, not paths, so tests can exercise failure modes without
// touching the committed corpus.
//
// Citation resolution: each law's `Sources:` line cites ids that resolve across the two
// domain registries — the legal authorities in open-law/citations/registry.json
// (validated by lib/founderOps.ts against schemas/citation.schema.json) and the reading
// canon in open-lore/ (library.json entries, validated by __tests__/lore-library.test.ts,
// plus the citation-only works in open-lore/citations.json, validated by lib/lore.ts).
//
// Deliberately deterministic: URL liveness is an editorial duty recorded via checked_on
// (see open-law/README.md and open-lore/README.md); nothing here performs network I/O.

export interface AuthorityCitation {
  id: string
  publisher: string
  title: string
  kind: string
  url: string
  locator: string
  issued_on: string | null
  checked_on: string
  jurisdiction: string
  note: string
  /** Language of the primary source (two-letter code, e.g. 'ko'); absent means English. */
  lang?: string
  /**
   * Official-translation pointer rendered beside a non-English primary locator (e.g. the
   * KLRI English translation of a Korean statute). The primary url/locator stay
   * authoritative; only `url` is required, and a missing `lang` means English.
   */
  translation?: {
    url: string
    lang?: string
    publisher?: string
    publisher_short?: string
    title?: string
    checked_on?: string
  }
}

export interface AuthorityCitationRegistry {
  updated_on: string
  citations: AuthorityCitation[]
}

export interface StartupLaw {
  /** Global 1-based number, continuous across stages. */
  number: number
  /** The `## ` stage heading the law appears under. */
  stage: string
  title: string
  /** Citation ids cited on the law's `Sources:` line. */
  sourceIds: string[]
}

export const LAWS_MIN = 25
export const LAWS_MAX = 40

/**
 * Parse open-law/LAWS.md. Grammar (kept deliberately rigid so drift is caught):
 *   `## <stage>` opens a lifecycle stage;
 *   `### <n>. <title>` opens law n (global, continuous numbering);
 *   a law body must contain exactly one `Sources:` line citing backticked citation ids.
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

export function validateStartupLaws(markdown: string, knownIds: ReadonlySet<string>): string[] {
  const { laws, errors } = parseStartupLaws(markdown)
  if (laws.length < LAWS_MIN || laws.length > LAWS_MAX) {
    errors.push(`laws: expected ${LAWS_MIN}-${LAWS_MAX}, found ${laws.length}`)
  }
  laws.forEach((law, i) => {
    if (law.number !== i + 1) errors.push(`law ${law.number} (${law.title}): expected number ${i + 1}`)
    for (const id of law.sourceIds) {
      if (!knownIds.has(id)) errors.push(`law ${law.number} (${law.title}): unknown source id ${id}`)
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

export function loadAuthorityCitations(): AuthorityCitationRegistry {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, 'open-law/citations/registry.json'), 'utf8'),
  ) as AuthorityCitationRegistry
}

export function loadStartupLawsMarkdown(): string {
  return fs.readFileSync(path.join(ROOT, 'open-law/LAWS.md'), 'utf8')
}

/**
 * The ids a LAWS.md Sources line may cite: the open-law authority registry, the
 * open-lore library, and the open-lore citation-only works. Duplicates across those
 * registries would make a citation ambiguous, so they are reported as errors.
 */
export function loadKnownCitationIds(): { ids: Set<string>; errors: string[] } {
  const errors: string[] = []
  const ids = new Set<string>()
  const addAll = (list: Array<{ id: string }>, label: string) => {
    for (const record of list) {
      if (ids.has(record.id)) errors.push(`${label}: citation id ${record.id} collides with another registry`)
      ids.add(record.id)
    }
  }
  addAll(loadAuthorityCitations().citations, 'open-law/citations/registry.json')
  const library = JSON.parse(fs.readFileSync(path.join(ROOT, 'open-lore/library.json'), 'utf8')) as {
    entries: Array<{ id: string }>
  }
  addAll(library.entries, 'open-lore/library.json')
  const loreCitations = JSON.parse(fs.readFileSync(path.join(ROOT, 'open-lore/citations.json'), 'utf8')) as {
    citations: Array<{ id: string }>
  }
  addAll(loreCitations.citations, 'open-lore/citations.json')
  return { ids, errors }
}

/** The full gate: LAWS.md grammar + citation resolution across both domains. Empty array = pass. */
export function validateLaws(): string[] {
  const { ids, errors } = loadKnownCitationIds()
  return [...errors, ...validateStartupLaws(loadStartupLawsMarkdown(), ids)]
}
