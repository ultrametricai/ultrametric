#!/usr/bin/env python3
# One-shot helper for the supabase serverless-databases second-arena membership (founder ask
# 2026-09-23: "supabase should show up in developer databases and be compared against neon").
# Appends probe-tier evidence items distilled from the recorded runtime probes in
# rankings/serverless-databases/proofs/supabase/ (see pipeline/probes/serverless-databases.ts —
# all 3 recorded probes passed). Run AFTER `pnpm pipeline probe --category serverless-databases`
# — that stage wholesale-replaces probe-tier evidence and would wipe these items (re-run this
# script after any probe refresh).
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'supabase': [
        {
            'id': 'supabase-probe-rt-1',
            'tier': 'probe',
            'url': 'https://supabase.com/docs/guides/local-development/cli/getting-started',
            'excerpt': "PROBE runtime (recorded 2026-09-23): the official Supabase CLI ran keylessly from npm — `npx -y supabase --version` printed `2.117.0` with no account or login.",
            'fetchedAt': NOW,
        },
        {
            'id': 'supabase-probe-rt-2',
            'tier': 'probe',
            'url': 'https://supabase.com/docs/guides/ai-tools/mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-23): keyless JSON-RPC initialize POST to the hosted MCP server https://mcp.supabase.com/mcp returned HTTP 401 with WWW-Authenticate Bearer and resource_metadata pointing at https://mcp.supabase.com/.well-known/oauth-protected-resource/mcp — the documented remote MCP endpoint is live and speaks the MCP OAuth flow.",
            'fetchedAt': NOW,
        },
        {
            'id': 'supabase-probe-rt-3',
            'tier': 'probe',
            'url': 'https://supabase.com/docs/guides/ai-tools/ai-skills.md',
            'excerpt': "PROBE runtime (recorded 2026-09-23): keyless GET of https://supabase.com/.well-known/agent-skills/index.json returned the machine-discoverable agent-skills catalog ($schema schemas.agentskills.io/discovery/0.2.0) covering Database, Auth, Edge Functions, Realtime, Storage, Vectors, Cron, and Queues — the index `npx skills add supabase/agent-skills` consumes.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'rankings/serverless-databases/evidence/{pid}.json'
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
