# Jurisdictions

This directory holds the registry of countries and states the workflow layer knows
about, plus the dated, source-cited record of which vendors work where.

`registry.json` lists each jurisdiction with an explicit, narrow scope statement.
Jurisdiction is multidimensional (entity formation, federal tax, work site, hiring,
customer market, tax residency) and the matcher (`lib/founderOps.ts` `planFounderOps`)
uses exact dimensions only: an unknown combination is `unsupported`, never inherited from
a neighbor. A real record:

```json
{
  "code": "US-DE",
  "name": "Delaware, United States",
  "level": "state",
  "parent": "US-FED",
  "scope": "Only specified Delaware corporation equity approval provisions",
  "coverage": "partial-example"
}
```

`coverage` grades what the registry claims for a jurisdiction: each committed entry
carries `partial-example`, meaning the sourced records cover only the stated scope and are
worked examples without independent expert sign-off (`policies/REVIEW_POLICY.md`).

`vendor-geo.json` holds one dated, source-cited row per (product, country) for the
geo-sensitive rankings: loader `lib/vendorGeo.ts`, rendered as "Geos supported" on product
pages. Evidence only, deliberately not a score:

```json
{ "productId": "xero", "arenaId": "accounting", "country": "US", "status": "available",
  "sourceUrl": "https://www.xero.com/us/", "note": "Dedicated US edition.", "checkedAt": "2026-09-28" }
```

Contribute here:

- **Vendor availability in your country** — add `vendor-geo.json` rows
  (`{productId, country, status, sourceUrl, note}`); the source must be the vendor's own
  page or an official register, and negatives ("US entities only") are as valuable as
  positives. Gate: `pnpm test lib/__tests__/vendorGeo.test.ts`.
- **Register a new jurisdiction** — add it with a narrow scope statement before
  contributing law rules or workflows for it; a scope is never widened to make a match
  work. Gate: `pnpm test __tests__/founder-ops.test.ts`.

This area's maturity grade and known gaps are tracked in [`coverage/index.json`](../coverage/index.json).
