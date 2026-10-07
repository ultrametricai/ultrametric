import type { DagNode } from '../processes'
import type { ProcessAnchorContract } from './compatibility'
import type { SharedRecord } from './schema'

/** Keep legacy assessments on their established shared scope, never every method. */
export function sourceStepScope(record: SharedRecord, node: DagNode, anchors: ProcessAnchorContract): string | undefined {
  const part = record.parts.find(part => part.id === node.id)
  if (!part || part.kind === 'reference') return
  const scope = `${record.id}:${part.id}`
  if (!node.methods?.length) return part.kind === 'step' ? scope : undefined
  if (part.kind !== 'decision') return
  if (part.options.some(option => option.id === 'default')) return `${scope}:default`
  // #182 already binds the old logo-generation activity to image-generation.
  // Reuse that reviewed identity; no mapping is inferred from the new option text.
  const target = anchors.targets[`step-${record.id}-${node.id}`]
  return part.options.some(option => `${scope}:${option.id}` === target) ? target : undefined
}
