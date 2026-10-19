// Scratch re-judge pilot: runs the EXACT judge stage (same SYSTEM prompt, same correction
// loop, same cellHash) for one category, but writes every artifact to a caller-supplied
// scratch directory OUTSIDE the repo — committed open-rankings/, the judge cache under rankings-engine/cache/,
// and rankings.json are never touched. Built for model-migration pilots (e.g. sonnet-5 →
// opus-5-5): run with UM_JUDGE_MODEL=<candidate> and diff the scratch verdicts against the committed
// baseline with rankings-engine/scripts/rejudge-pilot-diff.ts.
//
// Usage:
//   UM_JUDGE_MODEL=claude-opus-5-5 pnpm tsx rankings-engine/scripts/rejudge-pilot.ts \
//     --category ai-coding --out /tmp/opus55-pilot [--concurrency 6]
//
// Resumable: a cell whose scratch file already exists with the current cellHash is skipped,
// so a crashed run can be restarted without re-spending judge calls. Token usage for every
// API call (including llmJson retries and rule-violation correction rounds — i.e. actual
// spend, not per-cell minimums) is accumulated and written to <out>/<category>/usage.json.
import fs from 'node:fs'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import {
  EvidenceSchema, ProductSchema, StorySchema, type Verdict,
} from '../../lib/schemas'
import { llmJson, setClientForTests } from '../llm'
import {
  PROMPT_VERSION, RawVerdictSchema, SYSTEM, cellHash, judgePrompt, validateVerdictRules,
} from '../stages/judge'
import { ROOT, categoryDir, readJson } from '../paths'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const category = arg('category')
const out = arg('out')
const onlyProduct = arg('product') // optional: smoke-test a single product before a full run
const concurrency = Number(arg('concurrency') ?? 6)
if (!category || !out) {
  console.error('usage: UM_JUDGE_MODEL=<model> pnpm tsx rankings-engine/scripts/rejudge-pilot.ts --category <id> --out <scratch-dir> [--product <id>] [--concurrency N]')
  process.exit(1)
}

// Hard isolation guard: the scratch dir must not live anywhere a committed artifact could be
// clobbered. Refuse open-rankings/ and rankings-engine/cache/ (and anything inside them) outright.
const outAbs = path.resolve(out)
for (const forbidden of [path.join(ROOT, 'open-rankings'), path.join(ROOT, 'rankings-engine', 'cache')]) {
  if (outAbs === forbidden || outAbs.startsWith(forbidden + path.sep)) {
    throw new Error(`rejudge-pilot: --out ${outAbs} is inside ${forbidden} — pick a scratch location outside the repo's committed trees`)
  }
}

const usage = {
  model: process.env.UM_JUDGE_MODEL ?? process.env.PA_MODEL ?? 'claude-sonnet-5',
  calls: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
  cells: 0,
  skipped: 0,
  failedCells: [] as string[],
  startedAt: new Date().toISOString(),
  finishedAt: '',
}

// Wrap the real client so every messages.create() — retries and correction rounds included —
// lands in the usage ledger. llmJson only ever calls messages.create, so that's the whole
// surface we need to mirror.
const real = new Anthropic()
setClientForTests({
  messages: {
    create: async (params: Anthropic.MessageCreateParamsNonStreaming) => {
      const res = await real.messages.create(params)
      usage.calls += 1
      usage.inputTokens += res.usage.input_tokens
      usage.outputTokens += res.usage.output_tokens
      usage.cacheCreationInputTokens += res.usage.cache_creation_input_tokens ?? 0
      usage.cacheReadInputTokens += res.usage.cache_read_input_tokens ?? 0
      return res
    },
  },
} as unknown as Anthropic)

function writeScratchJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
}

