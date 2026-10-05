import DocsMenu, { type DocsMenuEntry } from '@/components/DocsMenu'
import type { Product } from '@/lib/schemas'

// Founder 2026-10-02: the 'Open app ↗' chip is gone — links.app stays schema data, this surface
// just stops rendering it (the vendor-name link in the header already opens the vendor's site).
const LINK_KEYS = ['api', 'cli', 'mcp'] as const

// Functional labels (founder rule: say what clicking does, not just name the surface). These
// are all docs links; the external-link mark renders beside each entry in the menu.
const LABEL: Record<(typeof LINK_KEYS)[number], string> = { api: 'API docs', cli: 'CLI docs', mcp: 'MCP docs' }

// The vendor-docs destinations behind the Docs menu, in stable API/CLI/MCP order — also what
// the product header's mobile quick-access table folds into its rows (one surface per row).
export function productDocEntries(product: Product): DocsMenuEntry[] {
  const links = product.links
  if (!links) return []
  return LINK_KEYS.filter((k) => links[k]).map((k) => ({ label: LABEL[k], href: links[k]! }))
}

// Product quick links (schema: Product.links). Founder 2026-10-05: the row of separate
// "API docs ↗ / CLI docs ↗ / MCP docs ↗" chips collapsed into ONE accessible "Docs" dropdown
// (components/DocsMenu.tsx) — each entry keeps its destination and external-link mark. The
// vendor-site link stays where it is (the vendor name under the title). Curation is a separate
// pass — most products have no links object yet, so this renders nothing until one is present.
export default function ProductLinkChips({ product }: { product: Product }) {
  const entries = productDocEntries(product)
  if (entries.length === 0) return null
  return <DocsMenu entries={entries} />
}
