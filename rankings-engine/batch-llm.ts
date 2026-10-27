import Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs'
import path from 'node:path'
import { getClient } from './llm'

// Message Batches transport for LLM stages. The Batches API runs the same model at half
// the interactive per-token price; this module owns only the transport (submit, resume,
// poll, collect) and hands each completed Message back to the caller, which parses,
// validates, and caches it through the exact same path as an interactive response.

// Minimal slice of client.messages.batches that the transport uses; injectable so tests
// never construct a real client or touch the network.
export interface BatchesClient {
  create(params: Anthropic.Messages.BatchCreateParams): Promise<Anthropic.Messages.MessageBatch>
  retrieve(id: string): Promise<Anthropic.Messages.MessageBatch>
  results(id: string): Promise<AsyncIterable<Anthropic.Messages.MessageBatchIndividualResponse>>
}

let batchesClient: BatchesClient | undefined

export function getBatchesClient(): BatchesClient {
  if (!batchesClient) batchesClient = getClient().messages.batches
  return batchesClient
}

export function setBatchesClientForTests(fake: BatchesClient): void {
  batchesClient = fake
}

// Batches usually complete well under an hour; a 30s cadence keeps resumed runs snappy
// without hammering the retrieve endpoint. Injectable so tests don't actually wait.
const POLL_MS = 30_000
let sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function setBatchSleepForTests(fake: (ms: number) => Promise<void>): void {
  sleep = fake
}

// API ceiling is 100k requests / 256 MB per batch; judge evidence packs run tens of KB
// per request, so 1,000 per chunk stays far from the size limit.
export const MAX_REQUESTS_PER_BATCH = 1000

export type BatchCellResult =
  | { type: 'succeeded'; message: Anthropic.Message }
  | { type: 'errored' | 'canceled' | 'expired' | 'unavailable'; reason?: string }

export interface BatchRequest {
  custom_id: string
  params: Anthropic.Messages.MessageCreateParamsNonStreaming
}

// The state file makes an interrupted poll resumable: every submitted batch id is
// recorded before polling starts, so a killed run re-attaches to the in-flight batches
// instead of resubmitting (and re-paying for) the same cells. The caller clears it with
// clearBatchState once every cell is written through to the cache.
interface BatchRunState {
  version: 1
  batches: { id: string; submittedAt: string }[]
}

function readState(stateFile: string): BatchRunState {
  if (!fs.existsSync(stateFile)) return { version: 1, batches: [] }
  const parsed = JSON.parse(fs.readFileSync(stateFile, 'utf8')) as BatchRunState
  if (parsed.version !== 1 || !Array.isArray(parsed.batches)) return { version: 1, batches: [] }
  return parsed
}

function writeState(stateFile: string, state: BatchRunState): void {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true })
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n')
}

export function clearBatchState(stateFile: string): void {
  fs.rmSync(stateFile, { force: true })
}

function toCellResult(result: Anthropic.Messages.MessageBatchResult): BatchCellResult {
  switch (result.type) {
    case 'succeeded':
      return { type: 'succeeded', message: result.message }
    case 'errored':
      return { type: 'errored', reason: JSON.stringify(result.error) }
    default:
      return { type: result.type }
  }
}

// Polls one batch to completion and folds its results into `results`, keyed by
// custom_id. Returns false when the batch no longer exists server-side (results expire
// 29 days after creation) so the caller can drop the stale id and resubmit those cells.
async function collectBatch(
  client: BatchesClient,
  batchId: string,
  wanted: Set<string>,
  results: Map<string, BatchCellResult>,
): Promise<boolean> {
  let batch: Anthropic.Messages.MessageBatch
  try {
    batch = await client.retrieve(batchId)
  } catch (err) {
    if (err instanceof Anthropic.NotFoundError) return false
    throw err
  }
  while (batch.processing_status !== 'ended') {
    console.log(`batch-llm: ${batchId} ${batch.processing_status} (${batch.request_counts.processing} processing, ${batch.request_counts.succeeded} succeeded, ${batch.request_counts.errored} errored)`)
    await sleep(POLL_MS)
    batch = await client.retrieve(batchId)
  }
  for await (const line of await client.results(batchId)) {
    // A resumed run can hold batch ids whose cells were since re-keyed (evidence changed,
    // so the custom_id no longer matches any current miss) — those lines are ignored and
    // the cells resubmit under their new hash.
    if (!wanted.has(line.custom_id) || results.has(line.custom_id)) continue
    results.set(line.custom_id, toCellResult(line.result))
  }
  return true
}

// Submits `requests` as one or more message batches and returns a result per custom_id.
// Resumable: previously submitted batch ids are read from `stateFile` and re-attached
// before anything new is submitted. Fail-closed: every requested custom_id gets an entry
// in the returned map — cells a batch could not complete come back as a non-succeeded
// result for the caller to retry on the interactive path, never silently dropped.
export async function runMessageBatches(opts: { requests: BatchRequest[]; stateFile: string }): Promise<Map<string, BatchCellResult>> {
  const client = getBatchesClient()
  const wanted = new Set(opts.requests.map((r) => r.custom_id))
  const results = new Map<string, BatchCellResult>()
  const state = readState(opts.stateFile)

  // Phase 1: re-attach to batches a previous interrupted run already paid for.
  const live: BatchRunState['batches'] = []
  for (const entry of state.batches) {
    if (await collectBatch(client, entry.id, wanted, results)) live.push(entry)
    else console.warn(`batch-llm: stored batch ${entry.id} no longer retrievable; its cells will resubmit`)
  }
  if (live.length !== state.batches.length) {
    state.batches = live
    writeState(opts.stateFile, state)
  }

  // Phase 2: submit whatever the stored batches did not cover, recording each new batch
  // id before polling so a crash between submit and collect stays resumable.
  const remaining = opts.requests.filter((r) => !results.has(r.custom_id))
  const submitted: string[] = []
  for (let i = 0; i < remaining.length; i += MAX_REQUESTS_PER_BATCH) {
    const chunk = remaining.slice(i, i + MAX_REQUESTS_PER_BATCH)
    const batch = await client.create({ requests: chunk })
    console.log(`batch-llm: submitted ${batch.id} (${chunk.length} requests)`)
    state.batches.push({ id: batch.id, submittedAt: new Date().toISOString() })
    writeState(opts.stateFile, state)
    submitted.push(batch.id)
  }
  for (const id of submitted) await collectBatch(client, id, wanted, results)

  // Fail-closed sweep: anything no batch returned becomes an explicit failure entry.
  for (const id of wanted) {
    if (!results.has(id)) results.set(id, { type: 'unavailable', reason: 'not returned by any batch' })
  }
  return results
}
