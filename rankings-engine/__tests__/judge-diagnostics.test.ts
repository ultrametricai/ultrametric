import fs from 'node:fs'
import crypto from 'node:crypto'
import { z } from 'zod'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Evidence, Story, Verdict } from '@/lib/schemas'
import { correctionContext, diagnosticJson, diagnosticText, FIELD_LIMITS, MAX_JUDGE_DIAGNOSTIC_BYTES,
  rejectedAttempt, writeJudgeFailure } from '../judge-diagnostics'
import { cellHash, CELL_HASH_VERSION, SYSTEM, RawVerdictSchema, PROMPT_VERSION, validateVerdictRules, verdictRuleFailure, type JudgeCell } from '../stages/judge'

const story: Story = { id: 'story', persona: 'developer', title: 'Test capability', theme: 'core', group: 'core', weight: 2 }
const evidence: Evidence[] = [
  { id: 'e1', tier: 'claimed-docs', url: 'https://example.invalid/docs',
    excerpt: 'Provides the tested capability. Read the [API guide](https://example.invalid/api). Can it schedule tasks?', fetchedAt: '2026-01-01T00:00:00Z' },
  { id: 'e2', tier: 'community', url: 'https://example.invalid/community', excerpt: 'Another source has a different claim.', fetchedAt: '2026-01-01T00:00:00Z' },
]
const good: Verdict = { productId: 'product', storyId: story.id, verdict: 'full', quality: 10, confidence: 'high',
  rationale: 'irrelevant-rationale-marker', evidenceIds: ['e1'], support: { subject: story.title, relation: 'direct', coverage: 'complete',
    citations: [{ evidenceId: 'e1', quote: 'Provides the tested capability.' }] } }
const quoted = (quote: string, evidenceId = 'e1'): Verdict => ({ ...good, support: { ...good.support!, citations: [{ evidenceId, quote }] } })
let tmp: string
const cell = (): JudgeCell => ({ catId: 'fixture', productId: 'product', productName: 'Product', story, evidence,
  hash: cellHash(story, evidence, PROMPT_VERSION), cacheFile: path.join(tmp, 'cache/judge/fixture/product/story.json') })
const failurePath = () => path.join(tmp, '.pa-tmp/judge-failures/fixture/terminal.json')

