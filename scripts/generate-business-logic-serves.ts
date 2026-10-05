// Regenerates the machine-owned "**Serves:**" line in every module section of
// open-modules/README.md from processes/business-logic-map.json (the modules' mapped
// processes plus the per-step function entries), via lib/businessLogicServes.ts. The prose
// around each line is authored; only the Serves lines are machine-owned. Drift gate:
// lib/__tests__/businessLogicServes.test.ts (the SITUATIONS.md pattern,
// scripts/generate-situations-md.ts).
//
// Usage: pnpm exec tsx scripts/generate-business-logic-serves.ts
import fs from 'node:fs'
import path from 'node:path'
import {
  BUSINESS_LOGIC_README, servesSource, validateServesDoc, writeServesLines,
} from '../lib/businessLogicServes'

const file = path.join(process.cwd(), BUSINESS_LOGIC_README)
const src = servesSource()
const next = writeServesLines(fs.readFileSync(file, 'utf8'), src)
const errors = validateServesDoc(next, src)
if (errors.length > 0) {
  throw new Error(`generated README still fails the drift gate:\n${errors.join('\n')}`)
}
fs.writeFileSync(file, next)
console.log(
  `open-modules serves: wrote ${Object.keys(src.modules).length} Serves lines (${src.steps.length} step entries) into ${BUSINESS_LOGIC_README}`,
)
