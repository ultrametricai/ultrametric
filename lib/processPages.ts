import fs from 'node:fs'
import path from 'node:path'
import { loadProcessCatalog, type CatalogProcess } from './shared-processes/catalog'
import type { Connection, Option, Part, Reference } from './shared-processes/schema'
import { formatMinutes, REVERSIBILITY_META, URGENCY_META } from './processSim'
import { JURISDICTION_META, type Jurisdiction } from './jurisdictions'
import { GEO_COUNTRY_META, GEO_NOTE_COUNTRIES } from './processes'

// open-processes/pages/<slug>.md ↔ corpus drift machinery: every canonical record in
// open-processes/ renders as a committed Markdown page so the corpus reads as guides on
// GitHub, not raw JSON. Same doctrine as the other generated surfaces (SITUATIONS.md via
// lib/situationsDoc.ts, the Serves lines via lib/businessLogicServes.ts, step-rankings via
// lib/stepRankings.ts): the truth lives in the records, the pages are machine-owned
// (scripts/generate-process-pages.ts), and a drift test (__tests__/process-pages.test.ts)
// keeps the committed pages byte-identical with a fresh render. Pure derivation — no LLM,
// no network; every link resolves inside the repo or comes verbatim from the record.

export const PAGES_DIR = 'open-processes/pages'
export const PROCESSES_README = 'open-processes/README.md'
export const INDEX_START = '<!-- process-pages:index:start (generated — scripts/generate-process-pages.ts) -->'
export const INDEX_END = '<!-- process-pages:index:end -->'

type Meta = Record<string, unknown>

const str = (m: Meta, k: string): string | null => (typeof m[k] === 'string' ? (m[k] as string) : null)
const num = (m: Meta, k: string): number | null => (typeof m[k] === 'number' ? (m[k] as number) : null)

// Markdown link text: keep record prose verbatim except the two characters that break a link.
const linkText = (s: string): string => s.replace(/\[/g, '\\[').replace(/\]/g, '\\]')

// Multiline record prose inside a list item: every continuation line needs the item's content
// indent or the paragraph/table/code-fence escapes the step it belongs to. Blank lines stay
// blank (a loose item), non-empty lines get the indent.
const indented = (text: string, indent: string): string =>
  text.split('\n').map((line, i) => (i === 0 || line === '' ? line : `${indent}${line}`)).join('\n')
// Markdown table cell: record prose never carries pipes or newlines today; escape defensively.
const cell = (s: string): string => s.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ')

const hostname = (url: string): string => {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

// ---------------------------------------------------------------------------
// Context: the repo-level indexes a page render needs (law rule files, artifact labels,
// vendor display names, the record graph). All read from the committed tree.
// ---------------------------------------------------------------------------

export interface PageContext {
  sources: CatalogProcess[]
  slugById: Map<string, string>
  titleById: Map<string, string>
  /** law rule id → repo-relative path of its rule card (open-law/…). */
  lawFiles: Map<string, string>
  /** artifact id → display label + canonical producer record id. */
  artifacts: Map<string, { label: string; producedBy: string | null }>
  /** corpus vendor key → display name (vendor-registry label, else title-cased key). */
  vendorNames: Map<string, string>
  /** arena id → true when open-rankings/<id>/ exists (links are never fabricated). */
  arenas: Set<string>
  /** judged product display name from the arena roster, or null when not on it. */
  productName: (arenaId: string, productId: string) => string | null
  /** record id → chains whose taskIds include it. */
  chainsByTask: Map<string, CatalogProcess[]>
  /** record id → non-chain records with a reference part pointing at it. */
  referencedBy: Map<string, CatalogProcess[]>
}

// Rule cards live as one-proposition JSON files under open-law/ (lib/founderOps.ts validates
// them); everything else in that tree (map, citations, workflow coverage, LAWS.md) is not a
// rule card. Index id → path so inline "law rule <id>" prose citations become links.
function lawRuleFiles(root: string): Map<string, string> {
  const out = new Map<string, string>()
  const skip = new Set(['open-law/map.json', 'open-law/workflow-coverage.json', 'open-law/workflow-domains.json'])
  const visit = (rel: string) => {
    for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const relPath = `${rel}/${entry.name}`
      if (entry.isDirectory()) {
        if (relPath !== 'open-law/citations') visit(relPath)
      } else if (entry.name.endsWith('.json') && !skip.has(relPath)) {
        const value = JSON.parse(fs.readFileSync(path.join(root, relPath), 'utf8')) as Meta
        if (typeof value.id === 'string' && typeof value.statement === 'string') out.set(value.id, relPath)
      }
    }
  }
  if (fs.existsSync(path.join(root, 'open-law'))) visit('open-law')
  return out
}

const titleCase = (key: string): string =>
  key.split('_').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ')

