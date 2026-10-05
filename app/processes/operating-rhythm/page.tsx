import type { Metadata } from 'next'
import Link from 'next/link'
import CeilingBar from '@/components/CeilingBar'
import GeoMark from '@/components/GeoMark'
import IconChip from '@/components/IconChip'
import ProductLogoView from '@/components/ProductLogoView'
import RhythmTimeline from '@/components/RhythmTimeline'
import { hasLogo } from '@/lib/logos'
import { processIcon } from '@/lib/processIcons'
import {
  CADENCE_META, loadProcesses, processesByCadence, processSlug, taskCeiling,
  VENDOR_ARENA, vendorLabel, vendorProductId, type ProcessTask,
} from '@/lib/processes'

// The operating rhythm — "what really happens in a company": the same founder-process corpus as
// /processes, sliced by the honest recurrence axis (the `cadence` field) instead of lifecycle
// phase. Formation pages tell you what a startup does ONCE; this page is the x-ray of what it
// does every day/week/month/quarter/year — and what only fires on a trigger — each process
// wearing its agent ceiling and the software it runs on. Static, server-rendered, pure
// derivation from processes/corpus.json.

export const metadata: Metadata = {
  title: 'Operating rhythm — a year of running a startup — Ultrametric',
  description:
    'What a startup actually does, on the record: the recurring operations x-ray. Which founder processes run daily, weekly, monthly, quarterly, or annually — with each one’s Agentic % and the software that runs it.',
}

function ProcessCard({ task }: { task: ProcessTask }) {
  const ceiling = taskCeiling(task)
  const vendors = [...new Set(task.vendors)].map((v) => {
    const id = vendorProductId(v)
    return { id, label: vendorLabel(v), arena: VENDOR_ARENA[v] ?? null, hasLogo: hasLogo(id) }
  })
  return (
    <div className="rounded-xl border border-zinc-800 p-3 transition hover:border-emerald-400/40">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <IconChip icon={processIcon(task.id)} title={`${task.title} — ${task.phase} process`} />
          <Link
            href={`/processes/${processSlug(task.title)}`}
            className="min-w-0 truncate text-sm font-medium transition hover:text-emerald-300"
          >
            {task.title}
          </Link>
        </span>
        {/* The current agent ceiling — the share of this process's steps an agent can run today. */}
        <CeilingBar pct={ceiling.pct} className="shrink-0" />
      </div>
      {vendors.length > 0 && (
        <span className="mt-2 flex flex-wrap items-center gap-1">
          {vendors.slice(0, 3).map((v) =>
            v.arena ? (
              <Link
                key={v.label}
                href={`/arena/${v.arena}/product/${v.id}`}
                title={`${v.label} on Ultrametric — the judged product page`}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-700 py-px pl-0.5 pr-1.5 text-[10px] text-zinc-300 transition hover:border-emerald-400/60 hover:text-emerald-300"
              >
                <ProductLogoView product={{ id: v.id, name: v.label }} size={14} hasLogo={v.hasLogo} />
                {v.label}
              </Link>
            ) : (
              <span
                key={v.label}
                title={`${v.label} — not yet judged on Ultrametric`}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-800 py-px pl-0.5 pr-1.5 text-[10px] text-zinc-500"
              >
                <ProductLogoView product={{ id: v.id, name: v.label }} size={14} hasLogo={v.hasLogo} />
                {v.label}
              </span>
            ),
          )}
          {vendors.length > 3 && <span className="text-[10px] text-zinc-500">+{vendors.length - 3}</span>}
        </span>
      )}
    </div>
  )
}

export default function OperatingRhythmPage() {
  const tasks = loadProcesses()
  const groups = processesByCadence(tasks)
  const onCalendar = tasks.filter((t) =>
    t.cadence === 'daily' || t.cadence === 'weekly' || t.cadence === 'monthly'
    || t.cadence === 'quarterly' || t.cadence === 'annual').length
  const onTrigger = tasks.filter((t) => t.cadence === 'event-driven').length
  const setup = tasks.filter((t) => t.cadence === 'once').length

  return (
    <div className="space-y-10">
      <div>
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-500">
          <Link href="/processes" className="transition hover:text-emerald-300">Processes</Link>
          <span aria-hidden className="text-zinc-700">→</span>
          <span className="text-zinc-400">Operating rhythm</span>
        </nav>
        <h1 className="font-display leading-[1.1] mt-2 flex items-center gap-2.5 text-3xl font-bold tracking-tight">
          <GeoMark
            seed="operating-rhythm"
            title="Operating rhythm — the recurring-operations view of the process corpus"
            size={24}
            className="text-zinc-500"
          />
          The operating rhythm
        </h1>
        <p className="mt-3 max-w-3xl text-zinc-400">
          A year of running a startup. Incorporation happens once — then the company is
          a set of loops: code ships daily, payroll runs and the books close monthly, the board
          meets quarterly, the franchise tax comes due every year, and a hire or a cancellation
          can fire off a process any afternoon. Same corpus as{' '}
          <Link href="/processes" className="text-emerald-400 underline decoration-emerald-400/40 hover:text-emerald-300">
            all {tasks.length} processes
          </Link>
          , sliced by how often each one really recurs — with its Agentic % and the software
          that runs it.
        </p>
        <p className="mt-3 text-sm text-zinc-500">
          <span className="tabular-nums text-emerald-300">{onCalendar}</span> processes live on
          the calendar · <span className="tabular-nums text-zinc-300">{onTrigger}</span> fire on
          a trigger · <span className="tabular-nums text-zinc-300">{setup}</span> are one-time
          setup
        </p>
      </div>

      <RhythmTimeline
        rows={groups.map((g) => ({ cadence: g.cadence, label: CADENCE_META[g.cadence].label, count: g.tasks.length }))}
      />

      {groups.map((g) => (
        <section key={g.cadence}>
          <h2 className="font-display leading-[1.1] flex items-baseline gap-2 text-xl font-semibold tracking-tight">
            {CADENCE_META[g.cadence].label}
            <span className="text-sm tabular-nums text-zinc-500">×{g.tasks.length}</span>
          </h2>
          <p className="mt-1 text-sm text-zinc-400">{CADENCE_META[g.cadence].blurb}</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.tasks.map((t) => (
              <ProcessCard key={t.id} task={t} />
            ))}
          </div>
        </section>
      ))}

      <section className="mx-auto max-w-3xl text-center text-sm text-zinc-500">
        <p>
          Cadences are curated by hand from each process&apos;s real-world recurrence — and every
          process clicks through to its step-by-step DAG and simulator.{' '}
          <Link
            href="/processes"
            className="text-emerald-400 underline decoration-emerald-400/40 hover:text-emerald-300"
          >
            Browse the full corpus →
          </Link>
        </p>
      </section>
    </div>
  )
}
