import type { Metadata } from 'next'
import Link from 'next/link'
import CeilingBar from '@/components/CeilingBar'
import GeoMark from '@/components/GeoMark'
import { IconGlyph } from '@/components/IconChip'
import { EXPLORE_SECTION_ICONS } from '@/lib/arenaIcons'
import RankingsNav from '@/components/RankingsNav'
import { loadProcesses, processSlug } from '@/lib/processes'
import { buildProcessRows } from '@/lib/processRows'
import { ordinal } from '@/lib/ordinal'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'

// 🔁 PROCESS ranking (founder 2026-09-21: Explore's views, done for processes — clearly
// labeled so it can never be mistaken for a company ranking). Ranks the process corpus by
// agent ceiling: taskCeiling()'s pct — the share of the process's DAG steps routed 'agent'
// today. Rows come straight from buildProcessRows (the same derivation /processes renders);
// nothing is re-invented here.

// Legally-required human signature acts (DagNode.legalSignature — the founder's "true human
// floor") per process, keyed by slug. These steps can never be automated away, so they are the
// honest asterisk on any automatability claim.
function signatureCounts(): Map<string, number> {
  return new Map(
    loadProcesses().map((t) => [
      processSlug(t.title),
      t.dag.nodes.filter((n) => n.legalSignature).length,
    ]),
  )
}

function buildRows() {
  const { rows } = buildProcessRows()
  return [...rows].sort(
    (a, b) => b.pct - a.pct || b.totalSteps - a.totalSteps || a.title.localeCompare(b.title),
  )
}

export function generateMetadata(): Metadata {
  const rows = buildRows()
  return {
    title: `Most automatable processes — all ${rows.length} ranked by Agentic % — Ultrametric`,
    description:
      'Every founder process ranked by its current Agentic %: the share of its steps an AI agent can run today. Derived from the judged process corpus, with legally-required signature steps counted separately.',
  }
}

// Static page — no dynamic segments, all data bundled at build time.
export const dynamic = 'force-static'

export default function MostAutomatableProcessesPage() {
  const rows = buildRows()
  const sigs = signatureCounts()

  return (
    <div className="space-y-4">
      <div>
        {/* seed "most-automatable": same concept mark as the Explore menu entry and RankingsNav. */}
        <p className="flex items-center gap-2 text-sm uppercase tracking-widest text-sky-400">
          <GeoMark seed="most-automatable" title="Most automatable — process ranking" size={16} className="text-zinc-500" />
          {/* The house loop glyph (lib/arenaIcons.ts) — same icon the Explore menu's
              Process-rankings group wears; the eyebrow text names the concept. */}
          <span aria-hidden className="inline-flex"><IconGlyph icon={EXPLORE_SECTION_ICONS.processRankings} /></span>
          Process ranking
        </p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          Most automatable — highest Agentic % today
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          This ranks <strong className="font-semibold text-zinc-200">processes, not companies</strong>: all {rows.length} founder
          processes ordered by their current Agentic % — the percentage of each process&rsquo;s steps an AI agent can run
          today (steps routed &lsquo;agent&rsquo; in the corpus DAG, over total steps; lib/processes.ts taskCeiling). Ties break
          on step count, then title. The ✍ column counts legally-required human signature acts — the floor no agent removes.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          This is the deep-linkable form of the{' '}
          <Link href="/processes" className="text-zinc-400 underline decoration-zinc-700 hover:text-emerald-300">
            /processes
          </Link>{' '}
          table&rsquo;s &ldquo;Most automatable&rdquo; preset — sort and filter it live there.
        </p>
      </div>
      <div className={TABLE_SHELL}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={TABLE_HEADER_ROW}>
              <th className="w-10 px-3 py-2 font-normal">#</th>
              <th className="px-3 py-2 font-normal">Process</th>
              <th className="px-3 py-2 font-normal" title="Agentic %: the share of this process's steps an AI agent can run today">
                Agentic %
              </th>
              <th className="px-3 py-2 font-normal" title="Agent-runnable steps / total steps in the process DAG">
                Steps
              </th>
              <th className="px-3 py-2 font-normal" title="Legally-required human signature acts (the true human floor — never automatable)">
                ✍ Signatures
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {rows.map((r, i) => (
              <tr key={r.slug} className="transition hover:bg-zinc-900/50">
                <td className="px-3 py-2 font-mono tabular-nums text-zinc-400">{ordinal(i + 1)}</td>
                <td className="px-3 py-2">
                  <Link href={`/processes/${r.slug}`} className="flex items-center gap-2 font-medium hover:text-emerald-300">
                    <span aria-hidden className="w-4 shrink-0 text-center text-xs leading-none opacity-80"><IconGlyph icon={r.icon} /></span>
                    <span className="min-w-0 truncate">{r.title}</span>
                  </Link>
                  <span className="mt-0.5 block text-xs text-zinc-500">{r.phase}</span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-10 font-mono tabular-nums text-emerald-300">{r.pct}%</span>
                    <CeilingBar pct={r.pct} className="w-24" />
                  </div>
                </td>
                <td className="px-3 py-2 font-mono tabular-nums text-zinc-300">
                  {r.agentSteps}<span className="text-zinc-500">/{r.totalSteps}</span>
                </td>
                <td className="px-3 py-2 font-mono tabular-nums">
                  {(sigs.get(r.slug) ?? 0) > 0 ? (
                    <span className="text-amber-300" title="Legally-required human signature steps in this process">
                      ✍ {sigs.get(r.slug)}
                    </span>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RankingsNav current="most-automatable" />
    </div>
  )
}
