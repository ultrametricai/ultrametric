import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SharedProcessPreview from '@/components/shared-processes/SharedProcessPreview'
import { findSharedRecord, readSharedCatalog, sharedProcessHref } from '@/lib/shared-processes/reader'
import { buildProcessRouteRegistry } from '@/lib/shared-processes/routes'
import { loadProcesses } from '@/lib/processes'
import { processManifestPath } from '@/lib/processManifest'
import { SITE_URL } from '@/lib/site'

export const dynamicParams = false

export function generateStaticParams() {
  return [...buildProcessRouteRegistry(readSharedCatalog()).slugs.values()].map(slug => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const records = readSharedCatalog()
  const record = findSharedRecord(records, slug)
  if (!record) return { title: 'Process not found — Ultrametric' }
  const href = sharedProcessHref(record.id, records)
  // Existing manifests retain their default-DAG execution contract.
  const hasManifest = loadProcesses().some(task => task.id === record.id)
  return {
    title: `${record.title} — Processes — Ultrametric`,
    description: record.summary,
    alternates: {
      canonical: `${SITE_URL}${href}`,
      ...(hasManifest ? { types: { 'application/json': processManifestPath(href.split('/').at(-1)!) } } : {}),
    },
  }
}

export default async function ProcessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const record = findSharedRecord(readSharedCatalog(), slug)
  if (!record) notFound()
  return <SharedProcessPreview id={record.id} />
}
