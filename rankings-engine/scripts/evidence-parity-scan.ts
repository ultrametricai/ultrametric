// Evidence-parity scan: finds verdict cells that score none (or low partial) because the
// evidence pack is silent, not because the vendor lacks the capability. These are the cells
// where a vendor can plausibly lose points to pack-assembly gaps (per-source extraction caps,
// transform losses, missed doc pages) rather than to reality — the failure mode fixed by the
// append-*-evidence-*.py precedents (see append-startup-banking-mercury-evidence.py and
// append-api-quality-docs-evidence.py).
//
// The scan is read-only over the committed corpus: every open-rankings/<arena>/verdicts.json
// cell with verdict=none, or verdict=partial at quality <= 3, whose rationale uses absence
// language ("nothing in the evidence pack", "the pack never mentions", ...) is flagged. Each
// flagged row carries the arena, product, story, the rationale sentence that matched, and a
// hypothesis URL (the vendor's docs root from products.json, falling back to the site root)
// where a repair wave would start looking for vendor documentation of the capability.
//
// A flagged cell is a REPAIR CANDIDATE, not a wrong verdict: many vendors genuinely lack the
// capability and the cell is correct. The scan only queues cells for a human/agent to check
// the hypothesis URL. Repairs follow the standard flow: verify on the vendor's own pages,
// append dated evidence via a committed append-*-evidence-*.py script, then scoped
// `pnpm engine judge --product <id>` and `pnpm engine derive --category <arena>`.
//
// Products are ranked by flagged-cell count weighted by how mainstream the product is:
// membership in open-rankings/popular-products.json doubles the weight, and tracked
// popularity signals (GitHub stars, npm weekly downloads from the arena's popularity.json)
// add a log-scaled bump. The absence phrases below were derived from the rationale corpus
// (counted across every arena's verdicts.json), not invented.
//
// Usage: tsx rankings-engine/scripts/evidence-parity-scan.ts [--date YYYY-MM-DD] [--top N]
// Writes reports/evidence-parity/<date>.json and <date>.md.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const RANKINGS_DIR = path.join(ROOT, 'open-rankings')
const REPORT_DIR = path.join(ROOT, 'reports', 'evidence-parity')

// Phrases the judge actually uses when a cell fails for lack of pack coverage, ranked by
// corpus frequency at authoring time. Broader stems ("never mentions", "no evidence")
// subsume the longer variants; both are kept so the matched snippet lands on the most
// specific phrasing available.
const ABSENCE_PATTERNS: RegExp[] = [
  /nothing in the evidence pack/i,
  /nothing in the pack/i,
  /evidence pack never mentions/i,
  /pack never mentions/i,
  /pack contains no/i,
  /evidence pack has no/i,
  /evidence pack does not/i,
  /not documented in the pack/i,
  /no (?:evidence|item) in the pack/i,
  /the pack never/i,
  /no evidence/i,
  /never mentions/i,
  /no mention/i,
  /no documented/i,
]

const LOW_PARTIAL_MAX_QUALITY = 3
const SNIPPET_MAX = 240

interface VerdictCell {
  productId: string
  storyId: string
  verdict: string
  quality: number
  confidence?: string
  rationale: string
  evidenceIds: string[]
}

interface ProductRecord {
  id: string
  name?: string
  urls?: { site?: string; docs?: string; [k: string]: unknown }
}

interface FlaggedRow {
  arena: string
  productId: string
  storyId: string
  verdict: string
  quality: number
  snippet: string
  hypothesisUrl: string | null
}

interface ProductRank {
  productId: string
  arenas: string[]
  flaggedCells: number
  popular: boolean
  stars: number | null
  npmWeekly: number | null
  weight: number
  weightedScore: number
  hypothesisUrl: string | null
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T
}

