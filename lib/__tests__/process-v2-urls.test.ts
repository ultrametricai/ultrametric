import { describe, expect, it } from 'vitest'
import { getRedirectUrl, unstable_getResponseFromNextConfig } from 'next/experimental/testing/server'
import config from '../../next.config'
import { buildPreviewRoutes, findSharedRecord, readSharedCatalog, sharedPreviewHref } from '../shared-processes/reader'
import { loadProcesses, processSlug } from '../processes'
import { buildAllSearchEntries } from '../search-entries'
import { buildPreviewIndex } from '../shared-processes/index-rows'
import { generateMetadata, default as V2Page } from '@/app/processes/[slug]/v2/page'
import { metadata as indexMetadata } from '@/app/processes/v2/page'
import { generateStaticParams as legacyParams } from '@/app/processes/[slug]/page'

const records = readSharedCatalog()
const slugs = buildPreviewRoutes(records)
const keys = new Map(records.flatMap(record => [record.id, ...(record.aliases ?? []), slugs.get(record.id)!].map(key => [key, record.id])))

async function configRedirect(path: string) {
  return unstable_getResponseFromNextConfig({ url: `https://ultrametric.ai${path}`, nextConfig: config })
}

describe('temporary shared-reader v2 URLs', () => {
  it('retains the existing record IDs and readable slugs without expanding legacy aliases', () => {
    expect(records).toHaveLength(173)
    expect(keys.size).toBe(322)
    expect(new Set(slugs.values()).size).toBe(records.length)
    for (const [key, id] of keys) expect(findSharedRecord(records, key)?.id).toBe(id)
    for (const record of records) expect(sharedPreviewHref(record.id, records)).toBe(`/processes/${slugs.get(record.id)}/v2`)
    for (const task of loadProcesses()) {
      expect(sharedPreviewHref(task.id, records)).toBe(`/processes/${processSlug(task.title)}/v2`)
      for (const alias of task.slugAliases ?? []) expect(findSharedRecord(records, alias.slug)).toBeUndefined()
    }
    expect(findSharedRecord(records, 'not-a-published-process')).toBeUndefined()
  })

  it('moves every existing preview key to its suffix path without intercepting ordinary routes', async () => {
    for (const [key] of keys) {
      const response = await configRedirect(`/processes/preview/${key}`)
      expect(response.status).toBe(308)
      expect(new URL(getRedirectUrl(response)!).pathname).toBe(`/processes/${key}/v2`)
    }
    const index = await configRedirect('/processes/preview?geo=GB&unknown=keep')
    expect(new URL(getRedirectUrl(index)!).pathname).toBe('/processes/v2')
    expect(new URL(getRedirectUrl(index)!).searchParams.get('unknown')).toBe('keep')
    for (const path of ['/processes', '/processes/v2', '/processes/incorporate-c-corp', '/processes/incorporate-a-company', '/processes/incorporate-c-corp/v2']) {
      expect(getRedirectUrl(await configRedirect(path))).toBeNull()
    }
    expect(legacyParams()).toEqual(loadProcesses().flatMap(task => [
      { slug: processSlug(task.title) }, ...(task.slugAliases ?? []).map(alias => ({ slug: alias.slug })),
    ]))
  })

  it('preserves query values when an old ID needs a second redirect to its readable suffix URL', async () => {
    const first = await configRedirect('/processes/preview/form_001?geo=IN&via=legal-ops:clerky&unknown=retain%2Bme')
    const destination = new URL(getRedirectUrl(first)!)
    expect(destination.pathname).toBe('/processes/form_001/v2')
    expect(destination.searchParams.get('geo')).toBe('IN')
    expect(destination.searchParams.get('via')).toBe('legal-ops:clerky')
    expect(destination.searchParams.get('unknown')).toBe('retain+me')
    expect(destination.hash).toBe('')
    // Next's experimental matcher flattens repeated values. Real HTTP/browser
    // checks exercise both hops; pin the page redirect's complete values here.
    const query = { via: ['legal-ops:clerky', 'payments:stripe'], geo: 'IN', unknown: ['a+b', 'x y'], empty: '', omitted: undefined }
    const expected = new URLSearchParams([
      ['via', 'legal-ops:clerky'], ['via', 'payments:stripe'], ['geo', 'IN'], ['unknown', 'a+b'], ['unknown', 'x y'], ['empty', ''],
    ])
    await expect(V2Page({ params: Promise.resolve({ slug: 'form_001' }), searchParams: Promise.resolve(query) }))
      .rejects.toMatchObject({ digest: `NEXT_REDIRECT;replace;/processes/incorporate-c-corp/v2?${expected};308;` })
  })

  it('renders all readable suffix pages and follows unknown preview keys to a 404', async () => {
    for (const record of records) {
      const page = await V2Page({ params: Promise.resolve({ slug: slugs.get(record.id)! }), searchParams: Promise.resolve({}) })
      expect(page.props.id).toBe(record.id)
      const metadata = await generateMetadata({ params: Promise.resolve({ slug: record.id }) })
      expect(metadata.alternates?.canonical).toBe(sharedPreviewHref(record.id, records))
      expect(metadata.robots).toEqual({ index: false, follow: false })
    }
    expect(indexMetadata.alternates?.canonical).toBe('/processes/v2')
    expect(indexMetadata.robots).toEqual({ index: false, follow: false })
    for (const key of ['not-a-published-process', 'incorporate-a-company']) {
      const response = await configRedirect(`/processes/preview/${key}`)
      expect(response.status).toBe(308)
      expect(new URL(getRedirectUrl(response)!).pathname).toBe(`/processes/${key}/v2`)
      await expect(V2Page({ params: Promise.resolve({ slug: key }), searchParams: Promise.resolve({}) }))
        .rejects.toMatchObject({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' })
    }
  })

  it('emits only suffix URLs in the shared index and keeps public search on ordinary routes', () => {
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
