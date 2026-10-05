'use client'

import type { SharedRecord } from '@/lib/shared-processes/schema'
import CeilingBar from '@/components/CeilingBar'
import { processSummary } from '@/lib/shared-processes/summary'
import { useRegionalVariant } from './RegionalVariant'
export { processSummary } from '@/lib/shared-processes/summary'

export default function ProcessSummary({ record, records = [] }: { record: SharedRecord; records?: SharedRecord[] }) {
  const summary = processSummary(record, records)
  const region = useRegionalVariant()
  // A regional option is not a verified whole-process path. Do not sum its
  // alternatives or imply the downstream legacy route classifications apply.
  if (region?.decision && region.selected !== 'default') return null
  if (summary.agentCeiling === null) return null
  return <dl aria-label="Process summary" className="mt-6 flex flex-wrap gap-x-6 gap-y-3" title="Existing default-path route classifications, not verified tool integrations. Conditional add-ons and alternative branches are not counted.">
    <div className="flex items-center gap-2"><dd><CeilingBar pct={summary.agentCeiling} readable label={`${summary.agentCeiling}% agentic ceiling from default-path route classifications; execution bindings are not verified`} /></dd><dt className="text-sm text-zinc-400">Agentic ceiling</dt></div>
  </dl>
}
