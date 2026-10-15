# Vendor reviews

The review layer over the judged rankings, one dated, machine-readable review
record per judged product, plus the place hands-on human reviews land.

The evidence itself lives one directory up in `open-rankings/<arena>/`: each product is examined
through an agentic lens (can an agent drive it, is it testable, do its claims match what
hands-on checks found) and ranked by how automatable it is, with dated evidence packs,
judged verdicts citing evidence ids, and rankings that recompute deterministically with a
tamper-evident fingerprint (`rankings-engine/scripts/recompute-check.ts`). Owner-affiliated
products (Foreloop, AFK, Ultrametric) are disclosed on every surface and bias-audited;
favorable flips without new evidence are reverted (`policies/REVIEW_POLICY.md`). Live
views: every ranking at [ultrametric.ai/arenas](https://ultrametric.ai/arenas), the
cross-market view at [ultrametric.ai/overall](https://ultrametric.ai/overall).

- **`generated/`** — one record per judged product
  (`schemas/vendor-review.schema.json`), emitted deterministically from the committed
  ranking data by `rankings-engine/scripts/generate-vendor-reviews.ts`: dated evidence URIs,
  region availability from `jurisdictions/vendor-geo.json` (negatives included), pricing
  facts, ranking dimensions, and affiliation disclosures. Never hand-edit these; fix the
  underlying data and re-run the generator. Gate:
  `npx vitest run rankings-engine/__tests__/vendorReviews.test.ts` (byte-identical regeneration).
- **This directory** — hands-on human reviews in the same schema (`_blank-example.json` is the
  template in use). Rubric: functional fit, local legal coverage, security and privacy,
  API/export quality, implementation burden, support, total cost, lock-in and portability,
  failure recovery, references, and an exit/export test. Disclose referral payments,
  equity, employment, and partnerships; payment can never change scores or inclusion. A
  vendor's own claims can be recorded but are never test results, and an unreviewed record
  has no ranking.

Contribute here:

- **A hands-on vendor review** — copy `templates/vendor-review.json` into `open-rankings/reviews/`,
  fill the rubric, disclose every affiliation. Gate:
  `npx vitest run __tests__/founder-ops.test.ts`.
- **Evidence for a judged product** — new doc pages, changelogs, or community sources
  belong in `open-rankings/<arena>/` via the engine (see CONTRIBUTING.md); only the cells whose
  evidence changed are re-judged.
