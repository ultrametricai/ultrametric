import fs from 'node:fs'
import path from 'node:path'
import {
  loadBusinessLogicMap, loadBusinessLogicSteps, MODULE_GROUPS,
  type BusinessLogicModule, type BusinessLogicStep,
} from '@/lib/businessLogicMap'
import { loadProcesses, processSlug } from '@/lib/processes'
import { SITE_URL } from '@/lib/site'

// open-modules/README.md "Serves" lines ↔ map sync (founder 2026-10-02: each module's
// section names the processes/steps it serves, generated-or-synced so it can't go stale — the
// SITUATIONS.md drift-gate pattern, lib/situationsDoc.ts). The truth lives in
// open-processes/business-logic-map.json (modules + the per-step function entries); every module's
// section carries exactly one machine-owned line (SERVES_PREFIX), written by
// scripts/generate-business-logic-serves.ts and byte-compared here
// (lib/__tests__/businessLogicServes.test.ts). Pure validators take data so failure modes are
// testable; no network I/O.

export const BUSINESS_LOGIC_README = 'open-modules/README.md'
export const SERVES_PREFIX = '**Serves:**'

/** Everything the renderer needs, loaded once (the map plus corpus titles/slugs). */
export interface ServesSource {
  modules: Record<string, BusinessLogicModule>
  steps: BusinessLogicStep[]
  /** processId → title (slug derives from the title, lib/processes.ts processSlug). */
  titles: Map<string, string>
}

export function servesSource(): ServesSource {
  return {
    modules: loadBusinessLogicMap(),
    steps: loadBusinessLogicSteps(),
    titles: new Map(loadProcesses().map((t) => [t.id, t.title])),
  }
}

/** The exact machine-owned Serves line for one module: its mapped processes in registry
 * order, each linked to its live process page, with the per-step function entries appended as
 * `nodeId \`function\`` pairs where they exist. */
export function renderServesLine(moduleId: string, src: ServesSource): string {
  const m = src.modules[moduleId]
  if (!m) throw new Error(`renderServesLine: unknown module ${moduleId}`)
  const parts = m.processes.map((pid) => {
    const title = src.titles.get(pid)
    if (!title) throw new Error(`renderServesLine: module ${moduleId} maps unknown process ${pid}`)
    const link = `[${title}](${SITE_URL}/processes/${processSlug(title)})`
    const fns = src.steps
      .filter((s) => s.module === moduleId && s.processId === pid)
      .map((s) => `${s.nodeId} \`${s.function}\``)
    return fns.length > 0 ? `${link} (${fns.join(', ')})` : link
  })
  return `${SERVES_PREFIX} ${parts.join(' · ')}`
}

interface Section {
  moduleId: string
  label: string
  start: number
  end: number
}

