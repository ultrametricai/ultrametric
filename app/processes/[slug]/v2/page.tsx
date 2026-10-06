import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import SharedProcessPreview from '@/components/shared-processes/SharedProcessPreview'
import { findSharedRecord, readSharedCatalog, sharedPreviewHref } from '@/lib/shared-processes/reader'
import { withProcessSearchParams, type ProcessSearchParams } from '@/lib/shared-processes/redirect-query'

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
  params: Promise<{ slug: string }>; searchParams: Promise<ProcessSearchParams>
}) {
  const { slug } = await params
  const records = readSharedCatalog()
  const record = findSharedRecord(records, slug)
  if (!record) notFound()
  const href = sharedPreviewHref(record.id, records)
  if (href !== `/processes/${encodeURIComponent(slug)}/v2`) {
    permanentRedirect(withProcessSearchParams(href, await searchParams))
  }
  return <SharedProcessPreview id={record.id} />
}
