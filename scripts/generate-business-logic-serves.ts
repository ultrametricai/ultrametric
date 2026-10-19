// Regenerates the machine-owned Serves surfaces from open-processes/business-logic-map.json
// via lib/businessLogicServes.ts: the "**Serves:**" line in every module section of
// open-modules/README.md (mapped processes plus the per-step function entries), and the
// Serves cell of every row in the grouped module catalog tables (open-modules/README.md
// Module index and the root README's Open modules section). The prose around them is
// authored; only the Serves lines and cells are machine-owned. Drift gates:
// lib/__tests__/businessLogicServes.test.ts (the SITUATIONS.md pattern,
// scripts/generate-situations-md.ts).
//
// Usage: pnpm exec tsx scripts/generate-business-logic-serves.ts
import fs from 'node:fs'
import path from 'node:path'
import {
  BUSINESS_LOGIC_README, CATALOGS, servesSource, validateCatalogDoc, validateServesDoc,
  writeCatalogServesCells, writeServesLines,
} from '../lib/businessLogicServes'

const src = servesSource()

const readmePath = path.join(process.cwd(), BUSINESS_LOGIC_README)
const withLines = writeServesLines(fs.readFileSync(readmePath, 'utf8'), src)
const lineErrors = validateServesDoc(withLines, src)
if (lineErrors.length > 0) {
  throw new Error(`generated README still fails the Serves-line drift gate:\n${lineErrors.join('\n')}`)
}
fs.writeFileSync(readmePath, withLines)

for (const opts of CATALOGS) {
  const file = path.join(process.cwd(), opts.file)
  const next = writeCatalogServesCells(fs.readFileSync(file, 'utf8'), src, opts)
  const errors = validateCatalogDoc(next, src, opts)
  if (errors.length > 0) {
    throw new Error(`generated ${opts.file} still fails the catalog drift gate:\n${errors.join('\n')}`)
  }
  fs.writeFileSync(file, next)
}

console.log(
  `open-modules serves: wrote ${Object.keys(src.modules).length} Serves lines (${src.steps.length} step entries) into ${BUSINESS_LOGIC_README}, plus the catalog Serves cells in ${CATALOGS.map((c) => c.file).join(' and ')}`,
)
