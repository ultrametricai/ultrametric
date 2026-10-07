'use client'

import Link from 'next/link'
import { useEffect, useSyncExternalStore } from 'react'
import ProductLogoView from '@/components/ProductLogoView'
import { GEO_PREF_META, getGeoSelection, subscribeGeoSelection } from '@/lib/geoPreference'
import { formatMinutes } from '@/lib/processSim'
import {
  DEFAULT_METHOD_ID, methodSelection, setMethodSelection, subscribeMethodSelections,
  type StepMethodChipView, type StepMethodSubStepView, type StepMethodView, type StepRoute,
} from '@/lib/stepMethods'

// The geo-resolved method variant of one method-bearing DAG step (founder 2026-10-05: the
// visible per-step "method: Default ▾ N ways" picker — this file's previous life as
// StepMethodPicker — is gone; the country choice resolves the variant silently). The
// method-variant DATA is untouched (lib/stepMethodData.ts still builds every view; per-country
// filing routes are corpus truth): while a non-US country is selected in the shared geo store
// (lib/geoPreference.ts), the geo method covering that country auto-selects — this panel shows
// its route/vendors/calls/time and sub-DAG, and the step's default-method content hides
// (components/StepMethodDefault.tsx shares the selection store). Clearing the country (or
// picking one no method covers) restores the default. Situational and vendor method variants
// stay corpus/manifest data with no on-page affordance — a deliberate founder tradeoff, not a
// data loss.
//
// Honesty: every committed number on the page keeps describing the DEFAULT method (the static
// HTML renders it byte-identically). A variant's recomputed process ceiling — precomputed
// server-side with the same computeCeiling math (lib/stepMethodData.ts) — renders explicitly
// labelled "with this method", with the default alongside (the JurisdictionToggle precedent).

// Client-side copy of ProcessDag's route visual language (that module is server-only: node:fs).
const ROUTE_BADGE: Record<StepRoute, { cls: string; label: string }> = {
  agent: { cls: 'bg-emerald-400/10 text-emerald-300', label: 'agent' },
  form: { cls: 'bg-amber-400/10 text-amber-300', label: 'manual form' },
  person: { cls: 'bg-sky-400/10 text-sky-300', label: 'human or computer use' },
}
const SIGNATURE_BADGE = { cls: 'bg-violet-400/10 text-violet-300', label: '✍ signature — legally human' }
const ROUTE_BLOCK: Record<StepRoute, string> = {
  agent: 'border-emerald-400/40 bg-emerald-400/[0.06]',
  form: 'border-amber-400/40 bg-amber-400/[0.05]',
  person: 'border-sky-400/40 bg-sky-400/[0.05]',
}

// One vendor chip, the client-safe mirror of ProcessDag's VendorChip: tracked vendors link to
// our judged product page; untracked ones render as honest unlinked chips.
function MethodChip({ chip }: { chip: StepMethodChipView }) {
  const body = (
    <>
      <ProductLogoView product={{ id: chip.productId ?? chip.vendor, name: chip.label }} size={28} hasLogo={chip.hasLogo} />
      <span className="truncate">{chip.label}</span>
      {chip.agentReady !== null && (
        <span className="font-mono text-[10px] tabular-nums text-emerald-400/80">{chip.agentReady.toFixed(0)}<span className="text-zinc-500">/100</span></span>
      )}
    </>
  )
  if (chip.productId && chip.arenaId) {
    return (
      <Link
        href={`/arena/${chip.arenaId}/product/${chip.productId}`}
        title={`${chip.label} — #${chip.rank} by agent-readiness in ${chip.arenaName ?? chip.arenaId} — see the judged product page`}
        className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900/60 py-0.5 pl-0.5 pr-2 text-zinc-200 transition hover:border-emerald-400/60 hover:text-emerald-300"
      >
        {body}
      </Link>
    )
  }
  return (
    <span
      title={`${chip.label} — not yet judged on Ultrametric`}
      className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 py-0.5 pl-0.5 pr-2 text-zinc-400"
    >
      {body}
    </span>
  )
}

