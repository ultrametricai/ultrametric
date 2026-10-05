import Link from 'next/link'
import { claimsIntegrity } from '@/lib/claimsIntegrity'
import type { CategoryData } from '@/lib/data-helpers'

// ArenaTable's claims scoreboard cell: the product's claims-integrity score ("{score}/100") —
// how honestly the vendor's own claims survive our judge's independent verdicts, verified
// claims counting fully and contradicted ones counting doubly against (see
// lib/claimsIntegrity.ts for the formula). Title tooltip carries the full bucket breakdown
// (see lib/claims.ts's claimStatus), same "dense glyph, full detail in the tooltip" pattern
// as VerificationMixChip. Also reused verbatim by ClaimsIntegrityIndexTable so the number
// renders identically on the arena scoreboard and the global ranking.
//
// `href` (optional) makes the number a link to the per-product claims breakdown — the product
// page's #claims section (ClaimsSection). Only honored when the product actually has claims
// data (integrity.total > 0), since ClaimsSection renders nothing otherwise; a link to a
// missing anchor would be a dead end. Callers must NOT set it inside another link.
export default function ClaimsChip({ data, productId, href }: { data: CategoryData; productId: string; href?: string }) {
  const { score, verified, unverified, contradicted, untestable, total } = claimsIntegrity(data, productId)
  const title = `Claims integrity — verified ${verified} · unverified (vendor-claim only) ${unverified} · contradicted ${contradicted} · untestable (outside our story set) ${untestable}`
  const linkable = href !== undefined && total > 0

  if (score === null) {
    const untested = (
      <span
        title={`${title}. No testable claims found — unscored, not zero.${linkable ? ' Click for the claim-by-claim breakdown.' : ''}`}
        className="font-sans text-xs italic text-zinc-500"
      >
        untested
      </span>
    )
    return linkable ? (
      <Link href={href} className="inline-flex transition hover:text-emerald-300 hover:underline hover:decoration-emerald-400/60">
        {untested}
      </Link>
    ) : (
      untested
    )
  }

  // No red in table cells (founder 2026-09-30) — contradicted claims still count against the
  // score and stay itemized in the tooltip/breakdown; the color just stops shouting.
  const colorClass = score === 100 ? 'text-emerald-400' : 'text-zinc-300'

  const chip = (
    <span
      title={`${title}${linkable ? '. Click for the claim-by-claim breakdown.' : ''}`}
      className="text-xs tabular-nums"
    >
      {/* No trailing "integrity" word (founder 2026-10-02) — the N/100 + tooltip suffice. */}
      <span className={colorClass}>{score}</span>
      <span className="text-zinc-500">/100</span>
    </span>
  )
  return linkable ? (
    <Link
      href={href}
      className="inline-flex underline decoration-zinc-800 underline-offset-2 transition hover:decoration-emerald-400/60"
    >
      {chip}
    </Link>
  ) : (
    chip
  )
}
