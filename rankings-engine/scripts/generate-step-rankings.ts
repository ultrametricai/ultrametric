// Emits open-rankings/step-rankings.json: the full vendor ranking for every rankable process
// step (lib/stepRankings.ts's buildStepRankings over lib/processRankings.ts's stepRankingFull
// and crossArenaStepRankingsFull). Pure derivation from the committed corpus, the step→story
// mapping (process-step-stories.json), and each arena's judged verdicts — no LLM, no network,
// no cache. Re-run after any corpus, mapping, verdict, or product change; drift against the
// committed file fails lib/__tests__/stepRankings.test.ts and pnpm recompute-check.
//
// Usage: tsx rankings-engine/scripts/generate-step-rankings.ts
import fs from 'node:fs'
import path from 'node:path'
import { buildStepRankings, serializeStepRankings } from '../../lib/stepRankings'

const ROOT = path.resolve(__dirname, '..', '..')
const OUT = path.join(ROOT, 'open-rankings', 'step-rankings.json')

// Called by the CLI below and by every automated flow whose judge/derive pass can move
// verdicts (the scheduled runner workflows and rankings-engine/contest-check.ts), same
// contract as generate-story-graph.ts's writeStoryGraph().
export function writeStepRankings(): void {
  const file = buildStepRankings(path.join(ROOT, 'open-rankings'))
  const json = serializeStepRankings(file)
  fs.writeFileSync(OUT, json)
  const primary = file.steps.filter((s) => s.primary).length
  const cross = file.steps.filter((s) => s.crossArena.length > 0).length
  const restricted = file.steps.filter((s) => s.primary?.eligibility).length
  console.log(
    `wrote ${path.relative(ROOT, OUT)} (${(Buffer.byteLength(json, 'utf8') / 1024).toFixed(0)}KB) — `
    + `${file.steps.length} ranked steps (${primary} primary, ${cross} with cross-arena markets, `
    + `${restricted} government-eligibility restricted)`,
  )
}

if (require.main === module) writeStepRankings()
