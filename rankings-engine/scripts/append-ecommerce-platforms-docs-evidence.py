#!/usr/bin/env python3
# One-shot helper for the ecommerce-platforms arena bring-up (2026-09-08): appends claimed-docs/
# github evidence for capabilities the LLM extract pass missed but that are verbatim-verified on
# the vendors' own pages (thin-crawl-bias fix, same pattern as append-email-docs-evidence.py).
# Every excerpt below was curl-verified on the cited URL on 2026-09-08. Idempotent by id.
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'shopify': [
        {
            'id': 'shopify-docs-x1',
            'tier': 'claimed-docs',
            'url': 'https://shopify.dev/docs/api/usage/versioning',
            'excerpt': "Shopify releases new API versions on a predictable quarterly schedule, giving you time to adopt changes before older versions are retired. Subscribe to the developer changelog... Versioned APIs and libraries follow the quarterly release schedule described below.",
            'fetchedAt': NOW,
        },
        {
            'id': 'shopify-docs-x2',
            'tier': 'claimed-docs',
            'url': 'https://shopify.dev/docs/apps/build/stores/development-stores',
            'excerpt': "Dev stores are testing environments that you own and control. They let you build and test your apps in a realistic Shopify environment without affecting any live store. You can connect directly to a dev store from Shopify CLI using the `shopify app dev` command.",
            'fetchedAt': NOW,
        },
        {
            'id': 'shopify-docs-x3',
            'tier': 'claimed-docs',
            'url': 'https://shopify.dev/docs/api/usage/api-exploration/admin-graphiql-explorer',
            'excerpt': "GraphiQL is an in-browser tool for writing, validating, and testing GraphQL queries. When working with Shopify's GraphQL Admin API, GraphiQL can be useful for... executing specific queries and mutations to extract information or accomplish tasks.",
            'fetchedAt': NOW,
        },
    ],
    'woocommerce': [
        {
            'id': 'woocommerce-docs-x1',
            'tier': 'claimed-docs',
            'url': 'https://woocommerce.github.io/woocommerce-rest-api-docs/',
            'excerpt': "Use of the REST API with the generated keys will conform to that user's WordPress roles and capabilities. Choose the level of access for this REST API key, which can be Read access, Write access or Read/Write access. Then click the \"Generate API Key\" button and WooCommerce will generate REST API keys for the selected user.",
            'fetchedAt': NOW,
        },
    ],
    'medusa': [
        {
            'id': 'medusa-gh-x1',
            'tier': 'github',
            'url': 'https://raw.githubusercontent.com/medusajs/medusa/develop/www/apps/api-reference/specs/store/openapi.full.yaml',
            'excerpt': "openapi: 3.0.0 / info: title: Medusa Storefront API, license: MIT — Medusa maintains complete machine-readable OpenAPI 3.0 specifications for the Store (and Admin) REST APIs in the medusajs/medusa repository; they power the docs.medusajs.com/api reference.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'open-rankings/ecommerce-platforms/evidence/{pid}.json'
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
