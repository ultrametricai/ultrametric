import type { PlaybookRow, ProcessRow } from '@/lib/processRowTypes'
import { loadCategory } from '@/lib/data'
import type { GeoNotesByCountry } from '@/lib/geoPreference'
import { hasLogo } from '@/lib/logos'
import { isShutdown } from '@/lib/shutdown'
import { chainIcon, processIcon } from '@/lib/processIcons'
import { crossArenaStepRankings, processLeaderboard, stepRanking } from '@/lib/processRankings'
import {
  CADENCE_META, cadenceRank, chainTasks, computeCeiling, loadChains, loadProcesses, phaseRank,
  processSlug, taskCeiling, type ProcessTask, VENDOR_ARENA, vendorLabel, vendorProductId,
} from '@/lib/processes'
import { URGENCY_TIERS } from '@/lib/processSim'

// Server-side builder for the "all processes" table rows — extracted from app/processes/page.tsx
// (2026-09-21) so the homepage's process mode renders the exact same rows as /processes; one
// derivation, two surfaces.

// ---- Areas (founder 2026-09-28): friendly display groups over the corpus's internal phases —
// the primary grouping on the "All processes" table (inspiration: the old site's sections at
// ultrametric.ai/process — Formation, Fundraising, Finance, HR & Payroll, Legal, Compliance &
// Tax, Operations, Sales, Growth, Software). Order = the founder-lifecycle order the grouped
// table renders in. The map must stay TOTAL over the corpus: areaOf throws on an unmapped
// phase, and the totality test in lib/__tests__/processRows.test.ts walks the live corpus — a
// new phase without a curated area fails loudly at test (and build) time instead of silently
// rendering a stray group.
//
// Founder 2026-09-30: 'Starting up' overlapped the formation vocabulary everywhere else on the
// site — the startup+formation phases now merge into ONE 'Formation' area.
//
// Founder 2026-10-01 (Situations): reactive, trigger-driven records (corpus `kind: 'situation'`)
// get their own 'Situations' area, LAST — they aren't stops on the founder lifecycle, they
// interrupt it. The KIND drives the area (see areaOfTask below), not a new phase value: a
// situation keeps its honest domain phase (legal, compliance, finance…) for the phase filter
// and the phase chip, and the area map over phases stays total and untouched.
export const AREA_ORDER = [
  'Formation',
  'Fundraising & investors',
  'Money & finance',
  'Team & payroll',
  'Legal',
  'Ongoing compliance & tax',
  'Running operations',
  'Building & shipping',
  'Growth & sales',
  'Situations',
] as const

// The kind-driven area for reactive records — exported so tests can pin the decision.
export const SITUATIONS_AREA: Area = 'Situations'

export type Area = (typeof AREA_ORDER)[number]

export const PHASE_AREA: Record<string, Area> = {
  startup: 'Formation',
  formation: 'Formation',
  fundraising: 'Fundraising & investors',
  vc: 'Fundraising & investors',
  finance: 'Money & finance',
  hr: 'Team & payroll',
  legal: 'Legal',
  compliance: 'Ongoing compliance & tax', // the corpus has no separate tax phase — filings live here
  operations: 'Running operations',
  product: 'Building & shipping',
  software: 'Building & shipping',
  growth: 'Growth & sales',
  sales: 'Growth & sales',
}

/** The display area for a corpus phase — throws on an unmapped phase (totality by force). */
export function areaOf(phase: string): Area {
  const area = PHASE_AREA[phase]
  if (area === undefined) {
    throw new Error(`No display area mapped for phase "${phase}" — add it to PHASE_AREA in lib/processRows.ts`)
  }
  return area
}

/** Founder-lifecycle rank of an area (its AREA_ORDER index) — the grouped table's group order. */
export function areaRank(area: string): number {
  return (AREA_ORDER as readonly string[]).indexOf(area)
}

/**
 * The display area for a corpus RECORD: the kind drives it (founder 2026-10-01). A situation
 * groups under 'Situations' regardless of its phase — the phase stays the honest domain tag —
 * while a process keeps the curated phase→area map. Pinned in lib/__tests__/processRows.test.ts.
 */
export function areaOfTask(t: Pick<ProcessTask, 'kind' | 'phase'>): Area {
  return t.kind === 'situation' ? SITUATIONS_AREA : areaOf(t.phase)
}

// Vendor-cell cap for the index table — founder 2026-09-22 ("we are missing vendors on the
// processes main page, e.g. GitLab for 'Cut a release' — I want a more complete answer"):
// raised from 4, and the cell now always tops up from the derived market after the curated
// vendors instead of showing one source or the other.
const VENDOR_CELL_CAP = 6

