'use client'

import { useState } from 'react'
import Link from 'next/link'
import { IconGlyph } from '@/components/IconChip'
import ProductLogoView from '@/components/ProductLogoView'
import VsCopyCommand from '@/components/VsCopyCommand'
import type { SyntheticArtifact, TopVendorPick, VsProducedArtifact } from '@/lib/virtualStartup'

// The state-graph viewer (founder batch 2026-09-29, item 3): a compact tabbed panel above (or
// beside, on wide screens) the terminal that fills as the run progresses — the OBJECTS coming
// into existence. Three tabs (founder batch 2026-10-02, item 4: 'Company' renamed 'Status', and
// the count badges beside the tab labels are gone — the labels stand alone):
//   Status    — the SyntheticArtifact stream (entity, EIN, bank account, name/logo/site …),
//               each carrying the structural data-synthetic="true" attribute and the fuchsia
//               generated-artifact styling (founder 2026-09-29: no visible 'simulated' label
//               anywhere on the page — the honesty invariant is the attribute, tests assert it);
//   Vendors   — each judged top vendor collected as the journey hits its step: logo, name,
//               arena, and why it's there (the top JUDGED vendor with its step score — the same
//               provenance as the terminal pill; nothing re-ranked);
//   Decisions — the nine starting choices plus the seeded mid-run events as they land and
//               resolve (pending until the reader picks a branch).
// Everything is DERIVED from the same revealed-row state as the terminal (no separate timers):
// empty pre-run with a subtle placeholder, resets with the terminal on restart, and stays
// compact (~200px scroll box on mobile) so the terminal remains the page's centerpiece.

export interface VsPanelDecision {
  id: string
  title: string
  icon: string
  label: string
  // Semi-auto drive: 'asserted' = the reader set it (or an axis, always set); 'default' = still
  // 'Not set', composing the default branch; 'pending' = the paused run is asking it right now.
  state?: 'asserted' | 'default' | 'pending'
}

export interface VsPanelEvent {
  id: string
  title: string
  day: number
  // The chosen branch's label + one-line outcome; null while the reader hasn't decided.
  choiceLabel: string | null
  outcome: string | null
}

// A revealed process our own shipped Ultrametric CLI/MCP can drive (curated
// lib/ultrametricCli.ts map). First-party and disclosed; rendered BELOW the judged vendors under
// its own label, never mixed into, reordering, or counted with the judged picks.
export interface VsUmCliLine {
  taskId: string
  title: string
  command: string
}

type PanelTab = 'status' | 'vendors' | 'decisions'

