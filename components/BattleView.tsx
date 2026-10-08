import AgenticBadge from '@/components/AgenticBadge'
import { BusinessModelLine } from '@/components/BusinessModel'
import PersonaChip from '@/components/PersonaChip'
import ShutdownBadge from '@/components/ShutdownBadge'
import ThemeIcon from '@/components/ThemeIcon'
import VerdictBadge from '@/components/VerdictBadge'
import VerificationBadge from '@/components/VerificationBadge'
import { evidenceById, groupInOrder, type CategoryData, verdictFor } from '@/lib/data'
import { humanizeTheme, themeExplanation } from '@/lib/icons'
import type { BattleRecord } from '@/lib/schemas'
import { parseStoryPersona } from '@/lib/storyText'
import { strongestEvidence, verificationLevel } from '@/lib/verification'

type Round = BattleRecord['rounds'][number]

// `standalone` (default) renders the full header (h1, business models, agenticness strip) for
// the bare /arena/{cat}/battle/{slug} page. The richer /vs/{slug} page passes false: its own
// header + product cards already carry the names, business models, and agentic badges, so
// rendering them here again would duplicate every one of them — only the verdict line and the
// judged rounds are unique to this component there.
export default function BattleView({
  data,
  battle,
  standalone = true,
}: {
  data: CategoryData
  battle: BattleRecord
  standalone?: boolean
}) {
  const productById = new Map(data.products.map((p) => [p.id, p]))
  const storyById = new Map(data.stories.map((s) => [s.id, s]))
  const entryById = new Map(data.rankings.leaderboard.map((e) => [e.productId, e]))
  const evidence = evidenceById(data)
  const a = productById.get(battle.a)!
  const b = productById.get(battle.b)!
  const winnerName = battle.winner === 'draw' ? null : productById.get(battle.winner)!.name

  const decided = battle.rounds.filter((r) => r.winner !== 'na')
  const naRounds = battle.rounds.filter((r) => r.winner === 'na')
  const byTheme = groupInOrder(decided, (r) => storyById.get(r.storyId)!.theme)

  // COMPRESSED rounds (founder 2026-09-30: "/vs pages must read as a compact scorecard first,
  // not walls of text"): each round is a one-line verdict — action, per-product scores, who
  // took it — inside a native <details> disclosure. The full two-panel analysis (rationale,
  // citations, proof links) renders unchanged INSIDE the expander: nothing
  // is deleted or moved out of the page, it's folded. <details>/<summary> keeps this a server
  // component (no JS needed to expand) and keeps every word in the served HTML for search.
  const renderRound = (round: Round) => {
    const story = storyById.get(round.storyId)!
    // Rounds lead with the de-framed action (lib/storyText.ts) — fifty "As a developer, …"
    // openers in a row buried what each round actually tests; the persona survives as a chip.
    const parsed = parseStoryPersona(story.title)
    const va = verdictFor(data, battle.a, round.storyId)
    const vb = verdictFor(data, battle.b, round.storyId)
    const roundWinner =
      round.winner === 'a' ? a.name : round.winner === 'b' ? b.name : round.winner === 'draw' ? 'draw' : null
    // One-line scoreline in a–b order, only when both sides carry a judged quality.
    const scoreline = va.verdict !== 'na' && vb.verdict !== 'na' ? `${va.quality}–${vb.quality}` : null
    return (
      <li key={round.storyId} className="overflow-hidden rounded-xl border border-zinc-800">
        <details className="group">
          <summary className="um-round-summary">
            <span aria-hidden className="text-xs text-zinc-600 transition group-open:rotate-90">
              ▸
            </span>
            <h4 className="um-round-title">
              <PersonaChip persona={parsed.persona ?? story.persona} className="mr-1.5" />
              {parsed.action}
            </h4>
            <span className="ml-auto whitespace-nowrap text-xs text-zinc-500">
              {scoreline && <span className="mr-2 font-mono tabular-nums text-zinc-400">{scoreline}</span>}
              {roundWinner === null ? (
                'not comparable'
              ) : roundWinner === 'draw' ? (
                'drawn'
              ) : (
                <span className="text-emerald-300">→ {roundWinner}</span>
              )}
            </span>
          </summary>
          <div className="border-t border-zinc-800 p-5 pt-4">
            <p className="text-xs text-zinc-500">
              weight {story.weight} ·{' '}
              {roundWinner === null ? 'not comparable' : roundWinner === 'draw' ? 'round drawn' : `round to ${roundWinner}`}
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {[
            { p: a, v: va, won: round.winner === 'a' },
            { p: b, v: vb, won: round.winner === 'b' },
          ].map(({ p, v, won }) => {
            const proof = strongestEvidence(v, evidence)
            return (
              <div key={p.id} className={`rounded-xl p-4 ring-1 ${won ? 'ring-emerald-400/60 bg-emerald-400/5' : 'ring-zinc-800'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{p.name}</span>
                  <span className="flex items-center gap-2">
                    <VerdictBadge
                      verdict={v.verdict}
                      href={`/arena/${data.category.id}/product/${p.id}#story-${round.storyId}`}
                      hrefTitle={`open ${p.name}'s full story row (rationale + citations)`}
                    />
                    <VerificationBadge level={verificationLevel(v, evidence)} href="/methodology#evidence-tiers" />
                    {v.verdict !== 'na' && (
                      <span className="font-mono text-sm tabular-nums text-zinc-400">{v.quality}/10</span>
                    )}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-400">{v.rationale}</p>
                <ul className="mt-2 space-y-1">
                  {v.evidenceIds.map((id) => {
                    const e = evidence.get(id)!
                    return (
                      <li key={id} className="text-xs text-zinc-500">
                        <a href={e.url} target="_blank" rel="noopener noreferrer" title={`Open the cited source (tier ${e.tier} evidence)`} className="um-cite-link">
                          [{e.tier}]
                        </a>{' '}
                        &ldquo;{e.excerpt.length > 140 ? e.excerpt.slice(0, 140) + '…' : e.excerpt}&rdquo;
                      </li>
                    )
                  })}
                </ul>
                {proof && (
                  <div className="mt-2 flex justify-end">
                    <a
                      href={proof.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open the recorded probe proof for this verdict"
                      className="text-xs text-zinc-500 hover:text-emerald-300"
                    >
                      proof ↗
                    </a>
                  </div>
                )}
              </div>
            )
          })}
            </div>
          </div>
        </details>
      </li>
    )
  }

  const aEntry = entryById.get(a.id)
  const bEntry = entryById.get(b.id)

  return (
    <div className="space-y-8">
      <div className="text-center">
        {standalone && (
          <>
            <h1 className="font-display leading-[1.1] text-3xl font-bold tracking-tight">
              {a.name} <span className="text-zinc-400">vs</span> {b.name}
            </h1>
            <div className="mt-1 flex items-center justify-center gap-2 text-xs text-zinc-400">
              <BusinessModelLine product={a} />
              <ShutdownBadge shutdown={a.shutdown} source={a.shutdownSource} />
              <span className="text-zinc-700">·</span>
              <BusinessModelLine product={b} />
              <ShutdownBadge shutdown={b.shutdown} source={b.shutdownSource} />
            </div>
          </>
        )}
        <p className="mt-2 text-emerald-300">
          {winnerName ? `${winnerName} wins` : 'Draw'} · {battle.record.aWins}–{battle.record.bWins}
          {battle.record.draws > 0 ? ` (${battle.record.draws} drawn)` : ''}
        </p>
      </div>

      {standalone && (
        <div className="flex flex-wrap items-center justify-center gap-6 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">{a.name}</span>
            <AgenticBadge kind="agent-ready" value={aEntry?.agentReady ?? null} href="/methodology#ai-era" />
            <AgenticBadge kind="agentic-app" value={aEntry?.agenticApp ?? null} href="/methodology#ai-era" />
          </div>
          <span className="text-xs uppercase tracking-widest text-zinc-400">Agenticness</span>
          <div className="flex items-center gap-2">
            <AgenticBadge kind="agent-ready" value={bEntry?.agentReady ?? null} href="/methodology#ai-era" />
            <AgenticBadge kind="agentic-app" value={bEntry?.agenticApp ?? null} href="/methodology#ai-era" />
            <span className="text-sm text-zinc-400">{b.name}</span>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {byTheme.map(([theme, rounds]) => {
          const byGroup = groupInOrder(rounds, (r) => storyById.get(r.storyId)!.group)
          return (
            <div key={theme}>
              <h2 className="um-theme-bar">
                <ThemeIcon theme={theme} />
                {humanizeTheme(theme)}
              </h2>
              {/* Visible one-liner explaining this grouping; lives OUTSIDE the sticky bar so the
                  pinned header stays one compact line while scrolling. */}
              <p className="mt-2 truncate text-xs text-zinc-400">{themeExplanation(theme)}</p>
              <div className="mt-3 space-y-6">
                {byGroup.map(([group, groupRounds]) => (
                  <div key={group}>
                    {group !== theme && <p className="mb-2 text-xs text-zinc-400">{humanizeTheme(group)}</p>}
                    <ol className="space-y-3">{groupRounds.map(renderRound)}</ol>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {naRounds.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-400">Not comparable on these axes</h2>
          <ol className="mt-4 space-y-3 opacity-60">{naRounds.map(renderRound)}</ol>
        </div>
      )}
    </div>
  )
}