// Founder 2026-09-18: no empty vendor cells — the top story-ranked options across the task's
// steps (same evidence-gated rankings the process page shows; cross-arena entries included).
function derivedVendorsFor(t: ProcessTask, seed?: { id: string; label: string; arena: string | null; hasLogo: boolean }[]) {
  const out = [...(seed ?? [])]
  const seen = new Set<string>(out.map((v) => v.id))
  const push = (id: string, label: string, arena: string | null) => {
    if (seen.has(id) || out.length >= VENDOR_CELL_CAP) return
    seen.add(id)
    out.push({ id, label, arena, hasLogo: hasLogo(id) })
  }
  for (const e of processLeaderboard(t).entries) push(e.productId, e.name, e.arenaId)
  if (out.length < VENDOR_CELL_CAP) {
    for (const node of t.dag.nodes) {
      const rankings = [stepRanking(t.id, node), ...crossArenaStepRankings(t.id, node)]
      for (const r of rankings) {
        if (!r) continue
        for (const v of r.vendors.slice(0, 2)) push(v.productId, v.name, v.arenaId)
      }
    }
  }
  return out
}

// ---- Playbook rows (founder 2026-09-29: "combine playbooks and all processes into one table
// so we have one view for the processes under the process search"): the curated chains
// (journeys/chains.json) serialized for the SAME table the process rows render in. Founder
// 2026-09-29 follow-up ("we don't need to say 'playbook' on those playbooks… playbooks are
// still processes"): no category label and no leading group — in the grouped default each
// chain row folds into its DOMINANT area (the area of its first constituent process) at that
// constituent's timeOrder position; the flat sorted view keeps its interleaving semantics.
// Server-side like buildProcessRows so the client table never imports the node-only loaders.
export function buildPlaybookRows(): PlaybookRow[] {
  return loadChains().map((chain) => {
    const tasks = chainTasks(chain)
    const nodes = tasks.flatMap((t) => t.dag.nodes)
    const ceiling = computeCeiling(nodes)
    // The dominant area: where the chain's journey STARTS — its first constituent process's
    // phase resolved through the same curated phase→area map every process row uses.
    const dominantArea = areaOf(tasks[0].phase)
    return {
      id: chain.id,
      title: chain.name,
      tagline: chain.tagline,
      icon: chainIcon(chain.id),
      href: `/processes/chains/${chain.id}`,
      dominantArea,
      areaRank: areaRank(dominantArea),
      // The chain's aggregate timeline position — its first constituent's timeOrder, so the
      // grouped view slots it into the area right where a founder actually starts it. Present
      // by construction: loadChains rejects chains composing situations (the only timeOrder-less
      // records), so the assertion can never fire on committed data.
      timeOrder: tasks[0].timeOrder!,
      // The constituent processes as icon chips (the old playbooks table's 'Processes' column),
      // plus their phases so the table's phase filter can honestly scope playbooks too.
      processes: tasks.map((t) => ({ id: t.id, icon: processIcon(t.id), title: t.title, phase: t.phase })),
      phases: [...new Set(tasks.map((t) => t.phase))],
      // Aggregate agent ceiling across every step of every process in the chain — what the
      // combined table sorts playbooks by where a ceiling/steps sort is active.
      pct: ceiling.pct,
      agentSteps: ceiling.agentSteps,
      totalSteps: ceiling.totalSteps,
      // The route strip: one dot per step, capped client-side (legalSignature wears violet).
      steps: nodes.map((n) => ({ label: n.label, route: n.route, legalSignature: n.legalSignature ?? false })),
      // The vendor cell (founder 2026-10-02: chips instead of a 'Go to process' link) — each
      // constituent's derived vendors merged in journey order, deduped, same cap as a process
      // row. derivedVendorsFor already applies the shutdown filter per task.
      vendors: (() => {
        const seen = new Set<string>()
        const out: { id: string; label: string; arena: string | null; hasLogo: boolean }[] = []
        for (const t of tasks) {
          for (const v of derivedVendorsFor(t)) {
            if (seen.has(v.id) || out.length >= VENDOR_CELL_CAP) continue
            seen.add(v.id)
            out.push(v)
          }
        }
        return out
      })(),
    }
  })
}

export interface ProcessRowsBundle {
  rows: ProcessRow[]
  phases: string[]
  /** Corpus-wide agent ceiling: agent-runnable steps / total steps, as a 0–100 percent. */
  agentStepPct: number
  totalProcesses: number
}

