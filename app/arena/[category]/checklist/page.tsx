import type { Metadata } from 'next'
import Link from 'next/link'
import CopyButton from '@/components/CopyButton'
import CopyPreview from '@/components/CopyPreview'
import IconChip from '@/components/IconChip'
import PersonaChip from '@/components/PersonaChip'
import ProductLogoView from '@/components/ProductLogoView'
import ThemeIcon from '@/components/ThemeIcon'
import { arenaIcon } from '@/lib/arenaIcons'
import {
  checklistMarkdown, checklistThemes, checklistWhy, priorityForWeight, storyPassStats,
  VERDICT_GLYPHS, type Priority,
} from '@/lib/checklist'
import { loadAll, loadCategory, verdictFor } from '@/lib/data'
import { hasLogo } from '@/lib/logos'
import { parseStoryPersona } from '@/lib/storyText'
import { humanizeTheme, themeExplanation } from '@/lib/icons'
import type { Verdict } from '@/lib/schemas'
import { SITE_URL } from '@/lib/site'

// Buyer checklist / RFP view of one arena (see lib/checklist.ts): every judged story as a
// checkbox requirement grouped by theme — each with its weight-as-priority, a one-line "why it
// matters", and the top-ranked products' current verdicts as compact chips linking straight to
// the evidence — plus a one-click markdown export.

export function generateStaticParams() {
  return loadAll().map((data) => ({ category: data.category.id }))
}

export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>
}): Promise<Metadata> {
  const { category } = await params
  const data = loadCategory(category)
  const year = new Date().getFullYear()
  return {
    title: `${data.category.name} buyer checklist / RFP template (${year}) — Ultrametric`,
    description: `A ready-to-send ${data.category.name} RFP checklist: ${data.stories.length} evidence-judged requirements grouped by theme with must-have/should-have/nice-to-have priorities, plus current pass/fail verdicts for the top-ranked of ${data.products.length} products.`,
    alternates: { canonical: `${SITE_URL}/arena/${category}/checklist` },
  }
}

const PRIORITY_STYLES: Record<Priority, string> = {
  'must-have': 'border-emerald-400/60 text-emerald-300',
  'should-have': 'border-zinc-600 text-zinc-300',
  'nice-to-have': 'border-zinc-800 text-zinc-500',
}

// Chip tint per verdict tier — the same green/red/grey vocabulary as VerdictBadge and the
// story-matrix glyphs, compressed onto a linkable chip.
const CHIP_STYLES: Record<Verdict['verdict'], string> = {
  full: 'border-emerald-400/50 text-emerald-300 hover:border-emerald-300',
  partial: 'border-zinc-700 text-zinc-300 hover:border-emerald-400/60',
  disputed: 'border-red-400/50 text-red-300 hover:border-red-300',
  none: 'border-zinc-800 text-zinc-500 hover:border-emerald-400/60',
  na: 'border-zinc-800/70 text-zinc-500 hover:border-zinc-700',
}

const CHIP_TITLES: Record<Verdict['verdict'], string> = {
  full: 'full — delivers this today',
  partial: 'partial — delivers some of this',
  disputed: 'disputed — evidence conflicts',
  none: 'none — no evidence it delivers this',
  na: 'not applicable to this product',
}

// How many leaderboard products get a verdict chip on every requirement. Five keeps a row of
// chips one to two lines at 375px; the full field stays on the arena page's story matrix.
const TOP_PRODUCTS = 5

