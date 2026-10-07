import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import DoViaAfk from '@/components/DoViaAfk'
import IconChip from '@/components/IconChip'
import JurisdictionToggle from '@/components/JurisdictionToggle'
import ProcessGeoBanner from '@/components/ProcessGeoBanner'
import ProcessDag from '@/components/ProcessDag'
import ProcessDagOverview from '@/components/ProcessDagOverview'
import ProcessGeoNotes from '@/components/ProcessGeoNotes'
import ProcessLeaderboard from '@/components/ProcessLeaderboard'
import ProcessLensBanner from '@/components/ProcessLensBanner'
import OpenModulesControl from '@/components/OpenModulesControl'
import ProcessOpenModulesTable from '@/components/ProcessOpenModulesTable'
import ProcessProducesTable from '@/components/ProcessProducesTable'
import UrgencyChip from '@/components/UrgencyChip'
import UsFlowLabel from '@/components/UsFlowLabel'
import { modulesForProcess } from '@/lib/businessLogicMap'
import { processOpenModuleRows } from '@/lib/openModulePages'
import { buildProcessCheckSteps } from '@/lib/processCheckData'
import { producedArtifactRows } from '@/lib/processDeps'
import { phaseIcon, phaseTooltip, processIcon } from '@/lib/processIcons'
import { processManifestPath, processManifestUrl } from '@/lib/processManifest'
import {
  findProcessBySlug, jurisdictionStepViews, loadProcesses, processSlug,
  slugAliasFor, taskCeiling,
} from '@/lib/processes'
import { SITE_URL } from '@/lib/site'

// One founder process: the DAG as it really runs, with the market resolved live from arena
// leaderboards per step. Founder 2026-09-30: the page slimmed — the bottom 'Agent ceiling'
// verdict box and 'Simulate this process' section are gone from process pages (chain pages
// keep both). The top 'Select vendor for process test' section followed (founder 2026-10-05) —
// chain pages keep ProcessVendorPicker; the ?via= lens and per-step "use" affordances remain.
//
// Renamed processes (founder rule: vendor-neutral names — "Send an invoice", not "Send Stripe
// invoice") also prerender their old vendor-flavored slugs (slugAliases): static export has no
// server redirects, so the alias page is the same full page plus a canonical link and a pointer
// line — old shared/indexed links keep working and keep being useful.

export function generateStaticParams() {
  return loadProcesses().flatMap((t) => [
    { slug: processSlug(t.title) },
    ...(t.slugAliases ?? []).map((a) => ({ slug: a.slug })),
  ])
}

export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const task = findProcessBySlug(slug)
  if (!task) return { title: 'Process — Ultrametric' }
  const ceiling = taskCeiling(task)
  return {
    title: `${task.title} — Processes — Ultrametric`,
    description: `${task.description} An agent can run ${ceiling.agentSteps} of ${ceiling.totalSteps} steps today.`,
    // Alias slugs point search engines at the one canonical page.
    alternates: {
      canonical: `${SITE_URL}/processes/${processSlug(task.title)}`,
      // Machine discovery of the run manifest stays per-page (the visible 'For agents' footer
      // left the pages — founder 2026-10-02; /llms.txt is the visible once-place).
      types: { 'application/json': processManifestPath(processSlug(task.title)) },
    },
  }
}

