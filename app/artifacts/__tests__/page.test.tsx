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
import { fieldsEstablishedBy } from '@/lib/companyFields'
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

  it('the registered-document mapping landed (the deliberate flip of the 2026-10-05 absence pin): `documents` joins the registry fields and resolves through lib', () => {
    // The 2026-10-05 lane pinned the field's ABSENCE as a candidate follow-up; the founder named
    // it on 2026-10-06 ("pages for classic document objects … to track that"), so the pin flips:
    // the field exists, stays sparse (referential integrity + honest-absence bands in
    // lib/__tests__/processArtifacts.test.ts), and resolves to real registry records here.
    for (const a of loadArtifacts()) {
      expect(Object.keys(a).every((k) =>
        ['id', 'label', 'description', 'producedBy', 'alsoProducedBy', 'terminal', 'documents', 'geo'].includes(k),
      ), a.id).toBe(true)
    }
    const page = findArtifactPage('83b-election')!
    expect(page.documents.map((d) => d.id)).toEqual(['irs-form-15620'])
    expect(page.documents[0].publisher).toBe('Internal Revenue Service')
    // Unmapped artifacts resolve to the honest empty list, never an invention.
    expect(findArtifactPage('domain')!.documents).toEqual([])
  })

  it('a mapped artifact renders the Document section: the registry record linked at its canonical publisher URL, with publisher + license note', async () => {
    const { container } = render(await ArtifactDetailPage({ params: params('83b-election') }))
    const doc = findArtifactPage('83b-election')!.documents[0]
    const link = container.querySelector(`a[href="${doc.url}"]`)
    expect(link, 'template must link its canonical publisher URL').not.toBeNull()
    expect(link!.textContent).toContain(doc.name)
    expect(container.textContent).toContain(doc.publisher)
    expect(container.textContent).toContain(doc.license_note)
  })

  it('every rendered template link is the registry record’s canonical publisher URL (the open-documents deep-link rule)', async () => {
    const page = loadArtifactPages().find((p) => p.documents.length > 1)!
    const { container } = render(await ArtifactDetailPage({ params: params(page.artifact.id) }))
    for (const doc of page.documents) {
      expect(
        container.querySelector(`a[href="${doc.url}"]`),
        `${doc.id} must link ${doc.url}`,
      ).not.toBeNull()
    }
  })

  it('mapped documents sharing a registry family render as one object with variants — the SAFE note: cap · discount · MFN · international', async () => {
    const page = findArtifactPage('executed-safes')!
    expect(page.documentFamilies.map((g) => g.family)).toEqual(['yc-safe'])
    // The variant labels are the registry's committed `variant` fields, in mapping order
    // (cross-link audit 2026-10-07: the pro rata side letter completes the executed yc-safe set).
    expect(page.documentFamilies[0].docs.map((d) => d.variant)).toEqual([
      'cap', 'discount', 'MFN', 'international', 'pro rata side letter',
    ])
    const { container } = render(await ArtifactDetailPage({ params: params('executed-safes') }))
    expect(container.textContent).toContain('Variants:')
    for (const d of page.documentFamilies[0].docs) {
      const links = [...container.querySelectorAll(`a[href="${d.url}"]`)]
      expect(links.some((a) => a.textContent === d.variant), `${d.id} must link its variant label`).toBe(true)
    }
    // A single-template page has no family group and no Variants line.
    expect(findArtifactPage('83b-election')!.documentFamilies).toEqual([])
    const single = render(await ArtifactDetailPage({ params: params('83b-election') }))
    expect(single.container.textContent).not.toContain('Variants:')
  })

  it('an unmapped artifact renders no Document section — honest absence, nothing invented', async () => {
    expect(findArtifactPage('domain')!.documents).toEqual([])
    const { container } = render(await ArtifactDetailPage({ params: params('domain') }))
    expect([...container.querySelectorAll('h2')].map((h) => h.textContent)).not.toContain('Document')
  })

  it('links the birth step (the canonical producer page #step anchor) and the registry source file in the repo', async () => {
    // Cross-link audit 2026-10-07: every artifact's bornAt resolves to the canonical producer's
    // tagged node — the reverse of the process page's Born-at column.
    const tasks = new Map(loadProcesses().map((t) => [t.id, t]))
    for (const page of loadArtifactPages()) {
      const producer = tasks.get(page.artifact.producedBy)!
      const node = producer.dag.nodes.find((n) => n.producesArtifact === page.artifact.id)!
      expect(page.bornAt.label).toBe(node.label)
      expect(page.bornAt.href).toBe(
        `/processes/${processSlug(producer.title)}#step-${producer.id}-${node.id}`,
      )
    }
    const { container } = render(await ArtifactDetailPage({ params: params('83b-election') }))
    const born = findArtifactPage('83b-election')!.bornAt
    const bornLink = container.querySelector(`a[href="${born.href}"]`)
    expect(bornLink, 'the Born at link must render').not.toBeNull()
    expect(bornLink!.textContent).toContain(born.label)
    // View-in-repo (founder 2026-10-07): the registry source file, honestly titled — JSON
    // carries no per-entry anchor, so the link opens the whole file.
    const repo = container.querySelector(
      'a[href="https://github.com/ultrametricai/ultrametric/blob/main/processes/artifacts.json"]',
    )
    expect(repo, 'the registry source link must render').not.toBeNull()
    expect(repo!.getAttribute('title')).toContain('processes/artifacts.json')
  })
})

