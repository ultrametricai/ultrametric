// @vitest-environment jsdom
// Pin for the flow overview on the canonical /processes/[slug] page (founder 2026-10-07:
// the v2 reader's top-of-page mini-map, ported as a compact SSR strip above the Process
// breakdown). The same-day v2 diagram mount was reverted by the founder (2026-10-08): the
// strip IS the overview again, so the diagram-layer pins (the hidden measured layer, the
// jsdom ResizeObserver mount replacement, per-card text-base) retired with that revert.
// What the revert keeps is pinned here: no caption line, chips at the bumped text tier
// (text-sm or larger), and no enclosing box chrome on the overview or the #steps region.
// Standing pins: the overview mounts OUTSIDE the #steps region; every corpus DAG node
// appears in it exactly once; every chip anchor resolves to a rendered #step block on the
// same page; chips are plain anchors (no score links, no interactive nesting); parallel
// layers group behind the dashed idiom where the corpus DAG really is parallel.
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import ProcessPage from '@/app/processes/[slug]/page'
import { loadProcesses, processSlug } from '@/lib/processes'

afterEach(cleanup)

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

describe('canonical page flow overview (founder 2026-10-07; strip revert 2026-10-08)', () => {
  for (const id of ['form_001', 'tax_001']) {
    it(`shows every DAG node exactly once, each resolving to its #step anchor (${id})`, async () => {
      const { task, container } = await renderPage(id)
      const overview = overviewOf(container)

      // The overview lives OUTSIDE the #steps region (the design pin's receipts contract).
      const stepsRegion = container.querySelector('#steps')!.parentElement as HTMLElement
      expect(stepsRegion.contains(overview)).toBe(false)

      // The caption is gone and stays gone through the revert (founder 2026-10-08).
      expect(overview.textContent).not.toContain('Flow overview')
      expect(overview.textContent).not.toContain('click a step to jump to it')

      // The strip is a server render: no hidden client diagram layer, no fallback swap.
      expect(overview.querySelector('[data-overview-measured]')).toBeNull()
      expect(overview.querySelector('[data-overview-fallback]')).toBeNull()

      // Every corpus DAG node appears exactly once, and its anchor resolves on this page.
      for (const node of task.dag.nodes) {
        const href = `#step-${task.id}-${node.id}`
        const chips = overview.querySelectorAll(`a[href="${href}"]`)
        expect(chips.length, `${href} must appear exactly once in the overview`).toBe(1)
        // The bumped chip text tier stays (founder wants the bigger text generally).
        expect(chips[0].className).toContain('text-sm')
        expect(
          container.querySelector(`[id="step-${task.id}-${node.id}"]`),
          `${href} must resolve to a rendered step block`,
        ).toBeTruthy()
      }
      // And nothing else: the overview carries exactly the DAG's nodes.
      expect(overview.querySelectorAll('a').length).toBe(task.dag.nodes.length)

      // Plain anchors only — no score links, no nested interactives.
      expect(overview.querySelectorAll('a[href$="/score"]').length).toBe(0)
      const INTERACTIVE =
        'a[href], button, input, select, textarea, summary, [role="button"], [role="link"]'
      for (const el of overview.querySelectorAll(INTERACTIVE)) {
        expect(
          el.parentElement?.closest(INTERACTIVE),
          'overview chips must not nest inside another interactive element',
        ).toBeNull()
      }
    })
  }

  it('drops the enclosing box chrome from the overview and the #steps region (founder 2026-10-08)', async () => {
    const { container } = await renderPage('form_001')
    // The overview nav itself wears no border/rounded wrapper; the chips keep theirs.
    const overview = overviewOf(container)
    expect(overview.className).not.toMatch(/border|rounded/)
    // The #steps region wrapper (the anchor's parent, the design pin's measured element)
    // keeps the layout but loses the rounded/border box.
    const stepsRegion = container.querySelector('#steps')!.parentElement as HTMLElement
    expect(stepsRegion.className).not.toMatch(/border|rounded/)
  })

  it('groups genuinely parallel layers behind the dashed idiom, in the diagram layer order', async () => {
    // A corpus task whose DAG really has a parallel layer — found, not hand-picked, so the pin
    // survives corpus growth.
    const { layerNodes } = await import('@/lib/dagLayers')
    const task = loadProcesses().find((t) =>
      layerNodes(t.dag.nodes, t.dag.edges).some((layer) => layer.length > 1),
    )
    expect(task, 'the corpus must contain at least one parallel process').toBeTruthy()
    const { container } = await renderPage(task!.id)
    const overview = overviewOf(container)
    const group = overview.querySelector('span[title^="runs in parallel"]')
    expect(group, 'the parallel layer must render as the dashed group').toBeTruthy()
    expect(group!.querySelectorAll('a').length).toBeGreaterThan(1)
  })
})
