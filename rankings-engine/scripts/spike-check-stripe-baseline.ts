// Stripe agentic-capability spike helper (2026-09-14): stripe's HEAD judge caches are stale
// against its HEAD evidence pack (54/54) because the integrations-enrichment commit 54b6a895
// appended stripe-intdir-1..7 WITHOUT re-judging — the exact pre-existing condition brex/ramp
// had in the Mercury API-accuracy spike. This confirms the caches verify 0-stale against the
// pack at 54b6a895^ so the churn revert can use that ref as stripe's "new evidence" baseline.
import { execSync } from 'node:child_process'
import path from 'node:path'
import { EvidenceSchema, StorySchema } from '../../lib/schemas'
import { categoryDir, readJson } from '../paths'
import { cellHash, PROMPT_VERSION } from '../stages/judge'

const ROOT = path.resolve(__dirname, '..', '..')
const REF = process.env.BASE_REF ?? '54b6a895^'
const stories = readJson(StorySchema.array(), path.join(categoryDir('payments'), 'stories.json'))
const oldEv = EvidenceSchema.array().parse(JSON.parse(
  execSync(`git show ${REF}:data/payments/evidence/stripe.json`, { cwd: ROOT, maxBuffer: 1 << 28 }).toString('utf8'),
))
let stale = 0
for (const story of stories) {
  const cached = JSON.parse(
    execSync(`git show HEAD:pipeline/cache/judge/payments/stripe/${story.id}.json`, { cwd: ROOT, maxBuffer: 1 << 28 }).toString('utf8'),
  ) as { hash: string }
  if (cached.hash !== cellHash(story, oldEv, PROMPT_VERSION)) stale++
}
console.log(`stripe: ${stale} stale of ${stories.length} against ${REF}`)
