// Step→prompt generator: for every DAG node of a process, one LLM pass writes a copy-pasteable
// PROMPT an end user can hand to their own agent (Claude, etc.) to perform that step — grounded
// in exactly what this site knows about the step: the task title/description, the node's
// label/route/async/approvalRequired/actionUrl/functionCalls, the step's mapped stories
// (lib/processRankings.ts functionMappingFor + story titles), the step's GROUNDED vendor API
// calls (data/step-vendor-calls.json via lib/stepVendorCalls.ts), and the human-step audit
// entry (lib/humanSteps.ts) for non-agent routes. Writes the committed data/step-prompts.json
// that lib/stepPrompts.ts loads.
//
// Same honesty + cost architecture as map-step-stories.ts (the model for this script):
//   - the prompt is an ANNOTATION: verdicts, scoring, judge caches are never touched;
//   - hard validator rules (judge.ts posture) with correction rounds:
//       · the literal `{{vendor}}` placeholder is REQUIRED when the step has a vendor market
//         (a covering arena — the UI substitutes the reader's stack pick or the step's top
//         vendor) and FORBIDDEN otherwise; when required, the canonical vendor's name must
//         not also appear (the substitution would clash);
//       · concrete API endpoints (`GET|POST|PUT|PATCH|DELETE /...`) may appear ONLY as
//         substrings of the step's grounded vendor calls — never invented;
//       · non-agent steps respect the audit verdict: 'assist'/'policy-gate' prompts PREPARE
//         and stop for human sign-off (enforced phrase, no impersonation of the human part);
//         'no-screen'/'third-party-wait' prompts cover the preparable/monitorable part only
//         and state plainly what remains a human step (enforced phrase);
//       · no secrets handling beyond "use your configured credentials";
//       · 120–350 words;
//   - cached per node by a hash over the node fields + task title + grounded-calls digest +
//     audit digest + prompt version (pipeline/cache/step-prompts/<taskId>.json), so re-runs
//     are incremental; the committed JSON is written all-or-nothing per task: only tasks whose
//     every node is fresh in cache are included, and nothing is written unless every task in
//     the run scope is complete.
//
// Usage: tsx pipeline/scripts/map-step-prompts.ts [--task <id>] [--report]
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { humanStepAudit, type HumanStepAudit } from '../../lib/humanSteps'
import { loadProcesses, vendorLabel, type DagNode, type ProcessTask } from '../../lib/processes'
import { coveringArenaId, functionMappingFor } from '../../lib/processRankings'
import { StorySchema, type Story } from '../../lib/schemas'
import { stepVendorCallsFor } from '../../lib/stepVendorCalls'
import { llmJson } from '../llm'
import { CACHE_DIR, categoryDir, DATA_DIR, readJson, writeJson } from '../paths'

export const STEP_PROMPT_VERSION = 'v1'

export const MIN_PROMPT_WORDS = 120
export const MAX_PROMPT_WORDS = 350

// The literal placeholder the UI substitutes with the reader's stack pick or the step's top
// vendor. Required in the prompt iff the step has a vendor market (a covering arena).
export const VENDOR_PLACEHOLDER = '{{vendor}}'

