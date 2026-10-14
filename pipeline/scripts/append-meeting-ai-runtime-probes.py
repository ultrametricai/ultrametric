#!/usr/bin/env python3
# One-shot helper for the meeting-ai arena bring-up (2026-09-05): appends probe-tier evidence
# items distilled from the recorded runtime probes in open-rankings/meeting-ai/proofs/ (see
# pipeline/probes/meeting-ai.ts — all recorded probes passed).
# Run AFTER `pnpm pipeline probe --category meeting-ai` — that stage wholesale-replaces
# probe-tier evidence and would wipe these items (re-run this script after any probe refresh).
import json
import datetime

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'granola': [
        {
            'id': 'granola-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.granola.ai/help-center/sharing/integrations/mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-05): keyless JSON-RPC initialize POST to the official hosted MCP server https://mcp.granola.ai/mcp returned HTTP 401 with `WWW-Authenticate: Bearer ... resource_metadata=\"https://mcp.granola.ai/.well-known/oauth-protected-resource\"` — the documented OAuth MCP endpoint (query_granola_meetings, list_meetings, get_meeting_transcript, etc.) is live and speaks the MCP OAuth flow.",
            'fetchedAt': NOW,
        },
    ],
    'fireflies': [
        {
            'id': 'fireflies-probe-rt-1',
            'tier': 'probe',
            'url': 'https://guide.fireflies.ai/articles/8272956938-learn-about-the-fireflies-mcp-server-model-context-protocol',
            'excerpt': "PROBE runtime (recorded 2026-09-05): keyless JSON-RPC initialize POST to the hosted MCP server https://api.fireflies.ai/mcp returned HTTP 401 with `WWW-Authenticate: Bearer ... resource_metadata=\"https://api.fireflies.ai/.well-known/oauth-protected-resource/mcp\"` — the official remote MCP endpoint is live and OAuth-gated as documented.",
            'fetchedAt': NOW,
        },
        {
            'id': 'fireflies-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.fireflies.ai/getting-started/docs-mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-05): the Fireflies docs MCP server at https://docs.fireflies.ai/mcp completed a FULL keyless JSON-RPC initialize handshake (result.protocolVersion 2025-06-18 over event-stream) — agents can search the entire Fireflies API documentation through MCP with no account.",
            'fetchedAt': NOW,
        },
        {
            'id': 'fireflies-probe-rt-3',
            'tier': 'probe',
            'url': 'https://docs.fireflies.ai/fundamentals/authorization',
            'excerpt': "PROBE runtime (recorded 2026-09-05): a keyless GraphQL query POSTed to the live endpoint https://api.fireflies.ai/graphql returned the documented structured auth challenge ({\"code\":\"auth_failed\",\"message\":\"...recheck your API key...\"}) — the public GraphQL API is live and bearer-key-gated exactly as the docs describe.",
            'fetchedAt': NOW,
        },
    ],
    'otter': [
        {
            'id': 'otter-probe-rt-1',
            'tier': 'probe',
            'url': 'https://otter.ai/blog/otter-for-enterprise-connect-ai-to-ai-with-otters-mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-05): keyless JSON-RPC initialize POST to Otter's hosted MCP server https://mcp.otter.ai/mcp returned HTTP 401 with `WWW-Authenticate: Bearer ... resource_metadata=\"https://mcp.otter.ai/.well-known/oauth-protected-resource\"` — the announced MCP endpoint is real, live, and OAuth-gated. Note: Otter's Public API and MCP are gated to Enterprise workspaces per its help center.",
            'fetchedAt': NOW,
        },
    ],
    'fathom': [
        {
            'id': 'fathom-probe-rt-1',
            'tier': 'probe',
            'url': 'https://developers.fathom.ai/mcp-docs/index.md',
            'excerpt': "PROBE runtime (recorded 2026-09-05): keyless JSON-RPC initialize POST to the official hosted MCP server https://api.fathom.ai/mcp returned HTTP 401 with `WWW-Authenticate: Bearer resource_metadata=\"https://api.fathom.ai/.well-known/oauth-protected-resource/mcp\"` — the documented MCP endpoint (official Claude/ChatGPT connectors) is live and speaks the MCP OAuth flow.",
            'fetchedAt': NOW,
        },
        {
            'id': 'fathom-probe-rt-2',
            'tier': 'probe',
            'url': 'https://developers.fathom.ai/api-overview.md',
            'excerpt': "PROBE runtime (recorded 2026-09-05): keyless GET to the documented REST base https://api.fathom.ai/external/v1/meetings returned HTTP 401 carrying the documented RateLimit-Limit/RateLimit-Remaining/RateLimit-Reset headers — the public API surface is live and matches developers.fathom.ai exactly.",
            'fetchedAt': NOW,
        },
        {
            'id': 'fathom-probe-rt-3',
            'tier': 'probe',
            'url': 'https://developers.fathom.ai/api-reference/openapi.yaml',
            'excerpt': "PROBE runtime (recorded 2026-09-05): Fathom publishes a machine-readable OpenAPI 3.1.1 spec ('Fathom External API', versioned 1.0.0) at https://developers.fathom.ai/api-reference/openapi.yaml — the exact URL its own llms.txt advertises — fetched keylessly.",
            'fetchedAt': NOW,
        },
    ],
    'fellow': [
        {
            'id': 'fellow-probe-rt-1',
            'tier': 'probe',
            'url': 'https://developers.fellow.ai/reference/mcp-server.md',
            'excerpt': "PROBE runtime (recorded 2026-09-05): keyless JSON-RPC initialize POST to Fellow's hosted MCP server https://fellow.app/mcp returned HTTP 401 with `WWW-Authenticate: Bearer realm=\"Restricted\"` — the documented MCP endpoint (get_action_items, get_meeting_transcript, search_meetings, etc.) is live and bearer-gated as documented.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'open-rankings/meeting-ai/evidence/{pid}.json'
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
