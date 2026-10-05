import Link from 'next/link'
import CeilingBar from '@/components/CeilingBar'
import IconChip from '@/components/IconChip'
import UrgencyChip from '@/components/UrgencyChip'
import type { ProcessRow } from '@/components/ProcessesTable'
import { usFlagGlyph } from '@/lib/geoPreference'
import { phaseIcon, phaseTooltip } from '@/lib/processIcons'

// The /situations index table (founder 2026-10-02: situations get their own area — the rows
// moved OUT of the /processes table). Deliberately a LEAN DEDICATED server component rather
// than a reuse of ProcessesTable: twelve reactive records don't need the rank-by presets, the
// founder-timeline machinery, the playbook union, the ?order=/?phase= URL state, or the
// country-view filter — the one honest ordering is urgency (hours → days → weeks), then title,
// and the rows arrive pre-sorted from lib/processRows.ts buildSituationRows. The cell idiom
// matches the house table exactly (same borders, icon chips, urgency chips, scope glyphs,
// CeilingBar), so the two indexes read as one system.
//
// Rows link to the detail pages, which STAY at /processes/<slug> this round (URL stability).
// Scope glyphs follow the /processes rule (founder batch 2026-10-02): us/us-state rows wear
// the 🇺🇸 flag (usFlagGlyph — keyed strictly on geoScope, the label telling federal from state
// work); global rows wear no scope glyph at all.

export default function SituationsTable({ rows }: { rows: ProcessRow[] }) {
  return (
    <div className="-mx-5 overflow-x-auto border-y border-zinc-800 sm:mx-0 sm:rounded-2xl sm:border md:overflow-x-visible">
      <table className="w-full border-collapse text-sm">
        <thead>
          {/* Sentence-case headers at a readable size (founder 2026-10-05 — the ProcessesTable
              header idiom, applied wherever it repeats). */}
          <tr className="border-b border-zinc-800 text-left text-xs tracking-wide text-zinc-400">
            <th scope="col" className="px-2 py-2 font-normal">
              <span title="A reactive, trigger-driven situation — the event that puts a founder here is the subtitle">Situation</span>
            </th>
            <th scope="col" className="px-2 py-2 font-normal">
              <span title="How fast the clock really runs once the trigger lands — hours, days, or weeks">Urgency</span>
            </th>
            {/* 'Area', not 'Phase' (founder 2026-10-02): the cell renders the situation's
                domain tag (legal, compliance, finance…), not a lifecycle phase. */}
            <th scope="col" className="hidden px-2 py-2 font-normal md:table-cell">
              <span title="The honest domain of the situation (legal, compliance, finance…)">Area</span>
            </th>
            <th scope="col" className="px-2 py-2 font-normal">
              <span title="Agentic %: the share of this situation's steps an AI agent can run today — judgment, counsel, and signatures stay human">Agentic %</span>
            </th>
            {/* The Steps column is gone (founder 2026-10-02) — the detail page's step-by-step
                carries the per-step story; the Agentic % bar is the honest summary here. */}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/70">
          {rows.map((r) => {
            const href = `/processes/${r.slug}`
            const flag = usFlagGlyph(r.geoScope)
            return (
              <tr key={r.slug} className="transition hover:bg-zinc-800/70">
                <td className="max-w-[320px] px-2 py-2">
                  <span className="flex items-center gap-1.5">
                    <IconChip icon={r.icon} title={`${r.title} — ${r.phase} situation`} />
                    <Link href={href} className="font-medium hover:text-emerald-300">
                      {r.title}
                    </Link>
                    {flag !== null && (
                      <span aria-hidden className="text-[10px] opacity-70" title={flag.label}>
                        {flag.glyph}
                      </span>
                    )}
                  </span>
                  {/* The trigger — the event that puts a founder here — is the row's subtitle,
                      the same presentation the situation rows had on /processes. */}
                  {r.trigger !== null && (
                    <span className="mt-0.5 block pl-6 text-[11px] leading-snug text-zinc-500">{r.trigger}</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-2 py-2">
                  {r.urgency !== null && <UrgencyChip tier={r.urgency} />}
                </td>
                <td className="hidden px-2 py-2 text-xs text-zinc-500 md:table-cell">
                  <span className="flex items-center gap-1.5 whitespace-nowrap" title={phaseTooltip(r.phase)}>
                    <IconChip icon={phaseIcon(r.phase)} title={phaseTooltip(r.phase)} />
                    {r.phase}
                  </span>
                </td>
                <td className="px-2 py-2">
                  <CeilingBar pct={r.pct} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
