#!/usr/bin/env python3
# One-shot helper for the feature-flags arena bring-up (2026-09-05): appends probe-tier evidence
# items distilled from the recorded runtime probes in rankings/feature-flags/proofs/ (see
# pipeline/probes/feature-flags.ts — all 12 recorded probes passed).
# Run AFTER `pnpm pipeline probe --category feature-flags` — that stage wholesale-replaces
# probe-tier evidence and would wipe these items (re-run this script after any probe refresh).
import json
import datetime

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'launchdarkly': [
        {
            'id': 'launchdarkly-probe-rt-1',
            'tier': 'probe',
            'url': 'https://launchdarkly.com/docs/home/getting-started/ldcli',
            'excerpt': "PROBE runtime (recorded 2026-09-05): the official LaunchDarkly CLI installed via `brew tap launchdarkly/homebrew-tap && brew install ldcli` and `ldcli --version` printed `ldcli version 3.11.0` keylessly.",
            'fetchedAt': NOW,
        },
        {
            'id': 'launchdarkly-probe-rt-2',
            'tier': 'probe',
            'url': 'https://launchdarkly.com/docs/home/getting-started/mcp-local',
            'excerpt': "PROBE runtime (recorded 2026-09-05): the official npm MCP server (`npx -y @launchdarkly/mcp-server start --transport stdio`) completed a FULL keyless stdio initialize handshake, answering serverInfo {\"name\":\"LaunchDarkly\",\"version\":\"0.6.2\"} — tool calls authenticate later with an API key.",
            'fetchedAt': NOW,
        },
        {
            'id': 'launchdarkly-probe-rt-3',
            'tier': 'probe',
            'url': 'https://launchdarkly.com/docs/home/getting-started/mcp-hosted',
            'excerpt': "PROBE runtime (recorded 2026-09-05): keyless JSON-RPC initialize POST to the documented hosted MCP endpoint https://mcp.launchdarkly.com/mcp/launchdarkly returned HTTP 401 — the remote MCP server is live and auth-gated exactly as documented.",
            'fetchedAt': NOW,
        },
    ],
    'statsig': [
        {
            'id': 'statsig-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.statsig.com/statsigcli/introduction',
            'excerpt': "PROBE runtime (recorded 2026-09-05): the official Statsig CLI (npm @statsig/siggy) ran keylessly via `npx -y @statsig/siggy --version`, printing its version — gate and experiment management is scriptable from CI.",
            'fetchedAt': NOW,
        },
        {
            'id': 'statsig-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.statsig.com/integrations/mcp/overview',
            'excerpt': "PROBE runtime (recorded 2026-09-05): keyless JSON-RPC initialize POST to the hosted MCP server https://api.statsig.com/v1/mcp returned HTTP 401 with `WWW-Authenticate: Bearer realm=\"statsig\" resource_metadata=\".../.well-known/oauth-protected-resource/v1/mcp\"` — the documented authenticated MCP surface is live and speaks the MCP OAuth flow.",
            'fetchedAt': NOW,
        },
        {
            'id': 'statsig-probe-rt-3',
            'tier': 'probe',
            'url': 'https://docs.statsig.com/integrations/mcp/docs-mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-05): the documented no-auth docs MCP server at https://docs.statsig.com/api/mcp completed a FULL keyless initialize handshake, answering serverInfo {\"name\":\"statsig-docs\",\"version\":\"1.1.0\"} — Statsig's documentation is directly agent-reachable over MCP.",
            'fetchedAt': NOW,
        },
    ],
    'growthbook': [
        {
            'id': 'growthbook-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.growthbook.io/integrations/mcp.md',
            'excerpt': "PROBE runtime (recorded 2026-09-05): the official npm MCP server (`npx -y @growthbook/mcp`) completed a FULL keyless stdio initialize handshake, answering serverInfo {\"name\":\"GrowthBook MCP Thin\",\"version\":\"2.1.0\"} with instructions describing skill-discovery plus authenticated REST read/write meta-tools covering the whole GrowthBook API.",
            'fetchedAt': NOW,
        },
        {
            'id': 'growthbook-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.growthbook.io/self-host.md',
            'excerpt': "PROBE runtime (recorded 2026-09-05): full KEYLESS self-host roundtrip on this machine — the official growthbook/growthbook docker image booted against mongo, the first user and organization were created through the API, a boolean feature `pa-probe-flag` was created, an SDK connection was minted, and the keyless SDK-payload endpoint /api/features/<key> returned {\"pa-probe-flag\":{\"defaultValue\":true}} — a real flag create-and-evaluate loop with no account or license.",
            'fetchedAt': NOW,
        },
    ],
    'flagsmith': [
        {
            'id': 'flagsmith-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.flagsmith.com/integrating-with-flagsmith/mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-05): keyless JSON-RPC initialize POST to the documented hosted MCP server https://mcp.flagsmith.com returned HTTP 401 — the remote MCP surface for managing flags, segments, and release workflows is live and key-gated.",
            'fetchedAt': NOW,
        },
        {
            'id': 'flagsmith-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.flagsmith.com/deployment-self-hosting/hosting-guides/docker',
            'excerpt': "PROBE runtime (recorded 2026-09-05): full KEYLESS self-host roundtrip on this machine — the official flagsmith/flagsmith unified docker image booted against postgres, the first user was registered via the API, org → project → environment were created, a flag `pa_probe_flag` (default enabled) was created, and GET /api/v1/flags/ with only the environment's client-side key returned it with \"enabled\":true — a real flag create-and-evaluate loop with no account or license.",
            'fetchedAt': NOW,
        },
    ],
    'unleash': [
        {
            'id': 'unleash-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.getunleash.io/deploy/getting-started.md',
            'excerpt': "PROBE runtime (recorded 2026-09-05): full KEYLESS self-host roundtrip on this machine — the official unleashorg/unleash-server docker image booted against postgres with INIT admin/client tokens, a release flag `pa-probe-flag` was created via the Admin API, a default strategy was attached and the flag enabled in development, and the Client API returned {\"name\":\"pa-probe-flag\",\"type\":\"release\",\"enabled\":true,...} — a real flag create-and-evaluate loop with no account or license.",
            'fetchedAt': NOW,
        },
        {
            'id': 'unleash-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.getunleash.io/integrate/mcp.md',
            'excerpt': "PROBE runtime (recorded 2026-09-05): the docs MCP endpoint https://docs.getunleash.io/_mcp/server completed a FULL keyless initialize handshake (serverInfo fern-docs-mcp-server) — Unleash's documentation is directly agent-reachable over MCP; the flag-management MCP server (npm @unleash/mcp) is a separate local server that requires an Unleash base URL and PAT at startup.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'rankings/feature-flags/evidence/{pid}.json'
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
