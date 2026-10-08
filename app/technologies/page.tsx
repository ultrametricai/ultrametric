import type { Metadata } from 'next'
import Link from 'next/link'
import ControlSurfacesTable from '@/components/ControlSurfacesTable'
import GeoMark from '@/components/GeoMark'
import { computeControlSurfaces } from '@/lib/controlSurfaces'
import { loadAll } from '@/lib/data'

// Control surfaces (founder 2026-09-23): abstract TECHNOLOGIES — API, MCP, CLI, webhooks,
// built-in assistant… — ranked as an arena of their own. The "products" here are the ways an
// agent (or a human) can drive software at all; every number is aggregated from the committed
// per-arena judged verdicts (lib/controlSurfaces.ts over loadAll()), never hand-scored. Toggle
// pills re-rank client-side and mirror into ?rank= (lib/urlState.ts) so views are shareable.
export const dynamic = 'force-static'

export function generateMetadata(): Metadata {
  const { totalProducts, totalArenas, surfaces } = computeControlSurfaces(loadAll())
  return {
    title: `Control surfaces — ${surfaces.length} technologies ranked by adoption — Ultrametric`,
    description: `API, MCP, CLI, webhooks and other agent control surfaces ranked by judged adoption across ${totalProducts} products in ${totalArenas} rankings — plus each surface's pros, cons and agent-readiness lift.`,
  }
}

export default function TechnologiesPage() {
  const result = computeControlSurfaces(loadAll())

  return (
    <div className="space-y-6">
      <div>
        {/* seed "technologies": same concept mark as the Explore menu's Control surfaces entry. */}
        <p className="flex items-center gap-2 text-sm uppercase tracking-widest text-emerald-400">
          <GeoMark seed="technologies" title="Control surfaces — abstract technologies ranked" size={16} className="text-zinc-500" />
          Technologies
        </p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">Control surfaces</h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Not vendors — the abstract ways software can be driven: public API, MCP, CLI, webhooks, built-in assistants and
          more. Each surface is scored from the judged verdicts on all {result.totalProducts} products across{' '}
          {result.totalArenas} rankings: how many products ship it, how much more agent-ready the shippers are, and how far it
          reaches across markets. Pros and cons are editorial; every number is recomputable from the committed evidence.
        </p>
      </div>

      <ControlSurfacesTable surfaces={result.surfaces} emerging={result.emerging} />

      <p className="text-xs text-zinc-400">
        Rankings the data cannot honestly support are deliberately absent: &ldquo;most mobile&rdquo; and &ldquo;most
        visual&rdquo; have no fleet-wide judged stories (mobile/desktop surfaces appear below the line instead), and
        &ldquo;fastest growing&rdquo; would need per-story verdict history this repo does not commit. Verdicts are judged
        per ranking against public evidence — see the{' '}
        <Link href="/methodology" className="text-emerald-400 underline decoration-emerald-400/40 hover:text-emerald-300">
          methodology
        </Link>
        .
      </p>
    </div>
  )
}
