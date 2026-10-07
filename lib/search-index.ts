import type { Category, Product, Story } from './schemas'

export type SearchEntryType = 'arena' | 'stack' | 'process' | 'page' | 'product' | 'story'

export interface SearchEntry {
  type: SearchEntryType
  label: string
  sublabel: string
  href: string
  /** For product rows: render the product's committed logo in the palette. */
  productId?: string
  hasLogo?: boolean
  /** For arena rows: the arena's house icon token from lib/arenaIcons.ts (the palette renders
   *  it through IconGlyph as the custom duotone SVG). */
  icon?: string
  /**
   * Alias phrases people actually type ("agent harness", "vector store", "etl") that should
   * surface this entry — sourced from data/search-aliases.json and lowercased at build time
   * so the client never re-normalizes them per keystroke.
   */
  keywords?: string[]
}

// Structural subset of CategoryData — narrowed so this module (and its tests) don't need to
// depend on lib/data's full CategoryData shape (evidence/verdicts/rankings/stacks), which
// would otherwise force every test fixture to fabricate unrelated fields. Any CategoryData[]
// (e.g. loadAll()'s return value) satisfies this shape as-is.
export interface SearchIndexSource {
  category: Pick<Category, 'id' | 'name'>
  products: Pick<Product, 'id' | 'name'>[]
  stories: Pick<Story, 'id' | 'title' | 'theme'>[]
}

// Build-time index for the ⌘K command palette: one flat array covering every arena, product,
// and story across all populated categories. Story entries link to the arena page's matrix,
// anchored at that story's row (see the `id="story-{storyId}"` added to StoryMatrix rows) —
// there's no single-story page, so the matrix is the closest addressable location.
export function buildSearchIndex(
  sources: SearchIndexSource[],
  opts?: {
    arenaIcons?: Record<string, string>
    hasLogo?: (id: string) => boolean
    /** Arena id → alias phrases (data/search-aliases.json `arenas`). */
    keywords?: Record<string, string[]>
  },
): SearchEntry[] {
  const entries: SearchEntry[] = []

  for (const data of sources) {
    const aliases = opts?.keywords?.[data.category.id]
    entries.push({
      type: 'arena',
      label: data.category.name,
      sublabel: `${data.products.length} product${data.products.length === 1 ? '' : 's'}`,
      href: `/arena/${data.category.id}`,
      icon: opts?.arenaIcons?.[data.category.id],
      ...(aliases && aliases.length > 0 ? { keywords: aliases.map((k) => k.toLowerCase()) } : {}),
    })

    for (const p of data.products) {
      entries.push({
        type: 'product',
        label: p.name,
        sublabel: data.category.name,
        href: `/arena/${data.category.id}/product/${p.id}`,
        productId: p.id,
        hasLogo: opts?.hasLogo?.(p.id),
      })
    }

    // Story entries deliberately omitted — search focuses on arenas and products; stories are
    // discoverable inside each product/arena page where they have context.
  }

  return entries
}

// ---------------------------------------------------------------------------
// Auxiliary entries: curated stacks (/stacks#<id>) and key tool pages. Both take their alias
// phrases from data/search-aliases.json (`stacks` / `pages` sections), passed in by the caller
// so this module stays dependency-light for tests.
// ---------------------------------------------------------------------------

export interface StackSearchSource {
  id: string
  name: string
  tagline: string
}

export function buildStackEntries(stacks: StackSearchSource[], keywords?: Record<string, string[]>): SearchEntry[] {
  return stacks.map((s) => {
    const aliases = keywords?.[s.id]
    return {
      type: 'stack' as const,
      label: s.name,
      sublabel: s.tagline,
      href: `/stacks#${s.id}`,
      ...(aliases && aliases.length > 0 ? { keywords: aliases.map((k) => k.toLowerCase()) } : {}),
    }
  })
}

// End-to-end playbooks (process chains) surfaced in ⌘K — one entry per chain, labeled from the
// chain data itself; alias phrases come from search-aliases.json `pages`, keyed by the chain's
// href (`/processes/chains/{id}`), same convention as the static pages below.
export interface ChainSearchSource {
  id: string
  name: string
  tagline: string
}

export function buildChainEntries(chains: ChainSearchSource[], keywords?: Record<string, string[]>): SearchEntry[] {
  return chains.map((c) => {
    const href = `/processes/chains/${c.id}`
    const aliases = keywords?.[href]
    return {
      type: 'page' as const,
      label: `${c.name} (playbook)`,
      sublabel: c.tagline,
      href,
      ...(aliases && aliases.length > 0 ? { keywords: aliases.map((k) => k.toLowerCase()) } : {}),
    }
  })
}

