import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  activeCertificationFor,
  CERT_LEVEL_LABELS,
  CERTIFICATION_TTL_DAYS,
  certificationExpires,
  CertificationSchema,
  isCertificationExpired,
  type Certification,
} from '@/lib/certifications'
import { loadCategory } from '@/lib/data'

const REAL = path.resolve(__dirname, '../../rankings')
let tmp: string | undefined
afterEach(() => { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); tmp = undefined })

function corruptedCopy(mutate: (dir: string) => void): string {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-cert-'))
  fs.cpSync(REAL, tmp, { recursive: true })
  mutate(tmp)
  return tmp
}

const VALID: Certification = {
  productId: 'stripe',
  level: 'agent-ready',
  date: '2026-09-08',
  reportUrl: '/data/payments/cert-reports/stripe.json',
  initiatedBy: 'maintainer',
}

describe('CertificationSchema', () => {
  it('accepts a well-formed certification', () => {
    expect(CertificationSchema.parse(VALID)).toEqual(VALID)
    expect(CertificationSchema.parse({ ...VALID, level: 'agent-native', initiatedBy: 'vendor' }).level).toBe('agent-native')
  })

  it('rejects unknown levels, initiators, and non-ISO dates', () => {
    expect(() => CertificationSchema.parse({ ...VALID, level: 'agent-curious' })).toThrow()
    expect(() => CertificationSchema.parse({ ...VALID, initiatedBy: 'anyone' })).toThrow()
    expect(() => CertificationSchema.parse({ ...VALID, date: 'Sept 8 2026' })).toThrow()
    expect(() => CertificationSchema.parse({ ...VALID, date: '2026-09-08T00:00:00Z' })).toThrow()
  })

  it('labels both levels for display', () => {
    expect(CERT_LEVEL_LABELS['agent-ready']).toBe('Certified Agent-Ready')
    expect(CERT_LEVEL_LABELS['agent-native']).toBe('Certified Agent-Native')
  })
})

describe('expiry (180 days)', () => {
  it('computes the expiry date from the certification date', () => {
    expect(CERTIFICATION_TTL_DAYS).toBe(180)
    expect(certificationExpires({ date: '2026-09-08' })).toBe('2027-03-07')
  })

  it('is unexpired through the expiry date and expired the day after', () => {
    expect(isCertificationExpired(VALID, new Date('2026-09-08T12:00:00Z'))).toBe(false)
    expect(isCertificationExpired(VALID, new Date('2027-03-07T23:59:59Z'))).toBe(false)
    expect(isCertificationExpired(VALID, new Date('2027-03-08T00:00:00Z'))).toBe(true)
  })

  it('activeCertificationFor returns the entry only while unexpired', () => {
    const certs = [VALID]
    expect(activeCertificationFor(certs, 'stripe', new Date('2026-10-01T00:00:00Z'))).toEqual(VALID)
    expect(activeCertificationFor(certs, 'stripe', new Date('2027-06-01T00:00:00Z'))).toBeUndefined()
    expect(activeCertificationFor(certs, 'adyen', new Date('2026-10-01T00:00:00Z'))).toBeUndefined()
  })
})

describe('loadCategory certifications', () => {
  it('loads the committed payments certification for stripe', () => {
    const data = loadCategory('payments', REAL)
    const cert = data.certifications.find((c) => c.productId === 'stripe')
    expect(cert).toBeDefined()
    expect(cert!.initiatedBy).toBe('maintainer')
    expect(['agent-ready', 'agent-native']).toContain(cert!.level)
    // The referenced report is committed alongside the registry entry.
    expect(fs.existsSync(path.join(REAL, 'payments', 'cert-reports', 'stripe.json'))).toBe(true)
  })

  it('resolves to an empty array for a category without certifications.json', () => {
    const data = loadCategory('desktop-os', REAL)
    expect(data.certifications).toEqual([])
    expect(activeCertificationFor(data.certifications, data.products[0].id)).toBeUndefined()
  })

  it('rejects a certification referencing an unknown product', () => {
    const dir = corruptedCopy((d) => {
      fs.writeFileSync(path.join(d, 'payments', 'certifications.json'), JSON.stringify([{ ...VALID, productId: 'ghost-product' }]))
    })
    expect(() => loadCategory('payments', dir)).toThrow(/certification references unknown product ghost-product/)
  })

  it('rejects two certifications for the same product', () => {
    const dir = corruptedCopy((d) => {
      fs.writeFileSync(path.join(d, 'payments', 'certifications.json'), JSON.stringify([VALID, { ...VALID, level: 'agent-native' }]))
    })
    expect(() => loadCategory('payments', dir)).toThrow(/multiple certifications for product stripe/)
  })
})
