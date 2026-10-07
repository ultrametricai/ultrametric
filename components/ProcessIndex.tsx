import FatProcessSearch from '@/components/FatProcessSearch'
import ProcessesTable, { type ProcessTableRow, type PlaybookRow } from '@/components/ProcessesTable'

export default function ProcessIndex({ tableRows, phases, playbooks, preview = false }: {
  tableRows: ProcessTableRow[]; phases: string[]; playbooks: PlaybookRow[]; preview?: boolean
}) {
  return (
    <div className="space-y-12">
      {/* Founder 2026-09-25: retitled + the intro paragraph replaced by a fat search bar —
          the routing/honesty story lives on /methodology and in the per-step tooltips. */}
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">
          Going agentic with company processes
        </h1>
        {/* The fat search matches the end-to-end chains too (founder 2026-09-29) — chain rows
            carry the chain-page href, the aggregate ceiling, and the invisible 'playbook'
            pseudo-phase so typing the word still finds them (the visible copy never says it —
            founder same-day: "we don't need to say 'playbook'… playbooks are still processes"). */}
        <FatProcessSearch
          rows={[
            ...tableRows.map((r) => ({ href: r.href ?? `/processes/${r.slug}`, title: r.title, icon: r.icon, phase: r.phase, pct: r.pct })),
            ...playbooks.map((p) => ({ href: p.href, title: p.title, icon: p.icon, phase: 'playbook', pct: p.pct, playbook: true })),
          ]}
        />
        {/* The geo dimension (founder GEO ask 2026-09-28, lib/geoPreference.ts): every process
            row below always wears its geoScope glyph. The country control lives in the site
            header since founder 2026-10-07 (components/HeaderGeoControl.tsx — 🌐 Global
            framing by default), replacing this page's own dropdown. */}
      </section>

      {/* ONE view under the search (founder 2026-09-29: "combine playbooks and all processes
          into one table"; same-day follow-up: "we don't need to say 'playbook'… playbooks are
          still processes") — every row grouped by area, the end-to-end chains folded into their
          dominant area; the old separate playbooks section AND the 'Playbooks' vocabulary are
          gone from this UI. */}
      <section className="space-y-3">
        {/* No 'All processes' heading (founder 2026-09-30) — the table stands alone under the
            search. The route-dot legend went earlier (founder 2026-09-29). */}
        {/* The index DEFAULTS onto the global view (founder 2026-09-30: "default /processes
            onto a global view — you can include the US specific ones in the first view"): with
            nothing chosen every US-specific row is still in the first view (the geo dimension
            annotates, never filters) and the always-on scope glyphs run sharp (🌐/🇺🇸/🏛). The
            🌐 Global no-selection framing is carried by the header control sitewide since
            founder 2026-10-07; ?geo=/pa-geo win as before. */}
        <ProcessesTable rows={tableRows} phases={phases} playbooks={playbooks} />
        {/* The 🐣 open-startup-simulator promo card and the 'Every mapped vendor traces…
            See all rankings →' footer were removed (founder 2026-10-02) — the nav carries the
            simulator; the table speaks for itself. */}
      </section>

      {preview && (
        <section className="mx-auto max-w-3xl text-center text-sm text-zinc-500">
          <p>Preview records use the existing index assessments where available; blank cells have no matching assessment.</p>
        </section>
      )}
    </div>
  )
}
