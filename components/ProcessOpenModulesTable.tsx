import Link from 'next/link'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'
import type { ProcessOpenModuleRow } from '@/lib/openModulePages'

// The process page's 'Open modules' table (founder 2026-10-05: the affordance near the title
// goes "to a different table at the bottom of the page to see how it links to those modules
// there"). One row per module the committed registry (processes/business-logic-map.json) maps
// onto this process: the module's /open-modules page, the README's committed "What it computes"
// cell, the exact steps on THIS page its functions compute for (in-page #step anchors from the
// registry's function-level entries; process-level-only mappings say so plainly), and the
// module's source file on GitHub. Vendor context is not duplicated here — the module pages
// derive it. House table idiom (components/tableStyles.ts). Renders nothing for the many
// unmapped processes. The #open-modules anchor is the top affordance's scroll target.
export default function ProcessOpenModulesTable({ rows }: { rows: ProcessOpenModuleRow[] }) {
  if (rows.length === 0) return null
  return (
    <section id="open-modules" className="scroll-mt-4">
      <h2 className="font-display leading-[1.1] text-xl font-semibold tracking-tight">
        Open modules serving this process
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-zinc-400">
        Open-source <code>lib/openstartup/</code> modules wired to this process in{' '}
        <code>processes/business-logic-map.json</code> — cited, tested math, with the exact steps
        each one computes for.
      </p>
      <div className={`mt-3 ${TABLE_SHELL}`}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className={TABLE_HEADER_ROW}>
              <th className="px-3 py-2 font-normal">
                <span title="The module's page — what it computes, the processes it serves, and the judged vendor markets around them">Module</span>
              </th>
              <th className="px-3 py-2 font-normal">
                <span title="The committed functional description from the open-modules/README.md module index">What it computes</span>
              </th>
              <th className="px-3 py-2 font-normal">
                <span title="The steps on this page the module's functions compute for (from the registry's function-level entries); process-level mappings name the process">Serves</span>
              </th>
              <th className="px-3 py-2 font-normal">
                <span title="The module's source file on GitHub — pure, deterministic, every formula citing a published source">Source</span>
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
                <td className="px-3 py-2 text-xs leading-relaxed text-zinc-400">{r.computes}</td>
                <td className="px-3 py-2 text-xs leading-relaxed">
                  {r.serves.length > 0 ? (
                    r.serves.map((s, i) => (
                      <span key={s.nodeId}>
                        {i > 0 && <span className="mx-1 text-zinc-700">·</span>}
                        <a
                          href={s.anchor}
                          title={`Jump to the step the module computes for: ${s.label}`}
                          className="text-zinc-300 underline decoration-zinc-700 underline-offset-2 transition hover:text-emerald-300"
                        >
                          {s.label}
                        </a>
                      </span>
                    ))
                  ) : (
                    <span className="text-zinc-500">this process as a whole</span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <a
                    href={r.sourceHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-zinc-400 transition hover:text-emerald-300"
                  >
                    {r.sourceFile} ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