export function buildPageContext(root: string = process.cwd()): PageContext {
  const sources = loadProcessCatalog(undefined, root).processes
  const slugById = new Map(sources.map((p) => [p.record.id, p.slug]))
  const titleById = new Map(sources.map((p) => [p.record.id, p.record.title]))
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'open-artifacts/registry.json'), 'utf8')) as {
    artifacts: Array<{ id: string; label: string; producedBy?: string }>
  }
  const artifacts = new Map(registry.artifacts.map((a) => [a.id, { label: a.label, producedBy: a.producedBy ?? null }]))
  const vendorRegistry = JSON.parse(fs.readFileSync(path.join(root, 'open-processes/vendor-registry.json'), 'utf8')) as {
    vendors: Record<string, { label?: string }>
  }
  const vendorNames = new Map(
    Object.entries(vendorRegistry.vendors).map(([key, v]) => [key, v.label ?? titleCase(key)]),
  )
  const rankingsDir = path.join(root, 'open-rankings')
  const arenas = new Set(
    fs.existsSync(rankingsDir)
      ? fs.readdirSync(rankingsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
      : [],
  )
  const productCache = new Map<string, Map<string, string>>()
  const productName = (arenaId: string, productId: string): string | null => {
    let roster = productCache.get(arenaId)
    if (!roster) {
      const file = path.join(rankingsDir, arenaId, 'products.json')
      roster = new Map(
        fs.existsSync(file)
          ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Array<{ id: string; name: string }>).map((p) => [p.id, p.name])
          : [],
      )
      productCache.set(arenaId, roster)
    }
    return roster.get(productId) ?? null
  }
  const chainsByTask = new Map<string, CatalogProcess[]>()
  const referencedBy = new Map<string, CatalogProcess[]>()
  for (const source of sources) {
    for (const taskId of source.taskIds ?? []) {
      chainsByTask.set(taskId, [...(chainsByTask.get(taskId) ?? []), source])
    }
    if (source.taskIds) continue
    const refs = (parts: Part[]): string[] =>
      parts.flatMap((p) => [...(p.ref ? [p.ref] : []), ...p.options.flatMap((o) => refs(o.parts))])
    for (const id of new Set(refs(source.record.parts))) {
      referencedBy.set(id, [...(referencedBy.get(id) ?? []), source])
    }
  }
  return { sources, slugById, titleById, lawFiles: lawRuleFiles(root), artifacts, vendorNames, arenas, productName, chainsByTask, referencedBy }
}

// ---------------------------------------------------------------------------
// Prose helpers
// ---------------------------------------------------------------------------

// Inline law citations follow the corpus convention "law rule <id>" — or "law rules <id>,
// <id> and <id>" — where each <id> is a dotted rule-card id (us-de.franchise-tax-annual-report).
// Every known id in the list becomes a link to its rule card; an id without a committed card
// stays plain text — a link is never fabricated.
const LAW_ID = String.raw`[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+`
const LAW_RULE_RE = new RegExp(`law rules? ${LAW_ID}(?:(?:,\\s*|,?\\s+and\\s+)${LAW_ID})*`, 'g')
const LAW_ID_RE = new RegExp(LAW_ID, 'g')

export function linkLawRules(text: string, ctx: PageContext): string {
  return text.replace(LAW_RULE_RE, (citation) =>
    citation.replace(LAW_ID_RE, (id) => {
      const file = ctx.lawFiles.get(id)
      return file ? `[${id}](../../${file})` : id
    }),
  )
}

const ROUTE_LABELS: Record<string, string> = {
  agent: 'agent-runnable',
  form: 'manual form/portal',
  person: 'human',
}

const SUPPORT_LABELS: Record<string, string> = {
  full: 'full',
  partial: 'partial',
  manual_guide: 'manual guide',
}

const COST_KIND_LABELS: Record<string, string> = {
  'government-fee': 'government fee',
  'optional-government-fee': 'optional government fee',
  'typical-vendor-price': 'typical vendor price',
  free: 'free',
}

const GEO_KIND_LABELS: Record<string, string> = {
  analog: '',
  absorbed: 'Absorbed: ',
  'not-applicable': 'Not applicable: ',
}

const COUNTRY_ORDER: string[] = ['US', ...GEO_NOTE_COUNTRIES]

const countryLabel = (code: string): string =>
  code === 'US' ? 'United States' : (GEO_COUNTRY_META as Record<string, { label: string }>)[code]?.label ?? code

// The inline marker string after a step title: routing, clock, and the doors that close.
function stepMarkers(m: Meta): string[] {
  const markers: string[] = []
  const route = str(m, 'route')
  if (route) {
    const signature = m.legalSignature === true ? ' (legally required signature)' : ''
    markers.push(`${ROUTE_LABELS[route] ?? route}${signature}`)
  }
  const mode = str(m, 'mode')
  if (mode) markers.push(`mode: ${mode.replace(/_/g, ' ')}`)
  const minutes = num(m, 'estimatedMinutes')
  if (minutes !== null) markers.push(`~${formatMinutes(minutes)}`)
  if (m.async === true) markers.push('async wait')
  if (m.approvalRequired === true) markers.push('human approval required')
  const reversibility = str(m, 'reversibility')
  if (reversibility && reversibility !== 'reversible') {
    markers.push(REVERSIBILITY_META[reversibility as keyof typeof REVERSIBILITY_META]?.label ?? reversibility)
  }
  if (m.supporting === true) markers.push('support work')
  const jurisdictions = Array.isArray(m.jurisdictions) ? (m.jurisdictions as string[]) : []
  if (jurisdictions.length > 0) {
    const nouns = jurisdictions.map((j) => JURISDICTION_META[j as Jurisdiction]?.noun ?? j)
      .map((noun) => (noun === 'multi-state' ? 'multi-state' : `in ${noun}`))
    markers.push(`only when operating ${nouns.join(', ')}`)
  }
  return markers
}

interface CostMeta { usd: number | null; kind: string; source: string; asOf: string; note?: string }
interface VerifyMeta { how: string; url?: string }
interface GeoEntry { country: string; kind: string; label?: string; summary?: string; guidance?: string; actionUrl?: string; actionLabel?: string; cost?: CostMeta; verify?: VerifyMeta }

function costLine(cost: CostMeta): string {
  const kind = COST_KIND_LABELS[cost.kind] ?? cost.kind
  const amount = cost.usd === null ? 'published amount varies' : cost.usd === 0 ? 'free' : `$${cost.usd.toLocaleString('en-US')}`
  const note = cost.note ? ` ${cost.note}` : ''
  return `Cost: ${amount} (${kind}, as of ${cost.asOf}, [${hostname(cost.source)}](${cost.source})).${note}`
}

function verifyLine(verify: VerifyMeta): string {
  const link = verify.url ? ` ([${hostname(verify.url)}](${verify.url}))` : ''
  return `Verify: ${verify.how}${link}`
}

// ---------------------------------------------------------------------------
// Reference rendering (vendor names, ranked markets, action links, sources, law rules)
// ---------------------------------------------------------------------------

type UrlRef = Extract<Reference, { kind: 'url' }>
type IdRef = Extract<Reference, { kind: 'vendor' | 'category' | 'product' | 'rule' | 'source' | 'guidance' }>

