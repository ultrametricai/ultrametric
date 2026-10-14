import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadCategory, vendorResponseFor } from '@/lib/data'
import { VendorResponseSchema, VendorResponsesArraySchema, type VendorResponse } from '@/lib/schemas'

const REAL = path.resolve(__dirname, '../../open-rankings')
let tmp: string | undefined
afterEach(() => { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); tmp = undefined })

function corruptedCopy(mutate: (dir: string) => void): string {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-vendor-'))
  fs.cpSync(REAL, tmp, { recursive: true })
  mutate(tmp)
  return tmp
}

const VALID: VendorResponse = {
  productId: 'foreloop',
  storyId: 'agentic-agent-docs',
  statement: 'The verdict is accurate; an llms.txt index is on our roadmap.',
  respondedAt: '2026-09-04T00:00:00.000Z',
  contactRole: 'DevRel lead',
  verification: { method: 'github-org', evidence: 'PR #42 from github.com/ultrametricai member' },
  url: 'https://foreloop.com/docs',
  status: 'standing',
}

describe('VendorResponseSchema', () => {
  it('accepts a well-formed response, with url optional', () => {
    expect(VendorResponseSchema.parse(VALID)).toEqual(VALID)
    expect(VendorResponseSchema.parse({ ...VALID, url: undefined }).url).toBeUndefined()
  })

  it('rejects a statement over 1200 characters — the verbatim cap is the schema, not policy prose', () => {
    expect(() => VendorResponseSchema.parse({ ...VALID, statement: 'x'.repeat(1201) })).toThrow()
    expect(VendorResponseSchema.parse({ ...VALID, statement: 'x'.repeat(1200) }).statement).toHaveLength(1200)
  })

  it('rejects unknown verification methods and statuses', () => {
    expect(() =>
      VendorResponseSchema.parse({ ...VALID, verification: { method: 'pinky-swear', evidence: 'trust me' } }),
    ).toThrow()
    expect(() => VendorResponseSchema.parse({ ...VALID, status: 'retracted' })).toThrow()
    expect(() => VendorResponseSchema.parse({ ...VALID, respondedAt: 'yesterday' })).toThrow()
  })
})

describe('loadCategory vendor responses', () => {
  it('loads the committed software-factory response for foreloop', () => {
    const data = loadCategory('software-factory', REAL)
    const parsed = VendorResponsesArraySchema.parse(data.vendorResponses)
    const r = parsed.find((x) => x.productId === 'foreloop' && x.storyId === 'agentic-agent-docs')
    expect(r).toBeDefined()
    expect(r!.status).toBe('standing')
    expect(r!.verification.method).toBe('github-org')
    expect(vendorResponseFor(data, 'foreloop', 'agentic-agent-docs')).toEqual(r)
  })

  it('resolves to an empty array for a category without vendor-responses.json', () => {
    const data = loadCategory('desktop-os', REAL)
    expect(data.vendorResponses).toEqual([])
    expect(vendorResponseFor(data, data.products[0].id, data.stories[0].id)).toBeUndefined()
  })

  it('rejects a response referencing an unknown product', () => {
    const dir = corruptedCopy((d) => {
      const p = path.join(d, 'software-factory', 'vendor-responses.json')
      fs.writeFileSync(p, JSON.stringify([{ ...VALID, productId: 'ghost-product' }]))
    })
    expect(() => loadCategory('software-factory', dir)).toThrow(/unknown product ghost-product/)
  })

  it('rejects a response referencing an unknown story', () => {
    const dir = corruptedCopy((d) => {
      const p = path.join(d, 'software-factory', 'vendor-responses.json')
      fs.writeFileSync(p, JSON.stringify([{ ...VALID, storyId: 'ghost-story' }]))
    })
    expect(() => loadCategory('software-factory', dir)).toThrow(/unknown story ghost-story/)
  })

  it('rejects two standing responses for the same cell, but allows standing + superseded', () => {
    const dupDir = corruptedCopy((d) => {
      const p = path.join(d, 'software-factory', 'vendor-responses.json')
      fs.writeFileSync(p, JSON.stringify([VALID, { ...VALID, statement: 'Second thoughts.' }]))
    })
    expect(() => loadCategory('software-factory', dupDir)).toThrow(/multiple standing vendor responses/)
    fs.rmSync(dupDir, { recursive: true, force: true })

    const okDir = corruptedCopy((d) => {
      const p = path.join(d, 'software-factory', 'vendor-responses.json')
      fs.writeFileSync(
        p,
        JSON.stringify([VALID, { ...VALID, status: 'superseded', respondedAt: '2026-08-01T00:00:00.000Z' }]),
      )
    })
    const data = loadCategory('software-factory', okDir)
    expect(data.vendorResponses).toHaveLength(2)
    // The standing response wins over the superseded one for display.
    expect(vendorResponseFor(data, VALID.productId, VALID.storyId)!.status).toBe('standing')
  })

  it('vendorResponseFor falls back to the most recent superseded response when nothing stands', () => {
    const data = loadCategory('software-factory', REAL)
    const withHistory = {
      ...data,
      vendorResponses: [
        { ...VALID, status: 'superseded' as const, respondedAt: '2026-01-01T00:00:00.000Z', statement: 'old' },
        { ...VALID, status: 'superseded' as const, respondedAt: '2026-06-01T00:00:00.000Z', statement: 'newer' },
      ],
    }
    expect(vendorResponseFor(withHistory, VALID.productId, VALID.storyId)!.statement).toBe('newer')
    expect(vendorResponseFor(withHistory, VALID.productId, 'agentic-webhooks')).toBeUndefined()
  })
})
