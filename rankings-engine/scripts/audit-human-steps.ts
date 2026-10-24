import type { Execution } from '../../lib/execution'
// Human-step audit: for every non-agent DAG node in the process corpus (route 'form' or
// 'person'), one LLM pass authors a SPECIFIC root-cause sentence for why the step is human
// today, plus a computer-use feasibility verdict — replacing the three generic hardcoded
// reasons (lib/gapClosers.ts IRREDUCIBLE_REASON, lib/processSim.ts gapWhy) with a per-node
// answer to the founder directive: "if Human is marked in a process, we want to get to the
// bottom of why, and why computer use can't be used there."
//
// Same honesty + cost architecture as map-step-stories.ts (the model for this script):
//   - the audit is an ANNOTATION: routes, verdicts, scoring are never touched;
//   - judge-style correction rounds: every step answered exactly once, feasibility from the
//     closed enum, no generic-bucket reasons, and a hand-verified validation set that must
//     never come back 'drivable'/'assist' — or the batch is re-asked (up to 3 rounds);
//   - cached per node (rankings-engine/cache/human-steps/audit.json) by a hash over the node fields +
//     task title + prompt version, so re-runs are incremental and a mid-run crash resumes for
//     free; the committed open-rankings/human-step-audit.json is assembled only when every node is
//     fresh — all 147 or nothing.
//
// Usage: tsx rankings-engine/scripts/audit-human-steps.ts [--task <id>] [--report]
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { classifyGapStep, IRREDUCIBLE_REASON, type GapStep } from '../../lib/gapClosers'
import { loadProcesses, type ProcessTask } from '../../lib/processes'
import { gapWhy } from '../../lib/processSim'
import { llmJson } from '../llm'
import { CACHE_DIR, DATA_DIR, writeJson } from '../paths'

export const AUDIT_PROMPT_VERSION = 'v2-execution'

// Steps per LLM call — 147 nodes ≈ 13 batches.
const MAX_STEPS_PER_CALL = 12

// The three legacy generic strings this audit exists to replace. An authored reason that
// equals any of them is a validation failure — the whole point is per-node specificity.
export const LEGACY_GENERIC_REASONS: ReadonlySet<string> = new Set([
  IRREDUCIBLE_REASON,
  gapWhy('person'),
  gapWhy('form'),
])

// Hand-verified no-screen/waiting set: these nodes must NEVER come back 'drivable' or
// 'assist' — there is nothing to drive (physical world, interpersonal, or a third party's
// clock). Hard rule in the validator, with correction rounds if the LLM violates it.
export const HAND_VERIFIED_NOT_DRIVABLE: ReadonlySet<string> = new Set([
  'fund_001:n5', 'fund_002:n4', 'fund_003:n5', 'legal_002:n4', 'tax_002:n4', 'ins_001:n4',
  'qs_023:n6', 'hr_001:n3', 'hr_005:n8', 'scale_011:n3', 'startup_001:n6', 'startup_002:n1',
  'growth_012:n6', 'growth_013:n1',
])

export const ComputerUseFeasibilitySchema = z.enum([
  'drivable', 'assist', 'policy-gate', 'no-screen', 'third-party-wait',
])

// One non-agent node to audit.
export interface AuditTarget {
  taskId: string
  nodeId: string
  stepKey: string // `${taskId}:${nodeId}` — the id the LLM answers with
  label: string
  execution?: Execution
  route: 'form' | 'person'
  async: boolean
  approvalRequired: boolean
  riskLevel: string | null
  vendor: string | null
  actionUrl: string | null
  taskTitle: string
  taskDescription: string
  // The current keyword classification (lib/gapClosers.ts classifyGapStep) — offered to the
  // LLM as an explicitly overridable hint, never a constraint.
  hint: string
}

export function auditHash(t: AuditTarget, promptVersion: string): string {
  const payload = JSON.stringify({
    label: t.label,
    route: t.route,
    execution: t.execution,
    async: t.async,
    approvalRequired: t.approvalRequired,
    riskLevel: t.riskLevel,
    vendor: t.vendor,
    actionUrl: t.actionUrl,
    taskTitle: t.taskTitle,
    promptVersion,
  })
  return crypto.createHash('sha256').update(payload).digest('hex')
}

function hintFor(node: GapStep): string {
  const cls = classifyGapStep(node)
  if (!cls) return 'keyword classifier: no rule matched'
  if (cls.kind === 'irreducible') return 'keyword classifier: irreducible (judgment/identity bucket)'
  return `keyword classifier: closer rule "${cls.ruleId}" → ${cls.arenaId} arena ("${cls.blurb}")`
}

