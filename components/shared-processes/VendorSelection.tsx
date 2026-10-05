'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import Link from 'next/link'
import type { CapabilityEvidence } from '@/lib/shared-processes/vendor-preview'

const VendorContext = createContext<{
  picks: Record<string, string>
  overrides: Record<string, string | null>
  override: (scope: string, candidateId: string | null | undefined) => void
  toggle: (scope: string, candidateId: string) => void
} | null>(null)

// Deliberately transient: no account stack, storage, URL parameters, or source writes.
export function VendorSelectionProvider({ children }: { children: ReactNode }) {
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [overrides, setOverrides] = useState<Record<string, string | null>>({})
  return <VendorContext.Provider value={{ picks, overrides, override: (scope, candidateId) => setOverrides(current => {
    const next = { ...current }
    if (candidateId === undefined) delete next[scope]
    else next[scope] = candidateId
    return next
  }), toggle: (scope, candidateId) => setPicks(current => {
    const next = { ...current }
    if (next[scope] === candidateId) delete next[scope]
    else next[scope] = candidateId
    return next
  }) }}>{children}</VendorContext.Provider>
}

export function useVendorSelection() { return useContext(VendorContext) }

export function selectedVendor(selection: { picks: Record<string, string>; overrides: Record<string, string | null> } | null, scope: string, parentScope?: string) {
  if (parentScope && selection && Object.hasOwn(selection.overrides, scope)) return selection.overrides[scope]
  return selection?.picks[scope] ?? (parentScope ? selection?.picks[parentScope] : undefined)
}

export function SelectedCapability({ choiceScope, parentChoiceScope, evidence }: { choiceScope: string; parentChoiceScope?: string; evidence: CapabilityEvidence[] }) {
  const selection = useVendorSelection()
  const selected = evidence.find(item => item.candidateId === selectedVendor(selection, choiceScope, parentChoiceScope))
  if (!selected) return null
  return <div data-capability-evidence className="space-y-2 border-t border-zinc-800/50 pt-3 text-sm">
    <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <span className="text-zinc-300">{selected.name}</span>
      <span className="text-xs text-zinc-400">Capability <span className="font-mono text-sm tabular-nums text-emerald-300">{selected.score}/100</span></span>
    </p>
    <details className="text-xs text-zinc-400">
      <summary className="cursor-pointer">Evidence ({selected.stories.length})</summary>
      <p className="mt-2">Weighted score from the judgments below; not an automation probability.</p>
      <ul className="mt-2 space-y-2">
        {selected.stories.map(story => <li key={story.id}>
          <Link href={`${selected.href}#story-${story.id}`} className="text-zinc-300 underline underline-offset-4">{story.title}</Link>
          <span className="ml-2">{story.verdict} · quality {story.quality}/10 · weight {story.weight}</span>
        </li>)}
      </ul>
    </details>
  </div>
}
