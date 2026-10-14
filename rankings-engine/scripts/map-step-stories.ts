// Step→story mapper: for every process step with a covering arena, one LLM pass decides which
// of that arena's user stories are RELEVANT to the step ("run payroll" → the payroll-run
// stories, not the whole arena) — plus, for every MANUAL step (any non-agent route: form
// portals and human steps alike — lib/processRankings.ts isComputerUseCandidate), which
// computer-use stories describe attempting it (browser-agents' full story set; ai-assistants
// restricted to its judged computer-use stories) — plus, for every step declaring ADDITIONAL
// covering arenas (extraOptionArenas /
// extraOptionRefs), which of THAT arena's stories describe performing the step (kind 'extra':
// "generate a website" onto ai-assistants / design-tools). Writes the committed
// open-rankings/process-step-stories.json that lib/processRankings.ts derives every step/process
// ranking from.
//
// Same honesty + cost architecture as classify-story-tiers.ts (the model for this script):
//   - the mapping is an ANNOTATION: verdicts, scoring, judge caches are never touched;
//   - selection is capped and allowed to be empty — "no relevant story" is a first-class
//     honest answer, never padded;
//   - judge-style correction rounds: every returned storyId must exist in the offered
//     candidate list, every step must be answered exactly once, or the batch is re-asked;
//   - cached per (step, arena, kind) by a hash over the step text + candidate stories +
//     prompt version (rankings-engine/cache/step-stories/), so re-runs are incremental and a mid-run
//     crash resumes for free; the committed JSON is assembled only when every cell is fresh.
//
// Usage: tsx rankings-engine/scripts/map-step-stories.ts [--task <id>] [--report]
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { loadProcesses, type ProcessTask } from '../../lib/processes'
import {
  COMPUTER_USE_SOURCES, coveringArenaId, extraArenasFor, isComputerUseCandidate,
  StepStoryMapSchema, type StepStoryEntry,
} from '../../lib/processRankings'
import { StorySchema, type Story } from '../../lib/schemas'
import { llmJson } from '../llm'
import { CACHE_DIR, categoryDir, DATA_DIR, readJson, writeJson } from '../paths'

export const STEP_STORY_PROMPT_VERSION = 'v1'

// Steps per LLM call — each batch shares one arena (one candidate story list in the prompt).
const MAX_STEPS_PER_CALL = 12

// Hard cap on stories per step: a step relevant to "everything" is a mapping smell, and the
// scores stay legible when they rest on a handful of stories.
export const MAX_STORIES_PER_STEP = 8

export type MappingKind = StepStoryEntry['kind']

// One (step, arena, kind) cell to map.
export interface MapTarget {
  taskId: string
  nodeId: string
  kind: MappingKind
  arenaId: string
  stepKey: string // `${taskId}:${nodeId}` — the id the LLM answers with
  label: string
  route: string
  taskTitle: string
  taskDescription: string
  candidates: Story[]
}

export function targetHash(t: MapTarget, promptVersion: string): string {
  const payload = JSON.stringify({
    label: t.label,
    route: t.route,
    kind: t.kind,
    taskTitle: t.taskTitle,
    taskDescription: t.taskDescription,
    candidates: t.candidates.map((s) => [s.id, s.title, s.weight]),
    promptVersion,
  })
  return crypto.createHash('sha256').update(payload).digest('hex')
}

export const RawStepMapSchema = z.object({
  stepKey: z.string().min(1),
  storyIds: z.string().min(1).array(),
}).array()

export type RawStepMap = z.infer<typeof RawStepMapSchema>

