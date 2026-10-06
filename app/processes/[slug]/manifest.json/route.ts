import { buildProcessManifest } from '@/lib/processManifest'
import { findProcessBySlug, loadProcesses, processSlug } from '@/lib/processes'

// Machine-readable process manifest — the executor handoff contract (docs/AFK-HANDOFF.md).
// Public data: the published corpus reshaped, no gating. Static export safety: every {slug} is
// enumerated at build time (generateStaticParams + dynamicParams = false), same pattern as
// app/arena/[category]/llms.md/route.ts. Every key a process answers to — the canonical title
// slug, the immutable corpus id, and the renamed-process alias slugs — serves the SAME
// canonical execution payload (docs/PR171-EXTRACTION.md, port plan item 2), so an agent
// holding any published process URL or the stable id reaches the one handoff contract.
export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return loadProcesses().flatMap((t) => [
    { slug: processSlug(t.title) },
    { slug: t.id },
    ...(t.slugAliases ?? []).map((a) => ({ slug: a.slug })),
  ])
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // findProcessBySlug covers the canonical and alias slugs; the id lookup covers the
  // stable corpus id. The payload is always built from the one task — canonical identity.
  const task = findProcessBySlug(slug) ?? loadProcesses().find((t) => t.id === slug) ?? null
  const manifest = task ? buildProcessManifest(task) : null
  if (!manifest) return new Response('not found', { status: 404 })
  // Pretty-printed on purpose — a public artifact humans will read in the browser too.
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}
