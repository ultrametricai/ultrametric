import type { Metadata } from 'next'
import OpsDashboard from '@/components/OpsDashboard'
import {
  buildArenaCoverage,
  buildCronHealth,
  buildDepthCoverage,
  buildNewsCoverage,
} from '@/lib/opsCoverage'

// UNLINKED founder coverage dashboard (founder ask 2026-09-23): depth of testing per vendor,
// arena coverage vs roadmap, missing vendors, cron/engine health, and the vendor-news monitor.
// Deliberately absent from app/sitemap.ts, the nav, the command palette (lib/search-index.ts
// PAGE_DEFS), and llms.txt — reachable only by typing the URL, the /queue and /everything
// precedent — and noindexed below.
//
// Two-layer privacy, both honest:
//   1. This static shell prerenders ONLY the non-secret aggregates computed at build time from
//      committed data/ files (all of which copy-data.mjs already serves world-readable — there
//      is nothing secret to leak; the gate is about FOCUS, not secrecy).
//   2. components/OpsDashboard.tsx applies the ADMIN GATE client-side, exactly like
//      components/DoViaAfk.tsx: a WorkOS session email on NEXT_PUBLIC_ADMIN_EMAILS or the
//      founder's `localStorage.setItem('pa-admin', '1')` switch — everyone else gets literally
//      nothing rendered beyond an empty shell.
export const metadata: Metadata = {
  title: 'Ops — coverage & engines — Ultrametric',
  description: 'Internal coverage dashboard: testing depth, ranking coverage, cron health, vendor news.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-static'

export default function OpsPage() {
  return (
    <OpsDashboard
      data={{
        depth: buildDepthCoverage(),
        arenaCoverage: buildArenaCoverage(),
        cron: buildCronHealth(),
        news: buildNewsCoverage(),
        builtAt: new Date().toISOString(),
      }}
    />
  )
}