// Rule validation beyond schema shape (judge.ts posture): a human-readable violation for the
// correction round, or null when clean.
export function validateStepMapEntries(
  entries: RawStepMap,
  expectedStepKeys: string[],
  candidateIds: ReadonlySet<string>,
): string | null {
  const expected = new Set(expectedStepKeys)
  const seen = new Set<string>()
  for (const e of entries) {
    if (!expected.has(e.stepKey)) return `entry for unexpected step "${e.stepKey}"`
    if (seen.has(e.stepKey)) return `duplicate entry for step "${e.stepKey}"`
    seen.add(e.stepKey)
    if (e.storyIds.length > MAX_STORIES_PER_STEP) {
      return `step "${e.stepKey}": ${e.storyIds.length} stories exceeds the cap of ${MAX_STORIES_PER_STEP} — keep only the most directly exercised`
    }
    const dup = e.storyIds.find((id, i) => e.storyIds.indexOf(id) !== i)
    if (dup) return `step "${e.stepKey}": duplicate storyId "${dup}"`
    for (const id of e.storyIds) {
      if (!candidateIds.has(id)) return `step "${e.stepKey}": storyId "${id}" is not in the candidate story list`
    }
  }
  for (const key of expectedStepKeys) {
    if (!seen.has(key)) return `missing entry for step "${key}"`
  }
  return null
}

export const SYSTEM = `You map startup operating-process steps onto the user stories of a judged product arena, so each step can be scored from the vendors' already-judged story verdicts.
For each step, select ONLY the stories describing capabilities a vendor product would directly exercise to perform (or, for computer-use mapping, to attempt) that step.
Rules:
- Select at most ${MAX_STORIES_PER_STEP} stories per step; 2-6 is typical. Return [] when no candidate story is genuinely relevant — an empty answer is correct and expected, never pad.
- Only ids from the candidate list. Never invent, never guess.
- Platform-quality stories (pricing transparency, openness/self-hosting, privacy posture, docs quality, SLAs) are NOT step-relevant unless the step itself is about that concern.
- Agent-access plumbing stories (public API, MCP, SDKs, webhooks) are relevant only when the step is executed BY an agent through that surface — which is the default framing here: prefer the stories about doing this step's actual work; include at most the 1-2 access stories that carry it.
- kind=computer-use steps are human steps a computer-use agent might ATTEMPT: pick the stories about executing that kind of web/desktop task (navigating portals, filling forms, completing tasks end-to-end, handling logins/files), not unrelated platform features.
- kind=extra maps the step onto an ADJACENT arena (the step's primary market lives elsewhere): be strict — select only stories a product of THIS arena would directly exercise to perform the step itself, and return [] unless this arena's products genuinely perform this move.
Return JSON: an array with EXACTLY one entry per step listed, in any order:
[{"stepKey":"...","storyIds":["..."]}]`

export function mapPrompt(arenaId: string, candidates: Story[], targets: MapTarget[], extra = ''): string {
  const storyBlock = candidates
    .map((s) => `- ${s.id} (w${s.weight}): ${s.title}`)
    .join('\n')
  const stepBlock = targets
    .map((t) => {
      const desc = t.taskDescription.length > 140 ? `${t.taskDescription.slice(0, 140)}…` : t.taskDescription
      return `Step ${t.stepKey} [${t.kind}] — process "${t.taskTitle}" (${desc})\n  step: ${t.label} (route: ${t.route})`
    })
    .join('\n\n')
  return `Arena: ${arenaId}\n\nCandidate stories (${candidates.length}):\n${storyBlock}\n\nSteps to map (${targets.length}):\n\n${stepBlock}\n${extra}`
}

// ---------------------------------------------------------------------------
// Target enumeration — must mirror lib/processRankings.ts's consumption exactly
// ---------------------------------------------------------------------------

function arenaStories(arenaId: string): Story[] | null {
  const file = path.join(categoryDir(arenaId), 'stories.json')
  if (!fs.existsSync(file)) return null
  return readJson(StorySchema.array(), file)
}