export function enumerateAuditTargets(tasks: ProcessTask[]): AuditTarget[] {
  const targets: AuditTarget[] = []
  for (const task of tasks) {
    for (const node of task.dag.nodes) {
      const route = node.route
      if (route === 'agent' || route === undefined) continue
      targets.push({
        taskId: task.id,
        nodeId: node.id,
        stepKey: `${task.id}:${node.id}`,
        label: node.label,
        route,
        execution: node.execution,
        async: node.async ?? false,
        approvalRequired: node.approvalRequired ?? false,
        riskLevel: node.riskLevel ?? null,
        vendor: node.vendor ?? null,
        actionUrl: node.actionUrl ?? null,
        taskTitle: task.title,
        taskDescription: task.description,
        hint: hintFor(node),
      })
    }
  }
  return targets
}

export const RawAuditSchema = z.object({
  stepKey: z.string().min(1),
  why: z.string().min(1),
  computerUse: ComputerUseFeasibilitySchema,
  computerUseWhy: z.string().min(1),
}).array()

export type RawAudit = z.infer<typeof RawAuditSchema>

// Rule validation beyond schema shape (judge.ts posture): a human-readable violation for the
// correction round, or null when clean.
export function validateAuditEntries(entries: RawAudit, expectedStepKeys: string[]): string | null {
  const expected = new Set(expectedStepKeys)
  const seen = new Set<string>()
  for (const e of entries) {
    if (!expected.has(e.stepKey)) return `entry for unexpected step "${e.stepKey}"`
    if (seen.has(e.stepKey)) return `duplicate entry for step "${e.stepKey}"`
    seen.add(e.stepKey)
    if (e.why.trim().length === 0) return `step "${e.stepKey}": empty "why"`
    if (e.computerUseWhy.trim().length === 0) return `step "${e.stepKey}": empty "computerUseWhy"`
    if (LEGACY_GENERIC_REASONS.has(e.why.trim())) {
      return `step "${e.stepKey}": "why" is a generic bucket ("${e.why.trim()}") — name the specific root cause for THIS step`
    }
    if (LEGACY_GENERIC_REASONS.has(e.computerUseWhy.trim())) {
      return `step "${e.stepKey}": "computerUseWhy" is a generic bucket — be specific about what an agent would drive or why it cannot substitute`
    }
    if (HAND_VERIFIED_NOT_DRIVABLE.has(e.stepKey) && (e.computerUse === 'drivable' || e.computerUse === 'assist')) {
      return `step "${e.stepKey}" is hand-verified as having nothing for an agent to operate (no screen, or a third party's clock) — it must not be "drivable" or "assist"; pick "no-screen", "third-party-wait", or "policy-gate"`
    }
  }
  for (const key of expectedStepKeys) {
    if (!seen.has(key)) return `missing entry for step "${key}"`
  }
  return null
}

export const SYSTEM = `You audit the human/manual steps of startup operating processes. Every step you see is routed to a human or a manual form today; a keyword rule engine currently explains them all with three generic strings. Your job is to replace that with the SPECIFIC root cause per step, and to judge honestly whether a computer-use agent (an agent that drives real screens: browsers, portals, desktop apps) could perform the step.

For each step return:
- "why": ONE sentence naming the root cause for THIS step — the actual authority, legal requirement, artifact, judgment, or dependency involved (e.g. "Delaware requires a wet-ink-equivalent officer attestation on the filing"), never a generic bucket like "needs a human" or "manual portal work".
- "computerUse": exactly one of:
  - "drivable" — a computer-use agent could mechanically perform the step today: the screens/forms exist and no authority or judgment gate blocks agent execution.
  - "assist" — an agent can prep, draft, or fill most of it, but a human must exercise the judgment or authority at the end.
  - "policy-gate" — mechanically trivial, but a policy/legal/authority gate makes agent execution inappropriate (board votes, attorney sign-off, officer attestations, approvals with legal weight).
  - "no-screen" — nothing to drive: physical-world work, in-person presence, or interpersonal events (meetings, interviews, negotiations, collecting equipment).
  - "third-party-wait" — the step IS waiting on an external party's clock; there is nothing to operate.
- "computerUseWhy": one sentence. For "drivable"/"assist": what exactly the agent would drive (which portal, form, or flow). Otherwise: precisely why computer use cannot substitute.

Rules:
- This feasibility audit does not assign execution categories or prove an interface works. Preserve the authoritative execution assessment, its uncertainty, human responsibilities and approval properties. Agent Native requires documented tool/API execution or local work; Agent Computer Use requires evidence from the actual browser/computer interface. Human Online and Human Offline distinguish the human medium. Signatures, risk and jurisdiction are properties. Never infer a capability from a hypothetical API or vendor listing.
- Distinguish capability from authority: "the screens exist" does not make an authority-gated step drivable. Attorney sign-off is a policy gate even though clicking Approve is trivial.
- Steps marked async:true default to "third-party-wait" — choose a different value ONLY when the step genuinely has an operable surface or gate, and justify it in computerUseWhy.
- A keyword-classifier hint is provided per step. It is a hint only — override it whenever the step's reality differs.
- Be specific and factual; never hedge into generic phrasing.
Return JSON: an array with EXACTLY one entry per step listed, in any order:
[{"stepKey":"...","why":"...","computerUse":"...","computerUseWhy":"..."}]`