// High-traffic founder processes surfaced as the palette's 'Processes' browse group (founder
// 2026-10-02: "⌘K search defaults include processes"). The group leads with the /processes
// index entry, then the curated processes the caller passes in (app/layout.tsx picks the ids;
// slugs/titles come from lib/processes so renames can't strand the palette). Alias phrases come
// from data/search-aliases.json `pages`, keyed by href — the same convention as chains/pages.
export interface ProcessSearchSource {
  slug: string
  title: string
  sublabel: string
}

export function buildProcessEntries(
  processes: ProcessSearchSource[],
  keywords?: Record<string, string[]>,
): SearchEntry[] {
  const withAliases = (href: string, entry: Omit<SearchEntry, 'keywords'>): SearchEntry => {
    const aliases = keywords?.[href]
    return { ...entry, ...(aliases && aliases.length > 0 ? { keywords: aliases.map((k) => k.toLowerCase()) } : {}) }
  }
  return [
    // The index page moved here from PAGE_DEFS — it anchors the group it names.
    withAliases('/processes', {
      type: 'process',
      label: 'All processes',
      sublabel: 'Every founder process and its Agentic %',
      href: '/processes',
    }),
    ...processes.map((p) => {
      const href = `/processes/${p.slug}`
      return withAliases(href, { type: 'process' as const, label: p.title, sublabel: p.sublabel, href })
    }),
  ]
}

// The key tool pages worth surfacing in ⌘K. Labels/sublabels live here (they're UI copy, not
// data); alias phrases come from data/search-aliases.json `pages`, keyed by href.
const PAGE_DEFS: { href: string; label: string; sublabel: string }[] = [
  { href: '/processes/operating-rhythm', label: 'Operating rhythm', sublabel: 'What a startup actually does, daily through annual' },
  // Label renamed 'The Open Startup' → 'Open Startup Sim' (founder 2026-10-02); route unchanged.
  { href: '/startup-sim', label: 'Open Startup Sim', sublabel: 'Simulate a startup journey through the real processes' },
  { href: '/global', label: 'Capability adoption', sublabel: 'MCP, llms.txt & more across the industry' },
  { href: '/technologies', label: 'Technologies — control surfaces', sublabel: 'API, MCP, CLI & other agent surfaces, ranked by adoption' },
  { href: '/missing', label: 'Missing startups', sublabel: 'Ranking gaps where agent startups are missing' },
  { href: '/compare', label: 'Compare', sublabel: 'Any products, side by side' },
  { href: '/certified', label: 'Certified Agent-Ready', sublabel: 'The certification registry' },
  { href: '/yc', label: 'YC batches', sublabel: 'Y Combinator alumni ranked by agent readiness' },
  { href: '/rankings/law-firms', label: 'Startup law firms — ranked', sublabel: 'The judged law-firm leaderboard with per-country availability' },
  { href: '/stacks', label: 'AI Stacks', sublabel: 'Curated cross-market stacks' },
  { href: '/stacks/builder', label: 'Stack builder', sublabel: 'Build your own evidence-backed stack' },
  { href: '/my-stack', label: 'My stack', sublabel: 'Enter your stack, get evidence-based upgrades' },
  { href: '/stacks/battle', label: 'Battle of the stacks', sublabel: 'Two stacks, side by side' },
  // Company pages ported from the retired Astro landing (founder 2026-09-29).
  { href: '/company', label: 'Company processes (Ultrametric)', sublabel: 'Build an AI native business — the AFK product page' },
  { href: '/about', label: 'About Ultrametric', sublabel: 'Who makes this, and the evidence doctrine' },
  { href: '/tos', label: 'Terms of Service', sublabel: 'The Ultrametric, Inc. terms of service' },
]

// The dedicated Ultrametric CLI/MCP product page (app/get-started, ported from the /v2 landing origin
// 2026-09-29). A `product` entry — it's the company's own product, not a site view — defined
// here (not inline in the layout) so the palette test can assert its presence.
export const V2_PRODUCT_ENTRY: SearchEntry = {
  type: 'product',
  label: 'Ultrametric CLI/MCP',
  sublabel: 'Start and run your company from any agent',
  href: '/get-started',
}

export function buildPageEntries(keywords?: Record<string, string[]>): SearchEntry[] {
  return PAGE_DEFS.map((p) => {
    const aliases = keywords?.[p.href]
    return {
      type: 'page' as const,
      ...p,
      ...(aliases && aliases.length > 0 ? { keywords: aliases.map((k) => k.toLowerCase()) } : {}),
    }
  })
}

