import { describe, expect, it } from 'vitest'
import { batchCode, MODERN_BATCHES, normalizeDomain } from '../yc-shared'

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
