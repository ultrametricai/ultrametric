// The product page's bottom utility line (founder: educate first, ops last): evidence
// freshness + the story-coverage tie-breaker, demoted from the header — the arenas strip took
// that slot; this data is provenance minutiae, not identity. Sits next to SloUptimeLine in the
// page's ops fine-print block, deliberately below the fold. (The old actions rail — and its
// "For agents"/"Badge" cells — is gone entirely, founder 2026-10-02: the product page's bottom
// utility section collapsed to the one ⚑ Flag a verdict button, with the agent pointers moved
// into generateMetadata alternates.)
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
        title="Evidence-graded story coverage (0–100): how much of this ranking's story set the product covers, weighted by story importance. The rank tie-breaker, not the Overall score. Click for the judged story rows above."
        className="underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300"
      >
        story coverage <span className="tabular-nums">{coverageScore.toFixed(1)}/100</span>
      </a>
    </p>
  )
}
