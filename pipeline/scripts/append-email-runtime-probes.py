#!/usr/bin/env python3
# One-shot helper for the email arena bring-up (2026-09-06): appends probe-tier evidence items
# distilled from the recorded runtime probes in rankings/email/proofs/ (see
# pipeline/probes/email.ts — all 6 recorded probes passed). Run
# AFTER `pnpm pipeline probe --category email` — that stage wholesale-replaces probe-tier
# evidence and would wipe these items (re-run this script after any probe refresh).
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'missive': [
        {
            'id': 'missive-probe-rt-1',
            'tier': 'probe',
            'url': 'https://missiveapp.com/docs/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-06): Missive's docs publish a full llms.txt index at missiveapp.com/docs/llms.txt and serve every documentation page as markdown by appending .md — the MCP-server page (docs/ai/mcp/server.md) machine-readably names the hosted endpoint https://mcp.missiveapp.com.",
            'fetchedAt': NOW,
        },
        {
            'id': 'missive-probe-rt-2',
            'tier': 'probe',
            'url': 'https://missiveapp.com/docs/ai/mcp/server',
            'excerpt': "PROBE runtime (recorded 2026-09-06): a keyless JSON-RPC initialize POST to the hosted Missive MCP server https://mcp.missiveapp.com returned HTTP 401 with a WWW-Authenticate Bearer OAuth challenge (resource_metadata=/.well-known/oauth-protected-resource) advertising scopes conversations:read/write, contacts:read, organizations:read, drafts:write, drafts:deliver, calendars:read/write — the live agent surface: an external AI app can read conversations, draft, SEND, and manage calendars once authorized.",
            'fetchedAt': NOW,
        },
    ],
    'fastmail': [
        {
            'id': 'fastmail-probe-rt-1',
            'tier': 'probe',
            'url': 'https://www.fastmail.com/dev/',
            'excerpt': "PROBE runtime (recorded 2026-09-06): Fastmail's documented JMAP API endpoint is live and cleanly auth-gated — a keyless GET https://api.fastmail.com/jmap/session returned HTTP 401 with a WWW-Authenticate Bearer challenge and OAuth protected-resource metadata (/.well-known/oauth-protected-resource/jmap/session).",
            'fetchedAt': NOW,
        },
        {
            'id': 'fastmail-probe-rt-2',
            'tier': 'probe',
            'url': 'https://www.fastmail.com/dev/',
            'excerpt': "PROBE runtime (recorded 2026-09-06): RFC 8620 JMAP autodiscovery works keylessly — GET https://api.fastmail.com/.well-known/jmap answered HTTP 302 Location: https://api.fastmail.com/jmap/session, so any standards-conformant JMAP client or agent can discover Fastmail's API endpoint mechanically.",
            'fetchedAt': NOW,
        },
    ],
    'zero': [
        {
            'id': 'zero-probe-rt-1',
            'tier': 'probe',
            'url': 'https://github.com/Mail-0/Zero',
            'excerpt': "PROBE runtime (recorded 2026-09-06): a keyless shallow git clone of Mail-0/Zero landed a REAL self-hostable source tree — repo-root MCP.md ('Zero MCP' server: get/send/draft/delete emails, labels, AI compose, mailbox Q&A, auth via Better Auth session token), AGENT.md agent-configuration docs, and docker-compose.db.yaml + docker-compose.prod.yaml for self-hosting.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'rankings/email/evidence/{pid}.json'
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
