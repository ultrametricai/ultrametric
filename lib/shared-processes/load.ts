import { loadProcessCatalog } from './catalog'

export function loadSharedProcesses(root = process.cwd()) {
  return loadProcessCatalog(undefined, root).processes.map(process => process.record).sort((a, b) => a.id.localeCompare(b.id))
}
