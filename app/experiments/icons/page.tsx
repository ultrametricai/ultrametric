import type { Metadata } from 'next'
import ProcessIcon, { GLYPHS, ICON_HUES } from '@/components/icons/ProcessIcon'
import { arenaIcon, ARENA_SECTION_HUES, OVERALL_ICON } from '@/lib/arenaIcons'
import { loadArenaSections } from '@/lib/arenaSections'
import { loadCategories } from '@/lib/data'
import {
  CHAIN_ICONS, parseProcessIconToken, PHASE_ICONS, phaseTooltip, processIcon, type IconHue,
} from '@/lib/processIcons'
import { loadChains, loadProcesses, phaseRank } from '@/lib/processes'

// The house process-icon gallery (founder ask 2026-09-30: "make our own custom geometric and
// colorized icons") — every hand-authored glyph from components/icons/ProcessIcon.tsx, rendered
// at review size and at the 16px it must survive in the tables, grouped by the corpus areas
// that color it. Reachable by URL only: unlisted like the other /experiments/* pages, noindexed
// below, and deliberately absent from app/sitemap.ts — this is a design-review surface, not a
// product page.
export const metadata: Metadata = {
  title: 'House icon set — Ultrametric',
  description: 'The house geometric icon set for founder processes and rankings: every glyph, its area hue, and the emoji pick that guided it.',
  robots: { index: false, follow: false },
}

const HUE_LABELS: Array<{ hue: IconHue; areas: string }> = [
  { hue: 'emerald', areas: 'startup · fundraising · finance (money and the beginning)' },
  { hue: 'amber', areas: 'formation · legal (institutions and paperwork)' },
  { hue: 'sky', areas: 'compliance · operations · product (trust and systems)' },
  { hue: 'violet', areas: 'vc · software (the fund and the build loop)' },
  { hue: 'orange', areas: 'hr · sales (people and calls)' },
  { hue: 'fuchsia', areas: 'growth (marketing and retention)' },
  { hue: 'zinc', areas: 'neutral fallback tone' },
]

function TokenTile({ token, label, sub }: { token: string; label: string; sub?: string }) {
  const parsed = parseProcessIconToken(token)
  if (!parsed) return null
  const glyph = GLYPHS[parsed.glyph]
  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
      <ProcessIcon id={parsed.glyph} hue={parsed.hue} size={26} />
      <span className="text-sm" style={{ fontSize: 16 }} aria-hidden>
        <ProcessIcon id={parsed.glyph} hue={parsed.hue} />
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm text-zinc-200">{label}</div>
        <div className="truncate text-[11px] text-zinc-500">
          {glyph?.name ?? parsed.glyph} · <span className="font-mono">{parsed.glyph}:{parsed.hue}</span>
          {glyph?.emoji ? <span className="ml-1" title="the emoji pick this glyph was drawn from">was {glyph.emoji}</span> : null}
          {sub ? <span> · {sub}</span> : null}
        </div>
      </div>
    </div>
  )
}

export default function ProcessIconGalleryPage() {
  const tasks = loadProcesses().slice().sort((a, b) => phaseRank(a.phase) - phaseRank(b.phase) || a.title.localeCompare(b.title))
  const chains = loadChains()
  const phases = [...new Set(tasks.map((t) => t.phase))]
  const glyphEntries = Object.entries(GLYPHS)
  // The arena set (founder ask 2026-10-01): every arena's house glyph, grouped by the same
  // curated sections as the header's Rankings menu, hue per section (lib/arenaIcons.ts).
  const categoryNameById = new Map(loadCategories().map((c) => [c.id, c.name]))
  const arenaSections = loadArenaSections()

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm uppercase tracking-widest text-emerald-400">experiments · unlisted</p>
        <h1 className="font-display mt-1 text-3xl font-bold leading-[1.1] tracking-tight">House icon set</h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          The house geometric set replacing the curated emoji across the founder-process corpus and the rankings:{' '}
          {glyphEntries.length} hand-authored duotone glyphs on a 24×24 grid, one accent hue per area so related concepts
          read as a family. Each tile shows the review size, the 16px table size, the glyph id, and the emoji pick it was
          drawn from. Source of truth: <span className="font-mono text-zinc-300">components/icons/ProcessIcon.tsx</span> +{' '}
          <span className="font-mono text-zinc-300">lib/processIcons.ts</span> +{' '}
          <span className="font-mono text-zinc-300">lib/arenaIcons.ts</span>.
        </p>
      </div>

      <section>
        <h2 className="font-display text-xl font-semibold">Area hues</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {HUE_LABELS.map(({ hue, areas }) => (
            <div key={hue} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
              <span className="inline-flex h-5 w-5 shrink-0 rounded" style={{ backgroundColor: ICON_HUES[hue].strong }} />
              <span className="inline-flex h-5 w-5 shrink-0 rounded" style={{ backgroundColor: ICON_HUES[hue].soft }} />
              <div className="min-w-0 text-sm">
                <span className="text-zinc-200">{hue}</span>
                <span className="block truncate text-[11px] text-zinc-500">{areas}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold">Areas</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {phases.map((phase) => (
            <TokenTile key={phase} token={PHASE_ICONS[phase]?.icon ?? ''} label={phase} sub={phaseTooltip(phase).split('— ')[1]} />
          ))}
        </div>
      </section>

      {phases.map((phase) => (
        <section key={phase}>
          <h2 className="font-display text-xl font-semibold capitalize">{phase}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tasks.filter((t) => t.phase === phase).map((t) => (
              <TokenTile key={t.id} token={processIcon(t.id)} label={t.title} sub={t.id} />
            ))}
          </div>
        </section>
      ))}

      <section>
        <h2 className="font-display text-xl font-semibold">Rankings</h2>
        <p className="mt-1 text-sm text-zinc-500">
          The ranking set (founder ask 2026-10-01): one glyph per ranking — reused from the process set where the concept
          matches, newly drawn in the same language where it doesn&apos;t — one hue per Rankings-menu section
          (lib/arenaIcons.ts). Plus the menu&apos;s leading Overall entry.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <TokenTile token={OVERALL_ICON} label="Overall — every product ranked" sub="the Rankings-menu lead entry" />
        </div>
        {arenaSections.map((section) => (
          <div key={section.id} className="mt-5">
            <h3 className="font-display text-base font-semibold">
              {section.name} <span className="text-xs font-normal text-zinc-500">· {ARENA_SECTION_HUES[section.id] ?? 'zinc'}</span>
            </h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {section.arenaIds.map((id) => (
                <TokenTile key={id} token={arenaIcon(id)} label={categoryNameById.get(id) ?? id} sub={id} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold">Playbooks (chains)</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {chains.map((c) => (
            <TokenTile key={c.id} token={CHAIN_ICONS[c.id] ?? ''} label={c.name} sub={c.id} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold">The full glyph set, neutral tone</h2>
        <p className="mt-1 text-sm text-zinc-500">Every designed glyph in zinc — the raw forms, independent of area colorization.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {glyphEntries.map(([id, g]) => (
            <div key={id} className="flex flex-col items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2 py-3 text-center">
              <ProcessIcon id={id} hue="zinc" size={28} />
              <span className="text-xs text-zinc-300">{g.name}</span>
              <span className="font-mono text-[10px] text-zinc-500">{id} · was {g.emoji}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
