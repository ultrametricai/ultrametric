// Spike helper: confirm brex/ramp HEAD judge caches were computed against the evidence pack
// as of 54b6a895^ (pre integrations-enrichment wave).
import { execSync } from 'node:child_process'
import path from 'node:path'
import { EvidenceSchema, StorySchema } from '../../lib/schemas'
import { categoryDir, readJson } from '../paths'
import { cellHash, PROMPT_VERSION } from '../stages/judge'

const ROOT = path.resolve(__dirname, '..', '..')
const REF = process.env.BASE_REF ?? '54b6a895^'
const stories = readJson(StorySchema.array(), path.join(categoryDir('startup-banking'), 'stories.json'))
for (const pid of ['brex', 'ramp']) {
  const oldEv = EvidenceSchema.array().parse(JSON.parse(
    execSync(`git show ${REF}:data/startup-banking/evidence/${pid}.json`, { cwd: ROOT, maxBuffer: 1 << 28 }).toString('utf8'),
  ))
  let stale = 0
  for (const story of stories) {
    const cached = JSON.parse(
      execSync(`git show HEAD:pipeline/cache/judge/startup-banking/${pid}/${story.id}.json`, { cwd: ROOT, maxBuffer: 1 << 28 }).toString('utf8'),
    ) as { hash: string }
    if (cached.hash !== cellHash(story, oldEv, PROMPT_VERSION)) stale++
  }
  console.log(`${pid}: ${stale} stale of ${stories.length} against ${REF}`)
}
