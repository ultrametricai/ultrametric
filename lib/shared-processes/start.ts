import type { StartTarget } from '@/lib/process-start'
import type { SharedRecord } from './schema'
import { regionalDecision } from './regions'

export function processStartTarget(record: SharedRecord): StartTarget {
  return {
    id: record.id,
    title: record.title,
    regions: regionalDecision(record)?.options.map(({ id, title, countries }) => ({ id, title, countries })) ?? [],
  }
}
