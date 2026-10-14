// One-time migration for Ultrametric's Accuracy Program wave 1: appends the new canonical
// `agentic-mcp-client` story (pipeline/agentic-stories.ts) to every category's stories.json.
//
// Why a separate migration instead of just re-running normalize: normalize.ts refuses to
// touch a category with real (non-SAMPLE) verdicts, and re-normalizing would also churn every
// LLM-authored story. This script does the minimal, auditable thing: add the one new
// canonical id, stamp it with `origin: {kind: 'canonical', recordedAt}` (same contract as
// migrate-story-origin.ts), and re-sort the file by theme → group → id so it matches the
// invariant assembleTaxonomy() would have produced.
//
// Cache safety: judge.ts's cellHash() only hashes storyId + title + evidence + promptVersion,
// so adding a brand-new story id never collides with an existing cache entry — the new cells
// simply have no cache file yet and `pnpm pipeline judge` will judge them fresh (expected: 53
// new cells across the 10 categories, one per product).
import fs from 'node:fs'
import path from 'node:path'
import { type Story, StorySchema } from '../../lib/schemas'
import { AGENTIC_STORIES } from '../agentic-stories'
import { categoryDir, readCategories, writeJson } from '../paths'

const NEW_STORY = AGENTIC_STORIES.find((s) => s.id === 'agentic-mcp-client')
if (!NEW_STORY) throw new Error('add-mcp-client-story: agentic-mcp-client not found in AGENTIC_STORIES')

function sortStories(stories: Story[]): Story[] {
  return [...stories].sort(
    (a, b) => a.theme.localeCompare(b.theme) || a.group.localeCompare(b.group) || a.id.localeCompare(b.id),
  )
}

function main(): void {
  const recordedAt = new Date().toISOString()
  const categories = readCategories()
  for (const cat of categories) {
    const storiesPath = path.join(categoryDir(cat.id), 'stories.json')
    if (!fs.existsSync(storiesPath)) continue

    const stories = StorySchema.array().parse(JSON.parse(fs.readFileSync(storiesPath, 'utf8')))
    if (stories.some((s) => s.id === NEW_STORY!.id)) {
      console.log(`add-mcp-client-story: ${cat.id} — already has agentic-mcp-client, skipping`)
      continue
    }

    const withNew = sortStories([...stories, { ...NEW_STORY!, origin: { kind: 'canonical' as const, recordedAt } }])
    writeJson(storiesPath, withNew)
    console.log(`add-mcp-client-story: ${cat.id} — added agentic-mcp-client (${withNew.length} stories total)`)
  }
}

if (require.main === module) {
  main()
}
