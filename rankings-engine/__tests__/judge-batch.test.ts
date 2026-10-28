import Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Evidence, Story } from '@/lib/schemas'
import {
  type BatchesClient, clearBatchState, MAX_REQUESTS_PER_BATCH, runMessageBatches,
  setBatchesClientForTests, setBatchSleepForTests,
} from '@/rankings-engine/batch-llm'
import { DEFAULT_MAX_TOKENS, JUDGE_MODEL, setClientForTests, setSleepForTests } from '@/rankings-engine/llm'
import {
  batchCustomId, batchPrefillVerdicts, CELL_HASH_VERSION, cellBatchParams, cellHash,
  type JudgeCell, judgeCells, judgePrompt, parseBatchVerdict, PROMPT_VERSION, SYSTEM,
} from '@/rankings-engine/stages/judge'

// Neither transport sleeps for real in tests.
setSleepForTests(async () => {})
setBatchSleepForTests(async () => {})

const story: Story = { id: 's1', persona: 'developer', title: 't', theme: 'core', group: 'core', weight: 2 }
const ev = (id: string, excerpt: string): Evidence => ({
  id, tier: 'claimed-docs', url: 'https://x.example/e', excerpt, fetchedAt: '2026-08-26T00:00:00Z',
})

let tmp: string
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'judge-batch-'))
})
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
  vi.restoreAllMocks()
})

const cell = (productId: string, excerpt = `evidence for ${productId}`): JudgeCell => {
  const evidence = [ev('e1', excerpt)]
  return {
    catId: 'cat', productId, productName: productId.toUpperCase(), story, evidence,
    hash: cellHash(story, evidence, PROMPT_VERSION),
    cacheFile: path.join(tmp, 'cache', productId, `${story.id}.json`),
  }
}

const stateFile = () => path.join(tmp, 'state', 'run.json')

const verdictJson = (rationale: string) =>
  `{"verdict":"full","quality":10,"confidence":"high","rationale":${JSON.stringify(rationale)},"evidenceIds":["e1"]}`

const batchMessage = (text: string, stopReason = 'end_turn') =>
  ({ content: [{ type: 'text', text }], stop_reason: stopReason }) as unknown as Anthropic.Message

const succeeded = (customId: string, text: string) => ({
  custom_id: customId,
  result: { type: 'succeeded' as const, message: batchMessage(text) },
})

const endedBatch = (id: string) => ({
  id,
  processing_status: 'ended',
  request_counts: { processing: 0, succeeded: 1, errored: 0, canceled: 0, expired: 0 },
}) as unknown as Anthropic.Messages.MessageBatch

async function* lines(...items: { custom_id: string; result: unknown }[]) {
  for (const item of items) yield item as Anthropic.Messages.MessageBatchIndividualResponse
}

function fakeBatches(overrides: Partial<BatchesClient>): BatchesClient {
  return {
    create: vi.fn().mockRejectedValue(new Error('create not scripted')),
    retrieve: vi.fn().mockRejectedValue(new Error('retrieve not scripted')),
    results: vi.fn().mockRejectedValue(new Error('results not scripted')),
    ...overrides,
  }
}

// Interactive transport that fails loudly if the test expects batch-only traffic.
const noInteractive = () => {
  const create = vi.fn().mockRejectedValue(new Error('interactive path must not be used'))
  setClientForTests({ messages: { create } } as never)
  return create
}

// The full --batch flow for a set of cells: prefill over the batch transport, then the
// shared judge/cache-write path (what runJudge does in batch mode).
const batchJudge = async (cells: JudgeCell[]) => {
  const prefilled = await batchPrefillVerdicts(cells, stateFile())
  await judgeCells(cells, prefilled)
}

const readCache = (c: JudgeCell) => JSON.parse(fs.readFileSync(c.cacheFile, 'utf8')) as {
  hash: string; keyVersion: string; verdict: { rationale: string }
}

