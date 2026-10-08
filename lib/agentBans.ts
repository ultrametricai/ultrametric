import type { CategoryData } from './data'

// Primary-slot suppression for services that have SAID no to agents (founder 2026-10-08):
// when a product's committed evidence records a named AI-agent ban, or its own front door is
// robots-walled (ProductSchema.crawlExclude carries urls.site — the government-services wall
// class), the product header's primary CTA slot renders nothing at all — no "Test in
// Ultrametric", no external-site affordance. The vendor-name link elsewhere on the page stays.
// Derived entirely from committed data (evidence packs + crawlExclude), never a hand list.

// The wall-probe scripts (pipeline/scripts/append-government-services-*-wall-probes.py) record
// a named AI-agent ban in a fixed phrasing: "named ban — <agent> present" / "named bans —
// <agent> present, …" inside a probe-tier excerpt. Matching that recorded format keeps the
// flag anchored to dated robots observations, not prose drift.
const NAMED_BAN_RE = /\bnamed bans? — /

// Trailing-slash tolerance only — crawlExclude entries mirror urls.* verbatim otherwise.
function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

// True when this product's committed evidence says agents were told not to come: a probe-tier
// named-agent-ban observation, or a blanket robots wall on the product's own front door
// (urls.site listed in crawlExclude). Pinned by test: texas-sos (named ban on its filing
// host) and virginia-scc (front door "Disallow: /" + a named ban) are true; uspto
// (auth-walled API, no ban) and companies-house (open machine rail) are false.
export function agentBanRecorded(data: CategoryData, productId: string): boolean {
  const product = data.products.find((p) => p.id === productId)
  if (!product) return false
  const excluded = (product.crawlExclude ?? []).map(normalizeUrl)
  if (excluded.includes(normalizeUrl(product.urls.site))) return true
  return (data.evidence[productId] ?? []).some(
    (e) => e.tier === 'probe' && NAMED_BAN_RE.test(e.excerpt),
  )
}
