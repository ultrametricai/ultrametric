import fs from 'node:fs'
import path from 'node:path'
import { CertificationsArraySchema } from './certifications'
import {
  type Category, CategorySchema, type Claim, ClaimSchema, EvidenceSchema,
  PopularityMapSchema, ProductSchema, RankingsSchema,
  StackSchema, StorySchema, UncertaintyArraySchema, VendorResponsesArraySchema, VerdictSchema,
} from './schemas'

export type { CategoryData } from './data-helpers'
export {
  battleSlug, evidenceById, findBattleBySlug, groupInOrder, leadingBattle, originLabel,
  parseBattleSlug, stripPersonaPrefix, uncertaintyFor, vendorResponseFor, verdictFor,
} from './data-helpers'
import type { CategoryData } from './data-helpers'

const DEFAULT_DIR = () => path.join(process.cwd(), 'open-rankings')

const categoriesCache = new Map<string, Category[]>()
const categoryCache = new Map<string, CategoryData>()

export function loadCategories(dir: string = DEFAULT_DIR()): Category[] {
  const hit = categoriesCache.get(dir)
  if (hit) return hit

  const raw = JSON.parse(fs.readFileSync(path.join(dir, 'categories.json'), 'utf8'))
  const categories = CategorySchema.array().parse(raw)
  categoriesCache.set(dir, categories)
  return categories
}

const REQUIRED_POPULATED_FILES = ['stories.json', 'verdicts.json', 'rankings.json']

export function isPopulated(categoryId: string, dir: string = DEFAULT_DIR()): boolean {
  const base = path.join(dir, categoryId)
  return REQUIRED_POPULATED_FILES.every((file) => fs.existsSync(path.join(base, file)))
}

