import type { Product } from '@/lib/schemas'

// Founder 2026-10-02: the 'Open app ↗' chip is gone — links.app stays schema data, this surface
// just stops rendering it (the vendor-name link in the header already opens the vendor's site).
const LINK_KEYS = ['api', 'cli', 'mcp'] as const
type LinkKey = (typeof LINK_KEYS)[number]

const LETTER: Record<LinkKey, string> = { api: 'API', cli: 'CLI', mcp: 'MCP' }
// Functional labels (founder rule: say what clicking does, not just name the surface — "Open"
// as a heading over bare nouns read as filler). These are all docs links.
const LABEL: Record<LinkKey, string> = { api: 'API docs ↗', cli: 'CLI docs ↗', mcp: 'MCP docs ↗' }

// Product quick links (schema: Product.links). Curation is a separate pass — most products
// have none yet, so this renders nothing until a links object is present.
export default function ProductLinkChips({ product, variant }: { product: Product; variant: 'letter' | 'label' }) {
  const links = product.links
  if (!links) return null
  const present = LINK_KEYS.filter((k) => links[k])
  if (present.length === 0) return null

  const text = variant === 'letter' ? LETTER : LABEL
  const chipClass =
    variant === 'letter'
      ? 'rounded border border-zinc-800 px-1 py-0.5 text-[10px] font-medium text-zinc-400 hover:border-emerald-400 hover:text-emerald-300'
      : 'rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:border-emerald-400 hover:text-emerald-300'

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {present.map((k) => (
        // Letter chips are bare glyphs ("A") — only they need the title carrying the functional
        // label; the label variant's chip text already says it (founder tooltip sweep
        // 2026-10-02: no tooltips that restate the visible label).
        <a key={k} href={links[k]} target="_blank" rel="noopener noreferrer" title={variant === 'letter' ? LABEL[k].replace(' ↗', '') : undefined} className={chipClass}>
          {text[k]}
        </a>
      ))}
    </div>
  )
}
