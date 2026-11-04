import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
const request = vi.hoisted(() => vi.fn())
vi.mock('node:https', () => ({ default: { request } }))
import { pinnedRequest, resolvePublic, MAX_BYTES, TIMEOUT_MS } from '../intake/public-fetch'

afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

describe('intake transport bounds', () => {
  function setup(chunks: Buffer[] | null) {
    request.mockImplementation((_url, options, callback) => {
      expect(options.headers.Authorization).toBeUndefined()
      expect(options.headers.Cookie).toBeUndefined()
      expect(options.agent).toBe(false)
      options.lookup('acme.io', {}, (error: Error | null, address: string, family: number) => {
        expect(error).toBeNull(); expect(address).toBe('8.8.8.8'); expect(family).toBe(4)
      })
      const req = Object.assign(new EventEmitter(), {
        end() {
          queueMicrotask(() => {
            const res = Object.assign(new EventEmitter(), { statusCode: 200, headers: { 'content-type': 'text/plain' } })
            callback(res)
            if (chunks) { for (const chunk of chunks) res.emit('data', chunk); res.emit('end'); req.emit('close') }
          })
        },
        destroy(error: Error) { req.emit('error', error); req.emit('close') },
      })
      return req
    })
  }
  it('retains TLS hostname and pins lookup without credentials', async () => {
    setup([Buffer.from('public documentation')])
    expect((await pinnedRequest(new URL('https://acme.io/'), '8.8.8.8')).html).toBe('public documentation')
    expect(request.mock.calls[0][0].hostname).toBe('acme.io')
    expect(request.mock.calls[0][1].rejectUnauthorized).not.toBe(false)
  })
  it('aborts oversized responses rather than using a truncated document', async () => {
    setup([Buffer.alloc(MAX_BYTES), Buffer.from('overflow')])
    await expect(pinnedRequest(new URL('https://acme.io/'), '8.8.8.8')).rejects.toThrow('byte limit')
  })
  it('bounds the entire request even if a server keeps the socket open', async () => {
    vi.useFakeTimers(); setup(null)
    const pending = expect(pinnedRequest(new URL('https://acme.io/'), '8.8.8.8')).rejects.toThrow('request timeout')
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS)
    await pending
  })
  it('bounds a DNS resolver that never replies', async () => {
    vi.useFakeTimers()
    const pending = expect(resolvePublic('acme.io', () => new Promise(() => {}))).rejects.toThrow('DNS timeout')
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS)
    await pending
  })
})
