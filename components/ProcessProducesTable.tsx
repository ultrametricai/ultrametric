import Link from 'next/link'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'
import type { ProducedArtifactRow } from '@/lib/processDeps'

// 'Artifacts it produces' (founder 2026-10-05): the header 'Produces:' chip row became this
// table section at the bottom of /processes/[slug], beside the open-modules table. One row per
// registry artifact the process brings into existence (the typed produces layer,
// lib/processDeps.ts producedArtifactRows): the artifact's /artifacts page, the registry's
// committed description, and the step on this page where it is born (an in-page #step anchor —
// the corpus tags the producing node). Where this page is a documented exception producer (the
// LLC page's EIN) the row keeps the honest canonical-producer pointer the chips carried. House
// table idiom (components/tableStyles.ts). Renders nothing for processes that produce no
// registry artifact.
export default function ProcessProducesTable({ rows }: { rows: ProducedArtifactRow[] }) {
  if (rows.length === 0) return null
  return (
    <section>
      <h2 className="font-display leading-[1.1] text-xl font-semibold tracking-tight">
        Artifacts it produces
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-zinc-500">
        Business artifacts this process brings into existence — the typed layer
        (<code>processes/artifacts.json</code>) the cross-process dependency graph is built from.
      </p>
      <div className={`mt-3 ${TABLE_SHELL}`}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={TABLE_HEADER_ROW}>
              <th className="px-3 py-2 font-normal">
                <span title="The registry artifact — its page shows who produces it, who needs it, and the judged markets around its producing steps">Artifact</span>
              </th>
              <th className="px-3 py-2 font-normal">
                <span title="The registry's committed description (processes/artifacts.json)">What it is</span>
              </th>
              <th className="px-3 py-2 font-normal">
                <span title="The step on this page where the artifact comes into existence">Born at</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="px-3 py-2 whitespace-nowrap">
                  <Link
                    href={r.href}
                    className="font-medium text-zinc-200 transition hover:text-emerald-300"
                  >
                    {r.label}
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs leading-relaxed text-zinc-400">{r.description}</td>
                <td className="px-3 py-2 text-xs leading-relaxed">
                  <a
                    href={r.bornAt.anchor}
                    title={`Jump to the step that produces it: ${r.bornAt.label}`}
                    className="text-zinc-300 underline decoration-zinc-700 underline-offset-2 transition hover:text-emerald-300"
                  >
                    {r.bornAt.label}
                  </a>
                  {r.canonicalProducer && (
                    <span className="mt-0.5 block text-zinc-500">
                      canonical producer:{' '}
                      <Link
                        href={r.canonicalProducer.href}
                        className="text-zinc-400 transition hover:text-emerald-300"
                      >
                        {r.canonicalProducer.title} →
                      </Link>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
