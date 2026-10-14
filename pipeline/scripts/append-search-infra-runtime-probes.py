#!/usr/bin/env python3
# One-shot helper for the search-infra arena bring-up (2026-09-06): appends probe-tier evidence
# items distilled from the recorded runtime probes in open-rankings/search-infra/proofs/ (see
# pipeline/probes/search-infra.ts — all 10 recorded probes passed).
# Run AFTER `pnpm pipeline probe --category search-infra` — that stage wholesale-replaces
# probe-tier evidence and would wipe these items (re-run this script after any probe refresh).
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'algolia': [
        {
            'id': 'algolia-probe-rt-1',
            'tier': 'probe',
            'url': 'https://www.algolia.com/doc/tools/cli/get-started',
            'excerpt': "PROBE runtime (recorded 2026-09-06): the official Algolia CLI ran keylessly from npm — `npx -y @algolia/cli --version` printed `algolia version 1.17.0` with no account.",
            'fetchedAt': NOW,
        },
        {
            'id': 'algolia-probe-rt-2',
            'tier': 'probe',
            'url': 'https://github.com/algolia/skills',
            'excerpt': "PROBE runtime (recorded 2026-09-06): keyless JSON-RPC initialize POST to the hosted MCP server https://mcp.algolia.com/mcp returned HTTP 401 with WWW-Authenticate Bearer resource_metadata=https://mcp.algolia.com/.well-known/oauth-protected-resource (authorization server: dashboard.algolia.com) — the hosted Algolia MCP server referenced by the official algolia/skills agent-skill pack is live and speaks the MCP OAuth flow.",
            'fetchedAt': NOW,
        },
    ],
    'meilisearch': [
        {
            'id': 'meilisearch-probe-rt-1',
            'tier': 'probe',
            'url': 'https://www.meilisearch.com/docs/resources/self_hosting/getting_started/install_locally',
            'excerpt': "PROBE runtime (recorded 2026-09-06): `meilisearch --version` printed `meilisearch 1.53.1` after `brew install meilisearch` — the full engine installs and runs with no account.",
            'fetchedAt': NOW,
        },
        {
            'id': 'meilisearch-probe-rt-2',
            'tier': 'probe',
            'url': 'https://www.meilisearch.com/docs/getting_started/first_project',
            'excerpt': "PROBE runtime (recorded 2026-09-06): a fully keyless local Meilisearch (no master key, dev mode) booted, two documents were indexed over HTTP, and the misspelled query q=serverles returned the document named 'serverless databases' — a REAL typo-tolerant index+search roundtrip with zero configuration, completed in milliseconds.",
            'fetchedAt': NOW,
        },
        {
            'id': 'meilisearch-probe-rt-3',
            'tier': 'probe',
            'url': 'https://www.meilisearch.com/docs/getting_started/integrations/mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-06): the official meilisearch-mcp server (pypi, run via uvx) completed a FULL keyless stdio JSON-RPC initialize handshake, answering serverInfo {\"name\":\"meilisearch\",\"version\":\"0.7.0\"} — instance credentials are only needed at tool-call time.",
            'fetchedAt': NOW,
        },
    ],
    'typesense': [
        {
            'id': 'typesense-probe-rt-1',
            'tier': 'probe',
            'url': 'https://typesense.org/docs/guide/install-typesense.html',
            'excerpt': "PROBE runtime (recorded 2026-09-06): `typesense-server --version` printed `Typesense 30.2` after `brew install typesense/tap/typesense-server@30.2` — the full GPL-3.0 engine installs with no account.",
            'fetchedAt': NOW,
        },
        {
            'id': 'typesense-probe-rt-2',
            'tier': 'probe',
            'url': 'https://typesense.org/docs/guide/building-a-search-application.html',
            'excerpt': "PROBE runtime (recorded 2026-09-06): a local Typesense booted with a self-set API key (no account, no cloud), a collection was created, a document indexed, and the misspelled query q='serch infra' returned the document with highlighted matches (<mark>search</mark> <mark>infra</mark>structure) — a REAL typo-tolerant index+search roundtrip in under a second.",
            'fetchedAt': NOW,
        },
    ],
    'elastic': [
        {
            'id': 'elastic-probe-rt-1',
            'tier': 'probe',
            'url': 'https://github.com/elastic/mcp-server-elasticsearch',
            'excerpt': "PROBE runtime (recorded 2026-09-06): the official @elastic/mcp-server-elasticsearch (npm) completed a FULL keyless stdio JSON-RPC initialize handshake, answering serverInfo {\"name\":\"elasticsearch-mcp\",\"version\":\"0.3.1\"} with only a placeholder ES_URL — no cluster or credentials needed for the handshake.",
            'fetchedAt': NOW,
        },
        {
            'id': 'elastic-probe-rt-2',
            'tier': 'probe',
            'url': 'https://www.elastic.co/docs/deploy-manage/deploy/self-managed/local-development-installation-quickstart',
            'excerpt': "PROBE runtime (recorded 2026-09-06): full Elasticsearch 9.5.3 booted locally in docker (single-node, security disabled — the documented local-dev mode), a document was indexed with ?refresh=true, and q=name:infrastructure returned it with a BM25 score — a REAL keyless index+search roundtrip against the complete engine.",
            'fetchedAt': NOW,
        },
    ],
    'orama': [
        {
            'id': 'orama-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.orama.com/docs/orama-js/usage/create',
            'excerpt': "PROBE runtime (recorded 2026-09-06): @orama/orama installed from npm and a single node invocation ran create → insert ×2 → search({ term: 'infrastucture', tolerance: 2 }) fully in-process, returning exactly the typo-matched document ('search infrastructure arena') — the entire engine runs keylessly wherever JavaScript runs, no server at all.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'open-rankings/search-infra/evidence/{pid}.json'
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
