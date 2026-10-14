// Runs `pipeline judge --category <cat> --product <id>` once per product in the category,
// sequentially, in-process (no shell loop — the sandbox here disallows multi-command shell
// control structures). judge.ts is cache-resumable (cellHash skip), so re-running this after a
// partial run only computes what's still missing. Used by Lane B's depth-mining sprint to
// judge newly-injected stories per product, one product at a time, as instructed.
import { ProductSchema } from '../../lib/schemas'
import { categoryDir, readJson, resolveCategories } from '../paths'
import path from 'node:path'
import { runJudge } from '../stages/judge'

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const categoryFlag = args.indexOf('--category')
  const category = categoryFlag >= 0 ? args[categoryFlag + 1] : undefined
  if (!category) throw new Error('usage: tsx pipeline/scripts/judge-all-products.ts --category <id>')

  const [cat] = resolveCategories(category)
  const products = readJson(ProductSchema.array(), path.join(categoryDir(cat.id), 'products.json'))
  for (const p of products) {
    console.log(`judge-all-products: === ${cat.id}/${p.id} ===`)
    await runJudge({ category: cat.id, product: p.id })
  }
  console.log(`judge-all-products: done with ${cat.id} (${products.length} products)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
