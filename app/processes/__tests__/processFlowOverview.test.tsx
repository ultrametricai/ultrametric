// @vitest-environment jsdom
// Pin for the flow overview on the canonical /processes/[slug] page. Since founder
// 2026-10-08 it is the ACTUAL v2 reader diagram (ProcessViews.tsx ScopeGraph idiom —
// node cards, SVG dependency edges with arrowheads, serpentine measured layout from
// lib/shared-processes/overview-layout.ts) mounted client-side over the corpus DAG, with
// the 10-07 chip strip as the SSR/no-JS fallback the diagram replaces on mount.
// Pins: the overview mounts OUTSIDE the #steps region; the caption is gone; every corpus
// DAG node appears exactly once per presentation layer (fallback strip, diagram cards);
// every anchor resolves to a rendered #step block on the same page; cards and chips are
// plain anchors (no score links, no interactive nesting); parallel layers group behind
// the fallback's dashed idiom where the corpus DAG really is parallel; in jsdom with a
// measurable width the fallback is replaced by the measured diagram (cards at the
// readable text tier, every edge arrowed). Arrow endpoints landing ON the card borders
// are pinned in lib/__tests__/overview-layout.test.ts.
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ProcessPage from '@/app/processes/[slug]/page'
import { loadProcesses, processSlug } from '@/lib/processes'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

const byId = new Map(loadProcesses().map((t) => [t.id, t]))
const renderPage = async (id: string) => {
  const task = byId.get(id)!
  const page = await ProcessPage({ params: Promise.resolve({ slug: processSlug(task.title) }) })
  return { task, ...render(page) }
}

const overviewOf = (container: HTMLElement) => {
  const nav = container.querySelector('nav[aria-label="Process flow overview"]')
  expect(nav, 'the flow overview nav must be mounted on the canonical page').toBeTruthy()
  return nav as HTMLElement
}

const INTERACTIVE =
  'a[href], button, input, select, textarea, summary, [role="button"], [role="link"]'

