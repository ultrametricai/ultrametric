// Routing tests for the retired-landing cutover (founder 2026-09-29: the landing pages moved
// into the product app; one top bar sitewide). The worker now serves '/' from the product
// origin's /home, treats /company and /tos as ordinary product routes, and 301s the old
// Astro-only paths (/afk, /process/*). Same injection pattern as the other worker tests:
// no network — the origin fetch is stubbed per test.
import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from '../worker.js'

const ORIGIN = 'https://ultrametric.vercel.app'

function stubOriginFetch(body = 'ok') {
  const calls: string[] = []
  vi.stubGlobal('fetch', async (input: URL | RequestInfo) => {
    calls.push(String(input instanceof Request ? input.url : input))
    return new Response(body, { status: 200, headers: { 'content-type': 'text/html' } })
  })
  return calls
}

function get(path: string) {
  return worker.fetch(new Request(`https://ultrametric.ai${path}`), {}, undefined)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('landing cutover routing', () => {
  it("serves '/' from the product origin's /home (pathname rewrite, no redirect)", async () => {
    const calls = stubOriginFetch()
    const resp = await get('/')
    expect(resp.status).toBe(200)
    expect(calls).toEqual([`${ORIGIN}/home`])
  })

  it('proxies /company and /tos to the product origin as ordinary routes', async () => {
    for (const path of ['/company', '/tos']) {
      const calls = stubOriginFetch()
      const resp = await get(path)
      expect(resp.status).toBe(200)
      expect(calls).toEqual([`${ORIGIN}${path}`])
      vi.unstubAllGlobals()
    }
  })

  it('still serves /overall from the product origin root', async () => {
    const calls = stubOriginFetch()
    const resp = await get('/overall')
    expect(resp.status).toBe(200)
    expect(calls).toEqual([`${ORIGIN}/`])
  })

  it('301s /afk and /afk/* to /company', async () => {
    for (const path of ['/afk', '/afk/waitlist']) {
      const resp = await get(path)
      expect(resp.status).toBe(301)
      expect(resp.headers.get('location')).toBe('https://ultrametric.ai/company')
    }
  })

  it('301s the /process index to the /processes corpus index', async () => {
    for (const path of ['/process', '/process/']) {
      const resp = await get(path)
      expect(resp.status).toBe(301)
      expect(resp.headers.get('location')).toBe('https://ultrametric.ai/processes')
    }
  })

  it('301s matching /process/<slug> guides to their /processes/<slug> equivalent', async () => {
    const resp = await get('/process/run-payroll')
    expect(resp.status).toBe(301)
    expect(resp.headers.get('location')).toBe('https://ultrametric.ai/processes/run-payroll')
  })

  it('applies the per-slug renames where the corpus slug differs', async () => {
    for (const [from, to] of [
      ['close-the-books', 'bookkeeping-close'],
      ['get-an-ein', 'get-ein'],
      ['incorporate-a-delaware-c-corp', 'incorporate-c-corp'],
      ['generate-a-company-website', 'generate-a-website'],
    ]) {
      const resp = await get(`/process/${from}`)
      expect(resp.status).toBe(301)
      expect(resp.headers.get('location')).toBe(`https://ultrametric.ai/processes/${to}`)
    }
  })

  it('sends AFK-app-specific guides with no corpus equivalent to the corpus index', async () => {
    for (const slug of ['list-my-tasks', 'summarize-my-company', 'extract-ultrametric-context', 'list-capabilities']) {
      const resp = await get(`/process/${slug}`)
      expect(resp.status).toBe(301)
      expect(resp.headers.get('location')).toBe('https://ultrametric.ai/processes')
    }
  })

  it('serves /productarena/data/* directly from the origin /data/* (no redirect)', async () => {
    // The shipped ultrametric CLI (≤0.4.1) fetches these URLs with redirect:'error', so a 301
    // fails every `arena` command with NETWORK_ERROR — the legacy data path must answer 200.
    for (const [legacy, originPath] of [
      ['/productarena/data/categories.json', '/data/categories.json'],
      ['/productarena/data/domain-registrars/rankings.json', '/data/domain-registrars/rankings.json'],
      ['/productarena/data/domain-registrars/stories.json?x=1', '/data/domain-registrars/stories.json?x=1'],
    ]) {
      const calls = stubOriginFetch('[]')
      const resp = await get(legacy)
      expect(resp.status).toBe(200)
      expect(calls).toEqual([`${ORIGIN}${originPath}`])
      vi.unstubAllGlobals()
    }
  })

  it('still 301s non-data legacy /productarena/* paths without the prefix', async () => {
    const resp = await get('/productarena/overall')
    expect(resp.status).toBe(301)
    expect(resp.headers.get('location')).toBe('https://ultrametric.ai/overall')
    // /productarena/database (or any non-/data/ prefix sharing the first characters) still 301s.
    const lookalike = await get('/productarena/database')
    expect(lookalike.status).toBe(301)
    expect(lookalike.headers.get('location')).toBe('https://ultrametric.ai/database')
  })

  it('302s the bare /productarena to /overall, uncacheable', async () => {
    const resp = await get('/productarena')
    expect(resp.status).toBe(302)
    expect(resp.headers.get('location')).toBe('https://ultrametric.ai/overall')
    expect(resp.headers.get('cache-control')).toBe('no-store')
  })

  it('301s /v2 and /v2/ to /get-started (founder 2026-09-29 rename)', async () => {
    // A Cloudflare ZONE rule still intercepts /v2 ahead of the worker in production; this
    // redirect takes over the moment the founder removes it.
    for (const path of ['/v2', '/v2/']) {
      const resp = await get(path)
      expect(resp.status).toBe(301)
      expect(resp.headers.get('location')).toBe('https://ultrametric.ai/get-started')
    }
  })

  it('301s deeper /v2/* paths to /get-started with the query intact', async () => {
    const resp = await get('/v2/opengraph-image?x=1')
    expect(resp.status).toBe(301)
    expect(resp.headers.get('location')).toBe('https://ultrametric.ai/get-started?x=1')
  })

  it('301s /virtual-startup and /virtual-startup/ to /startup-sim (founder 2026-10-01 rename)', async () => {
    const bare = await get('/virtual-startup')
    expect(bare.status).toBe(301)
    expect(bare.headers.get('location')).toBe('https://ultrametric.ai/startup-sim')
    const slash = await get('/virtual-startup/')
    expect(slash.status).toBe(301)
    expect(slash.headers.get('location')).toBe('https://ultrametric.ai/startup-sim/')
  })

  it('preserves ?run=/?preset= share-link state across the /virtual-startup hop', async () => {
    // Old share links carry the WHOLE run state in the query — it must survive verbatim.
    const run = await get('/virtual-startup?run=eyJ2IjoyLCJjIjoiMDAwMDAwMDAwIn0')
    expect(run.status).toBe(301)
    expect(run.headers.get('location')).toBe(
      'https://ultrametric.ai/startup-sim?run=eyJ2IjoyLCJjIjoiMDAwMDAwMDAwIn0',
    )
    const preset = await get('/virtual-startup?preset=software&yc=1&geo=UK')
    expect(preset.status).toBe(301)
    expect(preset.headers.get('location')).toBe(
      'https://ultrametric.ai/startup-sim?preset=software&yc=1&geo=UK',
    )
  })

  it('301s /virtual-startup/* sub-paths onto their /startup-sim twin, query intact', async () => {
    const resp = await get('/virtual-startup/opengraph-image?x=1')
    expect(resp.status).toBe(301)
    expect(resp.headers.get('location')).toBe('https://ultrametric.ai/startup-sim/opengraph-image?x=1')
  })
})