/** Each mapped module's `### <label>` section span in the README (to the next heading). */
function moduleSections(markdown: string, src: ServesSource): { sections: Section[]; errors: string[] } {
  const errors: string[] = []
  const sections: Section[] = []
  for (const [moduleId, m] of Object.entries(src.modules)) {
    const heading = `### ${m.label}\n`
    const at = markdown.indexOf(heading)
    if (at === -1) {
      errors.push(`${BUSINESS_LOGIC_README}: no "### ${m.label}" heading for module ${moduleId}`)
      continue
    }
    const rest = markdown.slice(at + heading.length)
    const next = rest.search(/\n##+ /)
    const end = next === -1 ? markdown.length : at + heading.length + next
    sections.push({ moduleId, label: m.label, start: at, end })
  }
  return { sections, errors }
}

/** Drift gate: every module's section contains its exact generated Serves line, and the doc
 * carries no stray Serves lines beyond the one-per-module set. */
export function validateServesDoc(markdown: string, src: ServesSource): string[] {
  const { sections, errors } = moduleSections(markdown, src)
  for (const s of sections) {
    const line = renderServesLine(s.moduleId, src)
    const section = markdown.slice(s.start, s.end)
    if (!section.includes(`\n${line}\n`)) {
      errors.push(
        `${BUSINESS_LOGIC_README}: the Serves line under "### ${s.label}" is missing or has drifted from open-processes/business-logic-map.json — rerun scripts/generate-business-logic-serves.ts`,
      )
    }
  }
  const strays = markdown.split('\n').filter((l) => l.startsWith(SERVES_PREFIX)).length
  if (strays !== Object.keys(src.modules).length) {
    errors.push(
      `${BUSINESS_LOGIC_README}: expected exactly one Serves line per mapped module (${Object.keys(src.modules).length}), found ${strays} — rerun scripts/generate-business-logic-serves.ts`,
    )
  }
  return errors
}

/** Generator step: the README with every module's Serves line written in place — replacing
 * the section's existing machine-owned line, else inserting it right under the heading. */
export function writeServesLines(markdown: string, src: ServesSource): string {
  const { sections, errors } = moduleSections(markdown, src)
  if (errors.length > 0) throw new Error(errors.join('\n'))
  // Rewrite back-to-front so earlier section offsets stay valid.
  let out = markdown
  for (const s of [...sections].sort((a, b) => b.start - a.start)) {
    const line = renderServesLine(s.moduleId, src)
    const heading = `### ${s.label}\n`
    const body = out.slice(s.start + heading.length, s.end)
    const hasLine = body.split('\n').some((l) => l.startsWith(SERVES_PREFIX))
    const next = hasLine
      ? body.split('\n').map((l) => (l.startsWith(SERVES_PREFIX) ? line : l)).join('\n')
      : `\n${line}\n${body}` // body starts with the heading's trailing blank line
    out = out.slice(0, s.start + heading.length) + next + out.slice(s.end)
  }
  return out
}

/** The full gate over the committed file. Empty array = pass. */
export function validateServes(): string[] {
  const markdown = fs.readFileSync(path.join(process.cwd(), BUSINESS_LOGIC_README), 'utf8')
  return validateServesDoc(markdown, servesSource())
}

// ---------------------------------------------------------------------------
// The module catalog tables (founder 2026-10-14): both READMEs organize the module
// tables into the committed MODULE_GROUPS, and each row carries a machine-owned Serves
// cell naming the processes the module serves (the same map truth as the Serves lines,
// summarized to titles). Rows and their prose cells stay authored; the Serves cell and
// the group placement are validated here and written by the same generator script.

export const ROOT_README = 'README.md'

/** Where a catalog's module links point: '' inside open-modules/README.md, the repo path
 * prefix inside the root README. */
export interface CatalogOptions {
  file: string
  anchorPrefix: string
  /** Which column (1-based, cells between the outer pipes) carries the Serves cell. */
  servesColumn: number
}

export const CATALOGS: CatalogOptions[] = [
  { file: ROOT_README, anchorPrefix: 'open-modules/README.md', servesColumn: 3 },
  { file: BUSINESS_LOGIC_README, anchorPrefix: '', servesColumn: 3 },
]

/** The machine-owned Serves cell for one module: the served processes' titles, map order. */
export function renderServesCell(moduleId: string, src: ServesSource): string {
  const m = src.modules[moduleId]
  if (!m) throw new Error(`renderServesCell: unknown module ${moduleId}`)
  return m.processes
    .map((pid) => {
      const title = src.titles.get(pid)
      if (!title) throw new Error(`renderServesCell: module ${moduleId} maps unknown process ${pid}`)
      return title
    })
    .join(' · ')
}

interface CatalogRow {
  moduleId: string
  lineIdx: number
  cells: string[]
}

/** Each module's catalog table row (matched by its anchor link) plus the `### <group>`
 * heading it sits under. */
function catalogRows(
  lines: string[],
  src: ServesSource,
  opts: CatalogOptions,
): { rows: CatalogRow[]; errors: string[] } {
  const rows: CatalogRow[] = []
  const errors: string[] = []
  for (const [moduleId, m] of Object.entries(src.modules)) {
    const needle = `](${opts.anchorPrefix}#${m.anchor})`
    const hits = lines
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => l.startsWith('| ') && l.includes(needle))
    if (hits.length !== 1) {
      errors.push(
        `${opts.file}: expected exactly one module-table row linking ${needle} for ${moduleId}, found ${hits.length}`,
      )
      continue
    }
    const { l, i } = hits[0]
    const cells = l.replace(/^\| /, '').replace(/ \|$/, '').split(' | ')
    rows.push({ moduleId, lineIdx: i, cells })
  }
  return { rows, errors }
}

