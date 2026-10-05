import type { Metadata } from 'next'
import Link from 'next/link'
import VirtualStartup from '@/components/VirtualStartup'
import {
  buildSimSteps, CADENCE_META, loadChains, loadProcesses, processSlug, taskCeiling, vendorRoles,
  type ProcessTask,
} from '@/lib/processes'
import { hasLogo } from '@/lib/logos'
import { stepRanking } from '@/lib/processRankings'
import { vendorGeoLookup } from '@/lib/vendorGeo'
import {
  buildEventExamples, buildYearCandidates, orderByLikelyChoice, unionTaskIds, VS_CHAIN_IDS,
  type RouteMix, type VirtualTaskPayload, type VsChain, type YearTaskSource,
} from '@/lib/virtualStartup'
// v3 run layer (vendor picks → outcomes, personas, seeded events, scorecard): serialized
// canonical access verdicts, published-pricing headlines, and the corpus risk axis — see
// lib/virtualStartupRun.ts for the client-side model and its honesty rules.
import { buildVsAccess, buildVsAssistants, buildVsPopularity, buildVsPricing, buildVsTaskRisks } from '@/lib/virtualStartupData'

// Virtual Startup (founder ask 2026-09-23): a synthetic company run through the REAL process
// corpus. Route renamed /virtual-startup → /startup-sim (founder batch 2026-10-01, item 1) —
// the Cloudflare worker 301s the old path with query strings intact, and the internal
// vs/virtual-startup vocabulary (testids, lib/virtualStartup*, component names) deliberately
// stays: renaming identifiers is churn, the URL is the product surface.
// This page is fully static: it precomputes, at build time, the payload for every task
// any decision combo can reach (steps via the same buildSimSteps the process pages use, top
// judged vendor per step via lib/processRankings.ts stepRanking) plus the union vendor roles;
// components/VirtualStartup.tsx assembles the chosen journey client-side, deterministically.
// All synthetic artifacts are generated client-side from a decision-combo seed and always carry
// the SIMULATED label — see lib/virtualStartup.ts for the honesty contract.

export const metadata: Metadata = {
  // One title (founder 2026-09-29, latest wording): 'Startup Simulator' — the route is
  // /startup-sim (renamed 2026-10-01); every internal id/testid keeps the vs/virtual-startup
  // vocabulary.
  title: 'The open startup simulator — Ultrametric',
  description:
    'The open startup simulator — watch an AI-native company incorporate, bank, hire, and launch: every step routed agent or human, vendors picked from agent-tested rankings, decisions yours in semi-auto mode.',
}

// DAG route mix of one corpus process — the year view's per-row honesty payload.
function routeMix(task: ProcessTask): RouteMix {
  const mix: RouteMix = { agent: 0, form: 0, person: 0, legalSignature: 0 }
  for (const n of task.dag.nodes) {
    mix[n.route] += 1
    if (n.legalSignature) mix.legalSignature += 1
  }
  return mix
}