function referenceLines(references: Reference[], ctx: PageContext): string[] {
  const lines: string[] = []
  const ids = references.filter((r): r is IdRef => r.kind !== 'url')
  const urls = references.filter((r): r is UrlRef => r.kind === 'url')
  const vendorName = (id: string) => ctx.vendorNames.get(id) ?? titleCase(id)
  const stated = ids.filter((r) => r.kind === 'vendor' && r.role === 'stated-vendor').map((r) => vendorName(r.id))
  if (stated.length > 0) lines.push(`Canonical vendor: ${[...new Set(stated)].join(', ')}`)
  const candidates = [...new Set(ids.filter((r) => r.kind === 'vendor' && r.role === 'candidate').map((r) => vendorName(r.id)))]
  if (candidates.length > 0) lines.push(`Vendor options: ${candidates.join(', ')}`)
  const arenasCited = ids.filter((r) => r.kind === 'category' && r.role === 'rankings').map((r) => r.id)
  for (const arena of [...new Set(arenasCited)]) {
    lines.push(ctx.arenas.has(arena) ? `Ranked market: [${arena}](../../open-rankings/${arena})` : `Ranked market: ${arena}`)
  }
  // Cross-arena references are candidates supplied by the record (the site additionally gates
  // them on judged verdicts); named here so the choices stay findable without the JSON.
  const extraArenas = ids.filter((r) => r.kind === 'category' && r.role === 'additional-rankings').map((r) => r.id)
  for (const arena of [...new Set(extraArenas)]) {
    lines.push(ctx.arenas.has(arena) ? `Cross-arena market: [${arena}](../../open-rankings/${arena})` : `Cross-arena market: ${arena}`)
  }
  const extraProducts = [...new Set(ids.filter((r) => r.kind === 'product' && r.role === 'additional-candidate').map((r) => r.id))]
  if (extraProducts.length > 0) {
    const byArena = new Map<string, string[]>()
    for (const id of extraProducts) {
      const [arenaId, productId] = id.split('/')
      const name = (arenaId && productId ? ctx.productName(arenaId, productId) : null) ?? titleCase(productId ?? id)
      byArena.set(arenaId ?? id, [...(byArena.get(arenaId ?? id) ?? []), name])
    }
    const grouped = [...byArena.entries()].map(([arena, names]) => `${names.join(', ')} (${arena})`)
    lines.push(`Cross-arena options: ${grouped.join('; ')}`)
  }
  const action = urls.find((r) => r.role === 'legacy-action-link')
  if (action) lines.push(`Do it yourself: [${linkText(action.title ?? hostname(action.url))}](${action.url})`)
  const seen = new Set<string>(action ? [action.url] : [])
  const sources: string[] = []
  for (const r of urls) {
    if (r.role === 'legacy-action-link' || r.role === 'legacy-signup-link' || seen.has(r.url)) continue
    seen.add(r.url)
    sources.push(`[${linkText(r.title ?? hostname(r.url))}](${r.url})`)
  }
  if (sources.length > 0) lines.push(`Sources: ${sources.join(' · ')}`)
  const rules = ids.filter((r) => r.kind === 'rule')
  if (rules.length > 0) {
    const linked = rules.map((r) => {
      const file = ctx.lawFiles.get(r.id)
      return file ? `[${r.id}](../../${file})` : r.id
    })
    lines.push(`Law rules: ${linked.join(', ')}`)
  }
  return lines
}

// ---------------------------------------------------------------------------
// The step walk
// ---------------------------------------------------------------------------

// Step numbering follows the graph, not the file: a topological walk from the entry steps
// (Kahn's algorithm, authored part order as the tiebreak), so a branch never renders after
// the steps that rejoin it. Validation (lib/shared-processes/catalog.ts validateFlow)
// guarantees the links are acyclic and every step is reachable; the leftover append is
// defense in depth only.
function walkOrder(parts: Part[], links: Connection[]): Part[] {
  if (links.length === 0 || parts.length < 2) return parts
  const index = new Map(parts.map((p, i) => [p.id, i]))
  const byId = new Map(parts.map((p) => [p.id, p]))
  const incoming = new Map(parts.map((p) => [p.id, 0]))
  for (const link of links) incoming.set(link.to, (incoming.get(link.to) ?? 0) + 1)
  const ready = parts.filter((p) => (incoming.get(p.id) ?? 0) === 0).map((p) => p.id)
  const out: Part[] = []
  while (ready.length > 0) {
    ready.sort((a, b) => index.get(a)! - index.get(b)!)
    const id = ready.shift()!
    out.push(byId.get(id)!)
    for (const link of links.filter((l) => l.from === id)) {
      const left = (incoming.get(link.to) ?? 0) - 1
      incoming.set(link.to, left)
      if (left === 0) ready.push(link.to)
    }
  }
  for (const p of parts) if (!out.includes(p)) out.push(p)
  return out
}

const trimEnd = (s: string): string => s.replace(/\.\s*$/, '')

const numberList = (numbers: number[]): string =>
  numbers.length === 1
    ? `${numbers[0]}`
    : `${numbers.slice(0, -1).join(', ')} and ${numbers[numbers.length - 1]}`

// A step is branch-gated when every way to reach it runs through a conditional edge; the
// marker propagates through single-predecessor chains and resets at a join (a rejoin of all
// branches happens on every path). Used to tell required parallel predecessors ("steps 1
// and 2") from alternative branches ("step 4 or step 5"), computed in topological order so
// predecessors resolve first.
function branchGated(ordered: Part[], links: Connection[]): Map<string, boolean> {
  const gated = new Map<string, boolean>()
  for (const part of ordered) {
    const into = links.filter((l) => l.to === part.id)
    gated.set(
      part.id,
      (into.length > 0 && into.every((l) => Boolean(l.option || l.when)))
        || (into.length === 1 && !into[0].option && !into[0].when && gated.get(into[0].from) === true),
    )
  }
  return gated
}

