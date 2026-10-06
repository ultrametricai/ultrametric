import fs from 'node:fs'
import path from 'node:path'
import { type Evidence, EvidenceSchema, type Product, ProductSchema } from '../../lib/schemas'
import { categoryDir, readJson, resolveCategories, writeJson } from '../paths'

export interface ProbeFetchResult {
  status: number
  contentType: string | null
  text: string
}

// Injectable so tests never touch the network (see pipeline/__tests__/probe.test.ts) while
// runProbe's real usage hits the network via fetch.
export type ProbeFetcher = (url: string) => Promise<ProbeFetchResult>

export interface ProbeResult {
  key: string
  url: string
  positive: boolean
  excerpt: string
}

const USER_AGENT = 'Mozilla/5.0 (compatible; Ultrametric/1.0; +https://ultrametric.ai)'

export const defaultFetcher: ProbeFetcher = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' })
  const text = res.status === 200 ? await res.text() : ''
  return { status: res.status, contentType: res.headers.get('content-type'), text }
}

function truncate(s: string, n: number): string {
  const trimmed = s.trim()
  return trimmed.length > n ? trimmed.slice(0, n) : trimmed
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

// Origins that belong to a shared code host, not to the product. Anything served at the
// origin root there (llms.txt, /openapi.json) is the HOST's file: github.com/llms.txt is
// GitHub's platform index, and crediting it to a repo-hosted product produced the llama-cpp
// false agent-docs contradiction (accuracy-engine work queue 2026-09-30, issue #85).
// Product-owned pages sites (*.github.io etc.) are deliberately NOT listed.
const SHARED_CODE_HOSTS = ['github.com', 'gitlab.com', 'bitbucket.org', 'codeberg.org', 'sourceforge.net']

export function isSharedCodeHostOrigin(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return SHARED_CODE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

async function safeFetch(fetcher: ProbeFetcher, url: string): Promise<ProbeFetchResult | null> {
  try {
    return await fetcher(url)
  } catch {
    return null
  }
}

function isTextPlainish(contentType: string | null): boolean {
  const ct = (contentType ?? '').toLowerCase()
  return ct.includes('text/plain') || ct.includes('text/markdown') || (ct.startsWith('text/') && !ct.includes('html'))
}

// 1. GET {docs||site origin}/llms.txt — a documented, keyless signal that a product publishes
// agent-oriented docs. 200 text/plain-ish = positive; 404 = negative; anything else (403,
// 5xx, network error) is ambiguous and yields no evidence item at all.
async function probeLlmsTxt(fetcher: ProbeFetcher, baseUrl: string): Promise<ProbeResult | null> {
  const origin = originOf(baseUrl)
  if (!origin || isSharedCodeHostOrigin(origin)) return null
  const url = `${origin}/llms.txt`
  const res = await safeFetch(fetcher, url)
  if (!res) return null
  if (res.status === 200 && isTextPlainish(res.contentType)) {
    return { key: 'llms-txt', url, positive: true, excerpt: `PROBE llms.txt: HTTP 200 at ${url} ${truncate(res.text, 120)}`.trim() }
  }
  if (res.status === 404) {
    return { key: 'llms-txt', url, positive: false, excerpt: `PROBE llms.txt: HTTP 404 at ${url}` }
  }
  return null
}

// 2. GET the product's docs URL with `.md` appended — a growing convention (Mintlify, etc.)
// for serving the markdown source of a docs page. Only runs when a docs URL exists.
async function probeDocsMd(fetcher: ProbeFetcher, docsUrl: string): Promise<ProbeResult | null> {
  const url = `${docsUrl}.md`
  const res = await safeFetch(fetcher, url)
  if (!res) return null
  if (res.status === 200 && isTextPlainish(res.contentType)) {
    return { key: 'docs-md', url, positive: true, excerpt: `PROBE docs-md: HTTP 200 at ${url} ${truncate(res.text, 120)}`.trim() }
  }
  if (res.status === 404) {
    return { key: 'docs-md', url, positive: false, excerpt: `PROBE docs-md: HTTP 404 at ${url}` }
  }
  return null
}

const OPENAPI_PATHS = ['/openapi.json', '/swagger.json', '/api/openapi.json', '/.well-known/openapi.json']

// 3. Try a handful of conventional OpenAPI spec paths off the docs (or site) origin. Positive
// on the first 200 response whose body parses as JSON with an "openapi" key; negative only
// when every path comes back 404 (a clean, unambiguous "no API" signal). Any other mix (e.g.
// a 403 from a WAF) is ambiguous and produces no item.
async function probeOpenapi(fetcher: ProbeFetcher, baseUrl: string): Promise<ProbeResult | null> {
  const origin = originOf(baseUrl)
  if (!origin || isSharedCodeHostOrigin(origin)) return null
  const attempted: string[] = []
  let sawNon404NonPositive = false
  for (const p of OPENAPI_PATHS) {
    const url = `${origin}${p}`
    attempted.push(url)
    const res = await safeFetch(fetcher, url)
    if (!res) {
      sawNon404NonPositive = true
      continue
    }
    if (res.status === 200) {
      try {
        const json = JSON.parse(res.text) as Record<string, unknown>
        if (json && typeof json === 'object' && 'openapi' in json) {
          return { key: 'openapi', url, positive: true, excerpt: `PROBE openapi: HTTP 200 at ${url} — contains "openapi" key` }
        }
      } catch {
        /* not JSON — not a match, keep trying other paths */
      }
      sawNon404NonPositive = true
    } else if (res.status !== 404) {
      sawNon404NonPositive = true
    }
  }
  if (sawNon404NonPositive) return null
  return {
    key: 'openapi',
    url: attempted[0],
    positive: false,
    excerpt: `PROBE openapi: all candidate paths 404 (${attempted.join(', ')})`,
  }
}

// 4/5. GET a curated links.mcp / links.cli URL. 200 = positive ("officially documented"); 404
// = negative (the curated link may have gone stale); anything else is ambiguous.
async function probeLinkedTool(
  fetcher: ProbeFetcher,
  key: 'mcp-link' | 'cli-link',
  url: string,
  label: string,
): Promise<ProbeResult | null> {
  const res = await safeFetch(fetcher, url)
  if (!res) return null
  if (res.status === 200) {
    return { key, url, positive: true, excerpt: `${label} ${url}` }
  }
  if (res.status === 404) {
    return { key, url, positive: false, excerpt: `PROBE ${key}: HTTP 404 at ${url} (curated link may be stale)` }
  }
  return null
}

// Pure(ish) — all network access goes through the injected fetcher, so this is fully
// unit-testable without touching the network (see pipeline/__tests__/probe.test.ts).
export async function runProbeChecks(product: Product, fetcher: ProbeFetcher = defaultFetcher): Promise<ProbeResult[]> {
  const results: ProbeResult[] = []
  const base = product.urls.docs ?? product.urls.site

  const llms = await probeLlmsTxt(fetcher, base)
  if (llms) results.push(llms)

  if (product.urls.docs) {
    const docsMd = await probeDocsMd(fetcher, product.urls.docs)
    if (docsMd) results.push(docsMd)
  }

  const openapi = await probeOpenapi(fetcher, base)
  if (openapi) results.push(openapi)

  if (product.links?.mcp) {
    const mcp = await probeLinkedTool(fetcher, 'mcp-link', product.links.mcp, 'official MCP server documented at')
    if (mcp) results.push(mcp)
  }

  if (product.links?.cli) {
    const cli = await probeLinkedTool(fetcher, 'cli-link', product.links.cli, 'official CLI documented at')
    if (cli) results.push(cli)
  }

  return results
}

// CLI stage. Same replace-prior-tier pattern as collect-community.ts: probe items are
// regenerated wholesale on each run and replace only the product's existing `probe`-tier
// evidence, leaving claimed-docs/github/community untouched.
//
// NOT run as part of this task — this only wires the stage into `pnpm pipeline probe`; the
// actual run (against real products) and the resulting re-judge are the controller's next
// step, not this one.
export async function runProbe({ category, product }: { category?: string; product?: string }): Promise<void> {
  let matched = 0
  for (const cat of resolveCategories(category)) {
    const dataDir = categoryDir(cat.id)
    const products = readJson(ProductSchema.array(), path.join(dataDir, 'products.json')).filter(
      (p) => !product || p.id === product,
    )
    matched += products.length

    for (const p of products) {
      const results = await runProbeChecks(p)
      const now = new Date().toISOString()
      const probeEvidence: Evidence[] = results.map((r, i) => ({
        id: `${p.id}-probe-${i + 1}`,
        tier: 'probe',
        url: r.url,
        excerpt: r.excerpt,
        fetchedAt: now,
      }))
      const file = path.join(dataDir, 'evidence', `${p.id}.json`)
      const existing = fs.existsSync(file) ? readJson(EvidenceSchema.array(), file) : []
      writeJson(file, [...existing.filter((e) => e.tier !== 'probe'), ...probeEvidence])
      const positives = results.filter((r) => r.positive).length
      console.log(
        `probe: ${cat.id}/${p.id} → ${probeEvidence.length} probe item(s) (${positives} positive, ${probeEvidence.length - positives} negative)`,
      )
    }
  }
  if (product && matched === 0) throw new Error(`unknown product: ${product}`)
}
