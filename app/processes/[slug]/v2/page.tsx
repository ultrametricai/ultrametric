import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import SharedProcessPreview from '@/components/shared-processes/SharedProcessPreview'
import { findSharedRecord, readSharedCatalog, sharedPreviewHref } from '@/lib/shared-processes/reader'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const records = readSharedCatalog()
  const record = findSharedRecord(records, slug)
  return {
    title: `${record?.title ?? 'Process not found'} — Preview — Ultrametric`,
    ...(record ? { alternates: { canonical: sharedPreviewHref(record.id, records) } } : {}),
    robots: { index: false, follow: false },
  }
}

export default async function SharedV2Page({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const records = readSharedCatalog()
  const record = findSharedRecord(records, slug)
  if (!record) notFound()
  const href = sharedPreviewHref(record.id, records)
  if (href !== `/processes/${encodeURIComponent(slug)}/v2`) {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(await searchParams)) {
      for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, entry)
    }
    permanentRedirect(query.size ? `${href}?${query}` : href)
  }
  return <SharedProcessPreview id={record.id} />
}
