import fs from 'node:fs'
import path from 'node:path'
import { EvidenceSchema, ProductSchema, StorySchema } from '../../lib/schemas'
import { llmJson } from '../llm'
import { categoryDir, readJson, CACHE_DIR, writeJson } from '../paths'
import { RawVerdictSchema, SYSTEM, judgePrompt, validateVerdictRules } from '../stages/judge'

async function main() {
  const args = process.argv.slice(2)
  const category = args[args.indexOf('--category') + 1]
  const productId = args[args.indexOf('--product') + 1]
  const dir = categoryDir(category)
  const product = readJson(ProductSchema.array(), path.join(dir, 'products.json')).find(p => p.id === productId)!
  const stories = readJson(StorySchema.array(), path.join(dir, 'stories.json'))
  const evidence = readJson(EvidenceSchema.array(), path.join(dir, 'evidence', `${productId}.json`))
  const corrections = []
  for (const story of stories) {
    const file = path.join(CACHE_DIR, 'judge', category, productId, `${story.id}.json`)
    const cached = JSON.parse(fs.readFileSync(file, 'utf8'))
    const ambiguous = (rationale: string) => /Starter/i.test(rationale) && /configur/i.test(rationale) && !/\bagents?\b/i.test(rationale)
    if (!ambiguous(cached.verdict.rationale)) continue
    let valid = false
    for (let attempt = 0; attempt < 3; attempt++) {
      const feedback = '\nSource-scope review: the Starter FAQ restriction in complyadvantage-scope-starter-config-limit is explicitly about AI AGENT configuration. It does not establish a restriction on customer screening configurations, screening lists, or watchlist selection. The screening setup guide separately documents selecting appropriate screening lists with a compliance/risk team. Keep each source in its stated scope. Evaluate this story freely under the rubric; no verdict tier or quality is prescribed. If mentioning the Starter restriction, explicitly name agent configuration to avoid repeating the scope ambiguity.'
      const raw = await llmJson({ schema: RawVerdictSchema, system: SYSTEM, prompt: judgePrompt(product.name, story, evidence, feedback) })
      const verdict = { ...raw, productId, storyId: story.id }
      if (validateVerdictRules(verdict, evidence) || ambiguous(verdict.rationale)) continue
      cached.verdict = verdict
      writeJson(file, cached)
      corrections.push({ storyId: story.id, method: 'Same judge and rubric with source-scope feedback; no requested tier or quality.' })
      valid = true
      break
    }
    if (!valid) throw new Error(`Unresolved source-scope ambiguity: ${category}/${productId}/${story.id}`)
  }
  fs.mkdirSync('engine-artifacts', { recursive: true })
  writeJson('engine-artifacts/source-scope-review.json', { category, productId, corrections })
}
main().catch(error => { console.error(error); process.exit(1) })
