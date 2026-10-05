import { notFound, permanentRedirect } from 'next/navigation'
import { battleSlug, findBattleBySlug, loadAll } from '@/lib/data'

// Redirect stub (docs/BUILD-SIZE.md round 3). /vs/{slug} used to prerender a full mirror of
// every arena battle (~5 GB of artifacts, half the build output); the arena battle page
// (/arena/{category}/battle/{slug}) is now the canonical URL and every /vs slug serves a
// permanent (308) redirect to it. generateStaticParams + dynamicParams=false keep the route
// fully static — each prerendered artifact is a tiny redirect payload — so old /vs links and
// bookmarks keep working with no runtime data reads.
export function generateStaticParams() {
  return loadAll().flatMap((data) => data.rankings.battles.map((b) => ({ slug: battleSlug(b.a, b.b) })))
}

export const dynamicParams = false

// No generateMetadata: a redirecting page's metadata is never surfaced, and the battle page
// carries the title/description/canonical/FAQ JSON-LD this route used to own.

export default async function VsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // Four pair-slugs exist in two arenas (the same two products battle in e.g. both
  // ai-assistants and frontier-models). findBattleBySlug resolves those to the first category
  // in loadAll order — the same resolution this page used when it rendered, so each redirect
  // lands on the battle the /vs page previously showed.
  const found = findBattleBySlug(loadAll(), slug)
  if (!found) notFound() // unreachable under dynamicParams=false; defensive for direct renders
  permanentRedirect(`/arena/${found.data.category.id}/battle/${slug}`)
}
