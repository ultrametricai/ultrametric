import type { Metadata } from 'next'
import Link from 'next/link'
import { loadOpenModulePages } from '@/lib/openModulePages'
import { REPO } from '@/lib/site'

// /open-modules (founder 2026-10-05): the lib/openstartup module registry as a browsable
// index — one card per mapped module (processes/business-logic-map.json), each linking its
// site page. The functional descriptions are the committed "What it computes" cells of the
// open-modules/README.md module index (lib/openModulePages.ts reads them back — one home for
// the prose). The modules themselves stay a repo library; these pages document them and derive
// the markets around them, they don't re-host the code.
export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Open modules — decision support, calculations, calendars, comparisons — Ultrametric',
  description:
    'The open startup modules in lib/openstartup/ — cap tables, vesting, 83(b) math, deadlines, franchise tax, runway — each with the corpus processes it serves and the judged vendor markets covering those processes.',
}

export default function OpenModulesPage() {
  const modules = loadOpenModulePages()
  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          Open modules — decision support, calculations, calendars, comparisons
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Pure, deterministic startup business logic in{' '}
          <a
            href={`https://github.com/${REPO}/tree/main/lib/openstartup`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-zinc-300 underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300"
          >
            lib/openstartup/
          </a>
          : every formula cites a published source and replays its worked examples in tests. A
          module may propose a result; it never authorizes a filing, grant, or transfer. Each page
          below names the founder processes the module serves and the judged vendor markets
          covering those processes&rsquo; steps.
        </p>
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        {modules.map((m) => (
          <div key={m.id} className="rounded-xl border border-zinc-800 p-4">
            <h2 className="font-display text-lg font-semibold leading-tight">
              <Link
                href={`/open-modules/${m.id}`}
                className="text-zinc-200 transition hover:text-emerald-300"
              >
                {m.label}
              </Link>
            </h2>
            <p className="mt-1 text-sm text-zinc-400">{m.computes}</p>
            <p className="mt-2 font-mono text-[11px] text-zinc-500">{m.sourceFile}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-zinc-500">
        The module docs — contracts, worked examples, honesty boundaries — live in the open repo:{' '}
        <a
          href={`https://github.com/${REPO}/blob/main/open-modules/README.md`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-400 transition hover:text-emerald-300"
        >
          open-modules/README.md
        </a>
        . Which module serves which process is the committed registry{' '}
        <code>processes/business-logic-map.json</code>.
      </p>
    </div>
  )
}