export function auditPrompt(targets: AuditTarget[], extra = ''): string {
  const stepBlock = targets
    .map((t) => {
      const desc = t.taskDescription.length > 180 ? `${t.taskDescription.slice(0, 180)}…` : t.taskDescription
      const facts = [
        `legacy route: ${t.route}`,
        `execution assessment: ${JSON.stringify(t.execution ?? null)}`,
        `async: ${t.async}`,
        `approvalRequired: ${t.approvalRequired}`,
        t.riskLevel ? `riskLevel: ${t.riskLevel}` : null,
        t.vendor ? `vendor: ${t.vendor}` : null,
        t.actionUrl ? `actionUrl: ${t.actionUrl}` : null,
      ].filter(Boolean).join(', ')
      return `Step ${t.stepKey} — process "${t.taskTitle}" (${desc})\n  step: ${t.label} (${facts})\n  hint: ${t.hint}`
    })
    .join('\n\n')
  return `Steps to audit (${targets.length}):\n\n${stepBlock}\n${extra}`
}

// ---------------------------------------------------------------------------
// Committed output schema
// ---------------------------------------------------------------------------

export const HumanStepAuditEntrySchema = z.object({
  taskId: z.string().min(1),
  nodeId: z.string().min(1),
  route: z.enum(['form', 'person']),
  why: z.string().min(1),
  computerUse: ComputerUseFeasibilitySchema,
  computerUseWhy: z.string().min(1),
  // Marks a hand-curated entry a rerun must not clobber: assembly keeps the committed entry
  // for this node instead of the cache-derived one (mergeAuditEntries below) — the same
  // preserve idiom as probe-tier evidence (lib/schemas.ts EvidenceSchema). Removal happens by
  // editing the committed file in an explicit dated change. `true` or absent — never `false`.
  preserve: z.literal(true).optional(),
})

export const HumanStepAuditFileSchema = HumanStepAuditEntrySchema.array()

export type HumanStepAuditEntry = z.infer<typeof HumanStepAuditEntrySchema>

// A rerun assembles the whole committed file from the LLM cache — which would clobber any
// hand-curated entry (the same wholesale-replace class as the probe-stage refresh). Entries
// marked preserve: true in the committed file win over the cache-derived entry for the same
// node — for the CURATED fields (why, computerUse, computerUseWhy). `route` is source-mirrored
// corpus metadata, not curation, so a route change in the corpus flows through even on a
// preserved entry (otherwise a preserved step would keep its old route forever). Preserved
// entries for nodes no longer in the corpus drop out (coverage stays exact).
export function mergeAuditEntries(
  assembled: HumanStepAuditEntry[],
  committed: HumanStepAuditEntry[],
): HumanStepAuditEntry[] {
  const preserved = new Map(
    committed.filter((e) => e.preserve === true).map((e) => [`${e.taskId}:${e.nodeId}`, e]),
  )
  return assembled.map((e) => {
    const curated = preserved.get(`${e.taskId}:${e.nodeId}`)
    return curated ? { ...curated, route: e.route } : e
  })
}

// ---------------------------------------------------------------------------
// Cache + run
// ---------------------------------------------------------------------------

interface CacheEntry {
  hash: string
  why: string
  computerUse: z.infer<typeof ComputerUseFeasibilitySchema>
  computerUseWhy: string
}

type AuditCache = Record<string, CacheEntry> // key: `${taskId}:${nodeId}`

const CACHE_FILE = path.join(CACHE_DIR, 'human-steps', 'audit.json')