export function enumerateTargets(tasks: ProcessTask[]): MapTarget[] {
  const storiesCache = new Map<string, Story[] | null>()
  const storiesFor = (arenaId: string): Story[] | null => {
    if (!storiesCache.has(arenaId)) storiesCache.set(arenaId, arenaStories(arenaId))
    return storiesCache.get(arenaId) ?? null
  }

  const targets: MapTarget[] = []
  for (const task of tasks) {
    for (const node of task.dag.nodes) {
      const base = {
        taskId: task.id,
        nodeId: node.id,
        stepKey: `${task.id}:${node.id}`,
        label: node.label,
        route: node.route,
        taskTitle: task.title,
        taskDescription: task.description,
      }
      // The step's covering arena → 'function' mapping.
      const arenaId = coveringArenaId(node)
      const stories = arenaId ? storiesFor(arenaId) : null
      if (arenaId && stories) {
        targets.push({ ...base, kind: 'function', arenaId, candidates: stories })
      }
      // Additional covering arenas (extraOptionArenas / extraOptionRefs) → 'extra' mappings,
      // one per arena, offered the arena's FULL story list (same posture as 'function' — the
      // ref/arena allowlist and full/partial gate are applied by the consumer, not here).
      for (const extraArena of extraArenasFor(node)) {
        const extraStories = storiesFor(extraArena)
        if (!extraStories) continue
        targets.push({ ...base, kind: 'extra', arenaId: extraArena, candidates: extraStories })
      }
      // Every MANUAL step (any non-agent route — founder 2026-09-18: "any time 'manual' is
      // seen, see if we can do a computer use process for it") → 'computer-use' mapping per
      // fleet source. The mapper may honestly answer [] for steps no browser agent could
      // attempt (meetings, notarization, judgment calls).
      if (isComputerUseCandidate(node)) {
        for (const source of COMPUTER_USE_SOURCES) {
          const all = storiesFor(source.arenaId)
          if (!all) continue
          const candidates = source.storyIds === null
            ? all
            : all.filter((s) => source.storyIds!.includes(s.id))
          if (candidates.length === 0) continue
          targets.push({ ...base, kind: 'computer-use', arenaId: source.arenaId, candidates })
        }
      }
    }
  }
  return targets
}

// ---------------------------------------------------------------------------
// Cache + run
// ---------------------------------------------------------------------------

interface CacheEntry {
  hash: string
  storyIds: string[]
}

type ArenaCache = Record<string, CacheEntry> // key: `${stepKey}:${kind}`

function cacheFileFor(arenaId: string): string {
  return path.join(CACHE_DIR, 'step-stories', `${arenaId}.json`)
}

function readArenaCache(file: string): ArenaCache {
  if (!fs.existsSync(file)) return {}
  return JSON.parse(fs.readFileSync(file, 'utf8')) as ArenaCache
}

const cacheKeyOf = (t: MapTarget) => `${t.stepKey}:${t.kind}`

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function mapGroup(arenaId: string, kind: MappingKind, targets: MapTarget[]): Promise<number> {
  const cacheFile = cacheFileFor(arenaId)
  const cache = readArenaCache(cacheFile)
  const stale = targets.filter((t) => cache[cacheKeyOf(t)]?.hash !== targetHash(t, STEP_STORY_PROMPT_VERSION))
  if (stale.length === 0) return 0

  let calls = 0
  for (const batch of chunk(stale, MAX_STEPS_PER_CALL)) {
    const candidates = batch[0].candidates
    const candidateIds = new Set(candidates.map((s) => s.id))
    const expected = batch.map((t) => t.stepKey)

    let raw = await llmJson({ schema: RawStepMapSchema, system: SYSTEM, prompt: mapPrompt(arenaId, candidates, batch) })
    calls += 1
    let violation = validateStepMapEntries(raw, expected, candidateIds)
    for (let round = 0; violation && round < 3; round++) {
      raw = await llmJson({
        schema: RawStepMapSchema,
        system: SYSTEM,
        prompt: mapPrompt(arenaId, candidates, batch, `\nYour previous answer violated a rule: ${violation}. Correct it. One entry per step listed; only candidate story ids; at most ${MAX_STORIES_PER_STEP} per step.`),
      })
      calls += 1
      violation = validateStepMapEntries(raw, expected, candidateIds)
    }
    if (violation) throw new Error(`map-step-stories: ${arenaId}/${kind} still violates rules: ${violation}`)

    const byKey = new Map(batch.map((t) => [t.stepKey, t]))
    for (const entry of raw) {
      const t = byKey.get(entry.stepKey)!
      cache[cacheKeyOf(t)] = {
        hash: targetHash(t, STEP_STORY_PROMPT_VERSION),
        storyIds: [...entry.storyIds].sort(),
      }
    }
    writeJson(cacheFile, cache)
    const mapped = raw.filter((e) => e.storyIds.length > 0).length
    console.log(`map: ${arenaId}/${kind} — mapped ${raw.length} steps (${mapped} with stories, ${raw.length - mapped} empty)`)
  }
  return calls
}