export default async function ProcessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const task = findProcessBySlug(slug)
  if (!task) notFound()

  const ceiling = taskCeiling(task)
  const alias = slugAliasFor(task, slug)
  const canonicalSlug = processSlug(task.title)
  const mineHref = `/processes/${canonicalSlug}/mine`
  // Same pre-serialized rows as /mine — the client-side lens/"yours" chips hydrate over them;
  // the static HTML is unchanged for readers without a click or a stack (server lens and stack
  // snapshots are both '{}').
  const checkStepList = buildProcessCheckSteps(task)
  const checkSteps = Object.fromEntries(checkStepList.map((s) => [s.nodeId, s]))
  // Jurisdiction-conditional steps (stripped from every default surface by loadProcesses) —
  // serialized for the client-side toggle; [] for the many processes that don't branch.
  const jurisSteps = jurisdictionStepViews(task.id)
  // Open modules serving this process (processes/business-logic-map.json) — the bottom table's
  // rows; the header's inline control reads the same registry via modulesForProcess (repo
  // README links, founder 2026-10-06).
  const openModuleRows = processOpenModuleRows(task)
  // Registry artifacts this process produces — the bottom 'Artifacts it produces' table.
  const producesRows = producedArtifactRows(task)

  return (
    <div className="space-y-10">
      <section>
        {alias && (
          <p className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-400">
            &ldquo;{alias.label}&rdquo; is an earlier name for this work — it now lives in this
            process, with the specifics (vendors, jurisdictions) as market options and steps.{' '}
            <Link
              href={`/processes/${canonicalSlug}`}
              className="text-emerald-300 underline decoration-emerald-400/40 underline-offset-2 transition hover:text-emerald-200"
            >
              {task.title} →
            </Link>
          </p>
        )}
        <p className="text-[10px] uppercase tracking-widest text-zinc-400">
          <Link href="/processes" className="hover:text-emerald-300">Processes</Link>
          <span className="mx-1 text-zinc-600">/</span>
          <IconChip icon={phaseIcon(task.phase)} title={phaseTooltip(task.phase)} className="mr-1" />
          {task.phase}
        </p>
        <h1 className="font-display leading-[1.1] mt-1 flex items-center gap-2.5 text-3xl font-bold tracking-tight">
          <IconChip icon={processIcon(task.id)} title={`${task.title} — ${task.phase} ${task.kind === 'situation' ? 'situation' : 'process'}`} />
          {task.title}
          {task.geoScope !== 'global' && (
            <span
              aria-label="US-specific process"
              // The flag keys STRICTLY on geoScope (founder 2026-10-02 audit — a geoScope
              // 'global' record can never wear it; `region` stays corpus metadata, consistency
              // corpus-tested). geoScope also sharpens the flag's story: state-level work names
              // the state as the counterparty, federal work names the agencies.
              title={task.geoScope === 'us-state'
                ? 'US state-level: the counterparty here is a US state (Delaware filings, state portals, state registrations)'
                : 'US-specific: this flow is written around US federal law and agencies (IRS, USPTO, SEC, immigration)'}
              className="text-xl"
            >🇺🇸</span>
          )}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {/* Situations (founder 2026-10-01) lead the chip row with their honest clock. */}
          {task.urgency && <UrgencyChip tier={task.urgency} />}
          {/* The complexity chip ('simple'/…) removed (founder 2026-10-02) — the field stays
              corpus data for sorting; the chip told a reader nothing actionable. */}
          {/* The support-level ('fully automatable') and cadence ('once'/'as needed') chips are
              gone too (founder 2026-10-02) — both fields stay corpus data (sorting, the rhythm
              board). The '⏳ has async waits' and 'Known government fees: $…' chips followed
              (founder 2026-10-05) — display only: hasAsyncSteps and the dated per-step fees
              (lib/processes.ts knownCostUsd) stay corpus/derived data; the per-step cost chips
              still carry each fee with its source and as-of date. The urgency chip stays. */}
          {/* Admin-only (session allowlist or the pa-admin localStorage switch) — renders nothing
              for everyone else. The manifest it hands off is public regardless. */}
          <DoViaAfk manifestUrl={processManifestUrl(slug)} />
        </div>
        {/* The trigger — the event that puts a founder in this situation — leads the prose
            (founder 2026-10-01), ahead of the description, in the header. */}
        {task.kind === 'situation' && task.trigger && (
          <p className="mt-3 max-w-2xl text-sm text-zinc-300">
            <span className="font-semibold text-amber-300">Trigger:</span> {task.trigger}
          </p>
        )}
        <p className="mt-3 max-w-2xl text-zinc-400">{task.description}</p>
        {/* supportReason no longer renders as a second description line (founder 2026-10-02) —
            it stays corpus data (the ceiling chip's tooltip territory, and the honesty record). */}
        {/* The header 'Produces:' chip row moved to the bottom 'Artifacts it produces' table
            (founder 2026-10-05) — display only: the typed produces/requires layer and
            lib/processDeps.ts stay the machine truth the dependency graph is built from. */}
        {/* Business-logic ↔ process wiring: the title-adjacent affordance moved INLINE with the
            geo control below (founder 2026-10-06 — no own line, no expanding disclosure; the
            2026-10-05 '#open-modules ↓' anchor and the earlier OpenModulesMenu are both
            retired). OpenModulesControl: one module = plain text repo link, several = the small
            house menu. The bottom 'Open modules' receipts table stays as-is. */}
        {/* The per-page situation posture banner was removed (founder 2026-10-02) — the
            sitewide footer line and /terms carry the not-legal-advice posture. */}
        {/* The page's own geo dropdown moved to the site header (founder 2026-10-07: "move
            this into the top bar … then we don't need it per page" —
            components/HeaderGeoControl.tsx). The selection stays global (?geo= + pa-geo,
            lib/geoPreference.ts); the banner below renders the selected country's committed
            story — nothing without an explicit choice, so the flow shown stays the one shared
            US-default view and no judged number moves. The "Outside the US" rows
            (ProcessGeoNotes, below) remain the page's internal country switches — they write
            the same store the header control does. */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <OpenModulesControl modules={modulesForProcess(task.id)} />
        </div>
        <ProcessGeoBanner geoScope={task.geoScope} notes={task.geoNotes ?? []} />
        {/* The 'Select vendor for process test' section is gone from process pages (founder
            2026-10-05) — chain pages keep ProcessVendorPicker. The lens itself lives on: the
            per-step "use" affordances and the ?via= share param still drive it here. */}
      </section>

      {/* Founder 2026-09-18: the process ITSELF leads — who covers it, then the step-by-step
          flow with per-step vendors. The agent-ceiling gap analysis moved below the steps and
          collapsed (it repeated every step's computer-use chips at the top of the page). */}
      <ProcessLeaderboard task={task} mineHref={mineHref} />

      {/* The standalone 'Check my process — run it with your stack →' CTA is gone (founder
          2026-10-05) — display only: the /mine route, MineLink, and the per-step "yours"
          affordances (StepYourPick, ProcessYourVendor, the leaderboard's mineHref) still carry
          readers into the personalized run. */}

      {/* The flow overview (founder 2026-10-07): the v2 reader's top-of-page mini-map ported to
          the canonical page — the whole DAG as one compact strip of route-marked step chips,
          each jumping to its #step anchor in the diagram below. Server-rendered from the SAME
          corpus DAG (lib/dagLayers.ts layering), outside the #steps region. */}
      <ProcessDagOverview nodes={task.dag.nodes} edges={task.dag.edges} taskId={task.id} />

      <section>
        {/* 'Process breakdown' (founder 2026-10-05 functional-title rename of 'Step-by-step:
            what an agent can do vs you') — situations render through this same page, so the
            rename covers both; chain pages head their diagram 'The full run' separately. */}
        <h2 className="font-display leading-[1.1] text-xl font-semibold tracking-tight">Process breakdown</h2>
        {/* The wrong-country-flow guard's flow label (founder 2026-10-02): under an explicit
            country choice a US-scoped flow wears the 'US flow' badge — the geo banner up top
            leads with the committed country note, so the steps below are never presented as the
            local answer. Client-side only; the static HTML renders nothing. */}
        <UsFlowLabel geoScope={task.geoScope} />
        {/* The route-coded legend sentence is gone (founder 2026-10-02) — the route colors keep
            their per-badge labels and tooltips inside the diagram itself. */}
        {/* Client-side lens banner (founder 2026-09-21: click a vendor → the process adapts to
            run via it). Renders nothing in the static HTML — hydrates in only for readers with
            a clicked vendor or an "I'm using" stack pick. */}
        <ProcessLensBanner steps={checkStepList} pageKey={task.id} />
        {/* The top-of-page vendor picker left process pages (founder 2026-10-05) — the per-step
            "use" affordances below are the lens writers here. */}
        <div className="mt-4 rounded-2xl border border-zinc-800 p-4 sm:p-5">
          <div id="steps" className="scroll-mt-4" />
          <ProcessDag
            nodes={task.dag.nodes}
            edges={task.dag.edges}
            taskId={task.id}
            checkSteps={checkSteps}
            mineHref={mineHref}
            lensKey={task.id}
            manifestUrl={processManifestUrl(slug)}
            usScoped={task.geoScope !== 'global'}
          />
        </div>
        {/* Jurisdiction-conditional steps (founder 2026-09-25) — only processes that genuinely
            branch by jurisdiction get the control. Client-side over the same static HTML: the
            default (Delaware-only) page is byte-identical and every judged number stays the
            default's; toggled-on steps render below the DAG with a recomputed, honestly
            labelled ceiling (components/JurisdictionToggle.tsx). */}
        {jurisSteps.length > 0 && (
          <JurisdictionToggle
            steps={jurisSteps}
            base={{ agentSteps: ceiling.agentSteps, totalSteps: ceiling.totalSteps, pct: ceiling.pct }}
          />
        )}
        {/* The 'Context the agent needs first' line no longer renders (founder 2026-10-02) —
            contextNeeded stays corpus data (the manifests and typed-I/O layer carry it). */}
      </section>

      {/* The GEO dimension (founder 2026-09-28, expanded 2026-09-29): per-country analogs of a
          US-scoped process — or the local flavor of a flavored global one — curated in the
          corpus (geoNotes); renders nothing for the many processes without. */}
      <ProcessGeoNotes notes={task.geoNotes ?? []} geoScope={task.geoScope} />

      {/* The two bottom tables (founder 2026-10-05): the typed produces layer and the
          open-module wiring, each rendering nothing where the corpus carries nothing. Produces
          leads — what the process leaves behind — then the library math that serves its steps. */}
      <ProcessProducesTable rows={producesRows} />
      <ProcessOpenModulesTable rows={openModuleRows} />

      {/* The 'Agent ceiling' verdict box and the 'Simulate this process' section are gone from
          process pages (founder 2026-09-30) — the per-step route badges and the leaderboard
          carry the story here; chain pages keep both (ProcessVerdict/ProcessSimulator live on). */}

      {/* The visible 'For agents' footer left per-process pages (founder 2026-10-02: "just have
          it once, not on all the pages") — /llms.txt is the once-place (it documents the
          manifest scheme), and the manifest stays machine-discoverable from this page via the
          <link rel="alternate"> in generateMetadata. */}
    </div>
  )
}
