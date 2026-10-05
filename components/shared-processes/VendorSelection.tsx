'use client'

import { createContext, useCallback, useContext, useReducer, type ReactNode } from 'react'
import Link from 'next/link'
import type { CapabilityEvidence } from '@/lib/shared-processes/vendor-preview'

const VendorContext = createContext<{
  picks: Record<string, string>
  overrides: Record<string, string | null>
  revision: number
  restore: (picks: Record<string, string>, overrides: Record<string, string | null>) => void
  override: (scope: string, candidateId: string | null | undefined) => void
  toggle: (scope: string, candidateId: string) => void
} | null>(null)

type SelectionState = { picks: Record<string, string>; overrides: Record<string, string | null>; revision: number }
type SelectionAction = { type: 'restore'; picks: Record<string, string>; overrides: Record<string, string | null> }
  | { type: 'toggle'; scope: string; candidateId: string }
  | { type: 'override'; scope: string; candidateId: string | null | undefined }

function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
  if (action.type === 'restore') return { picks: action.picks, overrides: action.overrides, revision: 0 }
  if (action.type === 'toggle') {
    const picks = { ...state.picks }
    if (picks[action.scope] === action.candidateId) delete picks[action.scope]
    else picks[action.scope] = action.candidateId
    return { ...state, picks, revision: state.revision + 1 }
  }
  const overrides = { ...state.overrides }
  if (action.candidateId === undefined) delete overrides[action.scope]
  else overrides[action.scope] = action.candidateId
  return { ...state, overrides, revision: state.revision + 1 }
}

// Persistence is opt-in through the canonical page's compatibility bridge.
export function VendorSelectionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(selectionReducer, { picks: {}, overrides: {}, revision: 0 })
  const restore = useCallback((picks: Record<string, string>, overrides: Record<string, string | null>) => dispatch({ type: 'restore', picks, overrides }), [])
  return <VendorContext.Provider value={{ ...state, restore,
    override: (scope, candidateId) => dispatch({ type: 'override', scope, candidateId }),
    toggle: (scope, candidateId) => dispatch({ type: 'toggle', scope, candidateId }),
  }}>{children}</VendorContext.Provider>
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
      <span className="text-sm text-zinc-400">Capability <span className="font-mono text-sm tabular-nums text-emerald-300">{selected.score}/100</span></span>
    </p>
    <details className="text-sm text-zinc-400">
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
