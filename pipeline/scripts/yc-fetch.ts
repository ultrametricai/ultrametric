// Stage 1 of the YC ingestion lane: pull the full YC public company directory from the keyless
// yc-oss/api mirror, cache the raw feed (pipeline/cache/yc/, gitignored), and distill the modern
// batches (W23–S26) into rankings/yc-map.json with mappedArena/proposedArena left null — that's
// pipeline/scripts/yc-classify.ts's job. Run with: tsx pipeline/scripts/yc-fetch.ts
import fs from 'node:fs'
import path from 'node:path'
import { YcMapSchema } from '../../lib/schemas'
import { ROOT, writeJson } from '../paths'
import { batchCode, MODERN_BATCHES, YC_ALL_COMPANIES_URL, type YcRawCompany } from '../yc-shared'

const CACHE_DIR = path.join(ROOT, 'pipeline', 'cache', 'yc')
const YC_MAP_PATH = path.join(ROOT, 'rankings', 'yc-map.json')

async function fetchAllCompanies(): Promise<YcRawCompany[]> {
  const res = await fetch(YC_ALL_COMPANIES_URL)
  if (!res.ok) throw new Error(`yc-oss/api fetch failed: ${res.status} ${res.statusText}`)
  return (await res.json()) as YcRawCompany[]
}

async function main() {
  console.log(`Fetching ${YC_ALL_COMPANIES_URL} ...`)
  const all = await fetchAllCompanies()
  console.log(`Fetched ${all.length} companies total (all batches, 2006–present).`)

  fs.mkdirSync(CACHE_DIR, { recursive: true })
  writeJson(path.join(CACHE_DIR, 'companies-all.json'), all)

  const modern = all.filter((c) => MODERN_BATCHES.includes(c.batch))
  writeJson(path.join(CACHE_DIR, 'companies-modern.json'), modern)

  // Preserve yc-classify's verdicts across refreshes: a re-fetch must never wipe the LLM-assigned
  // mappedArena/proposedArena for companies we already classified (they'd all reset to null and
  // force a full re-classification spend).
  const previous = new Map<string, { mappedArena: string | null; proposedArena: string | null }>()
  if (fs.existsSync(YC_MAP_PATH)) {
    for (const c of YcMapSchema.parse(JSON.parse(fs.readFileSync(YC_MAP_PATH, 'utf8')))) {
      previous.set(c.slug, { mappedArena: c.mappedArena, proposedArena: c.proposedArena })
    }
  }

  const distilled = modern.map((c) => ({
    name: c.name,
    slug: c.slug,
    batch: c.batch,
    // A handful of companies ship with no website in the upstream feed — fall back to their YC
    // company page so every entry still carries a resolvable, schema-valid URL.
    website: c.website || c.url,
    oneLiner: c.one_liner ?? '',
    tags: Array.from(new Set([...(c.tags ?? []), ...(c.industries ?? [])])),
    mappedArena: previous.get(c.slug)?.mappedArena ?? null,
    proposedArena: previous.get(c.slug)?.proposedArena ?? null,
  }))

  const parsed = YcMapSchema.parse(distilled)
  writeJson(YC_MAP_PATH, parsed)

  console.log('\nPer-batch counts (modern, W23–S26):')
  for (const b of MODERN_BATCHES) {
    const code = batchCode(b)
    const n = modern.filter((c) => c.batch === b).length
    console.log(`  ${code}  ${b.padEnd(14)} ${n}`)
  }
  console.log(`  TOTAL          ${modern.length}`)
  console.log(`\nWrote ${parsed.length} companies to ${path.relative(ROOT, YC_MAP_PATH)}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
