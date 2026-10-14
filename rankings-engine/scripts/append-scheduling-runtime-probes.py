#!/usr/bin/env python3
# One-shot helper for the scheduling arena bring-up (2026-09-06): appends probe-tier evidence
# items distilled from the recorded runtime probes in open-rankings/scheduling/proofs/ (see
# pipeline/probes/scheduling.ts — all 7 recorded probes passed).
# Run AFTER `pnpm pipeline probe --category scheduling` — that stage wholesale-replaces
# probe-tier evidence and would wipe these items (re-run this script after any probe refresh).
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'cal-com': [
        {
            'id': 'cal-com-probe-rt-1',
            'tier': 'probe',
            'url': 'https://cal.com/docs/mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-06): keyless JSON-RPC initialize POST to the hosted MCP server https://mcp.cal.com/mcp returned HTTP 401 with WWW-Authenticate Bearer resource_metadata=https://mcp.cal.com/.well-known/oauth-protected-resource/mcp — the hosted Cal.com MCP server documented at cal.com/docs/mcp-server is live and speaks the MCP OAuth 2.1 flow (no API key needed, per its own docs).",
            'fetchedAt': NOW,
        },
        {
            'id': 'cal-com-probe-rt-2',
            'tier': 'probe',
            'url': 'https://github.com/calcom/cal.diy',
            'excerpt': "PROBE runtime (recorded 2026-09-06): the vendor-published self-host docker image (calcom/cal.com:v6.2.0-arm, the last image published before the April 2026 Cal.diy split) booted a REAL full Cal.com instance against a throwaway postgres:16 — migrations ran and the web app answered /auth/login with HTTP 200 and its first-run '<title>Setup | Cal.com</title>' wizard within seconds; calcom/cal.diy on Docker Hub had no published tags at recording time.",
            'fetchedAt': NOW,
        },
    ],
    'calendly': [
        {
            'id': 'calendly-probe-rt-1',
            'tier': 'probe',
            'url': 'https://developer.calendly.com/docs/mcp/calendly-mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-06): keyless JSON-RPC initialize POST to the hosted MCP server https://mcp.calendly.com returned HTTP 401 with WWW-Authenticate Bearer resource_metadata=https://mcp.calendly.com/.well-known/oauth-protected-resource and a mcp-session-id header — the hosted Calendly MCP server documented in the developer docs is live and speaks the MCP OAuth flow with automatic client re-registration guidance.",
            'fetchedAt': NOW,
        },
    ],
    'reclaim': [
        {
            'id': 'reclaim-probe-rt-1',
            'tier': 'probe',
            'url': 'https://reclaim.ai/features/ai-assistant',
            'excerpt': "PROBE runtime (recorded 2026-09-06): keyless JSON-RPC initialize POST to https://mcp.reclaim.ai returned HTTP 401 with Bearer resource_metadata=https://mcp.reclaim.ai/.well-known/oauth-protected-resource, and that metadata document is live, answering {\"authorization_servers\":[\"https://mcp.reclaim.ai\"],\"scopes_supported\":[\"read\",\"write\",\"mcp\"]} — Reclaim ships a live hosted MCP endpoint speaking the OAuth protected-resource flow (referenced by the AI Assistant feature's 'MCP connectors' support).",
            'fetchedAt': NOW,
        },
    ],
    'savvycal': [
        {
            'id': 'savvycal-probe-rt-1',
            'tier': 'probe',
            'url': 'https://developers.savvycal.com/api/savvycal-meetings-api',
            'excerpt': "PROBE runtime (recorded 2026-09-06): the machine-readable OpenAPI spec linked from the SavvyCal Meetings API reference fetched keylessly — https://api.savvycal.com/v1/spec returned a valid OpenAPI 3.0.0 document titled 'SavvyCal Meetings API' with 17 paths (scheduling links, events, webhooks, time zones).",
            'fetchedAt': NOW,
        },
    ],
    'motion': [
        {
            'id': 'motion-probe-rt-1',
            'tier': 'probe',
            'url': 'https://www.usemotion.com/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-06): https://www.usemotion.com/llms.txt served a 19KB text/plain agent-oriented overview ('# Usemotion') covering the AI calendar, meeting assistant, tasks, and pricing — published on the main origin (the docs origin docs.usemotion.com carries no llms.txt, which the publish-probe pass separately observed).",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'open-rankings/scheduling/evidence/{pid}.json'
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
