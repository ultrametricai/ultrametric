import { loadBusinessLogicMap, loadBusinessLogicSteps, modulesForProcess } from '../businessLogicMap'
import { readmeComputes } from '../openModulePages'
import { loadArtifacts } from '../processes'
import { REPO } from '../site'
import { processGraphs } from './graph'
import { sharedPreviewHref } from './reader'
import { regionalDecision } from './regions'
import type { SharedRecord } from './schema'

export interface BottomTableStep { scope: string; label: string; condition: string | null }
export interface ProducedArtifactRow {
  id: string
  label: string
  description: string
  steps: BottomTableStep[]
  canonicalProducer: { title: string; href: string } | null
}
export interface OpenModuleRow {
  id: string
  label: string
  computes: string
  sourceFile: string
  sourceHref: string
  steps: BottomTableStep[]
  processOnly: boolean
}
export interface BottomTables { produces: ProducedArtifactRow[]; modules: OpenModuleRow[] }

function outputs(metadata: Record<string, unknown>): string[] {
  return [...new Set([
    ...(Array.isArray(metadata.produces) ? metadata.produces.filter((id): id is string => typeof id === 'string') : []),
    ...(typeof metadata.producesArtifact === 'string' ? [metadata.producesArtifact] : []),
  ])]
}

// The shared record declares outputs and their exact producing steps. Registry
// descriptions and canonical producers do not create new output associations.
export function processBottomTables(record: SharedRecord, records: SharedRecord[]): Record<string, BottomTables> {
  const artifacts = loadArtifacts()
  const registry = loadBusinessLogicMap()
  const mappings = loadBusinessLogicSteps()
  const modules = modulesForProcess(record.id)
  const computes = modules.length ? readmeComputes() : new Map<string, string>()
  const regional = regionalDecision(record)
  const selections = ['default', ...(regional?.options.map(option => option.id).filter(id => id !== 'default') ?? [])]
  return Object.fromEntries(selections.map(selected => {
    const graphs = processGraphs(record, records, selected)
    const nodes = graphs.flatMap(graph => graph.nodes.map(node => ({ ...node, annotation: graph.annotation })))
    const produces = outputs(record.metadata).flatMap(id => {
      const artifact = artifacts.find(artifact => artifact.id === id)
      const producing = nodes.filter(node => outputs(node.metadata).includes(id))
      if (!artifact || !producing.length) return []
      const producer = records.find(item => item.id === artifact.producedBy)
      return [{ id, label: artifact.label, description: artifact.description,
        steps: producing.map(node => ({ scope: node.scope, label: node.title, condition: [node.when, node.annotation].filter(Boolean).join(' · ') || null })),
        canonicalProducer: producer && producer.id !== record.id ? { title: producer.title, href: sharedPreviewHref(producer.id, records) } : null,
      }]
    })
    // Preserve the reader's explicit default-scope C-Corp module binding. Other
    // geographic/function relationships are never inferred.
    const visibleModules = record.id === 'form_001' && selected !== 'default' ? [] : modules
    return [selected, { produces, modules: visibleModules.map(module => {
      const source = registry[module.id]
      const mapped = mappings.filter(mapping => mapping.processId === record.id && mapping.module === module.id)
      const steps = [...new Set(mapped.map(mapping => mapping.nodeId))].flatMap(id => {
        // Existing function mappings describe the original step; a different
        // geographic option does not inherit its calculation automatically.
        if (selected !== 'default' && regional?.scope === `${record.id}:${id}`) return []
        const node = graphs[0]?.nodes.find(node => node.id === id)
        return node ? [{ scope: node.scope, label: node.title, condition: node.when }] : []
      })
      const description = computes.get(source.anchor)
      if (!description) throw new Error(`Missing module description for ${module.id}`)
      return { id: module.id, label: module.label, computes: description, sourceFile: source.file,
        sourceHref: `https://github.com/${REPO}/blob/main/${source.file}`, steps, processOnly: mapped.length === 0 }
    }) }]
  }))
}
