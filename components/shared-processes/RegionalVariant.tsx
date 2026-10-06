'use client'

import { createContext, useContext, useId, useState, type ReactNode } from 'react'
import { GEO_COUNTRIES, GEO_PREF_META, type GeoCountry } from '@/lib/geoPreference'
import type { regionalDecision } from '@/lib/shared-processes/regions'

type Decision = ReturnType<typeof regionalDecision>
const RegionContext = createContext<{ decision: Decision; selected: string; select: (id: string) => void } | null>(null)

export function RegionalVariantProvider({ decision, children }: { decision: Decision; children: ReactNode }) {
  const [selected, select] = useState('default')
  return <RegionContext.Provider value={{ decision, selected, select }}>{children}</RegionContext.Provider>
}

export function useRegionalVariant() { return useContext(RegionContext) }

export function RegionalVariantSelector() {
  const state = useRegionalVariant()
  const id = useId()
  if (!state?.decision) return null
  const hasUnadaptedSteps = state.decision.options.find(option => option.id === state.selected)?.hasUnadaptedSteps === true
  const countryOrder = (countries: string[]) => Math.min(...countries.map(country => {
    const index = GEO_COUNTRIES.indexOf(country as GeoCountry)
    return index === -1 ? GEO_COUNTRIES.length : index
  }), GEO_COUNTRIES.length)
  const options = [...state.decision.options].sort((a, b) => a.id === 'default' ? -1 : b.id === 'default' ? 1 : countryOrder(a.countries) - countryOrder(b.countries))
  return <fieldset aria-describedby={`${id}-scope`} className="min-w-0 space-y-2">
    <legend className="mb-2 text-sm text-zinc-400">Select your country</legend>
    <div className="inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-full border border-zinc-800 p-1 sm:gap-1">
      {options.map(option => <label key={option.id} className="relative cursor-pointer">
        <input type="radio" name={id} value={option.id} aria-label={option.title} checked={state.selected === option.id} onChange={() => state.select(option.id)} className="peer sr-only" />
        <span className={`inline-flex min-h-9 items-center whitespace-nowrap rounded-full px-2 py-1 text-sm transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald-300 sm:px-3 ${state.selected === option.id ? 'bg-emerald-400/15 font-medium text-emerald-300 ring-1 ring-emerald-400/50' : 'text-zinc-400 hover:text-zinc-200'}`} title={option.title}>
          {option.countries.map(country => <span aria-hidden="true" key={country} className="mr-1">{GEO_PREF_META[country as GeoCountry]?.flag}</span>)}
          {option.countries.length ? option.countries.join(' / ') : option.id === 'default' ? 'Default' : option.title}
        </span>
      </label>)}
    </div>
    <p id={`${id}-scope`} className={hasUnadaptedSteps ? "text-sm text-zinc-400" : "sr-only"}><span className="sr-only">Changes “{state.decision.title}” only.</span>{hasUnadaptedSteps && ' Other steps have not been adapted to this region.'}</p>
  </fieldset>
}

export function RegionalDecisionTitle({ scope, title }: { scope: string; title: string }) {
  const state = useRegionalVariant()
  return <>{state?.decision?.scope === scope && state.selected !== 'default'
    ? state.decision.options.find(option => option.id === state.selected)?.title ?? title
    : title}</>
}

// Only the explicitly bound choice changes. Other decisions/nested graphs keep their UI.
export function RegionalStepAssessment({ scope, fallback, options }: { scope: string; fallback: ReactNode; options: Array<{ id: string; assessment: ReactNode }> }) {
  const state = useRegionalVariant()
  return <>{state?.decision?.scope === scope ? options.find(option => option.id === state.selected)?.assessment ?? fallback : fallback}</>
}

export function RegionalBaseResources({ scope, children }: { scope: string; children: ReactNode }) {
  const state = useRegionalVariant()
  // A selected route supplies its own scoped resources. Generic decision
  // references can include other jurisdictions and remain in the source record.
  return state?.decision?.scope === scope ? null : <>{children}</>
}

export function RegionalOptions({ scope, children }: { scope: string; children: ReactNode }) {
  const state = useRegionalVariant()
  const bound = state?.decision?.scope === scope
  return <div className={bound ? 'space-y-3' : 'divide-y divide-zinc-800/70 overflow-hidden rounded-xl border border-zinc-800'}>{children}</div>
}

export function RegionalOption({ scope, optionId, id, heading, children }: {
  scope: string; optionId: string; id: string; heading: ReactNode; children: ReactNode
}) {
  const state = useRegionalVariant()
  const bound = state?.decision?.scope === scope && state.decision.options.some(option => option.id === optionId)
  if (bound) return state.selected === optionId
    ? <div id={id} className="min-w-0 space-y-3">{children}</div>
    : null
  return <details id={id} open={optionId === 'default'} className="min-w-0 px-3 py-3 sm:px-4"><summary className="cursor-pointer break-words font-medium text-zinc-100">{heading}</summary><div className="mt-3 space-y-3">{children}</div></details>
}

// Qualify the existing scores without changing their calculation or ordering.
export function RegionalCoverageNote() {
  const state = useRegionalVariant()
  if (!state?.decision) return null
  return <p className="sr-only">Default-scope coverage{state.selected !== 'default' && ' · selected regional variant not assessed'}</p>
}
