import type { Metadata } from 'next'
import ProcessIndex from '@/components/ProcessIndex'
import { buildPreviewIndex } from '@/lib/shared-processes/index-rows'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Process previews — Ultrametric', alternates: { canonical: '/processes/v2' }, robots: { index: false, follow: false } }

export default function SharedPreviewIndex() {
  const { rows, phases, playbooks } = buildPreviewIndex()
  return <ProcessIndex tableRows={rows} phases={phases} playbooks={playbooks} preview />
}
