#!/usr/bin/env python3
# One-shot helper for the metorial mcp-infrastructure bring-up (YC F25 coverage-queue wave
# 2026-09-25; queue classified agent-frameworks, re-based to mcp-infrastructure — morph
# precedent — because Metorial's surface IS this arena's axis: hosted MCP servers, provider
# registry, OAuth handling, session logs). Appends probe-tier evidence items distilled from the
# recorded runtime probes in open-rankings/mcp-infrastructure/proofs/metorial/ (see
# rankings-engine/probes/mcp-infrastructure.ts — all 3 recorded probes passed). Run AFTER
# `pnpm engine probe --category mcp-infrastructure --product metorial` (or a spike pass, whose
# probe stage wholesale-replaces probe-tier evidence and would wipe these items) — re-run this
# script after any probe refresh.
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'metorial': [
        {
            'id': 'metorial-probe-rt-1',
            'tier': 'probe',
            'url': 'https://metorial.com/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-25): keyless GET of https://metorial.com/llms.txt returned the site llms.txt (text/plain) — '# Metorial — Metorial connects AI agents and MCP clients to the apps your team already uses, with access controls and activity logs' — indexing the full docs tree (build/platform/API reference) and documenting that every docs page mirrors as markdown at URL + .mdx.",
            'fetchedAt': NOW,
        },
        {
            'id': 'metorial-probe-rt-2',
            'tier': 'probe',
            'url': 'https://metorial.com/docs/build/quickstart.mdx',
            'excerpt': "PROBE runtime (recorded 2026-09-25): keyless GET of https://metorial.com/docs/build/quickstart.mdx returned the developer quickstart as clean markdown ('# Developer quickstart — Get up and running with Metorial in under 5 minutes') — the documented .mdx mirror convention works, and unknown .mdx paths answer a real 404.",
            'fetchedAt': NOW,
        },
        {
            'id': 'metorial-probe-rt-3',
            'tier': 'probe',
            'url': 'https://metorial.com/docs/build/api',
            'excerpt': "PROBE runtime (recorded 2026-09-25): keyless GET of https://api.metorial.com/providers answered HTTP 401 with a machine-readable error object — '\"code\":\"unauthorized\", \"message\":\"Missing Authorization header\"' plus a hint naming the Bearer-token contract ('Copy your API key from the Metorial dashboard...') — the documented public REST API is live and key-gated exactly as the docs describe.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'open-rankings/mcp-infrastructure/evidence/{pid}.json'
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
