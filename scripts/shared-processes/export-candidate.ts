import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { loadProcessCatalog } from '../../lib/shared-processes/catalog'
import { loadSharedSchema } from '../../lib/shared-processes/json-schema'
import { recordForInstructions } from '../../lib/shared-processes/instructions'

const { values } = parseArgs({ options: { output: { type: 'string' }, lock: { type: 'string' }, process: { type: 'string', multiple: true } } })
if (!values.output || !values.lock) throw new Error('Use --output <catalog.json> --lock <candidate.lock>')
const processes = loadProcessCatalog(values.process ? { processes: values.process } : undefined).processes.map(process => ({ ...process, record: recordForInstructions(process.record) }))
if (!processes.length) throw new Error('The candidate catalog is empty')
const paths = [...(values.process ? [] : ['open-processes/catalog.json']), 'lib/execution.ts', 'lib/shared-processes/catalog.ts', 'lib/shared-processes/schema.ts', 'lib/shared-processes/json-schema.ts', 'lib/shared-processes/instructions.ts', 'scripts/shared-processes/export-candidate.ts', 'schemas/shared-process.schema.json',
  ...processes.map(process => `open-processes/${process.slug}.json`)]
if (execFileSync('git', ['status', '--porcelain', '--', ...paths], { encoding: 'utf8' }).trim()) {
  throw new Error('Commit candidate source before exporting')
}
const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
const payload = { schema: loadSharedSchema(), processes }
const sha256 = digest(JSON.stringify(payload))
writeFileSync(values.output, JSON.stringify({ format: 2, channel: 'candidate', sourceRevision, sha256, ...payload }, null, 2) + '\n')
const files = execFileSync('git', ['ls-files', '-z', '--', ...paths.filter(file => file.endsWith('.json'))], { encoding: 'utf8' }).split('\0').filter(Boolean).sort()
writeFileSync(values.lock, JSON.stringify({ repository: 'ultrametricai/ultrametric', sourceRevision, sha256,
  files: files.map(file => ({ path: file, sha256: digest(readFileSync(file)) })) }, null, 2) + '\n')
console.log(`Exported ${processes.length} candidate processes at ${sourceRevision}`)