// The artifact GEO section (founder geo-coverage ask 2026-10-07): committed per-country
// analogs render as "Outside the US" through components/ArtifactGeoNotes.tsx — the process
// pages' geo idiom, driven by the one shared geo store (no control of its own on this page;
// the /artifacts dropdown lands from another lane). jsdom renders the US-default view: the
// store is null until a switcher writes it, so the full per-country block is the static HTML.
describe('/artifacts/[id] — per-country geo analogs', () => {
  it('a US-centric artifact renders its committed entries: country, analog label, kind, committed URL', async () => {
    const artifact = loadArtifacts().find((a) => a.id === 'ein')!
    expect(artifact.geo!.length).toBeGreaterThanOrEqual(6)
    const { container } = render(await ArtifactDetailPage({ params: params('ein') }))
    expect(container.textContent).toContain('Outside the US')
    const uk = artifact.geo!.find((g) => g.country === 'UK')!
    expect(container.textContent).toContain(uk.label)
    expect(container.textContent).toContain(uk.summary)
    for (const g of artifact.geo!) {
      expect(
        container.querySelector(`a[href="${g.actionUrl}"]`),
        `${g.country} must link its committed official page`,
      ).not.toBeNull()
    }
  })

  it('an artifact with no committed geo renders no section — honest absence', async () => {
    expect(loadArtifacts().find((a) => a.id === 'team-chat')!.geo).toBeUndefined()
    const { container } = render(await ArtifactDetailPage({ params: params('team-chat') }))
    expect(container.textContent).not.toContain('Outside the US')
  })
})

// The Data fields section (founder 2026-10-07: typed company data fields): the
// processes/company-fields.json fields THIS artifact establishes, each consumer linking its
// /open-modules page. Registry totality lives in lib/__tests__/companyFields.test.ts; this
// pins the render.
describe('/artifacts/[id] — data fields', () => {
  it('the charter page lists the fields it establishes with their consuming modules linked', async () => {
    const rows = fieldsEstablishedBy('certificate-of-incorporation')
    expect(rows.map((r) => r.field.id)).toContain('incorporation-date')
    const { container } = render(
      await ArtifactDetailPage({ params: params('certificate-of-incorporation') }),
    )
    expect(container.textContent).toContain('Data fields')
    for (const r of rows) {
      expect(container.textContent).toContain(r.field.label)
      expect(container.textContent).toContain(r.field.type)
      for (const c of r.consumers) {
        expect(
          container.querySelector(`a[href="/open-modules/${c.moduleId}"]`),
          `${r.field.id}: consumer ${c.moduleId} must link its module page`,
        ).not.toBeNull()
      }
    }
  })

  it('an artifact that establishes no field renders no section', async () => {
    expect(fieldsEstablishedBy('team-chat')).toEqual([])
    const { container } = render(await ArtifactDetailPage({ params: params('team-chat') }))
    expect([...container.querySelectorAll('h2')].map((h) => h.textContent)).not.toContain('Data fields')
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