export default function VsStateGraph({
  started,
  artifacts,
  vendors,
  decisions,
  events,
  umCli = [],
  documents,
}: {
  // True once the run has revealed at least one row — pre-run the panel shows the placeholder.
  started: boolean
  // Revealed artifacts, in terminal print order (the derived slice, not a copy of the timers).
  artifacts: SyntheticArtifact[]
  // Revealed judged top vendors, deduped in first-encounter order.
  vendors: TopVendorPick[]
  // The nine starting choices with their current full option labels.
  decisions: VsPanelDecision[]
  // Revealed mid-run events with their resolution state.
  events: VsPanelEvent[]
  // Revealed Ultrametric-driveable processes (ours, disclosed) — optional, additive (2026-09-30).
  umCli?: VsUmCliLine[]
  // Company documents (founder 2026-10-07, item 3): the registry artifacts
  // (processes/artifacts.json) of exactly the producesArtifact-tagged steps the run has printed,
  // each linking its /artifacts/{id} page. The document TYPE is committed corpus vocabulary; the
  // claim that THIS company holds one is a product of the synthetic run, so the line carries the
  // same structural data-synthetic attribute as every generated object. Optional, additive:
  // absent/[] = the section never renders.
  documents?: VsProducedArtifact[]
}) {
  const [tab, setTab] = useState<PanelTab>('status')
  const docs = documents ?? []

  // No count badges (founder batch 2026-10-02, item 4) — the labels stand alone.
  const tabs: Array<{ id: PanelTab; label: string }> = [
    { id: 'status', label: 'Status' },
    { id: 'vendors', label: 'Vendors' },
    { id: 'decisions', label: 'Decisions' },
  ]

  return (
    <section
      data-testid="vs-stategraph"
      aria-label="Run state graph"
      className="rounded-xl border border-zinc-800 bg-zinc-950/60"
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-800 px-2 py-1.5" role="group" aria-label="State graph tab">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            data-testid={`vs-sg-tab-${t.id}`}
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
              tab === t.id
                ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* The compact scroll box — capped so the terminal stays dominant (~200px on mobile). */}
      <div data-testid="vs-stategraph-body" className="max-h-[200px] overflow-y-auto px-2.5 py-2 sm:max-h-[240px] lg:max-h-[320px]">
        {!started ? (
          <p data-testid="vs-sg-placeholder" className="py-2 text-[11px] text-zinc-400">
            The company, its vendors, and its decisions appear here object by object as the run
            prints in the terminal.
          </p>
        ) : tab === 'status' ? (
          <>
            {artifacts.length === 0 ? (
              <p className="py-2 text-[11px] text-zinc-400">nothing exists yet — the first artifacts are printing…</p>
            ) : (
              <ul className="space-y-1">
                {artifacts.map((a, i) => (
                  <li
                    key={`${a.taskId}-${i}`}
                    data-testid="vs-sg-artifact"
                    data-synthetic="true"
                    className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-l-2 border-fuchsia-400/40 pl-2 text-[12px]"
                  >
                    <span className="text-fuchsia-300/90">{a.label}:</span>
                    <span className="min-w-0 truncate font-mono text-[11px] text-zinc-200" title={a.value}>{a.value}</span>
                  </li>
                ))}
              </ul>
            )}
            {/* Company documents (founder 2026-10-07, item 3): one line per registry artifact
                the run's executed steps produce (corpus producesArtifact tags — the sim never
                invents a document), each linking its /artifacts page. The possession claim is
                the synthetic run's, so the line keeps the structural data-synthetic attribute;
                the document type and label are the committed registry's. */}
            {docs.length > 0 && (
              <div data-testid="vs-sg-documents" className="mt-2 border-t border-zinc-800 pt-1.5">
                <p
                  className="text-[9px] uppercase tracking-widest text-zinc-400"
                  title="The registry artifacts (processes/artifacts.json) produced by the corpus steps this synthetic run executed — committed document types, synthetic possession"
                >
                  company documents · from the executed steps
                </p>
                <ul className="mt-1 space-y-1">
                  {docs.map((d) => (
                    <li
                      key={d.id}
                      data-testid="vs-sg-document"
                      data-synthetic="true"
                      className="flex min-w-0 items-center gap-2 border-l-2 border-fuchsia-400/40 pl-2 text-[12px]"
                    >
                      <Link
                        href={`/artifacts/${d.id}`}
                        title={`${d.label} — the registry artifact page: producer process, consumers, judged vendor markets`}
                        className="min-w-0 truncate text-zinc-300 hover:text-emerald-300"
                      >
                        {d.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : tab === 'vendors' ? (
          <>
            {vendors.length === 0 ? (
              <p className="py-2 text-[11px] text-zinc-400">no judged vendor picked up yet — they collect as the journey hits their steps</p>
            ) : (
              <ul className="space-y-1.5">
                {vendors.map((v) => (
                  <li key={v.productId} data-testid="vs-sg-vendor" className="flex min-w-0 items-center gap-2 text-[12px]">
                    <ProductLogoView product={{ id: v.productId, name: v.name }} size={20} hasLogo={v.hasLogo === true} />
                    <Link
                      href={`/arena/${v.arenaId}/product/${v.productId}`}
                      className="min-w-0 truncate font-medium text-zinc-200 hover:text-emerald-300"
                    >
                      {v.name}
                    </Link>
                    <span
                      className="min-w-0 truncate text-[11px] text-zinc-400"
                      title={`Why picked: the top judged vendor for its step — ${v.arenaName}, scored over the step's mapped stories`}
                    >
                      {v.arenaName} · top judged · {v.score.toFixed(0)}<span className="text-zinc-500">/100</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {/* Ultrametric CLI/MCP block (founder ask 2026-09-30) — OWNER PRODUCT. Always BELOW
                the judged list, under its own explicit first-party label, never counted in the
                tab badge: an affordance ("you can drive this process through our CLI"), not a
                pick. Curated map: lib/ultrametricCli.ts, verified against the live catalog. */}
            {umCli.length > 0 && (
              <div data-testid="vs-sg-umcli" className="mt-2 border-t border-zinc-800 pt-1.5">
                <p className="text-[9px] uppercase tracking-widest text-zinc-400">
                  first-party · Ultrametric CLI/MCP (ours) — not a judged pick
                </p>
                <ul className="mt-1 space-y-1">
                  {umCli.map((u) => (
                    <li key={u.taskId} data-testid="vs-sg-umcli-line" className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px]">
                      <span className="text-zinc-300">{u.title}</span>
                      <code className="font-mono text-[10px] text-emerald-300/80">{u.command}</code>
                      {/* Copyable shipped command (founder batch 2026-10-02, item 5) — display-
                          only convenience inside the explicitly-labeled first-party block. */}
                      <VsCopyCommand command={u.command} />
                    </li>
                  ))}
                </ul>
                <Link
                  href="/get-started"
                  className="mt-1 inline-block text-[10px] text-emerald-400/80 hover:text-emerald-300"
                  title="Built by Ultrametric Inc, which also operates this site. It serves the process guide and saves run records — your agent does the work. It never affects the judged vendor picks."
                >
                  our CLI/MCP serves the guide + saves records; your agent does the work →
                </Link>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-1.5">
            <ul className="space-y-1">
              {decisions.map((d) => (
                <li key={d.id} data-testid="vs-sg-decision" data-decision-state={d.state ?? 'asserted'} className="flex items-baseline gap-2 text-[12px]">
                  {/* House icon tokens (the decision/axis maps in VirtualStartup.tsx) render
                      as the custom duotone glyphs; plain text keeps rendering as text. */}
                  <span aria-hidden className="shrink-0">
                    <IconGlyph icon={d.icon} />
                  </span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-zinc-400">{d.title}</span>
                  <span className={d.state === 'pending' ? 'text-amber-300/90' : d.state === 'default' ? 'text-zinc-400' : 'text-zinc-300'}>
                    {d.label}
                  </span>
                </li>
              ))}
            </ul>
            {events.length > 0 && (
              <ul className="space-y-1 border-t border-zinc-800/70 pt-1.5">
                {events.map((e) => (
                  <li
                    key={e.id}
                    data-testid="vs-sg-event"
                    data-synthetic="true"
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-l-2 border-fuchsia-400/40 pl-2 text-[12px]"
                  >
                    <span className="shrink-0 text-[10px] text-zinc-500">day {e.day}</span>
                    <span className="text-zinc-300">{e.title}</span>
                    {e.choiceLabel ? (
                      <span className="text-[11px] text-zinc-400" title={e.outcome ?? undefined}>
                        → {e.choiceLabel}
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-300/90">pending decision</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
