'use client'

import Link from 'next/link'
import { useMemo, useState, useSyncExternalStore } from 'react'
import { ADMIN_FLAG_KEY, isAdminEmail } from '@/components/DoViaAfk'
import { useSession } from '@/lib/session'
import type {
  ArenaCoverage,
  CronHealth,
  DepthCoverage,
  NewsCoverage,
} from '@/lib/opsCoverage'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// The /ops coverage dashboard body — ADMIN-GATED like components/DoViaAfk.tsx (the precedent):
// a WorkOS session email on NEXT_PUBLIC_ADMIN_EMAILS, ANY verified @ultrametric.ai session
// (founder 2026-09-23: "signed in with *@ultrametric.ai and verified by code" — WorkOS login IS
// the code verification, so an authenticated session email is a verified email), or the
// founder's local `localStorage.setItem('pa-admin', '1')` switch, read client-side with a
// `false` server snapshot. Non-staff get literally NOTHING rendered — no hidden markup below
// the shell note.
//
// The gate is about FOCUS, not secrecy: every number in the serialized props is an aggregate of
// data/ files that copy-data.mjs already serves world-readable (spike-queue.json, vendor-news
// .json, evidence dirs…). Hiding the assembled view keeps an operational cockpit out of casual
// reach (the /queue "reachable by URL only" convention), it does not — and cannot — hide the
// underlying public data, so nothing here may ever be treated as a secret.

function readAdminFlag(): boolean {
  try {
    return window.localStorage.getItem(ADMIN_FLAG_KEY) === '1'
  } catch {
    return false
  }
}

function subscribeAdminFlag(callback: () => void): () => void {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

const getServerAdminFlag = () => false

// Pure so the gate is unit-testable: a verified company address. WorkOS only issues a session
// after its email code check, so session.email carries a VERIFIED address by construction.
export function isCompanyEmail(email: string | undefined): boolean {
  return !!email && /@ultrametric\.ai$/i.test(email.trim())
}

export interface OpsData {
  depth: DepthCoverage
  arenaCoverage: ArenaCoverage
  cron: CronHealth
  news: NewsCoverage
  builtAt: string
}

function shortDate(iso: string | null): string {
  if (!iso) return 'never'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()} '${String(d.getUTCFullYear()).slice(2)}`
}

