'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'
import { ADMIN_FLAG_KEY, AFK_RUN_URL, isAdminEmail } from '@/components/DoViaAfk'
import { isCompanyEmail } from '@/components/OpsDashboard'
import { useSession } from '@/lib/session'

// Step-scoped "run with Ultrametric" chip (founder 2026-09-25 as the AFK computer-use trigger;
// renamed and re-pointed by the founder 2026-10-05: 'Run with AFK' → 'Run with Ultrametric',
// destination the CLI/MCP install page). Renders next to the manual "do it yourself" link on
// actionUrl steps and opens /get-started — the on-site install page for the shipped
// `ultrametric` CLI and the hosted MCP (lib/ultrametricCli.ts). The AFK run-endpoint handoff
// (afkStepRunUrl below — manifest + &node= scoping) stays the documented executor contract
// (docs/AFK-HANDOFF.md) and still drives the admin DoViaAfk affordance's manifest copy.
//
// STAFF-GATED, exactly the components/DoViaAfk.tsx pattern (NEXT_PUBLIC_ADMIN_EMAILS allowlist
// or the founder's pa-admin localStorage switch) PLUS the OpsDashboard @ultrametric.ai rule
// (isCompanyEmail — WorkOS verifies the address before issuing a session). Non-staff readers get
// literally NOTHING rendered — the localStorage/session halves read client-side with `false`
// server snapshots, so the static HTML never carries the chip.

// LAUNCH-DAY FLIP: AFK is pre-launch, so the chip is staff-only for now. When AFK launches,
// flip this single constant to true and the chip renders for every reader (the gate below is
// bypassed entirely) — nothing else needs to change.
export const AFK_STEP_TRIGGER_PUBLIC: boolean = false

// Pure so the URL contract is unit-testable: AFK consumes the manifest URL; the node param
// scopes the run to one step.
export function afkStepRunUrl(manifestUrl: string, nodeId: string): string {
  return `${AFK_RUN_URL}?manifest=${encodeURIComponent(manifestUrl)}&node=${encodeURIComponent(nodeId)}`
}

function readAdminFlag(): boolean {
  try {
    return window.localStorage.getItem(ADMIN_FLAG_KEY) === '1'
  } catch {
    // localStorage unavailable (privacy mode) — the flag path just stays off.
    return false
  }
}

function subscribeAdminFlag(callback: () => void): () => void {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

const getServerAdminFlag = () => false

export default function StepAfkChip({ manifestUrl, nodeId }: {
  // Absolute URL of this page's manifest (process or chain) — the one artifact AFK consumes.
  manifestUrl: string
  // The DAG node id this run is scoped to.
  nodeId: string
}) {
  // The chip links to the install page since the 2026-10-05 rename; the manifest/node props
  // stay on the contract (and afkStepRunUrl above) so the launch-day flip back to the scoped
  // run endpoint is a one-line change for callers that already pass them.
  void manifestUrl
  void nodeId
  // Hooks run unconditionally (rules of hooks); the staff gate comes after.
  const session = useSession()
  const localFlag = useSyncExternalStore(subscribeAdminFlag, readAdminFlag, getServerAdminFlag)

  const staff =
    session.state === 'authenticated' &&
    (isAdminEmail(session.email, process.env.NEXT_PUBLIC_ADMIN_EMAILS) || isCompanyEmail(session.email))
  if (!AFK_STEP_TRIGGER_PUBLIC && !staff && !localFlag) return null

  return (
    <Link
      href="/get-started"
      title="Run steps like this with Ultrametric — the CLI/MCP install page (our own product)"
      className="inline-flex items-center gap-1 rounded-md border border-emerald-400/50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-400/10"
    >
      ⚡ run with Ultrametric
    </Link>
  )
}
