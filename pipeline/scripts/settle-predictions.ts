// Prediction settlement: purely mechanical, no judgment involved. Re-derives the changelog
// from the committed score-history files (lib/changelog.ts — the same derivation /changelog
// renders) and settles every open question in rankings/predictions.json:
//   - 'yes' if the challenger's overtake event landed in [opensAt, settlesBy], citing the
//     exact changelog event in `settledBy`;
//   - 'no' once the deadline passes without one.
// Idempotent: settled questions are never touched again, and a run with nothing to settle
// writes nothing. See lib/predictions.ts's settleQuestions for the pure logic + tests.
//
// LLM-free; wired into .github/workflows/story-runner.yml after generate-predictions.ts.
//   pnpm tsx pipeline/scripts/settle-predictions.ts
import fs from 'node:fs'
import path from 'node:path'
import { buildChangelog } from '../../lib/changelog'
import { PREDICTIONS_FILE, PredictionsArraySchema, settleQuestions } from '../../lib/predictions'
import { DATA_DIR, readJson, writeJson } from '../paths'

function main(): void {
  const file = path.join(DATA_DIR, PREDICTIONS_FILE)
  if (!fs.existsSync(file)) {
    console.log('settle-predictions: no predictions.json yet — nothing to settle')
    return
  }
  const existing = readJson(PredictionsArraySchema, file)

  const { events } = buildChangelog(DATA_DIR)
  const { questions, settled } = settleQuestions(existing, events, new Date())

  if (settled.length === 0) {
    console.log(`settle-predictions: nothing settled (${existing.filter((q) => q.status === 'open').length} open)`)
    return
  }
  writeJson(file, questions)
  console.log(`settle-predictions: settled ${settled.length} question(s):`)
  for (const q of settled) console.log(`  ${q.id} — ${q.outcome}${q.settledBy ? ` (${q.settledBy})` : ' (deadline passed)'}`)
}

main()
