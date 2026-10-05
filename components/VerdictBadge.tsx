import Link from 'next/link'
import type { Verdict } from '@/lib/schemas'

const STYLES: Record<Verdict['verdict'], string> = {
  full: 'bg-emerald-950 text-emerald-300 ring-emerald-800',
  partial: 'bg-amber-950 text-amber-300 ring-amber-800',
  disputed: 'bg-red-950 text-red-300 ring-red-800',
  none: 'bg-zinc-900 text-zinc-500 ring-zinc-700',
  na: 'bg-zinc-900 text-zinc-400 ring-zinc-800 italic',
}

const LABELS: Record<Verdict['verdict'], string> = {
  full: 'full',
  partial: 'partial',
  disputed: 'disputed',
  none: 'none',
  na: 'n/a',
}

// The same glyphs the compact access-glyph strips use (see lib/accessGlyphs.ts), rendered
// inside the chip so readers passively learn the glyph ↔ verdict mapping instead of keeping
// two visual vocabularies in their head. `na` carries no glyph: the dense strips collapse
// none/na into "—", but on a labeled chip "n/a" already says it and a "—" would wrongly
// suggest "none".
const GLYPHS: Record<Verdict['verdict'], string | null> = {
  full: '✓',
  partial: '~',
  disputed: '!',
  none: '—',
  na: null,
}

// Plain-language hover text so a bare chip never needs the legend to be understood.
const TITLES: Record<Verdict['verdict'], string> = {
  full: 'full — clear evidence it delivers',
  partial: 'partial — works, with caveats',
  disputed: 'disputed — evidence conflicts',
  none: 'none — no evidence found either way',
  na: "n/a — question doesn't apply to this kind of product",
}

export default function VerdictBadge({
  verdict,
  href,
  hrefTitle,
}: {
  verdict: Verdict['verdict']
  // Optional click-through to where the verdict's full rationale + citations live (usually the
  // product page's #story-<id> anchor). Callers must NOT set this when the chip already renders
  // inside another link (StoryMatrix cells, compare story cells) — nested anchors are invalid.
  href?: string
  // Tooltip suffix saying where the link goes; appended to the plain-language verdict title.
  hrefTitle?: string
}) {
  const glyph = GLYPHS[verdict]
  const chip = (
    <span
      title={href ? undefined : TITLES[verdict]}
      className={`um-pill inline-flex items-center gap-1 ${STYLES[verdict]}`}
    >
      {glyph && (
        <span aria-hidden className="font-mono not-italic">
          {glyph}
        </span>
      )}
      <span>{LABELS[verdict]}</span>
    </span>
  )
  if (!href) return chip
  return (
    <Link
      href={href}
      title={`${TITLES[verdict]} — ${hrefTitle ?? 'see the full rationale and cited evidence'}`}
      className="um-pill-link"
    >
      {chip}
    </Link>
  )
}
