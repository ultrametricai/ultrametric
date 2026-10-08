'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import AiEraBadge, { aiEraTooltip, type AiEraComponents, type ScoreBand } from '@/components/AiEraBadge'
import { LABELS, TITLES, type AgenticBadgeKind } from '@/components/AgenticBadge'

// The product header's score dropdown (founder 2026-10-08): the non-Overall header scores
// (Agent-ready, Built-in AI, API quality) fold into a menu anchored on the Overall score — the
// reader switches which score the big number shows. Selection is CLIENT state only: the static
// HTML always shows Overall (the default), and no judged number moves — every view renders the
// same committed leaderboard values the separate pills carried, with the same derivation
// tooltips and the same /score click-throughs. Interaction contract is the house menu idiom
// (components/DocsMenu.tsx / ArenaMenu): aria-haspopup/aria-expanded trigger,
// outside-pointerdown and Escape close (Escape restores trigger focus), arrow-key movement.

export interface ScoreView {
  kind: AgenticBadgeKind
  /** The committed leaderboard value — null renders the honest n/a pill (naDimensions arenas). */
  value: number | null
  /** isGroupUntested honesty: unscored-not-zero renders "untested", never a number. */
  untested?: boolean
  /** The per-dimension /score anchor — undefined for n/a dimensions, same as the old pills. */
  href?: string
}

type ViewId = 'overall' | AgenticBadgeKind

// The big-number pill in the Overall slot for a non-Overall view: AiEraBadge's exact md idiom
// (the one visual every headline score wears) with the dimension's own label and derivation
// tooltip riding along.
function BigPill({ view }: { view: ScoreView }) {
  const title = view.href
    ? `${TITLES[view.kind]} — see the exact calculation behind this number, with the evidence`
    : TITLES[view.kind]
  const label = (
    <span className="font-sans text-[0.72em] font-semibold uppercase tracking-wide opacity-80">
      {LABELS[view.kind]}
    </span>
  )
  if (view.untested || view.value === null) {
    return (
      <span
        title={
          view.untested
            ? `${TITLES[view.kind]} — no evidence found or probed either way for this index: unscored, not zero.`
            : TITLES[view.kind]
        }
        className="inline-flex w-fit items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1 text-sm font-semibold ring-1 ring-zinc-800"
      >
        {label}
        <span className="italic text-zinc-500">{view.untested ? 'untested' : 'n/a'}</span>
      </span>
    )
  }
  const pill = (
    <span
      title={title}
      className="inline-flex w-fit cursor-help items-center gap-1.5 rounded-full bg-emerald-400 px-3 py-1 text-sm font-mono font-bold text-zinc-950 ring-1 ring-emerald-300 tabular-nums"
    >
      {label}
      {view.value.toFixed(0)}
      <span className="font-medium opacity-60">/100</span>
    </span>
  )
  return view.href ? (
    <Link href={view.href} title="How is this calculated?" className="inline-flex">
      {pill}
    </Link>
  ) : (
    pill
  )
}

export default function ScoreViewMenu({ overall, views }: {
  overall: {
    value: number | null
    href: string
    components: AiEraComponents
    interval?: ScoreBand | null
  }
  views: ScoreView[]
}) {
  const [selected, setSelected] = useState<ViewId>('overall')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const entries: Array<{ id: ViewId; label: string; valueText: string; title: string }> = [
    {
      id: 'overall',
      label: 'Overall score',
      valueText: overall.value === null ? 'n/a' : `${overall.value.toFixed(0)}/100`,
      title: aiEraTooltip(overall.components, overall.interval ?? undefined),
    },
    ...views.map((v) => ({
      id: v.kind as ViewId,
      label: LABELS[v.kind],
      valueText: v.untested ? 'untested' : v.value === null ? 'n/a' : `${v.value.toFixed(0)}/100`,
      title: v.untested
        ? `${TITLES[v.kind]} — no evidence found or probed either way for this index: unscored, not zero.`
        : TITLES[v.kind],
    })),
  ]

  function focusItem(index: number) {
    const n = entries.length
    if (n === 0) return
    itemRefs.current[((index % n) + n) % n]?.focus()
  }

  function onMenuKeyDown(e: React.KeyboardEvent) {
    const current = itemRefs.current.findIndex((el) => el === document.activeElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusItem(current + 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusItem(current - 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      focusItem(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      focusItem(entries.length - 1)
    }
  }

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      requestAnimationFrame(() => focusItem(0))
    }
  }

  const selectedView = views.find((v) => v.kind === selected)

  return (
    <div ref={rootRef} className="relative inline-flex items-center gap-1.5">
      {selected === 'overall' || !selectedView ? (
        <AiEraBadge
          label="Overall score"
          value={overall.value}
          href={overall.href}
          interval={overall.interval}
          showBand
          components={overall.components}
        />
      ) : (
        <BigPill view={selectedView} />
      )}
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Switch which score the big number shows"
        title="Switch score view — Overall and the per-dimension indexes behind it"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        className="inline-flex cursor-pointer items-center rounded-full border border-zinc-800 px-1.5 py-1 text-xs text-zinc-400 transition hover:border-emerald-400 hover:text-emerald-300"
      >
        <span aria-hidden className={`transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Score views"
          onKeyDown={onMenuKeyDown}
          className="absolute left-0 top-full z-40 mt-1.5 w-52 rounded-xl border border-zinc-800 bg-zinc-900 p-1.5 shadow-xl shadow-black/40"
        >
          {entries.map((entry, i) => (
            <button
              key={entry.id}
              ref={(el) => {
                itemRefs.current[i] = el
              }}
              type="button"
              role="menuitemradio"
              aria-checked={selected === entry.id}
              title={entry.title}
              onClick={() => {
                setSelected(entry.id)
                setOpen(false)
                buttonRef.current?.focus()
              }}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-left text-xs transition hover:bg-zinc-800 hover:text-emerald-300 ${
                selected === entry.id ? 'text-emerald-300' : 'text-zinc-300'
              }`}
            >
              {entry.label}
              <span className="font-mono tabular-nums text-zinc-500">{entry.valueText}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
