import { classifyGapStep } from './gapClosers'
import { mcpEndpointFor } from './mcpEndpoints'
import {
  chainTasks, findProcessBySlug, loadChains, processSlug, stepVendorOptions, vendorChipInfo,
  type DagNode, type ProcessChain, type ProcessTask, type VendorChipInfo,
} from './processes'
import { SITE_URL } from './site'

// Process manifests: the founder-process corpus reshaped into a versioned, machine-readable
// handoff contract for an executor (the AFK remake — an agent-execution product that RUNs these
// processes). A manifest is PUBLIC data — it's our published corpus resolved against the live
// arena leaderboards, nothing more — served at /processes/{slug}/manifest.json and, composed
// per playbook, at /processes/chains/{chain}/manifest.json. The contract is documented in
// docs/AFK-HANDOFF.md; bump MANIFEST_VERSION on any breaking shape change (see the doc's
// versioning rules).
//
// Everything here is a pure function of the corpus (read through lib/processes.ts only) plus
// the committed arena data — no request-time inputs — so the routes prerender under the static
// export and the whole module is unit-testable against data/.

export const MANIFEST_VERSION = 1 as const

// Executor-facing step kind, mapped from the corpus route:
//   agent  → 'api'          (drive it through recorded API/tool calls — MCP-first)
//   form   → 'computer-use' (manual portal/form work — a browser agent behind an approval gate)
//   person → 'human'        (a human or a supervised computer-use agent — render as a checklist
//                            item; steps flagged legalSignature are strictly human)
export type ManifestStepKind = 'api' | 'computer-use' | 'human'

export function stepKind(route: DagNode['route']): ManifestStepKind {
  if (route === 'agent') return 'api'
  if (route === 'form') return 'computer-use'
  return 'human'
}

// One vendor that can perform a step, resolved against the live market. Tracked vendors carry
// the judged product id, arena, agent-readiness, an allowlisted remote MCP endpoint when the
// vendor publishes one (lib/mcpEndpoints.ts — the executor's MCP-first path), and the judged
// product page. Untracked vendors (doola, irs…) appear honestly with nulls — the executor
// still knows the market includes them.
export interface ManifestVendorOption {
  vendor: string
  name: string
  productId: string | null
  arena: string | null
  agentReady: number | null
  mcpEndpoint: string | null
  paProductUrl: string | null
}

export interface ManifestCall {
  method: string
  type?: 'rest' | 'sdk' | 'graphql' | 'manual'
  description?: string
}

export interface ManifestStep {
  id: string
  title: string
  kind: ManifestStepKind
  // Original corpus routing, kept alongside `kind` so a consumer can audit the mapping.
  route: DagNode['route']
  toolCall: string | null
  calls: ManifestCall[]
  vendorOptions: ManifestVendorOption[]
  // Deep link to perform the step / vendor signup page — forward-compat corpus fields
  // (see DagNodeSchema), passed through whenever present.
  actionUrl?: string
  signupUrl?: string
  // Set when the step is judgment/identity work no agent should stand in for
  // (lib/gapClosers.ts classification) — the executor must render it as a human checklist
  // item, never attempt it.
  irreducible?: string
  // True when the step is a legally required human signature/attestation act (the corpus's
  // legalSignature flag — the founder's "true human floor"): the executor must never attempt
  // or work around it. Additive, optional — not a breaking shape change.
  legalSignature?: true
  // True whenever the step is side-effectful: explicit corpus gate, any flagged risk, every
  // computer-use step (a browser agent acting on a real portal), and any api step whose calls
  // aren't all read-only. The executor must hold for human approval before running these.
  approvalRequired: boolean
  riskLevel: 'low' | 'medium' | 'high' | null
  estimatedMinutes: number
  async: boolean
}

export interface ManifestProvenance {
  // Legacy, pre-rename source id — value immutable: exported manifests carry it, and consumers
  // key provenance checks on the exact string.
  source: 'productarena'
  url: string
  generatedFrom: string
  license: string
}

// The composable core of a process manifest (chain manifests embed these), plus the versioned
// standalone document served per process.
export interface ProcessManifestBody {
  process: { slug: string; title: string; phase: string; description: string }
  manifestUrl: string
  steps: ManifestStep[]
}

export interface ProcessManifest extends ProcessManifestBody {
  manifestVersion: typeof MANIFEST_VERSION
  provenance: ManifestProvenance
}

export interface ChainManifest {
  manifestVersion: typeof MANIFEST_VERSION
  chain: { slug: string; name: string; tagline: string; manifestUrl: string }
  processes: ProcessManifestBody[]
  provenance: ManifestProvenance
}

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------

export function processManifestPath(slug: string): string {
  return `/processes/${slug}/manifest.json`
}

export function chainManifestPath(chainId: string): string {
  return `/processes/chains/${chainId}/manifest.json`
}

// Absolute — SITE_URL is the deployed origin (served at the domain root, no basePath).
export function processManifestUrl(slug: string): string {
  return `${SITE_URL}${processManifestPath(slug)}`
}

export function chainManifestUrl(chainId: string): string {
  return `${SITE_URL}${chainManifestPath(chainId)}`
}

// ---------------------------------------------------------------------------
// Step assembly
// ---------------------------------------------------------------------------

// Read-only call detection for the approval gate. Corpus methods come in three shapes —
// "GET /api/...", "vendor.resource.verb()", "snake_case_tool" — so normalize separators to
// spaces before looking for a read verb.
const READ_ONLY_RE = /(^|\s)(get|head|list|search|read|retrieve|fetch|check|lookup|query|status|whoami)\b/i

