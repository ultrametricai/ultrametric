import ArtifactChips from '@/components/ArtifactChips'
import StepDocuments from '@/components/StepDocuments'
import { StepCostChip, StepVerifyLine } from '@/components/StepVerifyCost'
import { loadArtifacts, StepCostSchema, StepVerifySchema } from '@/lib/processes'
import type { ArtifactChip } from '@/lib/processDeps'
import type { SharedRecord } from '@/lib/shared-processes/schema'
import { sharedPreviewHref } from '@/lib/shared-processes/reader'

const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
export function SharedArtifacts({ metadata, sourceId, records }: { metadata: Record<string, unknown>; sourceId: string; records: SharedRecord[] }) {
  const registry = loadArtifacts()
  const chip = (id: string): ArtifactChip[] => {
    const artifact = registry.find(item => item.id === id)
    const producer = artifact && records.find(item => item.id === artifact.producedBy)
    return artifact && producer ? [{ id, label: artifact.label, description: artifact.description, producerId: producer.id, producerTitle: producer.title, producerHref: sharedPreviewHref(producer.id, records), producedHere: producer.id === sourceId }] : []
  }
  return <ArtifactChips rows={{ needs: strings(metadata.requires).flatMap(chip), produces: [...new Set([...strings(metadata.produces), ...(typeof metadata.producesArtifact === 'string' ? [metadata.producesArtifact] : [])])].flatMap(chip) }} />
}

export default function StepMetadata({ metadata, sourceId, records }: { metadata: Record<string, unknown>; sourceId: string; records: SharedRecord[] }) {
  const cost = StepCostSchema.safeParse(metadata.cost)
  const verify = StepVerifySchema.safeParse(metadata.verify)
  // The '⚠ if it goes wrong' failure-modes block no longer renders on steps (founder
  // 2026-10-05) — display only: metadata.failureModes stays in the shared records untouched.
  return <>
    {cost.success && <div className="space-y-2"><StepCostChip cost={cost.data} squareExternalLinks />{cost.data.note && <details className="text-xs text-zinc-400"><summary className="cursor-pointer">Cost details</summary><p className="mt-2 leading-relaxed">{cost.data.note}</p></details>}</div>}
    <StepDocuments documents={strings(metadata.documents)} squareExternalLinks />
    <SharedArtifacts metadata={metadata} sourceId={sourceId} records={records} />
    {verify.success && <StepVerifyLine verify={verify.data} squareExternalLinks />}
  </>
}