function readCache(): AuditCache {
  if (!fs.existsSync(CACHE_FILE)) return {}
  return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) as AuditCache
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export async function runAudit({ task }: { task?: string } = {}): Promise<void> {
  const allTargets = enumerateAuditTargets(loadProcesses(DATA_DIR))
  const runTargets = task ? allTargets.filter((t) => t.taskId === task) : allTargets
  const cache = readCache()
  const stale = runTargets.filter((t) => cache[t.stepKey]?.hash !== auditHash(t, AUDIT_PROMPT_VERSION))
  console.log(`audit: ${allTargets.length} non-agent steps in corpus, ${runTargets.length} in scope, ${stale.length} stale`)

  let calls = 0
  for (const batch of chunk(stale, MAX_STEPS_PER_CALL)) {
    const expected = batch.map((t) => t.stepKey)
    let raw = await llmJson({ schema: RawAuditSchema, system: SYSTEM, prompt: auditPrompt(batch), maxTokens: 8192 })
    calls += 1
    let violation = validateAuditEntries(raw, expected)
    for (let round = 0; violation && round < 3; round++) {
      raw = await llmJson({
        schema: RawAuditSchema,
        system: SYSTEM,
        prompt: auditPrompt(batch, `\nYour previous answer violated a rule: ${violation}. Correct it. One entry per step listed; feasibility from the closed enum; specific one-sentence reasons, never generic buckets.`),
        maxTokens: 8192,
      })
      calls += 1
      violation = validateAuditEntries(raw, expected)
    }
    if (violation) throw new Error(`audit-human-steps: batch still violates rules after 3 correction rounds: ${violation}`)

    const byKey = new Map(batch.map((t) => [t.stepKey, t]))
    for (const entry of raw) {
      const t = byKey.get(entry.stepKey)!
      // Soft rule: async steps default to third-party-wait; the LLM may argue otherwise in
      // computerUseWhy — allowed, but surfaced for the run log so a human can spot-check.
      if (t.async && entry.computerUse !== 'third-party-wait') {
        console.warn(`audit: note — ${entry.stepKey} is async:true but judged "${entry.computerUse}": ${entry.computerUseWhy}`)
      }
      cache[t.stepKey] = {
        hash: auditHash(t, AUDIT_PROMPT_VERSION),
        why: entry.why.trim(),
        computerUse: entry.computerUse,
        computerUseWhy: entry.computerUseWhy.trim(),
      }
    }
    writeJson(CACHE_FILE, cache)
    console.log(`audit: batch of ${batch.length} done (${calls} LLM calls so far)`)
  }
  console.log(`audit: done — ${calls} LLM calls this run`)

  // Assemble the committed audit from ALL cached nodes — never a partial file (judge.ts
  // posture): every non-agent node must be fresh in cache before we write.
  const entries: z.infer<typeof HumanStepAuditEntrySchema>[] = []
  for (const t of allTargets) {
    const cached = cache[t.stepKey]
    if (!cached || cached.hash !== auditHash(t, AUDIT_PROMPT_VERSION)) {
      console.warn(`audit: incomplete — missing/stale ${t.stepKey}; not writing human-step-audit.json`)
      return
    }
    entries.push({
      taskId: t.taskId,
      nodeId: t.nodeId,
      route: t.route,
      why: cached.why,
      computerUse: cached.computerUse,
      computerUseWhy: cached.computerUseWhy,
    })
  }
  entries.sort((a, b) => a.taskId.localeCompare(b.taskId) || a.nodeId.localeCompare(b.nodeId))
  const auditFile = path.join(DATA_DIR, 'human-step-audit.json')
  const committed = fs.existsSync(auditFile)
    ? HumanStepAuditFileSchema.parse(JSON.parse(fs.readFileSync(auditFile, 'utf8')))
    : []
  const merged = mergeAuditEntries(entries, committed)
  writeJson(auditFile, HumanStepAuditFileSchema.parse(merged))
  const kept = merged.filter((e) => e.preserve === true).length
  console.log(`audit: wrote ${merged.length} audited steps to open-rankings/human-step-audit.json (${kept} preserved)`)
}

function printReport(): void {
  const file = path.join(DATA_DIR, 'human-step-audit.json')
  if (!fs.existsSync(file)) {
    console.log('report: no human-step-audit.json yet')
    return
  }
  const entries = HumanStepAuditFileSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')))
  const byFeasibility = new Map<string, number>()
  for (const e of entries) byFeasibility.set(e.computerUse, (byFeasibility.get(e.computerUse) ?? 0) + 1)
  console.log(`report: ${entries.length} audited steps`)
  for (const [k, n] of [...byFeasibility.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`report: ${k} — ${n}`)
  }
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i === -1 ? undefined : process.argv[i + 1]
}

// tsx entrypoint — skipped when imported by tests (same pattern as map-step-stories.ts).
if (require.main === module) {
  if (process.argv.includes('--report')) {
    printReport()
  } else {
    runAudit({ task: arg('--task') }).catch((err) => {
      console.error(err)
      process.exit(1)
    })
  }
}
