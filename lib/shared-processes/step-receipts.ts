import { processAnchorContract } from './compatibility'
import { sourceStepScope } from './source-step'
import { loadCategory } from '../data'
import { mcpEndpointFor } from '../mcpEndpoints'
import { loadProcesses } from '../processes'
import { isShutdown } from '../shutdown'
import { stepVendorCallsFor, type StepVendorCalls } from '../stepVendorCalls'
import type { Part, SharedRecord } from './schema'

export type StepReceipts = Record<string, StepVendorCalls[]>

// Display-only receipts from the canonical evidence mapping. Raw toolCall and
// functionCalls deliberately do not cross the shared-schema boundary.
export function buildStepReceipts(record: SharedRecord): StepReceipts {
  const task = loadProcesses().find(task => task.id === record.id)
  if (!task) return {}
  const result: StepReceipts = {}
  const anchors = processAnchorContract(record, [record], task)
  for (const node of task.dag.nodes) {
    const scope = sourceStepScope(record, node, anchors)
    if (!scope) continue
    const vendors = stepVendorCallsFor(task.id, node.id).flatMap(vendor => {
      const data = loadCategory(vendor.arenaId)
      const product = data.products.find(product => product.id === vendor.productId)
      if (!product || isShutdown(product)) return []
      const sources = new Set((data.evidence[vendor.productId] ?? []).map(evidence => evidence.url))
      const endpoint = mcpEndpointFor(vendor.arenaId, vendor.productId)
      if (endpoint) sources.add(endpoint)
      const calls = vendor.calls.filter(call => call.sourceUrl && sources.has(call.sourceUrl))
      return calls.length ? [{ ...vendor, calls }] : []
    })
    if (vendors.length) result[scope] = vendors
  }
  return result
}

export function buildComposedReceipts(record: SharedRecord, records: SharedRecord[]): StepReceipts {
  const result: StepReceipts = {}
  function visit(current: SharedRecord, prefix: string, ancestors: Set<string>) {
    if (ancestors.has(current.id)) return
    const next = new Set(ancestors).add(current.id)
    for (const [scope, receipts] of Object.entries(buildStepReceipts(current))) result[prefix + scope.slice(current.id.length)] = receipts
    function parts(items: Part[], scope: string) {
      for (const part of items) {
        const target = records.find(record => record.id === part.ref)
        if (target) visit(target, `${scope}:${part.id}:ref`, next)
        for (const option of part.options) parts(option.parts, `${scope}:${part.id}:${option.id}`)
      }
    }
    parts(current.parts, prefix)
  }
  visit(record, record.id, new Set())
  return result
}
