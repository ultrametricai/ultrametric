'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { IconGlyph } from '@/components/IconChip'
import ProductLogoView from '@/components/ProductLogoView'
import { chainIcon, processIcon } from '@/lib/processIcons'
import type { SimStep } from '@/lib/processSim'
import type { SyntheticArtifact, TopVendorPick, VirtualTaskPayload } from '@/lib/virtualStartup'

// The journey DAG viewer (founder ask 2026-09-29; reworked round 5: "use vertical space more —
// it tries to stay in a horizontal-only mode and needs space"): a WRAPPING FLOW of the run above
// the terminal — one node per PROCESS (chain task) in journey order, wrapping left→right,
// top→bottom in reading order. Round 4's fisheye zoom (tier chrome, flex compression, fixed
// 140/200px band) is GONE: every node renders at one comfortable FIXED size — icon + title
// legible always — and the container grows vertically with content instead of squeezing nodes
// horizontally. Beyond a cap of min(45vh, 380px) the strip scrolls vertically (never
// horizontally), auto-pinned to the newest node while running with the same follow-slack
// courtesy as the terminal (a reader scroll up unpins; back near the bottom re-pins).
//
// CLUSTERS (round 5 call): box-frames fight wrapping — a frame either forbids its nodes from
// wrapping mid-cluster or turns into a block that breaks reading order — so each phase renders
// as a chain-tinted LABEL CHIP leading its first node in the flow; the chain hue also tints the
// done-node fill, so cluster membership stays readable across wrapped rows.
//
// EDGES: within a row, a simple hand-rolled connector (short line + arrowhead, lit emerald once
// traversed) leads every node after the first. Across a row-wrap the arrow would point at the
// row edge, so a measured effect (offsetTop of the flow items — no deps, no timers) swaps the
// wrapped item's leading connector for a WRAP ELBOW — a drawn ⤶-style curve that drops in from
// the row above and turns into an arrowhead at the node (founder 2026-10-02: the old ↵ text
// hint was too subtle to read as "the previous row continues here"). Same lit/unlit scheme as
// the in-row edge, and the EXACT same horizontal footprint (the invariant below).
//
// PROGRESSIVE REVEAL (kept from round 4): upcoming nodes are NOT shown. Pre-run only the FIRST
// node renders, dim; each node appears exactly when the reveal reaches its task row
// (dagNodeReached — which also covers "its cluster started": the phase row prints one tick
// earlier). A completed run shows the whole traversed journey.
//
// LIVE state is DERIVED from the exact same revealed-row list the terminal and the state panel
// print from (no timers of its own — tests assert it): a node is pending (dim outline) until the
// reveal reaches its first row, active (pulsing emerald ring) while its rows are printing, done
// (filled, chain-tinted) once its last row printed. Seeded mid-run events and semi-auto decision
// pauses render as small diamond markers under the node whose terminal region carries them; the
// pause the run is currently waiting on pulses amber (its host node is visible by construction —
// a pause row is never past the reveal). The top judged pick's logo rides INSIDE the node box,
// trailing the title, once its step prints (founder 2026-10-02 — outside the box it didn't read
// as the node's vendor). A semi-auto recomposition simply re-derives: printed/passed nodes never
// change (the pause lands before the first affected row), only the unrevealed tail redraws.

// ---------------------------------------------------------------------------
// Source rows — structurally identical to VirtualStartup.tsx's Row union (mirrored here so the
// two components stay decoupled; TypeScript's structural typing keeps them assignable).
// ---------------------------------------------------------------------------

export type VsDagSourceRow =
  | { kind: 'phase'; key: string; title: string; chainId: string; chainName: string; note: string | null }
  | { kind: 'task'; key: string; task: VirtualTaskPayload }
  | { kind: 'day'; key: string; day: number }
  | { kind: 'step'; key: string; step: SimStep; top: TopVendorPick | null; outNote: string | null; outMinutes: number }
  | { kind: 'artifact'; key: string; artifact: SyntheticArtifact }
  | { kind: 'vsevent'; key: string; eventId: string; day: number }

