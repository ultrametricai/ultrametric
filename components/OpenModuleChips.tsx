import type { OpenModuleChip } from '@/lib/businessLogicMap'
import { processMetadataLabel, processMetadataLink } from './processMetadataStyles'

export default function OpenModuleChips({ modules }: { modules: OpenModuleChip[] }) {
  if (!modules.length) return null
  return <p className="mt-3 flex max-w-2xl flex-wrap items-center gap-1.5 text-sm text-zinc-500">
    <span className={processMetadataLabel} title="The open modules (open-source lib/openstartup/ code in the repo) whose cited, tested math serves this process — cap tables, deadlines, tax mechanics, and friends. Each chip opens the module's documentation.">Open modules:</span>
    {modules.map(module => <a key={module.id} href={module.href} target="_blank" rel="noopener noreferrer" className={processMetadataLink}>{module.label} ↗</a>)}
  </p>
}