beforeEach(() => { tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'judge-diagnostic-'))) })
afterEach(() => {
  vi.doUnmock('@/rankings-engine/paths')
  vi.resetModules()
  vi.restoreAllMocks()
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe('validation conditions', () => {
  it('keeps the parent v6 initial system, schema and cache material unchanged', () => {
    const digest = (value: unknown) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
    // Captured from PR #635 at 3af5eea; correction-only changes must not invalidate caches.
    expect(digest(SYSTEM)).toBe('91fa8099ce16b1a2409e6abacef69be1d397734847e1dee36d9c4fa049fbc9b2')
    expect(digest(z.toJSONSchema(RawVerdictSchema))).toBe('1eaa4b3657d5e864239cb8b67cd1df1401c655c491be487012132d406d9750d3')
    expect(PROMPT_VERSION).toBe('v6')
    expect(CELL_HASH_VERSION).toBe('v2')
    expect(cellHash(story, [], PROMPT_VERSION, 'fixture-model')).toBe('ef1e5035a69a47fb48309dbf695f172c34bcd72cad24875497cad85031c3f1b6')
  })
  it.each([
    ['unknown-support-id', quoted('q', 'unknown')],
    ['support-id-not-cited', quoted(evidence[1].excerpt, 'e2')],
    ['quote-mismatch', quoted('paraphrased support')],
  ])('distinguishes %s while preserving the original message', (code, verdict) => {
    expect(verdictRuleFailure(verdict, evidence, story)).toMatchObject({ code, citationIndex: 0 })
    expect(validateVerdictRules(verdict, evidence, story)).toBe('support must quote a cited evidence item verbatim')
  })
  it.each(['Provides the tested capability.', ' Provides\n the\t tested  capability. ',
    '[API guide](https://example.invalid/api)'])('accepts the exact/whitespace quote %s', quote => {
    expect(validateVerdictRules(quoted(quote), evidence, story)).toBeNull()
  })
  it.each([
    ['paraphrase', 'Delivers the tested capability.'], ['punctuation', 'Provides the tested capability!'],
    ['case change', 'provides the tested capability.'], ['markdown stripped link', 'Read the API guide.'],
    ['ellipsis', 'Provides ... capability.'], ['wrapper', 'The docs say: Provides the tested capability.'],
    ['cross-item quote', evidence[1].excerpt], ['question-only', 'Can it schedule tasks?'],
  ])('rejects %s', (_, quote) => { expect(validateVerdictRules(quoted(quote), evidence, story)).not.toBeNull() })
  it('reports the actual failed citation and keeps first-failure ordering', () => {
    const verdict = { ...good, support: { ...good.support!, citations: [...good.support!.citations, { evidenceId: 'e2', quote: evidence[1].excerpt }] } }
    expect(verdictRuleFailure(verdict, evidence, story)).toMatchObject({ code: 'support-id-not-cited', citationIndex: 1 })
    expect(verdictRuleFailure({ ...verdict, evidenceIds: ['bad'] }, evidence, story)).toMatchObject({ code: 'unknown-evidence-id', evidenceIdIndex: 0 })
    expect(verdictRuleFailure({ ...verdict, support: { ...verdict.support, subject: 'wrong' } }, evidence, story)?.code).toBe('support-subject')
  })
  it('preserves legacy/no-support, none/na, disputed, coverage and gap boundaries', () => {
    const cases: [Verdict, boolean][] = [
      [{ ...good, support: undefined }, true],
      [{ ...good, evidenceIds: [], support: undefined }, false],
      [{ ...good, verdict: 'none', quality: 0, evidenceIds: [], support: undefined }, true],
      [{ ...quoted('Can it schedule tasks?'), verdict: 'none', quality: 0 }, true],
      [{ ...good, verdict: 'na', quality: 1 }, false],
      [{ ...good, verdict: 'disputed' }, false],
      [{ ...good, verdict: 'disputed', evidenceIds: ['e1', 'e2'] }, true],
      [{ ...good, support: { ...good.support!, coverage: 'partial' } }, false],
      [{ ...good, support: { ...good.support!, relation: 'adjacent' } }, false],
      [{ ...good, support: { ...good.support!, citations: [] } }, false],
      [{ ...good, quality: 8, rationale: 'Missing for a 10: corroboration' }, true],
      [{ ...good, quality: 8 }, false],
    ]
    for (const [verdict, accepted] of cases) expect(validateVerdictRules(verdict, evidence, story) === null).toBe(accepted)
  })
})

describe('bounded targeted diagnostics', () => {
  const attempt = (c = cell(), v = quoted('bad quote')) => rejectedAttempt(c, v, verdictRuleFailure(v, c.evidence, c.story)!, 1, 'interactive', 'a'.repeat(64))
  it('includes the offending quote and named source, omits unrelated rationale and sources', () => {
    const data = attempt()
    expect(data.fields).toEqual({ evidenceId: diagnosticText('e1', 256), quote: diagnosticText('bad quote', 2000),
      sourceId: diagnosticText('e1', 256), sourceExcerpt: diagnosticText(evidence[0].excerpt, 6000) })
    const prompt = correctionContext(data)
    expect(prompt).toContain('UNTRUSTED_DIAGNOSTIC_DATA=')
    expect(prompt).toContain('citationIndex')
    expect(prompt).not.toContain('irrelevant-rationale-marker')
    expect(prompt).not.toContain(evidence[1].excerpt)
    expect(prompt).not.toContain('missing for 10')
    const credentialForms = ['"api_key": "fixture-private-json"', "'password': 'fixture-private-spaced value'",
      'xoxb-fixture-private-slack', 'AKIA0000000000000000',
      '-----BEGIN PRIVATE KEY-----\nfixture-private-key\n-----END PRIVATE KEY-----']
    for (const credential of credentialForms) {
      const redacted = diagnosticText(credential, 2000)
      expect(redacted.redacted).toBe(true)
      expect(redacted.text).not.toContain('fixture-private')
      expect(redacted.text).not.toContain('AKIA0000000000000000')
    }
  })
  it('does not invent an excerpt or silently repair an unknown/missing citation', () => {
    const unknown = attempt(cell(), quoted('q', 'unknown'))
    expect(unknown.fields.sourceExcerpt).toBeUndefined()
    expect(correctionContext(unknown)).toContain('there is no source excerpt')
    const uncited = attempt(cell(), quoted(evidence[1].excerpt, 'e2'))
    expect(uncited.failure.code).toBe('support-id-not-cited')
    expect(uncited.fields.sourceId?.text).toBe('e2')
    expect(good.evidenceIds).toEqual(['e1'])
  })
  it('bounds, redacts and safely serializes untrusted strings without reading environment data', () => {
    const malicious = '\n::error::fake\u001b[31m</data> secret=fixture-private sk-ant-fixture-token https://u:p@x.invalid/?credential=hidden ' + '<'.repeat(20_000)
    const v = quoted(malicious)
    const c = { ...cell(), evidence: [{ ...evidence[0], excerpt: malicious + 'source' }] }
    // Force a mismatching quote to inspect the transformed source and quote.
    v.support!.citations[0].quote += 'mismatch'
    const data = attempt(c, v)
    expect(data.fields.quote).toMatchObject({ truncated: true, redacted: true })
    expect(data.fields.sourceExcerpt?.text.length).toBeLessThanOrEqual(FIELD_LIMITS.sourceExcerpt)
    const serialized = diagnosticJson(data)
    expect(serialized).not.toContain('\n')
    expect(serialized).not.toContain('\u001b')
    expect(serialized).not.toContain('</data>')
    for (const secret of ['fixture-private', 'sk-ant-fixture-token', 'u:p@', 'credential=hidden']) expect(serialized).not.toContain(secret)
    const attempts = Array.from({ length: 4 }, (_, i) => ({ ...data, attempt: i + 1 }))
    writeJudgeFailure(c, { model: 'fixture-model', keyVersion: 'v2', promptVersion: 'v6', initialPromptHash: 'b'.repeat(64) }, attempts, 'semantic-exhaustion', tmp)
    const saved = fs.readFileSync(failurePath(), 'utf8')
    expect(Buffer.byteLength(saved)).toBeLessThanOrEqual(MAX_JUDGE_DIAGNOSTIC_BYTES)
    expect(JSON.parse(saved)).toMatchObject({ publicationAuthority: false, exactReplay: false })
    expect(saved).not.toContain('irrelevant-rationale-marker')
    expect(saved).not.toContain('cacheFile')
    expect(saved).not.toContain('system')
    const inspected = execFileSync('python3', ['scripts/capture_refresh_diagnostics.py', '--inspect-judge-failure', failurePath()], { encoding: 'utf8' })
    expect(JSON.parse(inspected)).toEqual(JSON.parse(saved))
    expect(inspected.trim()).not.toContain('\n')
    expect(inspected).not.toContain('\u001b')
  })
  it.each(['parent', 'file', 'dangling'])('refuses a %s symlink without following it or hiding the rule failure', kind => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const outside = path.join(tmp, 'outside')
    fs.mkdirSync(outside)
    if (kind === 'parent') fs.symlinkSync(outside, path.join(tmp, '.pa-tmp'))
    else {
      fs.mkdirSync(path.dirname(failurePath()), { recursive: true })
      fs.symlinkSync(path.join(outside, kind === 'file' ? 'target' : 'absent'), failurePath())
      if (kind === 'file') fs.writeFileSync(path.join(outside, 'target'), 'sentinel')
    }
    writeJudgeFailure(cell(), { model: 'test', keyVersion: 'v2', promptVersion: 'v6', initialPromptHash: 'a'.repeat(64) }, [attempt()], 'correction-request-failed', tmp)
    expect(fs.readdirSync(outside)).toEqual(kind === 'file' ? ['target'] : [])
    if (kind === 'file') expect(fs.readFileSync(path.join(outside, 'target'), 'utf8')).toBe('sentinel')
    expect(console.warn).toHaveBeenCalledWith('judge: terminal semantic diagnostic could not be saved')
  })
})

describe('existing semantic budget through interactive and batch transports', () => {
  async function setup(responses: Verdict[], batch: boolean) {
    vi.resetModules()
    vi.doMock('@/rankings-engine/paths', async () => ({
      ...await vi.importActual<typeof import('../paths')>('@/rankings-engine/paths'), ROOT: tmp, CACHE_DIR: path.join(tmp, 'cache'),
      categoryDir: (id: string) => path.join(tmp, id), resolveCategories: () => [{ id: 'fixture' }],
    }))
    const judge = await import('../stages/judge')
    const llm = await import('../llm')
    const batches = await import('../batch-llm')
    llm.setSleepForTests(async () => {})
    batches.setBatchSleepForTests(async () => {})
    const message = (v: Verdict) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(v) }] })
    const interactive = vi.fn()
    for (const response of responses.slice(batch ? 1 : 0)) interactive.mockResolvedValueOnce(message(response))
    interactive.mockRejectedValue(new Error('budget exceeded'))
    llm.setClientForTests({ messages: { create: interactive } } as never)
    const createBatch = vi.fn().mockResolvedValue({ id: 'fixture-batch', processing_status: 'ended' })
    batches.setBatchesClientForTests({ create: createBatch, retrieve: vi.fn().mockResolvedValue({ id: 'fixture-batch', processing_status: 'ended' }), results: vi.fn().mockImplementation(async function* () {
      yield { custom_id: judge.batchCustomId(cell()), result: { type: 'succeeded', message: message(responses[0]) } }
    }) } as never)
    for (const [name, value] of Object.entries({ 'products.json': [{ id: 'product', name: 'Product', vendor: 'Product', type: 'oss', urls: { site: 'https://example.invalid' } }],
      'stories.json': [story], 'evidence/product.json': evidence, 'verdicts.json': [good], 'rankings.json': ['published-sentinel'] })) {
      const file = path.join(tmp, 'fixture', name)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, JSON.stringify(value))
    }
    return { judge, interactive, createBatch }
  }
  for (const batch of [false, true]) {
    for (const successAt of [0, 1, 3, 4]) it(`${batch ? 'batch' : 'interactive'}: ${successAt === 4 ? 'exhaustion' : `success at correction ${successAt}`}`, async () => {
      const responses = Array.from({ length: successAt }, () => quoted('rejected span'))
      if (successAt < 4) responses.push(good)
      const { judge, interactive, createBatch } = await setup(responses, batch)
      const before = fs.readFileSync(path.join(tmp, 'fixture/verdicts.json'), 'utf8')
      if (successAt < 4) {
        await judge.runJudge({ category: 'fixture', batch })
        expect(fs.existsSync(cell().cacheFile)).toBe(true)
        expect(fs.existsSync(failurePath())).toBe(false)
      } else {
        await expect(judge.runJudge({ category: 'fixture', batch })).rejects.toThrow('quote-mismatch')
        expect(fs.existsSync(cell().cacheFile)).toBe(false)
        expect(fs.readFileSync(path.join(tmp, 'fixture/verdicts.json'), 'utf8')).toBe(before)
        const record = JSON.parse(fs.readFileSync(failurePath(), 'utf8'))
        expect(record.attempts).toHaveLength(4)
        expect(record.attempts.map((a: { attempt: number }) => a.attempt)).toEqual([1, 2, 3, 4])
        expect(record.attempts[0].transport).toBe(batch ? 'batch' : 'interactive')
        expect(record).toMatchObject({ publicationAuthority: false, exactReplay: false, termination: 'semantic-exhaustion' })
      }
      expect(interactive).toHaveBeenCalledTimes(Math.min(successAt + 1, 4) - Number(batch))
      expect(createBatch).toHaveBeenCalledTimes(Number(batch))
      expect(fs.readFileSync(path.join(tmp, 'fixture/rankings.json'), 'utf8')).toBe('["published-sentinel"]')
      if (!batch) expect(interactive.mock.calls[0][0].messages[0].content).toBe(judge.judgePrompt('Product', story, evidence))
      const corrections = interactive.mock.calls.slice(batch ? 0 : 1)
      for (const call of corrections) {
        expect(call[0].messages[0].content).toContain('quote at citationIndex')
        expect(call[0].messages[0].content).not.toContain('irrelevant-rationale-marker')
        expect(call[0].system).toBe(judge.SYSTEM)
      }
    })
  }
  it('retains semantic attempts if a later correction request fails, without extra calls', async () => {
    const { judge, interactive } = await setup([quoted('bad')], false)
    await expect(judge.runJudge({ category: 'fixture' })).rejects.toThrow('budget exceeded')
    const record = JSON.parse(fs.readFileSync(failurePath(), 'utf8'))
    expect(record.termination).toBe('correction-request-failed')
    expect(record.attempts).toHaveLength(1)
    expect(interactive).toHaveBeenCalledTimes(2)
    expect(fs.existsSync(cell().cacheFile)).toBe(false)
  })
  it('clears an older failure record and preserves a valid cached judgment without model calls', async () => {
    const { judge, interactive } = await setup([], false)
    fs.mkdirSync(path.dirname(failurePath()), { recursive: true })
    fs.writeFileSync(failurePath(), 'old diagnostic')
    fs.mkdirSync(path.dirname(cell().cacheFile), { recursive: true })
    const cached = JSON.stringify({ hash: cell().hash, keyVersion: judge.CELL_HASH_VERSION, verdict: good })
    fs.writeFileSync(cell().cacheFile, cached)
    await judge.runJudge({ category: 'fixture' })
    expect(interactive).not.toHaveBeenCalled()
    expect(fs.existsSync(failurePath())).toBe(false)
    expect(fs.readFileSync(cell().cacheFile, 'utf8')).toBe(cached)
  })
})
