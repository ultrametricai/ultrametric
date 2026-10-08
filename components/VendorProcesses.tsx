import Link from 'next/link'
import GeoMark from '@/components/GeoMark'
import { IconGlyph } from '@/components/IconChip'
import { processesForVendor, type VendorProcessAppearance } from '@/lib/vendorProcesses'

// Server component: "Processes this product serves" — every company/product page lists the
// founder processes it comes up in, clicking through to the process pages. Appearances come
// straight from lib/vendorProcesses.ts's reverse index over the SAME derivations the process
// pages render (processLeaderboard, cross-arena rankings, computer-use options, canonical
// vendors, grounded API calls), so the two surfaces can never disagree. Renders nothing for the
// many products no process ever surfaces.
//
// Founder 2026-10-08 compaction: the table (Phase / Role / Best step fit columns, the caption
// line, the per-step receipt sub-rows) is gone — the section is a compact inline clickable list
// of just the process names. Display-only: every removed number stays derived data (the role
// kinds, per-step scores, and receipts all live on the process pages the names link to). Each
// link carries the existing ?via=<arenaId>:<productId> lens (lib/processLens.ts), so the
// process page opens adapted to THIS vendor — the same share-URL contract the processes tables
// use.
//
// Grouping honesty (unchanged): judged-SERVING appearances (a judged step score or a
// canonical/API-call role) render inline; computer-use-only appearances (browser agents surface
// on ~100 manual steps as "could attempt it today", which is not "serves it") collapse into a
// native <details> whose summary always counts them out loud.

// A computer-use-ONLY appearance: the vendor never serves a step here, it could merely attempt
// a manual one.
function isComputerUseOnly(a: VendorProcessAppearance): boolean {
  return a.kinds.length === 1 && a.kinds[0] === 'computer-use'
}

function ProcessNameList({
  rows,
  arenaId,
  productId,
  productName,
}: {
  rows: VendorProcessAppearance[]
  arenaId: string
  productId: string
  productName: string
}) {
  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {rows.map((a) => (
        <li key={a.taskId}>
          <Link
            href={`/processes/${a.slug}?via=${arenaId}:${productId}`}
            title={`Open ${a.title} viewed via ${productName} — the process page adapts to this vendor (?via= lens)`}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-emerald-400/60 hover:text-emerald-300"
          >
            {a.icon && <span aria-hidden><IconGlyph icon={a.icon} /></span>}
            {a.title}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default function VendorProcesses({
  arenaId,
  productId,
  productName,
}: {
  arenaId: string
  productId: string
  productName: string
}) {
  const appearances = processesForVendor(arenaId, productId)
  if (appearances.length === 0) return null

  const serving = appearances.filter((a) => !isComputerUseOnly(a))
  const cuOnly = appearances.filter(isComputerUseOnly)

  return (
    <div id="processes" className="scroll-mt-4">
      <h2 className="font-display leading-[1.1] mb-3 flex items-center gap-2 text-lg font-semibold">
        <GeoMark
          seed="vendor-processes"
          title="Processes — the founder operating processes this product comes up in, from the same story-derived rankings the process pages show"
          size={18}
          className="text-zinc-500"
        />
        Processes this product serves
      </h2>
      {serving.length > 0 && (
        <ProcessNameList rows={serving} arenaId={arenaId} productId={productId} productName={productName} />
      )}
      {cuOnly.length > 0 && (
        <details className={serving.length > 0 ? 'mt-2' : ''}>
          <summary className="cursor-pointer select-none text-xs text-zinc-400 transition hover:text-emerald-300">
            {cuOnly.length}{serving.length > 0 ? ' more' : ''} {cuOnly.length === 1 ? 'process' : 'processes'}
            <span className="text-zinc-500">
              {' '}— all computer-use-only: judged &ldquo;could attempt a manual step today&rdquo;
              evidence, not step coverage
            </span>
          </summary>
          <div className="mt-2">
            <ProcessNameList rows={cuOnly} arenaId={arenaId} productId={productId} productName={productName} />
          </div>
        </details>
      )}
    </div>
  )
}
