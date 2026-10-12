#!/usr/bin/env python3
# One-shot helper for the customer-data-platforms arena bring-up (2026-09-08): appends
# claimed-docs evidence for mParticle capabilities the LLM extract pass surfaced only as thin
# nav-fragment excerpts (docs.mparticle.com is a Gatsby site whose giant sidebars dominate the
# per-source extraction budget). Every excerpt below is verbatim-verified on the cited URL on
# 2026-09-08 (thin-crawl-bias fix, same pattern as append-email-docs-evidence.py). Idempotent.
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'segment': [
        {
            'id': 'segment-docs-x1',
            'tier': 'claimed-docs',
            'url': 'https://docs.segmentapis.com',
            'excerpt': "Segment Public API (73.3.0) — Download OpenAPI specification: Download. The Segment Public API helps you manage your Segment Workspaces and its resources. You can use the API to perform CRUD (create, read, update, delete) operations at workspace scope — with an interactive reference including 'Create a test request' and 'Install and use an SDK'.",
            'fetchedAt': NOW,
        },
        {
            'id': 'segment-docs-x2',
            'tier': 'claimed-docs',
            'url': 'https://docs.segmentapis.com',
            'excerpt': "The Public API reference documents Authentication (Scope, Permissions and security, Authenticating requests — Create an API token), Rate Limits (rate limit errors, reducing your call volume), Pagination, and Versioning ('Accessing versions', 'Backwards-incompatible or breaking changes').",
            'fetchedAt': NOW,
        },
    ],
    'mparticle': [
        {
            'id': 'mparticle-docs-x1',
            'tier': 'claimed-docs',
            'url': 'https://docs.mparticle.com/guides/idsync/introduction/',
            'excerpt': "IDSync is mParticle's identity resolution framework, enabling you to create a unified view of your customers, with improved data governance, policy, and security. IDSync gives visibility into, and control over, the management of known and anonymous user identities across apps and platforms.",
            'fetchedAt': NOW,
        },
        {
            'id': 'mparticle-docs-x2',
            'tier': 'claimed-docs',
            'url': 'https://docs.mparticle.com/guides/segmentation/audiences/connect-an-audience/',
            'excerpt': "Once you have created an audience, you must connect it to an audience output where you can activate it. Visit our Integrations page and filter by Audience to view all audience outputs... Navigate to Data Platform > Setup > Directory, and click the card for your audience partner of choice.",
            'fetchedAt': NOW,
        },
        {
            'id': 'mparticle-docs-x3',
            'tier': 'claimed-docs',
            'url': 'https://docs.mparticle.com/guides/data-privacy-controls/',
            'excerpt': "Manage your consent and opt-out privacy obligations under the GDPR and CCPA with Data Privacy Controls... Consent state powers both GDPR consent and CCPA data sale opt-out... Applying a forwarding rule of: Do not forward if CCPA Data sale opt out is present.",
            'fetchedAt': NOW,
        },
        {
            'id': 'mparticle-docs-x4',
            'tier': 'claimed-docs',
            'url': 'https://docs.mparticle.com/guides/data-warehouse-sync/setup/',
            'excerpt': "Warehouse Sync ingests data from your own warehouse into mParticle — documented setup flows cover Snowflake, Amazon Redshift, Google BigQuery, and Databricks ('Warehouse Sync uses the Databricks-to-Databricks Delta Sharing protocol to ingest data from Databricks into mParticle'), with a Warehouse Sync API, SQL reference, and data mapping.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'rankings/customer-data-platforms/evidence/{pid}.json'
    ev = json.load(open(path))
    existing = {e['id'] for e in ev}
    for item in items:
        if item['id'] in existing:
            print(f'{pid}: {item["id"]} already present, skipping')
            continue
        ev.append(item)
        print(f'{pid}: appended {item["id"]}')
    with open(path, 'w') as f:
        f.write(json.dumps(ev, indent=2) + '\n')
