import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import type { CategoryData } from './data-helpers'
import { isShutdown } from './shutdown'

// Cross-arena curated stacks (open-rankings/ai-stacks.json): named bundles of one pick per role. Picks:
// - "arena-top": resolved LIVE from an arena's leaderboard (the pick moves when the evidence
//   moves, so the page can never go stale). `ossOnly` restricts the field to open-source
//   products. When the runner-up is within CLOSE_CALL_DELTA of the leader, both are surfaced
//   as an "X or Y" co-pick — the same Δ3.0 convention the uncertainty pass uses for close races.
// - "product": an explicit curated pick, for known-good pairings that bind together in practice
//   (e.g. Termius + Tailscale) — still scored from its arena's leaderboard, never invented.
// - "editorial": an explicitly-labeled call for layers we don't score yet (models, hardware).
// Distinct from lib/stacks.ts (composed best-of-N within ONE category) and lib/personaStacks.ts
// (best single product per persona within one category): this composes across ARENAS.

export const CLOSE_CALL_DELTA = 3.0

const MetricSchema = z.enum(['agentReady', 'aiEra', 'agenticApp'])

const ArenaTopPickSchema = z.object({
  kind: z.literal('arena-top'),
  arenaId: z.string().min(1),
  metric: MetricSchema,
  ossOnly: z.boolean().optional(),
})

const ProductPickSchema = z.object({
  kind: z.literal('product'),
  arenaId: z.string().min(1),
  productId: z.string().min(1),
  metric: MetricSchema.default('agentReady'),
  // Why this exact product is curated into the slot (the pairing rationale).
  note: z.string().min(1),
})

const EditorialPickSchema = z.object({
  kind: z.literal('editorial'),
  name: z.string().min(1),
  url: z.string().url(),
  note: z.string().min(1),
})

const AiStackSlotSchema = z.object({
  role: z.string().min(1),
  why: z.string().min(1),
  pick: z.discriminatedUnion('kind', [ArenaTopPickSchema, ProductPickSchema, EditorialPickSchema]),
})

export const AiStackSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  tagline: z.string().min(1),
  audience: z.string().min(1),
  // Emoji for the stack's persona (founder 2026-09-18) — rendered beside the "For:" audience
  // line and on stack cards, same visual system as arena icons.
  personaIcon: z.string().min(1).optional(),
  slots: z.array(AiStackSlotSchema).min(2),
})

export type AiStack = z.infer<typeof AiStackSchema>
export type AiStackSlot = z.infer<typeof AiStackSlotSchema>

export function loadAiStacks(dataDir = path.join(process.cwd(), 'open-rankings')): AiStack[] {
  const raw = JSON.parse(fs.readFileSync(path.join(dataDir, 'ai-stacks.json'), 'utf8'))
  return z.array(AiStackSchema).parse(raw)
}

export interface ResolvedCoPick {
  productId: string
  productName: string
  metricValue: number
}

export interface ResolvedSlot {
  role: string
  why: string
  kind: 'arena-top' | 'product' | 'editorial'
  // scored-pick fields (null for editorial slots)
  arenaId: string | null
  arenaName: string | null
  productId: string | null
  productName: string | null
  metric: string | null
  metricValue: number | null
  rank: number | null
  fieldSize: number | null
  // Runner-up id kept alongside the name so display code can resolve its logo (16px chip).
  runnerUpId: string | null
  runnerUpName: string | null
  // "X or Y" — set on arena-top slots when the race is within CLOSE_CALL_DELTA.
  coPick: ResolvedCoPick | null
  // set on curated product picks — the pairing rationale.
  curatedNote: string | null
  // editorial fields (null otherwise)
  editorialName: string | null
  editorialUrl: string | null
  editorialNote: string | null
}

export interface ResolvedStack {
  id: string
  name: string
  tagline: string
  audience: string
  personaIcon?: string
  slots: ResolvedSlot[]
}

const METRIC_LABELS: Record<string, string> = {
  agentReady: 'agent-ready',
  aiEra: 'Overall score',
  agenticApp: 'Built-in AI',
}

