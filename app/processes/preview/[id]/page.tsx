import { notFound, permanentRedirect } from 'next/navigation'
import { findSharedRecord, readSharedCatalog, sharedPreviewHref } from '@/lib/shared-processes/reader'
import { withProcessSearchParams, type ProcessSearchParams } from '@/lib/shared-processes/redirect-query'

export const dynamic = 'force-dynamic'

export default async function SharedPreviewPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<ProcessSearchParams>
}) {
  const { id } = await params
  const records = readSharedCatalog()
  const record = findSharedRecord(records, id)
  if (!record) notFound()
  permanentRedirect(withProcessSearchParams(sharedPreviewHref(record.id, records), await searchParams))
}
