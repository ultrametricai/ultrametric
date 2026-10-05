import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { REPO } from './site'

// Open-modules ↔ process map (founder 2026-10-02, deepened same day): the committed registry
// processes/business-logic-map.json names which lib/openstartup modules serve which corpus
// processes — and, per STEP, which module FUNCTION genuinely computes which step's math. The
// task-level hits render as the process page's bottom 'Open modules' table (founder
// 2026-10-05, lib/openModulePages.ts processOpenModuleRows — the earlier chip row and its
// disclosure menu are retired); the step-level entries render as tiny
// "compute: <module>.<function>" chips inside the step blocks (components/ProcessDag.tsx),
// deep-linking to the module's section in open-modules/README.md on GitHub.
// Same SSOT posture as the vendor registry (lib/processes.ts): facts live in the
// open corpus file, this module only reads them back, and the honesty invariants are
// data-tested — every module id is a real lib/openstartup file, every mapped process id exists
// in the corpus, every step's node id exists in that process's DAG, every named function is a
// real export of its module (a misspelled name fails the suite), every anchor resolves to a
// real README heading, and the README's generated Serves lines stay in sync
// (lib/__tests__/businessLogicMap.test.ts + businessLogicServes.test.ts +
// lib/businessLogicServes.ts). Modules with no honest process target are simply absent from
// the registry, and steps a module merely informs stay task-level; nothing is forced.

export const BusinessLogicModuleSchema = z
  .object({
    // Display name — mirrors the module's `###` heading in open-modules/README.md.
    label: z.string().min(1),
    // The module source file, repo-relative — must exist (totality-tested).
    file: z.string().regex(/^lib\/openstartup\/[A-Za-z0-9]+\.ts$/),
    // GitHub's slug for the README heading — the chip's deep-link target.
    anchor: z.string().regex(/^[a-z0-9]+(-+[a-z0-9]+)*$/),
    // Corpus task ids (processes/corpus.json) this module honestly serves.
    processes: z.string().min(1).array().min(1),
  })
  .strict()
export type BusinessLogicModule = z.infer<typeof BusinessLogicModuleSchema>

// One step-level mapping: the named FUNCTION of the named module computes this step's math
// (never looser — curation from both sides, honesty-tested). `what` is the one plain clause
// the compute chip's tooltip carries.
export const BusinessLogicStepSchema = z
  .object({
    processId: z.string().min(1),
    nodeId: z.string().min(1),
    module: z.string().regex(/^[a-z][A-Za-z0-9]*$/),
    function: z.string().regex(/^[a-z][A-Za-z0-9]*$/),
    what: z.string().min(1),
  })
  .strict()
export type BusinessLogicStep = z.infer<typeof BusinessLogicStepSchema>

export const BusinessLogicMapSchema = z
  .object({
    $comment: z.string().optional(),
    modules: z.record(z.string().regex(/^[a-z][A-Za-z0-9]*$/), BusinessLogicModuleSchema),
    steps: BusinessLogicStepSchema.array(),
  })
  .strict()

const mapFile = () => path.join(process.cwd(), 'processes', 'business-logic-map.json')
type ParsedMap = z.infer<typeof BusinessLogicMapSchema>
let mapCache: ParsedMap | null = null
function loadParsedMap(): ParsedMap {
  if (!mapCache) {
    mapCache = BusinessLogicMapSchema.parse(JSON.parse(fs.readFileSync(mapFile(), 'utf8')))
  }
  return mapCache
}
export function loadBusinessLogicMap(): Record<string, BusinessLogicModule> {
  return loadParsedMap().modules
}

/** The per-step function mappings, in registry order. */
export function loadBusinessLogicSteps(): BusinessLogicStep[] {
  return loadParsedMap().steps
}

export function moduleReadmeHref(anchor: string): string {
  return `https://github.com/${REPO}/blob/main/open-modules/README.md#${anchor}`
}

/** One step's "compute: <module>.<fn>" chip: the function that computes the step's math, the
 * plain `what` clause for the tooltip, and the module's README deep link on GitHub. */
export interface StepComputeChip {
  module: string
  fn: string
  what: string
  href: string
}

/** The function mappings for one step, in registry order ([] for the many unmapped steps).
 * Throws on a module id the registry doesn't know — a broken entry fails the build, same
 * posture as lib/documents.ts openDocumentById. */
export function computeChipsForStep(taskId: string, nodeId: string): StepComputeChip[] {
  const modules = loadBusinessLogicMap()
  return loadBusinessLogicSteps()
    .filter((s) => s.processId === taskId && s.nodeId === nodeId)
    .map((s) => {
      const m = modules[s.module]
      if (!m) {
        throw new Error(
          `business-logic-map.json: step ${taskId}/${nodeId} names unknown module ${s.module}`,
        )
      }
      return { module: s.module, fn: s.function, what: s.what, href: moduleReadmeHref(m.anchor) }
    })
}
