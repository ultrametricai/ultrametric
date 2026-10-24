# Open law

Map the law that applies to startups: each rule states one legal proposition under a
stable ID, scoped to a jurisdiction and citing a primary source with the exact section.
The domain map (`map.json`) and the distilled startup laws (`LAWS.md`) live here too.

Workflows reference rules by ID, so a statute or agency change traces to every affected
workflow. `reviewed_on` / `review_due` are editorial check dates, not legal effective
dates; unknown `valid_from` / `valid_until` stay null until verified. An ID is never
reused to change a rule's meaning: version it and note the affected workflows.

How a rule is consumed: `lib/founderOps.ts` validates every rule against its in-code
contract (`RuleCardSchema`), requires its `jurisdiction` to exist in
`jurisdictions/registry.json`, and requires every `source_ids` entry to resolve to a
citation in `citations/registry.json` here (for `kind: legal`, to a `primary-*`
authority). Workflows in
`open-processes/<domain>/<jurisdiction>/` cite rules in `rule_ids`, e.g.
`equity.us-de.83b-election` cites `us-fed.83b-filing-period`.

## The map

`map.json` is the domain map over the rules: each domain's sub-areas, the rules covering
each sub-area, the workflow and corpus processes the sub-area governs, an editorial
maturity grade, and the stated gaps. Grades mean: `mapped` (the recurring rules a startup
hits are committed), `partial` (some are; the gaps field lists what is missing),
`unmapped` (no rules yet; the gaps field lists the rules a startup hits first).
`lib/founderOps.ts` enforces that every rule appears in the map, every reference
resolves, and the grades agree with the rules present; the table below mirrors `map.json`
and a test holds the two together.

| Domain | Covers | Maturity |
| --- | --- | --- |
| Formation and corporate governance | Incorporation mechanics and charter contents (Delaware, the UK, New Zealand, and Singapore), board and stockholder action, stock issuance authority, ongoing registrations and reports, and beneficial-ownership reporting. | partial |
| Securities and fundraising | The Securities Act registration requirement and private-offering exemptions, Regulation D conditions, offering notices (Form D and blue sky), and compensatory-issuance exemptions. | partial |
| Equity and compensation | 409A valuation presumptions and penalties, 83(b) elections and restricted stock, ISO and NSO tax treatment, QSBS, and the UK EMI notification deadline and company qualifying limits. | partial |
| Employment | Hiring and onboarding duties, federal wage and hour baselines, worker classification, restrictive covenants, terminations and layoffs, workplace safety, and benefits. | partial |
| Tax | Corporate income tax and R&D rules, payroll taxes, state entity-level taxes, and sales tax, VAT and GST. | partial |
| Intellectual property | Ownership and assignment of founder, employee, and contractor work product; patents; trademarks; trade secrets; and open source. | partial |
| Contracts and commercial | Electronic contracting, marketing communications, customer contracts, and dispute deadlines. | partial |
| Privacy and data protection | US state privacy statutes, federal sectoral privacy law, EU data protection, New Zealand privacy, and Singapore data protection (PDPA). | partial |
| Immigration | Founder immigration paths and employment-based work visas. | partial |
| Dissolution and distress | Voluntary dissolution and wind-down, and insolvency paths. | partial |

A trimmed real rule (`open-law/US-FED/us-fed-1120-filing-deadline.json`) reads:

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

- **Rules for a new jurisdiction** — register the jurisdiction first
  (`jurisdictions/registry.json`) with a narrow scope, then add one rule per stable
  ID, citing primary sources. US rules are never copied into another jurisdiction.
- **Place every new rule in `map.json`** — add its ID to the covering sub-area (the
  validator fails an unplaced rule) and restate that sub-area's grade and gaps.
- **Refresh an existing rule** — re-verify against the primary source and bump
  `reviewed_on` / `review_due`; if the meaning changed, version the ID instead of editing
  it in place.

Gate: `pnpm test __tests__/founder-ops.test.ts` (source resolution, jurisdiction
matching, ID stability).

## By jurisdiction

The rules live in one directory per jurisdiction, named by the `jurisdiction` codes in
`jurisdictions/registry.json`.

