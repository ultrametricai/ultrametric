import type { MetadataRoute } from 'next'
import { loadArenaSections } from '@/lib/arenaSections'
import { battleSlug, loadAll } from '@/lib/data'
import { collectGlobalStories } from '@/lib/globalStories'
import { loadBusinessLogicMap } from '@/lib/businessLogicMap'
import { loadCompanyFields } from '@/lib/companyFields'
import { loadArtifacts, loadChains, loadProcesses, processSlug } from '@/lib/processes'
import { loadFamilies } from '@/lib/families'
import { loadIcpTypes } from '@/lib/icp'
import { SITE_URL } from '@/lib/site'
import { buildYcRows } from '@/lib/yc'

// Static export safety: no dynamic segments, all data is bundled at build time.
export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const categories = loadAll()
  const now = new Date()
  // One /alternatives/[product] page per unique product id (see that page's dedupe rule).
  const seenProductIds = new Set<string>()

  // Deliberately absent: /watchlist (session-gated, noindex — same posture as /account's
  // WATCHLIST_ENABLED; add it here when the flag flips), /rankings/init (the homepage
  // mega-table's default view already owns that ranking's search intent), and /everything
  // (unlisted by founder call — the route stays alive for old links but isn't advertised).
  const entries: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now },
    { url: `${SITE_URL}/arenas`, lastModified: now },
    ...loadArenaSections().map((s) => ({ url: `${SITE_URL}/arenas/${s.id}`, lastModified: now })),
    { url: `${SITE_URL}/methodology`, lastModified: now },
    { url: `${SITE_URL}/about`, lastModified: now },
    { url: `${SITE_URL}/terms`, lastModified: now },
    { url: `${SITE_URL}/privacy`, lastModified: now },
    // Company pages ported from the retired Astro landing (founder 2026-09-29, one top bar
    // sitewide). The landing homepage itself is the SITE_URL root entry above (the worker maps
    // '/' → /home; app/home's canonical is the root, so /home is deliberately not listed).
    { url: `${SITE_URL}/company`, lastModified: now },
    { url: `${SITE_URL}/tos`, lastModified: now },
    // The Ultrametric CLI/MCP product page, ported from the /v2 landing origin (2026-09-29).
    // Listed per founder registration ask even though the page still ships the live page's
    // noindex,nofollow — the robots meta wins until the founder flips it (see app/get-started/page.tsx).
    { url: `${SITE_URL}/get-started`, lastModified: now },
    { url: `${SITE_URL}/pipeline`, lastModified: now },
    { url: `${SITE_URL}/llms.txt`, lastModified: now },
    { url: `${SITE_URL}/openapi.json`, lastModified: now },
    { url: `${SITE_URL}/proofs`, lastModified: now },
    { url: `${SITE_URL}/certified`, lastModified: now },
    { url: `${SITE_URL}/predictions`, lastModified: now },
    { url: `${SITE_URL}/missing`, lastModified: now },
    { url: `${SITE_URL}/reports`, lastModified: now },
    { url: `${SITE_URL}/badges`, lastModified: now },
    { url: `${SITE_URL}/integrations`, lastModified: now },
    { url: `${SITE_URL}/my-stack`, lastModified: now },
    { url: `${SITE_URL}/stacks/battle`, lastModified: now },
    // Open-startup toolkit (lib/openstartup/): the founder-usable open modules.
    { url: `${SITE_URL}/rankings/agentic`, lastModified: now },
    { url: `${SITE_URL}/rankings/ai-native`, lastModified: now },
    { url: `${SITE_URL}/rankings/claims-integrity`, lastModified: now },
    { url: `${SITE_URL}/rankings/most-connected`, lastModified: now },
    { url: `${SITE_URL}/rankings/most-tested`, lastModified: now },
    { url: `${SITE_URL}/rankings/rising`, lastModified: now },
    { url: `${SITE_URL}/rankings/popular`, lastModified: now },
    { url: `${SITE_URL}/rankings/most-open`, lastModified: now },
    { url: `${SITE_URL}/rankings/best-api`, lastModified: now },
    // Arena-scoped company ranking: the judged startup-law-firms leaderboard as a focused view.
    { url: `${SITE_URL}/rankings/law-firms`, lastModified: now },
    // Control surfaces — abstract technologies (API/MCP/CLI…) ranked from judged verdicts
    // (lib/controlSurfaces.ts, app/technologies/page.tsx).
    { url: `${SITE_URL}/technologies`, lastModified: now },
    // Process rankings (🔁 group in the Explore menu — launch audit S5).
    { url: `${SITE_URL}/rankings/processes/most-automatable`, lastModified: now },
    { url: `${SITE_URL}/rankings/processes/best-covered`, lastModified: now },
    { url: `${SITE_URL}/rankings/processes/riskiest`, lastModified: now },
    { url: `${SITE_URL}/rankings/processes/most-annoying`, lastModified: now },
    { url: `${SITE_URL}/rankings/processes/growth-drivers`, lastModified: now },
  ]

  for (const data of categories) {
    const generatedAt = new Date(data.rankings.generatedAt)
    entries.push({ url: `${SITE_URL}/arena/${data.category.id}`, lastModified: generatedAt })
    entries.push({ url: `${SITE_URL}/arena/${data.category.id}/llms.md`, lastModified: generatedAt })
    // /checklist and /report per-arena pages unadvertised (founder 2026-09-25) — routes alive.

    for (const product of data.products) {
      entries.push({ url: `${SITE_URL}/arena/${data.category.id}/product/${product.id}`, lastModified: generatedAt })
      entries.push({ url: `${SITE_URL}/arena/${data.category.id}/product/${product.id}/llms.md`, lastModified: generatedAt })
      // The per-vendor transparent calculation page ("the receipt" — see
      // app/arena/[category]/product/[id]/score/page.tsx): one per product, same cadence.
      entries.push({ url: `${SITE_URL}/arena/${data.category.id}/product/${product.id}/score`, lastModified: generatedAt })
      if (!seenProductIds.has(product.id)) {
        seenProductIds.add(product.id)
        entries.push({ url: `${SITE_URL}/alternatives/${product.id}`, lastModified: generatedAt })
      }
    }

    for (const battle of data.rankings.battles) {
      const slug = battleSlug(battle.a, battle.b)
      // The battle page is the canonical head-to-head URL; /vs/{slug} is a permanent redirect
      // to it (see app/vs/[slug]/page.tsx) and redirect stubs don't belong in the sitemap.
      entries.push({ url: `${SITE_URL}/arena/${data.category.id}/battle/${slug}`, lastModified: generatedAt })
    }
  }

  // Cross-arena capability pages: the /global adoption index (app/global/page.tsx) plus one
  // /global/[story] comparison page per global story present in ≥2 arenas (see
  // lib/globalStories.ts and app/global/[story]/page.tsx).
  entries.push({ url: `${SITE_URL}/global`, lastModified: now })
  for (const story of collectGlobalStories(categories)) {
    entries.push({ url: `${SITE_URL}/global/${story.id}`, lastModified: now })
  }

  // Founder processes + curated chains (see lib/processes.ts and app/processes/*), plus the
  // decision-driven Virtual Startup journey over the same corpus (app/startup-sim). The
  // /situations index (founder 2026-10-02) lists the reactive records; their detail pages stay
  // /processes/<slug> rows in the loadProcesses loop below.
  entries.push({ url: `${SITE_URL}/processes`, lastModified: now })
  entries.push({ url: `${SITE_URL}/situations`, lastModified: now })
  // The open-documents registry index (founder 2026-10-03, with the open-documents/ rename);
  // /documents 308s here via next.config.ts.
  entries.push({ url: `${SITE_URL}/open-documents`, lastModified: now })
  entries.push({ url: `${SITE_URL}/processes/operating-rhythm`, lastModified: now })
  entries.push({ url: `${SITE_URL}/startup-sim`, lastModified: now })
  for (const task of loadProcesses()) {
    entries.push({ url: `${SITE_URL}/processes/${processSlug(task.title)}`, lastModified: now })
  }
  for (const chain of loadChains()) {
    entries.push({ url: `${SITE_URL}/processes/chains/${chain.id}`, lastModified: now })
  }

  // Open-module and artifact page families (founder 2026-10-05): the committed registries
  // (processes/business-logic-map.json, processes/artifacts.json) are the param sources — the
  // same ids app/open-modules/[id] and app/artifacts/[id] prerender.
  entries.push({ url: `${SITE_URL}/open-modules`, lastModified: now })
  for (const id of Object.keys(loadBusinessLogicMap())) {
    entries.push({ url: `${SITE_URL}/open-modules/${id}`, lastModified: now })
  }
  entries.push({ url: `${SITE_URL}/artifacts`, lastModified: now })
  for (const artifact of loadArtifacts()) {
    entries.push({ url: `${SITE_URL}/artifacts/${artifact.id}`, lastModified: now })
  }

  // Company data fields (founder 2026-10-08): the specification pages — the committed registry
  // (processes/company-fields.json) is the param source, the same ids app/fields/[id]
  // prerenders.
  entries.push({ url: `${SITE_URL}/fields`, lastModified: now })
  for (const field of loadCompanyFields()) {
    entries.push({ url: `${SITE_URL}/fields/${field.id}`, lastModified: now })
  }

  // Product-family breakdown pages — one per multi-product vendor (see lib/families.ts and
  // app/family/[id]/page.tsx).
  for (const family of loadFamilies()) {
    entries.push({ url: `${SITE_URL}/family/${family.id}`, lastModified: now })
  }

  // ICP lens pages — the index plus one cross-arena ranking per buyer type (see lib/icp.ts and
  // app/icp/[type]/page.tsx).
  entries.push({ url: `${SITE_URL}/icp`, lastModified: now })
  for (const icp of loadIcpTypes()) {
    entries.push({ url: `${SITE_URL}/icp/${icp.id}`, lastModified: now })
  }

  // YC batch pages — the index plus one ranking per batch with tracked products (see lib/yc.ts
  // and app/yc/[batch]/page.tsx; lowercase batch code in the URL, e.g. /yc/w23).
  entries.push({ url: `${SITE_URL}/yc`, lastModified: now })
  for (const code of new Set(buildYcRows(categories).map((r) => r.ycBatch))) {
    entries.push({ url: `${SITE_URL}/yc/${code.toLowerCase()}`, lastModified: now })
  }

  return entries
}
