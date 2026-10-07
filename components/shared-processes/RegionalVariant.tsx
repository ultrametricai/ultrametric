'use client'

import { createContext, useCallback, useContext, useId, useState, type ReactNode } from 'react'
import { GEO_COUNTRIES, GEO_PREF_META, GEO_GLOBAL, GEO_GLOBAL_META, parseGeoChoice, type GeoChoice, type GeoSelection, type GeoAnalogNote } from '@/lib/geoPreference'
import { regionForGeo } from '@/lib/shared-processes/compatibility'
import { markProcessScopeHydrated } from '@/lib/shared-processes/open-target'
import type { regionalDecision } from '@/lib/shared-processes/regions'

type Decision = ReturnType<typeof regionalDecision>
const RegionContext = createContext<{
  decision: Decision; selected: string; country: GeoChoice | null; revision: number
  select: (id: string) => void; selectCountry: (country: GeoChoice | null) => void
  restore: (id: string, country: GeoChoice | null) => void
} | null>(null)

export function RegionalVariantProvider({ decision, children }: { decision: Decision; children: ReactNode }) {
  const [state, setState] = useState({ selected: 'default', country: null as GeoChoice | null, revision: 0 })
  const restore = useCallback((selected: string, country: GeoChoice | null) => setState({ selected, country, revision: 0 }), [])
  const selectCountry = (country: GeoChoice | null) => setState(current => ({
    selected: regionForGeo(decision, country ?? 'US').region ?? 'default', country, revision: current.revision + 1,
  }))
  const select = (id: string) => {
    const raw = decision?.options.find(option => option.id === id)?.countries[0]
    setState(current => ({ selected: id, country: parseGeoChoice(raw ?? null), revision: current.revision + 1 }))
  }
  return <RegionContext.Provider value={{ decision, ...state, select, selectCountry, restore }}>{children}</RegionContext.Provider>
}

export function useRegionalVariant() { return useContext(RegionContext) }

export function RegionalVariantSelector() {
  const state = useRegionalVariant()
  const id = useId()
  if (!state) return null
  const hasUnadaptedSteps = state.decision?.options.find(option => option.id === state.selected)?.hasUnadaptedSteps === true
  const countries: Array<GeoChoice | null> = [null, ...GEO_COUNTRIES.filter((country): country is GeoSelection => country !== 'US'), GEO_GLOBAL]
  return <fieldset aria-describedby={`${id}-scope`} className="min-w-0 space-y-2">
    <legend className="mb-2 text-sm text-zinc-400">Select your country</legend>
    <div className="inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-full border border-zinc-800 p-1 sm:gap-1">
      {countries.map(country => {
        const meta = country === GEO_GLOBAL ? GEO_GLOBAL_META : GEO_PREF_META[country ?? 'US']
        const option = state.decision?.options.find(option => option.countries.includes(country ?? 'US'))
        const value = country === null ? 'default' : option && option.countries[0] === country ? option.id : country
        return <label key={country ?? 'US'} className="relative cursor-pointer">
          <input type="radio" name={id} value={value} aria-label={option && option.countries[0] === country ? option.title : meta.label} checked={state.country === country} onChange={() => state.selectCountry(country)} className="peer sr-only" />
          <span className={`inline-flex min-h-9 items-center whitespace-nowrap rounded-full px-2 py-1 text-sm transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald-300 sm:px-3 ${state.country === country ? 'bg-emerald-400/15 font-medium text-emerald-300 ring-1 ring-emerald-400/50' : 'text-zinc-400 hover:text-zinc-200'}`} title={meta.label}>
            <span aria-hidden="true" className="mr-1">{meta.flag}</span>{country === GEO_GLOBAL ? 'Global' : country ?? 'US'}
          </span>
        </label>
      })}
    </div>
    <p id={`${id}-scope`} className={hasUnadaptedSteps ? "text-sm text-zinc-400" : "sr-only"}>Country context changes only explicitly authored regional steps.{hasUnadaptedSteps && ' Other steps have not been adapted to this region.'}</p>
  </fieldset>
}

export function CountryContext({ notes, geoScope }: { notes: GeoAnalogNote[]; geoScope?: string }) {
  const state = useRegionalVariant()
  const country = state?.country
  const note = notes.find(note => note.country === country)
  const foreign = country && country !== GEO_GLOBAL
  const authored = !!state?.decision && state.selected !== 'default'
  return <div className="space-y-3 text-sm text-zinc-400">
    {foreign && <div data-country-context className="max-w-3xl space-y-2">
      {note && <p><span className="font-medium text-zinc-300">{GEO_PREF_META[country].label}: </span>{note.summary}</p>}
      {!note && geoScope && geoScope !== 'global' && <p>No country note is available for {GEO_PREF_META[country].label}.</p>}
      {!authored && geoScope && geoScope !== 'global' && <p>The steps below retain their default scope. A country note does not provide an authored regional execution variant.</p>}
    </div>}
    {notes.length > 0 && <details id="outside-the-us" className="scroll-mt-6">
      <summary className="cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-zinc-300">Country notes ({notes.length})</summary>
      <div className="mt-3 space-y-4">{notes.map(note => <div key={note.country} data-country-note={note.country} className="max-w-3xl space-y-1">
        <h2 className="font-medium text-zinc-300">{GEO_PREF_META[note.country].label}</h2>
        <p>{note.summary}</p>
        <a href={note.actionUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-300 underline decoration-zinc-700 underline-offset-2">{note.actionLabel}</a>
      </div>)}</div>
    </details>}
  </div>
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
    ? <div id={id} data-process-scope ref={markProcessScopeHydrated} className="min-w-0 space-y-3">{children}</div>
    : null
  return <details id={id} data-process-scope ref={markProcessScopeHydrated} open={optionId === 'default'} className="min-w-0 px-3 py-3 sm:px-4"><summary className="cursor-pointer break-words font-medium text-zinc-100">{heading}</summary><div className="mt-3 space-y-3">{children}</div></details>
}

// Qualify the existing scores without changing their calculation or ordering.
export function RegionalCoverageNote() {
  const state = useRegionalVariant()
  if (!state?.decision) return null
  return <p className="sr-only">Default-scope coverage{state.selected !== 'default' && ' · selected regional variant not assessed'}</p>
}
