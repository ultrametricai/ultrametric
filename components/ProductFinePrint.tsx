// The product page's bottom utility line (founder: educate first, ops last): evidence
// freshness + the story-coverage tie-breaker, demoted from the header — the arenas strip took
// that slot; this data is provenance minutiae, not identity. Sits next to SloUptimeLine in the
// page's ops fine-print block, deliberately below the fold. (The old actions rail — and its
// "For agents"/"Badge" cells — is gone entirely, founder 2026-10-02; the ⚑ Flag a verdict
// button it had collapsed to was removed in turn, founder 2026-10-08 — contestation routes
// through the repo, with the agent pointers in generateMetadata alternates.)
// Server component, no data loading — everything arrives as serializable props.
export default function ProductFinePrint({
  freshness,
  coverageScore,
}: {
  /** YYYY-MM-DD max evidence fetchedAt (lib/freshness.ts), or null when no evidence. */
  freshness: string | null
  /** The leaderboard entry's story-coverage score (0–100). */
  coverageScore: number
}) {
  return (
    <p className="text-[10px] text-zinc-500">
      {freshness && <span>Evidence as of {freshness} · </span>}
      <a
        href="#story-verdicts"
        title="Story coverage (0–100), weighted by story importance — the rank tie-breaker, not the Overall score; click for the judged story rows"
        className="underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300"
      >
        story coverage <span className="tabular-nums">{coverageScore.toFixed(1)}/100</span>
      </a>
    </p>
  )
}