// One corpus record serialized for the index tables — shared by buildProcessRows (processes)
// and buildSituationRows (the /situations index, founder 2026-10-02).
function serializeRow(t: ProcessTask): ProcessRow {
  const c = taskCeiling(t)
  // Resolved server-side (like cadence below) so the client table never imports this
  // node-only module — the row carries both the area name and its lifecycle rank. KIND drives
  // the area (founder 2026-10-01): situations group under 'Situations', last.
  const area = areaOfTask(t)
  return {
      slug: processSlug(t.title),
      title: t.title,
      icon: processIcon(t.id),
      phase: t.phase,
      area,
      areaRank: areaRank(area),
      // The reactive classification (founder 2026-10-01): situation rows render the trigger as
      // their subtitle and wear the urgency chip; process rows carry neither.
      kind: t.kind,
      trigger: t.trigger ?? null,
      urgency: t.urgency ?? null,
      // Required on every corpus process (lib/processes.ts) — the index rows carry it for the
      // client-side geo-scope glyph shown while a non-US country is selected (the header
      // country control).
      geoScope: t.geoScope,
      // The country-view filter's slice of the committed geo notes (founder 2026-10-02:
      // "?geo=in should hide the processes that are not used in that country"): per country,
      // the curated kind plus the note's own summary (the hidden-rows disclosure one-liner).
      // US/us-state rows only — global rows never filter, so they carry {} and the payload
      // stays lean (the flavor notes on global processes live on the detail pages).
      geoNotesByCountry: t.geoScope === 'global'
        ? {}
        : Object.fromEntries(
            (t.geoNotes ?? []).map((n) => [n.country, { kind: n.kind, summary: n.summary }]),
          ) as GeoNotesByCountry,
      pct: c.pct,
      agentSteps: c.agentSteps,
      totalSteps: c.totalSteps,
      complexity: t.complexity,
      // The five-orderings fields (curated on the corpus; cadence resolved to its display
      // label/rank here so the client table never imports the node-only helpers). timeOrder is
      // null on situations — reactive work has NO founder-timeline slot; the table sorts the
      // situation rows after the timeline instead of inventing a position.
      timeOrder: t.timeOrder ?? null,
      cadenceLabel: CADENCE_META[t.cadence].label,
      cadenceRank: cadenceRank(t.cadence),
      annoyance: t.annoyance,
      risk: t.risk,
      growthImpact: t.growthImpact,
      // Curated vendors lead, then the cell tops up from the derived market to the cap — so
      // "Cut a release" shows github + sentry AND the ranked code-hosting field (gitlab…).
      // Shutdown products never seed a vendor cell (founder 2026-09-23: Pulley, retired, was
      // still showing in the processes view via curated task vendors).
      vendors: derivedVendorsFor(
        t,
        [...new Set(t.vendors)]
          .filter((v) => {
            const arena = VENDOR_ARENA[v]
            if (!arena) return true // untracked chips have no shutdown state
            const p = loadCategory(arena).products.find((x) => x.id === vendorProductId(v))
            return !p || !isShutdown(p)
          })
          .slice(0, VENDOR_CELL_CAP)
          .map((v) => {
            const id = vendorProductId(v)
            return { id, label: vendorLabel(v), arena: VENDOR_ARENA[v] ?? null, hasLogo: hasLogo(id) }
          }),
      ),
  }
}

export function buildProcessRows(): ProcessRowsBundle {
  // kind=situation records moved OUT of the processes surfaces (founder 2026-10-02: situations
  // get their own /situations index — see buildSituationRows below): every buildProcessRows
  // consumer (/processes, the homepage process mode, the process rankings) now sees processes
  // only, so the table's 'Situations' area group is gone and the corpus-wide ceiling/phase
  // derivations speak for processes alone. Detail pages, chains, the sitemap, and the shared
  // preview still load the full corpus.
  const tasks = loadProcesses().filter((t) => t.kind !== 'situation')

  const byPhase = new Map<string, true>()
  for (const t of tasks) byPhase.set(t.phase, true)
  const phases = [...byPhase.keys()].sort((a, b) => phaseRank(a) - phaseRank(b) || a.localeCompare(b))

  let agentSteps = 0
  let totalSteps = 0
  const rows: ProcessRow[] = tasks.map((t) => {
    const c = taskCeiling(t)
    agentSteps += c.agentSteps
    totalSteps += c.totalSteps
    return serializeRow(t)
  })

  return {
    rows,
    phases,
    agentStepPct: totalSteps === 0 ? 0 : Math.round((agentSteps / totalSteps) * 100),
    totalProcesses: tasks.length,
  }
}

/**
 * The /situations index rows (founder 2026-10-02): the corpus's kind=situation records in the
 * SAME row shape the process tables use, sorted by urgency (hours → days → weeks — the hotter
 * clock reads first), then title. Detail pages stay at /processes/<slug> this round (URL
 * stability — the index links there); the shared preview index also consumes these rows so the
 * preview table keeps its full-corpus coverage.
 */
export function buildSituationRows(): ProcessRow[] {
  return loadProcesses()
    .filter((t) => t.kind === 'situation')
    .map(serializeRow)
    .sort(
      (a, b) =>
        URGENCY_TIERS.indexOf(a.urgency!) - URGENCY_TIERS.indexOf(b.urgency!)
        || a.title.localeCompare(b.title),
    )
}
