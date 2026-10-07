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

// Per-step vendor API calls FOLLOW THE SELECTION (founder 2026-10-07: the calls neither
// changed with the chip selection nor disappeared without one — the 2026-09-21 every-vendor-
// upfront roster and its folded "other vendors" are retired). With a vendor selected — the
// ?via=/pa-lens pick from the step chips, or an "I'm using" stack pick, the lens winning per
// lib/processLens.ts — ONLY that vendor's grounded calls render; with no selection, nothing
// renders. The server snapshot (empty lens + empty stack) therefore renders nothing, which is
// exactly the no-selection view — no hydration mismatch. The canonical reference-flow fold
// left with the roster; the node's own functionCalls stay data (and still render on steps
// without grounded vendor calls via ProcessDag's fallback block).
export default function StepApiCalls({
  vendors,
  lensKey,
}: {
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
  if (pick === null) return null
  const pickSource: LensSource =
    lens.picks[pick.arenaId] === pick.productId ? 'lens' : 'stack'
  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500" title="Concrete calls your selected vendor exposes for this step — every generated call links to the vendor docs evidence it was read from">
        API calls by vendor
      </p>
      <VendorGroup vendor={pick} yours={pickSource} />
    </div>
  )
}
