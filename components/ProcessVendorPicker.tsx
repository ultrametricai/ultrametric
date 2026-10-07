'use client'

import { useEffect, useId, useRef, useState } from 'react'
import ProductLogoView from '@/components/ProductLogoView'
import { stackPicks } from '@/lib/myStack'
import { useProcessLens } from '@/lib/processLens'
import type { ProcessCheckStep } from '@/lib/processCheck'

// Top-of-page vendor picker for CHAIN pages (founder 2026-09-22: "a button next to
// the company logo so IF the user clicks on something like Mercury it will drive the process by
// that being the actual vendor selected — the DAG below adjusts; it starts generic with no
// vendors selected"). One pick sets the process lens (lib/processLens.ts) for that vendor's
// arena, and every step block, API-call panel, and agent prompt below re-resolves through it —
// the exact same lens the per-step "use" affordances and the ?via= share param drive.
// Process DETAIL pages dropped this section (founder 2026-10-05) — only the chain pages
// (app/processes/chains/[chain]/page.tsx) render it now; their lens mechanics are unchanged.
//
// Presentation (founder 2026-10-02): one house listbox dropdown per covering arena — the
// GeoDropdown/SimRolePicker idiom (trigger button + role="listbox" popover, logos in the rows,
// never a native <select>) replacing the flat chip rows. Mechanics are untouched: the same
// buildArenas market, the same setPick lens writes, 'No vendor' is the default and the explicit
// way back to the generic view. The old 5-chip space cap is gone — a scrolling listbox carries
// the arena's full ranked roster (membership and order unchanged).
//
// The static HTML renders every trigger as 'No vendor' (an honest market summary); selection
// state only hydrates in client-side, so the SEO page stays byte-identical for readers with no
// lens/stack.

interface PickerVendor {
  productId: string
  name: string
  hasLogo: boolean
  best: number
}

interface PickerArena {
  arenaId: string
  arenaName: string
  vendors: PickerVendor[]
}

// Derive the pickable market from the same pre-serialized rows the lens resolves against:
// per covering arena, its vendors ranked by their best step score across the whole stream.
function buildArenas(steps: ProcessCheckStep[]): PickerArena[] {
  const arenas = new Map<string, { arenaName: string; vendors: Map<string, PickerVendor> }>()
  for (const step of steps) {
    for (const arena of step.arenas) {
      if (arena.kind !== 'function') continue
      let bucket = arenas.get(arena.arenaId)
      if (!bucket) {
        bucket = { arenaName: arena.arenaName ?? arena.arenaId, vendors: new Map() }
        arenas.set(arena.arenaId, bucket)
      }
      for (const v of arena.vendors) {
        if (v.shutdown) continue // never offer a shutting-down vendor (lib/shutdown.ts rule)
        const existing = bucket.vendors.get(v.productId)
        if (!existing || v.score > existing.best) {
          bucket.vendors.set(v.productId, {
            productId: v.productId,
            name: v.name,
            hasLogo: v.hasLogo ?? false,
            best: v.score,
          })
        }
      }
    }
  }
  return [...arenas.entries()]
    .map(([arenaId, b]) => ({
      arenaId,
      arenaName: b.arenaName,
      vendors: [...b.vendors.values()].sort((a, c) => c.best - a.best || a.name.localeCompare(c.name)),
    }))
    .filter((a) => a.vendors.length > 0)
    .sort((a, c) => a.arenaName.localeCompare(c.arenaName))
}

