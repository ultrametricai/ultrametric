import type { ReactNode } from 'react'
import { resolveServiceCandidates } from '@/lib/shared-processes/service-candidates'
import type { Reference } from '@/lib/shared-processes/schema'
import type { VendorCoverage, CapabilityEvidence } from '@/lib/shared-processes/vendor-preview'
import ServiceCandidateRows from './ServiceCandidateRows'

export default function ServiceCandidates({ references, separated = false, choiceScope, parentChoiceScope, coverage, evidence, details, excludeIds = [] }: { references: Reference[]; details?: Record<string, ReactNode>; separated?: boolean; choiceScope?: string; parentChoiceScope?: string; evidence?: Record<string, CapabilityEvidence[]>; coverage?: Record<string, VendorCoverage>; excludeIds?: string[] }) {
  const candidates = resolveServiceCandidates(references).filter(candidate => !excludeIds.includes(candidate.id))
  if (coverage) candidates.sort((a, b) => (coverage[b.id]?.score ?? -1) - (coverage[a.id]?.score ?? -1))
  if (!candidates.length) return null
  return <div className={separated ? 'border-t border-zinc-800/50 pt-3' : undefined}>
    {excludeIds.length > 0 && <p className="mb-2 text-xs text-zinc-400">Other listed options</p>}
    <ServiceCandidateRows candidates={candidates} choiceScope={choiceScope} parentChoiceScope={parentChoiceScope} coverage={coverage} evidence={evidence} details={details} />
  </div>
}