/** The `### <group>` heading nearest above a line, or null. */
function groupAbove(lines: string[], idx: number): string | null {
  for (let i = idx; i >= 0; i--) {
    const m = lines[i].match(/^### (.+)$/)
    if (m) return m[1]
  }
  return null
}

/** Drift gate over one catalog: every module has one table row, the row sits under its
 * committed group heading, the group headings appear in MODULE_GROUPS order, and the
 * Serves cell byte-equals the render. */
export function validateCatalogDoc(markdown: string, src: ServesSource, opts: CatalogOptions): string[] {
  const lines = markdown.split('\n')
  const { rows, errors } = catalogRows(lines, src, opts)
  for (const row of rows) {
    const m = src.modules[row.moduleId]
    const group = groupAbove(lines, row.lineIdx)
    if (group !== m.group) {
      errors.push(
        `${opts.file}: the ${row.moduleId} row sits under "### ${group}" but the map files it under "### ${m.group}"`,
      )
    }
    const want = renderServesCell(row.moduleId, src)
    const got = row.cells[opts.servesColumn - 1]
    if (got !== want) {
      errors.push(
        `${opts.file}: the ${row.moduleId} Serves cell has drifted from open-processes/business-logic-map.json — rerun scripts/generate-business-logic-serves.ts`,
      )
    }
  }
  // The group headings appear once each, in the committed order, wherever modules file.
  const used = [...new Set(Object.values(src.modules).map((m) => m.group))]
  const headingIdx = used.map((g) => lines.findIndex((l) => l === `### ${g}`))
  for (let i = 0; i < used.length; i++) {
    if (headingIdx[i] === -1) errors.push(`${opts.file}: missing the "### ${used[i]}" group heading`)
  }
  const wantOrder = MODULE_GROUPS.filter((g) => used.includes(g))
  const gotOrder = used
    .map((g, i) => ({ g, at: headingIdx[i] }))
    .filter((x) => x.at !== -1)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.g)
  if (gotOrder.length === used.length && gotOrder.join('|') !== wantOrder.join('|')) {
    errors.push(`${opts.file}: group headings out of order — expected ${wantOrder.join(', ')}`)
  }
  return errors
}

/** Generator step over one catalog: the markdown with every module row's Serves cell
 * rewritten in place. Rows and the other cells stay authored. */
export function writeCatalogServesCells(markdown: string, src: ServesSource, opts: CatalogOptions): string {
  const lines = markdown.split('\n')
  const { rows, errors } = catalogRows(lines, src, opts)
  if (errors.length > 0) throw new Error(errors.join('\n'))
  for (const row of rows) {
    const cells = [...row.cells]
    cells[opts.servesColumn - 1] = renderServesCell(row.moduleId, src)
    lines[row.lineIdx] = `| ${cells.join(' | ')} |`
  }
  return lines.join('\n')
}

/** The full catalog gate over both committed files. Empty array = pass. */
export function validateCatalogs(): string[] {
  const src = servesSource()
  return CATALOGS.flatMap((opts) =>
    validateCatalogDoc(fs.readFileSync(path.join(process.cwd(), opts.file), 'utf8'), src, opts),
  )
}
