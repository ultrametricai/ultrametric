import type { Metadata } from 'next'
import Link from 'next/link'
import AiEraBadge from '@/components/AiEraBadge'
import GeoMark from '@/components/GeoMark'
import ProductLogoView from '@/components/ProductLogoView'
import ThemeIcon from '@/components/ThemeIcon'
import { IconGlyph } from '@/components/IconChip'
import { arenaIcon } from '@/lib/arenaIcons'
import { loadAll } from '@/lib/data'
import { hasLogo } from '@/lib/logos'
import { globallyUnservedStories, OPPORTUNITY_FORMULA, rankMissingStartups } from '@/lib/missingStartups'
import { ordinal } from '@/lib/ordinal'

// The agent-startup gap map: every arena ranked by how much room it leaves a new agent-native
// entrant (lib/missingStartups.ts) — low fleet agent-readiness, hard "none" verdicts on the
// agentic stories, a weak leader, and stories nobody serves. The inverse of the leaderboards,
// and the sibling of docs/search-gaps.md: that file lists queries with no arena; this page lists
// arenas with no strong players.
export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Missing startups — where the agent economy has gaps — Ultrametric',
  description:
    'Rankings ordered by opportunity for new agent-native entrants: weak fleet agent-readiness, stories no product serves, and leaders with low Overall scores — all derived from evidence-backed verdicts.',
}

// How many unserved stories a card lists before folding into "+N more".
const UNSERVED_DISPLAY_CAP = 5

const fmt = (n: number | null) => (n === null ? 'n/a' : `${n}`)

