import { describe, expect, it } from 'vitest'
import type { Evidence, Product } from '@/lib/schemas'
import {
  buildProbeEvidenceRows, mergeProbeEvidence, runProbeChecks,
  type ProbeFetchResult, type ProbeFetcher, type ProbeResult,
} from '@/pipeline/stages/probe'

const baseProduct: Product = {
  id: 'acme',
  name: 'Acme',
  vendor: 'Acme Inc',
  type: 'commercial',
  urls: { site: 'https://acme.example', docs: 'https://docs.acme.example/overview' },
}

// Builds a fetcher backed by a lookup table so each test declares exactly the URLs it cares
// about; anything not listed 404s (a safe, unsurprising default for the ambiguity tests).
function fakeFetcher(table: Record<string, ProbeFetchResult>): ProbeFetcher {
  return async (url) => table[url] ?? { status: 404, contentType: null, text: '' }
}

const txt = (text: string): ProbeFetchResult => ({ status: 200, contentType: 'text/plain; charset=utf-8', text })
const notFound: ProbeFetchResult = { status: 404, contentType: null, text: '' }
const openapiDoc = (): ProbeFetchResult => ({
  status: 200,
  contentType: 'application/json',
  text: JSON.stringify({ openapi: '3.0.0', info: { title: 'Acme API' } }),
})

describe('runProbeChecks', () => {
  it('llms-txt: positive when the origin serves a 200 text/plain-ish llms.txt', async () => {
    const fetcher = fakeFetcher({
      'https://docs.acme.example/llms.txt': txt('# Acme\n\nAcme is a thing that does stuff for developers.'),
    })
    const results = await runProbeChecks(baseProduct, fetcher)
    const llms = results.find((r) => r.key === 'llms-txt')
    expect(llms).toBeTruthy()
    expect(llms?.positive).toBe(true)
    expect(llms?.url).toBe('https://docs.acme.example/llms.txt')
    expect(llms?.excerpt).toContain('PROBE llms.txt: HTTP 200')
    expect(llms?.excerpt).toContain('Acme is a thing')
  })

  it('llms-txt: negative on a clean 404', async () => {
    const fetcher = fakeFetcher({ 'https://docs.acme.example/llms.txt': notFound })
    const results = await runProbeChecks(baseProduct, fetcher)
    const llms = results.find((r) => r.key === 'llms-txt')
    expect(llms?.positive).toBe(false)
    expect(llms?.excerpt).toBe('PROBE llms.txt: HTTP 404 at https://docs.acme.example/llms.txt')
  })

  it('llms-txt: no item at all for an ambiguous (non-200/404) response', async () => {
    const fetcher = fakeFetcher({ 'https://docs.acme.example/llms.txt': { status: 403, contentType: null, text: '' } })
    const results = await runProbeChecks(baseProduct, fetcher)
    expect(results.find((r) => r.key === 'llms-txt')).toBeUndefined()
  })

  it('llms-txt + openapi: skipped entirely at a shared code-host origin (github.com is not the product)', async () => {
    const repoProduct: Product = {
      ...baseProduct,
      urls: { site: 'https://github.com/acme/acme' },
    }
    const fetcher = fakeFetcher({
      'https://github.com/llms.txt': txt('# GitHub\n\nGitHub is a developer platform.'),
      'https://github.com/openapi.json': openapiDoc(),
    })
    const results = await runProbeChecks(repoProduct, fetcher)
    expect(results.find((r) => r.key === 'llms-txt')).toBeUndefined()
    expect(results.find((r) => r.key === 'openapi')).toBeUndefined()
  })

  it('llms-txt: no item when the fetcher throws (network error)', async () => {
    const fetcher: ProbeFetcher = async (url) => {
      if (url === 'https://docs.acme.example/llms.txt') throw new Error('ECONNRESET')
      return notFound
    }
    const results = await runProbeChecks(baseProduct, fetcher)
    expect(results.find((r) => r.key === 'llms-txt')).toBeUndefined()
  })

  it('docs-md: only runs when the product has a docs URL, and is positive on a 200 markdown response', async () => {
    const fetcher = fakeFetcher({
      'https://docs.acme.example/overview.md': txt('# Overview\n\nAcme docs in markdown.'),
      'https://docs.acme.example/llms.txt': notFound,
    })
    const results = await runProbeChecks(baseProduct, fetcher)
    const docsMd = results.find((r) => r.key === 'docs-md')
    expect(docsMd?.positive).toBe(true)
    expect(docsMd?.url).toBe('https://docs.acme.example/overview.md')
  })

  it('docs-md: is skipped entirely when the product has no docs URL', async () => {
    const noDocs: Product = { ...baseProduct, urls: { site: baseProduct.urls.site } }
    const fetcher = fakeFetcher({})
    const results = await runProbeChecks(noDocs, fetcher)
    expect(results.find((r) => r.key === 'docs-md')).toBeUndefined()
  })

  it('openapi: positive on the first candidate path that returns JSON with an "openapi" key', async () => {
    const fetcher = fakeFetcher({
      'https://docs.acme.example/llms.txt': notFound,
      'https://docs.acme.example/openapi.json': openapiDoc(),
    })
    const results = await runProbeChecks(baseProduct, fetcher)
    const openapi = results.find((r) => r.key === 'openapi')
    expect(openapi?.positive).toBe(true)
    expect(openapi?.url).toBe('https://docs.acme.example/openapi.json')
  })

  it('openapi: negative only when every candidate path 404s', async () => {
    const fetcher = fakeFetcher({ 'https://docs.acme.example/llms.txt': notFound })
    const results = await runProbeChecks(baseProduct, fetcher)
    const openapi = results.find((r) => r.key === 'openapi')
    expect(openapi?.positive).toBe(false)
    expect(openapi?.excerpt).toContain('all candidate paths 404')
  })

  it('openapi: no item when a candidate path is ambiguous (e.g. 500) and none is positive', async () => {
    const fetcher: ProbeFetcher = async (url) => {
      if (url === 'https://docs.acme.example/openapi.json') return { status: 500, contentType: null, text: '' }
      return notFound
    }
    const results = await runProbeChecks(baseProduct, fetcher)
    expect(results.find((r) => r.key === 'openapi')).toBeUndefined()
  })

  it('mcp-link: positive when links.mcp resolves 200, absent when links.mcp is unset', async () => {
    const withMcp: Product = { ...baseProduct, links: { mcp: 'https://acme.example/mcp' } }
    const fetcher = fakeFetcher({
      'https://docs.acme.example/llms.txt': notFound,
      'https://acme.example/mcp': { status: 200, contentType: 'text/html', text: '<html/>' },
    })
    const withResults = await runProbeChecks(withMcp, fetcher)
    const mcp = withResults.find((r) => r.key === 'mcp-link')
    expect(mcp?.positive).toBe(true)
    expect(mcp?.excerpt).toBe('official MCP server documented at https://acme.example/mcp')

    const withoutResults = await runProbeChecks(baseProduct, fetcher)
    expect(withoutResults.find((r) => r.key === 'mcp-link')).toBeUndefined()
  })

  it('cli-link: negative on a 404 for a stale curated link', async () => {
    const withCli: Product = { ...baseProduct, links: { cli: 'https://acme.example/cli' } }
    const fetcher = fakeFetcher({ 'https://docs.acme.example/llms.txt': notFound, 'https://acme.example/cli': notFound })
    const results = await runProbeChecks(withCli, fetcher)
    const cli = results.find((r) => r.key === 'cli-link')
    expect(cli?.positive).toBe(false)
    expect(cli?.excerpt).toContain('HTTP 404')
  })
})

