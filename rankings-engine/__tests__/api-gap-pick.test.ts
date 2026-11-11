import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  buildMovesTable, buildNeedsHumanBody, buildSpecItem, discoverProduct, extractSpecUrls,
  ExclusionsFileSchema, parseRoster, positiveEvidenceUrls, routeCandidates, snapshotProduct, specSignature,
  type Candidate, type DiscoveryFetcher, type ExclusionEntry,
} from '../scripts/api-gap-pick'
import type { Evidence, Product } from '../../lib/schemas'
import { ROOT } from '../paths'

// The scheduled gap-repair workflow picks only genuinely unrepaired gap rows, never
// bypasses the exclusion/affiliation routing, and proposes only mechanically verified
// spec candidates. These tests pin that contract.

const candidates: Candidate[] = [
  { arena: 'terminals', product: 'iterm2', staleness: 80 },
  { arena: 'product-feedback', product: 'foreloop', staleness: 70 },
  { arena: 'email', product: 'missive', staleness: 60 },
  { arena: 'crm', product: 'attio', staleness: 50 },
  { arena: 'ai-assistants', product: 'claude', staleness: 40 },
]

const exclusions: ExclusionEntry[] = [
  { arena: 'terminals', product: 'iterm2', route: 'skip', reason: 'settled churn cell; settlement-aware pass pending' },
  { arena: 'product-feedback', product: 'foreloop', route: 'needs-human', reason: 'own product pending the maintainer ruling' },
]

const affiliationOf = (arena: string, product: string): string | undefined =>
  (arena === 'ai-assistants' && product === 'claude' ? 'Claude is made by Anthropic, whose model judges every arena.' : undefined)

describe('routeCandidates', () => {
  it('skips exclusions, routes needs-human and affiliated rows, picks the rest in order', () => {
    const routed = routeCandidates(candidates, exclusions, affiliationOf, 12)
    expect(routed.deferred.map((r) => r.product)).toEqual(['iterm2'])
    expect(routed.needsHuman.map((r) => r.product)).toEqual(['foreloop', 'claude'])
    expect(routed.picked.map((r) => r.product)).toEqual(['missive', 'attio'])
  })

  it('caps the pick at top but still routes every excluded/affiliated row', () => {
    const routed = routeCandidates(candidates, exclusions, affiliationOf, 1)
    expect(routed.picked.map((r) => r.product)).toEqual(['missive'])
    expect(routed.needsHuman).toHaveLength(2)
    expect(routed.deferred).toHaveLength(1)
  })

  it('routing never depends on roster position: an affiliated row is needs-human even when picked explicitly', () => {
    const routed = routeCandidates([{ arena: 'ai-assistants', product: 'claude', staleness: null }], [], affiliationOf, 12)
    expect(routed.picked).toEqual([])
    expect(routed.needsHuman.map((r) => r.product)).toEqual(['claude'])
  })
})

describe('parseRoster', () => {
  it('parses arena/product pairs', () => {
    expect(parseRoster(' email/missive, crm/attio ')).toEqual([
      { arena: 'email', product: 'missive' },
      { arena: 'crm', product: 'attio' },
    ])
  })

  it('rejects malformed entries', () => {
    expect(() => parseRoster('missive')).toThrow(/arena\/product/)
    expect(() => parseRoster('a/b/c')).toThrow(/arena\/product/)
  })
})

describe('the committed exclusions file', () => {
  it('validates and carries the two seeded exclusions', () => {
    const file = path.join(ROOT, 'rankings-engine', 'api-gap-exclusions.json')
    const parsed = ExclusionsFileSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')))
    const keys = parsed.exclusions.map((e) => `${e.arena}/${e.product}:${e.route}`)
    expect(keys).toContain('product-feedback/foreloop:needs-human')
    expect(keys).toContain('terminals/iterm2:skip')
  })
})

describe('extractSpecUrls', () => {
  it('finds markdown links, bare URLs, and resolves relative links against the llms.txt URL', () => {
    const llms = [
      '# Docs',
      '## OpenAPI Specs',
      '- [Gateway](https://docs.example.com/gateway.openapi.yaml)',
      '- bare https://api.example.com/openapi.json listed inline',
      '- [Relative](/cloud/openapi/v4.json)',
      '- [Nested relative](specs/swagger.json)',
      '- [Not a spec](https://docs.example.com/guide.md)',
    ].join('\n')
    expect(extractSpecUrls(llms, 'https://docs.example.com/llms.txt')).toEqual([
      'https://docs.example.com/gateway.openapi.yaml',
      'https://docs.example.com/cloud/openapi/v4.json',
      'https://docs.example.com/specs/swagger.json',
      'https://api.example.com/openapi.json',
    ])
  })

  it('keeps https only and caps the result', () => {
    const llms = 'http://docs.example.com/openapi.json\nhttps://a.example.com/openapi.json\nhttps://b.example.com/openapi.json'
    expect(extractSpecUrls(llms, 'https://docs.example.com/llms.txt', 1)).toEqual(['https://a.example.com/openapi.json'])
  })
})

