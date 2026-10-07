// @vitest-environment jsdom
// Pin for the flow overview on the canonical /processes/[slug] page (founder 2026-10-07: the
// v2 reader's top-of-page mini-map, ported as a compact SSR strip above the Process breakdown).
// Pins: the overview mounts OUTSIDE the #steps region; every corpus DAG node appears in it
// exactly once; every chip anchor resolves to a rendered #step block on the same page; chips
// are plain anchors (no score links, no interactive nesting); parallel layers group behind the
// dashed idiom where the corpus DAG really is parallel.
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

describe('canonical page flow overview (founder 2026-10-07)', () => {
  for (const id of ['form_001', 'tax_001']) {
    it(`shows every DAG node exactly once, each resolving to its #step anchor (${id})`, async () => {
      const { task, container } = await renderPage(id)
      const overview = overviewOf(container)

      // The overview lives OUTSIDE the #steps region (the design pin's receipts contract).
      const stepsRegion = container.querySelector('#steps')!.parentElement as HTMLElement
      expect(stepsRegion.contains(overview)).toBe(false)

      // Every corpus DAG node appears exactly once, and its anchor resolves on this page.
      for (const node of task.dag.nodes) {
        const href = `#step-${task.id}-${node.id}`
        const chips = overview.querySelectorAll(`a[href="${href}"]`)
        expect(chips.length, `${href} must appear exactly once in the overview`).toBe(1)
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
