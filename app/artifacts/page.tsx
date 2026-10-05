import type { Metadata } from 'next'
import Link from 'next/link'
import { artifactsByProducingArea } from '@/lib/artifactPages'
import { REPO } from '@/lib/site'

// /artifacts (founder 2026-10-05): the artifact registry (processes/artifacts.json) as a
// browsable index — the canonical business things that flow between the founder processes (the
// EIN, the stamped certificate, the opened bank account), grouped by the area of each
// artifact's canonical producer. Every row links the artifact's own page; the registry and the
// cross-process dependency graph built from it are documented in the open repo.
export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Artifacts — what the founder processes produce and consume — Ultrametric',
  description:
    'The canonical business artifacts flowing between the founder processes — certificates, accounts, filings, signed papers — each with its producer, its consumers, and the judged vendor markets around the steps that create it.',
}

export default function ArtifactsPage() {
  const groups = artifactsByProducingArea()
  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          Artifacts — what the founder processes produce and consume
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          The typed layer between the processes: each artifact is a nameable business thing one
          committed process step genuinely brings into existence — a stamped certificate, an
          opened account, a signed election — and other processes consume via their{' '}
          <code>requires</code> list. One canonical producer per artifact keeps the cross-process
          dependency graph a DAG. Grouped below by the producing process&rsquo;s area.
        </p>
      </section>
      {groups.map((g) => (
        <section key={g.area}>
          <h2 className="font-display text-xl font-semibold tracking-tight">{g.area}</h2>
          <div className="mt-3 rounded-2xl border border-zinc-800">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-[10px] uppercase tracking-widest text-zinc-400">
                  <th scope="col" className="px-3 py-2 font-normal">Artifact</th>
                  <th scope="col" className="hidden px-3 py-2 font-normal sm:table-cell">
                    <span title="The one canonical producer process — where this artifact comes into existence">Produced by</span>
                  </th>
                  <th scope="col" className="hidden px-3 py-2 font-normal md:table-cell">
                    <span title="Processes whose requires list carries this artifact">Needed by</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {g.artifacts.map((a) => (
                  <tr key={a.artifact.id} className="transition hover:bg-zinc-900/50">
                    <td className="px-3 py-2.5 align-top">
                      <Link
                        href={`/artifacts/${a.artifact.id}`}
                        className="text-zinc-200 transition hover:text-emerald-300"
                      >
                        {a.artifact.label}
                      </Link>
                    </td>
                    <td className="hidden px-3 py-2.5 align-top sm:table-cell">
                      <Link
                        href={a.producer.href}
                        className="text-zinc-400 transition hover:text-emerald-300"
                      >
                        {a.producer.title}
                      </Link>
                    </td>
                    <td className="hidden px-3 py-2.5 align-top text-zinc-500 md:table-cell">
                      {a.neededBy.length > 0
                        ? `${a.neededBy.length} process${a.neededBy.length === 1 ? '' : 'es'}`
                        : a.artifact.terminal
                          ? 'terminal — leaves the graph here'
                          : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p className="text-xs text-zinc-500">
        The registry lives in the open repo as <code>processes/artifacts.json</code>; the artifact
        layer and the cross-process dependency graph built from it (lib/processDeps.ts) are
        documented in{' '}
        <a
          href={`https://github.com/${REPO}/blob/main/processes/README.md#the-artifact-layer-typed-inputsoutputs`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-400 transition hover:text-emerald-300"
        >
          processes/README.md
        </a>
        , with the derived timeline-inversion worklist in{' '}
        <a
          href={`https://github.com/${REPO}/blob/main/docs/TIMELINE-INVERSIONS.md`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-400 transition hover:text-emerald-300"
        >
          docs/TIMELINE-INVERSIONS.md
        </a>
        .
      </p>
    </div>
  )
}
