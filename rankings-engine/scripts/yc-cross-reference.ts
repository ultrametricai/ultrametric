// Cross-references Ultrametric's existing catalog (every product in every arena, not just the
// YC-classified modern batches) against the FULL YC public directory (all batches, 2006–present)
// to find which current products are themselves YC alumni. Matches are verified by normalized
// website domain — never by name — to avoid false positives from unrelated companies that share a
// product name (see rankings-engine/yc-shared.ts's normalizeDomain doc). Writes open-rankings/yc-batches.json
// ({ productId: "S22" }) and stamps the verified ycBatch onto each matched product's
// open-rankings/{category}/products.json entry.
//
// Depends on rankings-engine/scripts/yc-fetch.ts having already populated
// rankings-engine/cache/yc/companies-all.json. Run with: tsx rankings-engine/scripts/yc-cross-reference.ts
import fs from 'node:fs'
import path from 'node:path'
import { ProductSchema } from '../../lib/schemas'
import { readJson, resolveCategories, writeJson } from '../paths'
import { batchCode, normalizeDomain, type YcRawCompany } from '../yc-shared'

const ROOT = path.resolve(__dirname, '..', '..')
const CACHE_DIR = path.join(ROOT, 'rankings-engine', 'cache', 'yc')
const YC_BATCHES_PATH = path.join(ROOT, 'open-rankings', 'yc-batches.json')

function main() {
  const all = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'companies-all.json'), 'utf8')) as YcRawCompany[]

  // Build domain -> company. A handful of domains repeat across former/renamed entries in the YC
  // feed; keep the first (oldest id order in the source feed is stable) and flag collisions so a
  // human can sanity-check them rather than silently picking one.
  const byDomain = new Map<string, YcRawCompany>()
  const collisions: string[] = []
  for (const c of all) {
    const d = normalizeDomain(c.website)
    if (!d) continue
    if (byDomain.has(d) && byDomain.get(d)!.slug !== c.slug) {
      collisions.push(`${d}: ${byDomain.get(d)!.slug} vs ${c.slug}`)
      continue
    }
    byDomain.set(d, c)
  }

  const categories = resolveCategories()
  const ycBatches: Record<string, string> = {}
  const matches: { productId: string; category: string; company: string; batch: string; code: string }[] = []
  let totalProducts = 0

  for (const category of categories) {
    const productsPath = path.join(ROOT, 'open-rankings', category.id, 'products.json')
    const products = readJson(ProductSchema.array(), productsPath)
    totalProducts += products.length
    let changed = false
    const updated = products.map((p) => {
      const domain = normalizeDomain(p.urls.site)
      const company = domain ? byDomain.get(domain) : undefined
      if (!company) {
        if (!p.ycBatch) return p
        changed = true
        return { ...p, ycBatch: undefined }
      }
      const code = batchCode(company.batch)
      if (!code) return p
      ycBatches[p.id] = code
      matches.push({ productId: p.id, category: category.id, company: company.name, batch: company.batch, code })
      if (p.ycBatch !== code) changed = true
      return { ...p, ycBatch: code }
    })
    if (changed) {
      const parsed = ProductSchema.array().parse(updated)
      writeJson(productsPath, parsed)
    }
  }

  // Sorted keys: the mapping's on-disk order is independent of category iteration order, so a
  // re-run after an arena add or rename diffs only the entries that actually changed.
  const sorted = Object.fromEntries(Object.entries(ycBatches).sort(([a], [b]) => a.localeCompare(b)))
  writeJson(YC_BATCHES_PATH, sorted)

  console.log(`Checked ${totalProducts} existing products against ${all.length} YC companies (all batches).`)
  console.log(`\nMatches (${matches.length}):`)
  for (const m of matches) console.log(`  ${m.productId} (${m.category}) -> ${m.company} [${m.code} / ${m.batch}]`)
  if (collisions.length) {
    console.log(`\nDomain collisions in YC feed (skipped, kept first):`)
    for (const c of collisions) console.log(`  ${c}`)
  }
  console.log(`\nWrote ${matches.length} entries to ${path.relative(ROOT, YC_BATCHES_PATH)}`)
}

main()
