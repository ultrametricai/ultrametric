'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

// Site-wide instant tooltips. Native `title` attributes carry a browser-controlled ~1s hover
// delay (founder feedback: "tooltips are slow to show up") that cannot be configured, so this
// global delegate upgrades every existing `title=` in place: on hover it stashes the title into
// `data-tip` (suppressing the native tooltip), renders a styled tooltip near-instantly, and
// restores the attribute on leave — so the DOM keeps `title` for a11y/agents/tests except during
// the brief hover window. Mounted once in app/layout.tsx; zero per-callsite changes, and new
// tooltips added anywhere pick this up automatically.
//
// Touch devices never see these (founder 2026-09-24): a tap means activate, not hover.
const SHOW_DELAY_MS = 80 // near-instant but ignores drive-by cursor passes

export default function InstantTooltip() {
  const ref = useRef<HTMLDivElement>(null)
  // Exposes the current hide() to the route-change effect below — the main effect mounts once,
  // so the pathname effect can't live inside it.
  const hideRef = useRef<() => void>(() => {})
  const pathname = usePathname()

  useEffect(() => {
    const tip = ref.current
    if (!tip) return
    let current: HTMLElement | null = null
    let showTimer: ReturnType<typeof setTimeout> | undefined
    let touchTimer: ReturnType<typeof setTimeout> | undefined

    function place(target: HTMLElement) {
      const r = target.getBoundingClientRect()
      tip!.style.maxWidth = '340px'
      // Render first (hidden) to measure, then clamp into the viewport.
      tip!.style.visibility = 'hidden'
      tip!.style.display = 'block'
      const tw = tip!.offsetWidth
      const th = tip!.offsetHeight
      let x = r.left + r.width / 2 - tw / 2
      x = Math.max(8, Math.min(x, window.innerWidth - tw - 8))
      let y = r.bottom + 8
      if (y + th > window.innerHeight - 8) y = r.top - th - 8
      tip!.style.left = `${Math.round(x)}px`
      tip!.style.top = `${Math.round(y)}px`
      tip!.style.visibility = 'visible'
    }

    function show(target: HTMLElement) {
      const text = target.getAttribute('title')
      if (!text || !text.trim()) return
      // Suppress the native tooltip while ours is up; keep the text recoverable.
      target.setAttribute('data-tip', text)
      target.removeAttribute('title')
      current = target
      tip!.textContent = text
      place(target)
      // Watch for the anchor's removal only while a tooltip is visible (hide() disconnects).
      removalObserver.observe(document.body, { childList: true, subtree: true })
    }

    // Sticky-tooltip guard (founder bug 2026-10-05): client-side navigation never fires
    // mouseleave on an element React removed, so a tooltip shown over a clicked link used to
    // survive the navigation. While a tooltip is up, this observer watches for its anchor
    // leaving the DOM and hides immediately — covers route transitions, table re-sorts, and any
    // other removal the mouse events can't see.
    const removalObserver = new MutationObserver(() => {
      if (current && !current.isConnected) hide()
    })

    function hide() {
      if (current) {
        const stashed = current.getAttribute('data-tip')
        if (stashed !== null && !current.hasAttribute('title')) current.setAttribute('title', stashed)
        current.removeAttribute('data-tip')
        current = null
      }
      removalObserver.disconnect()
      tip!.style.display = 'none'
      clearTimeout(showTimer)
    }
    hideRef.current = hide

    function onOver(e: MouseEvent) {
      const target = (e.target as HTMLElement | null)?.closest?.('[title]') as HTMLElement | null
      if (!target || target === current) return
      hide()
      clearTimeout(showTimer)
      showTimer = setTimeout(() => show(target), SHOW_DELAY_MS)
    }

    function onOut(e: MouseEvent) {
      const related = e.relatedTarget as Node | null
      if (current && related && current.contains(related)) return
      hide()
    }

    // Founder 2026-09-24: NO tooltips on touch taps — on mobile a tap means "activate", and a
    // tooltip popping over the tap target was noise. Touch devices simply never see these
    // (the underlying title text stays in the DOM for a11y/agents). A touchstart flag also
    // guards against the synthetic mouseover some mobile browsers fire after a tap.
    let touching = false
    function onTouchStart() {
      touching = true
      hide()
      clearTimeout(touchTimer)
      touchTimer = setTimeout(() => {
        touching = false
      }, 700)
    }

    function onOverGuarded(e: MouseEvent) {
      if (touching) return
      onOver(e)
    }

    document.addEventListener('mouseover', onOverGuarded, true)
    document.addEventListener('mouseout', onOut, true)
    document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true })
    document.addEventListener('scroll', hide, true)
    // Sticky-tooltip guard (founder bug 2026-10-05): a click means "activate", so the tooltip
    // goes down with the pointer — client-side navigation after the click can't strand it.
    // pointerdown covers mouse, pen, and touch alike, before any click handler runs.
    document.addEventListener('pointerdown', hide, true)
    // Back/forward restores a page the tooltip was never anchored to.
    window.addEventListener('popstate', hide)
    return () => {
      document.removeEventListener('mouseover', onOverGuarded, true)
      document.removeEventListener('mouseout', onOut, true)
      document.removeEventListener('touchstart', onTouchStart, true)
      document.removeEventListener('scroll', hide, true)
      document.removeEventListener('pointerdown', hide, true)
      window.removeEventListener('popstate', hide)
      clearTimeout(touchTimer)
      hide()
    }
  }, [])

  // Route-change guard (founder bug 2026-10-05): the pointerdown/removal guards above cover the
  // common paths, but any client-side navigation that slips past both (e.g. a programmatic
  // router.push while a tooltip is up) still hides on the pathname flip.
  useEffect(() => {
    hideRef.current()
  }, [pathname])

  return (
    <div
      ref={ref}
      role="tooltip"
      style={{ display: 'none', position: 'fixed', zIndex: 90 }}
      className="pointer-events-none whitespace-pre-line rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs leading-snug text-zinc-200 shadow-xl shadow-black/40"
    />
  )
}
