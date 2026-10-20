import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { loadProcessCatalog } from '../../lib/shared-processes/catalog'
import { projectJurisdiction } from '../../lib/shared-processes/projection'

const { processes } = loadProcessCatalog()
const write = process.argv.includes('--write')
for (const retired of ['open-processes/corpus.json', 'open-processes/chains.json']) {
  if (existsSync(retired)) throw new Error(`${retired}: retired projection; read canonical definitions through lib/processes.ts`)
}
const files = new Map<string, unknown>()
for (const item of processes) {
  const workflow = projectJurisdiction(item)
  if (workflow) files.set(`open-processes/equity/us-de/${item.record.id.split('.').at(-1)}.json`, workflow)
}
for (const [file, value] of files) {
  const expected = JSON.stringify(value, null, 2) + '\n'
  if (write) writeFileSync(file, expected)
  else if (readFileSync(file, 'utf8') !== expected) throw new Error(`${file}: regenerate with pnpm shared:project`)
}
console.log(`Checked ${files.size} compatibility projections from ${processes.length} canonical definitions.`)
