// The auth-gated honesty marker (see lib/verification.ts isAuthGatedEvidence): rendered
// wherever a probe's 401/OAuth wall substantiates a verdict, so hitting a vendor sign-in never
// reads like absence. Pure display — verdict tiers and scores are untouched; a partial backed
// by auth-gated evidence stays partial. Server- and client-safe (no hooks, no fs).

export const AUTH_GATED_TITLE =
  'auth-gated — our live probe hit a vendor sign-in wall (HTTP 401/403, OAuth): verified reachable, ' +
  'untestable keylessly, not evidence of absence; never changes the verdict tier'

export default function AuthGatedMarker({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <span
        title={AUTH_GATED_TITLE}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-950 text-[9px] font-bold text-amber-300 ring-1 ring-amber-800"
      >
        ⚿
      </span>
    )
  }
  return (
    <span
      title={AUTH_GATED_TITLE}
      className="inline-flex items-center gap-1 rounded-full bg-amber-950 px-2 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-amber-800"
    >
      ⚿ auth-gated
    </span>
  )
}

// Product-page chip: "N probes hit live auth walls" — the aggregate view of the same signal
// (lib/verification.ts authGatedProbeCount), counting uncited walls too, since those are
// exactly where a live agentic endpoint would otherwise read as nothing at all.
export function AuthGatedChip({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span
      title={
        `${count} runtime probe${count === 1 ? '' : 's'} reached this product's live endpoints and got an explicit ` +
        'sign-in challenge (HTTP 401/403, OAuth) — verified reachable, auth-gated, untestable keylessly'
      }
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/5 px-2.5 py-0.5 text-xs text-amber-300"
    >
      <span className="rounded border border-amber-400/60 px-1 text-[9px] font-semibold uppercase tracking-wide">⚿ auth</span>
      {count} auth-gated {count === 1 ? 'probe' : 'probes'}
    </span>
  )
}