async function main(): Promise<void> {
  const dataDir = categoryDir(category!)
  const products = readJson(ProductSchema.array(), path.join(dataDir, 'products.json'))
  const stories = readJson(StorySchema.array(), path.join(dataDir, 'stories.json'))
  const cellsDir = path.join(outAbs, category!, 'cells')

  const queue: Array<() => Promise<void>> = []
  const evidenceByProduct = new Map(
    products.map((p) => [p.id, readJson(EvidenceSchema.array(), path.join(dataDir, 'evidence', `${p.id}.json`))]),
  )

  for (const p of products) {
    if (onlyProduct && p.id !== onlyProduct) continue
    const evidence = evidenceByProduct.get(p.id)!
    for (const story of stories) {
      const cellFile = path.join(cellsDir, p.id, `${story.id}.json`)
      const hash = cellHash(story, evidence, PROMPT_VERSION)
      if (fs.existsSync(cellFile)) {
        const cached = JSON.parse(fs.readFileSync(cellFile, 'utf8')) as { hash: string }
        if (cached.hash === hash) {
          usage.skipped += 1
          continue
        }
      }
      queue.push(async () => {
        try {
          let raw = await llmJson({ schema: RawVerdictSchema, system: SYSTEM, prompt: judgePrompt(p.name, story, evidence) })
          let verdict: Verdict = { ...raw, productId: p.id, storyId: story.id }
          let violation = validateVerdictRules(verdict, evidence)
          for (let round = 0; violation && round < 3; round++) {
            raw = await llmJson({
              schema: RawVerdictSchema,
              system: SYSTEM,
              prompt: judgePrompt(p.name, story, evidence, `\nYour previous verdict violated a rule: ${violation}. Correct it. If quality is below 10, the rationale MUST contain the literal phrase "missing for 10:" followed by the specific gaps.`),
            })
            verdict = { ...raw, productId: p.id, storyId: story.id }
            violation = validateVerdictRules(verdict, evidence)
          }
          if (violation) throw new Error(`still violates rules: ${violation}`)
          writeScratchJson(cellFile, { hash, verdict })
          usage.cells += 1
          console.log(`rejudge-pilot: ${category}/${p.id}:${story.id} → ${verdict.verdict} q${verdict.quality} [${usage.cells} done]`)
        } catch (err) {
          usage.failedCells.push(`${p.id}:${story.id}`)
          console.error(`rejudge-pilot: FAILED ${category}/${p.id}:${story.id}: ${err instanceof Error ? err.message : err}`)
        }
      })
    }
  }

  console.log(`rejudge-pilot: model=${usage.model} cells to judge=${queue.length} (skipped ${usage.skipped} already done) concurrency=${concurrency}`)

  let next = 0
  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, async () => {
      while (next < queue.length) {
        const task = queue[next]
        next += 1
        await task()
      }
    }),
  )

  usage.finishedAt = new Date().toISOString()
  writeScratchJson(path.join(outAbs, category!, 'usage.json'), usage)

  if (usage.failedCells.length > 0) {
    console.error(`rejudge-pilot: ${usage.failedCells.length} cells failed — re-run to retry (resume skips completed cells)`)
    process.exit(1)
  }

  // Assemble a verdicts.json (same shape + sort as the judge stage) in the scratch dir.
  // Skipped on a --product smoke run: the matrix is deliberately incomplete there.
  if (onlyProduct) {
    console.log(`rejudge-pilot: smoke run for ${onlyProduct} done — verdicts.json not assembled (partial matrix)`)
    console.log(`rejudge-pilot: usage — ${usage.calls} calls, ${usage.inputTokens} input tokens, ${usage.outputTokens} output tokens`)
    return
  }
  const all: Verdict[] = []
  for (const p of products) {
    for (const story of stories) {
      const cellFile = path.join(cellsDir, p.id, `${story.id}.json`)
      const cached = JSON.parse(fs.readFileSync(cellFile, 'utf8')) as { verdict: Verdict }
      all.push(cached.verdict)
    }
  }
  all.sort((x, y) => x.productId.localeCompare(y.productId) || x.storyId.localeCompare(y.storyId))
  writeScratchJson(path.join(outAbs, category!, 'verdicts.json'), all)
  console.log(`rejudge-pilot: wrote ${all.length} scratch verdicts to ${path.join(outAbs, category!, 'verdicts.json')}`)
  console.log(`rejudge-pilot: usage — ${usage.calls} calls, ${usage.inputTokens} input tokens, ${usage.outputTokens} output tokens`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