export default async function ChecklistPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params
  const data = loadCategory(category)
  const themes = checklistThemes(data.stories)
  const markdown = checklistMarkdown(data)
  const productById = new Map(data.products.map((p) => [p.id, p]))
  const topProducts = data.rankings.leaderboard
    .slice(0, TOP_PRODUCTS)
    .flatMap((entry) => {
      const product = productById.get(entry.productId)
      return product ? [product] : []
    })

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-widest text-emerald-400">
          <Link href={`/arena/${category}`} className="hover:text-emerald-300">
            {data.category.name} Ranking
          </Link>
        </p>
        <h1 className="font-display leading-[1.1] mt-1 flex items-center gap-2.5 text-3xl font-bold tracking-tight">
          {/* Same house glyph this arena wears in the header's Rankings menu (lib/arenaIcons.ts). */}
          <IconChip icon={arenaIcon(data.category.id)} title={`${data.category.name} ranking`} />
          Buyer checklist
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Every requirement we judge {data.category.name.toLowerCase()} products against, as a ready-to-send
          RFP checklist — with each item&apos;s priority, why it matters, and how the top-ranked products score
          on it today.
        </p>
        <p className="mt-2 text-xs text-zinc-400">
          {data.stories.length} requirements · {themes.length} themes · verdicts for {data.products.length}{' '}
          products · updated {data.rankings.generatedAt.slice(0, 10)} · priorities mirror the story weights
          our scoring uses (
          <Link href="/methodology" className="text-emerald-300 hover:underline">
            methodology
          </Link>
          )
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <CopyButton text={markdown} label="Copy as markdown" />
          <Link
            href={`/arena/${category}/report`}
            className="text-xs text-zinc-400 underline decoration-zinc-800 hover:text-emerald-300"
          >
            Procurement report →
          </Link>
        </div>
        {/* The exact markdown the button copies — collapsed preview, never invisible. */}
        <div className="mt-2 max-w-2xl">
          <CopyPreview summary="Show the markdown export" text={markdown} />
        </div>
      </div>

      {/* Legend only — that a chip opens the judged evidence is already its tooltip. */}
      {topProducts.length > 0 && (
        <p className="text-xs text-zinc-400">
          Chips show the top {topProducts.length} ranked products&apos; current verdict on each requirement —{' '}
          <span className="text-emerald-300">✓ full</span> · ~ partial ·{' '}
          <span className="text-red-300">! disputed</span> · — none · n/a not applicable.
        </p>
      )}

      <div className="space-y-8">
        {themes.map(([theme, stories]) => (
          <section key={theme}>
            <h2 className="font-display leading-[1.1] flex items-center gap-1.5 text-lg font-semibold">
              <ThemeIcon theme={theme} />
              {humanizeTheme(theme)}
              <span className="text-xs font-normal text-zinc-500">
                · {stories.length} {stories.length === 1 ? 'item' : 'items'}
              </span>
            </h2>
            {/* Visible one-liner explaining this story grouping — founder rule: never only a
                hover tooltip. Truncates on narrow viewports rather than wrapping the header. */}
            <p className="mt-0.5 truncate text-xs text-zinc-400">{themeExplanation(theme)}</p>
            <ul className="mt-3 divide-y divide-zinc-800/70 overflow-hidden rounded-xl border border-zinc-800">
              {stories.map((s) => {
                const priority = priorityForWeight(s.weight)
                // Requirement leads with the action; the "As a {persona}," frame becomes a
                // chip (lib/storyText.ts) so the list stops repeating it on every row.
                const parsed = parseStoryPersona(s.title)
                return (
                  <li key={s.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      {/* Geometric checkbox glyph (prints as an empty box) — same square the
                          procurement report's checklist section draws. */}
                      <span
                        aria-hidden
                        className="mt-1 inline-block size-3.5 shrink-0 rounded-sm border border-zinc-600"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-200">
                          <PersonaChip persona={parsed.persona ?? s.persona} className="mr-1.5" />
                          {parsed.action}
                        </p>
                        <p className="mt-1 text-xs text-zinc-400">
                          {checklistWhy(s.weight, storyPassStats(data, s.id))}
                        </p>
                        {topProducts.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {topProducts.map((p) => {
                              const tier = verdictFor(data, p.id, s.id).verdict
                              return (
                                <Link
                                  key={p.id}
                                  href={`/arena/${category}/product/${p.id}#story-${s.id}`}
                                  title={`${p.name}: ${CHIP_TITLES[tier]} — open the judged evidence`}
                                  className={`inline-flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] leading-4 transition ${CHIP_STYLES[tier]}`}
                                >
                                  <span aria-hidden className="font-mono">
                                    {VERDICT_GLYPHS[tier]}
                                  </span>
                                  <ProductLogoView product={{ id: p.id, name: p.name }} size={16} hasLogo={hasLogo(p.id)} />
                                  <span className="truncate">{p.name}</span>
                                </Link>
                              )
                            })}
                          </div>
                        )}
                      </div>
                      <span
                        className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${PRIORITY_STYLES[priority]}`}
                      >
                        {priority}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      <p className="text-xs text-zinc-500">
        Full evidence behind every verdict lives on the{' '}
        <Link href={`/arena/${category}`} className="text-emerald-300 hover:underline">
          ranking page
        </Link>{' '}
        and each product page — chips above deep-link straight to the judged story.
      </p>
    </div>
  )
}
