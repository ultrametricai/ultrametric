import { permanentRedirect } from 'next/navigation'
import { sharedProcessHref } from '@/lib/shared-processes/reader'
import { withProcessSearchParams, type ProcessSearchParams } from '@/lib/shared-processes/redirect-query'

export const dynamic = 'force-dynamic'

export default async function IncorporationPreview({ searchParams }: { searchParams: Promise<ProcessSearchParams> }) {
  permanentRedirect(withProcessSearchParams(sharedProcessHref('form_001'), await searchParams))
}