// One arena's dropdown — SimRolePicker's listbox semantics: real <button> trigger with
// aria-haspopup/aria-expanded/aria-controls, a role="listbox" <ul> of real
// <button role="option">s, focus lands on the active option on open, Escape closes and
// refocuses the trigger, outside pointerdown closes.
function ArenaVendorDropdown({
  arena,
  pickedId,
  stackIds,
  onPick,
}: {
  arena: PickerArena
  // The explicit lens pick for this arena (undefined = none).
  pickedId: string | undefined
  // The reader's "I'm using" stack picks — badge-only ("yours"); an explicit pick wins.
  stackIds: string[]
  onPick: (productId: string | null, name?: string) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const activeOptionRef = useRef<HTMLButtonElement>(null)
  const listboxId = useId()

  const picked = pickedId ? arena.vendors.find((v) => v.productId === pickedId) : undefined
  // With no explicit lens pick the stack drives the lens resolution (lib/processLens.ts), so
  // the trigger honestly names the first stack pick instead of claiming 'No vendor'.
  const stackLead = !picked ? arena.vendors.find((v) => stackIds.includes(v.productId)) : undefined
  const current = picked ?? stackLead

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (open) activeOptionRef.current?.focus()
  }, [open])

  function close(refocus: boolean) {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }

  function pick(productId: string | null, name?: string) {
    onPick(productId, name)
    close(true)
  }

  return (
    <div
      ref={rootRef}
      className="relative min-w-0 flex-1"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation()
          close(true)
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => setOpen((v) => !v)}
        title={
          current
            ? `${current.name} is driving this process's ${arena.arenaName} steps — open to change or clear it`
            : `Pick the ${arena.arenaName} vendor to drive this process with`
        }
        className={`flex w-full min-w-0 items-center gap-1.5 rounded-lg border py-1 pl-1 pr-2 text-xs transition ${
          open
            ? 'border-emerald-400/60 bg-emerald-400/5 text-zinc-100'
            : current
              ? 'border-emerald-400/70 bg-emerald-400/10 text-emerald-300'
              : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-emerald-400/50 hover:text-emerald-300'
        }`}
      >
        {current ? (
          <>
            <ProductLogoView product={{ id: current.productId, name: current.name }} size={22} hasLogo={current.hasLogo} />
            <span className="min-w-0 flex-1 truncate text-left">{current.name}</span>
            {!picked && stackLead && (
              <span className="shrink-0 rounded bg-emerald-400/10 px-1 text-[9px] font-semibold">yours</span>
            )}
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate py-0.5 pl-1 text-left text-zinc-400">No vendor</span>
        )}
        <span aria-hidden className="shrink-0 text-[10px] text-zinc-500">▾</span>
      </button>

      {open && (
        <ul
          role="listbox"
          id={listboxId}
          aria-label={`${arena.arenaName} vendors`}
          className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900 py-1 shadow-2xl"
        >
          {/* The generic view stays one honest pick away — the default and the way back. */}
          <li role="presentation">
            <button
              ref={!picked ? activeOptionRef : undefined}
              type="button"
              role="option"
              aria-selected={!picked}
              onClick={() => pick(null)}
              title={`No ${arena.arenaName} vendor selected — the generic market view drives the steps below`}
              className={`flex w-full items-center gap-2 border-l-2 px-2.5 py-1.5 text-left text-xs transition ${
                !picked
                  ? 'border-emerald-400/70 bg-emerald-400/10 text-emerald-300'
                  : 'border-transparent text-zinc-400 hover:bg-emerald-400/10 hover:text-emerald-300'
              }`}
            >
              <span className="min-w-0 flex-1 truncate">No vendor</span>
              {!picked && <span aria-hidden className="shrink-0 text-emerald-300">✓</span>}
            </button>
          </li>
          {arena.vendors.map((v) => {
            const active = pickedId === v.productId
            const isStack = stackIds.includes(v.productId)
            return (
              <li key={v.productId} role="presentation">
                <button
                  ref={active ? activeOptionRef : undefined}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(v.productId, v.name)}
                  title={
                    active
                      ? `${v.name} is driving this process — pick 'No vendor' for the generic view`
                      : `Drive this process with ${v.name} — best judged step score ${v.best.toFixed(0)}/100 across this stream`
                  }
                  className={`flex w-full items-center gap-2 border-l-2 px-2.5 py-1.5 text-left text-xs transition ${
                    active
                      ? 'border-emerald-400/70 bg-emerald-400/10 text-emerald-300'
                      : 'border-transparent text-zinc-300 hover:bg-emerald-400/10 hover:text-emerald-300'
                  }`}
                >
                  <ProductLogoView product={{ id: v.productId, name: v.name }} size={20} hasLogo={v.hasLogo} />
                  <span className="min-w-0 flex-1 truncate">{v.name}</span>
                  {isStack && <span className="shrink-0 rounded bg-emerald-400/10 px-1 text-[9px] font-semibold">yours</span>}
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-zinc-500">
                    {v.best.toFixed(0)}/100
                  </span>
                  {active && <span aria-hidden className="shrink-0 text-emerald-300">✓</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function ProcessVendorPicker({ steps, lensKey }: { steps: ProcessCheckStep[]; lensKey: string }) {
  const { lens, stack, setPick } = useProcessLens(lensKey)
  const arenas = buildArenas(steps)
  if (arenas.length === 0) return null

  return (
    <div className="mt-3 rounded-xl border border-zinc-800 px-3.5 py-2.5">
      {/* Founder 2026-09-30: relabeled from 'Drive this process with your vendors' and moved to
          the top of process pages — no vendor selected by default. */}
      <p
        className="text-[10px] uppercase tracking-widest text-zinc-500"
        title="Pick the vendor you actually run for each market — the process below adjusts to it; picks persist on this device and travel in shared URLs (?via=)"
      >
        Select vendor for process test
      </p>
      <div className="mt-2 space-y-1.5">
        {arenas.map((arena) => (
          <div key={arena.arenaId} className="flex items-center gap-1.5">
            <span className="w-32 shrink-0 truncate text-[10px] uppercase tracking-wide text-zinc-500" title={`${arena.arenaName} — the market serving this stream's steps`}>
              {arena.arenaName}
            </span>
            <ArenaVendorDropdown
              arena={arena}
              pickedId={lens.picks[arena.arenaId]}
              stackIds={stackPicks(stack, arena.arenaId)}
              onPick={(productId, name) => setPick(arena.arenaId, productId, name)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
