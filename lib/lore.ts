import fs from 'node:fs'
import path from 'node:path'

import { loadProcesses } from '@/lib/processes'
import { loadStartupLawsMarkdown, parseStartupLaws, type StartupLaw } from '@/lib/citations'

// Loader + validator for startup lore (open-lore/LORE.md) — the famous episodes and war
// stories of startup history, curated as sourced records. Follows the LAWS.md precedent
// exactly: a deliberately rigid markdown grammar parsed here, structural and referential
// invariants returned as a flat error list, and a vitest gate (__tests__/lore.test.ts)
// asserting the list is empty. The pure validators take data, not paths, so tests can
// exercise failure modes without touching the committed corpus.
//
// The honesty field that distinguishes this corpus is `veracity`: every episode is graded
// by how well it is evidenced, and famous-but-unverifiable stories are recorded AS legend,
// never asserted as fact. Deterministic — URL liveness is editorial (see citations/README.md);
// nothing here performs network I/O.

export const VERACITY_GRADES = [
  /** A participant told it on the record (founder essay, memoir, recorded interview). */
  'first-person',
  /** Contemporaneous records (press releases, blog posts, filings, archived threads). */
  'documented',
  /** Secondhand journalism — reputable, but no participant or contemporaneous record. */
  'reported',
  /** Famous but unverifiable or known-embellished; recorded as legend, never as fact. */
  'legend',
] as const

export type VeracityGrade = (typeof VERACITY_GRADES)[number]

export interface LoreSource {
  title: string
  url: string
  /** What the source supports — the editorial record of the verification. */
  note: string
}

export interface LoreEntry {
  /** Global 1-based number, continuous across themes (LAWS.md numbering convention). */
  number: number
  /** The `## ` theme heading the entry appears under. */
  theme: string
  /** Stable slug cited by other corpus records. */
  id: string
  title: string
  /** The tight, factual retelling (3-6 sentences, one paragraph). */
  episode: string
  /** Approximate, honest era — "2008", "1999-2001", "c. 1972-1975". */
  era: string
  companies: string[]
  people: string[]
  /** What founders take from it — one sentence. */
  lesson: string
  veracity: VeracityGrade
  sources: LoreSource[]
  /** Law numbers from open-law/LAWS.md this episode illustrates. */
  relatedLaws: number[]
  /** Process ids from open-processes/corpus.json this episode illustrates (verified on main). */
  relatedProcesses: string[]
  /**
   * Process ids expected from parallel corpus work (e.g. the sit_* situations) that do NOT
   * yet resolve. Validation fails if a candidate starts resolving — promote it to
   * Related processes at that point.
   */
  candidateProcesses: string[]
}

export const LORE_MIN = 25
export const LORE_MAX = 40

const LORE_ID_RE = /^[a-z0-9][a-z0-9-]*$/
const PROCESS_ID_RE = /^[a-z0-9][a-z0-9_-]*$/

const LABELS = [
  'Id',
  'Era',
  'Companies',
  'People',
  'Lesson',
  'Veracity',
  'Related laws',
  'Related processes',
  'Candidate processes',
] as const

type Label = (typeof LABELS)[number]

const backticked = (text: string): string[] => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1])
const commaList = (text: string): string[] =>
  text
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

/**
 * Parse open-lore/LORE.md. Grammar (kept deliberately rigid so drift is caught):
 *   `## <theme>` opens a theme;
 *   `### <n>. <title>` opens entry n (global, continuous numbering);
 *   labeled lines (`Id:` backticked slug, `Era:`, `Companies:`/`People:` comma lists,
 *   `Lesson:`, `Veracity:`, optional `Related laws:`/`Related processes:`/`Candidate
 *   processes:` backticked ids) each appear at most once per entry;
 *   `Sources:` opens a bullet block of `- [Title](https://url) — note` lines;
 *   plain paragraph lines are the episode.
 */
