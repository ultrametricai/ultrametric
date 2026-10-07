import { canonGraphStoryIds, storyGraph } from '@/lib/storyGraph'
import { withBase } from '@/lib/site'
import { layerByEdges } from '@/lib/storyDag'
import { CANON_SHORT_LABELS, combinedCanonEdges, type CanonDepEdge } from '@/lib/storyEdges'

// The capability dependency graph on /global: all 29 canon stories as one left-to-right SVG DAG
// — Kahn layers as columns, curated dependency edges (data/story-graph.json builds-on edges +
// data/story-edges.json cross-story edges) drawn between them, each node carrying its
// industry-wide adoption share. Same visual family as components/ProcessDag.tsx's spine
// (1.5px zinc connectors with solid triangular arrowheads) and the GeoMark idiom (monochrome
// currentColor strokes, emerald reserved for the one thing that matters — here the adoption
// meter, a magnitude, so it's the single sequential hue on a zinc track exactly like ScoreBar).
// Cross-story edges sit a step brighter than builds-on edges: they're the interconnects this
// view exists to show. Tooltips everywhere (house rule): nodes carry the full story title,
// adoption fraction, and their requires/unlocks lists; edges carry the curated "why".
// Server component — pure SVG, no client JS, static-export safe.

export interface CapabilityAdoption {
  pct: number
  adopters: number
  total: number
}

const NODE_W = 210
const NODE_H = 48
const GAP_X = 72
const GAP_Y = 14
const PAD = 8

interface LayoutNode {
  id: string
  x: number
  y: number
}

// Columns = Kahn layers over the combined edge set; rows within a column by barycenter of the
// already-placed parents (fewer crossings), ties by canon order — fully deterministic.
function layout(edges: CanonDepEdge[]): { nodes: LayoutNode[]; cols: number; maxRows: number } {
  const ids = storyGraph.clusters.flatMap((c) => c.storyIds)
  const canonIndex = new Map(ids.map((id, i) => [id, i]))
  const layers = layerByEdges(ids, edges.map((e): [string, string] => [e.from, e.to]))
  const maxRows = Math.max(...layers.map((l) => l.length))
  const row = new Map<string, number>()
  const placed: LayoutNode[] = []
  layers.forEach((layer, col) => {
    const bary = (id: string) => {
      const parents = edges.filter((e) => e.to === id && row.has(e.from)).map((e) => row.get(e.from)!)
      return parents.length > 0 ? parents.reduce((a, b) => a + b, 0) / parents.length : Number.MAX_SAFE_INTEGER
    }
    const ordered = col === 0 ? layer : [...layer].sort((a, b) => bary(a) - bary(b) || canonIndex.get(a)! - canonIndex.get(b)!)
    // Shorter columns are vertically centered so the graph reads as one figure, not a staircase.
    const yOffset = ((maxRows - ordered.length) * (NODE_H + GAP_Y)) / 2
    ordered.forEach((id, r) => {
      row.set(id, r)
      placed.push({
        id,
        x: PAD + col * (NODE_W + GAP_X),
        y: PAD + yOffset + r * (NODE_H + GAP_Y),
      })
    })
  })
  return { nodes: placed, cols: layers.length, maxRows }
}

function nodeTooltip(
  id: string,
  title: string,
  adoption: CapabilityAdoption | undefined,
  edges: CanonDepEdge[],
): string {
  const label = (x: string) => CANON_SHORT_LABELS[x] ?? x
  const requires = edges.filter((e) => e.to === id).map((e) => label(e.from))
  const unlocks = edges.filter((e) => e.from === id).map((e) => label(e.to))
  const lines = [
    title,
    adoption
      ? `Adoption: ${adoption.adopters}/${adoption.total} tracked products (${adoption.pct}%) with a full or partial evidence-backed verdict`
      : 'Adoption: no cross-market data yet',
  ]
  if (requires.length > 0) lines.push(`Requires: ${requires.join(', ')}`)
  if (unlocks.length > 0) lines.push(`Unlocks: ${unlocks.join(', ')}`)
  return lines.join('\n')
}