export function metricLabel(metric: string): string {
  return METRIC_LABELS[metric] ?? metric
}

const EMPTY_SLOT_FIELDS = {
  arenaId: null,
  arenaName: null,
  productId: null,
  productName: null,
  metric: null,
  metricValue: null,
  rank: null,
  fieldSize: null,
  runnerUpId: null,
  runnerUpName: null,
  coPick: null,
  curatedNote: null,
  editorialName: null,
  editorialUrl: null,
  editorialNote: null,
}

// Resolve one stack against loaded category data. A scored slot whose arena or product isn't
// loaded resolves to nothing and the caller drops the slot — a stack must degrade to its
// still-live slots rather than break the page.
export function resolveStack(stack: AiStack, categories: CategoryData[]): ResolvedStack {
  const byId = new Map(categories.map((c) => [c.category.id, c]))
  const slots: ResolvedSlot[] = []

  for (const slot of stack.slots) {
    const base = { role: slot.role, why: slot.why, ...EMPTY_SLOT_FIELDS }

    if (slot.pick.kind === 'editorial') {
      slots.push({
        ...base,
        kind: 'editorial',
        editorialName: slot.pick.name,
        editorialUrl: slot.pick.url,
        editorialNote: slot.pick.note,
      })
      continue
    }

    const data = byId.get(slot.pick.arenaId)
    if (!data) continue
    const metric = slot.pick.metric
    const nameOf = (pid: string) => data.products.find((p) => p.id === pid)?.name ?? pid
    const ossIds = new Set(data.products.filter((p) => p.type === 'oss').map((p) => p.id))
    const field = slot.pick.kind === 'arena-top' && slot.pick.ossOnly
      ? data.rankings.leaderboard.filter((e) => ossIds.has(e.productId))
      : data.rankings.leaderboard
    // Shutdown products are never a stack pick, runner-up or co-pick (lib/shutdown.ts founder
    // rule) — filtering the ranked field means the next product simply moves up, and a curated
    // product pick pointing at one degrades like any other dead slot.
    const shutdownIds = new Set(data.products.filter((p) => isShutdown(p)).map((p) => p.id))
    const ranked = [...field]
      .filter((e) => !shutdownIds.has(e.productId))
      .filter((e) => e[metric] !== null)
      .sort((a, b) => (b[metric] as number) - (a[metric] as number))

    if (slot.pick.kind === 'product') {
      const entry = ranked.find((e) => e.productId === (slot.pick as { productId: string }).productId)
      if (!entry) continue
      slots.push({
        ...base,
        kind: 'product',
        arenaId: data.category.id,
        arenaName: data.category.name,
        productId: entry.productId,
        productName: nameOf(entry.productId),
        metric,
        metricValue: entry[metric] as number,
        rank: ranked.indexOf(entry) + 1,
        fieldSize: ranked.length,
        curatedNote: slot.pick.note,
      })
      continue
    }

    const top = ranked[0]
    if (!top) continue
    const second = ranked[1]
    const closeCall =
      second && (top[metric] as number) - (second[metric] as number) < CLOSE_CALL_DELTA
        ? { productId: second.productId, productName: nameOf(second.productId), metricValue: second[metric] as number }
        : null

    slots.push({
      ...base,
      kind: 'arena-top',
      arenaId: data.category.id,
      arenaName: data.category.name,
      productId: top.productId,
      productName: nameOf(top.productId),
      metric,
      metricValue: top[metric] as number,
      rank: 1,
      fieldSize: ranked.length,
      runnerUpId: second && !closeCall ? second.productId : null,
      runnerUpName: second && !closeCall ? nameOf(second.productId) : null,
      coPick: closeCall,
    })
  }

  return { id: stack.id, name: stack.name, tagline: stack.tagline, audience: stack.audience, personaIcon: stack.personaIcon, slots }
}

export function resolveAllStacks(categories: CategoryData[], dataDir?: string): ResolvedStack[] {
  return loadAiStacks(dataDir).map((s) => resolveStack(s, categories))
}
