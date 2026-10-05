import Link from 'next/link'
import { Fragment } from 'react'
import CeilingBar from '@/components/CeilingBar'
import ComputerUseChips from '@/components/ComputerUseChips'
import GeoStepMark from '@/components/GeoStepMark'
import IconChip from '@/components/IconChip'
import ProductLogoView from '@/components/ProductLogoView'
import ReversibilityBadge from '@/components/ReversibilityBadge'
import StepYourPick from '@/components/StepYourPick'
import StepAfkChip from '@/components/StepAfkChip'
import StepApiCalls from '@/components/StepApiCalls'
import StepMethodDefault from '@/components/StepMethodDefault'
import StepMethodPicker from '@/components/StepMethodPicker'
import StepVendorRow, { type StepRowUntracked, type StepRowVendor } from '@/components/StepVendorRow'
import { StepCostChip, StepFailureModes, StepVerifyLine } from '@/components/StepVerifyCost'
import { computeChipsForStep } from '@/lib/businessLogicMap'
import { layerNodes, type DagEdge } from '@/lib/dagLayers'
import StepDocuments from '@/components/StepDocuments'
import { resolveGapStep } from '@/lib/gapClosers'
import { humanStepAudit } from '@/lib/humanSteps'
import { showComputerUseChips } from '@/lib/humanStepsUi'
import type { ProcessCheckStep } from '@/lib/processCheck'
import { hasLogo } from '@/lib/logos'
import type { DagNode, VendorChipInfo } from '@/lib/processes'
import { stepVendorOptions, vendorAlternatives, vendorChipInfo } from '@/lib/processes'
import { crossArenaStepRankings, stepRanking, type StepCite, type StepRanking, type StepVendorScore } from '@/lib/processRankings'
import { VERDICT_FACTORS } from '@/lib/scoring'
import { buildStepMethodViews } from '@/lib/stepMethodData'
import { stepMethodNodeKey } from '@/lib/stepMethods'
import { stepVendorCallsFor } from '@/lib/stepVendorCalls'
import { vendorGeoLookup } from '@/lib/vendorGeo'

// Block-diagram rendering of a process DAG (server component — <details> for expansion, no
// client JS). Visual language ported from Ultrametric's internal ai-docs eval dashboard and
// adapted to the zinc/emerald theme: each step is a bordered block card with a route-coded
// border + tinted fill (emerald = agent-runnable, amber = manual form/portal, sky = human or
// computer use, violet = a legally required human signature — the founder's 2026-09-21
// softening: human work is not an error state, so person steps are no longer red), blocks
// joined by a vertical connector spine with arrowheads. Layers with true parallelism (from
// dag.edges) render side by side inside a dashed "runs in parallel" group.
//
// Every mapped-vendor block also surfaces the market: beneath the canonical vendor chip, an
// "or:" row lists the arena's top alternatives by agent-readiness (lib/processes.ts swap-options
// machinery). Non-agent steps with an agentic gap-closer (lib/gapClosers.ts, resolved at build
// time against live arenas) keep their compact "⚡ agentic workaround" line inside the block.

// Re-exported from the shared layout helper (lib/dagLayers.ts) so existing importers keep
// working — the layering itself lives there (the mini strip that once shared it left the
// leaderboard, founder 2026-10-02).
export type { DagEdge }

// One task's slice of a chained run — rendered as a labeled header block inside the same
// continuous flow so a whole chain reads as one diagram.
export interface DagSection {
  key: string
  kicker?: string
  title: string
  // Curated process emoji (lib/processIcons.ts) + its REQUIRED tooltip naming the concept.
  icon?: string
  iconTitle?: string
  href?: string
  meta?: string
  pct?: number
  // Corpus task id — lets each step block look up its committed story mapping
  // (lib/processRankings.ts) and rank vendors by STEP relevance instead of arena order.
  taskId?: string
  // Pre-serialized step rows for THIS section's task (lib/processCheckData.ts, keyed by node
  // id) — powers the client-side lens/stack personalization on chain pages exactly as the
  // single-process page's checkSteps prop does.
  checkSteps?: Record<string, ProcessCheckStep>
  // The section task's own /processes/<slug>/mine route for the per-step upgrade nudge.
  mineHref?: string
  nodes: DagNode[]
  edges?: DagEdge[]
}

const ROUTE_STYLE: Record<DagNode['route'], { block: string; badge: string; label: string }> = {
  agent: {
    block: 'border-emerald-400/40 bg-emerald-400/[0.06]',
    badge: 'bg-emerald-400/10 text-emerald-300',
    label: 'agent',
  },
  form: {
    block: 'border-amber-400/40 bg-amber-400/[0.05]',
    badge: 'bg-amber-400/10 text-amber-300',
    label: 'manual form',
  },
  person: {
    block: 'border-sky-400/40 bg-sky-400/[0.05]',
    badge: 'bg-sky-400/10 text-sky-300',
    label: 'human or computer use',
  },
}