const row = (id: string, tier: Evidence['tier'], extra: Partial<Evidence> = {}): Evidence => ({
  id, tier, url: 'https://acme.example/x', excerpt: `excerpt for ${id}`,
  fetchedAt: '2026-10-01T00:00:00.000Z', ...extra,
})

describe('mergeProbeEvidence', () => {
  const docs = row('acme-docs-1', 'claimed-docs')
  const counterCheck = row('acme-audit-20261014-1', 'probe', {
    excerpt: 'PROBE audit counter-check: documented endpoint 404s', preserve: true,
  })
  const staleProbe = row('acme-probe-1', 'probe')
  const freshProbes = [
    row('acme-probe-1', 'probe', { fetchedAt: '2026-10-14T00:00:00.000Z' }),
    row('acme-probe-2', 'probe', { fetchedAt: '2026-10-14T00:00:00.000Z' }),
  ]

  it('a preserved row survives a rerun that replaces everything else probe-tier', () => {
    const merged = mergeProbeEvidence([docs, staleProbe, counterCheck], freshProbes)
    expect(merged).toContainEqual(counterCheck) // recorded counter-evidence intact, byte for byte
    expect(merged).toContainEqual(docs) // non-probe tiers untouched
    expect(merged.filter((e) => e.tier === 'probe')).toHaveLength(3) // 2 fresh + 1 preserved
    expect(merged.find((e) => e.id === 'acme-probe-1')?.fetchedAt).toBe('2026-10-14T00:00:00.000Z')
  })

  it('unmarked probe rows still refresh normally (wholesale replacement)', () => {
    const merged = mergeProbeEvidence([docs, staleProbe], freshProbes)
    expect(merged).toEqual([docs, ...freshProbes])
  })

  it('a rerun with zero fresh rows still keeps the preserved row', () => {
    const merged = mergeProbeEvidence([counterCheck, staleProbe], [])
    expect(merged).toEqual([counterCheck])
  })

  it('a fresh row whose id collides with a preserved row is dropped, not duplicated', () => {
    const preservedWithProbeId = row('acme-probe-1', 'probe', { preserve: true })
    const merged = mergeProbeEvidence([preservedWithProbeId], freshProbes)
    expect(merged.filter((e) => e.id === 'acme-probe-1')).toEqual([preservedWithProbeId])
    expect(merged.map((e) => e.id).sort()).toEqual(['acme-probe-1', 'acme-probe-2'])
  })
})

describe('buildProbeEvidenceRows', () => {
  const results: ProbeResult[] = [
    { key: 'llms-txt', url: 'https://acme.example/llms.txt', positive: true, excerpt: 'PROBE llms.txt: HTTP 200' },
    { key: 'openapi', url: 'https://acme.example/openapi.json', positive: false, excerpt: 'PROBE openapi: all candidate paths 404' },
  ]

  it('numbers fresh ids sequentially when nothing is preserved', () => {
    const rows = buildProbeEvidenceRows('acme', results, new Set(), '2026-10-14T00:00:00.000Z')
    expect(rows.map((r) => r.id)).toEqual(['acme-probe-1', 'acme-probe-2'])
    expect(rows.every((r) => r.tier === 'probe')).toBe(true)
  })

  it('skips numbers held by preserved rows so a refresh cannot mint a colliding id', () => {
    const rows = buildProbeEvidenceRows('acme', results, new Set(['acme-probe-1', 'acme-probe-3']), '2026-10-14T00:00:00.000Z')
    expect(rows.map((r) => r.id)).toEqual(['acme-probe-2', 'acme-probe-4'])
  })
})