function Headline({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 px-4 py-3" title={title}>
      <div className="text-xl font-bold tabular-nums text-zinc-100">{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
    </div>
  )
}

function SectionHead({ id, title, blurb }: { id: string; title: string; blurb: string }) {
  return (
    <div>
      <h2 id={id} className="font-display text-xl font-bold tracking-tight">
        {title}
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-zinc-400">{blurb}</p>
    </div>
  )
}

export default function OpsDashboard({ data }: { data: OpsData }) {
  // Hooks run unconditionally (rules of hooks); the admin gate comes after.
  const session = useSession()
  const localFlag = useSyncExternalStore(subscribeAdminFlag, readAdminFlag, getServerAdminFlag)
  const [vendorFilter, setVendorFilter] = useState('')
  const [agenticOnly, setAgenticOnly] = useState(false)

  const newsVendors = useMemo(() => {
    const seen = new Map<string, string>()
    for (const i of data.news.items) if (!seen.has(i.productId)) seen.set(i.productId, i.productName)
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [data.news.items])

  const emailAdmin =
    session.state === 'authenticated' &&
    (isAdminEmail(session.email, process.env.NEXT_PUBLIC_ADMIN_EMAILS) || isCompanyEmail(session.email))
  if (!emailAdmin && !localFlag) return null

  const { depth, arenaCoverage, cron, news } = data
  const shownItems = news.items.filter(
    (i) => (!vendorFilter || i.productId === vendorFilter) && (!agenticOnly || i.agentic),
  )

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm uppercase tracking-widest text-emerald-400">Founder ops — unlinked, admin-gated</p>
        <h1 className="font-display mt-1 text-3xl font-bold leading-[1.1] tracking-tight">Coverage &amp; engines</h1>
        <p className="mt-2 max-w-3xl text-zinc-400">
          How deep every vendor is tested, which arenas are live vs planned, whether the engines are
          actually running, and what the vendors themselves shipped lately. All numbers are aggregates
          of committed <span className="font-mono">data/</span> artifacts, as of last build
          ({shortDate(data.builtAt)}).
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Sections:{' '}
          <a href="#depth" className="text-emerald-300 hover:text-emerald-200">depth</a> ·{' '}
          <a href="#arenas" className="text-emerald-300 hover:text-emerald-200">arena coverage</a> ·{' '}
          <a href="#crons" className="text-emerald-300 hover:text-emerald-200">cron health</a> ·{' '}
          <a href="#news" className="text-emerald-300 hover:text-emerald-200">vendor news</a> ·{' '}
          <a href="#respike" className="text-emerald-300 hover:text-emerald-200">re-spike list</a>
        </p>
      </div>

      {/* ------------------------------------------------ 1. depth coverage */}
      <section className="space-y-4">
        <SectionHead
          id="depth"
          title="Depth coverage"
          blurb="Evidence depth per arena: median/min evidence per product, share of judged (non-na) verdicts citing probe- or github-tier evidence, and spike freshness from data/spike-queue.json. Arenas sorted thinnest-first."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Headline label="Arenas live" value={String(depth.fleet.arenas)} />
          <Headline label="Products" value={String(depth.fleet.products)} />
          <Headline label="Verdicts" value={depth.fleet.verdicts.toLocaleString('en-US')} />
          <Headline label="Evidence items" value={depth.fleet.evidenceItems.toLocaleString('en-US')} />
          <Headline
            label="Probe/GitHub-backed"
            value={`${depth.fleet.probeBackedPct}%`}
            title="Share of non-na verdicts citing at least one probe- or github-tier evidence item"
          />
          <Headline
            label="Never spiked"
            value={String(depth.fleet.neverSpiked)}
            title={`Median evidence/product: ${depth.fleet.medianEvidencePerProduct} · oldest spike ${depth.fleet.oldestSpikeDays ?? '—'}d`}
          />
        </div>
        <div className={TABLE_SHELL}>
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className={TABLE_HEADER_ROW}>
                <th className="px-3 py-2 font-normal">Arena</th>
                <th className="px-3 py-2 font-normal">Products</th>
                <th className="px-3 py-2 font-normal" title="Median evidence items per product">Med. ev</th>
                <th className="px-3 py-2 font-normal" title="Thinnest product's evidence count">Min ev</th>
                <th className="px-3 py-2 font-normal" title="% of non-na verdicts citing probe/github-tier evidence">Probe-backed</th>
                <th className="px-3 py-2 font-normal" title={`Products at/below the fleet bottom-decile evidence count (≤${depth.fleet.bottomDecileThreshold})`}>Thin tail</th>
                <th className="px-3 py-2 font-normal" title="Queue products never deep-refreshed by the spike engine">Never spiked</th>
                <th className="px-3 py-2 font-normal" title="Age of the arena's stalest lastSpiked product">Oldest spike</th>
              </tr>
            </thead>
            <tbody>
              {depth.arenas.map((a) => (
                <tr key={a.arenaId} className="border-b border-zinc-900 last:border-0">
                  <td className="px-3 py-1.5">
                    <Link href={`/arena/${a.arenaId}`} className="text-emerald-300 hover:text-emerald-200">
                      {a.arenaName}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5 font-mono tabular-nums">{a.products}</td>
                  <td className="px-3 py-1.5 font-mono tabular-nums">{a.medianEvidence}</td>
                  <td className="px-3 py-1.5 font-mono tabular-nums text-zinc-400" title={a.minEvidenceProductId}>
                    {a.minEvidence}
                  </td>
                  <td className="px-3 py-1.5 font-mono tabular-nums">{a.probeBackedPct}%</td>
                  <td className="px-3 py-1.5 text-xs text-zinc-400">
                    {a.bottomDecile.length === 0
                      ? '—'
                      : a.bottomDecile.map((p, i) => (
                          <span key={p.productId}>
                            {i > 0 && ', '}
                            <Link href={`/arena/${a.arenaId}/product/${p.productId}`} className="text-amber-300 hover:text-amber-200">
                              {p.name}
                            </Link>
                            <span className="text-zinc-500"> ({p.evidence})</span>
                          </span>
                        ))}
                  </td>
                  <td className={`px-3 py-1.5 font-mono tabular-nums ${a.neverSpiked > 0 ? 'text-amber-300' : 'text-zinc-500'}`}>
                    {a.neverSpiked}
                  </td>
                  <td className="px-3 py-1.5 font-mono tabular-nums text-zinc-400" title={a.stalestProductId ?? undefined}>
                    {a.oldestSpikeDays === null ? '—' : `${a.oldestSpikeDays}d`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------------------------------ 2. arena coverage */}
      <section className="space-y-4">
        <SectionHead
          id="arenas"
          title="Arena coverage"
          blurb="Live arenas vs data/arena-roadmap.json, plus the missing-vendor census: every process-corpus vendor chip with no VENDOR_ARENA mapping — the honest unlinked chips — with step counts and the arena the corpus implies."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Headline label="Arenas live" value={String(arenaCoverage.liveArenas)} />
          <Headline label="Roadmap: planned" value={String(arenaCoverage.plannedArenas.length)} />
          <Headline
            label="Roadmap drift"
            value={String(arenaCoverage.liveNotPopulated.length + arenaCoverage.populatedNotInRoadmap.length)}
            title={`says-live-but-unpopulated: ${arenaCoverage.liveNotPopulated.join(', ') || 'none'} · populated-but-unlisted: ${arenaCoverage.populatedNotInRoadmap.join(', ') || 'none'}`}
          />
          <Headline label="Untracked vendors" value={String(arenaCoverage.untrackedVendors.length)} />
        </div>
        {arenaCoverage.plannedArenas.length > 0 && (
          <div className="rounded-xl border border-zinc-800 p-4 text-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Planned, not yet live</p>
            <p className="mt-2 text-zinc-300">
              {arenaCoverage.plannedArenas.map((r, i) => (
                <span key={r.id}>
                  {i > 0 && ' · '}
                  {r.name}
                  <span className="text-zinc-500">
                    {' '}
                    ({r.status}
                    {r.tier !== null ? `, T${r.tier}` : ''})
                  </span>
                </span>
              ))}
            </p>
          </div>
        )}
        <div className={TABLE_SHELL}>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className={TABLE_HEADER_ROW}>
                <th className="px-3 py-2 font-normal">Untracked vendor</th>
                <th className="px-3 py-2 font-normal" title="Process-corpus steps naming this vendor as canonical vendor or vendorOption">Steps</th>
                <th className="px-3 py-2 font-normal" title="Most common optionsArenaId among those steps — where this vendor would slot if tracked">Implied arena</th>
              </tr>
            </thead>
            <tbody>
              {arenaCoverage.untrackedVendors.map((v) => (
                <tr key={v.vendor} className="border-b border-zinc-900 last:border-0">
                  <td className="px-3 py-1.5 text-zinc-100">
                    {v.label} <span className="font-mono text-xs text-zinc-500">{v.vendor}</span>
                  </td>
                  <td className="px-3 py-1.5 font-mono tabular-nums">{v.steps}</td>
                  <td className="px-3 py-1.5 text-zinc-400">
                    {v.impliedArena ? (
                      <Link href={`/arena/${v.impliedArena}`} className="text-emerald-300 hover:text-emerald-200">
                        {v.impliedArena}
                      </Link>
                    ) : (
                      <span className="text-zinc-500">no arena yet</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------------------------------ 3. cron health */}
      <section className="space-y-4">
        <SectionHead
          id="crons"
          title="Cron / engine health"
          blurb="Schedules as configured in .github/workflows, and last-run evidence inferred from committed artifacts — a static export can't call the GitHub API, so every date here is as of last build."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <div className={TABLE_SHELL}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={TABLE_HEADER_ROW}>
                  <th className="px-3 py-2 font-normal">Workflow</th>
                  <th className="px-3 py-2 font-normal">Schedule</th>
                </tr>
              </thead>
              <tbody>
                {cron.workflows.map((w) => (
                  <tr key={w.file} className="border-b border-zinc-900 last:border-0">
                    <td className="px-3 py-1.5">
                      <span className="text-zinc-100">{w.name}</span>{' '}
                      <span className="font-mono text-xs text-zinc-500">{w.file}</span>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs text-zinc-300">
                      {w.crons.length > 0 ? w.crons.join(' · ') : w.triggers.join(' · ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={TABLE_SHELL}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={TABLE_HEADER_ROW}>
                  <th className="px-3 py-2 font-normal">Engine</th>
                  <th className="px-3 py-2 font-normal" title="Newest date in the committed artifact — as of last build">Last evidence</th>
                </tr>
              </thead>
              <tbody>
                {cron.lastRuns.map((r) => (
                  <tr key={r.label} className="border-b border-zinc-900 last:border-0">
                    <td className="px-3 py-1.5 text-zinc-300" title={r.source}>
                      {r.label}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs tabular-nums text-zinc-300">{shortDate(r.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="max-w-3xl rounded-xl border border-zinc-800 p-4 text-xs leading-relaxed text-zinc-400">
          {cron.sessionCronNote}
        </p>
      </section>

      {/* ------------------------------------------------ 4. vendor news */}
      <section className="space-y-4">
        <SectionHead
          id="news"
          title="Vendor news monitor"
          blurb="Recent blog/changelog post titles per tracked vendor (pipeline/scripts/watch-vendor-news.ts — RSS first, anchor scrape fallback, budgeted and resumable). Agentic-relevant titles are keyword-flagged for focus; flags never touch any Overall score."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Headline label="Sources checked" value={String(news.sourcesChecked)} title={news.generatedAt ? `last run ${shortDate(news.generatedAt)}` : 'not yet run'} />
          <Headline label="Live feeds (RSS/Atom)" value={String(news.feedSources)} />
          <Headline label="Items" value={String(news.items.length)} />
          <Headline label="Agentic-flagged" value={String(news.agenticCount)} />
        </div>
        {news.budget && (
          <p className="text-xs text-zinc-500">
            Last run spent {news.budget.used}/{news.budget.cap} fetches
            {news.budget.exhausted ? ' — budget exhausted, honest partial; the next run resumes from the least-recently-checked vendor.' : '.'}
          </p>
        )}

        {/* re-spike cross-signal first — it's the actionable list */}
        <div id="respike" className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-4">
          <p className="text-xs uppercase tracking-wide text-amber-300">
            Re-spike these — agentic post newer than last spike ({news.respike.length})
          </p>
          {news.respike.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">
              No tracked vendor has an agentic-flagged post newer than its last spike. (Dateless scraped
              items can&apos;t prove recency and only count for never-spiked vendors.)
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {news.respike.map((r) => (
                <li key={`${r.arenaId}/${r.productId}`}>
                  <Link href={`/arena/${r.arenaId}/product/${r.productId}`} className="font-medium text-emerald-300 hover:text-emerald-200">
                    {r.productName}
                  </Link>{' '}
                  <span className="text-zinc-500">
                    last spiked {shortDate(r.lastSpiked)} · post {r.newestAgenticDate ?? 'undated'}:
                  </span>{' '}
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-zinc-300 underline decoration-zinc-600 hover:text-zinc-100">
                    {r.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2 text-zinc-400">
            Vendor
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200"
            >
              <option value="">all ({newsVendors.length})</option>
              {newsVendors.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-zinc-400">
            <input type="checkbox" checked={agenticOnly} onChange={(e) => setAgenticOnly(e.target.checked)} />
            agentic-flagged only
          </label>
          <span className="text-xs text-zinc-500">{shownItems.length} shown</span>
        </div>

        {news.items.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 p-4 text-sm text-zinc-400">
            No news state yet — run <span className="font-mono">pnpm tsx pipeline/scripts/watch-vendor-news.ts</span> to
            seed <span className="font-mono">data/vendor-news.json</span>.
          </div>
        ) : (
          <div className={TABLE_SHELL}>
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className={TABLE_HEADER_ROW}>
                  <th className="px-3 py-2 font-normal">Date</th>
                  <th className="px-3 py-2 font-normal">Vendor</th>
                  <th className="px-3 py-2 font-normal">Post</th>
                </tr>
              </thead>
              <tbody>
                {shownItems.map((i) => (
                  <tr
                    key={`${i.productId}:${i.url}`}
                    className={`border-b border-zinc-900 last:border-0 ${i.agentic ? 'bg-emerald-950/25' : ''}`}
                  >
                    <td className="px-3 py-1.5 font-mono text-xs tabular-nums text-zinc-400">{i.date ?? '—'}</td>
                    <td className="px-3 py-1.5">
                      <Link href={`/arena/${i.arenaId}/product/${i.productId}`} className="text-emerald-300 hover:text-emerald-200">
                        {i.productName}
                      </Link>
                    </td>
                    <td className="px-3 py-1.5">
                      {i.agentic && (
                        <span className="mr-2 inline-flex rounded-full bg-emerald-950 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300 ring-1 ring-emerald-800">
                          agentic
                        </span>
                      )}
                      <a href={i.url} target="_blank" rel="noopener noreferrer" className="text-zinc-200 underline decoration-zinc-700 underline-offset-2 hover:text-zinc-50">
                        {i.title}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
