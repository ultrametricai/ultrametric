import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ArenaVendorList from '@/components/ArenaVendorList'
import { findOpenModulePage, loadOpenModulePages } from '@/lib/openModulePages'

// One open module (founder 2026-10-05): the committed registry entry
// (processes/business-logic-map.json) rendered as a page — the module's functional description
// (the open-modules/README.md index's "What it computes" cell, read back, never paraphrased),
// its docs section and source file on GitHub, the corpus processes it serves, and the judged
// vendor markets covering those processes. The vendor lists are COMPUTED
// (lib/openModulePages.ts → lib/arenaLeaders.ts): the processes' steps' function mappings name
// the covering arenas, each arena contributes its committed leaderboard leaders with their
// Overall scores — the same rankings the arena pages publish, never a hand-picked list. Fully
// static, params from the registry, unknown ids 404 (same contract as app/family/[id]).

export function generateStaticParams() {
  return loadOpenModulePages().map((m) => ({ id: m.id }))
}

export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const mod = findOpenModulePage(id)
  return {
    title: `${mod ? mod.label : id} — Open modules — Ultrametric`,
    description: mod
      ? `${mod.computes}. The founder processes this open module serves, and the judged vendor markets covering their steps.`
      : undefined,
  }
}

export default async function OpenModulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const mod = findOpenModulePage(id)
  if (!mod) notFound()

  return (
    <div className="space-y-8">
      <section>
        <p className="text-[10px] uppercase tracking-widest text-zinc-400">
          <Link href="/open-modules" className="hover:text-emerald-300">Open modules</Link>
          <span className="mx-1 text-zinc-600">/</span>
          <span className="font-mono normal-case">{mod.sourceFile}</span>
        </p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          {mod.label}
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">{mod.computes}</p>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <a
            href={mod.readmeHref}
            target="_blank"
            rel="noopener noreferrer"
            title="The module's documentation — contract, worked examples replayed from the cited sources, honesty boundaries — in open-modules/README.md on GitHub"
            className="rounded-full border border-zinc-800 px-2 py-0.5 text-zinc-400 transition hover:border-emerald-400/60 hover:text-emerald-300"
          >
            Module docs ↗
          </a>
          <a
            href={mod.sourceHref}
            target="_blank"
            rel="noopener noreferrer"
            title="The module's source — pure, deterministic, every formula citing a published source"
            className="rounded-full border border-zinc-800 px-2 py-0.5 font-mono text-zinc-400 transition hover:border-emerald-400/60 hover:text-emerald-300"
          >
            {mod.sourceFile} ↗
          </a>
        </p>
      </section>

      <section>
        <h2 className="font-display leading-[1.1] text-xl font-semibold tracking-tight">
          Processes it serves
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          The corpus processes wired to this module in{' '}
          <code>processes/business-logic-map.json</code> — the same committed registry that puts
          the module&rsquo;s chip on each process page.
        </p>
        <ul className="mt-3 space-y-1.5 text-sm">
          {mod.processes.map((p) => (
            <li key={p.id} className="flex items-baseline gap-2">
              <Link
                href={p.href}
                className="text-zinc-300 underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300"
              >
                {p.title}
              </Link>
              <span className="text-xs text-zinc-600">{p.area}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display leading-[1.1] text-xl font-semibold tracking-tight">
          Vendors serving these processes today
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Computed, never picked: the steps of the processes above carry committed function
          mappings onto covering arenas, and each arena shows its current leaderboard leaders
          with their Overall scores — the same judged rankings the arena pages publish.
        </p>
        {mod.arenas.length > 0 ? (
          <ArenaVendorList arenas={mod.arenas} />
        ) : (
          <p className="mt-3 text-sm text-zinc-500">
            No populated arena covers these processes&rsquo; steps yet — there is no judged
            vendor list to derive. The processes above still carry their step-by-step flows.
          </p>
        )}
      </section>
    </div>
  )
}
