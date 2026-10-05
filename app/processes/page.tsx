import type { Metadata } from 'next'
import ProcessIndex from '@/components/ProcessIndex'
import { buildCanonicalProcessIndex } from '@/lib/shared-processes/index-rows'

export const metadata: Metadata = {
  title: 'Going agentic with company processes — Ultrametric',
  description:
    'Startup operations in the open — every founder process, the software that runs it, and the best an agent can do today. The Agentic % of each process, human/manual gaps, and simulated dry runs over real market options.',
}

export default function ProcessesPage() {
  const { rows, phases, playbooks } = buildCanonicalProcessIndex()
  return <ProcessIndex tableRows={rows} phases={phases} playbooks={playbooks} />
}
