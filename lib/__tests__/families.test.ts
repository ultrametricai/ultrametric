import { describe, expect, it } from 'vitest'
import { loadAll } from '@/lib/data'
import { familyForProduct, loadFamilies } from '@/lib/families'

// open-rankings/product-families.json integrity: every judged ref resolves to a real product in a
// populated arena, and the denormalized Product.familyId back-references (lib/schemas.ts) stay
// in sync with the family structure in BOTH directions — see lib/families.ts's module doc.

describe('product families', () => {
  const families = loadFamilies()
  const categories = loadAll()
  const productsByArena = new Map(categories.map((d) => [d.category.id, new Set(d.products.map((p) => p.id))]))

  it('parses with unique family and sub-product ids', () => {
    expect(families.length).toBeGreaterThan(0)
  })

  it('every parent and arenaRef points at a real product in a populated arena', () => {
    for (const family of families) {
      const refs = [family.parent, ...family.subProducts.flatMap((s) => (s.arenaRef ? [s.arenaRef] : []))]
      for (const ref of refs) {
        const ids = productsByArena.get(ref.arenaId)
        expect(ids, `family ${family.id}: unknown or unpopulated arena ${ref.arenaId}`).toBeDefined()
        expect(
          ids!.has(ref.productId),
          `family ${family.id}: ${ref.arenaId} has no product ${ref.productId}`,
        ).toBe(true)
      }
    }
  })

  it('the parent appears among the sub-product arenaRefs (the flagship line is a card too)', () => {
    for (const family of families) {
      const hasParentCard = family.subProducts.some(
        (s) => s.arenaRef?.arenaId === family.parent.arenaId && s.arenaRef?.productId === family.parent.productId,
      )
      expect(hasParentCard, `family ${family.id}: parent ref missing from subProducts`).toBe(true)
    }
  })

  it('page-only lines carry an honest note explaining why they are not judged', () => {
    for (const family of families) {
      for (const sub of family.subProducts) {
        if (sub.arenaRef === null) {
          expect(sub.note, `family ${family.id}/${sub.id}: page-only line needs a note`).toBeDefined()
        }
      }
    }
  })

  it('familyId back-references match the family structure in both directions', () => {
    // Forward: every judged member's product carries familyId === family.id.
    for (const family of families) {
      for (const sub of family.subProducts) {
        if (!sub.arenaRef) continue
        const data = categories.find((d) => d.category.id === sub.arenaRef!.arenaId)!
        const product = data.products.find((p) => p.id === sub.arenaRef!.productId)!
        expect(
          product.familyId,
          `product ${sub.arenaRef.arenaId}/${sub.arenaRef.productId} should carry familyId "${family.id}"`,
        ).toBe(family.id)
      }
    }
    // Reverse: every product stamped with a familyId is actually a member of that family.
    for (const data of categories) {
      for (const product of data.products) {
        if (!product.familyId) continue
        const family = familyForProduct(families, data.category.id, product.id)
        expect(
          family?.id,
          `product ${data.category.id}/${product.id} stamped familyId "${product.familyId}" but familyForProduct disagrees`,
        ).toBe(product.familyId)
      }
    }
  })

  it('familyForProduct resolves parents and members, and misses for strangers', () => {
    const stripe = familyForProduct(families, 'payments', 'stripe')
    expect(stripe?.id).toBe('stripe')
    expect(familyForProduct(families, 'legal-ops', 'stripe-atlas')?.id).toBe('stripe')
    // paypal gained a family in the payments fairness wave — autumn is the family-less control.
    expect(familyForProduct(families, 'payments', 'paypal')?.id).toBe('paypal')
    expect(familyForProduct(families, 'payments', 'autumn')).toBeNull()
  })
})
