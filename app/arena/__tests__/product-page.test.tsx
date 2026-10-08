// @vitest-environment jsdom
// Product-page pins for the founder's 2026-10-02 batch (amended 2026-10-08), rendered against
// the real committed corpus (startup-banking/mercury — a product with processes, integrations,
// and score history coverage): the vendor line links OUT to the vendor's committed site (never
// a guessed domain), the per-rect theme tooltips are gone, the page-footer contest affordance
// ("⚑ Flag a verdict" and its ⚿ auth companion chip) is removed — contestation routes through
// the repo (CONTRIBUTING.md + issue templates) while the row-level ⚑ flag links stay — and the
// agent-discovery pointers the old utility grid carried moved into generateMetadata alternates
// (<link rel="alternate">) — same URLs /llms.txt and /openapi.json document.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ProductPage, { generateMetadata } from '@/app/arena/[category]/product/[id]/page'
import { loadAll, loadCategory } from '@/lib/data'
import { isGroupUntested } from '@/lib/data-helpers'

const ARENA = 'startup-banking'
const ID = 'mercury'
const params = Promise.resolve({ category: ARENA, id: ID })

async function renderPage() {
  return render(await ProductPage({ params }))
}

describe('product page — founder 2026-10-02 batch', () => {
  it('the vendor line links to the vendor\'s committed site — with NO ↗ glyph after the name (founder 2026-10-02)', async () => {
    await renderPage()
    const link = screen.getByRole('link', { name: /Mercury Technologies/ })
    expect(link.getAttribute('href')).toBe('https://mercury.com')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    // Founder 2026-10-02: the arrow is gone; the name itself stays the external link.
    expect(link.textContent).not.toContain('↗')
    // The URL comes from committed product data, said out loud in the tooltip — never guessed.
    expect(link.getAttribute('title')).toContain('https://mercury.com')
  })

  it('header display declutter (founder 2026-10-02): no Built-in AI assistant chip, no spike-depth chip, no Open app link', async () => {
    const { container } = await renderPage()
    // The '✨ Built-in AI assistant' chip is gone (the verdict stays data — the Built-in AI
    // pill and the story row below still carry it).
    expect(screen.queryByText('Built-in AI assistant')).toBeNull()
    // The '◉ deep-spiked · N ev' / '◎ surface spike' verification-depth chip is gone.
    expect(container.textContent).not.toMatch(/deep-spiked|surface spike|not yet spiked/)
    // The 'Open app ↗' quick link is gone; the docs links keep their chips.
    expect(screen.queryByText(/Open app/)).toBeNull()
  })

  it('an untested api-quality dimension shows a visible "untested" cell in the score mini table (founder 2026-10-08, superseding the 2026-10-02 suppressed-render rule)', async () => {
    // Find a real committed product whose api-quality group IS untested (and not an n/a arena),
    // so this pin exercises the untested-render path rather than passing vacuously.
    const hit = loadAll()
      .filter((d) => !(d.category.naDimensions ?? []).includes('apiQuality'))
      .flatMap((d) => d.products.map((p) => ({ d, p })))
      .find(({ d, p }) => isGroupUntested(d, p.id, 'api-quality'))
    expect(hit, 'corpus must contain at least one api-quality-untested product').toBeDefined()
    const { container } = render(
      await ProductPage({ params: Promise.resolve({ category: hit!.d.category.id, id: hit!.p.id }) }),
    )
    // The mini table's API cell says so out loud: the label with an italic 'untested' value
    // (unscored, not zero) — visible rather than hidden. The old chip wording stays retired.
    const apiCell = [...container.querySelectorAll('[title]')]
      .find((el) => (el.getAttribute('title') ?? '').includes('unscored, not zero') && el.textContent?.includes('API'))
    expect(apiCell, 'the untested API cell must render in the mini table').toBeDefined()
    expect(apiCell!.textContent).toContain('untested')
    expect(container.textContent).not.toContain('API untested')
  })

  it('theme rectangles carry no per-card tooltip (the section heading keeps its mark)', async () => {
    const { container } = await renderPage()
    expect(screen.getByText('By theme')).toBeTruthy()
    const cards = [...container.querySelectorAll('a[href="#story-verdicts"].group')]
    expect(cards.length).toBeGreaterThan(0)
    for (const card of cards) expect(card.getAttribute('title')).toBeNull()
  })

  it('the page-footer contest affordance is gone (founder 2026-10-08): no ⚑ Flag a verdict button, no ⚿ auth chip — row-level flag links stay', async () => {
    const { container } = await renderPage()
    expect(container.textContent).not.toContain('⚑ Flag a verdict')
    expect(container.textContent).not.toContain('auth-gated probe')
    expect(container.querySelector('a[href*="template=contest-verdict.md"]')).toBeNull()
    // The per-verdict row-level ⚑ flag affordances stay (ContestLink/RowMenu render inside
    // the client-side story table on expansion, so they are not assertable in this static
    // render; lib/__tests__/contestUrl.test.ts pins their URL builder) — only the footer
    // affordance is removed.
    // The old utility card grid stays gone — labels and links alike.
    for (const gone of ['For agents', 'This page as markdown', 'Evidence (JSON)', 'Verdicts (JSON)', 'Embed this product']) {
      expect(container.textContent).not.toContain(gone)
    }
    expect(container.querySelector(`a[href="/badges#${ID}"]`)).toBeNull()
  })

  it('the Opportunities and Coverage map sections are gone (founder 2026-10-08) — the derivations stay published in the per-product llms.md', async () => {
    const { container } = await renderPage()
    const headings = [...container.querySelectorAll('h2')].map((h) => h.textContent ?? '')
    expect(headings.some((h) => h.includes('Opportunities'))).toBe(false)
    expect(headings.some((h) => h.includes('Coverage map'))).toBe(false)
  })

  it('view-in-repo footer (founder 2026-10-08): the muted link opens this product\'s evidence file in the public data tree', async () => {
    await renderPage()
    const repo = screen.getByRole('link', { name: /View the evidence in the repo/ })
    expect(repo.getAttribute('href')).toBe(
      `https://github.com/ultrametricai/ultrametric/blob/main/data/${ARENA}/evidence/${ID}.json`,
    )
  })

  it('removed explainer sentences: integrations and score trend keep their content, lose the prose', async () => {
    const { container } = await renderPage()
    expect(container.textContent).not.toContain('Connections to other tracked products')
    expect(container.textContent).not.toContain('a point per change, not per day')
    expect(screen.getByText('Verified integrations')).toBeTruthy()
  })

  it('story-DAG experiment (founder 2026-10-02): theme → story map renders on the mercury page, verdict-tinted, nodes deep-linking to the table', async () => {
    const { container } = await renderPage()
    expect(screen.getByRole('heading', { name: /Story map \(experiment\)/ })).toBeTruthy()
    const section = container.querySelector('#story-map-experiment')!
    expect(section).not.toBeNull()
    // Every story node links to its judged #story-<id> row; every committed story is a node.
    const nodes = section.querySelectorAll('a[href^="#story-"]')
    expect(nodes.length).toBe(loadCategory(ARENA).stories.length)
    // Verdict tints per the founder spec: full emerald, partial amber, na dashed.
    expect(section.querySelector('a.border-emerald-400\\/50')).not.toBeNull()
    expect(section.querySelector('a.border-amber-400\\/40')).not.toBeNull()
    expect([...nodes].some((n) => n.className.includes('border-dashed'))).toBe(true)
    // Theme headers carry the honest delivered count — judged verdicts, never a new score.
    expect(section.textContent).toMatch(/\d+\/\d+ delivered/)
  })

  it('the story-DAG experiment is gated to mercury ONLY — no other product page renders it', async () => {
    // Same arena, different product: the experiment must not leak.
    const { container } = render(
      await ProductPage({ params: Promise.resolve({ category: ARENA, id: 'ramp' }) }),
    )
    expect(container.textContent).not.toContain('Story map (experiment)')
    expect(container.querySelector('#story-map-experiment')).toBeNull()
  })

  it('the header carries ONE Docs dropdown instead of separate doc chips (founder 2026-10-05)', async () => {
    const { container } = await renderPage()
    const trigger = screen.getByRole('button', { name: /Docs/ })
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    // The old inline chips are gone; the destinations now live inside the (closed) menu.
    expect(container.textContent).not.toContain('API docs ↗')
    expect(container.textContent).not.toContain('CLI docs ↗')
    expect(container.textContent).not.toContain('MCP docs ↗')
  })

  it('header CTA (founder 2026-10-07): "Test in Ultrametric" is the primary action for a product with committed recorded proofs (payments/stripe)', async () => {
    const { container } = render(
      await ProductPage({ params: Promise.resolve({ category: 'payments', id: 'stripe' }) }),
    )
    const cta = screen.getByRole('link', { name: /Test in Ultrametric/ })
    // Plain anchor into the sandbox section — SSR-static, no JS.
    expect(cta.getAttribute('href')).toBe('#try-it')
    // Primary emerald idiom: the one filled button in the header.
    expect(cta.className).toContain('bg-emerald-400')
    expect(cta.className).toContain('font-semibold')
    // The anchor resolves: the "Test it in sandbox" section renders on this page with that id.
    expect(container.querySelector('#try-it')).not.toBeNull()
    // No nested interactives inside the CTA.
    expect(cta.querySelectorAll('a, button, input, [role="button"]').length).toBe(0)
  })

  it('header CTA renders for a live-endpoint-only product too (startup-banking/mercury), anchor resolving', async () => {
    const { container } = await renderPage()
    expect(screen.getByRole('link', { name: /Test in Ultrametric/ }).getAttribute('href')).toBe('#try-it')
    expect(container.querySelector('#try-it')).not.toBeNull()
  })

  it('HONESTY GATE: no "Test in Ultrametric" CTA when the sandbox section renders nothing (accounting/quickbooks — docs-only MCP link, no proofs)', async () => {
    const { container } = render(
      await ProductPage({ params: Promise.resolve({ category: 'accounting', id: 'quickbooks' }) }),
    )
    expect(screen.queryByRole('link', { name: /Test in Ultrametric/ })).toBeNull()
    // The section itself is absent, so the CTA would have been dead — and the plain
    // external site link holds the header slot instead.
    expect(container.querySelector('#try-it')).toBeNull()
    expect(container.textContent).not.toContain('Test it in sandbox')
  })

  it('generateMetadata preserves the agent-discovery pointers as alternates (llms.md + data JSON)', async () => {
    const meta = await generateMetadata({ params })
    const types = meta.alternates?.types as Record<string, unknown>
    expect(types['text/markdown']).toBe(`https://ultrametric.ai/arena/${ARENA}/product/${ID}/llms.md`)
    const json = types['application/json'] as Array<{ url: string }>
    expect(json.map((j) => j.url)).toEqual([
      `https://ultrametric.ai/data/${ARENA}/evidence/${ID}.json`,
      `https://ultrametric.ai/data/${ARENA}/verdicts.json`,
    ])
  })
})