// A semi-auto pause point (VirtualStartup's pause schedule): the run stops at row index `at`
// until the reader answers `id` (a decision id or 'name'); `label` is the visible card title.
export interface VsDagPause {
  id: string
  at: number
  label: string
}

// ---------------------------------------------------------------------------
// Pure derivation — exported so tests can drive it directly.
// ---------------------------------------------------------------------------

export interface VsDagNode {
  taskId: string
  title: string
  slug: string
  stepCount: number
  agentSteps: number
  // The row-index span this process occupies in the terminal: rowStart is its task row, rowEnd
  // the last row (step/artifact/day/event) printed under it before the next process or phase.
  rowStart: number
  rowEnd: number
  // The first printed step's top judged pick (logo dot) and the row where it prints (-1 = none).
  vendor: { productId: string; name: string; hasLogo: boolean } | null
  vendorRow: number
}

export interface VsDagCluster {
  phaseKey: string
  title: string
  chainId: string
  chainName: string
  nodes: VsDagNode[]
}

export interface VsDagMarker {
  kind: 'event' | 'pause'
  key: string
  id: string
  // The drawn sim day for events; null for pauses (a pause is a row position, not a day).
  day: number | null
  // The node the marker attaches under (null = before the first node — a Run-press pause).
  taskId: string | null
  // The row index the marker lives at — revealed once the cursor passes it.
  at: number
}

export function deriveJourneyDag(
  rows: readonly VsDagSourceRow[],
  pauses: readonly VsDagPause[] = [],
): { clusters: VsDagCluster[]; markers: VsDagMarker[] } {
  const clusters: VsDagCluster[] = []
  const nodes: VsDagNode[] = []
  const markers: VsDagMarker[] = []
  let current: VsDagNode | null = null
  const close = (endIdx: number) => {
    if (current) current.rowEnd = endIdx
    current = null
  }
  rows.forEach((row, i) => {
    if (row.kind === 'phase') {
      close(i - 1)
      clusters.push({ phaseKey: row.key, title: row.title, chainId: row.chainId, chainName: row.chainName, nodes: [] })
    } else if (row.kind === 'task') {
      close(i - 1)
      current = {
        taskId: row.task.id,
        title: row.task.title,
        slug: row.task.slug,
        stepCount: row.task.steps.length,
        agentSteps: row.task.steps.filter((s) => s.route === 'agent').length,
        rowStart: i,
        rowEnd: rows.length - 1,
        vendor: null,
        vendorRow: -1,
      }
      // Defensive: buildRunRows always leads with a phase row, so this never fires in practice.
      if (clusters.length === 0) clusters.push({ phaseKey: 'phase-unknown', title: '', chainId: '', chainName: '', nodes: [] })
      clusters[clusters.length - 1].nodes.push(current)
      nodes.push(current)
    } else if (row.kind === 'step') {
      if (current && current.vendor === null && row.top) {
        current.vendor = { productId: row.top.productId, name: row.top.name, hasLogo: row.top.hasLogo === true }
        current.vendorRow = i
      }
    } else if (row.kind === 'vsevent') {
      markers.push({
        kind: 'event',
        key: `event-${row.eventId}`,
        id: row.eventId,
        day: row.day,
        taskId: current?.taskId ?? null,
        at: i,
      })
    }
  })
  // A pause attaches under the node whose terminal region contains its row (the last node whose
  // task row is at or before the pause index); a Run-press pause (at 0, before any node) floats
  // at the strip's leading edge.
  for (const p of pauses) {
    let host: VsDagNode | null = null
    for (const n of nodes) {
      if (n.rowStart <= p.at) host = n
      else break
    }
    markers.push({ kind: 'pause', key: `pause-${p.id}`, id: p.id, day: null, taskId: host?.taskId ?? null, at: p.at })
  }
  return { clusters: clusters.filter((c) => c.nodes.length > 0), markers }
}

