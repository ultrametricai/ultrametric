'use client'

import { useId, useState } from 'react'
import type { ProcessProviderChoice, ProviderGroup } from '@/lib/shared-processes/provider-choice'
import { useRegionalVariant } from './RegionalVariant'
import ScoredProductRow from './ScoredProductRow'
import { useVendorSelection } from './VendorSelection'

export function ProviderChoice({ choice }: { choice: ProviderGroup }) {
  const [expanded, setExpanded] = useState(false)
  const id = useId()
  const selection = useVendorSelection()
  const region = useRegionalVariant()
  const foreign = !!region?.decision && region.selected !== 'default'
  const selected = choice.candidates.find(candidate => candidate.id === selection?.picks[choice.scope])
  const ordered = selected ? [selected, ...choice.candidates.filter(candidate => candidate !== selected)] : choice.candidates
  const remaining = Math.max(0, ordered.length - 3)
  return <section aria-labelledby={`${id}-heading`} className="space-y-3">
    <h3 id={`${id}-heading`} className="text-base font-medium text-zinc-100">{choice.title}</h3>
    <div className="overflow-hidden rounded-2xl border border-zinc-800">
      <ul id={id}>{ordered.map((candidate, index) => {
        const coverage = choice.scores[candidate.id]
        return <ScoredProductRow showScore={!foreign} scores={choice.candidates.map(item => choice.scores[item.id].score)} key={candidate.id} product={{ productId: candidate.logoId ?? candidate.id.split('/').at(-1)!, name: candidate.name, href: candidate.href!, hasLogo: !!candidate.logoId, score: coverage.score }} selected={candidate === selected} onSelect={selection ? () => selection.toggle(choice.scope, candidate.id) : undefined} hidden={!expanded && index >= 3} selectionLabel={`Use ${candidate.name}`} evidenceLabel="process coverage" scoreTitle={`${coverage.score}/100 across ${choice.stepCount} rated default-scope ${choice.title} steps`}>
          <p>Assessed on {coverage.assessedSteps} of {choice.stepCount} rated default-scope steps in {choice.title}. Score is the sum of assessed step scores divided by {choice.stepCount}; unassessed steps contribute nothing. Other categories and unrated steps are outside this score.</p>
          <ul className="space-y-2">{coverage.steps.map(step => <li key={step.scope} className="flex items-start justify-between gap-4"><span className="min-w-0 break-words">{step.title}</span><span className="shrink-0 font-mono tabular-nums">{step.score === null ? 'No assessment' : `${step.score.toFixed(1)}/100`}</span></li>)}</ul>
        </ScoredProductRow>
      })}</ul>
      {remaining > 0 && <button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)} className="w-full border-t border-zinc-800/70 px-4 py-2.5 text-center text-xs text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200">{expanded ? 'Show fewer' : `+ ${remaining} more`}</button>}
    </div>
  </section>
}

export default function ProcessProviderSelector({ choice }: { choice: ProcessProviderChoice }) {
  const groups = choice.groups.filter(group => !group.partScope)
  if (!groups.length) return null
  return <section aria-label="Process providers" className="space-y-5">
    <div><h2 className="text-xl font-medium text-zinc-100">Process providers</h2></div>
    <div className={`grid gap-5 md:grid-cols-2 ${groups.length > 2 ? 'xl:grid-cols-3' : ''}`}>{groups.map(group => <ProviderChoice key={group.scope} choice={group} />)}</div>
  </section>
}
