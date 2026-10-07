import type { Metadata } from 'next'
import Link from 'next/link'
import fs from 'node:fs'
import path from 'node:path'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// UNLINKED founder-review page for the spike engine (pipeline/scripts/spike-engine.ts — see
// its header for the ranking formula and churn policy). Deliberately not in app/sitemap.ts,
// the header nav, Explore menu, command palette (lib/search-index.ts PAGE_DEFS), search
// aliases, or llms.txt, and noindexed below: this is operational state for the founder,
// reachable only by typing the URL (the house unlisted-page pattern). Everything rendered here is
// verbatim from data/spike-queue.json; this page surfaces queue state, it never invents any.
// NOTE data/spike-queue.json is also world-readable at /data/spike-queue.json (copy-data.mjs
// mirrors all of data/) — unadvertised, not private, and it contains nothing sensitive.
export const metadata: Metadata = {
  title: 'Spike queue — founder review — Ultrametric',
  description: 'Internal review page for the standing spike-engine deep-refresh queue.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-static'

// Fields other than `note` are optional: the backfill orchestrator stamps minimal
// `{ note }` runs onto entries it marks done, and the page must render those too
// (caught live 2026-09-15: `urlsAdded.length` on a stamped entry failed the /queue prerender).
interface SpikeRun {
  at?: string
  urlsAdded?: string[]
  evidenceAdded?: number
  cellsRejudged?: number
  flipsKept?: number
  flipsReverted?: number
  note: string
}

interface SpikeEntry {
  arena: string
  productId: string
  name: string
  priority: number
  components: { staleness: number; stalenessSource: string; popularityBoost: number; founderBoost: number }
  // Engine statuses plus whatever the orchestrator stamps (e.g. 'done') — render, don't crash.
  status: 'due' | 'queued' | 'spiked' | 'error' | (string & {})
  lastSpiked: string | null
  nextDue: string | null
  lastRun: SpikeRun | null
}

interface SpikeQueue {
  generatedAt: string
  queue: SpikeEntry[]
}

// Tolerant read (house convention for unlisted pages): before the engine's first run the file may not
// exist — the page degrades to an honest empty state rather than failing the build.
function loadQueue(): SpikeQueue | null {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'data', 'spike-queue.json'), 'utf8')
    return JSON.parse(raw) as SpikeQueue
  } catch {
    return null
  }
}

function shortDate(iso: string | null): string {
  if (!iso) return 'never'
  const d = new Date(iso)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()} '${String(d.getUTCFullYear()).slice(2)}`
}

const STATUS_STYLES: Record<string, string> = {
  due: 'bg-amber-950 text-amber-300 ring-amber-800',
  queued: 'bg-zinc-900 text-zinc-400 ring-zinc-700',
  spiked: 'bg-emerald-950 text-emerald-300 ring-emerald-800',
  error: 'bg-red-950 text-red-300 ring-red-800',
  done: 'bg-emerald-950 text-emerald-300 ring-emerald-800',
}
const STATUS_STYLE_FALLBACK = 'bg-zinc-900 text-zinc-400 ring-zinc-700'

