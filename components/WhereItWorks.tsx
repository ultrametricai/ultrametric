import WhereItWorksStrip from '@/components/WhereItWorksStrip'
import { VENDOR_GEO_COUNTRIES, vendorGeoFor } from '@/lib/vendorGeo'

// "Where it works" (founder GEO ask 2026-09-28; compacted to a flag row, founder 2026-10-07):
// the countries where the vendor-geo spike judged the product to WORK, as one small row of
// flags — evidence, not a score, each flag linking to the vendor's OWN page the row rests on
// (crawl-verified; lib/vendorGeo.ts) with the honest note in its tooltip. Committed negatives
// stay data (jurisdictions/vendor-geo.json) — they just don't render a flag. This server half
// loads the committed rows and derives the 🌐 Global lead honestly: only when EVERY judged
// country has a committed 'available' row (never guessed from partial coverage). The client
// half (components/WhereItWorksStrip.tsx) renders the row and the selected country's inline
// note. Renders nothing for the many products without rows, so those pages are untouched.
export default function WhereItWorks({ productId }: { productId: string }) {
  const rows = vendorGeoFor(productId)
  if (rows.length === 0) return null
  const global = VENDOR_GEO_COUNTRIES.every((c) =>
    rows.some((r) => r.country === c && r.status === 'available'),
  )
  return (
    <WhereItWorksStrip
      global={global}
      rows={rows.map((r) => ({
        country: r.country,
        status: r.status,
        sourceUrl: r.sourceUrl,
        note: r.note,
        checkedAt: r.checkedAt,
      }))}
    />
  )
}
