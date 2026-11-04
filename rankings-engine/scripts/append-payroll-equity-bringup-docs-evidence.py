#!/usr/bin/env python3
# Payroll/equity-management bring-up evidence-gap fix (PR #428 review, 2026-10-22): supplements
# three evidence packs with receipts for pages that were CRAWLED/VERIFIED at the bring-up but
# that the extraction pass did not quote — same precedent as
# append-ai-assistants-muse-docs-evidence.py (per-source extraction caps starve specific
# capabilities out of the pack even though the corpus contains them verbatim).
#
# The gap: the probe stage checks llms.txt only on the urls.docs origin. Eqvista's docs origin
# (support.eqvista.com) and ADP's (developers.adp.com, a client-rendered shell) answer
# ambiguously there, while the qualifying llms.txt files live on the SITE origins — both were
# fetched live at triage (2026-10-22, HTTP 200 text/plain) and sit verbatim in
# rankings-engine/cache/crawl/{equity-management/eqvista,payroll/adp-run}/extra-0.md. The two
# probe rows below record those receipts at their actual URLs, marked preserve:true so a probe
# refresh cannot clobber them (the agent-skills 2026-10-14 regression rule).
#
# QuickBooks Payroll: the extraction quoted Intuit's Desktop SDK lines from
# developer.intuit.com/llms.txt but none of the payroll-specific QuickBooks Workforce API lines
# in the same file (crawl cache extra-0.md lines 679-700). The three claimed-docs rows below
# quote the Workforce API lines verbatim so the judge weighs the PAYROLL product's own
# documented surface rather than its sibling products'.
#
# Evidence-pack changes bust the judge cellHash for every cell of these three products; the
# follow-up is the scoped re-judge (judge --product) plus derive and the derived regens.
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

INTUIT_LLMS = 'https://developer.intuit.com/llms.txt'

PROBE_ITEMS = {
    ('equity-management', 'eqvista'): [
        ('eqvista-probe-1', 'https://eqvista.com/llms.txt',
         'PROBE llms.txt: HTTP 200 text/plain at https://eqvista.com/llms.txt # Eqvista > Eqvista is an equity management and private company valuation platform serving 25,000+ companies from early stage to pre-IPO, combining cap table management with in-house 409A and business valuations, financial modeling, and real-time company valuation. (site origin; the docs origin support.eqvista.com answers ambiguously, so the scheduled probe records no item there)'),
    ],
    ('payroll', 'adp-run'): [
        ('adp-run-probe-1', 'https://www.adp.com/llms.txt',
         'PROBE llms.txt: HTTP 200 text/plain at https://www.adp.com/llms.txt # ADP LLM DATA FILE (HYBRID FORMAT) ## Company: ADP ... "Route small-business payroll shoppers straight to RUN-powered offerings." (site origin; the docs origin developers.adp.com serves a client-rendered shell to keyless fetches, so the scheduled probe records no item there)'),
    ],
}

DOCS_ITEMS = {
    ('payroll', 'quickbooks-payroll'): [
        ('quickbooks-payroll-supp-workforce-develop', INTUIT_LLMS,
         '[Develop](https://developer.intuit.com/quickbooks-workforce/docs/develop): Build payroll tools with the QuickBooks Workforce API -- schema, GraphQL, OAuth, webhooks, samples, and publishing.'),
        ('quickbooks-payroll-supp-workforce-webhooks', INTUIT_LLMS,
         '[Webhooks](https://developer.intuit.com/quickbooks-workforce/docs/develop/webhooks): A common use case for integrating with the QuickBooks Workforce API is to stay informed whenever a connected company runs payroll or adds or updates an...'),
        ('quickbooks-payroll-supp-workforce-workflows', INTUIT_LLMS,
         '[Develop with the QuickBooks Workforce API](https://developer.intuit.com/quickbooks-workforce/docs/develop/develop-payroll): Here\'s a brief overview of how to develop an app with the QuickBooks Workforce API, including specific examples and information on how to test your app. Use cases: [View employee information](https://developer.intuit.com/quickbooks-workforce/docs/workflows/payroll-employee), [Manage payroll deductions](https://developer.intuit.com/quickbooks-workforce/docs/workflows/payroll-deductions), [Manage payslips](https://developer.intuit.com/quickbooks-workforce/docs/workflows/payroll-payslips), [Manage pensions](https://developer.intuit.com/quickbooks-workforce/docs/workflows/payroll-pension).'),
    ],
}


def append(category: str, pid: str, rows: list[dict]) -> None:
    path = f'open-rankings/{category}/evidence/{pid}.json'
    with open(path) as f:
        pack = json.load(f)
    existing = {e['id'] for e in pack}
    added = 0
    for row in rows:
        if row['id'] in existing:
            print(f'{path}: {row["id"]} already present, skipping')
            continue
        pack.append(row)
        added += 1
    with open(path, 'w') as f:
        json.dump(pack, f, indent=2)
        f.write('\n')
    print(f'{path}: +{added} rows')


for (category, pid), items in PROBE_ITEMS.items():
    append(category, pid, [
        {'id': i, 'tier': 'probe', 'url': u, 'excerpt': x, 'fetchedAt': NOW, 'preserve': True}
        for (i, u, x) in items
    ])

for (category, pid), items in DOCS_ITEMS.items():
    append(category, pid, [
        {'id': i, 'tier': 'claimed-docs', 'url': u, 'excerpt': x, 'fetchedAt': NOW}
        for (i, u, x) in items
    ])