// Whether a step's multiple unconditional predecessors are all required work (an "and" join)
// rather than alternative branches rejoining (an "or" join).
function requiredJoin(into: Connection[], gated: Map<string, boolean>): boolean {
  return into.length > 1
    && into.every((l) => !l.option && !l.when)
    && into.every((l) => gated.get(l.from) !== true)
}

// How a step is reached, rendered on the step itself so conditional branches, rejoins, and
// parallel entries read honestly instead of implying the numbered sequence. Returns null for
// the plain case: one unconditional edge from the step rendered immediately above.
function followsLine(part: Part, position: number, walk: WalkContext, ctx: PageContext): string | null {
  const { links, ordered, numberOf, partById } = walk
  if (links.length === 0) return null
  const into = links.filter((l) => l.to === part.id)
  if (into.length === 0) {
    const entries = ordered.filter((p) => !links.some((l) => l.to === p.id)).length
    return position === 0 && entries === 1 ? null : 'Entry step — no prerequisite step.'
  }
  const previous = ordered[position - 1]
  if (into.length === 1 && !into[0].option && !into[0].when && previous && into[0].from === previous.id) {
    return null
  }
  if (requiredJoin(into, walk.gated)) {
    const numbers = into.map((l) => numberOf.get(l.from)!).sort((a, b) => a - b)
    return `Follows steps ${numberList(numbers)} — ${numbers.length > 2 ? 'all' : 'both'} are required first.`
  }
  const bySource = new Map<string, string[]>()
  for (const l of into) {
    const option = l.option ? partById.get(l.from)?.options.find((o) => o.id === l.option)?.title ?? l.option : null
    const condition = [option ? `option "${trimEnd(linkLawRules(option, ctx))}"` : '', l.when ? `when ${trimEnd(linkLawRules(l.when, ctx))}` : ''].filter(Boolean).join(' and ')
    bySource.set(l.from, [...(bySource.get(l.from) ?? []), ...(condition ? [condition] : [])])
  }
  const descriptions = [...bySource.entries()]
    .sort((a, b) => numberOf.get(a[0])! - numberOf.get(b[0])!)
    .map(([from, conditions]) => `step ${numberOf.get(from)}${conditions.length > 0 ? ` (${conditions.join(' or ')})` : ''}`)
  return `Follows ${descriptions.join(' or ')}.`
}

function optionBlock(
  option: Option,
  flags: { isDefault: boolean; summaryShown: boolean },
  ctx: PageContext,
  indent: string,
): string[] {
  const lines: string[] = []
  const markers = stepMarkers(option.metadata)
  lines.push(`${indent}- **${option.title}**${markers.length > 0 ? ` — ${markers.join(' · ')}` : ''}`)
  const paragraphs: string[] = []
  if (option.when) paragraphs.push(`When: ${linkLawRules(option.when, ctx)}`)
  if (!flags.summaryShown && option.summary) paragraphs.push(linkLawRules(option.summary, ctx))
  const cost = option.metadata.cost as CostMeta | undefined
  if (cost && !flags.isDefault) paragraphs.push(costLine(cost))
  for (const p of paragraphs) lines.push('', `${indent}  ${indented(p, `${indent}  `)}`)
  // The default option's references are merged into the step's own bullets; the other methods
  // carry their own action links, sources, and vendors.
  const refLines = flags.isDefault ? [] : referenceLines(option.references, ctx)
  if (refLines.length > 0) {
    lines.push('', ...refLines.map((r) => `${indent}  - ${indented(r, `${indent}    `)}`))
  }
  if (option.parts.length > 0) {
    lines.push('')
    for (const sub of option.parts) {
      const subMarkers = stepMarkers(sub.metadata)
      lines.push(`${indent}  - **${sub.title ?? sub.id}**${subMarkers.length > 0 ? ` — ${subMarkers.join(' · ')}` : ''}`)
      const subDetail: string[] = []
      if (sub.guidance) subDetail.push(`${indent}    ${indented(linkLawRules(sub.guidance, ctx), `${indent}    `)}`)
      const subRefs = referenceLines(sub.references, ctx)
      if (subDetail.length > 0) lines.push('', ...subDetail)
      if (subRefs.length > 0) lines.push('', ...subRefs.map((r) => `${indent}    - ${indented(r, `${indent}      `)}`))
      if (subDetail.length > 0 || subRefs.length > 0) lines.push('')
    }
    while (lines[lines.length - 1] === '') lines.pop()
  }
  return lines
}

interface WalkContext {
  links: Connection[]
  ordered: Part[]
  numberOf: Map<string, number>
  partById: Map<string, Part>
  gated: Map<string, boolean>
}