export function parseStartupLore(markdown: string): { entries: LoreEntry[]; errors: string[] } {
  const entries: LoreEntry[] = []
  const errors: string[] = []
  let theme: string | null = null
  let current: LoreEntry | null = null
  let seen: Set<Label> | null = null
  let inSources = false
  let sawSourcesBlock = false
  const episodeLines: string[] = []

  const finish = () => {
    if (current) {
      const at = `lore ${current.number} (${current.title})`
      current.episode = episodeLines.join(' ').replace(/\s+/g, ' ').trim()
      if (!seen?.has('Id')) errors.push(`${at}: missing Id line`)
      for (const label of ['Era', 'Companies', 'People', 'Lesson', 'Veracity'] as const) {
        if (!seen?.has(label)) errors.push(`${at}: missing ${label} line`)
      }
      if (!sawSourcesBlock) errors.push(`${at}: missing Sources block`)
    }
    current = null
    seen = null
    inSources = false
    sawSourcesBlock = false
    episodeLines.length = 0
  }

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trimEnd()
    const stageMatch = /^## (?!#)(.+)$/.exec(line)
    if (stageMatch) {
      finish()
      theme = stageMatch[1].trim()
      continue
    }
    const entryMatch = /^### (\d+)\. (.+)$/.exec(line)
    if (entryMatch) {
      finish()
      if (!theme) errors.push(`lore "${entryMatch[2]}": appears before any theme heading`)
      current = {
        number: Number(entryMatch[1]),
        theme: theme ?? '',
        id: '',
        title: entryMatch[2].trim(),
        episode: '',
        era: '',
        companies: [],
        people: [],
        lesson: '',
        veracity: 'legend',
        sources: [],
        relatedLaws: [],
        relatedProcesses: [],
        candidateProcesses: [],
      }
      seen = new Set()
      entries.push(current)
      continue
    }
    if (!current || !seen) {
      if (/^(Sources:|- \[)/.test(line.trim()) || LABELS.some((l) => line.startsWith(`${l}:`))) {
        errors.push(`lore line outside any entry: ${JSON.stringify(line.trim())}`)
      }
      continue
    }
    const at = `lore ${current.number} (${current.title})`

    if (/^Sources:\s*$/.test(line)) {
      if (sawSourcesBlock) errors.push(`${at}: multiple Sources blocks`)
      inSources = true
      sawSourcesBlock = true
      continue
    }
    const bulletMatch = /^- \[([^\]]+)\]\(([^)\s]+)\)\s+—\s+(.+)$/.exec(line)
    if (bulletMatch) {
      if (!inSources) {
        errors.push(`${at}: source bullet outside a Sources block`)
        continue
      }
      current.sources.push({ title: bulletMatch[1].trim(), url: bulletMatch[2], note: bulletMatch[3].trim() })
      continue
    }
    if (line.startsWith('- ')) {
      errors.push(`${at}: malformed bullet (expected "- [Title](https://url) — note"): ${JSON.stringify(line)}`)
      continue
    }
    inSources = false

    const labelMatch = /^([A-Z][A-Za-z ]*?):\s*(.*)$/.exec(line)
    if (labelMatch && (LABELS as readonly string[]).includes(labelMatch[1])) {
      const label = labelMatch[1] as Label
      const value = labelMatch[2].trim()
      if (seen.has(label)) errors.push(`${at}: multiple ${label} lines`)
      seen.add(label)
      switch (label) {
        case 'Id': {
          const ids = backticked(value)
          if (ids.length !== 1) errors.push(`${at}: Id line must carry exactly one backticked slug`)
          current.id = ids[0] ?? ''
          break
        }
        case 'Era':
          current.era = value
          break
        case 'Companies':
          current.companies = commaList(value)
          break
        case 'People':
          current.people = commaList(value)
          break
        case 'Lesson':
          current.lesson = value
          break
        case 'Veracity':
          current.veracity = value as VeracityGrade
          break
        case 'Related laws':
          current.relatedLaws = backticked(value).map(Number)
          break
        case 'Related processes':
          current.relatedProcesses = backticked(value)
          break
        case 'Candidate processes':
          current.candidateProcesses = backticked(value)
          break
      }
      continue
    }
    if (line.trim().length > 0) episodeLines.push(line.trim())
  }
  finish()
  return { entries, errors }
}

