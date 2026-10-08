'use client'

// The landing nav's wordmark hover effect, restored onto the shared header wordmark (founder
// 2026-09-29: "the homepage has lost its animations"). Faithful port of the original compiled
// script (recovered from the still-live ultrametric.ai/v2 page and the web.archive.org
// 2026-08-25 homepage snapshot): on hover/focus, a 2D-canvas Julia set (z → z² + c with
// c = 0.7885·e^{i·t·4e-4}, escape-time ≤ 26 iterations, smooth cosine-palette coloring) animates
// inside the wordmark letterforms (CSS mask, see .logo-fx in app/globals.css), plus a white
// shine sweep (.logo-shine). prefers-reduced-motion: a single static frame (t=4000), no sweep.
// The companion CSS was recovered from the landing's compiled Nav CSS chunk.
//
// This renders the same link + img the header always had — the effect spans are absolutely
// positioned overlays, so SSG markup/layout are unchanged and the fractal only computes on
// hover. Identical on every page (it lives in app/layout.tsx).

import Link from 'next/link'
import { useEffect, useRef } from 'react'

const MAX_ITER = 26
const BAILOUT = 4

// Escape-time Julia frame into the canvas backing store (original compiled render fn).
function drawJulia(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, t: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  const image = ctx.createImageData(w, h)
  const { data } = image
  const theta = t * 4e-4
  const cRe = 0.7885 * Math.cos(theta)
  const cIm = 0.7885 * Math.sin(theta)
  let n = 0
  for (let py = 0; py < h; py++) {
    const y0 = (py / h - 0.5) * 2.4
    for (let px = 0; px < w; px++) {
      let x = (px / w - 0.5) * 3.6
      let y = y0
      let iter = 0
      let x2 = x * x
      let y2 = y * y
      while (iter < MAX_ITER && x2 + y2 < BAILOUT) {
        y = 2 * x * y + cIm
        x = x2 - y2 + cRe
        x2 = x * x
        y2 = y * y
        iter += 1
      }
      if (iter >= MAX_ITER) {
        data[n] = 236
        data[n + 1] = 240
        data[n + 2] = 255
      } else {
        const TAU = Math.PI * 2
        const wsm = (iter + 1 - Math.log2(Math.max(1e-9, Math.log2(x2 + y2)))) * 0.09 + t * 5e-5
        data[n] = Math.round(255 * (0.62 + 0.38 * Math.cos(TAU * wsm)))
        data[n + 1] = Math.round(255 * (0.62 + 0.38 * Math.cos(TAU * (wsm + 0.33))))
        data[n + 2] = Math.round(255 * (0.62 + 0.38 * Math.cos(TAU * (wsm + 0.67))))
      }
      data[n + 3] = 255
      n += 4
    }
  }
  ctx.putImageData(image, 0, 0)
}

export default function LogoWordmark() {
  const rootRef = useRef<HTMLAnchorElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    if (!root || !canvas) return
    let ctx: CanvasRenderingContext2D | null = null
    try {
      ctx = canvas.getContext('2d')
    } catch {
      return
    }
    if (!ctx) return
    const c2d = ctx
    // Hover effect, HOVER devices only (mobile-nav perf fix 2026-10-01): on touch, the tap that
    // navigates fires pointerenter (and on Android, focusin — which persists across the
    // navigation because this header never unmounts), so the per-frame Julia imageData loop
    // could start on the way out and never stop. No hover capability → no listeners at all.
    if (typeof window.matchMedia !== 'function' || !window.matchMedia('(hover: hover)').matches) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let running = false

    function frame(t: number) {
      if (!running || !canvas) return
      drawJulia(canvas, c2d, t)
      raf = requestAnimationFrame(frame)
    }
    function start() {
      if (!canvas) return
      if (reduced) {
        // Static frame only (the original renders t=4000 under reduced motion).
        drawJulia(canvas, c2d, 4000)
        return
      }
      if (!running) {
        running = true
        raf = requestAnimationFrame(frame)
      }
    }
    function stop() {
      running = false
      cancelAnimationFrame(raf)
    }

    root.addEventListener('pointerenter', start)
    root.addEventListener('pointerleave', stop)
    root.addEventListener('focusin', start)
    root.addEventListener('focusout', stop)
    return () => {
      stop()
      root.removeEventListener('pointerenter', start)
      root.removeEventListener('pointerleave', stop)
      root.removeEventListener('focusin', start)
      root.removeEventListener('focusout', stop)
    }
  }, [])

  return (
    <Link ref={rootRef} href="/" className="logo-root relative block shrink-0" title="Ultrametric home">
      {/* Compact mark below sm (founder 2026-10-08: the full wordmark is ~14× wider than tall,
          so even at h-3 it took ~170px of a 375px bar and wrapped the header onto two lines).
          The asset is the committed wordmark file with the viewBox cropped to its first glyph —
          same letterform, no redrawn art. */}
      {/* alt="" — decorative beside the wordmark's alt: one img names the link, and below sm
          (wordmark display:none) the link's title attribute carries the accessible name. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- static svg mark */}
      <img src="/ultrametric-mark.svg" alt="" className="h-4 w-auto sm:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element -- static svg wordmark */}
      <img src="/ultrametric-wordmark.svg" alt="ultrametric" className="hidden h-3.5 w-auto sm:block" />
      {/* The hover fx overlays are masked to the FULL wordmark (app/globals.css .logo-fx), so
          they only exist from sm up where that image renders — below sm the compact mark has no
          hover fx (touch devices never armed the loop anyway, see the hover-capability gate). */}
      <span className="logo-fx pointer-events-none absolute inset-0 hidden opacity-0 transition-opacity duration-300 sm:block" aria-hidden>
        <canvas ref={canvasRef} className="logo-fractal block h-full w-full" />
      </span>
      <span className="logo-shine pointer-events-none absolute inset-0 hidden opacity-0 sm:block" aria-hidden />
    </Link>
  )
}
