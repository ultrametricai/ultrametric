#!/usr/bin/env python3
# Data-warehouses arena bring-up (2026-09): supplements evidence packs with verbatim passages
# from CRAWLED/VERIFIED vendor docs that the LLM extraction passes kept missing — the kitty/
# auth-platforms precedent (append-kitty-docs-evidence.py, append-auth-docs-evidence.py):
# per-source extraction caps starve specific capabilities out of the prompt even though the
# corpus contains them verbatim. Every excerpt below quotes the cited vendor page (checked at
# authoring time, 2026-09-06). Extraction is monotonic and dedups by normalized excerpt, so
# re-running extract after this keeps these items stable. Compliance items were added for every
# product with a verifiable public attestations page (Snowflake, Databricks, BigQuery); no
# public MotherDuck compliance page was found, so it deliberately gets none.
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'snowflake': [
        ('snowflake-supp-sql-window', 'https://docs.snowflake.com/en/sql-reference/functions-window',
         'SQL reference, "Window functions": "Window functions are analytic functions that you can use for various calculations such as running totals, moving averages, and rankings", with dedicated guides "Analyzing data with window functions" and "Window function syntax and usage".'),
        ('snowflake-supp-sql-semistructured', 'https://docs.snowflake.com/en/sql-reference/data-types-semistructured',
         'SQL reference, "Semi-structured data types" (VARIANT/OBJECT/ARRAY) with guides "Introduction to loading semi-structured data", "Querying Semi-structured Data", and "Semi-structured and structured data functions" — JSON and arrays are first-class SQL types.'),
        ('snowflake-supp-compliance', 'https://docs.snowflake.com/en/user-guide/intro-compliance',
         'Docs, "Regulatory compliance": "Snowflake is committed to meeting industry-standard regulatory compliance requirements", with per-certification pages for CSA STAR Level 1, ISO-9001:2015, ISO-27001, ISO-27017, ISO-27018, SOC 1 Type II, SOC 2 Type II, FedRAMP (Moderate and High), and PCI DSS.'),
    ],
    'databricks': [
        ('databricks-supp-compliance', 'https://www.databricks.com/trust/compliance',
         'Databricks Trust Center compliance page ("Ensuring Security, Privacy, & Compliance") documents attestations including a SOC 2 Type II report available to customers, alongside the platform\'s certification portfolio.'),
    ],
    'bigquery': [
        ('bigquery-supp-compliance', 'https://cloud.google.com/security/compliance',
         'Google Cloud compliance resource center lists BigQuery-covered attestations and certifications including ISO 9001:2015, ISO 22301:2019, ISO 50001:2018, SOC 1/2/3, HIPAA support, and sector/regional programs, with downloadable reports per certification.'),
    ],
    'motherduck': [
        ('motherduck-supp-free-plan', 'https://motherduck.com/docs/about-motherduck/billing/pricing/',
         'Pricing docs: "New users who sign up for MotherDuck and create an organization automatically get access to a 7-day Free Trial without entering a credit card"; afterwards "you can continue with the Lite plan (no credit card required)" which includes "10 GB of free storage" and free monthly compute.'),
        ('motherduck-supp-cost-controls', 'https://motherduck.com/docs/about-motherduck/billing/monitoring-usage/',
         'Billing docs, "Monitoring usage and costs": "MotherDuck provides SQL views and a billing dashboard to help you understand your compute and storage consumption... query your usage data, interpret the results in the context of your bill, and identify opportunities to reduce costs"; per-user isolated Ducklings pin each workload to a fixed instance size ("Duckling sizes"), and idle instances shut down automatically (zero idle cost).'),
    ],
}

for pid, items in ITEMS.items():
    path = f'open-rankings/data-warehouses/evidence/{pid}.json'
    ev = json.load(open(path))
    existing = {e['id'] for e in ev}
    for iid, url, excerpt in items:
        if iid in existing:
            print(f'{pid}: {iid} already present, skipping')
            continue
        ev.append({'id': iid, 'tier': 'claimed-docs', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
        print(f'{pid}: appended {iid}')
    with open(path, 'w') as f:
        f.write(json.dumps(ev, indent=2) + '\n')
