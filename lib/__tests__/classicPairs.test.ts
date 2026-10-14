// Classic-pairs machinery: schema/loader behavior on fixtures, classification against a fixture
// graph, and structural invariants of the REAL open-rankings/classic-pairs.json (both ids tracked
// somewhere in open-rankings/*/products.json, no duplicate or self pairs) — a typo'd id would otherwise
// render a permanently-unverifiable "expected pairing", which is exactly the dishonesty the
// feature exists to avoid.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { classifyClassicPairs, ClassicPairsFileSchema, loadClassicPairs } from '../classicPairs'
import { buildIntegrationGraph, pairKey, type ProductIntegrations } from '../integrations'

const PAIRS = loadClassicPairs() // the real curated file

describe('open-rankings/classic-pairs.json', () => {
  it('parses, with no self-pairs and no duplicate pairs (order-insensitive)', () => {
    const seen = new Set<string>()
    for (const p of PAIRS) {
      expect(p.a).not.toBe(p.b)
      const key = pairKey(p.a, p.b)
      expect(seen.has(key), `duplicate pair ${key}`).toBe(false)
      seen.add(key)
    }
  })

  it('references only tracked product ids', () => {
    const tracked = new Set<string>()
    const dataDir = path.join(process.cwd(), 'open-rankings')
    for (const dir of fs.readdirSync(dataDir)) {
      const file = path.join(dataDir, dir, 'products.json')
      if (!fs.existsSync(file)) continue
      for (const p of JSON.parse(fs.readFileSync(file, 'utf8')) as Array<{ id: string }>) tracked.add(p.id)
    }
    for (const p of PAIRS) {
      expect(tracked.has(p.a), `unknown product id ${p.a}`).toBe(true)
      expect(tracked.has(p.b), `unknown product id ${p.b}`).toBe(true)
    }
  })
})

describe('classifyClassicPairs', () => {
  const integrations: ProductIntegrations[] = [
    {
      productId: 'stripe',
      integratesWith: [
        { productId: 'quickbooks', arena: 'accounting', sourceEvidenceId: 'stripe-docs-1', excerpt: 'sync payouts to QuickBooks' },
      ],
    },
  ]
  const graph = buildIntegrationGraph([{ arena: 'payments', integrations }])
  const pairs = [
    { a: 'stripe', b: 'quickbooks', expectation: 'payouts reconciled into the books automatically' },
    // Same pair from the other side must classify identically (graph is symmetricized).
    { a: 'quickbooks', b: 'stripe', expectation: 'payouts reconciled into the books automatically' },
    { a: 'slack', b: 'linear', expectation: 'threads become issues without leaving the chat app' },
  ]

  it('marks pairs verified only when an evidence-backed edge exists, carrying its sources', () => {
    const { statuses, verified, unverified } = classifyClassicPairs(pairs, graph)
    expect(verified).toBe(2)
    expect(unverified).toBe(1)
    expect(statuses[0].verified).toBe(true)
    expect(statuses[0].sources[0].excerpt).toBe('sync payouts to QuickBooks')
    expect(statuses[1].verified).toBe(true) // direction-insensitive
    expect(statuses[2]).toMatchObject({ verified: false, sources: [], key: 'linear|slack' })
  })

  it('preserves file order and stamps the sorted pair key', () => {
    const { statuses } = classifyClassicPairs(pairs, graph)
    expect(statuses.map((s) => s.key)).toEqual(['quickbooks|stripe', 'quickbooks|stripe', 'linear|slack'])
  })
})

describe('loadClassicPairs', () => {
  it('rejects a malformed file loudly (zod), rather than rendering junk', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'classic-pairs-'))
    const file = path.join(dir, 'classic-pairs.json')
    fs.writeFileSync(file, JSON.stringify({ pairs: [{ a: 'x', b: 'y', expectation: 'too short' }] }))
    expect(() => loadClassicPairs(file)).toThrow()
    expect(() => ClassicPairsFileSchema.parse({ pairs: [] })).toThrow()
  })
})
