import ArtifactChips from '@/components/ArtifactChips'
import StepDocuments from '@/components/StepDocuments'
import { costChipText } from '@/components/StepVerifyCost'
import { costSummary } from '@/lib/shared-processes/cost-summary'
import ExternalLinkMark from './ExternalLinkMark'
import { loadArtifacts, StepCostSchema } from '@/lib/processes'
import type { ArtifactChip } from '@/lib/processDeps'
import type { SharedRecord } from '@/lib/shared-processes/schema'
import { sharedPreviewHref } from '@/lib/shared-processes/reader'

const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
export function hasSharedDocuments(metadata: Record<string, unknown>) { return strings(metadata.documents).length > 0 }
export function SharedDocuments({ metadata }: { metadata: Record<string, unknown> }) {
  return <StepDocuments readable column documents={strings(metadata.documents)} squareExternalLinks />
}
export function SharedArtifacts({ metadata, sourceId, records }: { metadata: Record<string, unknown>; sourceId: string; records: SharedRecord[] }) {
  const registry = loadArtifacts()
  const chip = (id: string): ArtifactChip[] => {
    const artifact = registry.find(item => item.id === id)
    const producer = artifact && records.find(item => item.id === artifact.producedBy)
    return artifact && producer ? [{ id, label: artifact.label, description: artifact.description, producerId: producer.id, producerTitle: producer.title, producerHref: sharedPreviewHref(producer.id, records), producedHere: producer.id === sourceId }] : []
  }
  return <ArtifactChips readable rows={{ needs: strings(metadata.requires).flatMap(chip), produces: [...new Set([...strings(metadata.produces), ...(typeof metadata.producesArtifact === 'string' ? [metadata.producesArtifact] : [])])].flatMap(chip) }} />
}

export default function StepMetadata({ metadata, sourceId, records }: { metadata: Record<string, unknown>; sourceId: string; records: SharedRecord[] }) {
  const cost = StepCostSchema.safeParse(metadata.cost)
  // The '⚠ if it goes wrong' failure-modes block no longer renders on steps (founder
  // 2026-10-05) — display only: metadata.failureModes stays in the shared records untouched.
  return <>
    {cost.success && <div className="space-y-2 text-sm leading-5 text-zinc-300 [overflow-wrap:anywhere]">
      <p className="text-base leading-relaxed"><span className="font-normal text-zinc-400">Costs:</span>{' '}{costSummary(cost.data)}</p>
      <details className="text-sm text-zinc-400">
        <summary className="cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-300">Cost details</summary>
        <p className="mt-2 leading-relaxed">{costChipText(cost.data)}</p>
        {cost.data.note && <p className="mt-2 leading-relaxed">{cost.data.note}</p>}
        <p className="mt-2 leading-relaxed"><a href={cost.data.source} target="_blank" rel="noopener noreferrer" className="rounded-sm text-zinc-300 underline underline-offset-4 hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-300">{new URL(cost.data.source).hostname.replace(/^www\./, '')}<ExternalLinkMark href={cost.data.source} label="" /></a>{' · '}as of {cost.data.asOf}</p>
      </details>
    </div>}
    <SharedArtifacts metadata={metadata} sourceId={sourceId} records={records} />
  </>
}
