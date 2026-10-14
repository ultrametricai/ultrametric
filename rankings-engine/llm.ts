import Anthropic from '@anthropic-ai/sdk'
import type { z } from 'zod'

// Default judge/pipeline model. Migrated sonnet-5 → claude-opus-5-5 on 2026-09-30 per the
// adopted docs/OPUS-5-5-JUDGE-PILOT.md recommendation (founder-ordered re-judge): Opus 5.5
// follows the v3 rubric's decision procedures more faithfully (7/10 adjudicated flips), at 2.0x
// Sonnet interactive pricing ($4/$20 per MTok; $2/$10 via the Batch API the migration ran on).
// The model id is part of the judge cellHash (pipeline/stages/judge.ts) — changing UM_JUDGE_MODEL
// or this default invalidates every cached verdict rather than silently mixing judge models.
// PA_MODEL is the deprecated pre-rename spelling, honored as a fallback.
export const JUDGE_MODEL = process.env.UM_JUDGE_MODEL ?? process.env.PA_MODEL ?? 'claude-opus-5-5'
const MODEL = JUDGE_MODEL
// 5 attempts total. 3 proved too few in scheduled CI (story-runner, 2026-09: 2 of 3 runs died
// on "response contained no parseable JSON" with nobody around to retry the job).
const MAX_RETRIES = 4

// Jittered exponential backoff between retry attempts — a judge that answered with prose once
// tends to do it again immediately; a short randomized pause decorrelates the retry from
// whatever transient served the bad completion. Injectable so tests don't actually sleep.
let sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function setSleepForTests(fake: (ms: number) => Promise<void>): void {
  sleep = fake
}

export function retryBackoffMs(attempt: number): number {
  return Math.min(4000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250)
}

let client: Anthropic | undefined

export function getClient(): Anthropic {
  if (!client) client = new Anthropic()
  return client
}

export function setClientForTests(fake: Anthropic): void {
  client = fake
}

function walkBackParse(unfenced: string): unknown {
  const start = unfenced.search(/[[{]/)
  if (start === -1) return undefined
  // walk back from the end until a parse succeeds
  for (let end = unfenced.length; end > start; end--) {
    const candidate = unfenced.slice(start, end).trim()
    if (!candidate.endsWith('}') && !candidate.endsWith(']')) continue
    try {
      return JSON.parse(candidate)
    } catch {
      /* keep walking */
    }
  }
  return undefined
}

// Escapes raw control characters ONLY inside string literals (a raw newline/tab in a rationale
// is the model's most common JSON-breaking slip; between tokens they're legal whitespace and
// must be left alone). Minimal scanner: tracks in-string state and backslash escapes.
export function escapeControlCharsInStrings(text: string): string {
  let out = ''
  let inString = false
  let escaped = false
  for (const ch of text) {
    if (inString && !escaped && ch.charCodeAt(0) < 0x20) {
      out += ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : ch === '\t' ? '\\t' : ''
      continue
    }
    out += ch
    if (escaped) escaped = false
    else if (ch === '\\' && inString) escaped = true
    else if (ch === '"') inString = !inString
  }
  return out
}

export function extractJson(text: string): unknown {
  const unfenced = text.replace(/```(?:json)?/g, '')
  const plain = walkBackParse(unfenced)
  if (plain !== undefined) return plain
  return walkBackParse(escapeControlCharsInStrings(unfenced))
}

export async function llmJson<T>(opts: {
  schema: z.ZodType<T>
  system: string
  prompt: string
  maxTokens?: number
}): Promise<T> {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: opts.prompt }]
  let lastError = ''
  let noJsonStreak = 0
  // A response cut off by max_tokens can never parse — retrying at the same cap just burns
  // attempts (observed under prompt v3, whose rubric rationales run longer). Escalate the cap
  // on truncation and retry the ORIGINAL prompt (appending half a JSON object only confuses
  // the model).
  let maxTokens = opts.maxTokens ?? 4096
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await getClient().messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: opts.system,
      messages,
    })
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
    if (res.stop_reason === 'max_tokens' && maxTokens < 16384) {
      maxTokens = Math.min(maxTokens * 2, 16384)
      lastError = `response truncated at max_tokens; retrying with ${maxTokens}`
      continue
    }
    const json = extractJson(text)
    const parsed = json === undefined ? undefined : opts.schema.safeParse(json)
    if (parsed?.success) return parsed.data
    lastError = json === undefined ? 'response contained no parseable JSON' : JSON.stringify(parsed?.error.issues)
    noJsonStreak = json === undefined ? noJsonStreak + 1 : 0
    if (json === undefined) {
      // Keep a forensic sample: the recurring story-runner flake only ever reported "no
      // parseable JSON" with zero hint of WHAT the model said instead.
      console.warn(`llmJson: attempt ${attempt + 1} had no parseable JSON; first 200 chars: ${JSON.stringify(text.slice(0, 200))}`)
    }
    if (noJsonStreak >= 2) {
      // A malformed completion left in context tends to be reproduced almost verbatim on the
      // next turn (observed 5/5 on payroll/gusto:multi-state-payroll, 2026-09-22). After two
      // consecutive no-JSON replies, drop the poisoned turns and re-ask fresh instead of
      // stacking more corrections onto them.
      messages.length = 0
      messages.push({
        role: 'user',
        content: `${opts.prompt}\n\nReply with ONLY the JSON object — no prose, no markdown fences, no explanation before or after it.`,
      })
    } else {
      messages.push(
        { role: 'assistant', content: text },
        {
          role: 'user',
          content:
            json === undefined
              ? 'Your previous reply contained no parseable JSON. Reply with ONLY the JSON object — no prose, no markdown fences, no explanation before or after it.'
              : `Your response failed validation: ${lastError}\nReply with ONLY the corrected JSON. No prose, no code fences.`,
        },
      )
    }
    if (attempt < MAX_RETRIES) await sleep(retryBackoffMs(attempt))
  }
  throw new Error(`LLM output failed validation after ${MAX_RETRIES + 1} attempts: ${lastError}`)
}