describe('judgeCells with batch prefill', () => {
  it('submits each cell with custom_id = batchCustomId and the interactive request params, polls, and maps results back by custom_id', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const c1 = cell('p1')
    const c2 = cell('p2')
    const create = vi.fn().mockResolvedValue({ ...endedBatch('b1'), processing_status: 'in_progress' })
    const retrieve = vi
      .fn()
      .mockResolvedValueOnce({ ...endedBatch('b1'), processing_status: 'in_progress' })
      .mockResolvedValue(endedBatch('b1'))
    // Results arrive out of request order — mapping must key on custom_id, never position.
    const results = vi.fn().mockResolvedValue(lines(
      succeeded(batchCustomId(c2), verdictJson('verdict for p2')),
      succeeded(batchCustomId(c1), verdictJson('verdict for p1')),
    ))
    setBatchesClientForTests(fakeBatches({ create, retrieve, results }))
    const interactive = noInteractive()

    await batchJudge([c1, c2])

    expect(create).toHaveBeenCalledTimes(1)
    const requests = create.mock.calls[0][0].requests
    expect(requests.map((r: { custom_id: string }) => r.custom_id)).toEqual([batchCustomId(c1), batchCustomId(c2)])
    // Identical model + prompt + params to the interactive first attempt — only transport differs.
    expect(requests[0].params).toEqual({
      model: JUDGE_MODEL,
      max_tokens: DEFAULT_MAX_TOKENS,
      system: SYSTEM,
      messages: [{ role: 'user', content: judgePrompt(c1.productName, c1.story, c1.evidence) }],
    })
    expect(interactive).not.toHaveBeenCalled()
    expect(readCache(c1).verdict.rationale).toBe('verdict for p1')
    expect(readCache(c2).verdict.rationale).toBe('verdict for p2')
    // The run's lock and temp file are gone; the state file stays until runJudge has
    // written every cell in scope, then clearBatchState removes it.
    expect(fs.existsSync(`${stateFile()}.lock`)).toBe(false)
    expect(fs.existsSync(`${stateFile()}.tmp`)).toBe(false)
    expect(fs.existsSync(stateFile())).toBe(true)
    clearBatchState(stateFile())
    expect(fs.existsSync(stateFile())).toBe(false)
  })

  it('gives two products with identical evidence distinct custom_ids, so a resumed result can never land on the wrong product', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    // Identical evidence pack + same story: identical cellHash, distinct cell identity.
    const a = cell('p1', 'shared excerpt')
    const b = cell('p2', 'shared excerpt')
    expect(a.hash).toBe(b.hash)
    expect(batchCustomId(a)).not.toBe(batchCustomId(b))
    const create = vi.fn().mockResolvedValue(endedBatch('b1'))
    setBatchesClientForTests(fakeBatches({
      create,
      retrieve: vi.fn().mockResolvedValue(endedBatch('b1')),
      results: vi.fn().mockResolvedValue(lines(
        succeeded(batchCustomId(b), verdictJson('for p2')),
        succeeded(batchCustomId(a), verdictJson('for p1')),
      )),
    }))
    noInteractive()

    await batchJudge([a, b])

    expect(create.mock.calls[0][0].requests).toHaveLength(2)
    expect(readCache(a).verdict.rationale).toBe('for p1')
    expect(readCache(b).verdict.rationale).toBe('for p2')
  })

  it('falls back to interactive for errored and unparseable cells instead of skipping them', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ok = cell('p-ok')
    const errored = cell('p-err')
    const prose = cell('p-prose')
    setBatchesClientForTests(fakeBatches({
      create: vi.fn().mockResolvedValue(endedBatch('b1')),
      retrieve: vi.fn().mockResolvedValue(endedBatch('b1')),
      results: vi.fn().mockResolvedValue(lines(
        succeeded(batchCustomId(ok), verdictJson('batch ok')),
        { custom_id: batchCustomId(errored), result: { type: 'errored', error: { type: 'api_error' } } },
        succeeded(batchCustomId(prose), 'no json in this reply at all'),
      )),
    }))
    const interactive = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: verdictJson('interactive rescue') }] })
    setClientForTests({ messages: { create: interactive } } as never)

    await batchJudge([ok, errored, prose])

    expect(interactive).toHaveBeenCalledTimes(2) // one rescue each for errored + prose
    expect(readCache(ok).verdict.rationale).toBe('batch ok')
    expect(readCache(errored).verdict.rationale).toBe('interactive rescue')
    expect(readCache(prose).verdict.rationale).toBe('interactive rescue')
    expect(warn.mock.calls.some((c) => String(c[0]).includes('falling back to interactive'))).toBe(true)
  })

  it('resumes an interrupted run from the state file instead of resubmitting', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const c1 = cell('p1')
    fs.mkdirSync(path.dirname(stateFile()), { recursive: true })
    fs.writeFileSync(stateFile(), JSON.stringify({ version: 1, batches: [{ id: 'b0', submittedAt: '2026-10-27T00:00:00Z' }] }))
    const create = vi.fn()
    setBatchesClientForTests(fakeBatches({
      create,
      retrieve: vi.fn().mockResolvedValue(endedBatch('b0')),
      results: vi.fn().mockResolvedValue(lines(succeeded(batchCustomId(c1), verdictJson('resumed')))),
    }))
    noInteractive()

    await batchJudge([c1])

    expect(create).not.toHaveBeenCalled()
    expect(readCache(c1).verdict.rationale).toBe('resumed')
  })

  it('drops a stored batch id whose metadata or results are gone and resubmits those cells', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const c1 = cell('p1')
    const notFound = () => new Anthropic.NotFoundError(404, { type: 'not_found_error' } as never, 'not found', new Headers())
    fs.mkdirSync(path.dirname(stateFile()), { recursive: true })
    // Two stale ids: one 404s on retrieve, the other 404s on result retrieval (results
    // expire 29 days after creation even when the metadata still resolves).
    fs.writeFileSync(stateFile(), JSON.stringify({
      version: 1,
      batches: [
        { id: 'gone-meta', submittedAt: '2026-09-01T00:00:00Z' },
        { id: 'gone-results', submittedAt: '2026-09-01T00:00:00Z' },
      ],
    }))
    const retrieve = vi.fn().mockImplementation((id: string) => {
      if (id === 'gone-meta') throw notFound()
      return Promise.resolve(endedBatch(id))
    })
    const results = vi.fn().mockImplementation((id: string) => {
      if (id === 'gone-results') throw notFound()
      return Promise.resolve(lines(succeeded(batchCustomId(c1), verdictJson('resubmitted'))))
    })
    const create = vi.fn().mockResolvedValue(endedBatch('b1'))
    setBatchesClientForTests(fakeBatches({ create, retrieve, results }))
    noInteractive()

    await batchJudge([c1])

    expect(create).toHaveBeenCalledTimes(1)
    expect(readCache(c1).verdict.rationale).toBe('resubmitted')
    // The state file keeps only the live replacement batch.
    const state = JSON.parse(fs.readFileSync(stateFile(), 'utf8')) as { batches: { id: string }[] }
    expect(state.batches.map((b) => b.id)).toEqual(['b1'])
  })

  it('writes a batch-judged cell byte-identical to an interactive one given the same response', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const response = verdictJson('same response either way')
    const viaBatch = cell('p1')
    setBatchesClientForTests(fakeBatches({
      create: vi.fn().mockResolvedValue(endedBatch('b1')),
      retrieve: vi.fn().mockResolvedValue(endedBatch('b1')),
      results: vi.fn().mockResolvedValue(lines(succeeded(batchCustomId(viaBatch), response))),
    }))
    noInteractive()
    await batchJudge([viaBatch])

    const viaInteractive = { ...cell('p1'), cacheFile: path.join(tmp, 'cache-interactive', 'p1', `${story.id}.json`) }
    setClientForTests({ messages: { create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: response }] }) } } as never)
    await judgeCells([viaInteractive])

    expect(fs.readFileSync(viaBatch.cacheFile)).toEqual(fs.readFileSync(viaInteractive.cacheFile))
    expect(readCache(viaBatch).keyVersion).toBe(CELL_HASH_VERSION)
    expect(readCache(viaBatch).hash).toBe(viaBatch.hash)
  })

  it('runs the interactive correction rounds when a batch verdict violates a rule', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const c1 = cell('p1')
    // quality 8 without the required "missing for 10:" clause violates validateVerdictRules.
    const violating = '{"verdict":"full","quality":8,"confidence":"high","rationale":"fully supports","evidenceIds":["e1"]}'
    setBatchesClientForTests(fakeBatches({
      create: vi.fn().mockResolvedValue(endedBatch('b1')),
      retrieve: vi.fn().mockResolvedValue(endedBatch('b1')),
      results: vi.fn().mockResolvedValue(lines(succeeded(batchCustomId(c1), violating))),
    }))
    const interactive = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: verdictJson('corrected') }] })
    setClientForTests({ messages: { create: interactive } } as never)

    await batchJudge([c1])

    expect(interactive).toHaveBeenCalledTimes(1)
    expect(interactive.mock.calls[0][0].messages[0].content).toMatch(/Your previous verdict violated a rule/)
    expect(readCache(c1).verdict.rationale).toBe('corrected')
  })
})