export default function MissingStartupsPage() {
  const categories = loadAll()
  const ranked = rankMissingStartups(categories)
  const globalGaps = globallyUnservedStories(categories)
  const totalProducts = categories.reduce((n, c) => n + c.products.length, 0)

  return (
    <div className="space-y-6">
      <div>
        {/* seed "missing": same concept mark as the Explore menu's Missing startups entry. */}
        <p className="flex items-center gap-2 text-sm uppercase tracking-widest text-emerald-400">
          <GeoMark seed="missing" title="Missing startups — the agent-economy gap map" size={16} className="text-zinc-500" />
          Gap map
        </p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          Where the agent economy is missing startups
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          All {ranked.length} rankings, ordered by opportunity for a new agent-native entrant: how far
          the incumbent fleet ({totalProducts} products) is from agent-ready, the stories nobody
          serves, and how weak the current leader is. Every input is a judged, evidence-backed
          verdict — click through to any ranking for the citations.
        </p>
        {/* The full caveat matters (it's the page's honesty contract) but doesn't need to be
            read before the table — collapsed by default, one click away. */}
        <details className="mx-auto mt-2 max-w-2xl text-xs text-zinc-500">
          <summary className="cursor-pointer text-zinc-400 transition hover:text-emerald-300">
            Honest caveat: what this score does and doesn&rsquo;t measure
          </summary>
          <p className="mt-1.5">
            It measures <em>our evidence</em> on <em>our stories</em> — not market size, demand, or
            funding white-space. A high score can mean incumbents genuinely lack agent surfaces, or
            that their public evidence is thin. Both are worth knowing; neither is a business plan.
            Formula on every score; weights are contestable like everything else (see the{' '}
            <Link href="/methodology" className="text-emerald-400 underline decoration-emerald-400/40 hover:text-emerald-300">
              methodology
            </Link>
            ).
          </p>
        </details>
      </div>

      {globalGaps.length > 0 && (
        <section aria-label="nobody does this anywhere" className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
          <h2 className="font-display leading-[1.1] flex items-center gap-2 text-lg font-semibold">
            <GeoMark seed="global-gaps" title="Global stories with no full or partial verdict in any ranking that carries them" size={18} className="text-zinc-500" />
            Nobody does this anywhere
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            Cross-market capabilities where no tracked product — in any ranking carrying the story —
            has a full or partial verdict.
          </p>
          <ul className="mt-2 space-y-1">
            {globalGaps.map((g) => (
              <li key={g.storyId} className="flex flex-wrap items-baseline gap-x-2 text-sm text-zinc-300">
                <Link
                  href={`/global/${g.storyId}`}
                  title="See every product's verdict on this capability across rankings"
                  className="underline decoration-zinc-700 underline-offset-2 hover:text-emerald-300"
                >
                  {g.title}
                </Link>
                <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                  {g.arenaCount} {g.arenaCount === 1 ? 'ranking' : 'rankings'}, zero coverage
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {ranked.map((arena, i) => (
          <section key={arena.arenaId} className="flex flex-col rounded-xl border border-zinc-800 p-4">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs tabular-nums text-zinc-500">{ordinal(i + 1)}</span>
              {/* The arena's house glyph (lib/arenaIcons.ts) — the adjacent link names the
                  arena, so the bare glyph needs no tooltip of its own. */}
              {arenaIcon(arena.arenaId) && (
                <span aria-hidden className="inline-flex leading-none">
                  <IconGlyph icon={arenaIcon(arena.arenaId)} />
                </span>
              )}
              <Link
                href={`/arena/${arena.arenaId}`}
                title={`Open the ${arena.arenaName} arena — full leaderboard and judged verdicts`}
                className="min-w-0 break-words font-display text-base font-semibold hover:text-emerald-300"
              >
                {arena.arenaName}
              </Link>
              <span
                title={OPPORTUNITY_FORMULA}
                className="ml-auto cursor-help rounded-full border border-emerald-400/40 bg-emerald-400/5 px-2.5 py-0.5 font-mono text-sm tabular-nums text-emerald-300"
              >
                {arena.score}<span className="text-emerald-300/50">/100</span>
              </span>
            </p>
            {/* The measurable inputs behind the score — plain numbers, every one hoverable. */}
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
              <span title="Fleet mean of the agent-ready index (how well agents can drive these products) — lower means more room">
                agent-ready x̄ <span className="tabular-nums text-zinc-300">{fmt(arena.components.meanAgentReady)}</span>
              </span>
              <span title="Fleet mean of the Built-in AI index (how agentic the products themselves are) — lower means more room">
                Built-in AI x̄ <span className="tabular-nums text-zinc-300">{fmt(arena.components.meanAiNative)}</span>
              </span>
              <span title="Share of applicable agent-access / agentic-features verdicts judged 'none' across the whole fleet">
                agentic none-share{' '}
                <span className="tabular-nums text-zinc-300">
                  {arena.components.noneShare === null ? 'n/a' : `${Math.round(arena.components.noneShare * 100)}%`}
                </span>
              </span>
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {arena.leader ? (
                <>
                  Current leader:{' '}
                  <Link
                    href={`/arena/${arena.arenaId}/product/${arena.leader.productId}`}
                    title="The ranking's #1 by Overall score — the bar a new entrant has to clear"
                    className="inline-flex items-center gap-1.5 align-middle text-zinc-300 underline decoration-zinc-700 underline-offset-2 hover:text-emerald-300"
                  >
                    <ProductLogoView
                      product={{ id: arena.leader.productId, name: arena.leader.name }}
                      size={16}
                      hasLogo={hasLogo(arena.leader.productId)}
                    />
                    {arena.leader.name}
                  </Link>{' '}
                  <span className="inline-flex items-center gap-1 align-middle" title="The leader's Overall score (0–100) — a low bar is itself the opportunity">
                    Overall score <AiEraBadge value={arena.leader.overallScore} size="xs" />
                  </span>{' '}
                  · {arena.productCount} products tracked
                </>
              ) : (
                <>No ranked leader yet · {arena.productCount} products tracked</>
              )}
            </p>
            {arena.unservedStories.length > 0 && (
              <div className="mt-3 border-t border-zinc-800/70 pt-2">
                <p
                  className="text-[10px] uppercase tracking-widest text-zinc-500"
                  title="Stories where no product in this ranking has a full or partial verdict — the unserved demand our taxonomy already asks about"
                >
                  Nobody in this ranking does
                </p>
                <ul className="mt-1 space-y-1">
                  {arena.unservedStories.slice(0, UNSERVED_DISPLAY_CAP).map((s) => (
                    <li key={s.storyId} className="flex items-start gap-1.5 text-xs text-zinc-400">
                      <ThemeIcon theme={s.theme} className="shrink-0" />
                      <span className="min-w-0 break-words" title={`Weight-${s.weight} story — no product here scores full or partial on it`}>
                        {s.title}
                      </span>
                    </li>
                  ))}
                </ul>
                {arena.unservedStories.length > UNSERVED_DISPLAY_CAP && (
                  <p className="mt-1 text-[10px] text-zinc-500">
                    +{arena.unservedStories.length - UNSERVED_DISPLAY_CAP} more —{' '}
                    <Link href={`/arena/${arena.arenaId}`} className="underline decoration-zinc-800 underline-offset-2 hover:text-emerald-300">
                      see the full list in the ranking
                    </Link>
                  </p>
                )}
              </div>
            )}
          </section>
        ))}
      </div>

      <p className="text-xs text-zinc-500">
        Think a score is wrong? Every verdict row has a Flag link — see the{' '}
        <Link href="/methodology" className="text-emerald-400 underline decoration-emerald-400/40 hover:text-emerald-300">
          methodology
        </Link>
        .
      </p>
    </div>
  )
}
