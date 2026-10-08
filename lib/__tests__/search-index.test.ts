import { describe, expect, it } from 'vitest'
import {
  buildArtifactEntries,
  buildDocumentEntries,
  buildModuleEntries,
  buildSearchIndex,
  V2_PRODUCT_ENTRY,
  type SearchIndexSource,
} from '@/lib/search-index'

const sources: SearchIndexSource[] = [
  {
    category: { id: 'ai-coding', name: 'AI Coding Agents' },
    products: [
      { id: 'claude-code', name: 'Claude Code' },
      { id: 'codex', name: 'Codex' },
    ],
    stories: [{ id: 'agentic-mcp-server', title: 'I can connect an agent via an official MCP server', theme: 'agenticness' }],
  },
  {
    category: { id: 'desktop-os', name: 'Desktop OS' },
    products: [{ id: 'macos', name: 'macOS' }],
    stories: [],
  },
]

describe('buildSearchIndex', () => {
  it('includes one arena entry per category', () => {
    const entries = buildSearchIndex(sources).filter((e) => e.type === 'arena')
    expect(entries).toEqual([
      { type: 'arena', label: 'AI Coding Agents', sublabel: '2 products', href: '/arena/ai-coding' },
      { type: 'arena', label: 'Desktop OS', sublabel: '1 product', href: '/arena/desktop-os' },
    ])
  })

  it('includes one product entry per product, linking to its product page', () => {
    const entries = buildSearchIndex(sources).filter((e) => e.type === 'product')
    expect(entries).toContainEqual(
      expect.objectContaining({
        type: 'product',
        label: 'Claude Code',
        sublabel: 'AI Coding Agents',
        href: '/arena/ai-coding/product/claude-code',
        productId: 'claude-code',
      }),
    )
    expect(entries).toHaveLength(3)
  })

  it('produces no per-story entries — search focuses on arenas and products', () => {
    const entries = buildSearchIndex(sources).filter((e) => e.type === 'story')
    expect(entries).toEqual([])
  })

  it('produces no entries for an empty source list', () => {
    expect(buildSearchIndex([])).toEqual([])
  })

  it('exports the /get-started CLI/MCP product entry the layout feeds the ⌘K palette', () => {
    expect(V2_PRODUCT_ENTRY).toEqual({
      type: 'product',
      label: 'Ultrametric CLI/MCP',
      sublabel: 'Start and run your company from any agent',
      href: '/get-started',
    })
  })

  it('builds artifact entries: index lead + one /artifacts/[id] row per registry artifact, aliases keyed by id', () => {
    const entries = buildArtifactEntries(
      [{ id: '83b-election', label: 'Filed 83(b) election', producerTitle: 'File the 83(b) election' }],
      { '83b-election': ['83B', '83(b)'] },
    )
    expect(entries[0]).toEqual(expect.objectContaining({ type: 'artifact', href: '/artifacts' }))
    expect(entries[1]).toEqual({
      type: 'artifact',
      label: 'Filed 83(b) election',
      sublabel: 'Artifact · produced by File the 83(b) election',
      href: '/artifacts/83b-election',
      keywords: ['83b', '83(b)'],
    })
  })

  it('builds module entries: index lead + one /open-modules/[id] row per module, sublabel = the README computes cell', () => {
    const entries = buildModuleEntries([{ id: 'capTable', label: 'Cap table', computes: 'Ownership math' }])
    expect(entries[0]).toEqual(expect.objectContaining({ type: 'module', href: '/open-modules' }))
    expect(entries[1]).toEqual({
      type: 'module',
      label: 'Cap table',
      sublabel: 'Ownership math',
      href: '/open-modules/capTable',
    })
  })

  it('builds document entries: index lead + per-document rows that all land on /open-documents (no per-document page exists)', () => {
    const entries = buildDocumentEntries([{ name: 'Postmoney Safe', publisher: 'Y Combinator' }])
    expect(entries[0]).toEqual(expect.objectContaining({ type: 'document', href: '/open-documents' }))
    expect(entries[1]).toEqual({
      type: 'document',
      label: 'Postmoney Safe',
      sublabel: 'Y Combinator',
      href: '/open-documents',
    })
  })

  it('accepts a CategoryData-shaped source (extra fields ignored structurally)', () => {
    const wide = [
      {
        category: { id: 'x', name: 'X', description: 'd', personas: ['p'] },
        products: [{ id: 'p1', name: 'P1', vendor: 'v', type: 'oss' as const, urls: { site: 'https://x.example' } }],
        stories: [{ id: 's1', title: 'T', theme: 'th', persona: 'p', group: 'g', weight: 1 as const }],
        evidence: {},
        verdicts: [],
        rankings: { generatedAt: '2026-08-26T00:00:00.000Z', leaderboard: [], battles: [] },
        stacks: [],
        popularity: {},
        claims: {},
      },
    ]
    expect(buildSearchIndex(wide)).toHaveLength(2)
  })
})
