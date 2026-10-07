// Pure, client-safe pick + URL-state logic for /stacks/builder (components/StackBuilder.tsx).
// Distinct from lib/aiStacks.ts (curated cross-arena stacks resolved server-side from full
// CategoryData): this composes a stack interactively in the browser from the same lean
// CompareProduct list /compare uses (lib/compareData.ts), so it must stay free of node builtins.
import type { CompareProduct } from './compare'

export type StackMetric = 'agentReady' | 'aiEra'

export const STACK_METRIC_LABELS: Record<StackMetric, string> = {
  agentReady: 'agent-ready',
  aiEra: 'Overall score',
}

export interface StackRole {
  id: string
  label: string
  arenaId: string
}

// The ~12 buildable roles, each mapped to a live arena. Role ids are the share-URL vocabulary
// (?roles=banking,payments), so treat them as stable once shipped.
export const STACK_ROLES: StackRole[] = [
  { id: 'banking', label: 'Banking', arenaId: 'startup-banking' },
  { id: 'payments', label: 'Payments', arenaId: 'payments' },
  { id: 'payroll', label: 'Payroll', arenaId: 'payroll' },
  { id: 'accounting', label: 'Accounting', arenaId: 'accounting' },
  { id: 'pm', label: 'Project management', arenaId: 'project-management' },
  { id: 'code-hosting', label: 'Code hosting', arenaId: 'code-hosting' },
  { id: 'coding-agent', label: 'Coding agent', arenaId: 'ai-coding' },
  { id: 'chat', label: 'Team chat', arenaId: 'team-chat' },
  { id: 'baas', label: 'Backend-as-a-service', arenaId: 'backend-as-a-service' },
  { id: 'analytics', label: 'Product analytics', arenaId: 'product-analytics' },
  { id: 'crm', label: 'CRM', arenaId: 'crm' },
  { id: 'edge', label: 'Edge platform', arenaId: 'edge-platforms' },
]

export interface StackConstraints {
  // Restrict every role to `type === 'oss'` products.
  ossOnly: boolean
  // "Self-hostable preferred" — we don't score self-hostability directly, so the openness
  // themeScore is the documented proxy (it judges leave/inspect/self-host stories). Soft
  // preference, not a filter: picks are re-ordered by a 70/30 blend of the pick metric and
  // openness; a product with no openness score blends as openness 0 (no evidence it can be
  // self-hosted, so the preference deprioritizes it — otherwise the toggle would never bite).
  selfHostPreferred: boolean
  metric: StackMetric
}

export const DEFAULT_CONSTRAINTS: StackConstraints = {
  ossOnly: false,
  selfHostPreferred: false,
  metric: 'agentReady',
}

export interface RolePick {
  product: CompareProduct
  metricValue: number
  // Position in the FULL arena field (every product with a non-null metric value), not the
  // constraint-filtered field — so an OSS-only pick honestly reads "#4 of 9", not "#1 of 2".
  rank: number
  fieldSize: number
  // Next best under the same constraints (null when the pick stands alone).
  runnerUp: CompareProduct | null
}

export interface RoleResult {
  role: StackRole
  pick: RolePick | null
  // Honest empty-state copy, set exactly when pick is null — a constraint (or missing data)
  // eliminated every product in this role; the UI must say so rather than silently drop the row.
  emptyReason: string | null
}

const round1 = (n: number) => Math.round(n * 10) / 10

// Effective ordering score under "self-hostable preferred": blend metric with the openness
// proxy (null openness blends as 0 — see StackConstraints.selfHostPreferred). Exported for
// tests; not a displayed number (display always shows the raw metric).
export function selfHostScore(product: CompareProduct, metricValue: number): number {
  const openness = product.themeScores['openness'] ?? 0
  return 0.7 * metricValue + 0.3 * openness
}

export function pickForRole(
  products: CompareProduct[],
  role: StackRole,
  constraints: StackConstraints,
): RoleResult {
  const { metric } = constraints
  const inArena = products.filter((p) => p.arenaId === role.arenaId)
  if (inArena.length === 0) {
    return { role, pick: null, emptyReason: `The ${role.label} ranking isn't live yet.` }
  }
  const arenaName = inArena[0].arenaName
  const metricLabel = STACK_METRIC_LABELS[metric]

  // Full field: everyone in the arena with a score on the chosen metric, best first. Name is
  // the tiebreak so equal scores order deterministically.
  const ranked = inArena
    .filter((p) => p[metric] !== null)
    .sort((a, b) => (b[metric] as number) - (a[metric] as number) || a.name.localeCompare(b.name))
  if (ranked.length === 0) {
    return { role, pick: null, emptyReason: `No product in ${arenaName} is scored on ${metricLabel} yet.` }
  }

  const field = constraints.ossOnly ? ranked.filter((p) => p.type === 'oss') : ranked
  if (field.length === 0) {
    return { role, pick: null, emptyReason: `No open-source option ranked in ${arenaName} yet.` }
  }

  const ordered = constraints.selfHostPreferred
    ? [...field].sort(
        (a, b) =>
          selfHostScore(b, b[metric] as number) - selfHostScore(a, a[metric] as number) ||
          a.name.localeCompare(b.name),
      )
    : field

  const product = ordered[0]
  return {
    role,
    emptyReason: null,
    pick: {
      product,
      metricValue: product[metric] as number,
      rank: ranked.indexOf(product) + 1,
      fieldSize: ranked.length,
      runnerUp: ordered[1] ?? null,
    },
  }
}

