import { GeoNoteSchema } from '../processes'
import { URGENCY_META, REVERSIBILITY_META, type Reversibility, type Urgency } from '../processSim'
import type { SharedRecord } from './schema'

// Read the existing mirrored metadata; no second model or inferred regional content.
export function readerContext(record: SharedRecord) {
  const notes = Array.isArray(record.metadata.geoNotes) ? record.metadata.geoNotes.flatMap(value => {
    const parsed = GeoNoteSchema.safeParse(value)
    return parsed.success ? [parsed.data] : []
  }) : []
  const urgency = typeof record.metadata.urgency === 'string' && Object.hasOwn(URGENCY_META, record.metadata.urgency)
    ? URGENCY_META[record.metadata.urgency as Urgency] : undefined
  const applicability = record.metadata.applicability
  const labels: Record<string, string> = { entity_jurisdiction: 'Entity jurisdiction', tax_jurisdiction: 'Tax jurisdiction', entity_type: 'Entity type', event_type: 'Event' }
  const applicable = applicability && typeof applicability === 'object' && !Array.isArray(applicability) ? applicability as Record<string, unknown> : {}
  const reversibility = typeof record.metadata.reversibility === 'string' && ['painful', 'irreversible'].includes(record.metadata.reversibility)
    ? REVERSIBILITY_META[record.metadata.reversibility as Reversibility] : undefined
  return {
    notes, reversibility,
    applicability: Object.entries(labels).flatMap(([key, label]) => typeof applicable[key] === 'string' ? [{ label, value: applicable[key] as string }] : []),
    exclusions: Array.isArray(applicable.exclusions) ? applicable.exclusions.filter((value): value is string => typeof value === 'string') : [],
    geoScope: typeof record.metadata.geoScope === 'string' ? record.metadata.geoScope : undefined,
    trigger: typeof record.metadata.trigger === 'string' ? record.metadata.trigger : undefined,
    urgency,
  }
}