describe('specSignature', () => {
  it('extracts literal body slices from a JSON OpenAPI document', () => {
    const body = '{"openapi": "3.1.0", "info": {"title": "Widget API", "version": "2.0.0"}, "paths": {}}'
    const sig = specSignature(body)
    expect(sig?.markers).toEqual(['"openapi": "3.1.0"', '"title": "Widget API"'])
    for (const marker of sig?.markers ?? []) expect(body).toContain(marker)
  })

  it('extracts slices from a YAML document', () => {
    const body = 'openapi: 3.0.0\ninfo:\n  title: sevdesk API\n  version: 1.0\npaths:\n  /invoices: {}\n'
    const sig = specSignature(body)
    expect(sig?.markers).toEqual(['openapi: 3.0.0', 'title: sevdesk API'])
  })

  it('rejects HTML shells and JSON that merely mentions openapi', () => {
    expect(specSignature('<!doctype html><html>"openapi": "3.1.0"</html>')).toBeNull()
    expect(specSignature('{"page": "\\"openapi\\" is a spec format"}')).toBeNull()
    expect(specSignature('not a spec at all')).toBeNull()
  })

  it('rejects JSON with the version key but no spec structure', () => {
    expect(specSignature('{"openapi": "3.1.0"}')).toBeNull()
    expect(specSignature('{"openapi": "3.1.0", "info": {"title": "X"}}')).toBeNull()
  })

  it('rejects prose and markdown pages carrying an openapi example', () => {
    const fenced = '# Quickstart\n\n```yaml\nopenapi: 3.1.0\ninfo:\n  title: Example\npaths: {}\n```\n'
    expect(specSignature(fenced)).toBeNull()
    const prose = 'Our reference is generated from an OpenAPI document.\nopenapi: 3.1.0 is the version we target.\n'
    expect(specSignature(prose)).toBeNull()
  })
})

describe('positiveEvidenceUrls', () => {
  it('keeps positive rows and drops recorded negatives so a later spec is re-detected', () => {
    const rows = [
      { id: 'a', tier: 'claimed-docs', url: 'https://x.example.com/docs', excerpt: 'Documented behavior', fetchedAt: '2026-11-01T00:00:00Z' },
      { id: 'b', tier: 'probe', url: 'https://x.example.com/openapi.json', excerpt: 'PROBE openapi: all candidate paths 404 (https://x.example.com/openapi.json)', fetchedAt: '2026-11-01T00:00:00Z' },
      { id: 'c', tier: 'probe', url: 'https://x.example.com/llms.txt', excerpt: 'PROBE llms.txt: HTTP 200 at https://x.example.com/llms.txt # Docs', fetchedAt: '2026-11-01T00:00:00Z' },
    ] as Evidence[]
    const urls = positiveEvidenceUrls(rows)
    expect(urls.has('https://x.example.com/docs')).toBe(true)
    expect(urls.has('https://x.example.com/llms.txt')).toBe(true)
    expect(urls.has('https://x.example.com/openapi.json')).toBe(false)
  })
})

