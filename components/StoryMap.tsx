import { Fragment } from 'react'
import ThemeIcon from '@/components/ThemeIcon'
import { groupInOrder } from '@/lib/data-helpers'
import { humanizeTheme, themeExplanation } from '@/lib/icons'
import { stripPersonaPrefix } from '@/lib/data-helpers'
import {
  clusterDomainStories, layerByEdges, tidyGroupLabel, type DomainCluster,
} from '@/lib/storyDag'
import { unlockHints, type UnlockHint } from '@/lib/storyEdges'
import { canonGraphStoryIds, clusterEdges, storyGraph, type StoryGraphCluster } from '@/lib/storyGraph'
import { isStoryUntested, type StoryVerdictRow } from '@/lib/storyVerdictsSort'

// "Story map" — the DAG view of a product's story verdicts (the flat, sortable sibling view is
// components/StoryVerdictsTable.tsx; components/StoryViewToggle.tsx switches between them).
// Long story lists read repetitively one-by-one, but stories aren't flat: they build on each
// other (no webhooks without an API; MCP presumes programmatic access; headless presumes a CLI).
// So the canonical stories render as capability trees from the curated builds-on graph
// (data/story-graph.json via lib/storyGraph.ts) and the arena's domain-mined stories cluster
// heuristically by taxonomy group + shared title stem (lib/storyDag.ts), siblings under their
// highest-weight root. Visual vocabulary ported from components/ProcessDag.tsx — bordered block
// cards joined by a vertical connector spine with arrowheads, parallel siblings side by side —
// but tinted by *verdict* instead of route, which is the payoff: the tree is emerald where the
// product delivers and grey where it doesn't, so the reader sees the capability frontier at a
// glance. Every block deep-links to its #story-<id> row in the table for rationale + evidence.
// Server component: no client JS, static-export safe.

type VerdictKey = StoryVerdictRow['verdict']

const VERDICT_STYLE: Record<VerdictKey, { block: string; chip: string; title: string; glyph: string; label: string }> = {
  full: {
    block: 'border-emerald-400/60 bg-emerald-400/[0.07]',
    chip: 'bg-emerald-400/10 text-emerald-300',
    title: 'text-zinc-100',
    glyph: '✓',
    label: 'full',
  },
  partial: {
    block: 'border-emerald-400/25 bg-emerald-400/[0.03]',
    chip: 'bg-emerald-400/[0.06] text-emerald-300/70',
    title: 'text-zinc-200',
    glyph: '~',
    label: 'partial',
  },
  disputed: {
    block: 'border-red-400/40 bg-red-400/[0.04]',
    chip: 'bg-red-400/10 text-red-300',
    title: 'text-zinc-200',
    glyph: '!',
    label: 'disputed',
  },
  none: {
    block: 'border-zinc-800 bg-transparent',
    chip: 'bg-zinc-800/60 text-zinc-500',
    title: 'text-zinc-500',
    glyph: '—',
    label: 'none',
  },
  na: {
    block: 'border-zinc-800/70 bg-transparent',
    chip: 'bg-zinc-800/40 text-zinc-500',
    title: 'text-zinc-500',
    glyph: 'n/a',
    label: 'n/a',
  },
}

// Same joint as ProcessDag's spine, slightly shorter — the map's blocks are denser.
function Connector() {
  return (
    <svg aria-hidden width="14" height="22" viewBox="0 0 14 22" className="ml-5 block text-zinc-600">
      <line x1="7" y1="0" x2="7" y2="15" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 14.5 L7 21 L10.5 14.5 Z" fill="currentColor" />
    </svg>
  )
}

// Hints map: storyId → dependent stories this product fails that the story enables (see
// lib/storyEdges.ts's unlockHints). Threaded down from StoryMap; empty map keeps blocks silent.
type Hints = Map<string, UnlockHint[]>
const NO_HINTS: Hints = new Map()

