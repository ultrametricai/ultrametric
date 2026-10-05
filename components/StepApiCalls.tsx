'use client'

import Link from 'next/link'
import { isPicked } from '@/lib/myStack'
import { useProcessLens, type LensSource } from '@/lib/processLens'

// One concrete call a vendor exposes for this step — from the evidence-grounded committed
// mapping (data/step-vendor-calls.json via lib/stepVendorCalls.ts); canonical reference calls
// come from the node's own functionCalls. sourceUrl is the evidence page the call was read from.
export interface ApiCall {
  method: string
  type?: string
  description?: string
  sourceUrl?: string
}

export interface VendorApiCalls {
  productId: string
  name: string
  arenaId: string
  calls: ApiCall[]
}

// How many vendors' call rows are visible before the rest fold into a <details>.
const VISIBLE_VENDORS = 4

function CallLine({ call }: { call: ApiCall }) {
  return (
    <li className="truncate font-mono text-[11px] text-zinc-400" title={call.description}>
      {call.method}
      {call.type === 'manual' && <span className="ml-1 text-amber-400/80">(manual)</span>}
      {call.sourceUrl && (
        <a
          href={call.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`Read in the vendor's docs — ${call.sourceUrl}`}
          className="ml-1 text-zinc-600 transition hover:text-emerald-300"
        >
          ↗
        </a>
      )}
    </li>
  )
}

function VendorGroup({ vendor, yours }: { vendor: VendorApiCalls; yours: LensSource | null }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">
        {/* The receipt heading clicks through to the vendor's judged product page — the
            productId/arenaId ride along from lib/stepVendorCalls.ts. */}
        <Link
          href={`/arena/${vendor.arenaId}/product/${vendor.productId}`}
          title={`${vendor.name} on Ultrametric — the judged product page`}
          className="transition hover:text-emerald-300"
        >
          {vendor.name}
        </Link>
        {yours && (
          <span
            className="ml-1.5 rounded bg-emerald-400/10 px-1 py-px text-[9px] font-semibold text-emerald-300"
            title={yours === 'lens' ? 'The vendor you selected on this page' : 'From your "I\'m using" stack'}
          >
            {yours === 'lens' ? '✓ via' : 'your pick'}
          </span>
        )}
      </p>
      <ul className="mt-0.5 space-y-0.5">
        {vendor.calls.map((c) => (
          <CallLine key={c.method} call={c} />
        ))}
      </ul>
    </div>
  )
}

// Per-vendor API calls for one step, UPFRONT (founder 2026-09-21: "have the API calls for the
// other vendors as well upfront (if they have not defined their vendors yet)"). The server
// snapshot of the stack is '{}', so the static page shows every vendor's grounded calls — that
// IS the no-stack view the founder asked for, and real SEO content. For readers with a pick,
// hydration pins their vendor first and folds the rest away. Pick resolution is the process
// lens's order (lib/processLens.ts): the vendor CLICKED on this page ("✓ via") beats the
// "I'm using" stack pick ("your pick").
export default function StepApiCalls({
  canonical,
  canonicalVendor,
  vendors,
  lensKey,
}: {
  // The node's own functionCalls — the curated reference flow, shown when not already covered
  // by a grounded vendor group.
  canonical: ApiCall[]
  canonicalVendor?: string
  vendors: VendorApiCalls[]
  lensKey?: string
}) {
  const { lens, stack } = useProcessLens(lensKey)
  // Lens first; else the reader's best pick for this step — vendors arrive in the step's
  // ranked order, so the first that is A pick (multi-vendor stacks, lib/myStack.ts isPicked)
  // is the best-ranked one they run.
  const pick =
    vendors.find((v) => lens.picks[v.arenaId] === v.productId) ??
    vendors.find((v) => isPicked(stack, v.arenaId, v.productId)) ??
    null
  const pickSource: LensSource | null =
    pick === null ? null : lens.picks[pick.arenaId] === pick.productId ? 'lens' : 'stack'
  const yoursOf = (v: VendorApiCalls): LensSource | null => (v === pick ? pickSource : null)
  const ordered = pick ? [pick, ...vendors.filter((v) => v !== pick)] : vendors
  const hasPick = pick !== null
  // With a pick set, only the reader's vendor stays upfront; without one, the first few vendors
  // all do (the "haven't defined their vendors yet" view).
  const visible = ordered.slice(0, hasPick ? 1 : VISIBLE_VENDORS)
  const folded = ordered.slice(hasPick ? 1 : VISIBLE_VENDORS)

  if (vendors.length === 0 && canonical.length === 0) return null
  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500" title="Concrete calls each vendor exposes for this step — every generated call links to the vendor docs evidence it was read from">
        API calls by vendor
      </p>
      {visible.map((v) => (
        <VendorGroup key={v.productId} vendor={v} yours={yoursOf(v)} />
      ))}
      {folded.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] text-zinc-500 transition hover:text-zinc-300 [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="inline-block text-[9px] transition-transform group-open:rotate-90">▶</span>
            {hasPick ? `other vendors (${folded.length})` : `${folded.length} more vendor${folded.length === 1 ? '' : 's'}`}
          </summary>
          <div className="mt-1.5 space-y-1.5 border-l border-zinc-800 pl-3">
            {folded.map((v) => (
              <VendorGroup key={v.productId} vendor={v} yours={null} />
            ))}
          </div>
        </details>
      )}
      {canonical.length > 0 && !vendors.some((v) => v.name === canonicalVendor) && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] text-zinc-500 transition hover:text-zinc-300 [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="inline-block text-[9px] transition-transform group-open:rotate-90">▶</span>
            reference flow{canonicalVendor ? ` (${canonicalVendor})` : ''} · {canonical.length} call{canonical.length === 1 ? '' : 's'}
          </summary>
          <ul className="mt-1.5 space-y-0.5 border-l border-zinc-800 pl-3">
            {canonical.map((c) => (
              <CallLine key={c.method} call={c} />
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