function partBlock(part: Part, position: number, walk: WalkContext, ctx: PageContext): string[] {
  const lines: string[] = []
  const index = position + 1
  const follows = followsLine(part, position, walk, ctx)
  // A reference part runs another record; it keeps its own title, guidance, and markers (the
  // jurisdiction restriction, the timing) and links the record it runs.
  const refTarget = part.kind === 'reference' && part.ref ? part.ref : null
  const refLink = refTarget
    ? (() => {
        const slug = ctx.slugById.get(refTarget)
        const title = ctx.titleById.get(refTarget) ?? refTarget
        return slug ? `[${linkText(title)}](${slug}.md)` : title
      })()
    : null
  const defaultOption = part.options.find((o) => o.id === 'default')
  const meta: Meta = { ...part.metadata, ...defaultOption?.metadata }
  const markers = stepMarkers(meta)
  const headTitle = part.title ?? (refTarget ? `Run ${ctx.titleById.get(refTarget) ?? refTarget}` : part.id)
  lines.push(`<a id="step-${index}"></a>`, '', `### ${index}. ${headTitle}`, '')
  if (markers.length > 0) lines.push(markers.join(' · '), '')
  if (part.options.length > 1) {
    lines.push('| Option | Applies when |', '| --- | --- |',
      ...part.options.map((o) => `| ${cell(linkLawRules(o.title, ctx))} | ${cell(linkLawRules(o.when ?? (o.id === 'default' ? 'Recorded default' : 'No condition recorded'), ctx))} |`), '')
  }
  const detail: string[] = []
  if (follows) detail.push(`*${follows}*`)
  if (part.when) detail.push(`When: ${linkLawRules(part.when, ctx)}`)
  const defaultSummary = defaultOption?.summary || null
  const body = part.guidance ?? defaultSummary
  if (body) detail.push(linkLawRules(body, ctx))
  // The default option's summary is not always the guidance restated; when it differs it is
  // part of the record's meaning (the recommended way), so it renders too — as a step
  // paragraph here, or inside the Options list for decisions.
  const defaultSummaryShown = !defaultSummary || body === defaultSummary
  const defaultListed = part.kind === 'decision' && part.options.length > 1
  if (!defaultSummaryShown && !defaultListed) detail.push(linkLawRules(defaultSummary, ctx))
  const bullets: string[] = []
  if (refLink) bullets.push(`Runs the process ${refLink}`)
  const verify = meta.verify as VerifyMeta | undefined
  if (verify) bullets.push(verifyLine(verify))
  const cost = meta.cost as CostMeta | undefined
  if (cost) bullets.push(costLine(cost))
  const produces = str(meta, 'producesArtifact')
  if (produces) bullets.push(`Produces: ${ctx.artifacts.get(produces)?.label ?? produces}`)
  bullets.push(...referenceLines([...part.references, ...(defaultOption?.references ?? [])], ctx))
  for (const note of part.notes) bullets.push(linkLawRules(note.text, ctx))
  // Branches and non-adjacent continuations: conditional edges render as "If …" where the
  // fork happens, an unconditional edge that skips ahead renders as "Next", and a step with
  // no outgoing edge before the end of the walk marks its path's end. The target step carries
  // the matching "Follows" line.
  const outgoing = walk.links.filter((l) => l.from === part.id)
  for (const link of outgoing.filter((l) => l.option || l.when)) {
    const option = link.option
      ? part.options.find((o) => o.id === link.option)?.title ?? link.option
      : null
    const condition = [option, link.when].filter(Boolean).join(' and ')
    bullets.push(`If "${trimEnd(condition)}": continue at step ${walk.numberOf.get(link.to)}`)
  }
  const unconditional = outgoing.filter((l) => !l.option && !l.when)
  if (unconditional.length === 1) {
    const target = walk.numberOf.get(unconditional[0].to)!
    // A forward pointer past other steps is honest only when the skipped steps are not
    // co-required prerequisites of the target; a required join announces itself with its
    // own "Follows steps … required" line instead.
    if (target !== index + 1 && !requiredJoin(walk.links.filter((l) => l.to === unconditional[0].to), walk.gated)) {
      bullets.push(`Next: continue at step ${target}`)
    }
  } else if (unconditional.length > 1) {
    const numbers = unconditional.map((l) => walk.numberOf.get(l.to)!).sort((a, b) => a - b)
    bullets.push(`Next: steps ${numberList(numbers)} — all follow this step`)
  }
  const listed = part.kind === 'decision'
    ? (part.options.length === 1 && defaultOption ? [] : part.options)
    : part.options.filter((o) => o.id !== 'default')
  const optionLines: string[] = []
  if (listed.length > 0) {
    optionLines.push(part.kind === 'decision' ? 'Options:' : 'Other methods:')
    for (const option of listed) {
      const isDefault = option.id === 'default'
      optionLines.push(...optionBlock(option, { isDefault, summaryShown: isDefault && defaultSummaryShown }, ctx, '  '))
    }
  }
  const terminal = walk.links.length > 0 && outgoing.length === 0 && position < walk.ordered.length - 1
  if (detail.length > 0 || bullets.length > 0 || optionLines.length > 0 || terminal) {
    for (const d of detail) lines.push('', d)
    if (bullets.length > 0) lines.push('', ...bullets.map((b) => `- ${indented(b, '  ')}`))
    if (optionLines.length > 0) {
      lines.push('', ...optionLines)
    }
    if (terminal) lines.push('', '*This path ends here.*')
  }
  lines.push('')
  return lines
}

// ---------------------------------------------------------------------------
// Country section: record-level geo notes + step-level geo resolutions, one heading per
// country in the committed country order (US first, then the geoNotes roster).
// ---------------------------------------------------------------------------

function countrySection(record: { parts: Part[]; metadata: Meta }, ctx: PageContext): string[] {
  const notes = (Array.isArray(record.metadata.geoNotes) ? record.metadata.geoNotes : []) as GeoEntry[]
  const resolutions: Array<{ step: string; entry: GeoEntry }> = []
  record.parts.forEach((part, i) => {
    const stepEntries = (Array.isArray(part.metadata.geoResolutions) ? part.metadata.geoResolutions : []) as GeoEntry[]
    for (const entry of stepEntries) resolutions.push({ step: `Step ${i + 1}`, entry })
  })
  if (notes.length === 0 && resolutions.length === 0) return []
  const lines: string[] = ['## By country']
  const countries = [...new Set([...notes.map((n) => n.country), ...resolutions.map((r) => r.entry.country)])]
  for (const country of [...COUNTRY_ORDER, ...countries.filter((c) => !COUNTRY_ORDER.includes(c))]) {
    const note = notes.find((n) => n.country === country)
    const steps = resolutions.filter((r) => r.entry.country === country)
    if (!note && steps.length === 0) continue
    lines.push('', `<a id="geo-${country.toLowerCase()}"></a>`, '', `### ${countryLabel(country)}`, '')
    if (note) {
      const prefix = GEO_KIND_LABELS[note.kind] ?? ''
      const link = note.actionUrl ? ` ([${linkText(note.actionLabel ?? hostname(note.actionUrl))}](${note.actionUrl}))` : ''
      lines.push(`- ${indented(`${prefix}${linkLawRules(note.summary ?? '', ctx)}${link}`, '  ')}`)
    }
    for (const { step, entry } of steps) {
      const prefix = GEO_KIND_LABELS[entry.kind] ?? ''
      const guidance = entry.guidance ? ` ${linkLawRules(entry.guidance, ctx)}` : ''
      const link = entry.actionUrl ? ` ([${linkText(entry.actionLabel ?? hostname(entry.actionUrl))}](${entry.actionUrl}))` : ''
      lines.push(`- ${indented(`${step}: ${prefix}${entry.label ?? ''}${guidance}${link}`, '  ')}`)
      if (entry.cost) lines.push(`  - ${indented(costLine(entry.cost), '    ')}`)
      if (entry.verify) lines.push(`  - ${indented(verifyLine(entry.verify), '    ')}`)
    }
  }
  return lines
}

