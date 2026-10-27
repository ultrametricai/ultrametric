import { describe, expect, it } from 'vitest'
import { loadProcessCatalog } from '@/lib/shared-processes/catalog'
import { STATE_SERVICES, type Part } from '@/lib/shared-processes/schema'
import { VENDOR_STATE_SERVICES } from '@/lib/vendorState'

// The per-step `service` field: every state-conditional step (metadata.jurisdictions naming a
// US state code, the legacy 'CA' California alias, or MULTI) declares which state-level service
// it is, so the per-state vendor rows in jurisdictions/vendor-state.json can be matched to it.
// Steps that are none of those services are listed below with the reason.

// `<process slug>/<part id>` -> why no service fits.
const EXEMPT: Record<string, string> = {
  // New York Article 9-A corporate franchise tax nexus and Form CT-3: a state income-tax return.
  'register-state-taxes/jny1': 'NY Article 9-A franchise tax (CT-3) is a tax return, not a registration service',
  // Washington business and occupation tax: a gross-receipts excise return to the DOR.
  'register-state-taxes/jwa1': 'WA B&O tax is a gross-receipts excise return, not sales-tax registration',
  // California $800 minimum franchise tax paid to the FTB.
  'file-de-franchise-tax/jca1': 'CA minimum franchise tax is a tax payment to the FTB',
  // Texas franchise (margin) tax report to the Comptroller.
  'file-de-franchise-tax/jtx1': 'TX franchise tax report is a tax return to the Comptroller',
}

const isStateCode = (j: unknown) => typeof j === 'string' && (/^US-[A-Z]{2}$/.test(j) || j === 'CA' || j === 'MULTI')

function allParts(parts: Part[]): Part[] {
  return parts.flatMap((part) => [part, ...part.options.flatMap((option) => allParts(option.parts))])
}

const steps = loadProcessCatalog().processes.flatMap(({ slug, record }) =>
  allParts(record.parts).map((part) => ({ key: `${slug}/${part.id}`, part })),
)
const isStateStep = (part: Part) =>
  Array.isArray(part.metadata.jurisdictions) && part.metadata.jurisdictions.some(isStateCode)

describe('process step service field', () => {
  it('uses the vendor-state service set', () => {
    expect(VENDOR_STATE_SERVICES).toBe(STATE_SERVICES)
  })

  it('every state step carries a service or is on the exemption list', () => {
    const stateSteps = steps.filter(({ part }) => isStateStep(part))
    expect(stateSteps.length).toBeGreaterThan(0)
    for (const { key, part } of stateSteps) {
      const service = part.metadata.service
      if (key in EXEMPT) {
        expect(service, `${key} is exempt and carries no service`).toBeUndefined()
      } else {
        expect(service, `${key} needs a service or an exemption`).toBeDefined()
      }
    }
  })

  it('every service value is in the set', () => {
    for (const { key, part } of steps) {
      if (part.metadata.service === undefined) continue
      expect(STATE_SERVICES as readonly unknown[], key).toContain(part.metadata.service)
    }
  })

  it('no service on steps that are not state steps', () => {
    for (const { key, part } of steps) {
      if (!isStateStep(part)) expect(part.metadata.service, key).toBeUndefined()
    }
  })

  it('every exemption names a state step that exists', () => {
    const byKey = new Map(steps.map(({ key, part }) => [key, part]))
    for (const key of Object.keys(EXEMPT)) {
      const part = byKey.get(key)
      expect(part, `${key} exists`).toBeDefined()
      expect(isStateStep(part!), `${key} is a state step`).toBe(true)
    }
  })
})