describe('discoverProduct', () => {
  const product = {
    id: 'widget',
    name: 'Widget',
    vendor: 'Widget Inc',
    type: 'commercial',
    urls: { site: 'https://widget.example.com', docs: 'https://docs.widget.example.com/intro' },
  } as unknown as Product
  const stories = ['api-machine-spec', 'api-interactive-docs', 'api-sandbox', 'api-versioning-policy']

  const fetcher = (map: Record<string, { status: number; text: string; contentType?: string }>): DiscoveryFetcher =>
    async (url) => {
      const hit = map[url]
      return hit ? { status: hit.status, text: hit.text, contentType: hit.contentType ?? 'text/plain' } : { status: 404, text: '', contentType: null }
    }

  it('proposes a spec item from the llms.txt listing and withholds the other stories', async () => {
    const found = await discoverProduct('widgets', product, stories, new Set(), fetcher({
      'https://docs.widget.example.com/llms.txt': { status: 200, text: '## OpenAPI Specs\n- [Spec](/openapi.json)' },
      'https://docs.widget.example.com/openapi.json': { status: 200, text: '{"openapi": "3.1.0", "info": {"title": "Widget API"}, "paths": {}}', contentType: 'application/json' },
    }), '2026-11-12')
    expect(found.items).toHaveLength(1)
    expect(found.items[0]).toMatchObject({
      arena: 'widgets',
      product: 'widget',
      storyId: 'api-machine-spec',
      id: 'widget-apigap-machine-spec-20261112',
      tier: 'claimed-docs',
      url: 'https://docs.widget.example.com/openapi.json',
      source: 'llms-txt',
    })
    expect(found.items[0].markers).toEqual(['"openapi": "3.1.0"', '"title": "Widget API"'])
    expect(found.withheld.map((w) => w.storyId)).toEqual(['api-interactive-docs', 'api-sandbox', 'api-versioning-policy'])
    expect(found.withheld.every((w) => w.disposition === 'needs-research')).toBe(true)
  })

  it('falls back to the well-known paths and never proposes a soft-200 HTML shell', async () => {
    const found = await discoverProduct('widgets', product, stories, new Set(), fetcher({
      'https://docs.widget.example.com/openapi.json': { status: 200, text: '<!doctype html><title>Widget</title>', contentType: 'text/html' },
      'https://widget.example.com/swagger.json': { status: 200, text: '{"swagger": "2.0", "info": {"title": "Widget API"}, "paths": {}}', contentType: 'application/json' },
    }), '2026-11-12')
    expect(found.items.map((i) => i.url)).toEqual(['https://widget.example.com/swagger.json'])
    expect(found.items[0].source).toBe('well-known')
  })

  it('skips URLs already present in the evidence pack and withholds every story when nothing is found', async () => {
    const found = await discoverProduct('widgets', product, stories,
      new Set(['https://docs.widget.example.com/openapi.json']),
      fetcher({
        'https://docs.widget.example.com/openapi.json': { status: 200, text: '{"openapi": "3.0.0", "info": {"title": "Widget API"}, "paths": {}}', contentType: 'application/json' },
      }), '2026-11-12')
    expect(found.items).toEqual([])
    expect(found.withheld).toHaveLength(4)
  })
})

describe('buildSpecItem', () => {
  it('sequences ids for a second spec on the same product', () => {
    const sig = { markers: ['openapi: 3.1.0'], descriptor: 'openapi: 3.1.0' }
    expect(buildSpecItem('widgets', 'widget', 'https://x.example.com/openapi.yaml', sig, 'well-known', '2026-11-12', 2).id)
      .toBe('widget-apigap-machine-spec-20261112-2')
  })
})

describe('snapshots and the moves table', () => {
  const verdicts = [
    { productId: 'widget', storyId: 'api-machine-spec', verdict: 'none', quality: 0 },
    { productId: 'widget', storyId: 'api-sandbox', verdict: 'partial', quality: 5 },
  ]
  const leaderboard = [{ productId: 'widget', score: 31.5, apiQuality: 10 }]
  const stories = ['api-machine-spec', 'api-interactive-docs', 'api-sandbox', 'api-versioning-policy']

  it('snapshots verdicts and score', () => {
    expect(snapshotProduct(verdicts, leaderboard, 'widget', stories)).toEqual({
      score: 31.5,
      apiQuality: 10,
      stories: {
        'api-machine-spec': 'none',
        'api-interactive-docs': 'absent',
        'api-sandbox': 'partial q5',
        'api-versioning-policy': 'absent',
      },
    })
  })

  it('renders moves only for cells that changed', () => {
    const before = snapshotProduct(verdicts, leaderboard, 'widget', stories)
    const after = snapshotProduct(
      [{ productId: 'widget', storyId: 'api-machine-spec', verdict: 'full', quality: 8 }, verdicts[1]],
      [{ productId: 'widget', score: 34.2, apiQuality: 20 }], 'widget', stories)
    const table = buildMovesTable([{ arena: 'widgets', product: 'widget', before, after }])
    expect(table).toContain('| widget | widgets | none → full q8 | absent | partial q5 | absent | 31.5 → 34.2 |')
  })
})

describe('buildNeedsHumanBody', () => {
  it('tables the needs-human rows and lists deferrals', () => {
    const body = buildNeedsHumanBody(
      [{ arena: 'product-feedback', product: 'foreloop', staleness: 70, reason: 'own product pending ruling' }],
      [{ arena: 'terminals', product: 'iterm2', staleness: 80, reason: 'settlement-aware pass pending' }],
      '2026-11-12',
    )
    expect(body).toContain('| foreloop | product-feedback | own product pending ruling |')
    expect(body).toContain('**terminals/iterm2** — settlement-aware pass pending')
    expect(body).toContain('bias audit')
  })
})
