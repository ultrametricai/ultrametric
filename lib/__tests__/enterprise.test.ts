import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ProductSchema } from '@/lib/schemas'

// Curation integrity for the display-only enterprise-motion flag (lib/schemas.ts): a product
// may only carry `enterprise: true` together with an `enterpriseSource` URL citing the vendor
// page that shows the sales-led motion (no self-serve signup, pricing by sales contact — see
// components/EnterpriseBadge.tsx). Reads the raw open-rankings/*/products.json files so the assertion
// covers exactly what is committed, not what a loader may have normalized.

const dataDir = path.join(process.cwd(), 'open-rankings')
const arenas = fs
  .readdirSync(dataDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(dataDir, d.name, 'products.json')))
  .map((d) => d.name)

describe('enterprise flag curation', () => {
  it('every product (including stamped ones) parses via ProductSchema', () => {
    for (const arena of arenas) {
      const raw = JSON.parse(fs.readFileSync(path.join(dataDir, arena, 'products.json'), 'utf8'))
      for (const product of raw) {
        const parsed = ProductSchema.safeParse(product)
        expect(parsed.success, `${arena}/${product?.id}: ${parsed.error?.message ?? ''}`).toBe(true)
      }
    }
  })

  it('every enterprise: true product cites an enterpriseSource URL', () => {
    let flagged = 0
    for (const arena of arenas) {
      const raw = JSON.parse(fs.readFileSync(path.join(dataDir, arena, 'products.json'), 'utf8'))
      for (const product of raw) {
        if (product.enterprise === true) {
          flagged++
          expect(
            typeof product.enterpriseSource,
            `${arena}/${product.id} is enterprise-flagged without an enterpriseSource`,
          ).toBe('string')
          expect(() => new URL(product.enterpriseSource), `${arena}/${product.id} enterpriseSource must be a URL`).not.toThrow()
        }
        // The flag is strictly boolean-true-or-absent: never false/other noise in the data.
        expect(
          product.enterprise === undefined || product.enterprise === true,
          `${arena}/${product.id} has a non-true enterprise value`,
        ).toBe(true)
        // A source without the flag is a stale leftover.
        if (product.enterpriseSource !== undefined) {
          expect(product.enterprise, `${arena}/${product.id} has enterpriseSource without enterprise: true`).toBe(true)
        }
      }
    }
    // The curation pass stamped real vendors — guard against the flag silently vanishing.
    expect(flagged).toBeGreaterThan(0)
  })
})