function StatusPill({ status }: { status: SpikeEntry['status'] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${STATUS_STYLES[status] ?? STATUS_STYLE_FALLBACK}`}
    >
      {status}
    </span>
  )
}

function changeSummary(run: SpikeRun | null): string {
  if (!run) return '—'
  const parts = [
    (run.urlsAdded?.length ?? 0) > 0 ? `+${run.urlsAdded!.length} urls` : null,
    (run.evidenceAdded ?? 0) > 0 ? `+${run.evidenceAdded} evidence` : null,
    (run.cellsRejudged ?? 0) > 0 ? `${run.flipsKept ?? 0} flips kept · ${run.flipsReverted ?? 0} reverted` : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : run.note || 'no changes'
}

export default function QueuePage() {
  const data = loadQueue()
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-widest text-emerald-400">Founder review — unlinked</p>
        <h1 className="font-display mt-1 text-3xl font-bold leading-[1.1] tracking-tight">Spike queue</h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          The standing deep-refresh engine: every judged product ranked by staleness × popularity × founder
          priority. Each engine run spikes the top due product — re-crawls its full docs surface, discovers new
          agent-era URLs from the vendor&apos;s own llms.txt, re-judges only cells whose evidence moved, and settles
          flips under the churn policy (keep only flips citing new evidence).
        </p>
        {data ? (
          <p className="mt-3 text-xs text-zinc-500">
            Queue ranked {shortDate(data.generatedAt)} · {data.queue.length} products ·{' '}
            {data.queue.filter((e) => e.status === 'due').length} due ·{' '}
            {data.queue.filter((e) => e.lastSpiked !== null).length} spiked at least once · source:{' '}
            <span className="font-mono">data/spike-queue.json</span> (pipeline/scripts/spike-engine.ts)
          </p>
        ) : null}
      </div>

      {!data || data.queue.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 p-4 text-sm text-zinc-400">
          No queue state yet — run <span className="font-mono">pnpm tsx pipeline/scripts/spike-engine.ts</span> to
          rank the fleet.
        </div>
      ) : (
        <div className={TABLE_SHELL}>
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className={TABLE_HEADER_ROW}>
                <th className="px-3 py-2 font-normal" title="Queue position — priority desc, deterministic tiebreaks">#</th>
                <th className="px-3 py-2 font-normal">Product</th>
                <th className="px-3 py-2 font-normal">Ranking</th>
                <th className="px-3 py-2 font-normal" title="staleness × popularityBoost × founderBoost — work prioritization only, never a Overall score input">
                  Priority
                </th>
                <th className="px-3 py-2 font-normal" title="0 fresh → 100 stale; from the weekly staleness report when one stands, else median evidence age">
                  Staleness
                </th>
                <th className="px-3 py-2 font-normal" title="1.25× when in the curated popular set · founder multiplier from data/spike-priorities.json">
                  Boosts
                </th>
                <th className="px-3 py-2 font-normal">Status</th>
                <th className="px-3 py-2 font-normal">Last spiked</th>
                <th className="px-3 py-2 font-normal">What changed last run</th>
              </tr>
            </thead>
            <tbody>
              {data.queue.map((e, i) => (
                <tr key={`${e.arena}/${e.productId}`} className="border-b border-zinc-900 last:border-0">
                  <td className="px-3 py-2 font-mono tabular-nums text-zinc-500">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-zinc-100">{e.name}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/arena/${e.arena}/product/${e.productId}`}
                      className="text-emerald-300 underline decoration-emerald-400/40 underline-offset-2 transition hover:text-emerald-200"
                    >
                      {e.arena}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums">{e.priority}</td>
                  <td className="px-3 py-2 font-mono tabular-nums text-zinc-400" title={`source: ${e.components.stalenessSource}`}>
                    {e.components.staleness}
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums text-zinc-400">
                    {e.components.popularityBoost}× · {e.components.founderBoost}×
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill status={e.status} />
                  </td>
                  <td className="px-3 py-2 text-zinc-400" title={e.nextDue ? `next due ${shortDate(e.nextDue)}` : 'never spiked — due now'}>
                    {shortDate(e.lastSpiked)}
                  </td>
                  <td className="px-3 py-2 max-w-md text-xs text-zinc-400" title={e.lastRun?.note ?? ''}>
                    {changeSummary(e.lastRun)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="max-w-3xl text-xs leading-relaxed text-zinc-500">
        Honesty notes: priority is a work-ordering signal only — popularity and founder boosts never touch any Overall
        score (METHODOLOGY.md, &quot;Popularity — a signal, not a score&quot;). A spike pass can only change verdicts
        through the normal judge with its cellHash cache, and every flip that cites no newly-added evidence is
        reverted (the revert-churn policy). Vendors without llms.txt contribute no discoveries — the absence is
        recorded in the run note, never papered over.
      </p>
    </div>
  )
}