export function loadCategory(categoryId: string, dir: string = DEFAULT_DIR()): CategoryData {
  const cacheKey = `${dir}::${categoryId}`
  const hit = categoryCache.get(cacheKey)
  if (hit) return hit

  const category = loadCategories(dir).find((c) => c.id === categoryId)
  if (!category) throw new Error(`unknown category ${categoryId}`)

  const catDir = path.join(dir, categoryId)
  const read = (file: string) => JSON.parse(fs.readFileSync(path.join(catDir, file), 'utf8'))
  const products = ProductSchema.array().parse(read('products.json'))
  const stories = StorySchema.array().parse(read('stories.json'))
  const verdicts = VerdictSchema.array().parse(read('verdicts.json'))
  const rankings = RankingsSchema.parse(read('rankings.json'))
  const evidence = Object.fromEntries(
    products.map((p) => [p.id, EvidenceSchema.array().parse(read(path.join('evidence', `${p.id}.json`)))]),
  )

  const productIds = new Set(products.map((p) => p.id))
  const storyIds = new Set(stories.map((s) => s.id))

  const cellKeys = new Set<string>()
  for (const v of verdicts) {
    if (!productIds.has(v.productId)) throw new Error(`verdict references unknown product ${v.productId}`)
    if (!storyIds.has(v.storyId)) throw new Error(`verdict references unknown story ${v.storyId}`)
    const key = `${v.productId}:${v.storyId}`
    if (cellKeys.has(key)) throw new Error(`duplicate verdict for cell ${key}`)
    cellKeys.add(key)
    const known = new Set(evidence[v.productId].map((e) => e.id))
    for (const id of v.evidenceIds) {
      if (!known.has(id)) throw new Error(`verdict ${key} cites missing evidence ${id}`)
    }
  }
  for (const p of products) for (const s of stories) {
    if (!cellKeys.has(`${p.id}:${s.id}`)) throw new Error(`missing verdict for cell ${p.id}:${s.id}`)
  }

  for (const entry of rankings.leaderboard) {
    if (!productIds.has(entry.productId)) throw new Error(`leaderboard references unknown product ${entry.productId}`)
  }
  const pairs = new Set<string>()
  for (const b of rankings.battles) {
    if (!productIds.has(b.a) || !productIds.has(b.b)) throw new Error(`battle ${b.a} vs ${b.b} references unknown product`)
    pairs.add([b.a, b.b].sort().join('|'))
  }
  const expectedPairs = (products.length * (products.length - 1)) / 2
  if (pairs.size !== expectedPairs || rankings.battles.length !== expectedPairs) {
    throw new Error(`expected ${expectedPairs} unique battles, found ${rankings.battles.length}`)
  }

  const stacksPath = path.join(catDir, 'stacks.json')
  const stacks = fs.existsSync(stacksPath) ? StackSchema.array().parse(read('stacks.json')) : []
  for (const stack of stacks) {
    for (const pid of stack.productIds) {
      if (!productIds.has(pid)) throw new Error(`stack ${stack.id} references unknown product ${pid}`)
    }
  }

  // Optional: not every category has been through the (LLM-free) popularity stage yet. Tolerate
  // absence entirely — an empty map, not an error — per lib/data-helpers.ts's CategoryData doc.
  const popularityPath = path.join(catDir, 'popularity.json')
  const popularity = fs.existsSync(popularityPath) ? PopularityMapSchema.parse(read('popularity.json')) : {}
  for (const pid of Object.keys(popularity)) {
    if (!productIds.has(pid)) throw new Error(`popularity references unknown product ${pid}`)
  }

  // Optional, same contract as popularity above: not every category has been through the claims
  // stage yet, and even when it has, an individual product's claims file may be missing — both
  // resolve to that productId being absent from the map (display code must treat a miss as "no
  // claims recorded", i.e. `[]`, not as an error).
  const claimsDirPath = path.join(catDir, 'claims')
  const claims: Record<string, Claim[]> = {}
  if (fs.existsSync(claimsDirPath)) {
    for (const p of products) {
      const claimsFile = path.join(claimsDirPath, `${p.id}.json`)
      if (!fs.existsSync(claimsFile)) continue
      const productClaims = ClaimSchema.array().parse(read(path.join('claims', `${p.id}.json`)))
      for (const c of productClaims) {
        for (const sid of c.storyIds) {
          if (!storyIds.has(sid)) throw new Error(`claim ${c.id} references unknown story ${sid}`)
        }
      }
      claims[p.id] = productClaims
    }
  }

  // Optional, same contract as popularity/claims above: not every category is a "close race"
  // (see rankings-engine/scripts/uncertainty-pass.ts) or has been through this pass at all.
  const uncertaintyPath = path.join(catDir, 'uncertainty.json')
  const uncertainty = fs.existsSync(uncertaintyPath) ? UncertaintyArraySchema.parse(read('uncertainty.json')) : []
  for (const u of uncertainty) {
    if (!productIds.has(u.productId)) throw new Error(`uncertainty references unknown product ${u.productId}`)
    if (!storyIds.has(u.storyId)) throw new Error(`uncertainty references unknown story ${u.storyId}`)
  }

  // Optional, same contract as popularity/claims/uncertainty above: most categories have no
  // verified vendor responses at all. Each response must target a real cell, and a cell can
  // carry at most one 'standing' response (superseded ones stay as the public record — see
  // docs/vendor-responses.md's supersession rules).
  const vendorResponsesPath = path.join(catDir, 'vendor-responses.json')
  const vendorResponses = fs.existsSync(vendorResponsesPath)
    ? VendorResponsesArraySchema.parse(read('vendor-responses.json'))
    : []
  const standingResponseCells = new Set<string>()
  for (const r of vendorResponses) {
    if (!productIds.has(r.productId)) throw new Error(`vendor response references unknown product ${r.productId}`)
    if (!storyIds.has(r.storyId)) throw new Error(`vendor response references unknown story ${r.storyId}`)
    if (r.status === 'standing') {
      const key = `${r.productId}:${r.storyId}`
      if (standingResponseCells.has(key)) throw new Error(`multiple standing vendor responses for cell ${key}`)
      standingResponseCells.add(key)
    }
  }

  // Optional, same contract as popularity/claims/uncertainty/vendor-responses above: most
  // arenas have no certified products. Each certification must target a real product, and a
  // product carries at most one entry (a re-certification replaces the old row — the prior
  // report stays in git history). Expiry (180 days) is display-time, not load-time: an expired
  // entry loads fine but activeCertificationFor() stops returning it.
  const certificationsPath = path.join(catDir, 'certifications.json')
  const certifications = fs.existsSync(certificationsPath)
    ? CertificationsArraySchema.parse(read('certifications.json'))
    : []
  const certifiedProducts = new Set<string>()
  for (const cert of certifications) {
    if (!productIds.has(cert.productId)) throw new Error(`certification references unknown product ${cert.productId}`)
    if (certifiedProducts.has(cert.productId)) throw new Error(`multiple certifications for product ${cert.productId}`)
    certifiedProducts.add(cert.productId)
  }

  const data: CategoryData = { category, products, stories, evidence, verdicts, rankings, stacks, popularity, claims, uncertainty, vendorResponses, certifications }
  categoryCache.set(cacheKey, data)
  return data
}

export function loadAll(dir: string = DEFAULT_DIR()): CategoryData[] {
  return loadCategories(dir)
    .filter((c) => isPopulated(c.id, dir))
    .map((c) => loadCategory(c.id, dir))
}
