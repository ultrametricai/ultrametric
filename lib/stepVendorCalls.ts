import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { loadProcesses } from './processes'
import { stepRanking } from './processRankings'

// The committed per-(step, vendor) API-call mapping — rankings/step-vendor-calls.json, generated
// once by pipeline/scripts/map-step-calls.ts (an LLM pass GROUNDED in each vendor's collected
// evidence: every call's sourceUrl is one of the vendor's evidence URLs or its documented MCP
// endpoint — never invented). This module is the read side: process pages ask "which actual API
// calls would each vendor option use for this step?" and get back only what the evidence
// supports. Display-only, never feeds scoring — same contract as lib/processRankings.ts.

export const STEP_CALL_TYPES = ['rest', 'sdk', 'graphql', 'mcp', 'cli'] as const

export const StepVendorCallSchema = z.object({
  method: z.string().min(1),
  type: z.enum(STEP_CALL_TYPES),
  description: z.string().min(1).optional(),
  sourceUrl: z.string().url(),
})

// One (step, vendor) cell with at least one grounded call — cells the LLM honestly answered
// "no grounded calls" for are omitted from the committed file entirely.
export const StepVendorCallEntrySchema = z.object({
  taskId: z.string().min(1),
  nodeId: z.string().min(1),
  arenaId: z.string().min(1),
  productId: z.string().min(1),
  calls: StepVendorCallSchema.array().min(1),
})

export const StepVendorCallsFileSchema = StepVendorCallEntrySchema.array()
export type StepVendorCallEntry = z.infer<typeof StepVendorCallEntrySchema>

// ---------------------------------------------------------------------------
// The loader contract (the rendering layer builds on exactly these shapes)
// ---------------------------------------------------------------------------

export interface VendorCall {
  method: string
  type?: 'rest' | 'sdk' | 'graphql' | 'mcp' | 'cli'
  description?: string
  sourceUrl?: string
}

export interface StepVendorCalls {
  productId: string
  name: string
  arenaId: string
  calls: VendorCall[]
}

const DEFAULT_DIR = () => path.join(process.cwd(), 'rankings')

// Same tolerant-optional contract as loadStepStoryMap: a missing committed file is an empty
// list (no call panels anywhere), never an error. Cached module-level per data dir.
const fileCache = new Map<string, StepVendorCallEntry[]>()

export function loadStepVendorCalls(dir: string = DEFAULT_DIR()): StepVendorCallEntry[] {
  const hit = fileCache.get(dir)
  if (hit) return hit
  const file = path.join(dir, 'step-vendor-calls.json')
  const entries = fs.existsSync(file)
    ? StepVendorCallsFileSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')))
    : []
  fileCache.set(dir, entries)
  return entries
}

// Minimal product-name lookup straight from the arena's products.json — deliberately not
// loadCategory (which validates the whole arena) since only names are needed here.
const ProductNameSchema = z.object({ id: z.string().min(1), name: z.string().min(1) }).loose().array()
const nameCache = new Map<string, Map<string, string>>()

function productNames(arenaId: string, dir: string): Map<string, string> {
  const key = `${dir}::${arenaId}`
  const hit = nameCache.get(key)
  if (hit) return hit
  const file = path.join(dir, arenaId, 'products.json')
  const names = fs.existsSync(file)
    ? new Map(ProductNameSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8'))).map((p) => [p.id, p.name]))
    : new Map<string, string>()
  nameCache.set(key, names)
  return names
}

// Grounded vendor calls for one step, in the SAME vendor order the generator enumerated: the
// step's ranking order (lib/processRankings.ts stepRanking) first, then any cells outside that
// ranking (the canonical vendor judged in another arena) in committed-file order. Unknown steps
// and steps with no grounded cell return [] — never a guess.
export function stepVendorCallsFor(taskId: string, nodeId: string, dir?: string): StepVendorCalls[] {
  const dataDir = dir ?? DEFAULT_DIR()
  const entries = loadStepVendorCalls(dataDir).filter((e) => e.taskId === taskId && e.nodeId === nodeId)
  if (entries.length === 0) return []

  // Enumeration order: the step ranking's vendor order (the generator took its top slice from
  // exactly this ranking). Tolerant: if the task/node/ranking is gone, committed order stands.
  let rankOf = new Map<string, number>()
  try {
    const task = loadProcesses(dataDir).find((t) => t.id === taskId)
    const node = task?.dag.nodes.find((n) => n.id === nodeId)
    const ranking = task && node ? stepRanking(taskId, node, dataDir) : null
    if (ranking) rankOf = new Map(ranking.vendors.map((v, i) => [`${ranking.arenaId}:${v.productId}`, i]))
  } catch {
    /* stale committed data never crashes a read — committed order is the fallback */
  }

  const pos = (e: StepVendorCallEntry) => rankOf.get(`${e.arenaId}:${e.productId}`) ?? Number.MAX_SAFE_INTEGER
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => pos(a.e) - pos(b.e) || a.i - b.i)
    .map(({ e }) => ({
      productId: e.productId,
      name: productNames(e.arenaId, dataDir).get(e.productId) ?? e.productId,
      arenaId: e.arenaId,
      calls: e.calls.map((c) => ({ ...c })),
    }))
}