describe('parseBatchVerdict', () => {
  it('rejects responses truncated at max_tokens', () => {
    expect(parseBatchVerdict(batchMessage(verdictJson('r'), 'max_tokens'))).toBeUndefined()
  })
  it('rejects schema-invalid JSON and accepts a valid verdict', () => {
    expect(parseBatchVerdict(batchMessage('{"verdict":"full","quality":"high"}'))).toBeUndefined()
    expect(parseBatchVerdict(batchMessage(verdictJson('ok')))?.rationale).toBe('ok')
  })
})

describe('runMessageBatches', () => {
  const params = () => cellBatchParams({
    catId: 'cat', productId: 'p', productName: 'P', story, evidence: [ev('e1', 'x')],
    hash: 'h', cacheFile: path.join(os.tmpdir(), 'unused.json'),
  })

  it('splits a submission crossing MAX_REQUESTS_PER_BATCH into multiple batches and collects results from all of them', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const requests = Array.from({ length: MAX_REQUESTS_PER_BATCH + 1 }, (_, i) => ({ custom_id: `r${i}`, params: params() }))
    const create = vi
      .fn()
      .mockResolvedValueOnce(endedBatch('b1'))
      .mockResolvedValueOnce(endedBatch('b2'))
    const results = vi.fn().mockImplementation((id: string) => {
      // b1 answers the first chunk, b2 the single-request remainder.
      const chunk = id === 'b1' ? requests.slice(0, MAX_REQUESTS_PER_BATCH) : requests.slice(MAX_REQUESTS_PER_BATCH)
      return Promise.resolve(lines(...chunk.map((r) => succeeded(r.custom_id, verdictJson(`from ${id}`)))))
    })
    setBatchesClientForTests(fakeBatches({
      create,
      retrieve: vi.fn().mockImplementation((id: string) => Promise.resolve(endedBatch(id))),
      results,
    }))

    const out = await runMessageBatches({ requests, stateFile: stateFile() })

    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[0][0].requests).toHaveLength(MAX_REQUESTS_PER_BATCH)
    expect(create.mock.calls[1][0].requests).toHaveLength(1)
    expect(out.size).toBe(MAX_REQUESTS_PER_BATCH + 1)
    expect([...out.values()].every((r) => r.type === 'succeeded')).toBe(true)
    // Both ids were recorded for resume while the run was in flight.
    const state = JSON.parse(fs.readFileSync(stateFile(), 'utf8')) as { batches: { id: string }[] }
    expect(state.batches.map((b) => b.id)).toEqual(['b1', 'b2'])
  })

  it('fails closed with an explicit entry for cells no batch returned', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    setBatchesClientForTests(fakeBatches({
      create: vi.fn().mockResolvedValue(endedBatch('b1')),
      retrieve: vi.fn().mockResolvedValue(endedBatch('b1')),
      // The batch never returns r2 (e.g. a server-side drop) — the caller must still see it.
      results: vi.fn().mockResolvedValue(lines(succeeded('r1', verdictJson('ok')))),
    }))
    const out = await runMessageBatches({
      requests: [{ custom_id: 'r1', params: params() }, { custom_id: 'r2', params: params() }],
      stateFile: stateFile(),
    })
    expect(out.get('r1')?.type).toBe('succeeded')
    expect(out.get('r2')).toEqual({ type: 'unavailable', reason: 'not returned by any batch' })
  })

  it('rejects a second run while a live process holds the scope lock, and takes over a stale lock', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    fs.mkdirSync(path.dirname(stateFile()), { recursive: true })
    // Live holder: this test process itself.
    fs.writeFileSync(`${stateFile()}.lock`, String(process.pid))
    setBatchesClientForTests(fakeBatches({}))
    await expect(runMessageBatches({ requests: [], stateFile: stateFile() })).rejects.toThrow(/already owns/)

    // Stale holder: a pid far above any live process — the crashed-run resume path.
    fs.writeFileSync(`${stateFile()}.lock`, '99999999')
    const out = await runMessageBatches({ requests: [], stateFile: stateFile() })
    expect(out.size).toBe(0)
    expect(fs.existsSync(`${stateFile()}.lock`)).toBe(false)
  })
})
