'use client'

import { IconGlyph } from '@/components/IconChip'
import ProductLogoView from '@/components/ProductLogoView'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { filterSearchEntries, prepareSearchEntries, type SearchEntry, type SearchEntryType } from '@/lib/search-index'

const TYPE_ORDER: SearchEntryType[] = ['arena', 'stack', 'process', 'page', 'product', 'story']
const TYPE_LABEL: Record<SearchEntryType, string> = {
  // The renamed Arenas nav label (founder 2026-10-07) — entry type ids stay 'arena'.
  arena: 'Rankings',
  stack: 'Stacks',
  process: 'Processes',
  page: 'Pages',
  product: 'Products',
  story: 'Stories',
}
const MAX_RESULTS = 40

// Global ⌘K/Ctrl+K search over every arena, product, and story (see lib/search-index.ts).
// Self-contained: renders both its own header trigger button and the overlay, so it can be
// dropped into the (server-component) layout without lifting open-state elsewhere.
//
// The index is NOT passed as props: serializing it from the layout baked a ~160 KB flight blob
// into every prerendered page (~4.5 GB of .next/server/app and 160 KB of every page's wire
// HTML — docs/BUILD-SIZE.md problem 2). Instead the force-static /search-index.json route
// serves it once from the CDN and the palette fetches it lazily on FIRST open, keeping it in
// state for the component's lifetime (the layout never unmounts it, so that is one fetch per
// page load, and the browser HTTP cache covers reloads). Honest first-open cost: one small
// JSON round-trip behind a visible loading row.
export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  // null = not loaded yet (never fetched, in flight, or failed — `failed` disambiguates).
  const [entries, setEntries] = useState<SearchEntry[] | null>(null)
  const [failed, setFailed] = useState(false)
  // Guards the in-flight fetch across open/close cycles and React strict-mode double effects;
  // reset on failure so the next open retries.
  const fetchStarted = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Lazy index load, SSR-safe by construction: an effect only ever runs in the browser, and
  // only once the palette is actually opened.
  useEffect(() => {
    if (!open || fetchStarted.current) return
    fetchStarted.current = true
    setFailed(false)
    fetch('/search-index.json')
      .then((res) => {
        if (!res.ok) throw new Error(`search index: HTTP ${res.status}`)
        return res.json() as Promise<SearchEntry[]>
      })
      .then(setEntries)
      .catch(() => {
        fetchStarted.current = false
        setFailed(true)
      })
  }, [open])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Focus the input whenever the palette becomes visible. Purely imperative (no state
  // updates), so it's a legitimate effect rather than something to inline into an handler.
  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  // Lowercased + plural-folded haystacks, computed once per index load so each keystroke is pure
  // substring checks (see lib/search-index.ts).
  const prepared = useMemo(() => prepareSearchEntries(entries ?? []), [entries])

  // Results are pre-grouped by type (arena, stack, page, product, story) so rendering can walk
  // one flat array in display order — no index bookkeeping needed at render time. Within each
  // group, filterSearchEntries has already ordered matches best-first. Founder 2026-09-23
  // ("searching Jev, Jev doesn't come up at the top"): with a live query, the group holding the
  // GLOBAL best match leads — filterSearchEntries returns score order, so limited[0] is the
  // strongest direct-character match and always renders as row one; the static TYPE_ORDER only
  // governs the browse view and the remaining groups.
  const results = useMemo(() => {
    const all = filterSearchEntries(prepared, query)
    // Browse view (no query): the arena list alone fills the cap, so later groups never
    // surface on their own — Virtual Startup is pulled from the full set and pinned first
    // (founder 2026-09-29), and the curated Processes group is likewise pulled from the full
    // set (founder 2026-10-02: "⌘K search defaults include processes"). The cap is honored by
    // reserving their rows before slicing; everything else keeps TYPE_ORDER browse grouping.
    if (query.trim() === '') {
      const vs = all.find((e) => e.href === '/startup-sim')
      const processes = all.filter((e) => e.type === 'process')
      const reserved = processes.length + (vs ? 1 : 0)
      const limited = all
        .filter((e) => e.type !== 'process' && e.href !== '/startup-sim')
        .slice(0, Math.max(0, MAX_RESULTS - reserved))
      const grouped = TYPE_ORDER.flatMap((type) =>
        type === 'process' ? processes : limited.filter((e) => e.type === type),
      )
      return vs ? [vs, ...grouped] : grouped
    }
    const limited = all.slice(0, MAX_RESULTS)
    const best = limited[0]?.type
    const order = best ? [best, ...TYPE_ORDER.filter((t) => t !== best)] : TYPE_ORDER
    return order.flatMap((type) => limited.filter((e) => e.type === type))
  }, [prepared, query])

  function close() {
    setOpen(false)
    setQuery('')
    setActiveIndex(0)
  }

  function go(entry: SearchEntry) {
    close()
    router.push(entry.href)
  }

  function onInputChange(value: string) {
    setQuery(value)
    setActiveIndex(0)
  }

  function onKeyDownInPalette(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      return
    }
    // ArrowDown/ArrowUp cycle through the results and wrap at both ends (last + down → first,
    // first + up → last). The handler lives on the dialog, so it works straight from the input.
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (results.length > 0) setActiveIndex((i) => (i + 1) % results.length)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (results.length > 0) setActiveIndex((i) => (i - 1 + results.length) % results.length)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const chosen = results[activeIndex]
      if (chosen) go(chosen)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-2 rounded-lg border border-zinc-800 px-2.5 py-1 text-xs text-zinc-400 transition hover:border-emerald-400/60 hover:text-emerald-300"
        aria-label="Open search"
      >
        <span>Search</span>
        <kbd className="hidden rounded border border-zinc-700 bg-zinc-900 px-1 font-mono text-[10px] text-zinc-500 sm:inline">⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-24" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search rankings, products, and stories"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onKeyDownInPalette}
            className="w-full max-w-lg overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl"
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Search rankings, products, stories…"
              className="w-full border-b border-zinc-800 bg-transparent px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
            />
            <div className="max-h-96 overflow-y-auto py-2">
              {/* Until the lazily-fetched index lands, the results area narrates the load — the
                  input stays usable, and the pending query ranks the moment entries arrive. */}
              {entries === null && (
                <p className="px-4 py-6 text-center text-sm text-zinc-400">
                  {failed ? 'Search is unavailable — close and reopen to retry.' : 'Loading search…'}
                </p>
              )}
              {entries !== null && results.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-zinc-400">
                  {query.trim() ? <>No matches for &ldquo;{query}&rdquo;</> : 'No matches'}
                </p>
              )}
              {results.map((entry, index) => {
                const showHeader = index === 0 || results[index - 1].type !== entry.type
                const active = index === activeIndex
                return (
                  <div key={`${entry.type}-${entry.href}-${entry.label}`} className="px-2">
                    {showHeader && (
                      <p className="px-2 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-400">
                        {TYPE_LABEL[entry.type]}
                      </p>
                    )}
                    <button
                      type="button"
                      // Keep the active row visible while arrow keys cycle the (scrollable) list.
                      // block:'nearest' is a no-op when already in view, so hover never jitters.
                      ref={active ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => go(entry)}
                      className={`flex w-full flex-col items-start rounded-lg px-2 py-2 text-left text-sm transition ${
                        active ? 'bg-emerald-400/10 text-emerald-300' : 'text-zinc-300'
                      }`}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        {entry.type === 'product' && entry.productId ? (
                          <ProductLogoView product={{ id: entry.productId, name: entry.label }} size={18} hasLogo={!!entry.hasLogo} />
                        ) : entry.icon ? (
                          // House icon tokens (lib/arenaIcons.ts) render as the custom duotone
                          // glyphs; plain emoji entries keep rendering as text.
                          <span aria-hidden className="inline-flex w-[18px] shrink-0 justify-center text-sm leading-none">
                            <IconGlyph icon={entry.icon} />
                          </span>
                        ) : null}
                        {entry.label}
                      </span>
                      <span className="text-xs text-zinc-500">{entry.sublabel}</span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
