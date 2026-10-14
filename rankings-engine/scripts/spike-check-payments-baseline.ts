// Stripe agentic-capability spike helper (2026-09-14): confirm every payments product's judge
// cache is hash-fresh against its CURRENT evidence pack before the spike touches stripe's pack
// — same role as spike-check-baseline.ts in the Mercury API-accuracy spike (a pre-existing
// stale cache elsewhere would block `pnpm pipeline judge` from assembling verdicts.json).
import fs from 'node:fs'
import path from 'node:path'
import { EvidenceSchema, ProductSchema, StorySchema } from '../../lib/schemas'
import { CACHE_DIR, categoryDir, readJson } from '../paths'
import { cellHash, PROMPT_VERSION } from '../stages/judge'

const cat = process.env.CAT ?? 'payments'
const stories = readJson(StorySchema.array(), path.join(categoryDir(cat), 'stories.json'))
const products = readJson(ProductSchema.array(), path.join(categoryDir(cat), 'products.json'))
let anyStale = false
for (const p of products) {
  const ev = readJson(EvidenceSchema.array(), path.join(categoryDir(cat), 'evidence', `${p.id}.json`))
  let stale = 0
  let missing = 0
  for (const s of stories) {
    const f = path.join(CACHE_DIR, 'judge', cat, p.id, `${s.id}.json`)
    if (!fs.existsSync(f)) {
      missing++
      continue
    }
    const cached = JSON.parse(fs.readFileSync(f, 'utf8')) as { hash: string }
    if (cached.hash !== cellHash(s, ev, PROMPT_VERSION)) stale++
  }
  if (stale || missing) anyStale = true
  console.log(`${p.id}: stale=${stale} missing=${missing} of ${stories.length}`)
}
process.exit(anyStale ? 1 : 0)