export type VsDagNodeState = 'pending' | 'active' | 'done'

// A node lights as the reveal passes it: done once every row under it printed, active while the
// cursor sits inside its span, pending (dim skeleton) before the reveal reaches it. Derived from
// the same `revealed` counter the terminal slices by — never a timer of this component's own.
export function dagNodeState(node: Pick<VsDagNode, 'rowStart' | 'rowEnd'>, revealed: number): VsDagNodeState {
  if (revealed > node.rowEnd) return 'done'
  if (revealed > node.rowStart) return 'active'
  return 'pending'
}

export function activeDagTaskId(clusters: readonly VsDagCluster[], revealed: number): string | null {
  for (const c of clusters) {
    for (const n of c.nodes) {
      if (dagNodeState(n, revealed) === 'active') return n.taskId
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Progressive reveal (kept from round 4) + wrap detection (round 5) — pure, exported for tests.
// ---------------------------------------------------------------------------

// Reveal-on-reach: a node renders once the reveal has reached its task row (revealed ≥ rowStart —
// one row after its phase header printed, so "its cluster started" shows it a tick before its
// state turns active). Upcoming nodes are NOT rendered.
export function dagNodeReached(node: Pick<VsDagNode, 'rowStart'>, revealed: number): boolean {
  return revealed >= node.rowStart
}

// The visible task ids for a reveal position: every reached node, or — before anything is
// reached (pre-run / the first phase row) — ONLY the journey's first node, rendered dim.
export function dagVisibleTaskIds(clusters: readonly VsDagCluster[], revealed: number): Set<string> {
  const out = new Set<string>()
  for (const c of clusters) {
    for (const n of c.nodes) {
      if (dagNodeReached(n, revealed)) out.add(n.taskId)
    }
  }
  if (out.size === 0) {
    const first = clusters[0]?.nodes[0]
    if (first) out.add(first.taskId)
  }
  return out
}

// Which flow items start a new visual row of the wrap, given their measured offsetTops in flow
// order: an item whose top sits below its predecessor's began a wrapped row — its leading
// connector renders as the wrap elbow instead of an arrow into the row edge. Pure so
// tests drive it directly; the component feeds it real offsetTop measurements in an effect.
export function dagWrapStartIds(items: readonly { id: string; top: number }[]): Set<string> {
  const out = new Set<string>()
  for (let i = 1; i < items.length; i++) {
    if (items[i].top > items[i - 1].top) out.add(items[i].id)
  }
  return out
}

// ---------------------------------------------------------------------------
// Chain palette — one hue per journey chain (lib/virtualStartup.ts VS_CHAIN_IDS), full literal
// Tailwind classes (no dynamic class construction). Emerald is reserved for the ACTIVE ring and
// fuchsia for synthetic artifacts, so neither appears as a cluster hue.
// ---------------------------------------------------------------------------

interface ChainStyle {
  chip: string // the cluster label chip leading the phase's first node
  done: string // filled node once every row printed
}

const CHAIN_STYLES: Record<string, ChainStyle> = {
  'name-the-company': { chip: 'border-sky-400/30 text-sky-300/80', done: 'border-sky-400/50 bg-sky-400/10 text-zinc-200' },
  'company-launch': { chip: 'border-violet-400/30 text-violet-300/80', done: 'border-violet-400/50 bg-violet-400/10 text-zinc-200' },
  'raise-a-seed-round': { chip: 'border-amber-400/30 text-amber-300/80', done: 'border-amber-400/50 bg-amber-400/10 text-zinc-200' },
  'set-up-compliance': { chip: 'border-teal-400/30 text-teal-300/80', done: 'border-teal-400/50 bg-teal-400/10 text-zinc-200' },
  'ship-v1': { chip: 'border-lime-400/30 text-lime-300/80', done: 'border-lime-400/50 bg-lime-400/10 text-zinc-200' },
  'launch-website': { chip: 'border-cyan-400/30 text-cyan-300/80', done: 'border-cyan-400/50 bg-cyan-400/10 text-zinc-200' },
  'get-paid': { chip: 'border-rose-400/30 text-rose-300/80', done: 'border-rose-400/50 bg-rose-400/10 text-zinc-200' },
  'first-hire': { chip: 'border-indigo-400/30 text-indigo-300/80', done: 'border-indigo-400/50 bg-indigo-400/10 text-zinc-200' },
  'launch-on-product-hunt': { chip: 'border-orange-400/30 text-orange-300/80', done: 'border-orange-400/50 bg-orange-400/10 text-zinc-200' },
  'land-the-enterprise-deal': { chip: 'border-purple-400/30 text-purple-300/80', done: 'border-purple-400/50 bg-purple-400/10 text-zinc-200' },
}

const CHAIN_FALLBACK: ChainStyle = { chip: 'border-zinc-700 text-zinc-400', done: 'border-zinc-600 bg-zinc-800 text-zinc-200' }

function chainStyle(chainId: string): ChainStyle {
  return CHAIN_STYLES[chainId] ?? CHAIN_FALLBACK
}

// Follow-slack: how close (px) to the strip's bottom still counts as "at the bottom" — the same
// courtesy as the terminal (components/VirtualStartup.tsx FOLLOW_SLACK_PX), so a stray one-line
// scroll doesn't silently unpin the follow.
const FOLLOW_SLACK_PX = 24

// A hand-rolled in-row edge: short line + arrowhead at one FIXED size (no tiers — nodes never
// compress anymore), lit emerald once the reveal traversed it (its downstream node is active or
// done).
//
// FOOTPRINT INVARIANT (mobile flicker fix, founder 2026-10-01): Edge and WrapHint MUST occupy
// the exact same width (16px content + mx-0.5). The wrap detector measures offsetTops after
// every commit and swaps Edge ↔ WrapHint per item — when the two connectors had different
// widths (the old WrapHint was ~8px narrower), the swap itself re-flowed the wrap, the next
// measurement flipped the classification back, and at borderline widths (exactly the narrow
// mobile viewport) the strip oscillated between the two layouts on every 240ms reveal commit —
// the reported flicker. Equal footprints make the swap layout-neutral, so the measurement
// converges in one pass and the reveal/pulse animations stay (nothing animated was the cause).
// Both also carry the same mb-4 (= the under-node h-3.5 marker row + gap-0.5): self-center
// centres the connector's MARGIN box on the whole li, so without it every arrow pointed at the
// node's bottom border instead of the node box (founder 2026-10-02: the wrap read unclear).
function Edge({ lit }: { lit: boolean }) {
  return (
    <svg
      aria-hidden
      data-testid="vs-dag-edge"
      width="16"
      height="8"
      viewBox="0 0 16 8"
      className="mx-0.5 mb-4 w-4 shrink-0 self-center"
    >
      <line x1="0" y1="4" x2="10" y2="4" strokeWidth="1.5" className={lit ? 'stroke-emerald-400/70' : 'stroke-zinc-700'} />
      <path d="M10 1 L15.5 4 L10 7 Z" className={lit ? 'fill-emerald-400/70' : 'fill-zinc-700'} />
    </svg>
  )
}

// The across-a-wrap connector: a drawn ELBOW leading the first node of a wrapped row — it drops
// in from above (where the previous row ended) and curves into a right-pointing arrowhead at the
// node, so the row break visibly reads "…continues here" (founder 2026-10-02: the old ↵ text
// hint was too subtle). An in-row arrow there would point at the row edge, not at its upstream
// node. Lit emerald once traversed, exactly like Edge. Same 16px + mx-0.5 HORIZONTAL footprint
// as Edge — see the invariant above; a width change here reintroduces the flicker (extra height
// is safe: wrap classification compares offsetTop ordering, which row height never flips).
function WrapHint({ lit }: { lit: boolean }) {
  return (
    <svg
      aria-hidden
      data-testid="vs-dag-wrap-hint"
      width="16"
      height="14"
      viewBox="0 0 16 14"
      className="mx-0.5 mb-4 w-4 shrink-0 self-center"
    >
      {/* The elbow: down from the row above, then a quarter-curve into the arrowhead. */}
      <path d="M8 0.5 V5 Q8 9 11.5 9" fill="none" strokeWidth="1.5" className={lit ? 'stroke-emerald-400/70' : 'stroke-zinc-600'} />
      <path d="M10 6 L15.5 9 L10 12 Z" className={lit ? 'fill-emerald-400/70' : 'fill-zinc-600'} />
    </svg>
  )
}

export default function VsJourneyDag({
  rows,
  revealed,
  running,
  waitingOn = null,
  pauses = [],
  eventTitles = {},
  onNodeClick,
}: {
  // The SAME assembled row list the terminal slices — the strip derives everything from it.
  rows: VsDagSourceRow[]
  // How many rows the terminal has printed (the shared reveal counter).
  revealed: number
  // Whether the reveal ticker is live — surfaced as a data attribute.
  running: boolean
  // The semi-auto pause the run is currently waiting on (decision id or 'name'); its marker pulses.
  waitingOn?: string | null
  // The semi-auto pause schedule (still-unanswered decisions + the naming card).
  pauses?: VsDagPause[]
  // Event id → title, for the event diamonds' tooltips.
  eventTitles?: Record<string, string>
  // Primary node action: scroll the terminal to this process's first printed row.
  onNodeClick?: (taskId: string) => void
}) {
  const { clusters, markers } = useMemo(() => deriveJourneyDag(rows, pauses), [rows, pauses])
  const pauseLabels = useMemo(() => new Map(pauses.map((p) => [p.id, p.label])), [pauses])
  const markersByTask = useMemo(() => {
    const m = new Map<string | null, VsDagMarker[]>()
    for (const marker of markers) {
      const list = m.get(marker.taskId) ?? []
      list.push(marker)
      m.set(marker.taskId, list)
    }
    return m
  }, [markers])

  // Progressive reveal (kept): only reached nodes render (pre-run: the first node, dim).
  const visible = useMemo(() => dagVisibleTaskIds(clusters, revealed), [clusters, revealed])

  // The capped scroll strip + its follow flag (round 5): the flow grows vertically with content
  // up to min(45vh, 380px); past the cap it scrolls vertically, pinned to the newest (active)
  // node — which is always the LAST rendered node, reveal order IS flow order — unless the
  // reader scrolled up (the terminal's follow-slack courtesy). No timers: the pin runs off the
  // shared reveal commit, the flag off real scroll events.
  const stripRef = useRef<HTMLDivElement>(null)
  const followRef = useRef(true)
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    // An emptied strip (restart / decision change) rests at its top and re-arms the follow.
    if (revealed === 0) {
      followRef.current = true
      el.scrollTop = 0
      return
    }
    // Pinning to the bottom keeps the active node visible: new nodes only ever append below.
    if (followRef.current) el.scrollTop = el.scrollHeight
  }, [revealed])

  // Wrap detection: after every commit (any reveal/recompose can reflow the wrap), measure the
  // flow items' offsetTops and mark the ones that start a wrapped row (their leading connector
  // becomes a ↵ hint). jsdom reports every offsetTop as 0, so tests exercise the pure
  // dagWrapStartIds instead.
  const [wrapStarts, setWrapStarts] = useState<ReadonlySet<string>>(() => new Set())
  const measureWraps = useCallback(() => {
    const el = stripRef.current
    if (!el) return
    const items = Array.from(el.querySelectorAll<HTMLElement>('[data-dag-flow]')).map((it) => ({
      id: it.getAttribute('data-dag-flow') ?? '',
      top: it.offsetTop,
    }))
    const next = dagWrapStartIds(items)
    // Layout measurement: wrap positions only exist AFTER the flow committed to the DOM; the
    // set-equality guard makes the re-render converge in one extra pass.
    setWrapStarts((cur) => (cur.size === next.size && [...next].every((id) => cur.has(id)) ? cur : next))
  }, [])
  // Deliberately dependency-less: it must re-measure after EVERY commit; the equality guard
  // above makes it settle immediately when nothing moved. useLayoutEffect, not useEffect: the
  // Edge -> WrapHint swap must land BEFORE paint, or every node that opens a new row (each
  // 240ms reveal commit, and hydration) flashes a stranded right-arrow at the line start for
  // one frame. The footprint invariant keeps the pre-paint swap layout-neutral.
  useLayoutEffect(() => {
    measureWraps()
  })
  useEffect(() => {
    window.addEventListener('resize', measureWraps)
    return () => window.removeEventListener('resize', measureWraps)
  }, [measureWraps])

  function markerChip(m: VsDagMarker) {
    const revealedMarker = revealed > m.at
    const activePause = m.kind === 'pause' && waitingOn !== null && waitingOn === m.id
    const title =
      m.kind === 'event'
        ? `day ${m.day} — ${eventTitles[m.id] ?? m.id} (seeded mid-run event)`
        : `${pauseLabels.get(m.id) ?? m.id} — the run ${activePause ? 'is waiting on you here' : 'pauses here for your decision'} (semi-auto)`
    return (
      <span
        key={m.key}
        data-testid={`vs-dag-marker-${m.kind}`}
        data-marker-id={m.id}
        data-marker-active={activePause ? 'true' : undefined}
        title={title}
        className={`inline-block h-1.5 w-1.5 shrink-0 rotate-45 ${
          activePause
            ? 'animate-pulse bg-amber-300'
            : m.kind === 'pause'
              ? revealedMarker
                ? 'bg-amber-400/80'
                : 'bg-amber-400/30'
              : revealedMarker
                ? 'bg-fuchsia-400/90'
                : 'bg-fuchsia-400/30'
        }`}
      >
        <span className="sr-only">{title}</span>
      </span>
    )
  }

  // Flatten the visible flow once so "first item overall" and flow order are explicit.
  const flow: Array<{ cluster: VsDagCluster; node: VsDagNode; leadsCluster: boolean }> = []
  for (const cluster of clusters) {
    const visibleNodes = cluster.nodes.filter((n) => visible.has(n.taskId))
    visibleNodes.forEach((node, i) => flow.push({ cluster, node, leadsCluster: i === 0 }))
  }

  return (
    <section
      data-testid="vs-journeydag"
      data-dag-running={running ? 'true' : undefined}
      aria-label="Journey map — the run as a graph"
      className="rounded-xl border border-zinc-800 bg-zinc-950/60"
    >
      {/* The wrapping flow (round 5): natural height up to min(45vh, 380px), then VERTICAL
          scroll only — never horizontal — auto-pinned to the newest node while following. */}
      <div
        ref={stripRef}
        data-testid="vs-journeydag-strip"
        onScroll={(e) => {
          const el = e.currentTarget
          followRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - FOLLOW_SLACK_PX
        }}
        className="max-h-[min(45vh,380px)] overflow-x-hidden overflow-y-auto px-2 py-2 sm:px-3"
      >
        <ol className="flex w-full flex-wrap items-start gap-x-1 gap-y-2" aria-label="Journey processes in run order">
          {/* Run-press pauses (row 0, before any node) float at the flow's leading edge. */}
          {(markersByTask.get(null) ?? []).length > 0 && (
            <li className="mr-1 flex shrink-0 items-center gap-1 self-center">
              {(markersByTask.get(null) ?? []).map((m) => markerChip(m))}
            </li>
          )}
          {flow.map(({ cluster, node, leadsCluster }, fi) => {
            const style = chainStyle(cluster.chainId)
            const state = dagNodeState(node, revealed)
            const isActive = state === 'active'
            const pct = node.stepCount > 0 ? Math.round((node.agentSteps / node.stepCount) * 100) : 0
            const nodeMarkers = markersByTask.get(node.taskId) ?? []
            const vendorPrinted = node.vendor !== null && node.vendorRow !== -1 && revealed > node.vendorRow
            return (
              // Each flow item wraps as one unit: [connector | ↵] [cluster chip?] [node column].
              <li key={node.taskId} data-dag-flow={node.taskId} className="flex shrink-0 items-start">
                {fi > 0 && (wrapStarts.has(node.taskId) ? <WrapHint lit={state !== 'pending'} /> : <Edge lit={state !== 'pending'} />)}
                {/* The phase's chain-tinted label chip leads its first node (round 5 call:
                    box-frames fight wrapping; the chip + the chain-hued done fill carry the
                    cluster grouping instead). */}
                {leadsCluster && (
                  <span
                    data-testid="vs-dag-cluster"
                    data-chain={cluster.chainId}
                    title={`${cluster.title} — from the ${cluster.chainName} playbook`}
                    className={`mr-1 mt-1 inline-flex max-w-[140px] shrink-0 items-center gap-0.5 self-start rounded-full border px-1.5 py-0.5 text-[9px] uppercase leading-none tracking-wider ${style.chip}`}
                  >
                    <span aria-hidden><IconGlyph icon={chainIcon(cluster.chainId)} /></span>
                    <span className="truncate">{cluster.title}</span>
                  </span>
                )}
                <div className="flex flex-col items-center gap-0.5">
                  <button
                    type="button"
                    data-testid={`vs-dag-node-${node.taskId}`}
                    data-dag-state={state}
                    aria-label={node.title}
                    title={`${node.title} — ${node.stepCount} step${node.stepCount === 1 ? '' : 's'}, ${node.agentSteps} agent-runnable (Agentic % ~${pct}). Click to jump to it in the terminal.`}
                    onClick={() => onNodeClick?.(node.taskId)}
                    className={`flex max-w-[180px] items-center gap-1 rounded-md border px-2 py-1.5 leading-none transition ${
                      state === 'done'
                        ? style.done
                        : isActive
                          ? 'animate-pulse border-emerald-400/70 text-zinc-100 ring-2 ring-emerald-400/50'
                          : 'border-zinc-800 text-zinc-500'
                    }`}
                  >
                    <span aria-hidden className={`text-base ${state === 'pending' ? 'opacity-50' : ''}`}>
                      <IconGlyph icon={processIcon(node.taskId)} />
                    </span>
                    {/* FIXED node chrome (round 5): the title always renders — no tier ever
                        hides it, no fisheye ever shrinks it. */}
                    <span className="min-w-0 truncate text-[11px]">{node.title}</span>
                    {/* The top judged pick's logo rides INSIDE the node box, trailing the title
                        (founder 2026-10-02: floating outside, it didn't read as the node's
                        vendor). It appears once its step printed — same reveal gate as before.
                        The fixed-size contract holds: the box's max-w/padding are untouched and
                        the min-w-0 truncating title absorbs the logo's width at the cap, so the
                        icon + title stay legible always. */}
                    {vendorPrinted && node.vendor && (
                      <span
                        data-testid={`vs-dag-vendor-${node.vendor.productId}`}
                        className="shrink-0"
                        title={`${node.vendor.name} — top judged pick for this process's step`}
                      >
                        <ProductLogoView
                          product={{ id: node.vendor.productId, name: node.vendor.name }}
                          size={12}
                          hasLogo={node.vendor.hasLogo}
                        />
                      </span>
                    )}
                  </button>
                  {/* Under-node row: the event/pause diamonds and the ↗ process-page link. */}
                  <span className="flex h-3.5 min-w-0 items-center gap-1">
                    {nodeMarkers.map((m) => markerChip(m))}
                    <Link
                      href={`/processes/${node.slug}`}
                      data-testid={`vs-dag-open-${node.taskId}`}
                      aria-label={`${node.title} — open the process page`}
                      title={`${node.title} — open the process page`}
                      className="text-[9px] leading-none text-zinc-700 transition hover:text-emerald-300"
                    >
                      ↗
                    </Link>
                  </span>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