// The variant's mini sub-DAG: an indented, route-coded 2–5-step flow (corpus-committed, never
// nested further) — the compact analog of the main diagram's block spine.
function SubStepFlow({ subSteps }: { subSteps: StepMethodSubStepView[] }) {
  return (
    <ol className="mt-2 space-y-1.5 border-l border-zinc-700/80 pl-3">
      {subSteps.map((s, i) => {
        const badge = s.legalSignature ? SIGNATURE_BADGE : ROUTE_BADGE[s.route]
        return (
          <li key={s.id} className={`rounded-md border p-2 ${ROUTE_BLOCK[s.route]}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-xs font-medium text-zinc-100">
                <span className="mr-1.5 font-mono text-[10px] tabular-nums text-zinc-500">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {s.label}
              </p>
              <span className={`mt-px shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${badge.cls}`}>
                {badge.label}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
              <span>{formatMinutes(s.estimatedMinutes)}</span>
              {s.async && <span title="Async — waits on a third party">⏳ async</span>}
              {s.actionUrl && (
                <a
                  href={s.actionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-400 underline decoration-zinc-700 underline-offset-2 transition hover:text-emerald-300"
                >
                  {s.actionLabel ?? 'do it yourself'} ↗
                </a>
              )}
              {s.chips.map((c) => (
                <MethodChip key={c.vendor} chip={c} />
              ))}
            </div>
            {s.calls.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {s.calls.map((call) => (
                  <li key={call} className="truncate font-mono text-[10px] text-zinc-500">{call}</li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export default function StepMethodGeo({
  nodeKey,
  defaultView,
  methods,
}: {
  nodeKey: string
  defaultView: StepMethodView
  methods: StepMethodView[]
}) {
  const selectedId = useSyncExternalStore(
    subscribeMethodSelections,
    () => methodSelection(nodeKey),
    () => DEFAULT_METHOD_ID,
  )

  // The one selection writer left: follow the shared geo store. The header country control
  // (components/HeaderGeoControl.tsx) seeds the
  // store from ?geo=/localStorage on THEIR mount; the subscription catches that seed regardless
  // of mount order. Global reads as geo-neutral (getGeoSelection maps it to null) — the default.
  useEffect(() => {
    const sync = () => {
      const geo = getGeoSelection()
      const hit = geo
        ? methods.find((m) => m.context?.kind === 'geo' && m.context.countries.includes(geo))
        : undefined
      setMethodSelection(nodeKey, hit ? hit.id : DEFAULT_METHOD_ID)
    }
    sync()
    return subscribeGeoSelection(sync)
  }, [nodeKey, methods])

  const selected = methods.find((m) => m.id === selectedId) ?? null
  // No country-resolved variant → the default-method content carries the step; this component
  // renders nothing (the static HTML is byte-identical to a method-less step's).
  if (!selected) return null

  const badge = ROUTE_BADGE[selected.route]
  return (
    <div className="mt-2 rounded-lg border border-zinc-700/80 bg-zinc-900/40 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-xs font-medium text-zinc-100">{selected.label}</p>
        <span className={`mt-px shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.cls}`}>
          {badge.label}
        </span>
      </div>
      {selected.context && (
        <p className="mt-1 text-[11px] text-zinc-500">
          <span className="text-[10px] uppercase tracking-wide">when:</span>{' '}
          {selected.context.kind === 'geo' && (
            <span aria-hidden className="mr-1">
              {selected.context.countries.map((c) => GEO_PREF_META[c].flag).join(' ')}
            </span>
          )}
          {selected.context.when}
        </p>
      )}
      {selected.summary && <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{selected.summary}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
        {selected.estimatedMinutes !== null && (
          <span title="Honest time only: committed in the corpus or derived from the sub-steps — never invented">
            ~{formatMinutes(selected.estimatedMinutes)}
          </span>
        )}
        {selected.actionUrl && (
          <a
            href={selected.actionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-zinc-700/80 px-1.5 py-0.5 text-[10px] text-zinc-300 transition hover:border-emerald-400/60 hover:text-emerald-300"
          >
            do it yourself: {selected.actionLabel ?? selected.actionUrl} ↗
          </a>
        )}
        {selected.chips.map((c) => (
          <MethodChip key={c.vendor} chip={c} />
        ))}
      </div>
      {selected.calls.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 border-l border-zinc-800 pl-3">
          {selected.calls.map((call) => (
            <li key={call} className="truncate font-mono text-[11px] text-zinc-400">{call}</li>
          ))}
        </ul>
      )}
      {selected.subSteps.length > 0 && <SubStepFlow subSteps={selected.subSteps} />}
      {selected.ceiling && defaultView.ceiling && (
        <p className="mt-2 text-[11px] text-zinc-400">
          Agentic % with this method:{' '}
          <span className="font-medium text-emerald-300">{selected.ceiling.pct}%</span>{' '}
          <span className="text-zinc-500">
            — an agent can run {selected.ceiling.agentSteps} of {selected.ceiling.totalSteps} steps
            (default method: {defaultView.ceiling.pct}%, {defaultView.ceiling.agentSteps} of{' '}
            {defaultView.ceiling.totalSteps}). Every committed number on this page describes the default.
          </span>
        </p>
      )}
    </div>
  )
}
