// Restamps pre-v2 judge-cache entries to the CELL_HASH_VERSION v2 key format
// (commit 1e129d0f1, 2026-10-19) for a category whose evidence packs are unchanged.
//
// The v2 bump folds each evidence item's tier and url into cellHash and stamps keyVersion
// into every entry, so every pre-v2 committed cell reads as "matrix incomplete" and judge
// refuses to assemble verdicts.json until the whole category is re-keyed. For a scoped
// bring-up (one new product, no evidence edits to the incumbents) a full-category re-judge
// is pure churn: the established policy (restamp-judge-cache-intdir.ts, revert-churn-*)
// holds that a re-roll citing no new evidence converges back to the committed verdicts, so
// the restamp jumps straight to that fixed point at zero LLM cost.
//
// Safety, per cell — the restamp is refused unless BOTH hold:
//   1. The cached hash equals the pre-v2 hash recomputed from the CURRENT committed pack
//      (v1 payload: storyId, title, [id, excerpt] pairs, promptVersion, judgeModel). This
//      proves the pack's ids/excerpts, the story title, prompt version and judge model are
//      exactly what the cell was judged under — the evidence has not changed since judging.
//   2. The cached verdict is content-identical (canonical key order) to the committed
//      verdicts.json row, so cache and published verdicts have not diverged.
// Any mismatch aborts; those cells need a real re-judge, not a restamp.
//
// Usage: pnpm exec tsx rankings-engine/scripts/restamp-judge-cache-keyv2.ts --category <id> [--write]
//   (no --write: dry run, prints the plan only; --write: applies changes to disk)

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { cellHash, CELL_HASH_VERSION, PROMPT_VERSION } from '../stages/judge'
import { JUDGE_MODEL } from '../llm'

const ROOT = path.resolve(__dirname, '..', '..')
const WRITE = process.argv.includes('--write')
const catIdx = process.argv.indexOf('--category')
const CATEGORY = catIdx > -1 ? process.argv[catIdx + 1] : ''
if (!CATEGORY) {
  console.error('usage: pnpm exec tsx rankings-engine/scripts/restamp-judge-cache-keyv2.ts --category <id> [--write]')
  process.exit(1)
}

type Story = { id: string; title: string }
type EvidenceItem = { id: string; tier: string; url: string; excerpt: string }

// The exact pre-v2 payload (judge.ts before 1e129d0f1): no keyVersion field, evidence
// hashed as [id, excerpt] pairs only.
function preV2Hash(story: Story, evidence: EvidenceItem[]): string {
  const payload = JSON.stringify({
    storyId: story.id,
    title: story.title,
    evidence: evidence.map((e) => [e.id, e.excerpt]),
    promptVersion: PROMPT_VERSION,
    judgeModel: JUDGE_MODEL,
  })
  return crypto.createHash('sha256').update(payload).digest('hex')
}

const dataDir = path.join(ROOT, 'open-rankings', CATEGORY)
const stories: Story[] = JSON.parse(fs.readFileSync(path.join(dataDir, 'stories.json'), 'utf8'))
const verdicts: Record<string, unknown>[] = JSON.parse(fs.readFileSync(path.join(dataDir, 'verdicts.json'), 'utf8'))
const byKey = new Map(verdicts.map((v) => [`${v.productId}:${v.storyId}`, v]))
const products: { id: string }[] = JSON.parse(fs.readFileSync(path.join(dataDir, 'products.json'), 'utf8'))

const canon = (v: unknown) => JSON.stringify(v, Object.keys(v as Record<string, unknown>).sort())

let restamped = 0
let alreadyV2 = 0
for (const p of products) {
  const evidenceFile = path.join(dataDir, 'evidence', `${p.id}.json`)
  if (!fs.existsSync(evidenceFile)) continue
  const evidence: EvidenceItem[] = JSON.parse(fs.readFileSync(evidenceFile, 'utf8'))
  for (const story of stories) {
    const cacheFile = path.join(ROOT, 'rankings-engine', 'cache', 'judge', CATEGORY, p.id, `${story.id}.json`)
    if (!fs.existsSync(cacheFile)) continue
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as {
      hash: string
      keyVersion?: string
      verdict: unknown
    }
    if (cached.keyVersion === CELL_HASH_VERSION) {
      alreadyV2++
      continue
    }
    const oldHash = preV2Hash(story, evidence)
    if (cached.hash !== oldHash) {
      throw new Error(
        `restamp: ${CATEGORY}/${p.id}:${story.id} — cached hash does not match the pre-v2 hash of the current pack (evidence changed since judging); refusing to restamp, re-judge instead`,
      )
    }
    const committed = byKey.get(`${p.id}:${story.id}`)
    if (!committed || canon(cached.verdict) !== canon(committed)) {
      throw new Error(
        `restamp: ${CATEGORY}/${p.id}:${story.id} — cached verdict differs from verdicts.json; refusing to restamp`,
      )
    }
    const fresh = cellHash(story as never, evidence as never, PROMPT_VERSION)
    console.log(`RESTAMP ${CATEGORY}/${p.id}:${story.id} ${cached.hash.slice(0, 8)} -> v2 ${fresh.slice(0, 8)}`)
    restamped++
    if (WRITE) {
      fs.writeFileSync(
        cacheFile,
        JSON.stringify({ hash: fresh, keyVersion: CELL_HASH_VERSION, verdict: cached.verdict }, null, 2) + '\n',
      )
    }
  }
}
console.log(
  `${WRITE ? 'Restamped' : 'Would restamp'} ${restamped} cell(s); ${alreadyV2} already v2.${WRITE ? '' : ' Run with --write to apply.'}`,
)