export default function CapabilityDag({
  adoption,
  titles,
}: {
  // Canon story id → industry adoption (from /global's adoptionNow pass). Missing ids render an
  // honest em-dash, never a fabricated 0%.
  adoption: Record<string, CapabilityAdoption>
  // Canon story id → full story title, for tooltips.
  titles: Record<string, string>
}) {
  const edges = combinedCanonEdges()
  const { nodes, maxRows } = layout(edges)
  const at = new Map(nodes.map((n) => [n.id, n]))
  const width = PAD * 2 + Math.max(...nodes.map((n) => n.x - PAD)) + NODE_W
  const height = PAD * 2 + maxRows * (NODE_H + GAP_Y) - GAP_Y
  const meterW = NODE_W - 58

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800 p-3">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Capability dependency graph: canon capabilities as nodes with industry adoption, curated prerequisite edges between them"
        className="mx-auto block"
      >
        {/* Edges under the nodes. Cross-story interconnects (data/story-edges.json) render a
            step brighter and dashed — they're the new information; builds-on edges are context. */}
        {edges.map((e) => {
          const from = at.get(e.from)
          const to = at.get(e.to)
          if (!from || !to) return null
          const x1 = from.x + NODE_W
          const y1 = from.y + NODE_H / 2
          const x2 = to.x - 8
          const y2 = to.y + NODE_H / 2
          const mx = (x1 + x2) / 2
          const cross = e.kind === 'cross'
          return (
            <g
              key={`${e.from}→${e.to}`}
              className={cross ? 'text-zinc-500 transition hover:text-emerald-400/80' : 'text-zinc-700 transition hover:text-emerald-400/60'}
            >
              <title>{`${CANON_SHORT_LABELS[e.from] ?? e.from} → ${CANON_SHORT_LABELS[e.to] ?? e.to}\n${e.why}`}</title>
              <path
                d={`M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeDasharray={cross ? '4 3' : undefined}
              />
              {/* Same solid triangular arrowhead as ProcessDag's spine joints, rotated to flow. */}
              <path d={`M${x2} ${y2 - 3.5} L${x2 + 7} ${y2} L${x2} ${y2 + 3.5} Z`} fill="currentColor" />
            </g>
          )
        })}

        {nodes.map((n) => {
          const a = adoption[n.id]
          const short = CANON_SHORT_LABELS[n.id] ?? n.id
          const fillW = a ? Math.round((meterW * Math.min(100, Math.max(0, a.pct))) / 100) : 0
          return (
            // SVG <a>, so next/link can't apply a basePath — withBase() does (identity today).
            <a key={n.id} href={withBase(`/global/${n.id}`)} className="group">
              <title>{nodeTooltip(n.id, titles[n.id] ?? short, a, edges)}</title>
              <rect
                x={n.x}
                y={n.y}
                width={NODE_W}
                height={NODE_H}
                rx={8}
                className="fill-zinc-900/60 stroke-zinc-700 transition group-hover:stroke-emerald-400/70"
                strokeWidth={1}
              />
              <text x={n.x + 10} y={n.y + 19} className="fill-zinc-200 text-[11px] font-medium">
                {short}
              </text>
              {/* Adoption is a magnitude → the one emerald element per node, same meter idiom as
                  ScoreBar and the /global table (emerald fill on a zinc track). */}
              <rect x={n.x + 10} y={n.y + 30} width={meterW} height={4} rx={2} className="fill-zinc-800" />
              {a && fillW > 0 && (
                <rect x={n.x + 10} y={n.y + 30} width={fillW} height={4} rx={2} className="fill-emerald-400" />
              )}
              <text
                x={n.x + NODE_W - 10}
                y={n.y + 36}
                textAnchor="end"
                className="fill-emerald-300 font-mono text-[10px] tabular-nums"
              >
                {a ? `${Number.isInteger(a.pct) ? a.pct : a.pct.toFixed(1)}%` : '—'}
              </text>
            </a>
          )
        })}
      </svg>
    </div>
  )
}

// Exported for the /global page caption and tests: how many of the canon stories the graph
// covers (all of them, by construction) and how many dependency edges it draws.
export function capabilityDagStats(): { nodes: number; edges: number; crossEdges: number } {
  const edges = combinedCanonEdges()
  return {
    nodes: canonGraphStoryIds.size,
    edges: edges.length,
    crossEdges: edges.filter((e) => e.kind === 'cross').length,
  }
}
