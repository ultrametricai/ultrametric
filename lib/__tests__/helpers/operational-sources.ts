import { loadProcessCatalog } from '../../shared-processes/catalog'
import { projectOperational } from '../../shared-processes/projection'

// Preserve the complete authored input for integrity assertions: no operational
// schema defaults, stripped unknown fields, or filtering of conditional nodes.
export function operationalSources(root = process.cwd()): unknown[] {
  const catalog = loadProcessCatalog(undefined, root).processes
  return catalog.map(process => projectOperational(process, catalog)).filter(value => value !== null)
}
