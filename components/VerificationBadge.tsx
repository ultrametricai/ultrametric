import Link from 'next/link'
import type { ReactNode } from 'react'
import type { VerificationLevel } from '@/lib/verification'

const STYLES: Record<Exclude<VerificationLevel, 'unverified'>, string> = {
  'vendor-claim': 'bg-zinc-900 text-zinc-500 ring-zinc-700',
  corroborated: 'bg-sky-950 text-sky-300 ring-sky-800',
  tested: 'bg-emerald-950 text-emerald-300 ring-emerald-800',
  disputed: 'bg-red-950 text-red-300 ring-red-800',
}

// One shared word vocabulary for verification everywhere a label renders (pills, tooltips,
// the Legend): "probed" = we ran it ourselves, "community" = independent users back it,
// "claimed" = only the vendor says so, "contradicted" = evidence disagrees with the claim.
const LABELS: Record<Exclude<VerificationLevel, 'unverified'>, string> = {
  'vendor-claim': 'claimed',
  corroborated: 'community',
  tested: 'probed',
  disputed: 'contradicted',
}

// Plain-language hover text so a bare letter or pill never needs the legend to be understood.
const TITLES: Record<Exclude<VerificationLevel, 'unverified'>, string> = {
  'vendor-claim': 'claimed — only the vendor says so, unverified',
  corroborated: 'community — independent users report it works',
  tested: 'probed — we tested it ourselves',
  disputed: 'contradicted — evidence disagrees with the claim',
}

// Single-letter glyph for the dense StoryMatrix cells, where a full pill doesn't fit.
// The full label is still available via the title attribute for a11y/discoverability.
const GLYPHS: Record<Exclude<VerificationLevel, 'unverified'>, string> = {
  'vendor-claim': 'C',
  corroborated: 'X',
  tested: 'T',
  disputed: 'D',
}

export default function VerificationBadge({
  level,
  compact = false,
  responsive = false,
  href,
}: {
  level: VerificationLevel
  compact?: boolean
  // Letter below the sm breakpoint (where the column is cramped), small word pill from sm up.
  responsive?: boolean
  // Optional click-through explaining the verification vocabulary (usually
  // /methodology#evidence-tiers). Callers must NOT set this when the badge already renders
  // inside another link (StoryMatrix cells) — nested anchors are invalid.
  href?: string
}) {
  if (level === 'unverified') return null
  const wrap = (node: ReactNode) =>
    href ? (
      <Link
        href={href}
        title={`${TITLES[level]} — how evidence tiers work, on /methodology`}
        className="um-pill-link"
      >
        {node}
      </Link>
    ) : (
      node
    )
  const letter = (extra = '') => (
    <span
      title={href ? undefined : TITLES[level]}
      className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ring-1 ${STYLES[level]} ${extra}`}
    >
      {GLYPHS[level]}
    </span>
  )
  if (compact) return wrap(letter())
  if (responsive) {
    return (
      <>
        {wrap(letter('sm:hidden'))}
        {href ? (
          <Link
            href={href}
            title={`${TITLES[level]} — how evidence tiers work, on /methodology`}
            className={`um-pill um-pill-hover hidden sm:inline-flex ${STYLES[level]}`}
          >
            {LABELS[level]}
          </Link>
        ) : (
          <span
            title={TITLES[level]}
            className={`um-pill hidden sm:inline-flex ${STYLES[level]}`}
          >
            {LABELS[level]}
          </span>
        )}
      </>
    )
  }
  if (href) {
    return (
      <Link
        href={href}
        title={`${TITLES[level]} — how evidence tiers work, on /methodology`}
        className={`um-pill um-pill-hover inline-flex ${STYLES[level]}`}
      >
        {LABELS[level]}
      </Link>
    )
  }
  return (
    <span
      title={TITLES[level]}
      className={`um-pill inline-flex ${STYLES[level]}`}
    >
      {LABELS[level]}
    </span>
  )
}
