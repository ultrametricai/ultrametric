import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ArenasDirectory from '@/components/ArenasDirectory'
import { loadArenaSections } from '@/lib/arenaSections'

// One grouped-arenas page per curated section (founder 2026-09-23: "make a page for the grouped
// arenas that have UI to get to the individual arenas") — the same cards as /arenas, scoped.
export function generateStaticParams() {
  return loadArenaSections().map((s) => ({ section: s.id }))
}

export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>
}): Promise<Metadata> {
  const { section } = await params
  const s = loadArenaSections().find((x) => x.id === section)
  return { title: `${s ? s.name : section} rankings — Ultrametric` }
}

export default async function ArenaSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  const s = loadArenaSections().find((x) => x.id === section)
  if (!s) notFound()
  return (
    <div className="space-y-6">
      <nav className="text-xs text-zinc-500">
        <Link href="/arenas" className="transition hover:text-emerald-300">
          Rankings
        </Link>{' '}
        / {s.name}
      </nav>
      <ArenasDirectory sectionId={s.id} />
    </div>
  )
}