export default function VirtualStartupPage() {
  const chains: VsChain[] = VS_CHAIN_IDS.map((id) => {
    const chain = loadChains().find((c) => c.id === id)
    // Fail the build loudly if the journey references a chain the corpus no longer has.
    if (!chain) throw new Error(`virtual-startup: chain "${id}" missing from journeys/chains.json`)
    return { id: chain.id, name: chain.name, taskIds: chain.taskIds }
  })

  const byId = new Map(loadProcesses().map((t) => [t.id, t]))
  const tasks: Record<string, VirtualTaskPayload> = {}
  const unionTasks = unionTaskIds(chains).map((id) => {
    const task = byId.get(id)
    if (!task) throw new Error(`virtual-startup: task "${id}" missing from processes/corpus.json`)
    return task
  })
  const roles = vendorRoles(unionTasks)
  // 'Likely choice' ordering payload (founder round 5, item 7): the committed adoption/
  // popularity signal per role arena — the Vendors-tab picker ordering and the terminal
  // runners-up lead with it; judged scores and the judged top pick never move.
  const popularity = buildVsPopularity(roles)
  for (const task of unionTasks) {
    tasks[task.id] = {
      id: task.id,
      title: task.title,
      slug: processSlug(task.title),
      phase: task.phase,
      description: task.description,
      steps: buildSimSteps([task]),
      // The step's top JUDGED vendor (story-derived ranking over real verdicts) — null where no
      // committed mapping/judged ranking exists, and the UI shows nothing rather than a guess.
      tops: task.dag.nodes.map((node) => {
        const ranking = stepRanking(task.id, node)
        const top = ranking?.vendors[0]
        return top
          ? {
              productId: top.productId,
              name: top.name,
              score: top.score,
              arenaId: ranking.arenaId,
              arenaName: ranking.arenaName,
              // Resolved here (lib/logos.ts needs node:fs) so the client state panel can render
              // the real logo chip (components/ProductLogoView.tsx).
              hasLogo: hasLogo(top.productId),
              // The next vendors behind the judged top (same judged stepRanking scores), now
              // LED by the likely-choice ordering (founder round 5, item 7): the committed
              // adoption/popularity signal orders the runners-up presentation; the judged top
              // keeps its '(recommended · judged)' label and every score stays judged.
              runnersUp: orderByLikelyChoice(
                ranking.vendors.slice(1),
                popularity[ranking.arenaId]?.order,
              )
                .slice(0, 2)
                .map((v) => ({ productId: v.productId, name: v.name, score: v.score })),
            }
          : null
      }),
      // The corpus GEO dimension + curated per-country analogs — the in-sim geo annotations
      // (components/VirtualStartup.tsx) read these; committed data only, straight through.
      geoScope: task.geoScope,
      geoNotes: task.geoNotes ?? [],
    }
  }

  // Committed (product, country) availability cells for every vendor the sim can surface — the
  // step top picks plus every swappable role alternative (lib/vendorGeo.ts vendorGeoLookup:
  // non-US cells only, products without rows simply absent — evidence or nothing).
  const vsProductIds = new Set<string>()
  for (const t of Object.values(tasks)) for (const top of t.tops) if (top) vsProductIds.add(top.productId)

  // Year-one operating rhythm candidates: the whole corpus reshaped (cadence labels from the
  // same CADENCE_META /processes/operating-rhythm uses), selected/gated by lib/virtualStartup's
  // buildYearCandidates — the month-end-close + tax-season chains always, journey-gated
  // recurring processes otherwise.
  const yearSources: YearTaskSource[] = loadProcesses().map((t) => ({
    taskId: t.id,
    title: t.title,
    slug: processSlug(t.title),
    cadence: t.cadence,
    cadenceLabel: CADENCE_META[t.cadence].label,
    totalSteps: t.dag.nodes.length,
    routes: routeMix(t),
    ceilingPct: taskCeiling(t).pct,
  }))
  const allChains: VsChain[] = loadChains().map(({ id, name, taskIds }) => ({ id, name, taskIds }))
  const yearCandidates = buildYearCandidates(allChains, yearSources)
  // Event-driven examples for the rhythm views — real corpus processes that run when triggered
  // (no months, no runs/yr), gated per decision combo client-side.
  const eventExamples = buildEventExamples(yearSources)

  for (const role of roles) for (const alt of role.alternatives) vsProductIds.add(alt.id)

  return (
    <div className="space-y-10">
      {/* Left-aligned hero (founder addendum 2026-09-29): title at the content edge, arena-page
          style — no centered/mx-auto treatment. */}
      <section className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* ONE title (founder round 4, item 2): the h1+subtitle pair collapsed into the single
            'Startup Simulator' h1 — no breadcrumb eyebrow, no subtitle; the explanations
            live in the setup band's tooltips. */}
        <h1 className="font-display leading-[1.1] text-3xl font-bold tracking-tight">The open startup simulator</h1>
        {/* Repo CTA removed (founder 2026-10-01) — the header nav's repo star link covers it. */}
      </section>

      <VirtualStartup
        chains={chains}
        tasks={tasks}
        roles={roles}
        yearCandidates={yearCandidates}
        eventExamples={eventExamples}
        access={buildVsAccess(roles)}
        pricing={buildVsPricing(roles)}
        taskRisks={buildVsTaskRisks()}
        vendorGeo={vendorGeoLookup(vsProductIds)}
        popularity={popularity}
        assistants={buildVsAssistants()}
      />

    </div>
  )
}
