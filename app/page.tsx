import type { Metadata } from 'next'
import Link from 'next/link'
import ArenasDirectory from '@/components/ArenasDirectory'
import HomeModes from '@/components/HomeModes'
import MegaTable from '@/components/MegaTable'
import ProcessesTable from '@/components/ProcessesTable'
import ProductLogo from '@/components/ProductLogo'
import { battleSlug, leadingBattle, loadAll } from '@/lib/data'
import { buildMegaTableArenaOptions, buildMegaTableRows, isHardwareClass } from '@/lib/megaTable'
import { buildProcessRows } from '@/lib/processRows'

export const metadata: Metadata = {
  title: 'Ultrametric — which software is most AI-friendly?',
  description:
    "One sortable table across every ranking: every product judged on AGENT-READY (can an agent reach and operate it?), BUILT-IN AI (does it act agentically for its users?), API quality, and popularity. No opinion, every score traces back to cited evidence.",
}

export default function Home() {
  const categories = loadAll()
  const megaRows = buildMegaTableRows(categories)
  const arenaOptions = buildMegaTableArenaOptions(categories)
  const processes = buildProcessRows()

  // Founder 2026-09-21: "add processes onto the homepage as well, maybe have two modes,
  // company mode/process mode." Both modes ship in the static HTML; companies stays the
  // default visible mode ("the homepage IS the table", founder call 2026-09-14) and the
  // toggle persists per device (components/HomeModes.tsx).
  const companiesMode = (
    <div className="space-y-12">
      {/* Deep-table view (founder 2026-09-23): the ranking table breaks out of the max-w-7xl
          shell at xl and uses the full page width — margin trick rather than w-screen so the
          scrollbar never causes horizontal overflow. */}
      <section>
        {/* /everything is unlisted by founder call — no banner into it (route stays alive). */}
        <MegaTable rows={megaRows} arenas={arenaOptions} />
      </section>

      <section>
        {/* Founder 2026-09-30: no explainer line under the heading — the podium cards below
            speak for themselves; each links to its arena battle page. */}
        <h2 className="font-display leading-[1.1] text-xl font-semibold tracking-tight">Leading battles</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Hardware-class arenas excluded here too (founder 2026-09-25) — a CPU 'battle' under
              an agentic framing reads wrong; the arenas keep their own pages. */}
          {categories.filter((d) => !isHardwareClass(d)).map((data) => {
            const battle = leadingBattle(data)
            if (!battle) return null
            const a = data.products.find((p) => p.id === battle.a)!
            const b = data.products.find((p) => p.id === battle.b)!
            // PODIUM treatment (founder 2026-09-30, replacing the win-count line): ① winner /
            // ② runner-up, winner listed first. The positions come straight from the COMMITTED
            // judged battle.winner — never recomputed, never inferred from arena rank. A drawn
            // battle podiums nobody: both rows keep battle order and the card says Draw.
            const isDraw = battle.winner === 'draw'
            const pair = [
              { p: a, won: battle.winner === a.id },
              { p: b, won: battle.winner === b.id },
            ]
            const podium = isDraw ? pair : pair.slice().sort((x, y) => Number(y.won) - Number(x.won))
            return (
              <Link
                key={data.category.id}
                href={`/arena/${data.category.id}/battle/${battleSlug(battle.a, battle.b)}`}
                className="group rounded-xl border border-zinc-800 p-4 transition hover:border-emerald-400/60"
              >
                <p className="text-xs uppercase tracking-widest text-zinc-400">{data.category.name}</p>
                {/* No Overall score badges here — those already render in the table and arena cards
                    above; this card's own datum is the judged head-to-head podium. */}
                <div className="mt-3 space-y-2">
                  {podium.map(({ p, won }, i) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={`w-5 text-center text-base leading-none tabular-nums ${!isDraw && won ? 'text-emerald-300' : 'text-zinc-500'}`}
                      >
                        {isDraw ? '–' : i === 0 ? '①' : '②'}
                      </span>
                      <ProductLogo product={p} size={28} />
                      <span
                        className={`min-w-0 truncate text-sm font-medium group-hover:text-emerald-300 ${!isDraw && !won ? 'text-zinc-400' : ''}`}
                      >
                        {p.name}
                      </span>
                      {!isDraw && (
                        <span
                          className={`ml-auto whitespace-nowrap text-[10px] uppercase tracking-widest ${won ? 'text-emerald-400' : 'text-zinc-500'}`}
                        >
                          {won ? 'winner' : 'runner-up'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {isDraw && (
                  <p className="mt-3 text-center text-xs text-zinc-500">Draw — the judged rounds split even</p>
                )}
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )

  const processesMode = (
    <div className="space-y-8">
      {/* Founder 2026-09-23: no "Startup processes, run by agents" heading here; founder
          2026-10-02: the "N founder processes mapped step-by-step…" intro paragraph is gone
          too — the pane opens straight onto the table (its controls carry the orderings). */}
      <ProcessesTable rows={processes.rows} phases={processes.phases} />
      <p className="text-sm">
        <Link
          href="/processes"
          className="text-emerald-400 underline decoration-emerald-400/40 hover:text-emerald-300"
        >
          All processes, end-to-end playbooks &amp; the operating rhythm →
        </Link>
      </p>
    </div>
  )

  return (
    // Founder 2026-09-23 (reverting same-day full-width experiment): the homepage stays inside
    // the standard max-w-7xl shell — no xl breakout on the table or the title/tabs.
    <div>
      {/* The homepage IS the table — one visible title above the mode tabs (founder call
          2026-09-14; founder 2026-09-23: retitled "Open rankings for the AI era" and moved
          above Companies|Products|Processes), no further hero copy; the page title/description
          carry the positioning for search/social, and /methodology carries the full story. */}
      <h1 className="font-display mb-3 text-2xl font-bold leading-tight tracking-tight">
        Open rankings for the AI era
      </h1>
      <HomeModes
        companies={companiesMode}
        processes={processesMode}
        arenas={
          <div className="space-y-6">
            <ArenasDirectory headingLevel="h3" />
            <p className="text-sm">
              <Link href="/arenas" className="text-emerald-400 underline decoration-emerald-400/40 hover:text-emerald-300">
                The full Rankings page →
              </Link>{' '}
              <a
                href="https://github.com/ultrametricai/ultrametric/issues/new?title=%5Branking%5D%20Suggest%20a%20new%20ranking%3A%20%3Cname%3E&labels=arena-suggestion&body=%23%23%20Ranking%20name%0A%0A%23%23%20Products%20that%20compete%20in%20it%20(4%2B)%0A%0A-%20%0A-%20%0A-%20%0A-%20%0A%0A%23%23%20Why%20it%20matters%20in%20the%20AI%20era%0A"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-3 text-zinc-400 underline decoration-zinc-700 hover:text-emerald-300"
              >
                Suggest a ranking ↗
              </a>
            </p>
          </div>
        }
      />
    </div>
  )
}
