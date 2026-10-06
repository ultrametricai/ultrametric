import { permanentRedirect } from 'next/navigation'
import { withProcessSearchParams, type ProcessSearchParams } from '@/lib/shared-processes/redirect-query'

export const dynamic = 'force-dynamic'

export default async function SharedPreviewIndex({ searchParams }: { searchParams: Promise<ProcessSearchParams> }) {
  permanentRedirect(withProcessSearchParams('/processes/v2', await searchParams))
}
