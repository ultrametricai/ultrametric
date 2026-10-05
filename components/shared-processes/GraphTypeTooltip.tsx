'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function GraphTypeTooltip({ label, symbol, color }: { label: string; symbol: string; color: string }) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const tooltip = useRef<HTMLDivElement>(null)
  const hovered = useRef(false)
  const focused = useRef(false)
  const pinned = useRef(false)
  const touch = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const close = useCallback(() => {
    clearTimeout(timer.current)
    pinned.current = false
    setOpen(false)
    setPosition(null)
  }, [])
  const show = () => { clearTimeout(timer.current); setOpen(true) }
  const leave = () => {
    hovered.current = false
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (!hovered.current && !focused.current && !pinned.current) close()
    }, 160)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  useLayoutEffect(() => {
    if (!open) return
    function place() {
      if (!trigger.current || !tooltip.current) return
      const anchor = trigger.current.getBoundingClientRect()
      const view = window.visualViewport
      const left = (view?.offsetLeft ?? 0), top = (view?.offsetTop ?? 0)
      const right = left + (view?.width ?? window.innerWidth), bottom = top + (view?.height ?? window.innerHeight)
      const visible = { left: Math.max(left, anchor.left), top: Math.max(top, anchor.top), right: Math.min(right, anchor.right), bottom: Math.min(bottom, anchor.bottom) }
      // A portal escapes clipping, but must not remain attached to an offscreen
      // step when either the page or either graph scroll axis moves it away.
      for (let parent = trigger.current.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent), bounds = parent.getBoundingClientRect()
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
          visible.left = Math.max(visible.left, bounds.left)
          visible.right = Math.min(visible.right, bounds.right)
        }
        if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
          visible.top = Math.max(visible.top, bounds.top)
          visible.bottom = Math.min(visible.bottom, bounds.bottom)
        }
      }
      if (visible.right <= visible.left || visible.bottom <= visible.top) { close(); return }
      tooltip.current.style.maxWidth = `${Math.min(288, Math.max(1, right - left - 16))}px`
      const size = tooltip.current.getBoundingClientRect()
      const x = Math.max(left + 8, Math.min((visible.left + visible.right - size.width) / 2, right - size.width - 8))
      const below = visible.bottom + 8
      const y = below + size.height <= bottom - 8 ? below : Math.max(top + 8, visible.top - size.height - 8)
      setPosition({ left: x, top: y })
    }
    function outside(event: PointerEvent) {
      if (!trigger.current?.contains(event.target as Node) && !tooltip.current?.contains(event.target as Node)) close()
    }
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') close() }
    place()
    document.addEventListener('scroll', place, true)
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('keydown', escape, true)
    window.addEventListener('resize', place)
    window.visualViewport?.addEventListener('resize', place)
    window.visualViewport?.addEventListener('scroll', place)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place)
    if (trigger.current) observer?.observe(trigger.current)
    if (tooltip.current) observer?.observe(tooltip.current)
    return () => {
      document.removeEventListener('scroll', place, true)
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('keydown', escape, true)
      window.removeEventListener('resize', place)
      window.visualViewport?.removeEventListener('resize', place)
      window.visualViewport?.removeEventListener('scroll', place)
      observer?.disconnect()
    }
  }, [open, label, close])

  return <>
    <button ref={trigger} type="button" aria-label={label} aria-describedby={open ? id : undefined}
      onPointerDown={event => { touch.current = event.pointerType === 'touch' }}
      onPointerEnter={event => { if (event.pointerType !== 'touch') { hovered.current = true; show() } }}
      onPointerLeave={leave}
      onFocus={() => { if (!touch.current) { focused.current = true; show() } }}
      onBlur={() => { touch.current = false; focused.current = false; pinned.current = false; leave() }}
      onClick={() => { if (pinned.current) close(); else { pinned.current = true; show() } }}
      className={`flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-lg focus-visible:outline-2 focus-visible:outline-emerald-300 ${color}`}>{symbol}</button>
    {open && createPortal(<div ref={tooltip} id={id} role="tooltip" data-graph-tooltip
      onPointerEnter={event => { if (event.pointerType !== 'touch') { hovered.current = true; clearTimeout(timer.current) } }}
      onPointerLeave={leave}
      style={{ position: 'fixed', zIndex: 100, left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? 'visible' : 'hidden', maxWidth: 'min(18rem, calc(100vw - 16px))' }}
      className="w-max rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-sm leading-relaxed text-zinc-200 shadow-xl">{label}</div>, document.body)}
  </>
}
