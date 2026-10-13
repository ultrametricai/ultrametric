import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { validateCatalog } from './schema'

export function loadSharedProcesses(root = process.cwd()) {
  const directory = path.join(root, 'processes/records')
  const records = readdirSync(directory).filter(name => name.endsWith('.json')).sort()
    .map(name => JSON.parse(readFileSync(path.join(directory, name), 'utf8')))
  return validateCatalog(records)
}