// Legally required human signature/attestation acts (DagNode.legalSignature — the founder's
// true human floor, 2026-09-21) get their own visual identity: distinct from the calm sky
// person tone, still never negative.
const SIGNATURE_STYLE: { block: string; badge: string; label: string } = {
  block: 'border-violet-400/40 bg-violet-400/[0.05]',
  badge: 'bg-violet-400/10 text-violet-300',
  label: '✍ signature — legally human',
}

// Kahn layering: lib/dagLayers.ts layerNodes — one topological layer per row of the diagram,
// shared with the mini horizontal strip so both views always agree on the layout.

// Vertical connector segment with an arrowhead — the spine joint between blocks, centered
// under each block (founder 2026-09-30: center the arrows between steps; the old fixed ml-6
// left offset read as a stray margin once the step numbers went).
function Connector() {
  return (
    <svg aria-hidden width="16" height="28" viewBox="0 0 16 28" className="mx-auto block text-zinc-600">
      <line x1="8" y1="0" x2="8" y2="20.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.5 20 L8 27 L11.5 20 Z" fill="currentColor" />
    </svg>
  )
}

// One vendor as a chip: tracked vendors (judged in an arena) link to their product page with a
// rank/agent-readiness tooltip; untracked vendors render as an honest unlinked chip. Logos are
// resolved server-side via hasLogo(product id).
function VendorChip({ info }: { info: VendorChipInfo }) {
  const logoId = info.productId ?? info.vendor
  const body = (
    <>
      <ProductLogoView product={{ id: logoId, name: info.label }} size={28} hasLogo={hasLogo(logoId)} />
      <span className="truncate">{info.label}</span>
    </>
  )
  // The agent-ready number clicks through to its receipts — the /score page that derives it
  // (founder 2026-10-05: every visible score answers 'why?' in one click). Untracked vendors
  // have no judged number, so only the tracked branch renders a score at all.
  const score = info.agentReady !== null && (
    <span className="font-mono text-[10px] tabular-nums text-emerald-400/80">
      {info.agentReady.toFixed(0)}
      <span className="text-zinc-500">/100</span>
    </span>
  )
  // The vendor's own start-here page (lib/processes.ts VENDOR_SIGNUP_URL) — a tiny external ↗
  // beside the chip, so "sign up for payroll"-style steps are actionable in one click. Distinct
  // from the chip itself, which links to OUR judged product page (the evidence).
  const signup = info.signupUrl && (
    <a
      href={info.signupUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${info.label}'s own start page — ${new URL(info.signupUrl).hostname.replace(/^www\./, '')} (external)`}
      className="shrink-0 rounded px-0.5 text-[10px] text-zinc-500 transition hover:text-emerald-300"
    >
      ↗
    </a>
  )
  if (info.productId && info.arenaId) {
    return (
      <span className="inline-flex min-w-0 items-center gap-0.5">
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900/60 py-0.5 pl-0.5 pr-2 text-zinc-200 transition hover:border-emerald-400/60">
          <Link
            href={`/arena/${info.arenaId}/product/${info.productId}`}
            title={`${info.label} — #${info.rank} by agent-readiness in ${info.arenaName}${
              info.agentReady !== null ? ` · ${info.agentReady.toFixed(0)}/100 agent-ready` : ''
            } — see the judged product page`}
            className="inline-flex min-w-0 items-center gap-1.5 transition hover:text-emerald-300"
          >
            {body}
          </Link>
          {score && (
            <Link
              href={`/arena/${info.arenaId}/product/${info.productId}/score`}
              title={`${info.agentReady!.toFixed(0)}/100 agent-ready in ${info.arenaName} — open the score receipts`}
              className="transition hover:text-emerald-300"
            >
              {score}
            </Link>
          )}
        </span>
        {signup}
      </span>
    )
  }
  return (
    <span className="inline-flex min-w-0 items-center gap-0.5">
      <span
        title={`${info.label} — not yet judged on Ultrametric`}
        className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 py-0.5 pl-0.5 pr-2 text-zinc-400"
      >
        {body}
        {score}
      </span>
      {signup}
    </span>
  )
}

// Per-story verdict trace for one vendor inside the "how these are ranked" expandable (founder
// ask 2026-09-23: SEE the evidence per chip, and whether we actually checked the vendor for the
// step). Each mapped story gets a verdict icon + its title LINKED to the vendor's product page
// at the judged verdict row (StoryVerdictsTable's #story-<storyId> anchor) — strongest verdicts
// first, and 'none'/'na' rendered per story too, so "we checked and it doesn't deliver" is
// visibly different from "not checked". Exported for its unit test; server-rendered, no state.
const CITE_META: Record<StepCite['verdict'], { icon: string; label: string; cls: string }> = {
  full: { icon: '✓', label: 'full — the judged verdict says the vendor delivers this story', cls: 'text-emerald-400/90' },
  partial: { icon: '◐', label: 'partial — delivers with gaps', cls: 'text-emerald-300/70' },
  disputed: { icon: '~', label: 'disputed — the evidence disagrees', cls: 'text-amber-400/80' },
  none: { icon: '✕', label: 'not delivered — judged, and the vendor does not deliver this story', cls: 'text-zinc-500' },
  na: { icon: '·', label: 'n/a — not applicable to this vendor, excluded from the score', cls: 'text-zinc-700' },
}

const CITE_ORDER: ReadonlyArray<StepCite['verdict']> = ['full', 'partial', 'disputed', 'none', 'na']

export function VendorCiteLine({ vendor }: { vendor: StepVendorScore }) {
  const cites = [...vendor.cites].sort(
    (a, b) => CITE_ORDER.indexOf(a.verdict) - CITE_ORDER.indexOf(b.verdict),
  )
  return (
    <>
      {cites.map((c, i) => {
        const meta = CITE_META[c.verdict]
        return (
          <Fragment key={c.storyId}>
            {i > 0 && <span className="text-zinc-700"> · </span>}
            <span className="whitespace-nowrap">
              <span aria-hidden className={meta.cls}>{meta.icon}</span>{' '}
              <Link
                href={`/arena/${vendor.arenaId}/product/${vendor.productId}#story-${c.storyId}`}
                title={`${meta.label} · story weight ${c.weight} — open this judged verdict on ${vendor.name}'s product page`}
                className="text-zinc-400 underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300"
              >
                {c.storyTitle}
              </Link>
            </span>
          </Fragment>
        )
      })}
    </>
  )
}

// The story-derived step ranking (founder ask: rank vendors per STEP from the stories they
// actually support, don't assume the user has a vendor). Replaces the arena-ordered "via:" row
// when the step has a committed story mapping; the expandable underneath exposes the mapped
// stories and every verdict behind every score — same transparency bar as the /score pages.
//
// Cross-arena options (founder ask: "generate a website" is also served by ChatGPT, Framer,
// Figma, Canva — not just the vibe-coding roster) merge into the SAME ranked list, sorted by
// step score, each carrying a small arena tag naming where its judged evidence lives. `ranking`
// may be null for steps whose only judged market is cross-arena.
//
// The chip row itself is CLIENT-rendered (components/StepVendorRow.tsx) so vendors are
// selectable — founder 2026-09-21: clicking a vendor adapts the whole process to run via it.
// This server component serializes the SAME merged list the row always showed (order, scores,
// tooltips preserved; SSR of the client row with the empty lens/stack snapshots renders the
// identical default chips), and keeps the "how these are ranked" evidence trail server-side.
function StepRankingRow({
  ranking,
  extras,
  node,
  lensKey,
  checkStep,
}: {
  ranking: StepRanking | null
  extras: StepRanking[]
  node: DagNode
  lensKey?: string
  checkStep?: ProcessCheckStep
}) {
  // Curated market entries we don't rank (untracked vendors — no judged verdicts) stay visible
  // as honest unlinked chips after the ranked list. Only when the primary market is ranked —
  // extras-only steps keep their full "via:" row separately.
  const untracked = ranking ? stepVendorOptions(node).filter((o) => !o.productId) : []
  const merged = [
    ...(ranking?.vendors ?? []).map((v) => ({ vendor: v, arenaName: ranking!.arenaName, cross: false })),
    ...extras.flatMap((r) => r.vendors.map((v) => ({ vendor: v, arenaName: r.arenaName, cross: true }))),
  ].sort((a, b) => b.vendor.score - a.vendor.score || a.vendor.name.localeCompare(b.vendor.name))
  const blocks = [...(ranking ? [ranking] : []), ...extras]
  const storyCount = blocks.reduce((n, b) => n + b.stories.length, 0)
  const rowVendors: StepRowVendor[] = merged.map((e) => ({
    productId: e.vendor.productId,
    arenaId: e.vendor.arenaId,
    arenaName: e.arenaName,
    name: e.vendor.name,
    score: e.vendor.score,
    hasLogo: hasLogo(e.vendor.productId),
    cross: e.cross,
    citesTotal: e.vendor.cites.length,
    citesFull: e.vendor.cites.filter((c) => c.verdict === 'full').length,
    citesPartial: e.vendor.cites.filter((c) => c.verdict === 'partial').length,
  }))
  const rowUntracked: StepRowUntracked[] = untracked.map((o) => ({
    vendor: o.vendor,
    label: o.label,
    hasLogo: hasLogo(o.vendor),
    signupUrl: o.signupUrl,
  }))
  // Committed (vendor, country) availability for THIS row's vendors (jurisdictions/
  // vendor-geo.json) — the client row annotates chips under a non-US geo selection
  // (✓/◐/muted ✕, components/VendorGeoMark.tsx); never re-ranks, never guesses.
  const vendorGeo = vendorGeoLookup(rowVendors.map((v) => v.productId))
  return (
    <>
      <StepVendorRow
        vendors={rowVendors}
        untracked={rowUntracked}
        arenaLink={ranking?.arenaId ?? null}
        storyCount={storyCount}
        lensKey={lensKey}
        checkStep={checkStep}
        vendorGeo={vendorGeo}
      />
      <details className="group mt-1.5">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] text-zinc-500 transition hover:text-zinc-300 [&::-webkit-details-marker]:hidden">
          <span aria-hidden className="inline-block text-[9px] transition-transform group-open:rotate-90">▶</span>
          {/* One quiet word (founder 2026-10-02: drop the 'how these are ranked — N judged
              stories · N vendors' line) — the expandable per-story receipts stay. */}
          <span title={`${storyCount} judged stories · ${merged.length} vendors${extras.length > 0 ? ` · ${blocks.length} arenas` : ''} — expand for the per-story citations`}>evidence</span>
        </summary>
        <div className="mt-1.5 space-y-1.5 border-l border-zinc-800 pl-3 text-[11px] text-zinc-500">
          <p>
            Score = story-weighted verdicts on the stories mapped to this step
            {/* Interpolated from lib/scoring.ts VERDICT_FACTORS (SSOT audit 2026-09-30) — the
                prose can never drift from the weights the recompute actually uses. */}
            {` (full=${VERDICT_FACTORS.full}, partial=${VERDICT_FACTORS.partial}, disputed=${VERDICT_FACTORS.disputed}, none=${VERDICT_FACTORS.none} · n/a excluded)`}{' '}
            — every number below traces to a judged verdict on the vendor&rsquo;s product page.
            {extras.length > 0
              && ' Cross-arena vendors are scored on THEIR arena’s mapped stories and appear only with at least one judged full/partial verdict.'}
          </p>
          {blocks.map((b) => (
            <div key={b.arenaId} className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                {b.arenaName}
                {b.kind === 'extra' && ' (cross-arena)'}
              </p>
              <ul className="space-y-0.5">
                {b.stories.map((s) => (
                  <li key={s.id} className="text-zinc-400">
                    <span className="text-zinc-500">w{s.weight}</span> {s.title}
                  </li>
                ))}
              </ul>
              <ul className="space-y-0.5">
                {b.vendors.map((v) => (
                  <li key={v.productId}>
                    <Link href={`/arena/${v.arenaId}/product/${v.productId}`} className="text-zinc-300 transition hover:text-emerald-300">
                      {v.name}
                    </Link>{' '}
                    {/* The score itself clicks through to the judged verdicts table that
                        produced it (founder 2026-10-05) — the per-story links beside it keep
                        targeting each verdict's own #story- anchor. */}
                    <Link
                      href={`/arena/${v.arenaId}/product/${v.productId}#story-verdicts`}
                      title={`${v.score.toFixed(0)}/100 — open the judged story verdicts this score derives from`}
                      className="font-mono tabular-nums text-emerald-400/80 transition hover:text-emerald-300"
                    >{v.score.toFixed(0)}<span className="text-zinc-500">/100</span></Link>{' '}
                    — <VendorCiteLine vendor={v} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </>
  )
}

function NodeBlock({
  node,
  taskId,
  checkStep,
  mineHref,
  lensKey,
  manifestUrl,
  usScoped,
}: {
  node: DagNode
  taskId?: string
  // Pre-serialized step row (lib/processCheckData.ts) for the client-side "yours" line — the
  // static HTML is unchanged; only readers with an "I'm using" stack see it hydrate in.
  checkStep?: ProcessCheckStep
  mineHref?: string
  // Process-lens page key (lib/processLens.ts): taskId on /processes/[slug], the chain id on
  // /processes/chains/[chain] so one clicked vendor flows across every section.
  lensKey?: string
  // Absolute URL of this page's manifest (process or chain) — feeds the staff-gated per-step
  // AFK computer-use trigger (components/StepAfkChip.tsx) on actionUrl steps.
  manifestUrl?: string
  // The process is us/us-state scoped (geoScope, lib/processes.ts) — every step carries the
  // subtle client-side 🇺🇸 marker while a non-US country is selected (GeoStepMark renders
  // nothing otherwise, so the static HTML is untouched).
  usScoped?: boolean
}) {
  const style = node.legalSignature ? SIGNATURE_STYLE : ROUTE_STYLE[node.route]
  const vendorInfo = node.vendor ? vendorChipInfo(node.vendor) : null
  // Story-derived ranking for the step (lib/processRankings.ts): present whenever the step has
  // a covering arena and a committed non-empty story mapping. When it exists it REPLACES the
  // arena-ordered "via:" roster and the "or:" alternatives — the same market, ranked by step
  // relevance instead of overall arena rank.
  const ranking = taskId ? stepRanking(taskId, node) : null
  // Cross-arena markets for the step (extraOptionArenas / extraOptionRefs), evidence-gated —
  // merged into the ranked row with an arena tag per vendor.
  const extras = taskId ? crossArenaStepRankings(taskId, node) : []
  // Steps with a derived market (optionsArenaId) already show the whole arena in the "via:"
  // row — a second "or:" row of alternatives would just repeat it.
  const alts = node.vendor && !node.optionsArenaId && !ranking ? vendorAlternatives(node.vendor) : []
  // Live market for the step's general function: arena-derived roster (top by Overall score, in
  // arena-rank order) plus curated extras — lib/processes.ts stepVendorOptions.
  const options = ranking ? [] : stepVendorOptions(node)
  const calls = node.functionCalls ?? []
  const gap = resolveGapStep(node)
  // A legally-required signature act never gets a workaround — the e-sign medium may be
  // electronic, but the signing human is not replaceable (founder 2026-09-21).
  const closer = !node.legalSignature && gap?.kind === 'closer' ? gap.closer : null
  // Evidence-grounded per-vendor calls for this step (data/step-vendor-calls.json) — when
  // present they take over the API-calls block, with the node's own functionCalls kept as the
  // canonical reference flow.
  const vendorCalls = taskId ? stepVendorCallsFor(taskId, node.id) : []
  // The step's function-level open-module mappings (founder 2026-10-02: "go deeper on the
  // mapping of the logic") — processes/business-logic-map.json steps, rendered as tiny muted
  // "compute: <module>.<function>" chips below. Most steps carry none and render nothing.
  const computeChips = taskId ? computeChipsForStep(taskId, node.id) : []
  // Authored root cause + computer-use feasibility for human/manual steps (founder 2026-09-21:
  // "get to the bottom of why, and why computer use can't be used there"). Null until the
  // audited entry exists — renderers then fall back to today's behavior.
  const audit = taskId && node.route !== 'agent' ? humanStepAudit(taskId, node.id) : null
  // Does this step surface a MARKET (a ranked row or a "via:" roster)? Then no canonical chip
  // renders at all (founder 2026-09-30: the step's vendors are ONE ranked line, highest score
  // first, no 'e.g.'-prefixed reference chip — which retires the 2026-09-23 StepCanonicalVendor
  // demotion pattern). Vendor-locked steps (IRS, Delaware portal…) have no market and keep the
  // full-strength chip.
  const hasMarket = ranking !== null || extras.length > 0 || options.length > 0

  // The step's action row (the per-step agent-prompt affordances — StepPromptBox's copy box,
  // '🪄 do it with AI' and Open-in-Claude/ChatGPT links — were removed, founder 2026-10-02;
  // the generated data/step-prompts.json stays committed, just no longer rendered): the
  // staff-gated per-step AFK computer-use trigger, then the canonical external "do it
  // yourself" page a human uses (data-level actionUrl, verified live before it ships — e.g.
  // the IRS EIN application or Delaware's filing portal; deliberately distinct from the vendor
  // chips, which link to our judged product pages).
  const afkChip = node.actionUrl && manifestUrl && (
    <StepAfkChip manifestUrl={manifestUrl} nodeId={node.id} />
  )
  const doItYourself = node.actionUrl && (
    <a
      href={node.actionUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={`Do this step yourself at ${node.actionLabel ?? new URL(node.actionUrl).hostname.replace(/^www\./, '')} (external site)`}
      className="inline-flex items-center gap-1 rounded-md border border-zinc-700/80 px-1.5 py-0.5 text-[10px] text-zinc-300 transition hover:border-emerald-400/60 hover:text-emerald-300"
    >
      do it yourself: {node.actionLabel ?? new URL(node.actionUrl).hostname.replace(/^www\./, '')} ↗
    </a>
  )

  // Method variants (founder 2026-09-30): a method-bearing step gets the compact selector
  // (components/StepMethodPicker.tsx) and its default-method content — the route badge and the
  // whole body below the header — hides client-side while a variant is selected, whose panel
  // shows the variant's own route/vendors/calls/time and sub-DAG instead. Nodes without methods
  // render EXACTLY the pre-variant output (no wrapper, no picker), and the static HTML of a
  // method-bearing step is byte-stable too: the server snapshot is always the default method.
  const methodViews = node.methods && node.methods.length > 0 ? buildStepMethodViews(node, taskId) : null
  const nodeKey = stepMethodNodeKey(taskId, node.id)

  // The route badge, plus the step's reversibility marker (founder 2026-09-30) — the marker
  // renders nothing for reversible steps, so most blocks are byte-identical to before.
  const routeBadge = (
    <span className="mt-px flex shrink-0 items-center gap-1.5">
      <ReversibilityBadge tier={node.reversibility} />
      <span
        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.badge}`}
      >
        {style.label}
      </span>
    </span>
  )

  const body = (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[11px]">
        {vendorInfo && !hasMarket && <VendorChip info={vendorInfo} />}
        {node.approvalRequired && (
          <span
            className="rounded bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300"
            title="Approval gate — agent-runnable, but a human signs off first"
          >
            ⏸ approval gate
          </span>
        )}
        {/* The '⏳ async' chip is gone (founder 2026-09-30) — the route badge alone carries the
            step's nature; async-ness stays data (manifests, simulator) without a per-step chip. */}
        {node.riskLevel && node.riskLevel !== 'low' && (
          <span className={node.riskLevel === 'high' ? 'font-semibold text-red-300/90' : 'text-zinc-500'}>
            {node.riskLevel} risk
          </span>
        )}
        {/* The step's sourced real cost (depth wave pt 1) — a muted suffix chip linking to the
            cited fee schedule / pricing page, as-of date on its face. Most steps carry none. */}
        {node.cost && <StepCostChip cost={node.cost} />}
      </div>

      {/* The primary action row — [⚡ run with Ultrametric (staff, → /get-started; the
          2026-10-05 rename of 'run with AFK')] → [do it yourself ↗]. Steps without an
          actionUrl render nothing extra. */}
      {node.actionUrl && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          {afkChip}
          {doItYourself}
        </div>
      )}

      {/* The step's canonical open documents (founder 2026-10-02): small chips linking OUT to
          the registry record's real URL (open-documents/registry.json — link, never redistribute),
          labeled with the registry title. External-link hygiene matches 'do it yourself' above;
          an unknown id throws at build time (lib/documents.ts openDocumentById). Most steps
          carry none and render nothing. */}
      {node.documents && <StepDocuments documents={node.documents} />}

      {/* The step's open-module functions (founder 2026-10-02): the registry's per-step
          entries as tiny muted "compute: <module>.<function>" chips — the document-chip row
          idiom above, one shade quieter (this is library code, not an action). Tooltip carries
          the honest 'what' clause; the chip deep-links to the module's section in
          open-modules/README.md on GitHub (lib/businessLogicMap.ts computeChipsForStep). */}
      {computeChips.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span
            className="text-[10px] uppercase tracking-wide text-zinc-500"
            title="The open-module function whose cited, tested math computes this step — each chip opens the module's section in open-modules/README.md on GitHub"
          >
            compute:
          </span>
          {computeChips.map((c) => (
            <a
              key={`${c.module}.${c.fn}`}
              href={c.href}
              target="_blank"
              rel="noopener noreferrer"
              title={`${c.module}.${c.fn} — ${c.what} (open module, open-modules/README.md on GitHub)`}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 transition hover:border-emerald-400/60 hover:text-emerald-300"
            >
              {c.module}.{c.fn} ↗
            </a>
          ))}
        </div>
      )}

      {(ranking !== null || extras.length > 0) && (
        <StepRankingRow ranking={ranking} extras={extras} node={node} lensKey={lensKey} checkStep={checkStep} />
      )}

      {checkStep && mineHref && <StepYourPick step={checkStep} mineHref={mineHref} />}

      {options.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span
            className="text-[10px] uppercase tracking-wide text-zinc-500"
            title="Companies that can perform this step — judged ones link to their arena product page"
          >
            via:
          </span>
          {options.map((o) => (
            <VendorChip key={o.vendor} info={o} />
          ))}
          {node.optionsArenaId && (
            <Link
              href={`/arena/${node.optionsArenaId}`}
              title="This list is derived from the arena's live leaderboard (top products by Overall score) — see the whole judged market"
              className="whitespace-nowrap text-[10px] text-zinc-500 transition hover:text-emerald-300"
            >
              full arena →
            </Link>
          )}
        </div>
      )}

      {alts.length > 0 && (
        <p className="mt-1.5 text-[11px] text-zinc-500">
          <span className="mr-1.5 text-[10px] uppercase tracking-wide">or:</span>
          {alts.map((o, i) => (
            <span key={o.id} className="whitespace-nowrap">
              {i > 0 && <span className="mx-1.5 text-zinc-700">·</span>}
              <Link
                href={`/arena/${o.arenaId}/product/${o.id}`}
                className="inline-flex items-center gap-1 align-middle text-zinc-300 transition hover:text-emerald-300"
              >
                <ProductLogoView product={{ id: o.id, name: o.name }} size={22} hasLogo={hasLogo(o.id)} />
                {o.name}
              </Link>
              {o.agentReady !== null && (
                <Link
                  href={`/arena/${o.arenaId}/product/${o.id}/score`}
                  className="ml-1 font-mono text-[10px] tabular-nums text-emerald-400/80 transition hover:text-emerald-300"
                  title={`${o.agentReady.toFixed(0)}/100 agent-ready — open the score receipts`}
                >
                  {o.agentReady.toFixed(0)}
                  <span className="text-zinc-500">/100</span>
                </Link>
              )}
            </span>
          ))}
        </p>
      )}

      {/* The 'why human: …' explanation line is gone (founder 2026-09-30: the route badge alone
          carries it) — the audit still GATES the computer-use chips below, so an authority/
          physics/third-party blocker never shows a misleading "could attempt it today" row. */}

      {vendorCalls.length > 0 ? (
        <StepApiCalls
          canonical={calls}
          canonicalVendor={node.vendor}
          vendors={vendorCalls}
          lensKey={lensKey}
        />
      ) : calls.length > 0 ? (
        <details className="group mt-2">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 font-mono text-[11px] text-zinc-500 transition hover:text-zinc-300 [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="inline-block text-[9px] transition-transform group-open:rotate-90">
              ▶
            </span>
            {calls.length} API call{calls.length === 1 ? '' : 's'}
          </summary>
          <ul className="mt-1.5 space-y-0.5 border-l border-zinc-800 pl-3">
            {calls.map((fc) => (
              <li key={fc.method} className="truncate font-mono text-[11px] text-zinc-400" title={fc.description}>
                {fc.method}
                {fc.type === 'manual' && <span className="ml-1 text-amber-400/80">(manual)</span>}
              </li>
            ))}
          </ul>
        </details>
      ) : (
        node.toolCall && <p className="mt-2 truncate font-mono text-[11px] text-zinc-500">{node.toolCall}</p>
      )}

      {/* Founder 2026-09-18: "any time 'manual' is seen, see if we can do a computer use
          process for it." Every non-agent step block surfaces the judged computer-use fleet —
          who could attempt the mechanical part today, verdict-backed. The route badge above is
          unchanged: the step stays form/manual/human. Renders nothing without judged evidence.
          Audited nodes gate the chips on feasibility (founder 2026-09-21): where the blocker is
          authority, physics, or a third party's clock, "could attempt it today" would mislead —
          the chips simply don't render there (the audited why lives in the manifest data; the
          on-page 'why human' line was retired 2026-09-30). Legally-required signature acts
          (legalSignature) never show chips at all. */}
      {taskId && node.route !== 'agent' && showComputerUseChips(audit?.computerUse, node.legalSignature) && (
        <div className="mt-2 text-[11px]">
          <ComputerUseChips taskId={taskId} nodeId={node.id} />
        </div>
      )}

      {closer && (
        <p className="mt-2 text-[11px] text-zinc-400">
          <span className="text-emerald-300/90">⚡ agentic workaround:</span> {closer.blurb} —{' '}
          <Link
            href={`/arena/${closer.arenaId}/product/${closer.topProduct.id}`}
            className="text-zinc-300 underline decoration-zinc-700 underline-offset-2 transition hover:text-emerald-300"
          >
            {closer.topProduct.name}
          </Link>
          {', '}
          <Link href={`/arena/${closer.arenaId}`} className="transition hover:text-emerald-300">
            top of {closer.arenaName} →
          </Link>
          {closer.caution && <span className="text-amber-400/80"> · {closer.caution}</span>}
        </p>
      )}

      {/* "How do I know it worked?" (depth wave pt 1) — the step's concrete external check,
          curated only where a real one exists; renders nothing for the many steps without. */}
      {node.verify && <StepVerifyLine verify={node.verify} />}

      {/* "⚠ if it goes wrong" (founder spike 2026-10-02) — the step's curated failure modes,
          collapsed by default; renders nothing for the many steps without entries. */}
      {node.failureModes && node.failureModes.length > 0 && (
        <StepFailureModes failureModes={node.failureModes} />
      )}
    </>
  )

  return (
    // Per-step anchor (founder 2026-10-02): the product pages' per-step receipts deep-link to
    // #step-<taskId>-<nodeId> — taskId-prefixed so chain pages (several tasks, one diagram)
    // can never collide. Blocks without a corpus taskId (previews) carry no anchor.
    <div
      id={taskId ? `step-${taskId}-${node.id}` : undefined}
      className={`min-w-0 scroll-mt-4 rounded-lg border p-3 ${style.block}`}
    >
      <div className="flex items-start justify-between gap-2">
        {/* No step index numbers (founder 2026-09-30: '01', '02'… gone) — the connector spine
            already carries the order. */}
        <p className="min-w-0 text-sm font-medium text-zinc-100">
          {node.label}
          {usScoped && <GeoStepMark />}
        </p>
        {methodViews ? <StepMethodDefault nodeKey={nodeKey}>{routeBadge}</StepMethodDefault> : routeBadge}
      </div>
      {methodViews && (
        <StepMethodPicker
          nodeKey={nodeKey}
          defaultView={methodViews.defaultView}
          methods={methodViews.variants}
        />
      )}
      {methodViews ? <StepMethodDefault nodeKey={nodeKey}>{body}</StepMethodDefault> : body}
    </div>
  )
}

function Flow({
  nodes,
  edges,
  taskId,
  checkSteps,
  mineHref,
  lensKey,
  manifestUrl,
  usScoped,
}: {
  nodes: DagNode[]
  edges?: DagEdge[]
  taskId?: string
  checkSteps?: Record<string, ProcessCheckStep>
  mineHref?: string
  lensKey?: string
  manifestUrl?: string
  usScoped?: boolean
}) {
  const layers = layerNodes(nodes, edges)
  return (
    <>
      {layers.map((layer, li) => (
        <Fragment key={layer[0].id}>
          {li > 0 && <Connector />}
          {layer.length === 1 ? (
            <NodeBlock
              node={layer[0]}
              taskId={taskId}
              checkStep={checkSteps?.[layer[0].id]}
              mineHref={mineHref}
              lensKey={lensKey}
              manifestUrl={manifestUrl}
              usScoped={usScoped}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-700/80 p-2">
              <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                runs in parallel · {layer.length}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {layer.map((n) => (
                  <NodeBlock
                    key={n.id}
                    node={n}
                    taskId={taskId}
                    checkStep={checkSteps?.[n.id]}
                    mineHref={mineHref}
                    lensKey={lensKey}
                    manifestUrl={manifestUrl}
                    usScoped={usScoped}
                  />
                ))}
              </div>
            </div>
          )}
        </Fragment>
      ))}
    </>
  )
}

// Chain divider: the task title as a header block in the same flow, so a chained run reads as
// one continuous diagram with labeled sections.
function SectionHeader({ section }: { section: DagSection }) {
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          {section.kicker && (
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">{section.kicker}</p>
          )}
          <h3 className="font-display flex items-center gap-1.5 text-base font-semibold tracking-tight text-zinc-100">
            {section.icon && (
              <IconChip icon={section.icon} title={section.iconTitle ?? section.title} />
            )}
            {section.href ? (
              <Link href={section.href} className="transition hover:text-emerald-300">
                {section.title}
              </Link>
            ) : (
              section.title
            )}
          </h3>
        </div>
        {typeof section.pct === 'number' && <CeilingBar pct={section.pct} />}
      </div>
      {section.meta && <p className="mt-1 text-xs text-zinc-500">{section.meta}</p>}
    </div>
  )
}

export default function ProcessDag({
  nodes,
  edges,
  sections,
  taskId,
  checkSteps,
  mineHref,
  lensKey,
  manifestUrl,
  usScoped,
}: {
  nodes?: DagNode[]
  edges?: DagEdge[]
  sections?: DagSection[]
  taskId?: string
  checkSteps?: Record<string, ProcessCheckStep>
  mineHref?: string
  // One lens key for the WHOLE diagram (lib/processLens.ts): the task id on a process page, the
  // chain id on a chain page — so a vendor clicked in one section applies to every later step
  // whose arena matches.
  lensKey?: string
  // ONE manifest URL for the WHOLE diagram (lib/processManifest.ts): the process manifest on
  // /processes/[slug], the chain manifest on /processes/chains/[chain] — the artifact the
  // per-step AFK trigger hands off, scoped by &node=<nodeId>.
  manifestUrl?: string
  // us/us-state geoScope of the ONE process this diagram renders — /processes/[slug] passes it
  // so every step wears the client-side 🇺🇸 marker under a non-US selection. Chain pages (mixed
  // scopes per section) don't pass it and stay unmarked.
  usScoped?: boolean
}) {
  if (sections && sections.length > 0) {
    return (
      <div>
        {sections.map((s, si) => (
          <Fragment key={s.key}>
            {si > 0 && <Connector />}
            <SectionHeader section={s} />
            <Connector />
            <Flow
              nodes={s.nodes}
              edges={s.edges}
              taskId={s.taskId}
              checkSteps={s.checkSteps}
              mineHref={s.mineHref}
              lensKey={lensKey}
              manifestUrl={manifestUrl}
            />
          </Fragment>
        ))}
      </div>
    )
  }
  return (
    <div>
      <Flow
        nodes={nodes ?? []}
        edges={edges}
        taskId={taskId}
        checkSteps={checkSteps}
        mineHref={mineHref}
        lensKey={lensKey}
        manifestUrl={manifestUrl}
        usScoped={usScoped}
      />
    </div>
  )
}
