// @vitest-environment jsdom
// The company-fields page family (founder 2026-10-08: "a page that explains the specification
// of data fields like an EIN"): /fields index + one page per registry field, rendered against
// the real committed registry. The load-bearing pins: the EIN page renders its sourced spec
// VERBATIM from processes/company-fields.json (every source URL present as a link), the index
// lists every field grouped by committed type, the establishing-artifact and consuming-module
// cross-links resolve to real page-family params, and the identifier fields render their
// computed requires-path processes.
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import FieldDetailPage from '@/app/fields/[id]/page'
import FieldsPage from '@/app/fields/page'
import sitemap from '@/app/sitemap'
import { loadBusinessLogicMap } from '@/lib/businessLogicMap'
import { companyFieldGroups, findFieldPage, loadCompanyFields, loadFieldPages } from '@/lib/companyFields'
import { loadArtifacts, loadProcesses, processSlug } from '@/lib/processes'
import { SITE_URL } from '@/lib/site'

const params = (id: string) => Promise.resolve({ id })

describe('/fields index', () => {
  it('lists every registry field linking its page, grouped by committed type', () => {
    const { container } = render(<FieldsPage />)
    for (const f of loadCompanyFields()) {
      expect(
        container.querySelector(`a[href="/fields/${f.id}"]`),
        `${f.id} must link its page`,
      ).not.toBeNull()
    }
    const headings = [...container.querySelectorAll('h2')].map((h) => h.textContent)
    expect(headings).toEqual(companyFieldGroups().map((g) => g.label))
    // Identifiers lead the index: the founder-named anchors are in the first group.
    expect(headings[0]).toBe('Identifiers')
  })

  it('every row cross-links a real artifact page, and module consumers link real module pages', () => {
    const { container } = render(<FieldsPage />)
    const artifactIds = new Set(loadArtifacts().map((a) => a.id))
    const map = loadBusinessLogicMap()
    for (const p of loadFieldPages()) {
      expect(artifactIds.has(p.artifact.id), p.field.id).toBe(true)
      expect(container.querySelector(`a[href="${p.artifact.href}"]`)).not.toBeNull()
      for (const c of p.consumers) {
        expect(map[c.moduleId], `${p.field.id}: ${c.moduleId}`).toBeDefined()
        expect(container.querySelector(`a[href="/open-modules/${c.moduleId}"]`)).not.toBeNull()
      }
    }
  })
})

describe('/fields/[id] — the EIN specification page (founder-named anchor)', () => {
  it('renders the sourced spec verbatim from the registry: format, pattern, documented example, authority, appearances, every source URL linked', async () => {
    const ein = loadCompanyFields().find((f) => f.id === 'ein')!
    const { container } = render(await FieldDetailPage({ params: params('ein') }))
    const text = container.textContent!
    expect(text).toContain(ein.label)
    expect(text).toContain(ein.spec.format)
    expect(text).toContain(ein.spec.pattern!)
    expect(text).toContain(ein.spec.example!)
    expect(text).toContain(ein.spec.authority)
    for (const w of ein.spec.whereItAppears) expect(text).toContain(w)
    for (const s of ein.spec.sources) {
      const link = container.querySelector(`a[href="${s.url}"]`)
      expect(link, `source ${s.url} must render as a link`).not.toBeNull()
      expect(link!.textContent).toContain(s.label)
    }
    // The documented mask instantiation and the IRS's own example both satisfy the pattern.
    const re = new RegExp(ein.spec.pattern!)
    expect(re.test('00-0000000')).toBe(true)
    expect(re.test(ein.spec.example!)).toBe(true)
  })

  it('EIN consumes through the artifact: the requires-path processes render, computed from the corpus, each linked', async () => {
    const page = findFieldPage('ein')!
    expect(page.consumers).toEqual([])
    const expected = loadProcesses().filter((t) => t.requires.includes('ein'))
    expect(page.requiringProcesses.map((p) => p.id)).toEqual(expected.map((t) => t.id))
    const { container } = render(await FieldDetailPage({ params: params('ein') }))
    expect(container.textContent).toContain('Processes that require it')
    for (const t of expected) {
      expect(
        container.querySelector(`a[href="/processes/${processSlug(t.title)}"]`),
        `${t.id} must link its process page`,
      ).not.toBeNull()
    }
    // The establishing artifact links its page.
    expect(container.querySelector('a[href="/artifacts/ein"]')).not.toBeNull()
  })
})

describe('/fields/[id] — the module-consumed fields', () => {
  it('a consumedBy field renders its module links instead of the requires-path section', async () => {
    const page = findFieldPage('incorporation-date')!
    expect(page.consumers.length).toBeGreaterThan(0)
    const { container } = render(await FieldDetailPage({ params: params('incorporation-date') }))
    expect(container.textContent).toContain('Consumed by open modules')
    expect(container.textContent).not.toContain('Processes that require it')
    for (const c of page.consumers) {
      const link = container.querySelector(`a[href="${c.href}"]`)
      expect(link, `${c.moduleId} must link its module page`).not.toBeNull()
      expect(container.textContent).toContain(c.functions[0])
    }
    expect(container.querySelector('a[href="/artifacts/certificate-of-incorporation"]')).not.toBeNull()
  })

  it('every field page renders its whole spec and the registry source link', async () => {
    for (const p of loadFieldPages()) {
      const { container } = render(await FieldDetailPage({ params: params(p.field.id) }))
      const text = container.textContent!
      expect(text, p.field.id).toContain(p.field.spec.format)
      expect(text, p.field.id).toContain(p.field.spec.authority)
      for (const s of p.field.spec.sources) {
        expect(
          container.querySelector(`a[href="${s.url}"]`),
          `${p.field.id}: ${s.url}`,
        ).not.toBeNull()
      }
      expect(
        container.querySelector(
          'a[href="https://github.com/ultrametricai/ultrametric/blob/main/processes/company-fields.json"]',
        ),
        p.field.id,
      ).not.toBeNull()
    }
  })
})

describe('sitemap registration — fields family', () => {
  it('lists the index and one URL per registry field', () => {
    const urls = new Set(sitemap().map((e) => e.url))
    expect(urls.has(`${SITE_URL}/fields`)).toBe(true)
    for (const f of loadCompanyFields()) {
      expect(urls.has(`${SITE_URL}/fields/${f.id}`), f.id).toBe(true)
    }
  })
})
