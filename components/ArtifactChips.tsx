import Link from 'next/link'
import type { ArtifactChipRows } from '@/lib/processDeps'
import { processMetadataChip, processMetadataLabel, processMetadataLink } from './processMetadataStyles'

// The typed-I/O header row on /processes/[slug] (founder depth wave part 2, 2026-10-01):
// 'Produces:' names the registry artifacts this process brings into existence — the
// machine-truth layer (produces/requires in processes/corpus.json against
// processes/artifacts.json) rendered as the house chip idiom. The 'Needs:' row no longer
// renders (founder 2026-10-02: the line read as noise on the page) — DISPLAY ONLY: the
// requires data, lib/processDeps.ts, and the rows prop shape are untouched, so the dependency
// graph and any other consumer keep the full typed layer. A Produces chip on a documented
// exception producer — the LLC page's EIN — points back at the canonical page; chips for
// artifacts this very page produces render unlinked: the producer is right here.
// Purely presentational and serializable — props come from lib/processDeps.ts artifactChipRows.

const CHIP =
  'rounded-full border border-zinc-700 px-2 py-0.5 text-zinc-300'
const LINKED_CHIP =
  `${CHIP} transition hover:border-emerald-400/60 hover:text-emerald-300`

function ChipRow({ heading, title, chips, readable }: {
  readable: boolean
  heading: string
  title: string
  chips: ArtifactChipRows['needs']
}) {
  if (chips.length === 0) return null
  return (
    <p className="flex flex-wrap items-center gap-1.5">
      <span title={title} className={readable ? processMetadataLabel : 'text-[10px] uppercase tracking-widest text-zinc-400'}>
        {heading}
      </span>
      {chips.map((c) =>
        c.producedHere ? (
          <span key={c.id} title={`${c.description} Produced right here, by this process.`} className={readable ? processMetadataChip : CHIP}>
            {c.label}
          </span>
        ) : (
          <Link
            key={c.id}
            href={c.producerHref}
            title={`${c.description} Produced by ${c.producerTitle} →`}
            className={readable ? processMetadataLink : LINKED_CHIP}
          >
            {c.label}
          </Link>
        ),
      )}
    </p>
  )
}

export default function ArtifactChips({ rows, readable = false }: { rows: ArtifactChipRows; readable?: boolean }) {
  // Produces only (founder 2026-10-02): rows.needs stays in the prop shape untouched — the
  // typed requires layer is data, just not a header row here anymore.
  if (rows.produces.length === 0) return null
  return (
    <div className={`mt-3 space-y-1.5 ${readable ? "text-sm" : "text-xs"}`}>
      <ChipRow
        readable={readable}
        heading="Produces:"
        title="Business artifacts this process brings into existence — the step where each one is born carries it in the flow below"
        chips={rows.produces}
      />
    </div>
  )
}