export function buildStack(
  products: CompareProduct[],
  roleIds: string[],
  constraints: StackConstraints,
): RoleResult[] {
  const selected = new Set(roleIds)
  return STACK_ROLES.filter((r) => selected.has(r.id)).map((r) => pickForRole(products, r, constraints))
}

// Mean agent-readiness across the stack's successful picks (always the agentReady axis,
// whatever metric picked them — "how agent-drivable is this stack as a whole"). Null when no
// pick has an agentReady score.
export function stackAgentReadiness(results: RoleResult[]): number | null {
  const values = results
    .map((r) => r.pick?.product.agentReady ?? null)
    .filter((v): v is number => v !== null)
  if (values.length === 0) return null
  return round1(values.reduce((a, b) => a + b, 0) / values.length)
}

// ---- interconnect check (verified integration edges between the stack's picks) ----

// Same 'a|b' sorted-pair format as lib/integrations.ts's pairKey/verifiedPairKeys (that module
// is server-only — it reads data/ with fs — so the one-liner is mirrored here for the client;
// lib/__tests__/stackBuilder.test.ts cross-checks the two formats against each other).
export function stackPairKey(a: string, b: string): string {
  return [a, b].sort().join('|')
}

export interface InterconnectPair {
  aId: string
  aName: string
  bId: string
  bName: string
  // true = a verified integration edge exists between the two picks (evidence-backed, see
  // lib/integrations.ts). false means "no evidence found in our corpus" — the UI must NEVER
  // render it as "doesn't integrate".
  verified: boolean
}

// Every unordered pair of successful picks, in role order, checked against the verified-edge
// pair keys /stacks/builder passes down from the server-side integration graph.
export function stackInterconnects(
  results: RoleResult[],
  verifiedPairs: ReadonlyArray<string>,
): InterconnectPair[] {
  const verified = new Set(verifiedPairs)
  const picks = results.flatMap((r) => (r.pick ? [r.pick.product] : []))
  const out: InterconnectPair[] = []
  for (let i = 0; i < picks.length; i++) {
    for (let j = i + 1; j < picks.length; j++) {
      if (picks[i].id === picks[j].id) continue // same product in two roles — nothing to check
      out.push({
        aId: picks[i].id,
        aName: picks[i].name,
        bId: picks[j].id,
        bName: picks[j].name,
        verified: verified.has(stackPairKey(picks[i].id, picks[j].id)),
      })
    }
  }
  return out
}

// ---- share-URL state (?roles=banking,payments&oss=1&sh=1&metric=agentReady) ----

export interface StackUrlState {
  roles: string[]
  constraints: StackConstraints
}

const ROLE_IDS = new Set(STACK_ROLES.map((r) => r.id))

// Read-only view of URLSearchParams — lets callers pass Next's ReadonlyURLSearchParams
// (useSearchParams()) as well as a plain URLSearchParams in tests.
export interface ReadonlyParams {
  get(name: string): string | null
}

export function parseStackParams(params: ReadonlyParams): StackUrlState {
  const roles: string[] = []
  for (const piece of (params.get('roles') ?? '').split(',')) {
    const id = piece.trim()
    if (id !== '' && ROLE_IDS.has(id) && !roles.includes(id)) roles.push(id)
  }
  const rawMetric = params.get('metric')
  return {
    roles,
    constraints: {
      ossOnly: params.get('oss') === '1',
      selfHostPreferred: params.get('sh') === '1',
      metric: rawMetric === 'aiEra' || rawMetric === 'agentReady' ? rawMetric : DEFAULT_CONSTRAINTS.metric,
    },
  }
}

// Inverse of parseStackParams. Returns a query string without the leading '?'; '' when the
// state is entirely default (so the URL can stay clean until the reader actually builds).
export function encodeStackParams(state: StackUrlState): string {
  const params = new URLSearchParams()
  if (state.roles.length > 0) params.set('roles', state.roles.join(','))
  if (state.constraints.ossOnly) params.set('oss', '1')
  if (state.constraints.selfHostPreferred) params.set('sh', '1')
  if (state.constraints.metric !== DEFAULT_CONSTRAINTS.metric || state.roles.length > 0) {
    params.set('metric', state.constraints.metric)
  }
  return params.toString()
}

// ---- presets ----
// TODO: when data/icp-types.json ships, derive these from the ICP definitions (roles + metric
// per ICP) instead of hardcoding — see the /stacks/builder spec. Until then, three honest
// hand-picked starting points.
export interface StackPreset {
  id: string
  label: string
  description: string
  roles: string[]
  constraints: StackConstraints
}

export const STACK_PRESETS: StackPreset[] = [
  {
    id: 'solo-founder',
    label: 'Solo founder',
    description: 'The whole company in six tools, picked by overall Overall score.',
    roles: ['banking', 'payments', 'accounting', 'pm', 'coding-agent', 'analytics'],
    constraints: { ossOnly: false, selfHostPreferred: false, metric: 'aiEra' },
  },
  {
    id: 'oss-purist',
    label: 'OSS purist',
    description: 'Open-source only, self-hostable preferred, ranked by Overall score.',
    roles: ['code-hosting', 'chat', 'baas', 'analytics', 'crm', 'pm'],
    constraints: { ossOnly: true, selfHostPreferred: true, metric: 'aiEra' },
  },
  {
    id: 'agent-first',
    label: 'Agent-first team',
    description: 'Every layer picked by how well an agent can drive it.',
    roles: ['coding-agent', 'code-hosting', 'chat', 'baas', 'edge', 'payments'],
    constraints: { ossOnly: false, selfHostPreferred: false, metric: 'agentReady' },
  },
]