// ---------------------------------------------------------------------------
// Matching. The palette's filter lives here (not in CommandPalette) so it's unit-testable.
//
// Pipeline per keystroke:
//   1. lowercase + trim the query;
//   2. rank against label / keywords / sublabel with a naive trailing-'s' fold on both sides
//      ("agent harnesses" ↔ "agent harness", "vector stores" ↔ "vector store");
//   3. if nothing matched, strip classic query chrome — leading "best|top|great", trailing
//      "tools|software|apps|platforms" and "for startups" — and rank once more.
//
// Ranking tiers (lower wins): exact label, exact keyword, label substring, keyword substring,
// sublabel substring. Ties keep index order, so arenas stay in their curated order.
// ---------------------------------------------------------------------------

/** Naive singular fold: "harnesses"→"harness", "stores"→"store"; leaves "harness"/"os" alone. */
function singularizeWord(w: string): string {
  if (/(?:sses|shes|ches|xes|zes)$/.test(w)) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1)
  return w
}

function foldPhrase(s: string): string {
  return s.split(/\s+/).map(singularizeWord).join(' ')
}

/** Strip "best X tools for startups"-style chrome; returns '' if nothing substantive remains. */
export function stripQueryChrome(q: string): string {
  let s = q
  let prev: string
  do {
    prev = s
    s = s.replace(/^(?:best|top|great)\s+/, '')
    s = s.replace(/\s+for\s+startups?$/, '')
    s = s.replace(/\s+(?:tools?|software|apps?|platforms?)$/, '')
  } while (s !== prev)
  return s.trim()
}

// Per-entry precomputed lowercase + folded haystacks so the per-keystroke work is pure
// substring checks. Built once per palette mount (see prepareSearchEntries), never per query.
export interface PreparedSearchEntry {
  entry: SearchEntry
  labelLc: string
  labelFolded: string
  sublabelLc: string
  sublabelFolded: string
  keywordsLc: string[]
  keywordsFolded: string[]
}

export function prepareSearchEntries(entries: SearchEntry[]): PreparedSearchEntry[] {
  return entries.map((entry) => {
    const labelLc = entry.label.toLowerCase()
    const sublabelLc = entry.sublabel.toLowerCase()
    const keywordsLc = (entry.keywords ?? []).map((k) => k.toLowerCase())
    return {
      entry,
      labelLc,
      labelFolded: foldPhrase(labelLc),
      sublabelLc,
      sublabelFolded: foldPhrase(sublabelLc),
      keywordsLc,
      keywordsFolded: keywordsLc.map(foldPhrase),
    }
  })
}

function scoreEntry(p: PreparedSearchEntry, q: string, fq: string): number | null {
  if (p.labelLc === q || p.labelFolded === fq) return 0
  // Label PREFIX beats everything except an exact label match — typing "merc" must put
  // Mercury above arenas that merely contain the substring (founder feedback 2026-09-14).
  if (p.labelLc.startsWith(q) || p.labelFolded.startsWith(fq)) return 1
  if (p.keywordsLc.includes(q) || p.keywordsFolded.includes(fq)) return 2
  // Word-boundary prefix inside the label ("goog" → "Google Antigravity"-style second words).
  if (p.labelLc.split(/\s+/).some((w) => w.startsWith(q)) || p.labelFolded.split(/\s+/).some((w) => w.startsWith(fq))) return 3
  if (p.labelLc.includes(q) || p.labelFolded.includes(fq)) return 4
  if (p.keywordsLc.some((k) => k.includes(q)) || p.keywordsFolded.some((k) => k.includes(fq))) return 5
  if (p.sublabelLc.includes(q) || p.sublabelFolded.includes(fq)) return 6
  return null
}

function rank(prepared: PreparedSearchEntry[], q: string): SearchEntry[] {
  const fq = foldPhrase(q)
  const hits: { entry: SearchEntry; score: number; index: number }[] = []
  for (let i = 0; i < prepared.length; i++) {
    const score = scoreEntry(prepared[i], q, fq)
    if (score !== null) hits.push({ entry: prepared[i].entry, score, index: i })
  }
  hits.sort((a, b) => a.score - b.score || a.index - b.index)
  return hits.map((h) => h.entry)
}

/** The palette's filter: returns matching entries best-first ([] query → all, in index order). */
export function filterSearchEntries(prepared: PreparedSearchEntry[], query: string): SearchEntry[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ')
  if (q === '') return prepared.map((p) => p.entry)

  const direct = rank(prepared, q)
  if (direct.length > 0) return direct

  const stripped = stripQueryChrome(q)
  if (stripped !== '' && stripped !== q) return rank(prepared, stripped)
  return []
}
