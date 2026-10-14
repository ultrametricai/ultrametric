import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { extractJson, llmJson, retryBackoffMs, setClientForTests, setSleepForTests } from '@/pipeline/llm'

// Retries back off with real sleeps in production; tests record them instead of waiting.
const sleeps: number[] = []
setSleepForTests(async (ms) => {
  sleeps.push(ms)
})

const textResponse = (text: string) => ({ content: [{ type: 'text', text }] })

describe('extractJson', () => {
  it('parses fenced json', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })
  it('parses json embedded in prose', () => {
    expect(extractJson('Here you go: [1,2,3] hope that helps')).toEqual([1, 2, 3])
  })
  it('returns undefined for garbage', () => {
    expect(extractJson('no json here')).toBeUndefined()
  })
  it('recovers JSON whose strings contain raw control characters', () => {
    expect(extractJson('{"rationale":"line one\nline two\ttabbed"}')).toEqual({
      rationale: 'line one\nline two\ttabbed',
    })
    // ...while raw newlines BETWEEN tokens stay legal whitespace
    expect(extractJson('{\n  "a": "x\ny"\n}')).toEqual({ a: 'x\ny' })
  })
})

describe('llmJson', () => {
  const schema = z.object({ name: z.string() })

  it('returns validated output on first success', async () => {
    const create = vi.fn().mockResolvedValue(textResponse('{"name":"ok"}'))
    setClientForTests({ messages: { create } } as never)
    await expect(llmJson({ schema, system: 's', prompt: 'p' })).resolves.toEqual({ name: 'ok' })
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('feeds validation errors back and retries', async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(textResponse('{"name":42}'))
      .mockResolvedValueOnce(textResponse('{"name":"fixed"}'))
    setClientForTests({ messages: { create } } as never)
    await expect(llmJson({ schema, system: 's', prompt: 'p' })).resolves.toEqual({ name: 'fixed' })
    expect(create).toHaveBeenCalledTimes(2)
    const secondCallMessages = create.mock.calls[1][0].messages
    expect(secondCallMessages).toHaveLength(3) // user, assistant, correction
    expect(JSON.stringify(secondCallMessages[2])).toMatch(/expected string/i)
  })

  it('throws after max retries (5 attempts), backing off between them', async () => {
    sleeps.length = 0
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const create = vi.fn().mockResolvedValue(textResponse('still not json'))
    setClientForTests({ messages: { create } } as never)
    await expect(llmJson({ schema, system: 's', prompt: 'p' })).rejects.toThrow(/failed validation/)
    expect(create).toHaveBeenCalledTimes(5)
    expect(sleeps).toHaveLength(4) // between attempts only — no sleep after the final failure
    // The unparseable output's head is logged for diagnosis (the CI flake gave us nothing to go on).
    expect(warn.mock.calls.some((c) => String(c[0]).includes('still not json'))).toBe(true)
    warn.mockRestore()
  })

  it('reinforces JSON-only output when the reply had no JSON at all', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const create = vi
      .fn()
      .mockResolvedValueOnce(textResponse('Sure! Let me think about that.'))
      .mockResolvedValueOnce(textResponse('{"name":"ok"}'))
    setClientForTests({ messages: { create } } as never)
    await expect(llmJson({ schema, system: 's', prompt: 'p' })).resolves.toEqual({ name: 'ok' })
    const correction = create.mock.calls[1][0].messages[2]
    expect(JSON.stringify(correction)).toMatch(/ONLY the JSON object/)
    warn.mockRestore()
  })

  it('resets the poisoned conversation after two consecutive no-JSON replies', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const create = vi
      .fn()
      .mockResolvedValueOnce(textResponse('prose only'))
      .mockResolvedValueOnce(textResponse('more prose'))
      .mockResolvedValueOnce(textResponse('{"name":"ok"}'))
    setClientForTests({ messages: { create } } as never)
    await expect(llmJson({ schema, system: 's', prompt: 'p' })).resolves.toEqual({ name: 'ok' })
    // Third call runs on a FRESH single-message conversation, not the stacked corrections.
    const thirdCallMessages = create.mock.calls[2][0].messages
    expect(thirdCallMessages).toHaveLength(1)
    expect(thirdCallMessages[0].content).toMatch(/^p\n\nReply with ONLY the JSON object/)
    warn.mockRestore()
  })

  it('backoff grows exponentially with jitter and is capped', () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const base = Math.min(4000, 500 * 2 ** attempt)
      const ms = retryBackoffMs(attempt)
      expect(ms).toBeGreaterThanOrEqual(base)
      expect(ms).toBeLessThan(base + 250)
    }
  })
})