// The sentence of the rationale containing the first absence-phrase match, trimmed.
function matchSnippet(rationale: string): string | null {
  for (const re of ABSENCE_PATTERNS) {
    const m = re.exec(rationale)
    if (!m) continue
    const idx = m.index
    const start = rationale.lastIndexOf('. ', idx)
    const end = rationale.indexOf('. ', idx)
    let sentence = rationale.slice(start < 0 ? 0 : start + 2, end < 0 ? rationale.length : end + 1).trim()
    if (sentence.length > SNIPPET_MAX) sentence = `${sentence.slice(0, SNIPPET_MAX - 1).trimEnd()}…`
    return sentence
  }
  return null
}

function listArenas(): string[] {
  return fs
    .readdirSync(RANKINGS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(RANKINGS_DIR, d.name, 'verdicts.json')))
    .map((d) => d.name)
    .sort()
}

export interface ScanResult {
  generatedAt: string
  arenas: number
  cellsScanned: number
  candidateCells: number
  flagged: FlaggedRow[]
  productRanking: ProductRank[]
}

export function runScan(): ScanResult {
  const popularSet = new Set(readJson<string[]>(path.join(RANKINGS_DIR, 'popular-products.json')))
  const flagged: FlaggedRow[] = []
  const arenas = listArenas()
  let cellsScanned = 0
  let candidateCells = 0
  const productMeta = new Map<
    string,
    { arenas: Set<string>; stars: number | null; npmWeekly: number | null; hypothesisUrl: string | null }
  >()

  for (const arena of arenas) {
    const dir = path.join(RANKINGS_DIR, arena)
    const verdicts = readJson<VerdictCell[]>(path.join(dir, 'verdicts.json'))
    const products = readJson<ProductRecord[]>(path.join(dir, 'products.json'))
    const urlByProduct = new Map(products.map((p) => [p.id, p.urls?.docs ?? p.urls?.site ?? null]))
    const popularityFile = path.join(dir, 'popularity.json')
    const popularity = fs.existsSync(popularityFile)
      ? readJson<Record<string, { stars?: number; npmWeekly?: number }>>(popularityFile)
      : {}

    for (const cell of verdicts) {
      cellsScanned += 1
      const low = cell.verdict === 'none' || (cell.verdict === 'partial' && cell.quality <= LOW_PARTIAL_MAX_QUALITY)
      if (!low) continue
      candidateCells += 1
      const snippet = matchSnippet(cell.rationale)
      if (!snippet) continue
      const hypothesisUrl = urlByProduct.get(cell.productId) ?? null
      flagged.push({
        arena,
        productId: cell.productId,
        storyId: cell.storyId,
        verdict: cell.verdict,
        quality: cell.quality,
        snippet,
        hypothesisUrl,
      })
      const meta = productMeta.get(cell.productId) ?? {
        arenas: new Set<string>(),
        stars: null,
        npmWeekly: null,
        hypothesisUrl,
      }
      meta.arenas.add(arena)
      meta.hypothesisUrl = meta.hypothesisUrl ?? hypothesisUrl
      const pop = popularity[cell.productId]
      if (pop?.stars != null) meta.stars = Math.max(meta.stars ?? 0, pop.stars)
      if (pop?.npmWeekly != null) meta.npmWeekly = Math.max(meta.npmWeekly ?? 0, pop.npmWeekly)
      productMeta.set(cell.productId, meta)
    }
  }

  const counts = new Map<string, number>()
  for (const row of flagged) counts.set(row.productId, (counts.get(row.productId) ?? 0) + 1)

  const productRanking: ProductRank[] = [...counts.entries()]
    .map(([productId, flaggedCells]) => {
      const meta = productMeta.get(productId)!
      const popular = popularSet.has(productId)
      // Mainstream weight: 1.0 baseline, x2 for the curated popular list, plus log-scaled
      // tracked-signal bumps (a 100k-star repo or a 1M-download/week package adds ~0.8).
      const weight =
        (popular ? 2 : 1)
        + Math.log10(1 + (meta.stars ?? 0)) / 6
        + Math.log10(1 + (meta.npmWeekly ?? 0)) / 8
      return {
        productId,
        arenas: [...meta.arenas].sort(),
        flaggedCells,
        popular,
        stars: meta.stars,
        npmWeekly: meta.npmWeekly,
        weight: Number(weight.toFixed(3)),
        weightedScore: Number((flaggedCells * weight).toFixed(2)),
        hypothesisUrl: meta.hypothesisUrl,
      }
    })
    .sort(
      (a, b) =>
        b.weightedScore - a.weightedScore
        || b.flaggedCells - a.flaggedCells
        || a.productId.localeCompare(b.productId),
    )

  flagged.sort(
    (a, b) =>
      a.arena.localeCompare(b.arena) || a.productId.localeCompare(b.productId) || a.storyId.localeCompare(b.storyId),
  )

  return {
    generatedAt: new Date().toISOString(),
    arenas: arenas.length,
    cellsScanned,
    candidateCells,
    flagged,
    productRanking,
  }
}