// Validator regexes — exported so pipeline/__tests__/stepPrompts.test.ts re-checks the
// committed file against EXACTLY the rules the generator enforced.
// Any HTTP method + path token in the prompt must be a substring of a grounded call.
export const ENDPOINT_RE = /\b(?:GET|POST|PUT|PATCH|DELETE)\s+\/\S*/g
// 'assist' / 'policy-gate': the prompt must prepare, then stop — this exact phrasing.
export const STOP_FOR_HUMAN_RE = /stop for human (?:review|sign-off)/i
// 'no-screen' / 'third-party-wait': the prompt must state plainly what stays human.
export const REMAINS_HUMAN_RE = /remains a human step/i
// No prompt may instruct the agent to execute the human part in the human's place. Negated
// spans ("you must NOT sign … on my behalf") are stripped before matching — telling the agent
// what it must not do is exactly the posture we want, not a violation.
export const IMPERSONATION_RE =
  /\b(?:sign|approve|accept|submit|agree(?:\s+to)?|authorize|consent(?:\s+to)?)\b[^.!?]{0,80}\bon\s+(?:my|our|the|their|your)\s+(?:user'?s?\s+|human'?s?\s+|founder'?s?\s+|owner'?s?\s+|officer'?s?\s+)?behalf\b|\bimpersonat/i
const NEGATED_SPAN_RE = /\b(?:not|never|don'?t|do not|must not|without|instead of)\b[^.!?]*/gi
// Talking ABOUT impersonation as the risk being defended against is not the agent
// impersonating anyone (sit_015:n2 trap 2026-10-05: the step's own subject is "stop
// impersonation" in a DSAR identity check, so every faithful prompt tripped `\bimpersonat`).
const ANTI_IMPERSONATION_SPAN_RE = /\b(?:prevent|stop|avoid|detect|block|against|anti|flag|rule out|screen for)\b[^.!?]{0,60}\bimpersonat\w*/gi

export function instructsImpersonation(prompt: string): boolean {
  return IMPERSONATION_RE.test(prompt.replace(NEGATED_SPAN_RE, '').replace(ANTI_IMPERSONATION_SPAN_RE, ''))
}

// No secrets handling beyond "use your configured credentials". Verbs are the clearly-bad
// handling ones — "enter"/"send"/"email" false-positive constantly in an email-process corpus
// ("transactional email (password resets …)").
export const SECRETS_RE =
  /\b(?:paste|share|reveal|expose|hard-?code|hardcode|embed|copy)\b[^.!?]{0,80}\b(?:api key|secret|password|token|credential)/i

// One grounded vendor call, flattened for grounding + endpoint validation.
export interface GroundedCall {
  vendorName: string
  method: string
  type: string
  description?: string
}

// One DAG node to prompt — everything the site knows about the step, resolved once.
export interface PromptTarget {
  taskId: string
  nodeId: string
  stepKey: string // `${taskId}:${nodeId}`
  taskTitle: string
  taskDescription: string
  label: string
  route: DagNode['route']
  async: boolean
  approvalRequired: boolean
  actionUrl: string | null
  functionCalls: Array<{ method: string; type: string; description?: string }>
  vendor: string | null // canonical vendor key, e.g. 'sendgrid'
  arenaId: string | null // covering arena — non-null means "has a vendor market"
  storyTitles: string[] // titles of the step's mapped 'function' stories
  groundedCalls: GroundedCall[] // from data/step-vendor-calls.json, all vendors
  audit: HumanStepAudit | null // only for non-agent routes
}

export const hasVendorMarket = (t: Pick<PromptTarget, 'arenaId'>): boolean => t.arenaId !== null

export function promptTargetHash(t: PromptTarget, promptVersion: string): string {
  const payload = JSON.stringify({
    label: t.label,
    route: t.route,
    async: t.async,
    approvalRequired: t.approvalRequired,
    actionUrl: t.actionUrl,
    functionCalls: t.functionCalls,
    vendor: t.vendor,
    arenaId: t.arenaId,
    taskTitle: t.taskTitle,
    storyTitles: t.storyTitles,
    callsDigest: t.groundedCalls.map((c) => [c.vendorName, c.method, c.type, c.description ?? '']),
    auditDigest: t.audit
      ? [t.audit.route, t.audit.why, t.audit.computerUse, t.audit.computerUseWhy]
      : null,
    promptVersion,
  })
  return crypto.createHash('sha256').update(payload).digest('hex')
}

export const RawPromptSchema = z.object({ prompt: z.string().min(1) })
export type RawPrompt = z.infer<typeof RawPromptSchema>

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

// Rule validation beyond schema shape (map-step-stories.ts posture): a human-readable
// violation for the correction round, or null when clean.
export function validatePrompt(t: PromptTarget, prompt: string): string | null {
  const words = wordCount(prompt)
  if (words < MIN_PROMPT_WORDS || words > MAX_PROMPT_WORDS) {
    return `prompt is ${words} words — must be ${MIN_PROMPT_WORDS}-${MAX_PROMPT_WORDS}`
  }

  // Vendor placeholder: required with a market, forbidden without one; the canonical vendor's
  // name must not appear alongside the placeholder (the UI substitutes a possibly different
  // vendor).
  if (hasVendorMarket(t)) {
    if (!prompt.includes(VENDOR_PLACEHOLDER)) {
      return `step has a vendor market — the literal placeholder ${VENDOR_PLACEHOLDER} is required wherever the vendor name would go`
    }
    const label = t.vendor ? vendorLabel(t.vendor) : null
    // Word-boundary match, not a bare substring: short labels otherwise forbid unrelated
    // words that contain them (label "IRS" matched "first"/"theirs" and made the rule
    // unsatisfiable — surfaced when the irs vendor key gained a market at the
    // government-services bring-up, 2026-10-05).
    const namesLabel = label
      && new RegExp(`(?<![a-z0-9])${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`, 'i').test(prompt)
    if (namesLabel) {
      return `prompt names the canonical vendor "${label}" — use only the ${VENDOR_PLACEHOLDER} placeholder (the reader's pick may differ)`
    }
  } else if (prompt.includes(VENDOR_PLACEHOLDER)) {
    return `step has no vendor market — the ${VENDOR_PLACEHOLDER} placeholder is forbidden; name the actual service`
  }

  // Endpoint grounding: every method+path token must be a substring of a grounded call.
  const grounded = t.groundedCalls.map((c) => c.method)
  for (const raw of prompt.match(ENDPOINT_RE) ?? []) {
    const endpoint = raw.replace(/[.,;:!?)\]}'"`]+$/, '')
    if (!grounded.some((m) => m.includes(endpoint))) {
      return `endpoint "${endpoint}" is not among the step's grounded vendor calls — describe the operation in words instead`
    }
  }

  // Non-agent steps must respect the audit verdict.
  if (t.route !== 'agent' && t.audit) {
    const verdict = t.audit.computerUse
    if (verdict !== 'drivable' && instructsImpersonation(prompt)) {
      return `prompt instructs the agent to act on the human's behalf — the human part must stay human`
    }
    if ((verdict === 'assist' || verdict === 'policy-gate') && !STOP_FOR_HUMAN_RE.test(prompt)) {
      return `audit verdict is '${verdict}' — the prompt must instruct the agent to prepare everything and include the exact phrase "stop for human sign-off"`
    }
    if ((verdict === 'no-screen' || verdict === 'third-party-wait') && !REMAINS_HUMAN_RE.test(prompt)) {
      return `audit verdict is '${verdict}' — the prompt must cover only the preparable/monitorable part and include the exact phrase "remains a human step"`
    }
  }

  if (SECRETS_RE.test(prompt)) {
    return `prompt gives secrets-handling instructions — the only allowed credential guidance is "use your configured credentials"`
  }

  return null
}

export const SYSTEM = `You write copy-pasteable prompts. Each prompt will be pasted BY A STARTUP FOUNDER into their own AI agent (Claude or similar, with API/browser tools and configured credentials) so the agent performs ONE step of a startup operating process. You are given everything a research site knows about the step; the founder's agent knows nothing else.

Write ONE prompt of ${MIN_PROMPT_WORDS}-${MAX_PROMPT_WORDS} words, addressed to the agent ("You are helping me..."/"Please..."), concrete and self-contained: state the goal, the inputs the agent should ask me for if missing (e.g. my domain), the actions to take, what done looks like, and how to report back.

Hard rules — a validator rejects violations:
- If the step context says it HAS A VENDOR MARKET, write the literal placeholder {{vendor}} wherever the vendor/product name would go (it is substituted with my chosen vendor later) and NEVER name a specific vendor for that role. If it says NO vendor market, name the actual service plainly and never write {{vendor}}.
- Never write an HTTP method + path (like "POST /v3/...") unless that exact endpoint appears in the GROUNDED VENDOR CALLS section — if none are listed, describe operations in words ("use the domain authentication API", "create the DNS records via the dashboard or API").
- Credentials: at most "use your configured credentials". Never instruct pasting/sharing/embedding API keys, tokens, passwords or secrets.
- If a HUMAN-STEP AUDIT is given, obey its verdict:
  · assist / policy-gate — the agent PREPARES everything (drafts, pre-filled values, a checklist) and then must stop; include the exact phrase "stop for human sign-off" and never tell the agent to sign, accept terms, approve, or submit on my behalf.
  · no-screen / third-party-wait — prompt only the preparable/monitorable part; include the exact phrase "remains a human step" about the part the agent cannot do.
- Stay inside what the step context supports. Do not invent features, URLs, or endpoints.

Return JSON only: {"prompt":"..."}`

export function generationPrompt(t: PromptTarget, extra = ''): string {
  const lines: string[] = []
  lines.push(`Process: "${t.taskTitle}" — ${t.taskDescription}`)
  lines.push(`Step ${t.stepKey}: ${t.label}`)
  lines.push(
    `Route: ${t.route}${t.async ? ' (async — the result lands later; the agent should note it must poll/verify)' : ''}${t.approvalRequired ? ' | approvalRequired: a human explicitly approves before changes are applied' : ''}`,
  )
  if (t.actionUrl) lines.push(`Action URL: ${t.actionUrl}`)
  lines.push(
    hasVendorMarket(t)
      ? `Vendor market: YES — arena "${t.arenaId}". Use the literal {{vendor}} placeholder for the product name; do not name any specific vendor for this role.`
      : `Vendor market: NO — ${t.vendor ? `this step is specifically about ${vendorLabel(t.vendor)}; name it plainly` : 'no ranked vendor roster; name the actual services plainly'}. Never write {{vendor}}.`,
  )
  if (t.functionCalls.length > 0) {
    lines.push(
      `What the step does (site's internal notes — do NOT quote these endpoints, describe the operations in words):\n${t.functionCalls.map((c) => `- ${c.description ?? c.method} [${c.type}]`).join('\n')}`,
    )
  }
  if (t.storyTitles.length > 0) {
    lines.push(`Capabilities the market's products are judged on for this step (grounding for what an agent can expect to do):\n${t.storyTitles.map((s) => `- ${s}`).join('\n')}`)
  }
  lines.push(
    t.groundedCalls.length > 0
      ? `GROUNDED VENDOR CALLS (the only endpoints you may quote verbatim):\n${t.groundedCalls.map((c) => `- [${c.vendorName}] ${c.method} (${c.type})${c.description ? ` — ${c.description}` : ''}`).join('\n')}`
      : 'GROUNDED VENDOR CALLS: none — quote no endpoints; describe every operation in words.',
  )
  if (t.route !== 'agent') {
    lines.push(
      t.audit
        ? `HUMAN-STEP AUDIT: verdict '${t.audit.computerUse}'. Why human: ${t.audit.why} Computer-use feasibility: ${t.audit.computerUseWhy}`
        : 'HUMAN-STEP AUDIT: none on file — this is a manual step; have the agent prepare and let me execute.',
    )
  }
  lines.push(`Write the ${MIN_PROMPT_WORDS}-${MAX_PROMPT_WORDS} word prompt now.${extra}`)
  return lines.join('\n\n')
}

// ---------------------------------------------------------------------------
// Target enumeration — every DAG node of every task (the pilot scopes with --task)
// ---------------------------------------------------------------------------

function storyTitlesFor(taskId: string, node: DagNode, storiesCache: Map<string, Map<string, Story> | null>): string[] {
  const entry = functionMappingFor(taskId, node, DATA_DIR)
  if (!entry || entry.storyIds.length === 0) return []
  if (!storiesCache.has(entry.arenaId)) {
    const file = path.join(categoryDir(entry.arenaId), 'stories.json')
    storiesCache.set(
      entry.arenaId,
      fs.existsSync(file) ? new Map(readJson(StorySchema.array(), file).map((s) => [s.id, s])) : null,
    )
  }
  const byId = storiesCache.get(entry.arenaId)
  if (!byId) return []
  return entry.storyIds.map((id) => byId.get(id)?.title).filter((t): t is string => Boolean(t))
}

export function enumeratePromptTargets(tasks: ProcessTask[]): PromptTarget[] {
  const storiesCache = new Map<string, Map<string, Story> | null>()
  const targets: PromptTarget[] = []
  for (const task of tasks) {
    for (const node of task.dag.nodes) {
      targets.push({
        taskId: task.id,
        nodeId: node.id,
        stepKey: `${task.id}:${node.id}`,
        taskTitle: task.title,
        taskDescription: task.description,
        label: node.label,
        route: node.route,
        async: node.async ?? false,
        approvalRequired: node.approvalRequired ?? false,
        actionUrl: node.actionUrl ?? null,
        functionCalls: (node.functionCalls ?? []).map((c) => ({
          method: c.method,
          type: c.type ?? 'rest',
          ...(c.description ? { description: c.description } : {}),
        })),
        vendor: node.vendor ?? null,
        arenaId: coveringArenaId(node),
        groundedCalls: stepVendorCallsFor(task.id, node.id, DATA_DIR).flatMap((v) =>
          v.calls.map((c) => ({
            vendorName: v.name,
            method: c.method,
            type: c.type ?? 'rest',
            ...(c.description ? { description: c.description } : {}),
          })),
        ),
        storyTitles: storyTitlesFor(task.id, node, storiesCache),
        audit: node.route !== 'agent' ? humanStepAudit(task.id, node.id) : null,
      })
    }
  }
  return targets
}

// ---------------------------------------------------------------------------
// Cache + run
// ---------------------------------------------------------------------------

interface CacheEntry {
  hash: string
  prompt: string
}

type TaskCache = Record<string, CacheEntry> // key: `${taskId}:${nodeId}`

function cacheFileFor(taskId: string): string {
  return path.join(CACHE_DIR, 'step-prompts', `${taskId}.json`)
}

function readTaskCache(file: string): TaskCache {
  if (!fs.existsSync(file)) return {}
  return JSON.parse(fs.readFileSync(file, 'utf8')) as TaskCache
}

// The committed-file schema (data/step-prompts.json) — lib/stepPrompts.ts reads this shape.
export const StepPromptEntrySchema = z.object({
  taskId: z.string().min(1),
  nodeId: z.string().min(1),
  prompt: z.string().min(1),
})
export const StepPromptsFileSchema = StepPromptEntrySchema.array()

async function generateOne(t: PromptTarget): Promise<{ prompt: string; calls: number }> {
  let raw = await llmJson({ schema: RawPromptSchema, system: SYSTEM, prompt: generationPrompt(t) })
  let calls = 1
  let violation = validatePrompt(t, raw.prompt)
  for (let round = 0; violation && round < 3; round++) {
    raw = await llmJson({
      schema: RawPromptSchema,
      system: SYSTEM,
      // Correction-round message only — the initial prompt and PROMPT_VERSION stay untouched
      // (email-lane precedent 2026-09-23; vendor_010 Composio trap 2026-09-25: the model kept
      // naming the canonical vendor, so the reminder now spells the placeholder rule out;
      // scale_004 Slack-in-the-label trap 2026-09-28: when the step LABEL itself names the
      // canonical vendor the model kept echoing it, so the reminder now covers that case;
      // scale_010 warehouse-credentials trap 2026-09-28: the model kept writing connection
      // set-up prose like "copy the API key", so the reminder now spells the secrets rule out;
      // sit_015 over-budget trap 2026-10-05: the model kept landing a few words over the
      // 350-word cap across all correction rounds, so the reminder now spells the budget out;
      // sit_015:n2 impersonation trap 2026-10-05: on person-route steps the model kept telling
      // the agent to perform the human act itself, so the reminder restates the audit rule).
      prompt: generationPrompt(t, `\n\nYour previous answer violated a rule: ${violation}. Rewrite the prompt correcting it; every other rule still applies. CRITICAL REMINDERS: never write ANY vendor's actual name — not even the canonical/top-ranked vendor for this step, and not even when the step's own label names it (paraphrase the label generically: "Configure Slack notifications" → "configure notifications in {{vendor}}") — always the literal {{vendor}} token wherever the vendor is meant; keep every other vendor mention generic ("your registrar", "your CRM", "your team chat"). NEVER give credential-handling instructions — no pasting/sharing/copying/embedding of API keys, tokens, passwords, secrets or credentials anywhere in the prompt, even as connection-setup steps; the ONLY allowed credential sentence is "use your configured credentials". HARD WORD BUDGET: the final prompt must be between ${MIN_PROMPT_WORDS} and ${MAX_PROMPT_WORDS} words — if your draft runs long, delete whole secondary sentences rather than trimming required phrases; aim for about ${MAX_PROMPT_WORDS - 50} words. If a HUMAN-STEP AUDIT applies, the agent only PREPARES and monitors: never instruct it to sign, approve, submit, decide, or verify/confirm anything on my behalf — the human act stays mine, and the verdict's required exact phrase must appear.`),
    })
    calls += 1
    violation = validatePrompt(t, raw.prompt)
  }
  if (violation) throw new Error(`map-step-prompts: ${t.stepKey} still violates rules after correction rounds: ${violation}`)
  return { prompt: raw.prompt, calls }
}

export async function runGenerator({ task }: { task?: string } = {}): Promise<void> {
  const allTasks = loadProcesses(DATA_DIR)
  if (task && !allTasks.some((t) => t.id === task)) throw new Error(`unknown task: ${task}`)
  const allTargets = enumeratePromptTargets(allTasks)
  const runTargets = task ? allTargets.filter((t) => t.taskId === task) : allTargets
  console.log(`prompts: ${task ?? 'all tasks'} — ${runTargets.length} steps in scope`)

  // Generate stale cells, cached per task file.
  let totalCalls = 0
  let generated = 0
  const byTask = new Map<string, PromptTarget[]>()
  for (const t of runTargets) byTask.set(t.taskId, [...(byTask.get(t.taskId) ?? []), t])
  for (const [taskId, targets] of byTask) {
    const cacheFile = cacheFileFor(taskId)
    const cache = readTaskCache(cacheFile)
    for (const t of targets) {
      if (cache[t.stepKey]?.hash === promptTargetHash(t, STEP_PROMPT_VERSION)) continue
      const { prompt, calls } = await generateOne(t)
      totalCalls += calls
      generated += 1
      cache[t.stepKey] = { hash: promptTargetHash(t, STEP_PROMPT_VERSION), prompt }
      writeJson(cacheFile, cache)
      console.log(`prompts: ${t.stepKey} — generated (${wordCount(prompt)} words, ${calls} call${calls === 1 ? '' : 's'})`)
    }
  }
  console.log(`prompts: done — ${generated} generated, ${totalCalls} LLM calls this run`)

  // Assemble the committed file all-or-nothing per task: a task's entries are included only
  // when EVERY node of that task is fresh in cache; nothing is written unless every task in
  // the run scope is complete (map-step-stories.ts posture, scoped so the pilot can ship one
  // task while the corpus fills in later).
  const entries: Array<z.infer<typeof StepPromptEntrySchema>> = []
  const allByTask = new Map<string, PromptTarget[]>()
  for (const t of allTargets) allByTask.set(t.taskId, [...(allByTask.get(t.taskId) ?? []), t])
  for (const [taskId, targets] of allByTask) {
    const cache = readTaskCache(cacheFileFor(taskId))
    const fresh = targets.every((t) => cache[t.stepKey]?.hash === promptTargetHash(t, STEP_PROMPT_VERSION))
    if (!fresh) {
      if (task && taskId !== task) continue // out-of-scope task not yet generated — fine, skip it
      console.warn(`prompts: ${taskId} incomplete after run — not writing data/step-prompts.json`)
      return
    }
    for (const t of targets) entries.push({ taskId: t.taskId, nodeId: t.nodeId, prompt: cache[t.stepKey].prompt })
  }
  entries.sort((a, b) => a.taskId.localeCompare(b.taskId) || a.nodeId.localeCompare(b.nodeId))
  writeJson(path.join(DATA_DIR, 'step-prompts.json'), StepPromptsFileSchema.parse(entries))
  console.log(`prompts: wrote ${entries.length} step prompts to data/step-prompts.json`)
}

function printReport(): void {
  const file = path.join(DATA_DIR, 'step-prompts.json')
  if (!fs.existsSync(file)) {
    console.log('report: no step-prompts.json yet')
    return
  }
  const entries = readJson(StepPromptsFileSchema, file)
  const tasks = new Set(entries.map((e) => e.taskId))
  const words = entries.map((e) => wordCount(e.prompt))
  console.log(
    `report: ${entries.length} prompts across ${tasks.size} tasks — ${Math.min(...words)}-${Math.max(...words)} words (${(words.reduce((a, b) => a + b, 0) / Math.max(entries.length, 1)).toFixed(0)} avg)`,
  )
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
    runGenerator({ task: arg('--task') }).catch((err) => {
      console.error(err)
      process.exit(1)
    })
  }
}