// ---------------------------------------------------------------------------
// Whole-page render
// ---------------------------------------------------------------------------

function artifactLink(id: string, ctx: PageContext): string {
  const artifact = ctx.artifacts.get(id)
  const producer = artifact?.producedBy ? ctx.slugById.get(artifact.producedBy) : null
  const title = artifact?.producedBy ? ctx.titleById.get(artifact.producedBy) : null
  return `${artifact?.label ?? id}${producer && title ? ` — from [${linkText(title)}](${producer}.md)` : ''}`
}

function geographyOverview(ordered: Part[], metadata: Meta): string[] {
  const notes = (Array.isArray(metadata.geoNotes) ? metadata.geoNotes : []) as GeoEntry[]
  const resolutions = (p: Part) => (Array.isArray(p.metadata.geoResolutions) ? p.metadata.geoResolutions : []) as GeoEntry[]
  const countriesFor = (p: Part) => p.options.flatMap((o) => {
    const context = o.metadata.context as { countries?: string[] } | undefined
    return Array.isArray(context?.countries) ? context.countries : []
  })
  const countries = [...new Set([...notes.map((n) => n.country), ...ordered.flatMap((p) => [...resolutions(p).map((r) => r.country), ...countriesFor(p)])])]
  const states = ordered.filter((p) => Array.isArray(p.metadata.jurisdictions) && p.metadata.jurisdictions.length > 0)
  if (countries.length === 0 && states.length === 0) return []
  const lines = ['## Geography', '',
    'Country rows describe the guidance recorded here. Local notes and step alternatives do not establish a complete country-specific workflow.', '']
  if (countries.length > 0) {
    lines.push('| Country | Recorded guidance | Steps with local alternatives or resolutions |', '| --- | --- | --- |')
    for (const country of [...COUNTRY_ORDER, ...countries.filter((c) => !COUNTRY_ORDER.includes(c))].filter((c) => countries.includes(c))) {
      const note = notes.find((n) => n.country === country)
      const kinds: string[] = []
      if (note) kinds.push(({ analog: 'Local analog note', absorbed: 'Handled within another local process', 'not-applicable': 'Marked not applicable' } as Record<string, string>)[note.kind] ?? 'Country note')
      if (ordered.some((p) => resolutions(p).some((r) => r.country === country))) kinds.push('step resolution')
      if (ordered.some((p) => countriesFor(p).includes(country))) kinds.push('step alternative')
      const steps = ordered.flatMap((p, i) => resolutions(p).some((r) => r.country === country) || countriesFor(p).includes(country) ? [`[${i + 1}](#step-${i + 1})`] : [])
      // Countries with only an option have no country note to jump to; link to the step.
      const hasDetails = Boolean(note) || ordered.some((p) => resolutions(p).some((r) => r.country === country))
      const name = hasDetails ? `[${countryLabel(country)}](#geo-${country.toLowerCase()})` : countryLabel(country)
      lines.push(`| ${cell(name)} | ${kinds.join('; ')} | ${steps.join(', ') || '—'} |`)
    }
    lines.push('')
  }
  if (states.length > 0) {
    lines.push('### State conditions', '', '| Step | Applies when operating in |', '| --- | --- |')
    for (const p of states) {
      const index = ordered.indexOf(p) + 1
      const jurisdictions = p.metadata.jurisdictions as string[]
      lines.push(`| [${index}. ${cell(p.title ?? p.id)}](#step-${index}) | ${cell(jurisdictions.map((j) => JURISDICTION_META[j as Jurisdiction]?.noun ?? j).join(', '))} |`)
    }
    lines.push('')
  }
  return lines
}

function stepsOverview(walk: WalkContext, ctx: PageContext): string[] {
  const lines = ['## Steps at a glance', '',
    'Use the recorded prerequisites and conditions to follow the path. Row order is for navigation.', '',
    '| Step | Handled by | Time estimate | Incoming dependencies |', '| --- | --- | --- | --- |']
  for (const [i, p] of walk.ordered.entries()) {
    const m: Meta = { ...p.metadata, ...p.options.find((o) => o.id === 'default')?.metadata }
    const markers = [m.approvalRequired === true ? 'approval required' : '', m.legalSignature === true ? 'signature required' : '', m.async === true ? 'includes waiting' : ''].filter(Boolean)
    const route = str(m, 'route')
    const owner = route ? ROUTE_LABELS[route] ?? route : 'Not recorded'
    const into = walk.links.filter((l) => l.to === p.id)
    const dependencies = into.map((l) => {
      const option = l.option ? walk.partById.get(l.from)?.options.find((o) => o.id === l.option)?.title ?? l.option : null
      const condition = [option, l.when].filter(Boolean).join(' and ')
      return `[Step ${walk.numberOf.get(l.from)}](#step-${walk.numberOf.get(l.from)})${condition ? ` (${linkLawRules(condition, ctx)})` : ''}`
    })
    const join = into.length > 1 ? (requiredJoin(into, walk.gated) ? 'All: ' : 'Alternatives: ') : ''
    const starts = dependencies.length ? join + dependencies.join('; ') : 'Entry step'
    const minutes = num(m, 'estimatedMinutes')
    const title = p.title ?? (p.ref ? ctx.titleById.get(p.ref) : null) ?? p.id
    lines.push(`| [${i + 1}. ${cell(linkText(title))}](#step-${i + 1}) | ${cell([owner, ...markers].join('; '))} | ${minutes === null ? 'Not recorded' : `~${formatMinutes(minutes)}`} | ${cell(starts)} |`)
  }
  return [...lines, '']
}

