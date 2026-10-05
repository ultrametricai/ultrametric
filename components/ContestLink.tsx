import { flagVerdictUrl } from '@/lib/contestUrl'
import type { Verdict } from '@/lib/schemas'

// A quick, always-available "something's wrong here" flag on every verdict. It's just a
// prefilled GitHub issue link (lib/contestUrl.ts) — the deeper check (adding evidence,
// re-judging, deriving) is still a maintainer/PR flow, documented in CONTRIBUTING.md.
export default function ContestLink({
  category,
  productId,
  storyId,
  verdict,
}: {
  category: string
  productId: string
  storyId: string
  verdict: Verdict
}) {
  return (
    <a
      href={flagVerdictUrl({ category, productId, storyId, verdict: verdict.verdict, quality: verdict.quality })}
      target="_blank"
      rel="noopener noreferrer"
      title="Think this verdict is wrong? Flag it — opens a prefilled public GitHub issue with the evidence attached"
      className="text-xs text-zinc-400 hover:text-emerald-300"
    >
      ⚑ flag
    </a>
  )
}
