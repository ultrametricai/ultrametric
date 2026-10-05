// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import SharedProcessReader from '@/components/shared-processes/SharedProcessReader'
import { loadSharedProcesses } from '../shared-processes/load'
import type { SharedRecord } from '../shared-processes/schema'

const records = loadSharedProcesses()
afterEach(cleanup)
const outputs = (metadata: Record<string, unknown>): string[] => [
  ...(Array.isArray(metadata.produces) ? metadata.produces.filter((value): value is string => typeof value === 'string') : []),
  ...(typeof metadata.producesArtifact === 'string' ? [metadata.producesArtifact] : []),
]

it('has an existing producing-step association for every process-level output', () => {
  function bound(record: SharedRecord, ancestors = new Set<string>()): string[] {
    if (ancestors.has(record.id)) return []
    return record.parts.flatMap(part => {
      if (part.when || part.metadata.jurisdictions) return []
      if (part.ref) {
        const referenced = records.find(record => record.id === part.ref)
        return referenced ? bound(referenced, new Set(ancestors).add(record.id)) : []
      }
      return outputs(part.kind === 'decision' ? part.options.find(option => option.id === 'default')?.metadata ?? part.metadata : part.metadata)
    })
  }
  for (const record of records) expect(outputs(record.metadata).filter(output => !bound(record).includes(output)), record.id).toEqual([])
})

it('shows the corporate-card output only on its authored application step', () => {
  const record = records.find(record => record.id === 'qs_024')!
  const el = render(<SharedProcessReader record={record} records={records} />)
  const chips = el.getAllByText('Corporate card', { exact: true })
  expect(chips).toHaveLength(1)
  expect(chips[0].closest('article')?.id).toBe('qs_024:n2')
  expect(el.getAllByText('Produces:')).toHaveLength(1)
})
