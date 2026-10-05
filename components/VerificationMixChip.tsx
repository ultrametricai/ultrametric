import Link from 'next/link'
import type { CategoryData } from '@/lib/data-helpers'
import { verificationMix } from '@/lib/verification'

// Human-readable verification summary for table rows: "35/47 verified" where verified means the
// cell's strongest evidence is probed-by-us or community-corroborated (everything else rests on
// vendor claims alone). The old dense "T27 X8 C11 D1" glyph string read as noise to anyone who
// hadn't memorized the legend; the full per-tier breakdown now lives in the tooltip, and a red
// "· N disputed" only appears when it's non-zero (that one is worth the extra ink).
//
// `href` (optional) links the figure to where the per-story verification actually lives — the
// product page's #story-verdicts table (its Verification column shows every cell's level).
// Callers must NOT set it inside another link.
//
// `showDisputed` (default true): leaderboards pass false (founder 2026-09-30: no 'disputed'
// datum inside the ranking tables) — the disputed cells still count toward the denominator
// (hiding them from the total WOULD move the verified ratio, which we never do); only the red
// suffix and the tooltip's disputed line stop rendering. Product pages keep the full display.
export default function VerificationMixChip({ data, productId, href, showDisputed = true }: { data: CategoryData; productId: string; href?: string; showDisputed?: boolean }) {
  const mix = verificationMix(data, productId)
  const verified = mix.tested + mix.corroborated
  const total = verified + mix['vendor-claim'] + mix.disputed
  const title = `Verification — probed by us: ${mix.tested} · community-corroborated: ${mix.corroborated} · vendor claim only: ${mix['vendor-claim']}${showDisputed ? ` · disputed: ${mix.disputed}` : ''}. "Verified" = probed or corroborated.${href ? ' Click for the per-story verification column.' : ' See legend.'}`
  if (total === 0) {
    return <span title={title} className="text-xs text-zinc-500">—</span>
  }
  const chip = (
    <span title={title} className="whitespace-nowrap text-xs tabular-nums">
      {/* No trailing "verified" word (founder 2026-10-02) — the ratio + tooltip suffice; the
          surrounding column header / section labels the figure. */}
      <span className="text-emerald-400">{verified}</span>
      <span className="text-zinc-500">/{total}</span>
      {showDisputed && mix.disputed > 0 && <span className="text-red-400"> · {mix.disputed} disputed</span>}
    </span>
  )
  if (!href) return chip
  return (
    <Link
      href={href}
      className="inline-flex underline decoration-zinc-800 underline-offset-2 transition hover:decoration-emerald-400/60"
    >
      {chip}
    </Link>
  )
}
