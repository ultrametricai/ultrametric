import Link from 'next/link'
import GeoMark from '@/components/GeoMark'
import { TABLE_HEADER_ROW, TABLE_SHELL } from '@/components/tableStyles'
import { AREA_NAMES, COUNTRY_NAMES, type Rollups } from '@/lib/rollups'
import type { Product } from '@/lib/schemas'

// Country rankings for jurisdiction-tagged arenas (government-services): the country overall
// table plus per-area boards, rendered straight from data/<arena>/rollups.json — a pure
// derivation over the arena's computed Overall scores (see lib/rollups.ts), recomputed and
// byte-pinned by recompute-check. Server component: every number links back to the judged
// agency rows it averages, so each cell is traceable to judged cells.

function Score({ value }: { value: number | null }) {
  if (value === null) return <span className="text-zinc-600">—</span>
  return <span className="font-medium tabular-nums">{value.toFixed(1)}</span>
}

function AgencyLinks({ categoryId, productIds, products }: { categoryId: string; productIds: string[]; products: Product[] }) {
  const byId = new Map(products.map((p) => [p.id, p]))
  return (
    <span className="block text-[11px] leading-tight text-zinc-500">
      {productIds.map((id, i) => (
        <span key={id}>
          {i > 0 && ' · '}
          <Link href={`/arena/${categoryId}/product/${id}`} className="hover:text-emerald-300">
            {byId.get(id)?.name ?? id}
          </Link>
        </span>
      ))}
    </span>
  )
}

export default function CountryRankings({
  categoryId,
  rollups,
  products,
}: {
  categoryId: string
  rollups: Rollups
  products: Product[]
}) {
  const areaName = (a: string) => AREA_NAMES[a] ?? a
  const countryName = (c: string) => COUNTRY_NAMES[c] ?? c
  const unmatchedAreas = Object.keys(rollups.areaBoards).filter((a) => !rollups.matchedAreas.includes(a))
  return (
    <div id="country-rankings" className="scroll-mt-4 space-y-6">
      <div>
        <h2 className="font-display leading-[1.1] mb-1 flex items-center gap-2 text-lg font-semibold">
          <GeoMark seed="country-rankings" title="Country rankings — matched agencies, computed rollups" size={18} className="text-zinc-500" />
          Country rankings
        </h2>
        <p className="mb-4 text-sm text-zinc-500">
          Each country is represented by its judged agencies in the matched areas; every number is the
          mean of the linked agencies&apos; computed Overall scores.
        </p>
        <div className={TABLE_SHELL}>
          <table aria-label="Country rankings" className="w-full border-collapse text-sm">
            <thead>
              <tr className={TABLE_HEADER_ROW}>
                <th scope="col" className="w-8 px-3 py-2 font-normal">#</th>
                <th scope="col" className="px-3 py-2 font-normal">Country</th>
                <th scope="col" className="px-3 py-2 font-normal">Overall</th>
                {rollups.matchedAreas.map((a) => (
                  <th key={a} scope="col" className="px-3 py-2 font-normal">{areaName(a)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rollups.countries.map((c, i) => (
                <tr key={c.country} className="border-b border-zinc-900 last:border-b-0 align-top">
                  <td className="px-3 py-2 text-zinc-500">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">{countryName(c.country)}</td>
                  <td className="px-3 py-2"><Score value={c.overall} /></td>
                  {rollups.matchedAreas.map((a) => {
                    const cell = c.areas[a]
                    return (
                      <td key={a} className="px-3 py-2">
                        {cell ? (
                          <>
                            <Score value={cell.score} />
                            <AgencyLinks categoryId={categoryId} productIds={cell.productIds} products={products} />
                          </>
                        ) : (
                          <span className="text-zinc-600">not judged</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <h3 className="font-display leading-[1.1] mb-3 text-base font-semibold">Area rankings across countries</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {rollups.matchedAreas.map((area) => (
            <div key={area} className="rounded-xl border border-zinc-800 p-4">
              <p className="mb-2 text-sm font-medium">{areaName(area)}</p>
              <ol className="space-y-1.5">
                {(rollups.areaBoards[area] ?? []).map((row, i) => (
                  <li key={row.country} className="flex items-baseline gap-2 text-sm">
                    <span className="w-4 text-xs text-zinc-500">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      {countryName(row.country)}
                      <AgencyLinks categoryId={categoryId} productIds={row.productIds} products={products} />
                    </span>
                    <Score value={row.score} />
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        A country&apos;s score covers exactly the matched areas judged here — {rollups.matchedAreas.map(areaName).join(', ').toLowerCase()},
        through the agencies linked in each cell — and nothing more. Where a cell lists several agencies
        (the US state registries; IRS and EFTPS for US tax), the cell is their mean. A country gets an
        overall only when every matched area is judged.
        {unmatchedAreas.length > 0 && (
          <> Areas judged in a single country ({unmatchedAreas.map(areaName).join(', ').toLowerCase()}) sit outside the country rollup.</>
        )}{' '}
        Rollups are derived at pipeline time from the computed scores (data/{categoryId}/rollups.json), recomputed
        and verified on every change.
      </p>
    </div>
  )
}
