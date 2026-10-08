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
