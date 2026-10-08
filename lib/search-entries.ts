import { ARENA_ICONS } from '@/lib/arenaIcons'
import { loadBusinessLogicMap } from '@/lib/businessLogicMap'
import { loadAll } from '@/lib/data'
import { loadDocumentRegistry } from '@/lib/documents'
import { hasLogo } from '@/lib/logos'
import { loadAiStacks } from '@/lib/aiStacks'
import { readmeComputes } from '@/lib/openModulePages'
import { loadArtifacts, loadChains, loadProcesses, processSlug } from '@/lib/processes'
import {
  buildArtifactEntries,
  buildChainEntries,
  buildDocumentEntries,
  buildModuleEntries,
  buildPageEntries,
  buildProcessEntries,
  buildSearchIndex,
  buildStackEntries,
  V2_PRODUCT_ENTRY,
  type SearchEntry,
} from '@/lib/search-index'
import searchAliases from '@/data/search-aliases.json'

// The complete ⌘K palette index — every arena, product, stack, process, chain, and tool page.
// Moved here verbatim from app/layout.tsx (2026-10-02): the layout used to pass this array as
// props to the CommandPalette client component, which serialized the ~160 KB index into every
// prerendered page's flight payload (~4.5 GB of .next/server/app across ~7k pages, and 160 KB
// of every page's wire HTML — docs/BUILD-SIZE.md problem 2). Now it is rendered ONCE by the
// force-static /search-index.json route handler and fetched lazily when the palette opens.
// Build-time only: every loader here reads the repo with fs, so this module must never be
// called at request time from a force-dynamic route (the data/** tracing excludes in
// next.config.ts would make those reads ENOENT on Vercel).
export function buildAllSearchEntries(): SearchEntry[] {
  // The two full global rankings (see app/rankings/*) aren't arenas, but they're arena-shaped
  // (a ranked list you land on and browse) — surfacing them as `type: 'arena'` groups them with
  // the per-category arenas in the palette instead of inventing a one-off section for two items.
  // Alias phrases people actually type ("agent harness", "etl", "mcp adoption") come from
  // data/search-aliases.json — see lib/search-index.ts for the matcher that consumes them.
  const pageAliases = searchAliases.pages as Record<string, string[]>
  return [
    ...buildSearchIndex(loadAll(), {
      // House icon tokens (lib/arenaIcons.ts) — the palette renders them as the custom duotone
      // glyphs via IconGlyph; the legacy emoji stay in data/arena-icons.json as guides.
      arenaIcons: ARENA_ICONS,
      hasLogo,
      keywords: searchAliases.arenas as Record<string, string[]>,
    }),
    { type: 'arena', label: 'Most agent-ready (full ranking)', sublabel: 'All products, ranked by agent-readiness', href: '/rankings/agentic', keywords: pageAliases['/rankings/agentic'] },
    { type: 'arena', label: 'Best built-in AI (full ranking)', sublabel: 'All products, ranked by Built-in AI features', href: '/rankings/ai-native', keywords: pageAliases['/rankings/ai-native'] },
    { type: 'arena', label: 'Claims vs reality (full ranking)', sublabel: 'All products, ranked by claims integrity', href: '/rankings/claims-integrity', keywords: pageAliases['/rankings/claims-integrity'] },
    { type: 'arena', label: 'Most connected (full ranking)', sublabel: 'Products ranked by verified integrations', href: '/rankings/most-connected', keywords: pageAliases['/rankings/most-connected'] },
    { type: 'arena', label: 'Most tested (full ranking)', sublabel: 'All products, ranked by tested-evidence share', href: '/rankings/most-tested', keywords: pageAliases['/rankings/most-tested'] },
    { type: 'arena', label: 'Rising & falling (30-day moves)', sublabel: 'Biggest Overall score gains and falls', href: '/rankings/rising', keywords: pageAliases['/rankings/rising'] },
    { type: 'arena', label: 'Most popular (stars, installs, 🔥 hot)', sublabel: 'Popularity measured fairly, by segment', href: '/rankings/popular', keywords: pageAliases['/rankings/popular'] },
    { type: 'arena', label: 'Lowest lock-in (full ranking)', sublabel: 'Self-hosting, data export, open licenses, API parity', href: '/rankings/most-open', keywords: pageAliases['/rankings/most-open'] },
    { type: 'arena', label: 'Best API (full ranking)', sublabel: 'All products, ranked by API quality', href: '/rankings/best-api', keywords: pageAliases['/rankings/best-api'] },
    // The government country boards (founder 2026-10-08): the one jurisdiction-tagged arena's
    // per-country rollup tables, reachable by the stable #country-rankings anchor
    // (components/CountryRankings.tsx renders id="country-rankings" on /arena/government-services).
    { type: 'arena', label: 'Government services by country', sublabel: 'Country boards: matched agencies, computed rollups', href: '/arena/government-services#country-rankings', keywords: pageAliases['/arena/government-services#country-rankings'] },
    ...buildStackEntries(loadAiStacks(), searchAliases.stacks as Record<string, string[]>),
    // The ⌘K 'Processes' group (founder 2026-10-02: defaults include processes): the
    // /processes index entry plus the high-traffic processes below. Ids come from
    // processes/corpus.json; titles/slugs resolve through loadProcesses/processSlug so a
    // rename can never strand a palette row — a missing id fails the build loudly instead
    // of silently dropping a founder-curated entry.
    ...buildProcessEntries(
      ['form_001', 'form_002', 'qs_023', 'qs_063', 'fund_001', 'tax_001'].map((id) => {
        const t = loadProcesses().find((p) => p.id === id)
        if (!t) throw new Error(`⌘K high-traffic process ${id} missing from processes/corpus.json`)
        return { slug: processSlug(t.title), title: t.title, sublabel: `Founder process · ${t.phase}` }
      }),
      pageAliases,
    ),
    // The Situations index (founder 2026-10-02: situations moved out of /processes onto their
    // own area) — one ⌘K entry beside the process group; the 12 detail pages stay reachable
    // as /processes/<slug> rows via the fat search and their aliases.
    {
      type: 'process',
      label: 'Situations',
      sublabel: 'When something hits — lawsuit, breach, tax notice… trigger + urgency',
      href: '/situations',
      keywords: (pageAliases['/situations'] ?? []).map((k) => k.toLowerCase()),
    },
    ...buildPageEntries(pageAliases),
    // The company's own CLI/MCP product page (app/v2) — a `product` row in the palette.
    V2_PRODUCT_ENTRY,
    // End-to-end playbooks (process chains) — searchable by name and by the journey phrases
    // people actually type ("raise a seed round", "launch on product hunt").
    ...buildChainEntries(loadChains(), pageAliases),
    // The object-page families (founder 2026-10-08: "search can't find 83b"). Modules come
    // BEFORE artifacts on purpose: both registries carry a "Cap table" label, exact-label ties
    // break on index order, and 'cap table' should land on the open module (founder pin).
    // Aliases are keyed by registry id (data/search-aliases.json `modules` / `artifacts`) —
    // integrity-tested against the registries in lib/__tests__/search-matching.test.ts.
    // The lore registry (lore/registry.json) stays out: it has no site surface to link.
    ...buildModuleEntries(
      Object.entries(loadBusinessLogicMap()).map(([id, m]) => {
        const computes = readmeComputes().get(m.anchor)
        // Same loud failure as lib/openModulePages.ts: a module missing its README index row
        // must fail the build, not silently drop a palette row.
        if (!computes) throw new Error(`⌘K open module ${id} missing from open-modules/README.md module index`)
        return { id, label: m.label, computes }
      }),
      searchAliases.modules as Record<string, string[]>,
    ),
    ...buildArtifactEntries(
      (() => {
        const titleById = new Map(loadProcesses().map((t) => [t.id, t.title]))
        return loadArtifacts().map((a) => {
          const producerTitle = titleById.get(a.producedBy)
          if (!producerTitle) throw new Error(`⌘K artifact ${a.id} names unknown producer ${a.producedBy}`)
          return { id: a.id, label: a.label, producerTitle }
        })
      })(),
      searchAliases.artifacts as Record<string, string[]>,
    ),
    ...buildDocumentEntries(
      loadDocumentRegistry().documents.map((d) => ({ name: d.name, publisher: d.publisher })),
    ),
  ]
}