| Jurisdiction | The rules cover |
| --- | --- |
| [US-FED](US-FED/) | 83(b) elections, 409A presumptions and penalties, ISO/AMT and QSBS treatment, securities exemptions and Form D, corporate and payroll filing deadlines, FLSA baselines, I-9 timing, contractor IP assignment, CAN-SPAM, e-signature validity, beneficial-ownership reporting, founder parole |
| [US-DE](US-DE/) | Incorporation mechanics and certificate contents, board and stockholder written consent, stock and option authorization, both franchise-tax methods, dissolution and post-dissolution continuation |
| [US-CA](US-CA/) | CCPA business thresholds, final-wages timing, foreign qualification, the Statement of Information, invention-assignment limits, the noncompete void rule, the minimum franchise tax |
| [US-NV](US-NV/) | The annual list and business license, the commerce-tax threshold |
| [US-NY](US-NY/) | The wage notice at hire |
| [US-TX](US-TX/) | Foreign registration, the franchise-tax report |
| [US-WA](US-WA/) | The noncompete earnings threshold |
| [US-VA](US-VA/) | The Consumer Data Protection Act applicability thresholds |
| [US-CO](US-CO/) | The Colorado Privacy Act applicability thresholds |
| [EU](EU/) | The GDPR data-subject-access response deadline |
| [UK](UK/) | Company registration and the certificate of incorporation, the confirmation statement, allotment returns, accounts filing periods, PSC information notices, corporation tax notice and PAYE registration deadlines, the VAT registration threshold, the written statement of particulars, EMI notification and company qualifying limits |
| [NZ](NZ/) | Company incorporation and the resident-director requirement, the annual return, the company tax rate, the GST registration threshold, employer registration, KiwiSaver auto-enrolment and employer contributions, the written employment agreement and trial periods, the annual-holidays minimum, privacy-breach notification |
| [SG](SG/) | Company registration and the private-company definition, the model constitution, allotment and share-transfer returns, AGM and annual-return deadlines, the registered office, resident director and company secretary requirements, the corporate tax rate and start-up exemption, the GST registration threshold, CPF employer contributions, Employment Act coverage, the Employment Pass qualifying salary, the PDPA breach-notification duty |
| [KR](KR/) | Stock-company incorporation registration and articles contents, the absence of a minimum capital, the representative director, the two-week registry change deadline, corporate tax return deadline and rates, VAT registration and return deadlines, the social-insurance establishment report, written terms of employment, the severance-pay floor, PIPA breach notification, foreign-investment thresholds. Korean originals on law.go.kr are the primary locators, with the KLRI English translation attached where verified |
| [EE](EE/) | Private limited company (osaühing) registration through the e-Business Register, the absence of a minimum capital, the contact-person requirement for companies with a foreign address, the six-month annual-report deadline, the distributed-profits income tax, the VAT registration threshold, the written employment contract, employment-register entry before work starts, social tax and unemployment-insurance premiums, the e-residency digital identity, the Personal Data Protection Act national layer beside the EU rules. Estonian originals on riigiteataja.ee are the primary locators, with the state-published Riigi Teataja English translation attached (without legal force; its consolidation coverage is dated per citation) |

## Founder-journey workflow files

The founder-journey taxonomy and the jurisdiction-scoped workflow coverage live here,
beside the law layer that grades them. `workflow-domains.json` names the lifecycle
domains from formation through exit, each with its topics, including domains with no
playbook yet. `workflow-coverage.json` records which jurisdiction-scoped workflows
exist, for which entity and tax jurisdictions, at what maturity, with dated reviews,
stated limits, and the uncovered scenarios listed in the same file. `lib/founderOps.ts`
checks both in CI: every workflow in `open-processes/<domain>/<jurisdiction>/` must
carry a coverage entry, every entry must resolve to a committed workflow, and `reviewed`
status is accepted only when the workflow itself is reviewed. A new workflow lands with
its maturity grade recorded in `workflow-coverage.json`; no jurisdiction is called
covered because a few playbooks exist (`policies/REVIEW_POLICY.md`).

## The 83(b) rule, followed through the repo

The map's cross-links are navigable in both directions; one worked chain: the distilled
law states the thirty-day election window
([LAWS.md, Formation and housekeeping](LAWS.md#formation-and-housekeeping)). Its rule
[`us-fed.83b-filing-period`](US-FED/us-fed-83b-filing-period.json) pins the statute and
IRS procedure. The Incorporate C-Corp process signs and files the election as explicit
steps, and the jurisdiction-scoped workflow
[`equity.us-de.83b-election`](../open-processes/equity/us-de/83b-election.json) runs it
with a named human approval on the filing. The
[83(b) election math module](../open-modules/README.md#83b-election-math) computes
tax-at-grant against tax-at-vesting and replays the Rev. Proc. 2012-29 examples in tests.

## Citations

`citations/registry.json` holds the authorities the rules cite: each entry is a
dated record validated against `schemas/citation.schema.json` with publisher, the exact
section (`locator`), `issued_on` where known, `checked_on`, jurisdiction, and an HTTPS
link. A legal rule may only cite `primary-*` authorities; provider blogs can explain
practice but cannot establish law (`kind: secondary-practice`). A non-English primary
source marks its language (`lang`, e.g. `ko` for the Korean originals on law.go.kr, `et`
for the Estonian originals on riigiteataja.ee) and
may attach an official-translation pointer (`translation`, e.g. the KLRI English
translation, or Riigi Teataja's own state-published English translations); the original
stays the authoritative locator. The reading canon the
distilled laws cite lives in `open-lore/` (`library.json` and `citations.json`), not here.

Contribute citations here:

- **Primary authorities for new rules** — add entries alongside the
  `open-law/<CODE>/*.json` rules that cite them.
- **Re-verification passes** — follow an existing link, confirm the provision still says
  what the citing record claims, and bump `checked_on` (note it if it moved).

URL liveness is a human editorial check recorded via `checked_on`; the suites stay
offline.

## LAWS.md

`LAWS.md` distills the reading canon into recurring, near-universal startup principles
grouped by lifecycle stage: [idea and validation](LAWS.md#idea-and-validation),
[formation and housekeeping](LAWS.md#formation-and-housekeeping),
[product and first users](LAWS.md#product-and-first-users),
[fundraising and equity](LAWS.md#fundraising-and-equity),
[growth, people and spending](LAWS.md#growth-people-and-spending), and
[survival and the long game](LAWS.md#survival-and-the-long-game).
Every law cites its sources by id (the authorities in
`citations/registry.json` here and the reading canon in `open-lore/library.json` and
`open-lore/citations.json`), aphorisms are attributed to their actual origin, and the
only literal laws (filing deadlines) also carry rules here. Gate:
`pnpm test __tests__/laws.test.ts` (grammar, numbering, and citation resolution via
`lib/laws.ts`).

This area's maturity grade and known gaps are tracked in [`coverage/index.json`](../coverage/index.json).
