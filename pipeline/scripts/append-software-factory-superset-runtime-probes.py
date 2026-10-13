#!/usr/bin/env python3
# One-shot helper for the superset software-factory bring-up (YC X26 coverage-queue wave
# 2026-09-25). Appends probe-tier evidence items distilled from the recorded runtime probes in
# rankings/software-factory/proofs/superset/ (see pipeline/probes/software-factory.ts — all 3
# recorded probes passed). Run AFTER `pnpm pipeline probe --category software-factory --product
# superset` (or a spike pass, whose probe stage wholesale-replaces probe-tier evidence and would
# wipe these items) — re-run this script after any probe refresh.
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'superset': [
        {
            'id': 'superset-probe-rt-1',
            'tier': 'probe',
            'url': 'https://superset.sh/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-25): keyless GET of https://superset.sh/llms.txt returned the product llms.txt (text/plain) — '# Superset — Bring any coding agent. Orchestrate them all.' — indexing the whole machine surface: hosted MCP server, docs MCP server, OpenAPI spec, .well-known MCP server card / A2A agent card / RFC 9727 api-catalog / ai-catalog, auth.md (OAuth 2.1 + PKCE with dynamic client registration, or API keys), agents.md, and scoped llms.txt files for docs/api/blog/compare.",
            'fetchedAt': NOW,
        },
        {
            'id': 'superset-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.superset.sh/mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-25): keyless JSON-RPC initialize POST to the hosted MCP server https://api.superset.sh/mcp returned HTTP 401 with WWW-Authenticate Bearer realm=\"superset\" and resource_metadata pointing at https://api.superset.sh/.well-known/oauth-protected-resource/mcp — the documented remote MCP endpoint (Streamable HTTP; tools for tasks, workspaces, agents, automations, terminals, hosts, projects) is live and speaks the MCP OAuth flow.",
            'fetchedAt': NOW,
        },
        {
            'id': 'superset-probe-rt-3',
            'tier': 'probe',
            'url': 'https://api.superset.sh/openapi.json',
            'excerpt': "PROBE runtime (recorded 2026-09-25): keyless GET of https://api.superset.sh/openapi.json returned the OpenAPI 3.1 spec — title 'Superset API', summary \"Programmatic access to Superset's agent-orchestration platform\" — the machine-readable schema of the surface the MCP server and TypeScript SDK front.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'rankings/software-factory/evidence/{pid}.json'
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
