import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildIntegrationGraph,
  IntegrationsFileSchema,
  integrationStats,
  loadIntegrations,
  neighborsOf,
  pairKey,
  verifiedPairKeys,
  type ProductIntegrations,
} from '../integrations'
import { stackPairKey } from '../stackShared'

const edge = (productId: string, arena: string, sourceEvidenceId: string, excerpt: string) => ({
  productId,
  arena,
  sourceEvidenceId,
  excerpt,
})

// mercury's evidence claims Xero + Stripe; stripe's evidence independently claims Xero.
const BANKING: ProductIntegrations[] = [
  {
    productId: 'mercury',
    integratesWith: [
      edge('xero', 'accounting', 'mercury-docs-3', 'syncs every transaction to Xero'),
      edge('stripe', 'payments', 'mercury-docs-7', 'payouts from Stripe land in Mercury'),
    ],
  },
]
const PAYMENTS: ProductIntegrations[] = [
  { productId: 'stripe', integratesWith: [edge('xero', 'accounting', 'stripe-docs-9', 'export invoices to Xero')] },
]

const graph = () =>
  buildIntegrationGraph([
    { arena: 'startup-banking', integrations: BANKING },
    { arena: 'payments', integrations: PAYMENTS },
  ])

describe('buildIntegrationGraph', () => {
  it('symmetricizes edges with direction preserved via fromProductId', () => {
    const g = graph()
    const xeroNeighbors = neighborsOf(g, 'xero')
    expect(xeroNeighbors.map((n) => n.productId).sort()).toEqual(['mercury', 'stripe'])
    const fromMercury = xeroNeighbors.find((n) => n.productId === 'mercury')!
    expect(fromMercury.arena).toBe('startup-banking') // the arena mercury's file lives in
    expect(fromMercury.sources).toEqual([
      {
        fromProductId: 'mercury',
        fromArena: 'startup-banking',
        evidenceId: 'mercury-docs-3',
        excerpt: 'syncs every transaction to Xero',
      },
    ])
  })

  it('merges both directions of the same pair into one neighbor with two sources', () => {
    const g = graph()
    // mercury→stripe claimed by mercury only; stripe↔xero claimed by stripe only; add the
    // reverse claim and the pair keeps both sources.
    const g2 = buildIntegrationGraph([
      { arena: 'startup-banking', integrations: BANKING },
      {
        arena: 'payments',
        integrations: [
          {
            productId: 'stripe',
            integratesWith: [edge('mercury', 'startup-banking', 'stripe-docs-2', 'send payouts to Mercury')],
          },
        ],
      },
    ])
    const stripeSide = neighborsOf(g2, 'stripe').find((n) => n.productId === 'mercury')!
    expect(stripeSide.sources.map((s) => s.fromProductId).sort()).toEqual(['mercury', 'stripe'])
    expect(neighborsOf(g, 'mercury')).toHaveLength(2)
  })

  it('drops self-loops defensively and returns [] for unknown products', () => {
    const g = buildIntegrationGraph([
      {
        arena: 'payments',
        integrations: [{ productId: 'stripe', integratesWith: [edge('stripe', 'payments', 'e1', 'Stripe on Stripe')] }],
      },
    ])
    expect(neighborsOf(g, 'stripe')).toEqual([])
    expect(neighborsOf(g, 'ghost')).toEqual([])
  })
})

describe('verifiedPairKeys / pairKey', () => {
  it('emits each unordered pair once, sorted', () => {
    expect(pairKey('xero', 'mercury')).toBe('mercury|xero')
    expect(verifiedPairKeys(graph())).toEqual(['mercury|stripe', 'mercury|xero', 'stripe|xero'])
  })

  it('lib/stackShared.ts stackPairKey mirrors the format exactly (drift guard)', () => {
    expect(stackPairKey('b', 'a')).toBe(pairKey('b', 'a'))
    expect(stackPairKey('a', 'b')).toBe(pairKey('a', 'b'))
    expect(stackPairKey('stripe', 'mercury')).toBe('mercury|stripe')
  })
})

describe('integrationStats', () => {
  it('counts pairs once, mentions per directed claim, and ranks by neighbor count', () => {
    const stats = integrationStats(graph(), 2)
    expect(stats.totalPairs).toBe(3)
    expect(stats.totalMentions).toBe(3) // three directed claims, each counted once despite symmetrization
    expect(stats.connectedProducts).toBe(3)
    expect(stats.topConnected.map((t) => t.productId)).toEqual(['mercury', 'stripe']) // 2 neighbors, then tie broken by id
    expect(stats.topConnected[0].neighborCount).toBe(2)
  })
})

describe('loadIntegrations', () => {
  it('parses a valid file and resolves a missing one to [] (tolerant-optional)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-integrations-'))
    fs.mkdirSync(path.join(dir, 'startup-banking'), { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'startup-banking', 'integrations.json'),
      JSON.stringify(IntegrationsFileSchema.parse(BANKING)),
    )
    expect(loadIntegrations('startup-banking', dir)).toEqual(BANKING)
    expect(loadIntegrations('payments', dir)).toEqual([])
  })
})
