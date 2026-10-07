'use client'

import type { ReactNode } from 'react'
import { useGeoSelection } from '@/components/useGeoSelection'

// The /artifacts country-view gate (founder 2026-10-07 — the /processes country rule's
// sibling): under an EXPLICIT country selection, rows/sections whose every producing process
// is US-scoped (lib/artifactPages.ts usOnlyProducers) hide; mixed producers stay visible.
// Same contract as every geo consumer (components/useGeoSelection.ts): the server snapshot and
// the no-selection default render the children byte-identically — useGeoSelection is null
// until the mount effect, and the explicit 🌐 Global choice also reads as null — so only a real
// country pick filters, and no judged number moves.
export default function ArtifactGeoGate({
  usOnly,
  children,
}: {
  usOnly: boolean
  children: ReactNode
}) {
  const geo = useGeoSelection()
  if (geo !== null && usOnly) return null
  return <>{children}</>
}
