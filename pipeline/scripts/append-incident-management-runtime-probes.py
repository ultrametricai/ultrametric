#!/usr/bin/env python3
# One-shot helper for the incident-management arena bring-up (2026-09-06): appends probe-tier
# evidence items distilled from the recorded runtime probes in open-rankings/incident-management/proofs/
# (see pipeline/probes/incident-management.ts — all 8 recorded
# probes passed). Run AFTER `pnpm pipeline probe --category incident-management` — that stage
# wholesale-replaces probe-tier evidence and would wipe these items (re-run this script after
# any probe refresh).
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'pagerduty': [
        {
            'id': 'pagerduty-probe-rt-1',
            'tier': 'probe',
            'url': 'https://developer.pagerduty.com/docs/mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-06): PagerDuty's hosted remote MCP server is live — a keyless JSON-RPC initialize POST to https://mcp.pagerduty.com/mcp returned HTTP 401 with WWW-Authenticate Bearer and resource_metadata=https://mcp.pagerduty.com/.well-known/oauth-protected-resource/mcp, matching the documented MCP base URL and its API-token/OAuth authentication.",
            'fetchedAt': NOW,
        },
        {
            'id': 'pagerduty-probe-rt-2',
            'tier': 'probe',
            'url': 'https://developer.pagerduty.com/docs/events-api-v2-overview',
            'excerpt': "PROBE runtime (recorded 2026-09-06): the Events API v2 ingestion endpoint is live and self-describing — a keyless empty POST to https://events.pagerduty.com/v2/enqueue answered HTTP 400 with a structured validation error naming the required fields (''routing_key' cannot be blank', ''event_action' is missing or blank').",
            'fetchedAt': NOW,
        },
    ],
    'incident-io': [
        {
            'id': 'incident-io-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.incident.io/ai/remote-mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-06): incident.io's hosted remote MCP server is live — a keyless JSON-RPC initialize POST to https://mcp.incident.io/mcp returned HTTP 401 with WWW-Authenticate Bearer resource_metadata=https://mcp.incident.io/mcp/.well-known/oauth-protected-resource — the managed MCP endpoint speaks the MCP OAuth flow.",
            'fetchedAt': NOW,
        },
        {
            'id': 'incident-io-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.incident.io/api-reference/introduction',
            'excerpt': "PROBE runtime (recorded 2026-09-06): incident.io publishes machine-readable per-tag OpenAPI 3.0.3 specs keylessly (e.g. https://docs.incident.io/openapi/tags/incidents-v2.json downloaded and parsed), alongside a docs llms.txt index listing 550+ API-reference pages as markdown.",
            'fetchedAt': NOW,
        },
    ],
    'rootly': [
        {
            'id': 'rootly-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.rootly.com/integrations/mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-06): Rootly's hosted remote MCP server is live — a keyless JSON-RPC initialize POST to https://mcp.rootly.com/mcp returned HTTP 401 with WWW-Authenticate Bearer resource_metadata=https://mcp.rootly.com/.well-known/oauth-protected-resource.",
            'fetchedAt': NOW,
        },
        {
            'id': 'rootly-probe-rt-2',
            'tier': 'probe',
            'url': 'https://github.com/rootlyhq/rootly-mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-06): the official rootly-mcp-server installed keylessly from pypi via uvx and started far enough to log its server_start audit event (tool_count 124, transport stdio, write_tools_enabled with 135 write paths), then cleanly gated on the documented ROOTLY_API_TOKEN environment variable.",
            'fetchedAt': NOW,
        },
    ],
    'firehydrant': [
        {
            'id': 'firehydrant-probe-rt-1',
            'tier': 'probe',
            'url': 'https://github.com/firehydrant/firehydrant-mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-06): FireHydrant's official MCP server (npm firehydrant-mcp 0.0.4, maintained by fh-eng) completed a FULL keyless stdio initialize handshake — `npx -y firehydrant-mcp start --transport stdio` answered with serverInfo {name: FireHydrant, version: 0.0.4} and advertised tools and prompts capabilities.",
            'fetchedAt': NOW,
        },
    ],
    'betterstack': [
        {
            'id': 'betterstack-probe-rt-1',
            'tier': 'probe',
            'url': 'https://betterstack.com/docs/uptime/api/getting-started-with-uptime-api/',
            'excerpt': "PROBE runtime (recorded 2026-09-06): Better Stack's documented Uptime API is live and cleanly auth-gated — a keyless GET https://uptime.betterstack.com/api/v2/monitors returned HTTP 401 with a JSON error body, matching the documented bearer-token authentication.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'open-rankings/incident-management/evidence/{pid}.json'
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
