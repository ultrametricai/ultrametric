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
  const feedback: Record<string, string> = {
    'session-lifecycle-api': 'Customer screening records and their CRUD lifecycle are related to identity checks, but do not establish identity-verification sessions, captured-media handling, or cancel/redact steps. Apply the existing partial-credit boundary to the story itself. Credit only documented delivery of its requested capability.',
    'automation-rules-engine': 'Fixed AI agent behavior and selecting screening lists do not establish user-defined automation rules. Apply the existing partial-credit boundary to the story itself. Credit only documented delivery of its requested capability.',
    'automation-scheduled-jobs': 'Continuous monitoring and processing incoming transactions do not by themselves establish user-configurable scheduled jobs or scheduling controls. Apply the existing partial-credit boundary to the story itself. Credit only documented delivery of its requested capability.',
  }
  const ids = category === 'identity-verification' ? ['session-lifecycle-api', 'automation-rules-engine'] : ['automation-scheduled-jobs']
  const corrections = []
  for (const id of ids) {
    const story = stories.find(s => s.id === id)!
    const file = path.join(CACHE_DIR, 'judge', category, productId, `${id}.json`)
    const cached = JSON.parse(fs.readFileSync(file, 'utf8'))
    let valid = false
    for (let attempt = 0; attempt < 3; attempt++) {
      const raw = await llmJson({ schema: RawVerdictSchema, system: SYSTEM, prompt: judgePrompt(product.name, story, evidence, '\nReview feedback: ' + feedback[id] + ' Evaluate freely under the existing rubric; no verdict tier or quality is prescribed.') })
      const verdict = { ...raw, productId, storyId: id }
      if (validateVerdictRules(verdict, evidence)) continue
      corrections.push({ storyId: id, before: cached.verdict, after: verdict, feedback: feedback[id], method: 'Same judge, evidence, model and rubric with feature-boundary review feedback; no requested tier or quality.' })
      cached.verdict = verdict
      writeJson(file, cached)
      valid = true
      break
    }
    if (!valid) throw new Error(`Invalid verdict: ${category}/${id}`)
  }
  fs.mkdirSync('engine-artifacts', { recursive: true })
  writeJson('engine-artifacts/boundary-review.json', { category, productId, corrections })
}
main().catch(error => { console.error(error); process.exit(1) })
