// Prediction-question generator: for every populated arena whose #1 and #2 are a close race
// (within lib/predictions.ts's CLOSE_RACE_THRESHOLD Overall score points — the same definition
// the uncertainty pass uses), open a "Will <#2> overtake <#1> in <arena> by <opensAt+30d>?"
// question in open-rankings/predictions.json. Idempotent by arena + unordered product pair: re-running
// on unchanged data appends nothing, and an arena with an open question for its current top-2
// pair is skipped (see lib/predictions.ts's generateQuestions). Settlement is a separate,
// purely mechanical step — see settle-predictions.ts.
//
// LLM-free and cheap; wired into .github/workflows/story-runner.yml after derive.
//   pnpm tsx rankings-engine/scripts/generate-predictions.ts
import fs from 'node:fs'
import path from 'node:path'
import {
  generateQuestions, PREDICTIONS_FILE, PredictionsArraySchema, type ArenaTop2Snapshot,
} from '../../lib/predictions'
import { ProductSchema, RankingsSchema } from '../../lib/schemas'
import { categoryDir, DATA_DIR, readCategories, readJson, writeJson } from '../paths'

function collectSnapshots(): ArenaTop2Snapshot[] {
  const snapshots: ArenaTop2Snapshot[] = []
  for (const cat of readCategories()) {
    const dataDir = categoryDir(cat.id)
    const rankingsPath = path.join(dataDir, 'rankings.json')
    if (!fs.existsSync(rankingsPath)) continue
    const rankings = readJson(RankingsSchema, rankingsPath)
    const products = readJson(ProductSchema.array(), path.join(dataDir, 'products.json'))
    const nameOf = (id: string) => products.find((p) => p.id === id)?.name ?? id
    const [top1, top2] = rankings.leaderboard
    snapshots.push({
      categoryId: cat.id,
      categoryName: cat.name,
      generatedAt: rankings.generatedAt,
      top1: top1 ? { productId: top1.productId, name: nameOf(top1.productId), aiEra: top1.aiEra } : null,
      top2: top2 ? { productId: top2.productId, name: nameOf(top2.productId), aiEra: top2.aiEra } : null,
    })
  }
  return snapshots
}

function main(): void {
  const file = path.join(DATA_DIR, PREDICTIONS_FILE)
  const existing = fs.existsSync(file) ? readJson(PredictionsArraySchema, file) : []

  const { questions, added } = generateQuestions(existing, collectSnapshots())

  if (added.length === 0) {
    console.log(`generate-predictions: no new questions (${existing.filter((q) => q.status === 'open').length} already open)`)
    return
  }
  writeJson(file, questions)
  console.log(`generate-predictions: opened ${added.length} question(s):`)
  for (const q of added) console.log(`  ${q.id} — ${q.question}`)
}

main()
