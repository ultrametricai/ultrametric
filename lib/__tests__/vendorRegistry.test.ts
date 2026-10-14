import { describe, expect, it } from 'vitest'
import {
  loadVendorRegistry, VENDOR_ARENA, VENDOR_SIGNUP_URL, vendorLabel, vendorProductId,
} from '@/lib/processes'

// SSOT pins for the vendor-fact migration (founder audit 2026-09-30: "verify everything rendered
// on /processes is driven from the open repo corpus"): the four in-code vendor tables
// (VENDOR_ARENA, VENDOR_LABELS, VENDOR_PRODUCT_ID, VENDOR_SIGNUP_URL) moved verbatim into
// open-processes/vendor-registry.json, and lib/processes.ts now READS THEM BACK. These tests pin
// that the exports are pure projections of the registry (no residual in-code vendor facts), the
// spot values the migration moved, and the honesty contract for deliberately-unlinked vendors.

describe('the registry is the single source (exports are pure projections)', () => {
  const registry = loadVendorRegistry()
  const projected = (field: 'arenaId' | 'signupUrl') =>
    Object.fromEntries(
      Object.entries(registry).flatMap(([k, e]) => (e[field] ? [[k, e[field]]] : [])),
    )

  it('VENDOR_ARENA and VENDOR_SIGNUP_URL are exactly the registry projections', () => {
    expect(VENDOR_ARENA).toEqual(projected('arenaId'))
    expect(VENDOR_SIGNUP_URL).toEqual(projected('signupUrl'))
  })

  it('vendorLabel and vendorProductId read the registry, with the historic fallbacks', () => {
    for (const [key, entry] of Object.entries(registry)) {
      if (entry.label) expect(vendorLabel(key)).toBe(entry.label)
      expect(vendorProductId(key)).toBe(entry.productId ?? key.replace(/_/g, '-'))
    }
    // The fallbacks themselves: title-case for labels, kebab-case for product ids.
    expect(vendorLabel('stripe_atlas')).toBe('Stripe Atlas')
    expect(vendorProductId('stripe_atlas')).toBe('stripe-atlas')
  })

  it('every entry carries at least one fact — no empty registry rows', () => {
    for (const [key, entry] of Object.entries(registry)) {
      expect(
        Boolean(entry.label || entry.arenaId || entry.productId || entry.signupUrl),
        `empty registry entry: ${key}`,
      ).toBe(true)
    }
  })
})

describe('spot pins — the exact facts the migration moved (never re-judged, never re-typed)', () => {
  it('arena mappings', () => {
    expect(VENDOR_ARENA.gusto).toBe('payroll')
    expect(VENDOR_ARENA.stripe_atlas).toBe('legal-ops')
    expect(VENDOR_ARENA.cloudflare_registrar).toBe('domain-registrars')
    expect(VENDOR_ARENA.intercom).toBe('ai-support-agents')
  })

  it('labels where title-casing misfires, incl. the affiliation disclosure', () => {
    expect(vendorLabel('github')).toBe('GitHub')
    expect(vendorLabel('northwest')).toBe('Northwest Registered Agent')
    expect(vendorLabel('microsoft_entra')).toBe('Microsoft Entra ID')
    // Our own surface stays disclosed as ours — the honest-affiliation posture.
    expect(vendorLabel('productarena')).toBe('Ultrametric (ours)')
  })

  it('the one product-id override: Intercom resolves to its judged Fin product', () => {
    expect(vendorProductId('intercom')).toBe('intercom-fin')
  })

  it('signup URLs are https and the known ones round-tripped', () => {
    expect(VENDOR_SIGNUP_URL.stripe_atlas).toBe('https://stripe.com/atlas')
    expect(VENDOR_SIGNUP_URL.gusto).toBe('https://gusto.com/')
    for (const [key, url] of Object.entries(VENDOR_SIGNUP_URL)) {
      expect(url.startsWith('https://'), `non-https signup URL: ${key}`).toBe(true)
    }
  })
})

describe('honesty: deliberately-unlinked vendors carry the reason as data, not a code comment', () => {
  it('northwest and oracle_cloud have no signupUrl and say why (403 to non-browser clients)', () => {
    const registry = loadVendorRegistry()
    for (const key of ['northwest', 'oracle_cloud'] as const) {
      expect(registry[key].signupUrl).toBeUndefined()
      expect(registry[key].note).toMatch(/403/)
      expect(registry[key].note).toMatch(/no unverifiable URL is fabricated/)
    }
  })
})
