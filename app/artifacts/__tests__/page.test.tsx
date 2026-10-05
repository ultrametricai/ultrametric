// @vitest-environment jsdom
// The artifact page family (founder 2026-10-05): /artifacts index + one page per registry
// artifact (processes/artifacts.json), rendered against the real committed corpus. The
// load-bearing pins: a page's needed-by list is exactly the consumer side of the
// lib/processDeps.ts dependency graph, its vendor lists are computed from the producing steps'
// covering arenas' committed leaderboards (never hand-picked), and artifacts whose producing
// step has no judged market keep the honest empty state.
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ArtifactDetailPage from '@/app/artifacts/[id]/page'
import ArtifactsPage from '@/app/artifacts/page'
import sitemap from '@/app/sitemap'
import { ARENA_LEADERS_CAP } from '@/lib/arenaLeaders'
import { artifactsByProducingArea, findArtifactPage, loadArtifactPages } from '@/lib/artifactPages'
import { loadCategory } from '@/lib/data'
import { processDepEdges } from '@/lib/processDeps'
import { loadArtifacts, loadProcesses, processSlug } from '@/lib/processes'
import { isShutdown } from '@/lib/shutdown'
import { SITE_URL } from '@/lib/site'

const params = (id: string) => Promise.resolve({ id })

describe('/artifacts index', () => {
  it('lists every registry artifact linking its page, grouped by the producing area', () => {
    const { container } = render(<ArtifactsPage />)
    for (const a of loadArtifacts()) {
      expect(
        container.querySelector(`a[href="/artifacts/${a.id}"]`),
        `${a.id} must link its page`,
      ).not.toBeNull()
    }
    const headings = [...container.querySelectorAll('h2')].map((h) => h.textContent)
    expect(headings).toEqual(artifactsByProducingArea().map((g) => g.area))
    // Linked docs for the dependency-graph layer.
    expect(container.querySelector('a[href*="processes/README.md#the-artifact-layer"]')).not.toBeNull()
    expect(container.querySelector('a[href*="docs/TIMELINE-INVERSIONS.md"]')).not.toBeNull()
  })
})

describe('/artifacts/[id] — producers, consumers, computed vendors', () => {
  it('certificate-of-incorporation: the needed-by list is exactly the processDeps consumer edges, each linked', async () => {
    const id = 'certificate-of-incorporation'
    const page = findArtifactPage(id)!
    const consumers = processDepEdges().filter((e) => e.artifactId === id).map((e) => e.to)
    expect(consumers.length).toBeGreaterThan(0)
    expect(page.neededBy.map((p) => p.id)).toEqual(consumers)

    const { container } = render(await ArtifactDetailPage({ params: params(id) }))
    const tasks = new Map(loadProcesses().map((t) => [t.id, t]))
    for (const cid of consumers) {
      const slug = processSlug(tasks.get(cid)!.title)
      expect(
        container.querySelector(`a[href="/processes/${slug}"]`),
        `${cid} must be linked as a consumer`,
      ).not.toBeNull()
    }
    // Canonical producer + the documented exception producer (form_012, the LLC→C-Corp
    // conversion) both render as links.
    expect(page.producer.id).toBe('form_001')
    expect(page.exceptionProducers.map((p) => p.id)).toEqual(['form_012'])
    expect(container.querySelector(`a[href="${page.producer.href}"]`)).not.toBeNull()
    expect(container.querySelector(`a[href="${page.exceptionProducers[0].href}"]`)).not.toBeNull()
    expect(container.textContent).toContain('Also produced by:')
  })

  it('certificate-of-incorporation: the producing step has no judged covering market — the honest empty state, zero arena links', async () => {
    const page = findArtifactPage('certificate-of-incorporation')!
    expect(page.arenas).toEqual([])
    const { container } = render(await ArtifactDetailPage({ params: params('certificate-of-incorporation') }))
    expect(container.textContent).toContain('No populated arena covers the producing step')
    expect(container.querySelectorAll('a[href^="/arena/"]')).toHaveLength(0)
  })

  it('a terminal artifact renders the leaves-the-graph state instead of a consumer list', async () => {
    const terminal = loadArtifacts().find((a) => a.terminal)!
    const page = findArtifactPage(terminal.id)!
    expect(page.neededBy).toEqual([])
    const { container } = render(await ArtifactDetailPage({ params: params(terminal.id) }))
    expect(container.textContent).toContain('leaves the dependency graph here')
  })

  it("an artifact with a judged producing market lists exactly its arenas' committed leaderboard leaders, in committed order", async () => {
    const page = loadArtifactPages().find((p) => p.arenas.length > 0)!
    expect(page, 'at least one artifact must derive a populated market').toBeDefined()
    const { container } = render(await ArtifactDetailPage({ params: params(page.artifact.id) }))
    for (const arena of page.arenas) {
      const data = loadCategory(arena.arenaId)
      const expected = data.rankings.leaderboard
        .filter((e) => {
          const product = data.products.find((p) => p.id === e.productId)
          return product !== undefined && !isShutdown(product)
        })
        .slice(0, ARENA_LEADERS_CAP)
        .map((e) => e.productId)
      expect(arena.leaders.map((l) => l.productId), arena.arenaId).toEqual(expected)
      const hrefs = [...container.querySelectorAll(`a[href^="/arena/${arena.arenaId}/product/"]`)]
        .map((a) => a.getAttribute('href'))
      expect(hrefs).toEqual(expected.map((pid) => `/arena/${arena.arenaId}/product/${pid}`))
    }
  })

  it('no registered-document link renders — the registry has no artifact→open-documents mapping field (candidate follow-up, never invented)', async () => {
    for (const a of loadArtifacts()) {
      expect(Object.keys(a).every((k) =>
        ['id', 'label', 'description', 'producedBy', 'alsoProducedBy', 'terminal'].includes(k),
      ), a.id).toBe(true)
    }
    const { container } = render(await ArtifactDetailPage({ params: params('certificate-of-incorporation') }))
    expect(container.querySelector('a[href^="/open-documents"]')).toBeNull()
  })
})

describe('sitemap registration — artifacts family', () => {
  it('lists the index and one URL per registry artifact', () => {
    const urls = new Set(sitemap().map((e) => e.url))
    expect(urls.has(`${SITE_URL}/artifacts`)).toBe(true)
    for (const a of loadArtifacts()) {
      expect(urls.has(`${SITE_URL}/artifacts/${a.id}`), a.id).toBe(true)
    }
  })
})