function isReadOnlyCall(method: string): boolean {
  return READ_ONLY_RE.test(method.replace(/[._/()-]/g, ' '))
}

// Side-effect policy (documented in docs/AFK-HANDOFF.md): any side-effectful step must be
// approval-gated. Explicit corpus gates and flagged risk always win; computer-use steps are
// always side-effectful (a browser agent acting on a real portal); api steps are gated unless
// every recorded call reads; human steps need no machine gate — the human IS the actor.
export function stepApprovalRequired(node: DagNode): boolean {
  if (node.approvalRequired) return true
  if (node.riskLevel === 'medium' || node.riskLevel === 'high') return true
  const kind = stepKind(node.route)
  if (kind === 'human') return false
  if (kind === 'computer-use') return true
  const calls = [
    ...(node.functionCalls ?? []).map((fc) => fc.method),
    ...(node.toolCall ? [node.toolCall] : []),
  ]
  if (calls.length === 0) return false
  return calls.some((m) => !isReadOnlyCall(m))
}

function optionFromChip(info: VendorChipInfo): ManifestVendorOption {
  return {
    vendor: info.vendor,
    name: info.label,
    productId: info.productId,
    arena: info.arenaId,
    agentReady: info.agentReady,
    mcpEndpoint: info.arenaId && info.productId ? mcpEndpointFor(info.arenaId, info.productId) : null,
    paProductUrl: info.arenaId && info.productId
      ? `${SITE_URL}/arena/${info.arenaId}/product/${info.productId}`
      : null,
  }
}

export function manifestVendorOption(vendor: string, dir?: string): ManifestVendorOption {
  return optionFromChip(vendorChipInfo(vendor, dir))
}

// Every vendor that can perform the step, resolved against the live market: the canonical call
// target first, then lib/processes.ts stepVendorOptions — the arena-derived roster for steps
// with an optionsArenaId (so the executor sees the CURRENT market, not a frozen list) plus the
// curated options — deduped by vendor key and judged product id.
function stepVendorChips(node: DagNode, dir?: string): VendorChipInfo[] {
  const options = stepVendorOptions(node, dir)
  if (!node.vendor) return options
  const canonical = vendorChipInfo(node.vendor, dir)
  return [
    canonical,
    ...options.filter(
      (o) => o.vendor !== canonical.vendor && !(o.productId && o.productId === canonical.productId),
    ),
  ]
}

export function buildManifestStep(node: DagNode, dir?: string): ManifestStep {
  const cls = classifyGapStep({ label: node.label, route: node.route, async: node.async })
  const step: ManifestStep = {
    id: node.id,
    title: node.label,
    kind: stepKind(node.route),
    route: node.route,
    toolCall: node.toolCall ?? null,
    calls: node.functionCalls ?? [],
    vendorOptions: stepVendorChips(node, dir).map(optionFromChip),
    approvalRequired: stepApprovalRequired(node),
    riskLevel: node.riskLevel ?? null,
    estimatedMinutes: node.estimatedMinutes,
    async: node.async ?? false,
  }
  if (node.actionUrl) step.actionUrl = node.actionUrl
  if (node.signupUrl) step.signupUrl = node.signupUrl
  if (cls?.kind === 'irreducible') step.irreducible = cls.reason
  if (node.legalSignature) step.legalSignature = true
  return step
}

// ---------------------------------------------------------------------------
// Manifest assembly
// ---------------------------------------------------------------------------

export function manifestProvenance(): ManifestProvenance {
  return {
    source: 'productarena',
    url: SITE_URL,
    generatedFrom:
      'processes/corpus.json + journeys/chains.json (the Ultrametric founder-process corpus), '
      + 'resolved against live ranking leaderboards at build time. Regenerate by refetching this '
      + 'manifest URL — it always reflects the currently deployed data, not a pinned data commit.',
    license:
      'Ultrametric Data License (DATA-LICENSE in github.com/ultrametricai/ultrametric): '
      + 'querying and quoting with attribution to "Ultrametric by Ultrametric Inc" is fine; '
      + 'bulk redistribution or use to build competing datasets requires written permission.',
  }
}

function buildProcessBody(task: ProcessTask, dir?: string): ProcessManifestBody {
  const slug = processSlug(task.title)
  return {
    process: { slug, title: task.title, phase: task.phase, description: task.description },
    manifestUrl: processManifestUrl(slug),
    steps: task.dag.nodes.map((n) => buildManifestStep(n, dir)),
  }
}

export function buildProcessManifest(task: ProcessTask, dir?: string): ProcessManifest {
  return {
    manifestVersion: MANIFEST_VERSION,
    ...buildProcessBody(task, dir),
    provenance: manifestProvenance(),
  }
}

export function processManifestBySlug(slug: string, dir?: string): ProcessManifest | null {
  const task = findProcessBySlug(slug, dir)
  return task ? buildProcessManifest(task, dir) : null
}

export function buildChainManifest(chain: ProcessChain, dir?: string): ChainManifest {
  return {
    manifestVersion: MANIFEST_VERSION,
    chain: {
      slug: chain.id,
      name: chain.name,
      tagline: chain.tagline,
      manifestUrl: chainManifestUrl(chain.id),
    },
    processes: chainTasks(chain, dir).map((t) => buildProcessBody(t, dir)),
    provenance: manifestProvenance(),
  }
}

export function chainManifestById(chainId: string, dir?: string): ChainManifest | null {
  const chain = loadChains(dir).find((c) => c.id === chainId)
  return chain ? buildChainManifest(chain, dir) : null
}
