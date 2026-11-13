import { describe, expect, it } from 'vitest'
import { batchCode, canonicalYcDomain, MODERN_BATCHES, normalizeDomain, withYcBatch } from '../yc-shared'

describe('batchCode', () => {
  it('converts full YC batch names to short codes', () => {
    expect(batchCode('Winter 2023')).toBe('W23')
    expect(batchCode('Summer 2026')).toBe('S26')
    expect(batchCode('Winter 2006')).toBe('W06')
    // YC's four-batch era: Spring's official code is X, Fall's is F.
    expect(batchCode('Spring 2025')).toBe('X25')
    expect(batchCode('Fall 2025')).toBe('F25')
  })

  it('returns null for names that do not match the "<Season> <Year>" shape', () => {
    expect(batchCode('Unspecified')).toBeNull()
    expect(batchCode('')).toBeNull()
    expect(batchCode('Autumn 2023')).toBeNull()
  })
})

describe('normalizeDomain', () => {
  it('strips protocol, www, path, and lowercases', () => {
    expect(normalizeDomain('https://www.Mercury.com/pricing')).toBe('mercury.com')
    expect(normalizeDomain('http://brex.com')).toBe('brex.com')
  })

  it('adds a protocol when missing so bare domains still parse', () => {
    expect(normalizeDomain('fly.io')).toBe('fly.io')
  })

  it('returns null for missing or unparseable input', () => {
    expect(normalizeDomain(undefined)).toBeNull()
    expect(normalizeDomain(null)).toBeNull()
    expect(normalizeDomain('')).toBeNull()
  })
})

describe('canonicalYcDomain', () => {
  it('collapses a verified rebrand onto the tracked product domain (Superset -> Paradev, X26)', () => {
    expect(canonicalYcDomain('paradev.com')).toBe('superset.sh')
  })

  it('maps the verified Mastra product site without collapsing arbitrary subdomains', () => {
    expect(canonicalYcDomain('code.mastra.ai')).toBe('mastra.ai')
    expect(canonicalYcDomain('other.mastra.ai')).toBe('other.mastra.ai')
    expect(canonicalYcDomain('tenant.example.com')).toBe('tenant.example.com')
  })

  it('is the identity for every other domain', () => {
    expect(canonicalYcDomain('mercury.com')).toBe('mercury.com')
    expect(canonicalYcDomain('superset.sh')).toBe('superset.sh')
  })
})

describe('MODERN_BATCHES', () => {
  it('covers exactly W23 through F26 (including the four-batch-era Spring/Fall batches), oldest to newest', () => {
    expect(MODERN_BATCHES).toEqual([
      'Winter 2023', 'Summer 2023',
      'Winter 2024', 'Summer 2024', 'Fall 2024',
      'Winter 2025', 'Spring 2025', 'Summer 2025', 'Fall 2025',
      'Winter 2026', 'Spring 2026', 'Summer 2026', 'Fall 2026',
    ])
  })
})

describe('withYcBatch', () => {
  const product = { id: 'fixture', name: 'Fixture', vendor: 'Fixture', type: 'commercial' as const, urls: { site: 'https://fixture.example' } }

  it('retains a verified baseline affiliation when the mirror omits the company', () => {
    const prior = { ...product, ycBatch: 'W25' }
    expect(withYcBatch(prior, undefined)).toBe(prior)
    expect(withYcBatch(prior, 'Unspecified')).toBe(prior)
    expect(withYcBatch(product, undefined)).toBe(product)
  })

  it('applies a matched batch without changing the input product', () => {
    expect(withYcBatch(product, 'Winter 2025')).toEqual({ ...product, ycBatch: 'W25' })
    expect(product).not.toHaveProperty('ycBatch')
  })

  it('keeps retained-arena metadata byte-stable when a match proposes an addition or correction', () => {
    const prior = { ...product, ycBatch: 'W25' }
    expect(withYcBatch(product, 'Winter 2025', true)).toBe(product)
    expect(withYcBatch(prior, 'Spring 2026', true)).toBe(prior)
    expect(withYcBatch(prior, undefined, true)).toBe(prior)
  })
})
