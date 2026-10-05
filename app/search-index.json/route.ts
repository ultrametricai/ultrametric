import { NextResponse } from 'next/server'
import { buildAllSearchEntries } from '@/lib/search-entries'

// The ⌘K palette's full index, rendered ONCE at build time and CDN-served as one ~160 KB JSON
// the client fetches on first palette open. This replaced passing the index as props from
// app/layout.tsx to the CommandPalette client component, which serialized it into every
// prerendered page's flight payload (~4.5 GB of .next/server/app and 160 KB of every page's
// wire HTML — docs/BUILD-SIZE.md problem 2). force-static is also what keeps the repo-data fs
// reads inside buildAllSearchEntries build-time-only, compatible with the data/** tracing
// excludes in next.config.ts (scripts/check-preview-runtime.mjs verifies this route's trace).
export const dynamic = 'force-static'

export async function GET() {
  return NextResponse.json(buildAllSearchEntries())
}