function StoryBlock({ row, hints = NO_HINTS }: { row: StoryVerdictRow; hints?: Hints }) {
  const untested = isStoryUntested(row)
  const style = VERDICT_STYLE[row.verdict]
  const quality = row.verdict === 'na' ? 'n/a' : untested ? '–' : `${row.quality}/10`
  const unlocks = hints.get(row.storyId)
  return (
    <a
      id={`map-story-${row.storyId}`}
      href={`#story-${row.storyId}`}
      title={`${row.title} — open this story's row in the table for the rationale and evidence`}
      className={`block min-w-0 rounded-lg border p-2.5 transition hover:border-emerald-300/70 ${style.block}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`min-w-0 break-words text-xs font-medium leading-snug ${style.title}`}>
          {stripPersonaPrefix(row.title)}
        </p>
        <span
          className={`shrink-0 rounded px-1 py-0.5 font-mono text-[10px] font-semibold leading-none ${style.chip}`}
          title={`verdict: ${style.label}${untested ? ' (untested — nothing found or probed either way)' : ''}`}
        >
          {style.glyph}
        </span>
      </div>
      <p className="mt-1.5 flex items-center gap-2.5 font-mono text-[10px] tabular-nums text-zinc-500">
        <span title={untested ? 'untested — unscored, not zero' : `quality ${quality}`}>{quality}</span>
        <span aria-hidden className="tracking-tight" title={`weight ${row.weight}/3`}>
          {'●'.repeat(row.weight)}
          {'○'.repeat(Math.max(0, 3 - row.weight))}
        </span>
      </p>
      {/* "Unlocks →": this story passes but a story it's a curated prerequisite/enabler of does
          not — honest framing (the miss is the dependent's, this one delivers), kept to one
          subtle line with the full story titles in the tooltip. */}
      {unlocks && unlocks.length > 0 && (
        <p
          className="mt-1 truncate text-[10px] text-zinc-500"
          title={unlocks
            .map((u) => `Enables “${stripPersonaPrefix(u.title)}”, which currently fails (curated dependency)`)
            .join('\n')}
        >
          <span className="text-emerald-400/70">unlocks →</span>{' '}
          {unlocks.map((u) => stripPersonaPrefix(u.label)).join(' · ')}
        </p>
      )}
    </a>
  )
}

// A sibling layer: one block full-width, several side by side (ProcessDag's parallel-group grid,
// minus the dashed box — the cluster border already scopes them).
function BlockLayer({ rows, hints }: { rows: StoryVerdictRow[]; hints: Hints }) {
  if (rows.length === 1) return <StoryBlock row={rows[0]} hints={hints} />
  // 2 and 4 siblings pack a 2-col grid exactly; any other count gets 3 cols at lg so a wrapped
  // odd block doesn't read as a child of the row above it.
  const three = rows.length !== 2 && rows.length !== 4
  return (
    <div className={`grid gap-2 sm:grid-cols-2 ${three ? 'lg:grid-cols-3' : ''}`}>
      {rows.map((r) => (
        <StoryBlock key={r.storyId} row={r} hints={hints} />
      ))}
    </div>
  )
}

// One cluster's flow: curated-edge Kahn layers joined by the connector spine when edges exist,
// else root block → connector → sibling grid ("hangs off the root", not "depends on each other").
function ClusterFlow({
  rows,
  edges,
  rootId,
  hints,
}: {
  rows: StoryVerdictRow[]
  edges: Array<[string, string]>
  rootId?: string
  hints: Hints
}) {
  const byId = new Map(rows.map((r) => [r.storyId, r]))
  const ids = rows.map((r) => r.storyId)
  const usable = edges.filter(([from, to]) => byId.has(from) && byId.has(to))
  if (usable.length > 0) {
    const layers = layerByEdges(ids, usable)
    return (
      <>
        {layers.map((layer, li) => (
          <Fragment key={layer[0]}>
            {li > 0 && <Connector />}
            <BlockLayer rows={layer.map((id) => byId.get(id)!)} hints={hints} />
          </Fragment>
        ))}
      </>
    )
  }
  const root = (rootId && byId.get(rootId)) || rows[0]
  const siblings = rows.filter((r) => r !== root)
  return (
    <>
      <StoryBlock row={root} hints={hints} />
      {siblings.length > 0 && (
        <>
          <Connector />
          <BlockLayer rows={siblings} hints={hints} />
        </>
      )}
    </>
  )
}

// Cluster box — dashed like ProcessDag's parallel groups, labeled with the capability it scopes.
function ClusterBox({
  label,
  children,
  wide,
}: {
  label: string
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className={`min-w-0 rounded-xl border border-dashed border-zinc-700/80 p-2.5 ${wide ? 'lg:col-span-2' : ''}`}>
      {/* Section name (e.g. "Caching") — founder 2026-09-30 flagged these as unreadable dark
          grey on black; section labels sit at the secondary tier (zinc-400), never darker. */}
      <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{label}</p>
      {children}
    </div>
  )
}

function CanonCluster({ cluster, rows, hints }: { cluster: StoryGraphCluster; rows: StoryVerdictRow[]; hints: Hints }) {
  return (
    <ClusterBox label={cluster.label} wide={rows.length > 4}>
      <ClusterFlow rows={rows} edges={clusterEdges(cluster)} rootId={cluster.rootId} hints={hints} />
    </ClusterBox>
  )
}

// One taxonomy group's box for domain-mined stories: shared-stem clusters (root + siblings under
// it) stacked inside, singleton stems as bare blocks. Singleton *groups* skip the box entirely.
function DomainGroup({ group, rows, hints }: { group: string; rows: StoryVerdictRow[]; hints: Hints }) {
  const byId = new Map(rows.map((r) => [r.storyId, r]))
  const clusters = clusterDomainStories(rows.map((r) => ({ id: r.storyId, title: r.title, weight: r.weight })))
  if (rows.length === 1) return <StoryBlock row={rows[0]} hints={hints} />
  return (
    <ClusterBox label={tidyGroupLabel(group)} wide={rows.length > 4}>
      <div className="space-y-2.5">
        {clusters.map((c: DomainCluster) => (
          <div key={c.id}>
            {/* A stem header only earns its ink when the cluster is a *subset* of the box — a
                lone stem cluster would just restate the group label above it. */}
            {c.label !== null && clusters.length > 1 && (
              <p className="mb-1.5 px-1 text-[10px] uppercase tracking-wide text-zinc-400">{c.label}</p>
            )}
            <ClusterFlow rows={c.storyIds.map((id) => byId.get(id)!)} edges={[]} rootId={c.rootId} hints={hints} />
          </div>
        ))}
      </div>
    </ClusterBox>
  )
}

export default function StoryMap({ rows, productName }: { rows: StoryVerdictRow[]; productName: string }) {
  const canonById = new Map(rows.map((r) => [r.storyId, r]))
  const themes = groupInOrder(rows, (r) => r.theme)
  // "Unlocks →" hints: curated cross-story dependencies (lib/storyEdges.ts) plus theme-rule
  // attachments of this arena's domain stories, filtered to (passing prerequisite → failing
  // dependent) pairs for THIS product.
  const hints = unlockHints(rows, canonGraphStoryIds)
  // A curated cluster belongs to the theme its stories carry (they all share one — the graph
  // partitions the canon along taxonomy lines). Filtered to stories present in this arena.
  const canonClustersByTheme = new Map<string, Array<{ cluster: StoryGraphCluster; rows: StoryVerdictRow[] }>>()
  for (const cluster of storyGraph.clusters) {
    const present = cluster.storyIds.map((id) => canonById.get(id)).filter((r): r is StoryVerdictRow => r !== undefined)
    if (present.length === 0) continue
    const theme = present[0].theme
    const list = canonClustersByTheme.get(theme) ?? []
    list.push({ cluster, rows: present })
    canonClustersByTheme.set(theme, list)
  }

  return (
    <div className="space-y-6">
      {/* Legend only — that blocks are clickable is self-evident on hover. */}
      <p className="text-xs text-zinc-400">
        Follow the green: where the map greys out is where {productName} stops today.{' '}
        <span className="whitespace-nowrap text-zinc-500">
          <span className="text-emerald-300">✓ full</span> · <span className="text-emerald-300/70">~ partial</span> ·{' '}
          <span className="text-red-300">! disputed</span> · — none · n/a not applicable.
        </span>
      </p>
      {themes.map(([theme, themeRows]) => {
        const canonClusters = canonClustersByTheme.get(theme) ?? []
        const canonIds = new Set(canonClusters.flatMap((c) => c.rows.map((r) => r.storyId)))
        const domainRows = themeRows.filter((r) => !canonIds.has(r.storyId) && !canonGraphStoryIds.has(r.storyId))
        const domainGroups = groupInOrder(domainRows, (r) => r.group)
        return (
          <section key={theme} aria-label={`${theme} story map`}>
            <h3 className="flex items-center gap-1.5 text-sm text-zinc-400">
              <ThemeIcon theme={theme} className="text-zinc-500" />
              {humanizeTheme(theme)}
            </h3>
            {/* Visible one-liner for the grouping — the icon tooltip alone isn't discoverable. */}
            <p className="mb-2 mt-0.5 truncate text-xs text-zinc-400">{themeExplanation(theme)}</p>
            <div className="grid min-w-0 items-start gap-3 lg:grid-cols-2">
              {canonClusters.map(({ cluster, rows: clusterRows }) => (
                <CanonCluster key={cluster.id} cluster={cluster} rows={clusterRows} hints={hints} />
              ))}
              {domainGroups.map(([group, groupRows]) => (
                <DomainGroup key={group} group={group} rows={groupRows} hints={hints} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