export async function runMapper({ task }: { task?: string } = {}): Promise<void> {
  const tasks = loadProcesses(DATA_DIR).filter((t) => !task || t.id === task)
  const allTargets = enumerateTargets(loadProcesses(DATA_DIR))
  const runTargets = task ? allTargets.filter((t) => t.taskId === task) : allTargets

  // Group by (arena, kind): one candidate list per prompt.
  const groups = new Map<string, MapTarget[]>()
  for (const t of runTargets) {
    const key = `${t.arenaId}::${t.kind}`
    groups.set(key, [...(groups.get(key) ?? []), t])
  }
  console.log(`map: ${tasks.length} processes → ${runTargets.length} (step, arena) cells across ${groups.size} groups`)

  let totalCalls = 0
  for (const [key, targets] of groups) {
    const [arenaId, kind] = key.split('::') as [string, MappingKind]
    totalCalls += await mapGroup(arenaId, kind, targets)
  }
  console.log(`map: done — ${totalCalls} LLM calls this run`)

  // Assemble the committed mapping from ALL cached cells — never a partial file (judge.ts
  // posture): every enumerated target must be fresh in cache before we write.
  const entries: StepStoryEntry[] = []
  for (const t of allTargets) {
    const cache = readArenaCache(cacheFileFor(t.arenaId))
    const cached = cache[cacheKeyOf(t)]
    if (!cached || cached.hash !== targetHash(t, STEP_STORY_PROMPT_VERSION)) {
      console.warn(`map: mapping incomplete — missing/stale ${t.stepKey} (${t.arenaId}/${t.kind}); not writing process-step-stories.json`)
      return
    }
    entries.push({ taskId: t.taskId, nodeId: t.nodeId, kind: t.kind, arenaId: t.arenaId, storyIds: cached.storyIds })
  }
  entries.sort(
    (a, b) =>
      a.taskId.localeCompare(b.taskId) ||
      a.nodeId.localeCompare(b.nodeId) ||
      a.kind.localeCompare(b.kind) ||
      a.arenaId.localeCompare(b.arenaId),
  )
  writeJson(path.join(DATA_DIR, 'process-step-stories.json'), StepStoryMapSchema.parse(entries))
  const withStories = entries.filter((e) => e.storyIds.length > 0).length
  console.log(`map: wrote ${entries.length} mappings (${withStories} with stories) to open-rankings/process-step-stories.json`)
}

function printReport(): void {
  const file = path.join(DATA_DIR, 'process-step-stories.json')
  if (!fs.existsSync(file)) {
    console.log('report: no process-step-stories.json yet')
    return
  }
  const entries = readJson(StepStoryMapSchema, file)
  const byKind = new Map<string, { cells: number; withStories: number; stories: number }>()
  for (const e of entries) {
    const s = byKind.get(e.kind) ?? { cells: 0, withStories: 0, stories: 0 }
    s.cells += 1
    if (e.storyIds.length > 0) s.withStories += 1
    s.stories += e.storyIds.length
    byKind.set(e.kind, s)
  }
  for (const [kind, s] of byKind) {
    console.log(`report: ${kind} — ${s.cells} cells, ${s.withStories} mapped (${(s.stories / Math.max(s.withStories, 1)).toFixed(1)} stories/step avg)`)
  }
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i === -1 ? undefined : process.argv[i + 1]
}

// tsx entrypoint — skipped when imported by tests (same pattern as classify-story-tiers.ts).
if (require.main === module) {
  if (process.argv.includes('--report')) {
    printReport()
  } else {
    runMapper({ task: arg('--task') }).catch((err) => {
      console.error(err)
      process.exit(1)
    })
  }
}
