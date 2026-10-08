import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { shape } from '@/lib/founderOps'
import { buildVendorReviews, REVIEWER, REVIEWS_DIR } from '../scripts/generate-vendor-reviews'

// Corpus lift stage 2: vendors/reviews/generated/ holds one founder-ops interchange record
// (schemas/vendor-review.schema.json) per judged product, emitted deterministically from the
// committed arena data by pipeline/scripts/generate-vendor-reviews.ts. These tests pin the
// contracts that make the committed records trustworthy: schema conformance for every file,
// byte-identical regeneration (no clock reads, no drift), the owner-disclosure rule, and three
// spot-pinned records so a silent projection change fails loudly. (The founder-ops validator in
// lib/founderOps.ts additionally shape-checks everything under vendors/reviews/ on every run.)

const ROOT = path.resolve(__dirname, '..', '..')
const SCHEMA = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'schemas', 'vendor-review.schema.json'), 'utf8'),
)

const committedFiles = fs.readdirSync(REVIEWS_DIR).sort()
const committed = new Map(
  committedFiles.map((f) => [f, fs.readFileSync(path.join(REVIEWS_DIR, f), 'utf8')] as const),
)

describe('generated vendor-review interchange records', () => {
  it('covers every judged product and regenerates byte-identically', () => {
    const built = buildVendorReviews()
    expect(built.size).toBeGreaterThanOrEqual(500)
    expect([...built.keys()].sort()).toEqual(committedFiles)
    for (const [file, content] of built) {
      expect(committed.get(file), file).toBe(content)
    }
  })

  it('every committed record passes the vendor-review schema and the generator invariants', () => {
    const errors: string[] = []
    for (const [file, content] of committed) {
      const record = JSON.parse(content)
      shape(record, SCHEMA, `vendor ${file}`, errors)
      expect(record.status, file).toBe('tested')
      expect(record.reviewer, file).toBe(REVIEWER)
      expect(`${record.id}.json`, file).toBe(file)
      expect(record.id.startsWith(`${record.category}--`), `${file} id prefix`).toBe(true)
      expect(record.evidence.length, `${file} evidence`).toBeLessThanOrEqual(5)
      for (const e of record.evidence) {
        expect(e.uri, `${file} evidence uri`).toMatch(/^https?:\/\//)
        expect(e.observed_on, `${file} observed_on`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    }
    expect(errors).toEqual([])
  })

  it('owner products (the Ultrametric self-entries) always carry the committed disclosure', () => {
    for (const file of ['software-factory--foreloop.json', 'product-feedback--foreloop.json', 'workflow-automation--afk.json']) {
      const record = JSON.parse(committed.get(file)!)
      expect(record.affiliations.length, file).toBeGreaterThan(0)
      expect(record.affiliations[0], file).toContain('Ultrametric Inc')
    }
  })

  it('spot-pin: cursor (ai-coding) — dimensions from the committed rankings, probe-first evidence', () => {
    const r = JSON.parse(committed.get('ai-coding--cursor.json')!)
    expect(r.vendor).toBe('Cursor')
    expect(r.dimensions.agentReady).toBe(76.2)
    expect(r.dimensions.agentic).toBe(78)
    expect(r.dimensions.aiEra).toBe(59.8)
    // tested_on tracks the arena's rankings generatedAt — re-pinned 2026-10-08 when the
    // family-judgement wave's grok-build bring-up re-derived ai-coding.
    expect(r.tested_on).toBe('2026-10-08')
    expect(r.recheck_due).toBe('2027-01-06') // tested_on + 90 days
    expect(r.evidence[0].kind).toBe('probe')
    expect(r.jurisdictions).toEqual([]) // no geo spike rows for ai-coding
  })

  it('spot-pin: mercury (startup-banking) — the US entity lock survives into jurisdictions + limitations', () => {
    const r = JSON.parse(committed.get('startup-banking--mercury.json')!)
    expect(r.jurisdictions).toEqual([
      'US:available', 'UK:unavailable', 'IN:unavailable', 'DE:unavailable', 'FR:unavailable',
    ])
    // The judged negatives (the vendor's own eligibility page) are carried as honest ceilings.
    expect(r.limitations.length).toBeGreaterThanOrEqual(4)
    expect(r.limitations.join(' ')).toContain('United States or a U.S. territory')
  })

  it('spot-pin: gusto (payroll) — US-locked payroll with geo rows and dated evidence', () => {
    const r = JSON.parse(committed.get('payroll--gusto.json')!)
    expect(r.jurisdictions[0]).toBe('US:available')
    expect(r.jurisdictions).toContain('IN:unavailable')
    expect(r.tested_on).toBe('2026-10-01')
    expect(r.evidence.length).toBeGreaterThan(0)
  })
})
