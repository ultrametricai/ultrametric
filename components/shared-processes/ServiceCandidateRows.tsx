'use client'

import { useId, type ReactNode } from 'react'
import type { ServiceCandidate } from '@/lib/shared-processes/service-candidates'
import type { CapabilityEvidence, VendorCoverage } from '@/lib/shared-processes/vendor-preview'
import ScoredProductRow from './ScoredProductRow'
import { vendorEvidenceHref } from '@/lib/shared-processes/coverage-links'
import { useRegionalVariant } from './RegionalVariant'
import { selectedVendor, useVendorSelection } from './VendorSelection'

export default function ServiceCandidateRows({ candidates, choiceScope, parentChoiceScope, coverage, evidence, details }: {
  candidates: ServiceCandidate[]; details?: Record<string, ReactNode>; choiceScope?: string; parentChoiceScope?: string; coverage?: Record<string, VendorCoverage>; evidence?: Record<string, CapabilityEvidence[]>
}) {
  const assessmentId = useId()
  const selection = useVendorSelection()
  const region = useRegionalVariant()
  const foreign = !!region?.decision && region.selected !== 'default'
  const overrideScope = choiceScope && foreign ? `${choiceScope}:regional:${region!.decision!.scope}:${region!.selected}` : choiceScope
  const hasOverride = !!parentChoiceScope && !!overrideScope && !!selection && Object.hasOwn(selection.overrides, overrideScope)
  const selectedId = hasOverride ? selection!.overrides[overrideScope!] : choiceScope ? selectedVendor(selection, choiceScope, foreign ? undefined : parentChoiceScope) : undefined
  const selected = candidates.find(candidate => candidate.id === selectedId)
  const ordered = selected ? [selected, ...candidates.filter(candidate => candidate !== selected)] : candidates
  const visibleCoverage = (id: string) => {
    const value = coverage?.[id]
    return foreign && `${region?.decision?.scope}:default` === value?.scope ? undefined : value
  }
  const informational = !choiceScope && candidates.every(candidate => !visibleCoverage(candidate.id) && (foreign || !details?.[candidate.id]))
  return <>
    {informational && <p id={assessmentId} className="mb-3 text-base text-zinc-400">These options have not been assessed for this step.</p>}
    {!informational && !foreign && coverage && Object.keys(coverage).length > 0 && <p className="mb-2 text-sm text-zinc-400" title="Weighted coverage of the default filing step’s mapped stories, including manual workflows and APIs; not an automation probability or a whole-process score.">Filing coverage · /100</p>}
    <ul aria-label="Service options" aria-describedby={informational ? assessmentId : undefined} className="overflow-hidden rounded-2xl border border-zinc-800">
      {ordered.map(candidate => {
        const assessment = visibleCoverage(candidate.id)
        const providerDetail = foreign ? undefined : details?.[candidate.id]
        const detail = assessment && evidence?.[assessment.scope]?.find(item => item.candidateId === candidate.id)
        const scores = candidates.flatMap(item => {
          const value = visibleCoverage(item.id)
          return value && value.scope === assessment?.scope ? [value.score] : []
        })
        return <ScoredProductRow key={candidate.id} showScore={!informational} reserveControls={!informational}
          product={{ productId: candidate.logoId ?? candidate.id, name: candidate.name, href: candidate.href, hasLogo: candidate.logoId !== null, score: assessment?.score ?? null }}
          profileLabel={`${candidate.name} profile`} selected={candidate.id === selectedId} inherited={!!parentChoiceScope && !hasOverride && !foreign}
          onSelect={choiceScope && selection ? () => parentChoiceScope && overrideScope
            ? selection.override(overrideScope, candidate.id === selectedId ? null : candidate.id)
            : selection.toggle(choiceScope, candidate.id) : undefined}
          selectionLabel={`Use ${candidate.name}`} evidenceLabel="story evidence" scores={scores}
          scoreHref={detail ? vendorEvidenceHref(detail.href, detail.stories.map(story => story.id)) : undefined}
          scoreTitle={assessment ? `Filing story coverage ${assessment.score}/100 across ${assessment.storyCount} mapped stories for the default filing option.` : ''}>
          {(providerDetail || detail) ? <>{providerDetail}{detail && <ul className="space-y-2">{detail.stories.map(story => <li key={story.id}><a href={`${detail.href}#story-${story.id}`} className="rounded-sm text-zinc-300 hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-zinc-300">{story.title}</a><span className="ml-2">{story.verdict} · {story.quality}/10 · weight {story.weight}</span></li>)}</ul>}</> : undefined}
        </ScoredProductRow>
      })}
    </ul>
    {hasOverride && !foreign && <button type="button" onClick={() => selection?.override(overrideScope!, undefined)} className="text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-200">Use process choice</button>}
  </>
}