export function renderProcessPage(source: CatalogProcess, ctx: PageContext): string {
  const { record, slug, taskIds } = source
  const m = record.metadata as Meta
  const ordered = walkOrder(record.parts, record.links)
  const geography = geographyOverview(ordered, m)
  const requires = (Array.isArray(m.requires) ? m.requires : []) as string[]
  const inputs = (Array.isArray(m.contextNeeded) ? m.contextNeeded : []) as Array<{ query?: string; required?: boolean }>
  const namedInputs = inputs.filter((input) => typeof input.query === 'string')
  const produces = (Array.isArray(m.produces) ? m.produces : []) as string[]
  const lines: string[] = []
  lines.push(
    `<!-- Generated by scripts/generate-process-pages.ts from open-processes/${slug}.json — do not hand-edit.`,
    '     Edit the source record, then run: pnpm exec tsx scripts/generate-process-pages.ts -->',
    '',
    `# ${record.title}`,
    '',
  )
  const nav = ['[Overview](#overview)']
  if (requires.length || namedInputs.length) nav.push('[Before you start](#before-you-start)')
  if (geography.length) nav.push('[Geography](#geography)')
  if (taskIds) nav.push('[Process sequence](#process-sequence)')
  else if (ordered.length) nav.push('[Steps](#steps-at-a-glance)')
  if (produces.length) nav.push('[Outputs](#outputs)')
  lines.push(nav.join(' · '), '', '## Overview', '')
  const trigger = str(m, 'trigger')
  if (trigger) lines.push(`**Trigger:** ${linkLawRules(trigger, ctx)}`, '')
  if (record.summary) lines.push(linkLawRules(record.summary, ctx), '')
  if (record.guidance) lines.push(linkLawRules(record.guidance, ctx), '')
  for (const note of record.notes) {
    lines.push(...linkLawRules(note.text, ctx).split('\n').map((l) => (l === '' ? '>' : `> ${l}`)), '')
  }

  const rows: Array<[string, string]> = []
  rows.push(['Kind', taskIds ? 'chain' : record.kind])
  const phase = str(m, 'phase')
  if (phase) rows.push(['Phase', phase])
  const cadence = str(m, 'cadence')
  if (cadence) rows.push(['Cadence', cadence])
  const geoScope = str(m, 'geoScope')
  if (geoScope) rows.push(['Geo scope', geoScope])
  const complexity = str(m, 'complexity')
  if (complexity) rows.push(['Complexity', complexity.replace(/_/g, ' ')])
  const reversibility = str(m, 'reversibility')
  if (reversibility) {
    rows.push(['Reversibility', REVERSIBILITY_META[reversibility as keyof typeof REVERSIBILITY_META]?.label ?? reversibility])
  }
  const urgency = str(m, 'urgency')
  if (urgency) rows.push(['Urgency', URGENCY_META[urgency as keyof typeof URGENCY_META]?.label ?? urgency])
  const active = num(m, 'activeMinutes')
  if (active !== null) rows.push(['Active work', `~${formatMinutes(active)}`])
  const total = num(m, 'totalEstimatedMinutes')
  if (total !== null) rows.push(['Elapsed including waits', `~${formatMinutes(total)}`])
  const supportLevel = str(m, 'supportLevel')
  if (supportLevel) rows.push(['Agent support', SUPPORT_LABELS[supportLevel] ?? supportLevel])
  if (rows.length > 0) {
    lines.push('| Field | Value |', '| --- | --- |', ...rows.map(([k, v]) => `| ${k} | ${cell(v)} |`), '')
  }
  const supportReason = str(m, 'supportReason')
  if (supportReason) lines.push(linkLawRules(supportReason, ctx), '')
  const recordRefLines = referenceLines(record.references, ctx)
  if (recordRefLines.length > 0) lines.push(...recordRefLines.map((l) => `- ${l}`), '')

  if (record.outcomes.length > 0) {
    lines.push('## Outcomes', '', ...record.outcomes.map((o) => `- ${indented(linkLawRules(o, ctx), '  ')}`), '')
  }

  if (requires.length || namedInputs.length) {
    if (requires.length) lines.push('<a id="artifacts"></a>', '')
    lines.push('## Before you start', '')
    if (requires.length) lines.push('Required artifacts:', '', ...requires.map((id) => `- ${artifactLink(id, ctx)}`), '')
    if (namedInputs.length) lines.push('| Information to gather | Required by the record |', '| --- | --- |',
      ...namedInputs.map((input) => `| ${cell(input.query!)} | ${input.required === true ? 'Yes' : input.required === false ? 'Optional' : 'Not specified'} |`), '')
  }
  lines.push(...geography)

  if (taskIds) {
    lines.push('<a id="processes-in-order"></a>', '', '## Process sequence', '',
      'Run the linked processes in the recorded chain order. Each process defines its own internal dependencies.', '',
      '| Order | Process | Requires | Produces |', '| --- | --- | --- | --- |')
    taskIds.forEach((id, i) => {
      const chainSlug = ctx.slugById.get(id)
      const title = ctx.titleById.get(id) ?? id
      const target = ctx.sources.find((s) => s.record.id === id)
      const list = (key: string) => (Array.isArray(target?.record.metadata[key]) ? target.record.metadata[key] as string[] : []).map((a) => ctx.artifacts.get(a)?.label ?? a).join('; ') || 'Not recorded'
      lines.push(`| ${i + 1} | ${cell(chainSlug ? `[${linkText(title)}](${chainSlug}.md)` : title)} | ${cell(list('requires'))} | ${cell(list('produces'))} |`)
    })
    lines.push('')
  }
  if (!taskIds && ordered.length > 0) {
    const walk: WalkContext = {
      links: record.links,
      ordered,
      numberOf: new Map(ordered.map((p, i) => [p.id, i + 1])),
      partById: new Map(record.parts.map((p) => [p.id, p])),
      gated: branchGated(ordered, record.links),
    }
    lines.push(...stepsOverview(walk, ctx), '<a id="steps"></a>', '', '## Step details', '')
    ordered.forEach((part, i) => {
      lines.push(...partBlock(part, i, walk, ctx))
    })
    lines.push('')
  }

  const country = countrySection({ parts: ordered, metadata: m }, ctx)
  if (country.length > 0) lines.push('<a id="by-country"></a>', '', ...country.map((l) => l === '## By country' ? '## Country details' : l), '')

  if (produces.length > 0) {
    if (requires.length === 0) lines.push('<a id="artifacts"></a>', '')
    lines.push('## Outputs', '')
    lines.push(...produces.map((id) => `- ${ctx.artifacts.get(id)?.label ?? id}`), '')
  }

  const chains = ctx.chainsByTask.get(record.id) ?? []
  const referrers = (ctx.referencedBy.get(record.id) ?? []).filter((r) => r.record.id !== record.id)
  if (chains.length > 0 || referrers.length > 0) {
    lines.push('## Related records', '')
    for (const chain of chains) lines.push(`- Part of the chain [${linkText(chain.record.title)}](${chain.slug}.md)`)
    for (const ref of referrers) lines.push(`- Runs as a step of [${linkText(ref.record.title)}](${ref.slug}.md)`)
    lines.push('')
  }

  lines.push('---', '', `Source record: [\`open-processes/${slug}.json\`](../${slug}.json)`, '')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// The full page set and the README index block
// ---------------------------------------------------------------------------

/** Every page, keyed by file name inside PAGES_DIR, rendered fresh from the catalog. */
export function renderAllPages(root: string = process.cwd()): Map<string, string> {
  const ctx = buildPageContext(root)
  const pages = new Map<string, string>()
  for (const source of [...ctx.sources].sort((a, b) => a.slug.localeCompare(b.slug))) {
    pages.set(`${source.slug}.md`, renderProcessPage(source, ctx))
  }
  return pages
}

/** The exact generated README index block (markers included). */
export function renderPagesIndex(sources: CatalogProcess[]): string {
  const byTitle = (a: CatalogProcess, b: CatalogProcess) => a.record.title.localeCompare(b.record.title)
  const chains = sources.filter((s) => s.taskIds).sort(byTitle)
  const situations = sources.filter((s) => !s.taskIds && s.record.kind === 'situation').sort(byTitle)
  const processes = sources.filter((s) => !s.taskIds && s.record.kind === 'process').sort(byTitle)
  const item = (s: CatalogProcess) => `- [${linkText(s.record.title)}](pages/${s.slug}.md)`
  return [
    INDEX_START,
    '',
    `One page per canonical record: ${processes.length} processes, ${situations.length} situations, ${chains.length} chains.`,
    '',
    '### Processes',
    '',
    ...processes.map(item),
    '',
    '### Situations',
    '',
    ...situations.map(item),
    '',
    '### Chains',
    '',
    ...chains.map(item),
    '',
    INDEX_END,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Drift gates (pure validators take data so failure modes are testable; fs wrappers below)
// ---------------------------------------------------------------------------

/** Byte-identity between the committed page set and a fresh render: same file set, same bytes. */
export function validatePageSet(committed: Map<string, string>, rendered: Map<string, string>): string[] {
  const errors: string[] = []
  for (const name of rendered.keys()) {
    if (!committed.has(name)) errors.push(`${PAGES_DIR}/${name}: missing — rerun scripts/generate-process-pages.ts`)
  }
  for (const name of committed.keys()) {
    if (!rendered.has(name)) errors.push(`${PAGES_DIR}/${name}: stale — no canonical record renders it; rerun scripts/generate-process-pages.ts`)
  }
  for (const [name, content] of rendered) {
    const existing = committed.get(name)
    if (existing !== undefined && existing !== content) {
      errors.push(`${PAGES_DIR}/${name}: drifted from its canonical record — rerun scripts/generate-process-pages.ts`)
    }
  }
  return errors
}

/** The committed README must contain the exact generated index block. */
export function validatePagesIndexDoc(markdown: string, block: string): string[] {
  const start = markdown.indexOf(INDEX_START)
  const end = markdown.indexOf(INDEX_END)
  if (start === -1 || end === -1 || end < start) {
    return [`${PROCESSES_README}: missing the generated index markers (${INDEX_START} … ${INDEX_END})`]
  }
  if (markdown.slice(start, end + INDEX_END.length) !== block) {
    return [`${PROCESSES_README}: the generated index block has drifted — rerun scripts/generate-process-pages.ts`]
  }
  return []
}

export function committedPages(root: string = process.cwd()): Map<string, string> {
  const dir = path.join(root, PAGES_DIR)
  if (!fs.existsSync(dir)) return new Map()
  const out = new Map<string, string>()
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.md')).sort()) {
    out.set(name, fs.readFileSync(path.join(dir, name), 'utf8'))
  }
  return out
}

/** The full gate over the committed tree. Empty array = pass. */
export function validateProcessPages(root: string = process.cwd()): string[] {
  const ctx = buildPageContext(root)
  const rendered = new Map<string, string>()
  for (const source of [...ctx.sources].sort((a, b) => a.slug.localeCompare(b.slug))) {
    rendered.set(`${source.slug}.md`, renderProcessPage(source, ctx))
  }
  const errors = validatePageSet(committedPages(root), rendered)
  const readme = fs.readFileSync(path.join(root, PROCESSES_README), 'utf8')
  errors.push(...validatePagesIndexDoc(readme, renderPagesIndex(ctx.sources)))
  return errors
}
