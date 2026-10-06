import { describe, expect, it } from 'vitest'
import { getRedirectUrl, unstable_getResponseFromNextConfig } from 'next/experimental/testing/server'
import config from '../../next.config'
import { buildProcessRouteRegistry, sharedPreviewRedirects } from '../shared-processes/routes'
import { buildPreviewRoutes, findSharedRecord, readSharedCatalog, sharedPreviewHref } from '../shared-processes/reader'
import { withProcessSearchParams } from '../shared-processes/redirect-query'
import { loadProcesses, processSlug } from '../processes'
import { buildAllSearchEntries } from '../search-entries'
import { buildPreviewIndex } from '../shared-processes/index-rows'
import { generateMetadata, default as V2Page } from '@/app/processes/[slug]/v2/page'
import PreviewRedirect from '@/app/processes/preview/[id]/page'
import PreviewIndexRedirect from '@/app/processes/preview/page'
import { metadata as indexMetadata } from '@/app/processes/v2/page'
import { generateStaticParams as legacyParams } from '@/app/processes/[slug]/page'

const records = readSharedCatalog()
const registry = buildProcessRouteRegistry(records)
const redirects = sharedPreviewRedirects(records)
const bySource = new Map(redirects.map(redirect => [redirect.source, redirect]))

describe('interim shared-reader v2 URLs', () => {
  it('resolves every record, readable slug, source ID and legacy alias without changing identity', () => {
    expect(records).toHaveLength(172)
    expect(registry.byKey.size).toBe(376)
    expect(new Set(registry.slugs.values()).size).toBe(records.length)
    for (const [key, record] of registry.byKey) {
      expect(findSharedRecord(records, key)?.id).toBe(record.id)
      expect(sharedPreviewHref(key, records)).toBe(`/processes/${registry.slugs.get(record.id)}/v2`)
    }
    for (const task of loadProcesses()) {
      expect(sharedPreviewHref(task.id, records)).toBe(`/processes/${processSlug(task.title)}/v2`)
      for (const alias of task.slugAliases ?? []) expect(findSharedRecord(records, alias.slug)?.id).toBe(task.id)
    }
    expect(findSharedRecord(records, 'not-a-published-process')).toBeUndefined()
    expect(() => sharedPreviewHref('not-a-published-process', records)).toThrow('Unknown shared process route')
    const ambiguous = structuredClone(records.slice(0, 2))
    ambiguous[1].aliases = [ambiguous[0].id]
    expect(() => buildPreviewRoutes(ambiguous)).toThrow('Ambiguous process route')
  })

  it('redirects every old shared-reader URL directly, without redirect chains or ordinary-route interception', () => {
    expect(redirects).toHaveLength(581)
    expect(bySource.size).toBe(redirects.length)
    expect(bySource.get('/processes/preview')?.destination).toBe('/processes/v2')
    for (const [key, record] of registry.byKey) {
      const canonical = sharedPreviewHref(record.id, records)
      expect(bySource.get(`/processes/preview/${key}`)).toEqual({
        source: `/processes/preview/${key}`, destination: canonical, permanent: true,
      })
      if (key !== registry.slugs.get(record.id)) expect(bySource.get(`/processes/${key}/v2`)?.destination).toBe(canonical)
      expect(bySource.has(canonical)).toBe(false)
      expect(bySource.has(`/processes/${key}`)).toBe(false)
      expect(canonical).not.toMatch(/[?#]/)
    }
    expect(bySource.has('/processes/incorporate-c-corp/v2')).toBe(false)
    expect(bySource.has('/processes')).toBe(false)
    expect(bySource.has('/processes/v2')).toBe(false)
    expect(legacyParams()).toEqual(loadProcesses().flatMap(task => [
      { slug: processSlug(task.title) }, ...(task.slugAliases ?? []).map(alias => ({ slug: alias.slug })),
    ]))
  })

  it('uses Next redirect matching while leaving query parameters and fragments out of destinations', async () => {
    for (const source of ['/processes/preview/form_001', '/processes/preview/incorporate-c-corp', '/processes/incorporate-a-company/v2']) {
      const response = await unstable_getResponseFromNextConfig({
        url: `https://ultrametric.ai${source}?geo=IN&via=legal-ops:clerky&unknown=retain%2Bme`, nextConfig: config,
      })
      expect(response.status).toBe(308)
      const destination = new URL(getRedirectUrl(response)!)
      expect(destination.pathname).toBe('/processes/incorporate-c-corp/v2')
      expect(destination.searchParams.get('geo')).toBe('IN')
      expect(destination.searchParams.get('via')).toBe('legal-ops:clerky')
      expect(destination.searchParams.get('unknown')).toBe('retain+me')
      expect(destination.hash).toBe('')
    }
    // Next's experimental matcher flattens repeated values. The real HTTP check
    // requires both via and unknown values individually; this pins the page fallback.
    const query = { via: ['legal-ops:clerky', 'payments:stripe'], geo: 'IN', unknown: ['a+b', 'x y'], empty: '', omitted: undefined }
    const href = withProcessSearchParams('/processes/incorporate-c-corp/v2', query)
    expect([...new URL(href, 'https://ultrametric.ai').searchParams]).toEqual([
      ['via', 'legal-ops:clerky'], ['via', 'payments:stripe'], ['geo', 'IN'], ['unknown', 'a+b'], ['unknown', 'x y'], ['empty', ''],
    ])
    await expect(PreviewRedirect({ params: Promise.resolve({ id: 'form_001' }), searchParams: Promise.resolve(query) }))
      .rejects.toMatchObject({ digest: `NEXT_REDIRECT;replace;${href};308;` })
    await expect(V2Page({ params: Promise.resolve({ slug: 'incorporate-a-company' }), searchParams: Promise.resolve(query) }))
      .rejects.toMatchObject({ digest: `NEXT_REDIRECT;replace;${href};308;` })
    await expect(PreviewIndexRedirect({ searchParams: Promise.resolve(query) }))
      .rejects.toMatchObject({ digest: `NEXT_REDIRECT;replace;${withProcessSearchParams('/processes/v2', query)};308;` })
  })

  it('renders suffix pages for the entire catalog and rejects unknown keys in both URL formats', async () => {
    for (const record of records) {
      const page = await V2Page({ params: Promise.resolve({ slug: registry.slugs.get(record.id)! }), searchParams: Promise.resolve({}) })
      expect(page.props.id).toBe(record.id)
      const metadata = await generateMetadata({ params: Promise.resolve({ slug: record.id }) })
      expect(metadata.alternates?.canonical).toBe(sharedPreviewHref(record.id, records))
      expect(metadata.robots).toEqual({ index: false, follow: false })
    }
    expect(indexMetadata.alternates?.canonical).toBe('/processes/v2')
    expect(indexMetadata.robots).toEqual({ index: false, follow: false })
    await expect(V2Page({ params: Promise.resolve({ slug: 'not-a-published-process' }), searchParams: Promise.resolve({}) }))
      .rejects.toMatchObject({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' })
    await expect(PreviewRedirect({ params: Promise.resolve({ id: 'not-a-published-process' }), searchParams: Promise.resolve({}) }))
      .rejects.toMatchObject({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' })
  })

  it('emits only suffix URLs in the shared index and keeps the public command palette on ordinary routes', () => {
    const index = buildPreviewIndex()
    const rows = [...index.rows, ...index.playbooks]
    expect(rows).toHaveLength(records.length)
    for (const row of rows) expect(row.href).toMatch(/^\/processes\/[^/]+\/v2$/)
    const entries = buildAllSearchEntries()
    expect(entries.some(entry => entry.href.includes('/processes/preview'))).toBe(false)
    expect(entries.some(entry => entry.href === '/processes')).toBe(true)
    expect(entries.some(entry => entry.href === '/processes/incorporate-c-corp')).toBe(true)
    expect(entries.some(entry => /^\/processes\/.*\/v2$/.test(entry.href))).toBe(false)
  })
})
