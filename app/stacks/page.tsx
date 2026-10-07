import type { Metadata } from 'next'
import Link from 'next/link'
import ColumnsHelpLink from '@/components/ColumnsHelpLink'
import ProductLogoView from '@/components/ProductLogoView'
import { loadAll } from '@/lib/data'
import { hasLogo } from '@/lib/logos'
import { metricLabel, resolveAllStacks } from '@/lib/aiStacks'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

export const metadata: Metadata = {
  title: 'AI Stacks — Ultrametric',
  description:
    'Best evidence-backed pairings for going agentic: OS, local model runtime, coding agent, and the founder ops layer — every scored pick resolved live from the published rankings.',
}

// Cross-arena curated stacks: each scored slot is resolved at build time from the current arena
// leaderboards (see lib/aiStacks.ts), so the picks on this page move whenever the evidence
// moves — nothing here is a hand-maintained claim except the clearly-labeled editorial slots.
export default function StacksPage() {
  const categories = loadAll()
  const stacks = resolveAllStacks(categories)

  return (
    <div className="space-y-12">
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">AI Stacks</h1>
        <p className="mx-auto mt-3 max-w-2xl text-zinc-400">
          The best pairings for going agentic — picked by evidence, not vibes. Every scored slot
          below is the current #1 of its ranking on the named metric, resolved live from the same
          rankings as the rest of the site; slots we can&rsquo;t score yet are labeled as
          AI judgement.
        </p>
        <p className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/stacks/builder"
            className="inline-flex items-center rounded-full border border-emerald-400/40 px-4 py-1.5 text-sm text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-400/10"
          >
            Build your own →
          </Link>
          <Link
            href="/my-stack"
            className="inline-flex items-center rounded-full border border-zinc-800 px-4 py-1.5 text-sm text-zinc-300 transition hover:border-emerald-400/40 hover:text-emerald-300"
          >
            Get upgrades for the stack you run →
          </Link>
          <Link
            href="/stacks/battle"
            className="inline-flex items-center rounded-full border border-zinc-800 px-4 py-1.5 text-sm text-zinc-300 transition hover:border-emerald-400/40 hover:text-emerald-300"
          >
            Battle of the stacks →
          </Link>
          {/* Founder 2026-10-02: the honest house path for proposing a stack — a prefilled
              issue that feeds curation review; stacks stay curated committed data, nothing
              auto-publishes. */}
          <a
            href="https://github.com/ultrametricai/ultrametric/issues/new?template=submit-stack.yml"
            target="_blank"
            rel="noopener noreferrer"
            title="Propose a stack via a prefilled GitHub issue — submissions feed curation review, never auto-publish"
            className="inline-flex items-center rounded-full border border-zinc-800 px-4 py-1.5 text-sm text-zinc-300 transition hover:border-emerald-400/40 hover:text-emerald-300"
          >
            Submit your stack →
          </a>
        </p>
      </section>

      {stacks.map((stack) => (
        <section key={stack.id} id={stack.id} className="scroll-mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display leading-[1.1] flex items-center gap-2 text-xl font-semibold tracking-tight">{stack.personaIcon && <span aria-hidden title={`Persona: ${stack.audience}`}>{stack.personaIcon}</span>}{stack.name}</h2>
            <Link
              href={`/stacks/battle?a=${stack.id}`}
              title={`Put the ${stack.name} up against another stack's aggregates`}
              className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400 transition hover:border-emerald-400/40 hover:text-emerald-300"
            >
              Battle this stack →
            </Link>
          </div>
          <p className="mt-1 text-sm text-zinc-400">{stack.tagline}</p>
          <p className="mt-0.5 text-xs text-zinc-500">For: {stack.audience}</p>
          <div className={`mt-4 ${TABLE_SHELL}`}>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className={TABLE_HEADER_ROW}>
                  <th scope="col" className="px-3 py-2 font-normal"><span title="The role this slot fills in the stack">Layer</span></th>
                  <th scope="col" className="px-3 py-2 font-normal"><span title="The product filling this slot — scored picks resolve live from the ranking; unscored slots are labeled AI judgement">Pick</span></th>
                  <th scope="col" className="hidden px-3 py-2 font-normal md:table-cell"><span title="The curators' one-line reason this slot exists">Why this pick</span></th>
                  <th scope="col" className="hidden px-3 py-2 font-normal sm:table-cell">
                    <span className="inline-flex items-center gap-1.5">
                      <span title="The judged score behind the pick and its position in the ranking">Evidence</span>
                      <ColumnsHelpLink />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {stack.slots.map((slot) => (
                  <tr key={slot.role} className="transition hover:bg-zinc-900/50">
                    <td className="px-3 py-2.5 align-top">
                      {/* Founder 2026-09-15: the layer name is the way into its arena — clickable
                          whenever the slot resolves to one; editorial slots stay plain text. */}
                      {slot.arenaId ? (
                        <Link
                          href={`/arena/${slot.arenaId}`}
                          title={`See the full ${slot.role} ranking`}
                          className="font-medium underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300"
                        >
                          {slot.role}
                        </Link>
                      ) : (
                        <span className="font-medium">{slot.role}</span>
                      )}
                      <p className="mt-0.5 max-w-[220px] text-xs text-zinc-500">{slot.why}</p>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      {slot.kind !== 'editorial' && slot.productId && slot.arenaId ? (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Link
                            href={`/arena/${slot.arenaId}/product/${slot.productId}`}
                            className="flex items-center gap-2 hover:text-emerald-300"
                          >
                            <ProductLogoView
                              product={{ id: slot.productId, name: slot.productName ?? slot.productId }}
                              size={24}
                              hasLogo={hasLogo(slot.productId)}
                            />
                            <span className="font-medium">{slot.productName}</span>
                          </Link>
                          {slot.coPick && (
                            <>
                              <span className="text-xs text-zinc-500">or</span>
                              <Link
                                href={`/arena/${slot.arenaId}/product/${slot.coPick.productId}`}
                                className="flex items-center gap-2 hover:text-emerald-300"
                              >
                                <ProductLogoView
                                  product={{ id: slot.coPick.productId, name: slot.coPick.productName }}
                                  size={24}
                                  hasLogo={hasLogo(slot.coPick.productId)}
                                />
                                <span className="font-medium">{slot.coPick.productName}</span>
                              </Link>
                            </>
                          )}
                        </div>
                      ) : (
                        <a
                          href={slot.editorialUrl ?? '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:text-emerald-300"
                        >
                          {slot.editorialName} ↗
                        </a>
                      )}
                      {slot.kind === 'arena-top' && slot.coPick && (
                        <p className="mt-0.5 text-xs text-zinc-500">
                          too close to call (Δ{((slot.metricValue ?? 0) - slot.coPick.metricValue).toFixed(1)}) — either is a strong pick
                        </p>
                      )}
                      {slot.kind === 'arena-top' && !slot.coPick && slot.runnerUpName && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                          runner-up:{' '}
                          {slot.runnerUpId && (
                            <ProductLogoView
                              product={{ id: slot.runnerUpId, name: slot.runnerUpName }}
                              size={16}
                              hasLogo={hasLogo(slot.runnerUpId)}
                            />
                          )}
                          {slot.runnerUpName}
                        </p>
                      )}
                    </td>
                    <td className="hidden max-w-[280px] px-3 py-2.5 align-top text-xs text-zinc-400 md:table-cell">
                      {slot.kind === 'arena-top' &&
                        `${slot.coPick ? 'top two' : '#1'} of ${slot.fieldSize} in ${slot.arenaName} by ${metricLabel(slot.metric ?? '')}`}
                      {slot.kind === 'product' && slot.curatedNote}
                      {slot.kind === 'editorial' && slot.editorialNote}
                    </td>
                    <td className="hidden px-3 py-2.5 align-top sm:table-cell">
                      {slot.kind !== 'editorial' && slot.arenaId ? (
                        <span className="whitespace-nowrap font-mono text-xs">
                          <span className="text-emerald-400">{slot.metricValue?.toFixed(0)}</span>
                          <span className="text-zinc-500">/100 · </span>
                          {slot.kind === 'product' && (
                            <span className="text-zinc-500">#{slot.rank} of {slot.fieldSize} · </span>
                          )}
                          <Link href={`/arena/${slot.arenaId}`} className="text-zinc-400 underline decoration-zinc-700 hover:text-emerald-300">
                            full ranking
                          </Link>
                        </span>
                      ) : (
                        <span className="rounded-full border border-amber-800/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-400/90" title="No ranking scores this slot yet — the pick is AI judgement over the market, not a judged leaderboard position">
                          AI judgement
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="mx-auto max-w-3xl text-center text-sm text-zinc-500">
        <p>
          Disagree with a pick? Every scored slot traces to a ranking — contest the
          underlying verdicts and the stack updates itself. Run a stack founders should see?{' '}
          <a
            href="https://github.com/ultrametricai/ultrametric/issues/new?template=submit-stack.yml"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 underline decoration-emerald-400/40 hover:text-emerald-300"
          >
            Submit your stack
          </a>{' '}
          — submissions feed curation review, never auto-publish.{' '}
          <Link href="/" className="text-emerald-400 underline decoration-emerald-400/40 hover:text-emerald-300">
            See all rankings →
          </Link>
        </p>
      </section>
    </div>
  )
}
