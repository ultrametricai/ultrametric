// Shareable cap-table permalink codec — the whole event list in one compact
// URL-safe ?ct= param, modeled on the Virtual Startup ?run= codec
// (lib/virtualStartupRun.ts): unpadded base64url over compact-key JSON, versioned,
// and fully defensive on decode (ANY malformation → null, UI falls back to defaults).
// Pure and client-safe: hand-rolled base64url (RFC 4648 §5) with no Buffer/btoa so it
// round-trips identically in the browser and in node tests.
// ---------------------------------------------------------------------------

import { z } from 'zod'
import { CapTableEventSchema, type CapTableEvent } from './capTable'
import { entrySpec } from './entryValidation'

export const CAP_TABLE_STATE_VERSION = 1

/** Registered entrypoint arguments (open-modules/registry.json). Encode validates its
 * events structurally; decode stays fully defensive (any malformation returns null). */
export const encodeCapTableStateEntry = entrySpec('encodeCapTableState', [
  { name: 'events', schema: z.array(CapTableEventSchema) },
])

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined
    out += B64URL[b0 >> 2]
    out += B64URL[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)]
    if (b1 !== undefined) out += B64URL[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)]
    if (b2 !== undefined) out += B64URL[b2 & 63]
  }
  return out
}

function fromBase64Url(s: string): string | null {
  if (s.length % 4 === 1) return null
  const vals: number[] = []
  for (const ch of s) {
    const v = B64URL.indexOf(ch)
    if (v < 0) return null
    vals.push(v)
  }
  const bytes: number[] = []
  for (let i = 0; i < vals.length; i += 4) {
    const [a, b, c, d] = [vals[i], vals[i + 1], vals[i + 2], vals[i + 3]]
    if (b === undefined) return null
    bytes.push(((a << 2) | (b >> 4)) & 0xff)
    if (c !== undefined) bytes.push(((b << 4) | (c >> 2)) & 0xff)
    if (d !== undefined) bytes.push(((c << 6) | d) & 0xff)
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes))
  } catch {
    return null
  }
}

// Compact wire form: single-letter keys, undefined/false fields omitted.
// found  → { k:'f', o:[[name,shares],…], p?:poolShares }
// pool   → { k:'p', s?:shares, t?:targetPct }
// grant  → { k:'g', n:name, s:shares }
// safe   → { k:'s', n:name, a:amount, c?:cap, d?:discountPct, m?:1, r?:1 }
// priced → { k:'r', n:name, p:preMoney, m:newMoney, t?:poolTargetPct, s?:poolShares }
type Wire = Record<string, unknown>

function toWire(ev: CapTableEvent): Wire {
  switch (ev.kind) {
    case 'found': {
      const w: Wire = { k: 'f', o: ev.founders.map((f) => [f.name, f.shares]) }
      if (ev.poolShares) w.p = ev.poolShares
      return w
    }
    case 'pool': {
      const w: Wire = { k: 'p' }
      if (ev.shares !== undefined) w.s = ev.shares
      if (ev.targetPct !== undefined) w.t = ev.targetPct
      return w
    }
    case 'grant':
      return { k: 'g', n: ev.name, s: ev.shares }
    case 'safe': {
      const w: Wire = { k: 's', n: ev.name, a: ev.amount }
      if (ev.cap !== undefined) w.c = ev.cap
      if (ev.discountPct !== undefined) w.d = ev.discountPct
      if (ev.mfn) w.m = 1
      if (ev.proRata) w.r = 1
      return w
    }
    case 'priced': {
      const w: Wire = { k: 'r', n: ev.name, p: ev.preMoney, m: ev.newMoney }
      if (ev.poolTargetPct !== undefined) w.t = ev.poolTargetPct
      if (ev.poolShares !== undefined) w.s = ev.poolShares
      return w
    }
  }
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 && v.length <= 80 ? v : null
}

function fromWire(w: unknown): CapTableEvent | null {
  if (typeof w !== 'object' || w === null) return null
  const o = w as Wire
  switch (o.k) {
    case 'f': {
      if (!Array.isArray(o.o) || o.o.length === 0) return null
      const founders = []
      for (const f of o.o) {
        if (!Array.isArray(f)) return null
        const name = str(f[0])
        const shares = num(f[1])
        if (name === null || shares === null) return null
        founders.push({ name, shares })
      }
      const poolShares = o.p === undefined ? undefined : num(o.p)
      if (poolShares === null) return null
      return { kind: 'found', founders, poolShares }
    }
    case 'p': {
      const shares = o.s === undefined ? undefined : num(o.s)
      const targetPct = o.t === undefined ? undefined : num(o.t)
      if (shares === null || targetPct === null) return null
      if (shares === undefined && targetPct === undefined) return null
      return { kind: 'pool', shares, targetPct }
    }
    case 'g': {
      const name = str(o.n)
      const shares = num(o.s)
      if (name === null || shares === null) return null
      return { kind: 'grant', name, shares }
    }
    case 's': {
      const name = str(o.n)
      const amount = num(o.a)
      if (name === null || amount === null) return null
      const cap = o.c === undefined ? undefined : num(o.c)
      const discountPct = o.d === undefined ? undefined : num(o.d)
      if (cap === null || discountPct === null) return null
      return { kind: 'safe', name, amount, cap, discountPct, mfn: o.m === 1 || undefined, proRata: o.r === 1 || undefined }
    }
    case 'r': {
      const name = str(o.n)
      const preMoney = num(o.p)
      const newMoney = num(o.m)
      if (name === null || preMoney === null || newMoney === null) return null
      const poolTargetPct = o.t === undefined ? undefined : num(o.t)
      const poolShares = o.s === undefined ? undefined : num(o.s)
      if (poolTargetPct === null || poolShares === null) return null
      return { kind: 'priced', name, preMoney, newMoney, poolTargetPct, poolShares }
    }
    default:
      return null
  }
}

/** Encode the event list as an unpadded base64url token for the ?ct= param. */
export function encodeCapTableState(events: readonly CapTableEvent[]): string {
  encodeCapTableStateEntry.validate(events)
  return toBase64Url(JSON.stringify({ v: CAP_TABLE_STATE_VERSION, e: events.map(toWire) }))
}

/** Decode a ?ct= token. Returns null on ANY malformation (bad base64, bad JSON, wrong
 * version, unknown event kind, non-finite/negative numbers, > 40 events). */
export function decodeCapTableState(raw: string | null): CapTableEvent[] | null {
  if (!raw) return null
  const json = fromBase64Url(raw)
  if (json === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const obj = parsed as { v?: unknown; e?: unknown }
  if (obj.v !== CAP_TABLE_STATE_VERSION || !Array.isArray(obj.e) || obj.e.length > 40) return null
  const events: CapTableEvent[] = []
  for (const w of obj.e) {
    const ev = fromWire(w)
    if (ev === null) return null
    events.push(ev)
  }
  return events
}
