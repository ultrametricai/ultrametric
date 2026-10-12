# Rule cards

Rule cards: dated legal propositions, one per stable ID, each scoped to a jurisdiction and
citing a primary source with an exact locator.

Workflows reference cards by ID, so a statute or agency change traces to every affected
workflow. `reviewed_on` / `review_due` are editorial check dates, not legal effective
dates; unknown `valid_from` / `valid_until` stay null until verified. An ID is never
reused to change a proposition's meaning: version it and note the affected workflows.

How a card is consumed: `lib/founderOps.ts` validates every card against
`schemas/rule.schema.json`, requires its `jurisdiction` to exist in
`jurisdictions/registry.json`, and requires every `source_ids` entry to resolve in
`sources/registry.json` (for `kind: legal`, to a `primary-*` authority). Workflows in
`processes/<domain>/<jurisdiction>/` cite cards in `rule_ids`, e.g.
`equity.us-de.83b-election` cites `us-fed.83b-filing-period`.

A trimmed real card (`rules/US-FED/us-fed-1120-filing-deadline.json`):

```jsonc
{
  "id": "us-fed.1120-filing-deadline",
  "kind": "legal",
  "statement": "A domestic corporation generally must file Form 1120 by the 15th day of the 4th month after the end of its tax year…",
  "source_ids": ["irs-instructions-1120"],
  "jurisdiction": "US-FED",
  "status": "demonstration"
}
```

Contribute here:

- **Cards for a new jurisdiction** — register the jurisdiction first
  (`jurisdictions/registry.json`) with a narrow scope, then add one proposition per stable
  ID, citing primary sources. US rules are never copied into another jurisdiction.
- **Refresh an existing card** — re-verify against the primary source and bump
  `reviewed_on` / `review_due`; if the meaning changed, version the ID instead of editing
  it in place.

Gate: `npx vitest run __tests__/founder-ops.test.ts` (source resolution, jurisdiction
matching, ID stability).