export function validateStartupLore(
  markdown: string,
  laws: StartupLaw[],
  processIds: ReadonlySet<string>,
): string[] {
  const { entries, errors } = parseStartupLore(markdown)
  if (entries.length < LORE_MIN || entries.length > LORE_MAX) {
    errors.push(`lore: expected ${LORE_MIN}-${LORE_MAX} entries, found ${entries.length}`)
  }
  const lawNumbers = new Set(laws.map((l) => l.number))
  const ids = new Set<string>()
  const titles = new Set<string>()
  entries.forEach((entry, i) => {
    const at = `lore ${entry.number} (${entry.title})`
    if (entry.number !== i + 1) errors.push(`${at}: expected number ${i + 1}`)
    if (!LORE_ID_RE.test(entry.id)) errors.push(`${at}: invalid id ${JSON.stringify(entry.id)}`)
    else if (ids.has(entry.id)) errors.push(`duplicate lore id ${entry.id}`)
    else ids.add(entry.id)
    if (titles.has(entry.title)) errors.push(`duplicate lore title "${entry.title}"`)
    titles.add(entry.title)
    if (entry.era.length === 0) errors.push(`${at}: empty era`)
    if (entry.companies.length === 0) errors.push(`${at}: no companies`)
    if (entry.people.length === 0) errors.push(`${at}: no people`)
    if (entry.lesson.length === 0) errors.push(`${at}: empty lesson`)
    if (entry.episode.length < 200) {
      errors.push(`${at}: episode too thin (${entry.episode.length} chars; the retelling is 3-6 full sentences)`)
    }
    if (!VERACITY_GRADES.includes(entry.veracity)) {
      errors.push(`${at}: unknown veracity ${JSON.stringify(entry.veracity)}`)
    }
    if (entry.sources.length === 0) errors.push(`${at}: needs at least one source`)
    const urls = new Set<string>()
    for (const s of entry.sources) {
      if (!s.url.startsWith('https://')) errors.push(`${at}: source "${s.title}" requires an HTTPS URL`)
      if (urls.has(s.url)) errors.push(`${at}: duplicate source URL ${s.url}`)
      urls.add(s.url)
      if (s.note.length === 0) errors.push(`${at}: source "${s.title}" missing a what-it-supports note`)
    }
    for (const n of entry.relatedLaws) {
      if (!lawNumbers.has(n)) errors.push(`${at}: unknown law number ${n}`)
    }
    if (new Set(entry.relatedLaws).size !== entry.relatedLaws.length) errors.push(`${at}: duplicate related law`)
    for (const id of entry.relatedProcesses) {
      if (!processIds.has(id)) errors.push(`${at}: unknown process id ${id}`)
    }
    if (new Set(entry.relatedProcesses).size !== entry.relatedProcesses.length) {
      errors.push(`${at}: duplicate related process`)
    }
    for (const id of entry.candidateProcesses) {
      if (!PROCESS_ID_RE.test(id)) errors.push(`${at}: malformed candidate process id ${JSON.stringify(id)}`)
      if (processIds.has(id)) {
        errors.push(`${at}: candidate process ${id} now resolves — promote it to Related processes`)
      }
    }
  })
  return errors
}

// ---------------------------------------------------------------------------
// Filesystem entry points (the committed corpus)
// ---------------------------------------------------------------------------

const ROOT = process.cwd()

export function loadStartupLoreMarkdown(): string {
  return fs.readFileSync(path.join(ROOT, 'open-lore/LORE.md'), 'utf8')
}

export function loadStartupLore(): LoreEntry[] {
  return parseStartupLore(loadStartupLoreMarkdown()).entries
}

/**
 * The full gate: LORE.md grammar + invariants, law numbers resolved against open-law/LAWS.md,
 * process ids resolved (read-only) against the corpus loader. Empty array = pass.
 */
export function validateLore(): string[] {
  const laws = parseStartupLaws(loadStartupLawsMarkdown()).laws
  const processIds = new Set(loadProcesses().map((t) => t.id))
  return validateStartupLore(loadStartupLoreMarkdown(), laws, processIds)
}
