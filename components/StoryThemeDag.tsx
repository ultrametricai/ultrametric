import ThemeIcon from '@/components/ThemeIcon'
import { groupInOrder, verdictFor, type CategoryData } from '@/lib/data'
import { stripPersonaPrefix } from '@/lib/data-helpers'
import { humanizeTheme, themeExplanation } from '@/lib/icons'
import type { Story, Verdict } from '@/lib/schemas'

// "Story map (experiment)" — the founder's 2026-10-02 story-DAG prototype: "i want to see what
// a story DAG looks like for a vendor — test on the mercury page". A server-rendered DAG of the
// product's judged STORIES grouped by THEME: each theme renders as a header block connected
// down (theme → story, ProcessDag's spine-and-arrowhead visual language) to its stories, side
// by side in the dashed parallel-group idiom, each story node tinted by its judged verdict —
// full emerald / partial amber / none zinc / na dashed (disputed keeps the red it wears
// everywhere else). Committed data only: the same stories.json + verdicts.json rows the table
// above renders, no new scores; every node deep-links to its #story-<id> row for rationale and
// evidence. Gated to ONLY the mercury product page this round (see the call site in
// app/arena/[category]/product/[id]/page.tsx) so the founder can judge the shape before any
// wider rollout.

type VerdictValue = Verdict['verdict']

const NODE_STYLE: Record<VerdictValue, { block: string; chip: string; title: string; glyph: string; label: string }> = {
  full: {
    block: 'border-emerald-400/50 bg-emerald-400/[0.07]',
    chip: 'bg-emerald-400/10 text-emerald-300',
    title: 'text-zinc-100',
    glyph: '✓',
    label: 'full',
  },
  partial: {
    block: 'border-amber-400/40 bg-amber-400/[0.05]',
    chip: 'bg-amber-400/10 text-amber-300',
    title: 'text-zinc-200',
    glyph: '~',
    label: 'partial',
  },
  disputed: {
    block: 'border-red-400/40 bg-red-400/[0.04]',
    chip: 'bg-red-400/10 text-red-300',
    title: 'text-zinc-200',
    glyph: '!',
    label: 'disputed',
  },
  none: {
    block: 'border-zinc-800 bg-transparent',
    chip: 'bg-zinc-800/60 text-zinc-500',
    title: 'text-zinc-500',
    glyph: '—',
    label: 'none',
  },
  na: {
    block: 'border-dashed border-zinc-800 bg-transparent',
    chip: 'bg-zinc-800/40 text-zinc-500',
    title: 'text-zinc-500',
    glyph: 'n/a',
    label: 'n/a',
  },
}

// Same spine joint as ProcessDag/StoryMap — centered under the theme header.
function Connector() {
  return (
    <svg aria-hidden width="16" height="26" viewBox="0 0 16 26" className="mx-auto block text-zinc-600">
      <line x1="8" y1="0" x2="8" y2="18.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.5 18 L8 25 L11.5 18 Z" fill="currentColor" />
    </svg>
  )
}

function StoryNode({ story, verdict }: { story: Story; verdict: VerdictValue }) {
  const style = NODE_STYLE[verdict]
  return (
    <a
      href={`#story-${story.id}`}
      title={`${story.title} — verdict: ${style.label}. Open this story's row in the verdicts table above for the rationale and evidence.`}
      className={`flex min-w-0 items-start justify-between gap-2 rounded-lg border p-2.5 transition hover:border-emerald-300/70 ${style.block}`}
    >
      <p className={`min-w-0 break-words text-xs font-medium leading-snug ${style.title}`}>
        {stripPersonaPrefix(story.title)}
      </p>
      <span
        className={`shrink-0 rounded px-1 py-0.5 font-mono text-[10px] font-semibold leading-none ${style.chip}`}
        title={`verdict: ${style.label}`}
      >
        {style.glyph}
      </span>
    </a>
  )
}

export default function StoryThemeDag({
  data,
  productId,
  productName,
}: {
  data: CategoryData
  productId: string
  productName: string
}) {
  const byTheme = groupInOrder<Story>(data.stories, (s) => s.theme)
  if (byTheme.length === 0) return null

  return (
    <div id="story-map-experiment" className="scroll-mt-4">
      <h2 className="font-display leading-[1.1] mb-1 flex flex-wrap items-center gap-2 text-lg font-semibold">
        Story map (experiment)
        <span className="rounded-full border border-amber-400/40 bg-amber-400/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-300">
          experiment
        </span>
      </h2>
      <p className="mb-4 text-sm text-zinc-400">
        {productName}&rsquo;s judged stories as a theme → story DAG — the same verdicts as the
        table above, drawn as a map: <span className="text-emerald-300">✓ full</span> ·{' '}
        <span className="text-amber-300">~ partial</span> ·{' '}
        <span className="text-zinc-400">— none</span> · n/a dashed. A prototype on this page
        only, while we judge the shape.
      </p>
      <div className="space-y-6">
        {byTheme.map(([theme, stories]) => {
          const verdicts = stories.map((s) => verdictFor(data, productId, s.id).verdict)
          const delivered = verdicts.filter((v) => v === 'full' || v === 'partial').length
          const judgeable = verdicts.filter((v) => v !== 'na').length
          return (
            <div key={theme}>
              {/* Theme header block — ProcessDag's SectionHeader idiom. */}
              <div className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <h3 className="font-display flex items-center gap-1.5 text-base font-semibold tracking-tight text-zinc-100">
                    <ThemeIcon theme={theme} />
                    {humanizeTheme(theme)}
                  </h3>
                  <span
                    className="font-mono text-xs tabular-nums text-zinc-500"
                    title={`Of this theme's ${judgeable} applicable ${judgeable === 1 ? 'story' : 'stories'}, ${productName} delivers ${delivered} (full or partial) — judged verdicts, not a new score`}
                  >
                    {delivered}/{judgeable} delivered
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-400">{themeExplanation(theme)}</p>
              </div>
              <Connector />
              {stories.length === 1 ? (
                <StoryNode story={stories[0]} verdict={verdicts[0]} />
              ) : (
                // Sibling stories hang off their theme side by side — the dashed parallel-group
                // idiom from ProcessDag.
                <div className="rounded-xl border border-dashed border-zinc-700/80 p-2">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {stories.map((s, i) => (
                      <StoryNode key={s.id} story={s} verdict={verdicts[i]} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
