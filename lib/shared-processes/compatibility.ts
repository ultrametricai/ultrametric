// Legacy ↔ shared compatibility contracts (docs/PR171-EXTRACTION.md, bucket c): the
// anchor contract maps every published step-<task>-<node> hash to its mounted shared
// scope; regionForGeo maps the existing country choice (lib/geoPreference.ts, the one
// geo store) to a source-declared regional option. Pure mappings over committed data —
// no DOM, no new URL encoding, no second selection store. The client bridge that
// applies these on the reader surface rides with the reader branch (PR-A).
import type { ProcessTask } from '../processes'
import type { Part, SharedRecord } from './schema'
import { previewContext } from './preview-context'
import { regionalDecision } from './regions'

export interface ProcessAnchorContract {
  aliases: Record<string, string[]>
  targets: Record<string, string>
  scopes: Record<string, { region?: string }>
}

/** Source scopes describe actual mounted articles/options, including reference ancestry. */
export function processAnchorContract(record: SharedRecord, records: SharedRecord[], task?: ProcessTask): ProcessAnchorContract {
  const aliases: Record<string, string[]> = {}
  const targets: Record<string, string> = {}
  const scopes: ProcessAnchorContract['scopes'] = { steps: {} }
  const regional = regionalDecision(record)
  function visit(parts: Part[], scope: string, sourceId: string, ancestors: Set<string>, requiredRegion?: string) {
    for (const part of parts) {
      const id = `${scope}:${part.id}`
      const context = previewContext(part.metadata)
      const region = context && regional?.scope === `${scope}:${context.decision}` ? context.option : requiredRegion
      scopes[id] = { region }
      const referenced = records.find(item => item.id === part.ref)
      if (referenced && !ancestors.has(referenced.id)) visit(referenced.parts, `${id}:ref`, referenced.id, new Set(ancestors).add(referenced.id), region)
      for (const option of part.options) {
        // This source option is rendered in provider details, not as an option panel.
        if (sourceId === 'form_001' && part.id === 'n1' && option.id === 'clerky-formation') continue
        const optionScope = `${id}:${option.id}`
        const optionRegion = regional?.scope === id && regional.options.some(item => item.id === option.id) ? option.id : region
        scopes[optionScope] = { region: optionRegion }
        visit(option.parts, optionScope, sourceId, ancestors, optionRegion)
      }
    }
  }
  visit(record.parts, record.id, record.id, new Set([record.id]))
  for (const node of task?.dag.nodes ?? []) {
    let target = `${record.id}:${node.id}`
    // The old image-generation activity remains this exact authored method.
    if (record.id === 'brand_002' && node.id === 'n1') target += ':image-generation'
    // brand_002:n2 deliberately keeps its existing stepGuidance binding and artifact.
    // Its title changed from selection to output handoff before this cutover. This alias
    // preserves that established behavior; it does not verify a new selection operation.
    // brand_003:n1 and n4 still contain the original palette-generation/token-save work.
    if (!Object.hasOwn(scopes, target)) throw new Error(`Missing legacy anchor target ${record.id}/${node.id}: ${target}`)
    const legacy = `step-${task!.id}-${node.id}`
    targets[legacy] = target
    ;(aliases[target] ??= []).push(legacy)
  }
  return { aliases, targets, scopes }
}

export function decodeProcessHash(hash: string) {
  try { return decodeURIComponent(hash.replace(/^#/, '')) } catch { return '' }
}

export type AnchorResolution =
  | { status: 'unknown' }
  | { status: 'conflict'; target: string; requiredRegion: string }
  | { status: 'reachable'; target: string; region?: string }

export function resolveProcessAnchor(contract: ProcessAnchorContract, hash: string, selectedRegion: string, explicitGeo: boolean): AnchorResolution {
  const key = decodeProcessHash(hash)
  const target = contract.targets[key] ?? key
  const scope = contract.scopes[target]
  if (!scope) return { status: 'unknown' }
  if (scope.region && scope.region !== selectedRegion && explicitGeo) return { status: 'conflict', target, requiredRegion: scope.region }
  return { status: 'reachable', target, region: scope.region }
}

/** A country only selects a source-declared regional option. GB is the ISO alias for UK. */
export function regionForGeo(decision: ReturnType<typeof regionalDecision>, raw: string | null) {
  if (raw === null) return { explicit: false, region: undefined }
  const token = raw.trim().toUpperCase()
  const country = token === 'GB' ? 'UK' : token
  if (country === 'US' || country === 'GLOBAL') return { explicit: true, region: 'default' }
  const option = decision?.options.find(option => option.countries.includes(country))
  if (option) return { explicit: true, region: option.id }
  // A supported legacy country still wins over a conflicting hash even where no
  // local variant exists. The existing default scope is retained, never relabelled.
  return { explicit: ['UK', 'IN', 'DE', 'FR', 'PT', 'CA'].includes(country), region: undefined }
}
