import path from 'node:path'
import { attachProvenance } from '../../lib/provenance'
import { buildRollups, RollupsSchema } from '../../lib/rollups'
import { ProductSchema, RankingsSchema, StorySchema, VerdictSchema } from '../../lib/schemas'
import { appendScoreHistoryOnChange } from '../../lib/scoreHistory'
import { buildRankings } from '../../lib/scoring'
import { categoryDir, readJson, resolveCategories, writeJson } from '../paths'

export async function runDerive({ category }: { category?: string; product?: string }): Promise<void> {
  for (const cat of resolveCategories(category)) {
    const dataDir = categoryDir(cat.id)
    const products = readJson(ProductSchema.array(), path.join(dataDir, 'products.json'))
    const stories = readJson(StorySchema.array(), path.join(dataDir, 'stories.json'))
    const verdicts = readJson(VerdictSchema.array(), path.join(dataDir, 'verdicts.json'))
    // attachProvenance stamps the ownership watermark (lib/provenance.ts) — a pure function of
    // (arena id, rankings content), so recompute-check can reproduce it byte-for-byte.
    const rankings = RankingsSchema.parse(
      attachProvenance(cat.id, buildRankings(products, stories, verdicts, new Date().toISOString())),
    )
    writeJson(path.join(dataDir, 'rankings.json'), rankings)
    // Country/area rollups for arenas with jurisdiction-tagged products (government-services):
    // a pure function of (products, rankings), stamped with rankings.generatedAt so
    // recompute-check reproduces it byte-for-byte. Null for every untagged arena.
    const rollups = buildRollups(products, rankings)
    if (rollups) writeJson(path.join(dataDir, 'rollups.json'), RollupsSchema.parse(rollups))
    // Forward-fill the score time series (same pattern as popularity's popularity-history.jsonl
    // append, but change-only): one line per product whose rounded aiEra/agentReady moved since
    // the file's last entry for it. Idempotent — a re-derive with unchanged verdicts appends 0.
    const appended = appendScoreHistoryOnChange(dataDir, rankings)
    console.log(
      `derive: wrote rankings for ${cat.id}: ${products.length} products, ${rankings.battles.length} battles` +
        (appended > 0 ? `; score-history +${appended}` : ''),
    )
  }
}
