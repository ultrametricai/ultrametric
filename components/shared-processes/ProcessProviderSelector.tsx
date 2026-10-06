'use client'

import { useId } from 'react'
import type { ProcessProviderChoice, ProviderGroup } from '@/lib/shared-processes/provider-choice'
import { openProcessTarget } from '@/lib/shared-processes/open-target'
import { useRegionalVariant } from './RegionalVariant'
import ScoredProductRow from './ScoredProductRow'
import { useVendorSelection } from './VendorSelection'

export function ProviderChoice({ choice }: { choice: ProviderGroup }) {
  const id = useId()
  const selection = useVendorSelection()
  const region = useRegionalVariant()
  const foreign = !!region?.decision && region.selected !== 'default'
  const hiddenScopes = region?.decision?.options.find(option => option.id === region.selected)?.hiddenScopes ?? []
  const targetIsRendered = (target: string) => !hiddenScopes.some(scope => target === scope || target.startsWith(`${scope}:`))
  const selected = choice.candidates.find(candidate => candidate.id === selection?.picks[choice.scope])
  const ordered = selected ? [selected, ...choice.candidates.filter(candidate => candidate !== selected)] : choice.candidates
  return <section aria-labelledby={`${id}-heading`} className="space-y-3">
    <h3 id={`${id}-heading`} className="text-base font-medium text-zinc-100">{choice.title}</h3>
    <div className="overflow-hidden rounded-2xl border border-zinc-800">
      <ul id={id}>{ordered.map((candidate) => {
        const coverage = choice.scores[candidate.id]
        return <ScoredProductRow scoreHref={coverage.evidenceHref} showScore={!foreign} scores={choice.candidates.map(item => choice.scores[item.id].score)} key={candidate.id} product={{ productId: candidate.logoId ?? candidate.id.split('/').at(-1)!, name: candidate.name, href: candidate.href!, hasLogo: !!candidate.logoId, score: coverage.score }} selected={candidate === selected} onSelect={selection ? () => selection.toggle(choice.scope, candidate.id) : undefined} selectionLabel={`Use ${candidate.name}`} evidenceLabel="process coverage" scoreTitle={`${coverage.score}/100 across ${choice.stepCount} rated default-scope ${choice.title} steps`}>
          {foreign && <p>Default-scope evidence; the selected country is not assessed.</p>}
          <ul aria-label={`${choice.title} default-scope step scores`} className="space-y-2">{coverage.steps.map(step => <li key={step.scope} className="flex items-start justify-between gap-4">
            {targetIsRendered(step.scope)
              ? <a href={`#${encodeURIComponent(step.scope)}`} onClick={() => openProcessTarget(step.scope)} className="min-w-0 break-words underline underline-offset-4 hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-300">{step.title}</a>
              : <span className="min-w-0 break-words">{step.title}</span>}
            {step.score === null ? <span className="shrink-0 font-mono tabular-nums">No assessment</span> : step.evidenceHref ? <a href={step.evidenceHref} aria-label={`${candidate.name}: ${step.title} coverage ${step.score.toFixed(1)}/100 — vendor evidence`} className="shrink-0 font-mono tabular-nums underline underline-offset-4 hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-300">{step.score.toFixed(1)}/100</a> : <span className="shrink-0 font-mono tabular-nums">{step.score.toFixed(1)}/100</span>}
          </li>)}</ul>
        </ScoredProductRow>
      })}</ul>
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