describe('canonical page flow overview (founder 2026-10-07, v2 diagram 2026-10-08)', () => {
  for (const id of ['form_001', 'tax_001']) {
    it(`shows every DAG node exactly once per layer, each resolving to its #step anchor (${id})`, async () => {
      const { task, container } = await renderPage(id)
      const overview = overviewOf(container)

      // The overview lives OUTSIDE the #steps region (the design pin's receipts contract).
      const stepsRegion = container.querySelector('#steps')!.parentElement as HTMLElement
      expect(stepsRegion.contains(overview)).toBe(false)

      // The caption is gone (founder 2026-10-08).
      expect(overview.textContent).not.toContain('Flow overview')
      expect(overview.textContent).not.toContain('click a step to jump to it')

      // Unmeasured (jsdom has no width): the chip-strip fallback is the accessible
      // overview; the diagram layer exists for measurement but is hidden and inert.
      const fallback = overview.querySelector('[data-overview-fallback]') as HTMLElement
      expect(fallback, 'the SSR fallback strip must render before measurement').toBeTruthy()
      const diagram = overview.querySelector('[data-overview-measured]') as HTMLElement
      expect(diagram.getAttribute('data-overview-measured')).toBe('false')
      expect(diagram.getAttribute('aria-hidden')).toBe('true')
      expect(diagram.hasAttribute('inert')).toBe(true)

      // Every corpus DAG node appears exactly once in each presentation layer, and its
      // anchor resolves on this page.
      for (const node of task.dag.nodes) {
        const href = `#step-${task.id}-${node.id}`
        expect(
          fallback.querySelectorAll(`a[href="${href}"]`).length,
          `${href} must appear exactly once in the fallback strip`,
        ).toBe(1)
        expect(
          diagram.querySelectorAll(`a[href="${href}"]`).length,
          `${href} must appear exactly once among the diagram cards`,
        ).toBe(1)
        expect(
          container.querySelector(`[id="step-${task.id}-${node.id}"]`),
          `${href} must resolve to a rendered step block`,
        ).toBeTruthy()
      }
      // And nothing else: both layers carry exactly the DAG's nodes.
      expect(overview.querySelectorAll('a').length).toBe(task.dag.nodes.length * 2)

      // Plain anchors only — no score links, no nested interactives.
      expect(overview.querySelectorAll('a[href$="/score"]').length).toBe(0)
      for (const el of overview.querySelectorAll(INTERACTIVE)) {
        expect(
          el.parentElement?.closest(INTERACTIVE),
          'overview anchors must not nest inside another interactive element',
        ).toBeNull()
      }
    })
  }

  it('groups genuinely parallel layers behind the dashed idiom in the fallback strip', async () => {
    // A corpus task whose DAG really has a parallel layer — found, not hand-picked, so the pin
    // survives corpus growth.
    const { layerNodes } = await import('@/lib/dagLayers')
    const task = loadProcesses().find((t) =>
      layerNodes(t.dag.nodes, t.dag.edges).some((layer) => layer.length > 1),
    )
    expect(task, 'the corpus must contain at least one parallel process').toBeTruthy()
    const { container } = await renderPage(task!.id)
    const fallback = overviewOf(container).querySelector('[data-overview-fallback]')!
    const group = fallback.querySelector('span[title^="runs in parallel"]')
    expect(group, 'the parallel layer must render as the dashed group').toBeTruthy()
    expect(group!.querySelectorAll('a').length).toBeGreaterThan(1)
  })

  it('replaces the fallback with the measured v2 diagram on mount (jsdom)', async () => {
    let width = 0
    let resize = () => {}
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width)
    vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback } observe() {} disconnect() {} })
    const { task, container } = await renderPage('form_001')
    const overview = overviewOf(container)
    expect(overview.querySelector('[data-overview-fallback]')).not.toBeNull()
    width = 1240
    act(() => resize())

    // The fallback is gone; the diagram is the one accessible overview.
    expect(overview.querySelector('[data-overview-fallback]')).toBeNull()
    const diagram = overview.querySelector<HTMLElement>('[data-overview-measured="true"]')!
    expect(diagram.getAttribute('aria-hidden')).toBeNull()
    expect(diagram.hasAttribute('inert')).toBe(false)
    expect(diagram.style.width).toBe('1240px')

    // Every DAG node renders exactly one card whose anchor jumps to its step block, at
    // the readable text tier (founder 2026-10-08: bigger text in each box).
    for (const node of task.dag.nodes) {
      const anchors = diagram.querySelectorAll(`a[href="#step-${task.id}-${node.id}"]`)
      expect(anchors.length).toBe(1)
      expect(anchors[0].className).toContain('text-base')
      expect(anchors[0].closest('[data-graph-node]')).toBeTruthy()
    }
    expect(overview.querySelectorAll('a').length).toBe(task.dag.nodes.length)

    // Every recorded corpus edge is drawn with an arrowhead.
    const paths = [...diagram.querySelectorAll('[data-edge-from]')]
    expect(paths.map((p) => [p.getAttribute('data-edge-from'), p.getAttribute('data-edge-to')]))
      .toEqual(task.dag.edges!.map((e) => [e.from, e.to]))
    expect(paths.every((p) => p.getAttribute('marker-end'))).toBe(true)
  })

  it('draws an edgeless corpus task as the linear sequence the page below presents', async () => {
    let width = 0
    let resize = () => {}
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width)
    vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback } observe() {} disconnect() {} })
    // Found, not hand-picked: corpus semantics make an edgeless DAG linear by node order.
    const task = loadProcesses().find((t) => !t.dag.edges?.length && t.dag.nodes.length > 1)
    expect(task, 'the corpus must contain an edgeless multi-step process').toBeTruthy()
    const { container } = await renderPage(task!.id)
    width = 1240
    act(() => resize())
    const diagram = overviewOf(container).querySelector<HTMLElement>('[data-overview-measured="true"]')!
    const paths = [...diagram.querySelectorAll('[data-edge-from]')]
    expect(paths.map((p) => [p.getAttribute('data-edge-from'), p.getAttribute('data-edge-to')]))
      .toEqual(task!.dag.nodes.slice(1).map((n, i) => [task!.dag.nodes[i].id, n.id]))
  })
})
