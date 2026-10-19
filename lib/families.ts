import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

// Product families (open-rankings/product-families.json): one entry per multi-product vendor whose
// lines are genuinely separate experiences (Stripe → Payments/Terminal/Billing/Atlas…,
// Mercury → banking/cards/invoicing, Block → Square/Cash App). A family is a DISPLAY-ONLY
// breakdown rendered at /family/[id]: it never feeds lib/scoring.ts, and a sub-product judged
// into an arena competes there on the same stories as everyone else — the family page just
// aggregates the deep links.
//
// Two kinds of sub-product line:
//   - arenaRef set → the line is judged as its own product in that arena (Stripe Terminal in
//     mobile-payments); the family page pulls its live rank/Overall score from that arena's
//     rankings and deep-links to the product page and its battles.
//   - arenaRef null → breakdown-page-only: no existing arena genuinely fits the line as a
//     competitor. Rendered as an honest "not yet judged" state; the optional `note` says why
//     (no fitting arena, or the capability is already scored inside the parent's own entry).
//
// The optional Product.familyId field (lib/schemas.ts) is a denormalized back-reference from
// products.json onto these entries; lib/__tests__/families.test.ts keeps both directions in
// sync and every arenaRef pointing at a real judged product.

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/

export const FamilyProductRefSchema = z.object({
  arenaId: z.string().min(1),
  productId: z.string().min(1),
})

export const FamilySubProductSchema = z.object({
  id: z.string().regex(KEBAB, 'sub-product id must be kebab-case'),
  name: z.string().min(1),
  // One honest line on what the product does — vendor-neutral wording, no scores in here.
  blurb: z.string().min(1).max(300),
  docsUrl: z.string().url(),
  arenaRef: FamilyProductRefSchema.nullable(),
  // For arenaRef: null lines — WHY it isn't judged (no fitting arena / covered inside the
  // parent's entry). Rendered verbatim in the "not yet judged" state.
  note: z.string().min(1).max(300).optional(),
  // Set when the line joined the family by acquisition rather than organically (e.g. Clerky →
  // Stripe). Rendered as a distinct chip so an acquired product that still competes against a
  // sibling (Clerky vs Atlas, same arena) reads as history, not as a contradiction.
  acquired: z.string().min(1).max(160).optional(),
})

export const FamilySchema = z.object({
  id: z.string().regex(KEBAB, 'family id must be kebab-case'),
  name: z.string().min(1),
  vendor: z.string().min(1),
  tagline: z.string().min(1).max(300),
  // The flagship judged product the family hangs off — its product page links here.
  parent: FamilyProductRefSchema,
  subProducts: z.array(FamilySubProductSchema).min(2),
}).superRefine((family, ctx) => {
  const seen = new Set<string>()
  for (const sub of family.subProducts) {
    if (seen.has(sub.id)) ctx.addIssue({ code: 'custom', message: `duplicate sub-product id ${sub.id} in family ${family.id}` })
    seen.add(sub.id)
  }
})

export const FamiliesSchema = z.array(FamilySchema).min(1).superRefine((families, ctx) => {
  const seen = new Set<string>()
  for (const f of families) {
    if (seen.has(f.id)) ctx.addIssue({ code: 'custom', message: `duplicate family id ${f.id}` })
    seen.add(f.id)
  }
})

export type Family = z.infer<typeof FamilySchema>
export type FamilySubProduct = z.infer<typeof FamilySubProductSchema>
export type FamilyProductRef = z.infer<typeof FamilyProductRefSchema>

export function loadFamilies(dataDir = path.join(process.cwd(), 'open-rankings')): Family[] {
  const raw = JSON.parse(fs.readFileSync(path.join(dataDir, 'product-families.json'), 'utf8'))
  return FamiliesSchema.parse(raw)
}

// The family a judged product belongs to — via the parent ref or any sub-product's arenaRef.
// Null for the (vast) majority of products that aren't part of any family.
export function familyForProduct(families: Family[], arenaId: string, productId: string): Family | null {
  for (const family of families) {
    if (family.parent.arenaId === arenaId && family.parent.productId === productId) return family
    for (const sub of family.subProducts) {
      if (sub.arenaRef && sub.arenaRef.arenaId === arenaId && sub.arenaRef.productId === productId) return family
    }
  }
  return null
}
