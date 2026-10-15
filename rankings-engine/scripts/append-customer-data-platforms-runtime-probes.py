#!/usr/bin/env python3
# One-shot helper for the customer-data-platforms arena bring-up (2026-09-08): appends
# probe-tier evidence items distilled from the recorded runtime probes in
# open-rankings/customer-data-platforms/proofs/ (see rankings-engine/probes/customer-data-platforms.ts —
# all 12 recorded probes passed). Run AFTER
# `pnpm engine probe --category customer-data-platforms` — that stage wholesale-replaces
# probe-tier evidence and would wipe these items (re-run this script after any probe refresh).
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'segment': [
        {
            'id': 'segment-probe-rt-1',
            'tier': 'probe',
            'url': 'https://segment.com/docs/api/public-api/',
            'excerpt': "PROBE runtime (recorded 2026-09-08): Segment's Public API is live and cleanly auth-gated — a keyless GET https://api.segmentapis.com/sources returned HTTP 401 with the structured error {\"type\":\"unauthorized\",\"message\":\"Authorization header is required\"}, matching the documented token authentication.",
            'fetchedAt': NOW,
        },
        {
            'id': 'segment-probe-rt-2',
            'tier': 'probe',
            'url': 'https://segment.com/docs/connections/spec/',
            'excerpt': "PROBE runtime (recorded 2026-09-08): the tracking ingest endpoint is live and self-describing — a keyless empty POST to https://api.segment.io/v1/track answered HTTP 400 with {\"success\":false,\"message\":\"An invalid write key was provided\",\"code\":\"invalid_request\"}; the official @segment/analytics-node SDK installed keylessly from npm and exports an Analytics constructor.",
            'fetchedAt': NOW,
        },
    ],
    'rudderstack': [
        {
            'id': 'rudderstack-probe-rt-1',
            'tier': 'probe',
            'url': 'https://www.rudderstack.com/docs/ai-features/rudderstack-mcp/',
            'excerpt': "PROBE runtime (recorded 2026-09-08): RudderStack's hosted remote MCP server is live — a keyless JSON-RPC initialize POST to https://mcp.rudderstack.com/mcp returned HTTP 401 with WWW-Authenticate Bearer resource_metadata=https://mcp.rudderstack.com/.well-known/oauth-protected-resource, matching the documented OAuth flow for pipeline debugging and management from Claude/Codex/Cursor.",
            'fetchedAt': NOW,
        },
        {
            'id': 'rudderstack-probe-rt-2',
            'tier': 'probe',
            'url': 'https://www.rudderstack.com/docs/sources/event-streams/sdks/rudderstack-javascript-sdk/',
            'excerpt': "PROBE runtime (recorded 2026-09-08): the official @rudderstack/rudder-sdk-node installed keylessly from npm into a throwaway fixture and its Analytics export loaded as a constructor function.",
            'fetchedAt': NOW,
        },
    ],
    'mparticle': [
        {
            'id': 'mparticle-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.mparticle.com/developers/apis/http/',
            'excerpt': "PROBE runtime (recorded 2026-09-08): mParticle's server-to-server events API is live and auth-gated — a keyless POST to https://s2s.mparticle.com/v2/events returned a bare HTTP 401, matching the documented key/secret basic authentication; the official @mparticle/web-sdk installed keylessly from npm and exports init.",
            'fetchedAt': NOW,
        },
    ],
    'jitsu': [
        {
            'id': 'jitsu-probe-rt-1',
            'tier': 'probe',
            'url': 'https://jitsu.com/docs/mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-08): Jitsu's hosted MCP server ('Jitsu runs an MCP server, so AI agents can manage your pipeline directly: create destinations, wire up streams, inspect Live Events, and edit Functions' at https://use.jitsu.com/mcp) is live — a keyless JSON-RPC initialize returned HTTP 401 with WWW-Authenticate Bearer realm=\"jitsu-mcp\" and OAuth protected-resource metadata.",
            'fetchedAt': NOW,
        },
        {
            'id': 'jitsu-probe-rt-2',
            'tier': 'probe',
            'url': 'https://github.com/jitsucom/jitsu',
            'excerpt': "PROBE runtime (recorded 2026-09-08): Jitsu is really self-hostable from source — a keyless shallow clone of jitsucom/jitsu landed the MIT LICENSE and the docker-compose.yml self-host entrypoint; the official @jitsu/js SDK installed keylessly from npm and exports jitsuAnalytics.",
            'fetchedAt': NOW,
        },
    ],
    'hightouch': [
        {
            'id': 'hightouch-probe-rt-1',
            'tier': 'probe',
            'url': 'https://hightouch.com/docs/developer-tools/api-guide',
            'excerpt': "PROBE runtime (recorded 2026-09-08): Hightouch's REST API is live and cleanly auth-gated — a keyless GET https://api.hightouch.com/api/v1/syncs returned HTTP 401 with {\"message\":\"Authentication error\",\"details\":\"No authorization header found\"}.",
            'fetchedAt': NOW,
        },
        {
            'id': 'hightouch-probe-rt-2',
            'tier': 'probe',
            'url': 'https://hightouch.com/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-08): hightouch.com publishes an agent-oriented llms.txt on its main origin ('# Hightouch — Hightouch is an Agentic Marketing Platform...') indexing its docs; the Hightouch MCP docs page describes assistants creating and saving audiences, designing journeys, and generating creatives through the MCP server, scoped to the authenticated workspace's RBAC.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'open-rankings/customer-data-platforms/evidence/{pid}.json'
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
