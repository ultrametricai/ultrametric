import fs from 'node:fs'
import { z } from 'zod'
import { completenessScopeSchema, inventoryCrosscheckSchema, localAssessmentsSchema, coverageCasesSchema } from '../lib/processCoverage'

const schemas = { 'completeness-scope': completenessScopeSchema, 'inventory-crosscheck': inventoryCrosscheckSchema, 'local-procedure-assessments': localAssessmentsSchema, 'coverage-scenarios': coverageCasesSchema }
if (process.argv.includes('--write-schemas')) {
  for (const [name, schema] of Object.entries(schemas)) fs.writeFileSync(`schemas/${name}.schema.json`, JSON.stringify(z.toJSONSchema(schema), null, 2) + '\n')
} else throw new Error('The coverage generator is being implemented; use --write-schemas for contracts')
