// Round-trip and defensive-decode tests for the ?ct= permalink codec.

import { describe, expect, it } from 'vitest'
import type { CapTableEvent } from '../capTable'
import { CAP_TABLE_STATE_VERSION, decodeCapTableState, encodeCapTableState } from '../capTableCodec'

const FULL: CapTableEvent[] = [
  {
    kind: 'found',
    founders: [
      { name: 'Ada', shares: 4_625_000 },
      { name: 'Grace', shares: 4_625_000 },
    ],
    poolShares: 750_000,
  },
  { kind: 'grant', name: 'Early team', shares: 300_000 },
  { kind: 'pool', targetPct: 10 },
  { kind: 'safe', name: 'Angel', amount: 200_000, cap: 4_000_000 },
  { kind: 'safe', name: 'MFN note', amount: 100_000, mfn: true },
  { kind: 'safe', name: 'Lead', amount: 800_000, cap: 8_000_000, discountPct: 20, proRata: true },
  { kind: 'priced', name: 'Series A', preMoney: 15_000_000, newMoney: 5_000_000, poolTargetPct: 10 },
  { kind: 'priced', name: 'Series B', preMoney: 60_000_000, newMoney: 15_000_000, poolShares: 1_000_000 },
]

describe('encode/decode round trip', () => {
  it('round-trips every event kind with all optional fields', () => {
    const decoded = decodeCapTableState(encodeCapTableState(FULL))
    expect(decoded).toEqual(FULL)
  })

  it('round-trips the empty list and a minimal list', () => {
    expect(decodeCapTableState(encodeCapTableState([]))).toEqual([])
    const minimal: CapTableEvent[] = [{ kind: 'found', founders: [{ name: 'F', shares: 1 }] }]
    expect(decodeCapTableState(encodeCapTableState(minimal))).toEqual(minimal)
  })

  it('emits only URL-safe characters (unpadded base64url)', () => {
    const token = encodeCapTableState(FULL)
    expect(token).toMatch(/^[A-Za-z0-9\-_]+$/)
    expect(token).not.toContain('=')
  })

  it('normalizes falsy optional fields: mfn/proRata false and poolShares 0 decode as absent', () => {
    const events: CapTableEvent[] = [
      { kind: 'found', founders: [{ name: 'F', shares: 1 }], poolShares: 0 },
      { kind: 'safe', name: 'S', amount: 1, cap: 10, mfn: false, proRata: false },
    ]
    const decoded = decodeCapTableState(encodeCapTableState(events))!
    expect(decoded[0]).toEqual({ kind: 'found', founders: [{ name: 'F', shares: 1 }], poolShares: undefined })
    expect(decoded[1]).toEqual({
      kind: 'safe', name: 'S', amount: 1, cap: 10, discountPct: undefined, mfn: undefined, proRata: undefined,
    })
  })

  it('is stable for unicode founder names', () => {
    const events: CapTableEvent[] = [{ kind: 'found', founders: [{ name: 'Zoë 🚀', shares: 100 }] }]
    expect(decodeCapTableState(encodeCapTableState(events))).toEqual(events)
  })
})

describe('defensive decode → null', () => {
  const valid = encodeCapTableState(FULL)

  it('rejects null, empty, garbage, and truncated tokens', () => {
    expect(decodeCapTableState(null)).toBeNull()
    expect(decodeCapTableState('')).toBeNull()
    expect(decodeCapTableState('!!!not-base64url!!!')).toBeNull()
    expect(decodeCapTableState(valid.slice(0, 5))).toBeNull()
  })

  it('rejects the wrong version and wrong JSON shapes', () => {
    const b64 = (s: string) => {
      // Re-use the encoder by piggybacking on JSON: encode, then decode/patch is not
      // exposed, so build tokens from scratch via a throwaway TextEncoder base64url.
      const bytes = new TextEncoder().encode(s)
      const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
      let out = ''
      for (let i = 0; i < bytes.length; i += 3) {
        const [b0, b1, b2] = [bytes[i], bytes[i + 1], bytes[i + 2]]
        out += A[b0 >> 2] + A[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)]
        if (b1 !== undefined) out += A[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)]
        if (b2 !== undefined) out += A[b2 & 63]
      }
      return out
    }
    expect(decodeCapTableState(b64(JSON.stringify({ v: CAP_TABLE_STATE_VERSION + 1, e: [] })))).toBeNull()
    expect(decodeCapTableState(b64(JSON.stringify({ e: [] })))).toBeNull()
    expect(decodeCapTableState(b64(JSON.stringify([])))).toBeNull()
    expect(decodeCapTableState(b64('"just a string"'))).toBeNull()
    expect(decodeCapTableState(b64('{not json'))).toBeNull()
    // unknown event kind
    expect(decodeCapTableState(b64(JSON.stringify({ v: 1, e: [{ k: 'z' }] })))).toBeNull()
    // negative / non-finite numbers
    expect(decodeCapTableState(b64(JSON.stringify({ v: 1, e: [{ k: 'g', n: 'X', s: -5 }] })))).toBeNull()
    expect(decodeCapTableState(b64(JSON.stringify({ v: 1, e: [{ k: 's', n: 'X', a: 'lots' }] })))).toBeNull()
    // pool event with neither shares nor target
    expect(decodeCapTableState(b64(JSON.stringify({ v: 1, e: [{ k: 'p' }] })))).toBeNull()
  })

  it('rejects oversized event lists (> 40)', () => {
    const many: CapTableEvent[] = Array.from({ length: 41 }, (_, i) => ({
      kind: 'grant',
      name: `g${i}`,
      shares: 1,
    }))
    expect(decodeCapTableState(encodeCapTableState(many))).toBeNull()
  })
})
