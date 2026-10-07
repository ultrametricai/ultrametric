// @vitest-environment jsdom
// The page-level design pin for the canonical /processes/[slug] route (PR #171 review
// finding, docs/PR171-EXTRACTION.md "Design-pin guards"): the existing component pins
// (ProcessDagVendorRows, StepVendorRow) assert over ProcessDag in isolation, so a route
// cutover that swaps the page body for a different reader keeps the suite green while
// unmounting every pinned component. This test renders the REAL canonical page and pins:
//   1. ProcessDag, ProcessLeaderboard, and the geo layer (ProcessGeoBanner, ProcessGeoNotes —
//      the control itself lives in the site header since founder 2026-10-07) are mounted on
//      the canonical route;
//   2. step blocks stay plain-text on receipts — inside the #steps region there are no
//      per-step score links (a[href$="/score"]), no story-verdict receipt links
//      (a[href*="#story-verdicts"]), and no interactive element nested inside another;
//   3. process-level receipts remain — the leaderboard's #story-verdicts links live
//      OUTSIDE the #steps region (founder 2026-10-05: "process-level scores and the
//      product pages keep their receipts links").
import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import ProcessPage, { generateStaticParams } from '@/app/processes/[slug]/page'
import { setGeoChoice } from '@/lib/geoPreference'
import { loadProcesses, processSlug } from '@/lib/processes'

const byId = new Map(loadProcesses().map((t) => [t.id, t]))
const renderPage = async (id: string) => {
  const task = byId.get(id)!
  const page = await ProcessPage({ params: Promise.resolve({ slug: processSlug(task.title) }) })
  return { task, ...render(page) }
}

// Interactive elements as the DOM sees them — a nested one (a link inside a step's "use"
// button, an expander inside a row) is the #171 step-block regression shape.
const INTERACTIVE =
  'a[href], button, input, select, textarea, summary, [role="button"], [role="link"]'

// The #steps anchor div is an empty scroll target; its parent is the bordered container
// that wraps the ONE process diagram (ProcessDag) on the page.
const stepsRegion = (container: HTMLElement) => {
  const anchor = container.querySelector('#steps')
  expect(anchor, 'the #steps anchor must exist on the canonical page').toBeTruthy()
  return anchor!.parentElement as HTMLElement
}

afterEach(() => setGeoChoice(null))

describe('canonical /processes/[slug] page-level design pin', () => {
  it('mounts ProcessDag, ProcessLeaderboard, and the geo layer on the canonical route (form_001)', async () => {
    const { task, container } = await renderPage('form_001')

    // The route itself serves the canonical slug and its alias slugs (static export).
    const params = generateStaticParams().map((p) => p.slug)
    expect(params).toContain(processSlug(task.title))
    for (const alias of task.slugAliases ?? []) expect(params).toContain(alias.slug)

    // ProcessDag: every corpus DAG node renders its per-step anchor block inside #steps.
    const steps = stepsRegion(container)
    for (const node of task.dag.nodes) {
      expect(
        steps.querySelector(`[id="step-${task.id}-${node.id}"]`),
        `step block step-${task.id}-${node.id} must render inside the steps region`,
      ).toBeTruthy()
    }

    // ProcessLeaderboard: the process-level ranking with its receipts links.
    expect(container.textContent).toContain('Who covers this process best')
    const receiptLinks = [...container.querySelectorAll('a[href*="#story-verdicts"]')]
    expect(receiptLinks.length, 'process-level score receipts links must remain').toBeGreaterThan(0)
    for (const link of receiptLinks) {
      expect(steps.contains(link), 'receipts links live at process level, not in step blocks').toBe(false)
    }

    // The geo control moved to the site header (founder 2026-10-07 —
    // components/HeaderGeoControl.tsx, pinned in components/__tests__/HeaderGeoControl.test.tsx):
    // the canonical page mounts NO dropdown of its own, and keeps every geo-adaptive block
    // wired to the one shared store (asserted below).
    expect(
      container.querySelector('button[aria-haspopup="listbox"][title^="Where you operate"]'),
      'the page must not mount its own geo dropdown — the header control owns it',
    ).toBeNull()

    // ProcessGeoNotes: the curated per-country analogs section (form_001 carries notes).
    expect(task.geoNotes?.length ?? 0).toBeGreaterThan(0)
    expect(container.querySelector('section#outside-the-us'), 'ProcessGeoNotes must be mounted').toBeTruthy()

    // ProcessGeoBanner: static HTML renders nothing (the shared-store contract) — a country
    // choice must surface the committed banner, proving the component is mounted AND wired
    // to the one geo store (lib/geoPreference.ts).
    expect(container.querySelector('a[href="#outside-the-us"]')).toBeNull()
    act(() => setGeoChoice('IN'))
    expect(
      container.querySelector('a[href="#outside-the-us"]'),
      'ProcessGeoBanner must render the committed country story under an explicit choice',
    ).toBeTruthy()
  })

  for (const id of ['form_001', 'tax_001']) {
    it(`keeps step blocks plain-text on receipts with no nested interactives inside #steps (${id})`, async () => {
      const { container } = await renderPage(id)
      const steps = stepsRegion(container)

      // No per-step score links and no story-verdict receipt links in step blocks.
      expect(steps.querySelectorAll('a[href$="/score"]').length).toBe(0)
      expect(steps.querySelectorAll('a[href*="#story-verdicts"]').length).toBe(0)

      // No interactive element nested inside another interactive element.
      const interactives = [...steps.querySelectorAll(INTERACTIVE)]
      // Non-vacuous: the per-step "use" affordances (single-click-target buttons) are there.
      expect(interactives.some((el) => el.matches('button[aria-pressed]'))).toBe(true)
      for (const el of interactives) {
        expect(
          el.parentElement?.closest(INTERACTIVE),
          `${el.tagName.toLowerCase()} (${el.getAttribute('href') ?? el.textContent?.slice(0, 40)}) must not nest inside another interactive element`,
        ).toBeNull()
      }
    })
  }
})
