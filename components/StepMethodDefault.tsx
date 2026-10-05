'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import { DEFAULT_METHOD_ID, methodSelection, subscribeMethodSelections } from '@/lib/stepMethods'

// Default-method content gate for one method-bearing step block (founder 2026-09-30 method
// variants): wraps the parts of the server-rendered step that describe the DEFAULT method —
// the route badge, the vendor market rows, the action row, the API calls — and hides them while
// a variant is selected in components/StepMethodGeo.tsx, whose panel shows the variant's own
// route/vendors/calls/time instead.
//
// The personalization contract holds: the server (and initial-hydration) snapshot is always the
// default method, so the static HTML renders the children byte-identically and nothing changes
// until a reader (or the geo auto-preselect) picks a variant.
export default function StepMethodDefault({
  nodeKey,
  children,
}: {
  nodeKey: string
  children: ReactNode
}) {
  const selected = useSyncExternalStore(
    subscribeMethodSelections,
    () => methodSelection(nodeKey),
    () => DEFAULT_METHOD_ID,
  )
  if (selected !== DEFAULT_METHOD_ID) return null
  return <>{children}</>
}
