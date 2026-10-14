import { describe, expect, it } from 'vitest'
import type { Evidence } from '@/lib/schemas'
import {
  candidateSignals,
  candidateTarget,
  collectCertCandidates,
  compareCandidates,
  type CertCandidate,
} from '@/pipeline/scripts/cert-candidates'
import { needsRenewal, CANDIDATE_CAP, RENEW_WINDOW_DAYS } from '@/pipeline/scripts/cert-sweep'

const ev = (tier: Evidence['tier'], excerpt: string): Evidence => ({
  id: 'acme-x',
  tier,
  url: 'https://docs.acme.example/llms.txt',
  excerpt,
  fetchedAt: '2026-09-01T00:00:00.000Z',
})

describe('candidateSignals', () => {
  it('detects a positive llms.txt probe', () => {
    const signals = candidateSignals([ev('probe', 'PROBE llms.txt: HTTP 200 at https://docs.acme.example/llms.txt # Acme')])
    expect(signals).toEqual(['llms-txt'])
  })

  it('detects a positive mcp-link probe', () => {
    expect(candidateSignals([ev('probe', 'official MCP server documented at https://acme.example/mcp')])).toEqual(['mcp-link'])
  })

  it('collects both signals when both probes are positive', () => {
    const signals = candidateSignals([
      ev('probe', 'PROBE llms.txt: HTTP 200 at https://docs.acme.example/llms.txt'),
      ev('probe', 'official MCP server documented at https://acme.example/mcp'),
    ])
    expect(signals).toEqual(['llms-txt', 'mcp-link'])
  })

  it('ignores negative probes and non-probe tiers', () => {
    expect(
      candidateSignals([
        ev('probe', 'PROBE llms.txt: HTTP 404 at https://docs.acme.example/llms.txt'),
        ev('probe', 'PROBE mcp-link: HTTP 404 at https://acme.example/mcp (curated link may be stale)'),
        // Same words but claimed-docs tier — a doc excerpt, not a probe verification.
        ev('claimed-docs', 'PROBE llms.txt: HTTP 200 at https://docs.acme.example/llms.txt'),
      ]),
    ).toEqual([])
  })
})

describe('compareCandidates', () => {
  const cand = (arena: string, productId: string, signals: CertCandidate['signals']): CertCandidate => ({
    arena,
    productId,
    productName: productId,
    target: 'https://example.com',
    signals,
  })

  it('orders two-signal candidates before one-signal, then by arena/product', () => {
    const sorted = [
      cand('zeta', 'z-one', ['llms-txt']),
      cand('alpha', 'a-two', ['llms-txt', 'mcp-link']),
      cand('alpha', 'a-one', ['llms-txt']),
    ].sort(compareCandidates)
    expect(sorted.map((c) => c.productId)).toEqual(['a-two', 'a-one', 'z-one'])
  })
})

describe('candidateTarget', () => {
  it('prefers docs over site, mirroring probe.ts', () => {
    expect(candidateTarget({ urls: { site: 'https://acme.example', docs: 'https://docs.acme.example' } })).toBe(
      'https://docs.acme.example',
    )
    expect(candidateTarget({ urls: { site: 'https://acme.example' } })).toBe('https://acme.example')
  })
})

describe('needsRenewal (cert-sweep)', () => {
  // TTL is 180 days (lib/certifications.ts): a cert dated `date` expires at date+180.
  it('false for a fresh certification far from expiry', () => {
    expect(needsRenewal({ date: '2026-09-01' }, '2026-09-10')).toBe(false)
  })

  it('true once expiry falls inside the renewal window', () => {
    // Expires 2026-09-28 (2026-04-01 + 180d) — well inside today+45d.
    expect(needsRenewal({ date: '2026-04-01' }, '2026-09-10')).toBe(true)
  })

  it('true for an already-expired certification', () => {
    expect(needsRenewal({ date: '2025-01-01' }, '2026-09-10')).toBe(true)
  })

  it('sanity: the constants the sweep documents', () => {
    expect(CANDIDATE_CAP).toBe(15)
    expect(RENEW_WINDOW_DAYS).toBe(45)
  })
})

describe('collectCertCandidates (against the committed registry data)', () => {
  // Runs on the real open-rankings/ tree — pure file reads, no network. Locks the queue's contract:
  // every candidate is backed by at least one probe signal, none already hold an active
  // certification, and product ids never repeat across arenas.
  it('emits only uncertified, probe-backed, deduplicated products', () => {
    const queue = collectCertCandidates(new Date('2026-09-10T12:00:00.000Z'))
    expect(queue.length).toBeGreaterThan(0)
    const ids = queue.map((c) => c.productId)
    expect(new Set(ids).size).toBe(ids.length)
    for (const c of queue) {
      expect(c.signals.length).toBeGreaterThan(0)
      expect(c.target).toMatch(/^https?:\/\//)
    }
    // Certified products must be out of the queue (they were certified in this repo's data).
    expect(ids).not.toContain('stripe')
    expect(ids).not.toContain('supabase')
    expect(ids).not.toContain('notion')
  })
})
