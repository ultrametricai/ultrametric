import { validateExecutionCoverage } from '../../lib/shared-processes/catalog'
import { writeFileSync } from 'node:fs'
import { loadSharedProcesses } from '../../lib/shared-processes/load'
import { loadSharedSchema, sharedSchemaJson } from '../../lib/shared-processes/json-schema'

const file = 'schemas/shared-process.schema.json'
if (process.argv.includes('--write-schema')) writeFileSync(file, sharedSchemaJson())
else loadSharedSchema()
const records = loadSharedProcesses()
validateExecutionCoverage(records)
console.log(`Validated ${records.length} shared records and their graph references.`)
