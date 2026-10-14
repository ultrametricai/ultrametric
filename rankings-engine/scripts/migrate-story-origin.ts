// One-time migration: stamps `origin` provenance onto every story in every category's
// stories.json. The 29 canonical ids (pipeline/agentic-stories.ts exports, injected verbatim
// by normalize.ts's assembleTaxonomy) get {kind:'canonical'}; every other (LLM-normalized)
// story gets {kind:'normalized', promptVersion:'v2'}. Both get the same `recordedAt`: the
// category's stories.json first-add commit date (`git log --diff-filter=A --format=%cI`),
// i.e. when that taxonomy was actually generated — not "now."
//
// Cache safety: pipeline/stages/judge.ts's cellHash() hashes only storyId + title + evidence
// + promptVersion — never the story object as a whole — so adding `origin` here must not
// change any hash and must not trigger a re-judge. Verified by running
// `pnpm pipeline judge --category desktop-os` after this migration and confirming zero
// "judge: ... →" re-judge lines and an unchanged verdicts.json (see repo report for the run).
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { type Story, StorySchema } from '../../lib/schemas'
import {
  AGENTIC_FEATURE_STORIES,
  AGENTIC_STORIES,
  API_QUALITY_STORIES,
  AUTOMATION_STORIES,
  OPENNESS_STORIES,
  PRIVACY_STORIES,
} from '../agentic-stories'
import { PROMPT_VERSION } from '../stages/judge'
import { categoryDir, readCategories, ROOT, writeJson } from '../paths'

export const CANONICAL_IDS = new Set(
  [
    ...AGENTIC_STORIES,
    ...AGENTIC_FEATURE_STORIES,
    ...API_QUALITY_STORIES,
    ...OPENNESS_STORIES,
    ...AUTOMATION_STORIES,
    ...PRIVACY_STORIES,
  ].map((s) => s.id),
)

if (CANONICAL_IDS.size !== 29) {
  throw new Error(`migrate-story-origin: expected 29 canonical ids, found ${CANONICAL_IDS.size}`)
}

// Commit date the category's stories.json was first added, oldest match (`tail`-equivalent —
// git log prints newest first, so the last line of an --diff-filter=A log is the original add).
function firstAddDate(storiesPath: string): string {
  const relPath = path.relative(ROOT, storiesPath)
  const out = execFileSync('git', ['log', '--diff-filter=A', '--format=%cI', '--', relPath], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim()
  const lines = out.split('\n').filter(Boolean)
  if (lines.length === 0) {
    throw new Error(`migrate-story-origin: no git history found for ${relPath}`)
  }
  return lines[lines.length - 1]
}

export function stampOrigin(story: Story, recordedAt: string): Story {
  const origin = CANONICAL_IDS.has(story.id)
    ? { kind: 'canonical' as const, recordedAt }
    : { kind: 'normalized' as const, promptVersion: PROMPT_VERSION, recordedAt }
  return { ...story, origin }
}

function main(): void {
  const categories = readCategories()
  for (const cat of categories) {
    const dataDir = categoryDir(cat.id)
    const storiesPath = path.join(dataDir, 'stories.json')
    if (!fs.existsSync(storiesPath)) continue

    const recordedAt = firstAddDate(storiesPath)
    const stories = StorySchema.array().parse(JSON.parse(fs.readFileSync(storiesPath, 'utf8')))
    const stamped = stories.map((s) => stampOrigin(s, recordedAt))
    writeJson(storiesPath, stamped)

    const canonicalCount = stamped.filter((s) => s.origin?.kind === 'canonical').length
    const normalizedCount = stamped.filter((s) => s.origin?.kind === 'normalized').length
    console.log(
      `migrate-story-origin: ${cat.id} — ${canonicalCount} canonical, ${normalizedCount} normalized, recordedAt=${recordedAt}`,
    )
  }
}

if (require.main === module) {
  main()
}