function renderMarkdown(result: ScanResult, date: string, top: number): string {
  const lines: string[] = []
  lines.push(`## Evidence-parity scan — ${date}`)
  lines.push('')
  lines.push(
    `Read-only scan (\`rankings-engine/scripts/evidence-parity-scan.ts\`) over ${result.arenas} arenas: `
    + `${result.cellsScanned} verdict cells scanned, ${result.candidateCells} at none/low-partial, `
    + `${result.flagged.length} flagged (rationale cites a silent evidence pack rather than contradicting evidence).`,
  )
  lines.push('')
  lines.push(
    '> Flagged cells are repair candidates, not wrong verdicts. Repairs run per product: verify the capability on '
    + 'the hypothesis URL (the vendor\'s own docs), append dated evidence via a committed script, then scoped '
    + '`judge --product` and `derive`. Cells that stay none after honest evidence ship as none.',
  )
  lines.push('')
  lines.push(`### Top ${top} products by weighted flagged-cell count`)
  lines.push('')
  lines.push('| # | product | arenas | flagged cells | popular | weight | weighted | hypothesis URL |')
  lines.push('|--:|---------|--------|--------------:|:-------:|-------:|---------:|----------------|')
  for (const [i, p] of result.productRanking.slice(0, top).entries()) {
    lines.push(
      `| ${i + 1} | ${p.productId} | ${p.arenas.join(', ')} | ${p.flaggedCells} | ${p.popular ? 'yes' : ''} `
      + `| ${p.weight} | ${p.weightedScore} | ${p.hypothesisUrl ?? ''} |`,
    )
  }
  lines.push('')
  lines.push('### Flagged cells by arena')
  lines.push('')
  const byArena = new Map<string, number>()
  for (const row of result.flagged) byArena.set(row.arena, (byArena.get(row.arena) ?? 0) + 1)
  lines.push('| arena | flagged cells |')
  lines.push('|-------|--------------:|')
  for (const [arena, n] of [...byArena.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${arena} | ${n} |`)
  }
  lines.push('')
  lines.push(`Full row-level output (arena, product, story, rationale snippet, hypothesis URL): \`reports/evidence-parity/${date}.json\`.`)
  lines.push('')
  return lines.join('\n')
}

function main(): void {
  const args = process.argv.slice(2)
  const dateIdx = args.indexOf('--date')
  const topIdx = args.indexOf('--top')
  const date = dateIdx >= 0 ? args[dateIdx + 1] : new Date().toISOString().slice(0, 10)
  const top = topIdx >= 0 ? Number(args[topIdx + 1]) : 20
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`--date must be YYYY-MM-DD, got ${date}`)

  const result = runScan()
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const jsonPath = path.join(REPORT_DIR, `${date}.json`)
  const mdPath = path.join(REPORT_DIR, `${date}.md`)
  fs.writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`)
  fs.writeFileSync(mdPath, renderMarkdown(result, date, top))
  console.log(
    `evidence-parity scan: ${result.cellsScanned} cells, ${result.candidateCells} none/low-partial, `
    + `${result.flagged.length} flagged across ${result.productRanking.length} products`,
  )
  console.log(`wrote ${path.relative(ROOT, jsonPath)} and ${path.relative(ROOT, mdPath)}`)
}

if (require.main === module) main()
