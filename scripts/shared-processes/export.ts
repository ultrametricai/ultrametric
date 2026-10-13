import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { loadSharedProcesses } from '../../lib/shared-processes/load'
import { validateCatalog } from '../../lib/shared-processes/schema'
import { loadSharedSchema } from '../../lib/shared-processes/json-schema'

const { values } = parseArgs({ options: { output: { type: 'string' }, example: { type: 'boolean', default: false } } })
if (!values.output) throw new Error('Use --output <catalog.json>')
const tracked = ['processes/records', 'schemas/shared-process.schema.json', 'lib/shared-processes', 'processes/examples', 'scripts/shared-processes/export.ts']
const dirty = execFileSync('git', ['status', '--porcelain', '--', ...tracked], { encoding: 'utf8' })
if (dirty.trim()) throw new Error('Commit the shared records and schema before exporting a pinned catalog')
const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const schema = loadSharedSchema()
const records = values.example
  ? validateCatalog(JSON.parse(readFileSync('processes/examples/staging.json', 'utf8')))
  : loadSharedProcesses()
const payload = { schema, records }
const content = JSON.stringify(payload)
const artifact = { format: 1, sourceRevision, sha256: createHash('sha256').update(content).digest('hex'), ...payload }
writeFileSync(values.output, JSON.stringify(artifact, null, 2) + '\n')
console.log(`Exported ${records.length} records at ${sourceRevision}.`)
