#!/usr/bin/env python3
# One-shot helper for the notes-knowledge arena bring-up (2026-09-05): appends probe-tier
# evidence items distilled from the recorded runtime probes in open-rankings/notes-knowledge/proofs/
# (see rankings-engine/probes/notes-knowledge.ts — all 6 recorded probes
# passed). Run AFTER `pnpm engine probe --category notes-knowledge` — that stage
# wholesale-replaces probe-tier evidence and would wipe these items (re-run this script after
# any probe refresh).
import json
import datetime

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'obsidian': [
        {
            'id': 'obsidian-probe-rt-1',
            'tier': 'probe',
            'url': 'https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json',
            'excerpt': "PROBE runtime (recorded 2026-09-05): the vendor's own community-plugin registry (obsidianmd/obsidian-releases community-plugins.json) counted 7,275 published community plugins keylessly — the plugin ecosystem's scale is registry-verified, not a marketing claim. Obsidian ships no official CLI or vendor MCP server (checked at bring-up; MCP servers for Obsidian are community projects).",
            'fetchedAt': NOW,
        },
    ],
    'logseq': [
        {
            'id': 'logseq-probe-rt-1',
            'tier': 'probe',
            'url': 'https://github.com/logseq/marketplace',
            'excerpt': "PROBE runtime (recorded 2026-09-05): Logseq's official plugin marketplace registry (logseq/marketplace, one directory per package) counted 617 published packages keylessly via the GitHub contents API — the in-app Marketplace is registry-verified.",
            'fetchedAt': NOW,
        },
    ],
    'anytype': [
        {
            'id': 'anytype-probe-rt-1',
            'tier': 'probe',
            'url': 'https://developers.anytype.io/docs/examples/featured/mcp/',
            'excerpt': "PROBE runtime (recorded 2026-09-05): the official Anytype MCP server (npm @anyproto/anytype-mcp 1.2.10) launched keylessly via `npx -y @anyproto/anytype-mcp`, printing 'Initializing Anytype MCP Server...' and then requiring a reachable local Anytype app ('Can't connect to API. Please ensure Anytype is running') — the vendor ships a real MCP server that fronts the app's local API on this machine, with keys minted in the app.",
            'fetchedAt': NOW,
        },
        {
            'id': 'anytype-probe-rt-2',
            'tier': 'probe',
            'url': 'https://raw.githubusercontent.com/anyproto/anytype-heart/main/core/api/docs/openapi.json',
            'excerpt': "PROBE runtime (recorded 2026-09-05): the local API's machine-readable OpenAPI 3.1.0 spec (22 paths) was fetched keylessly from the vendor's core repo (anyproto/anytype-heart core/api/docs/openapi.json — the engine every desktop app embeds); the developer reference at developers.anytype.io is generated from it and versioned by date (2025-04-22).",
            'fetchedAt': NOW,
        },
    ],
    'capacities': [
        {
            'id': 'capacities-probe-rt-1',
            'tier': 'probe',
            'url': 'https://api.capacities.io/openapi.json',
            'excerpt': "PROBE runtime (recorded 2026-09-05): https://api.capacities.io/openapi.json served a machine-readable OpenAPI 3.1.0 spec ('Capacities API (Beta)') and a keyless GET to the live https://api.capacities.io/spaces endpoint returned a clean HTTP 401 — documented spec and live bearer-gated API verified as a pair.",
            'fetchedAt': NOW,
        },
        {
            'id': 'capacities-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.capacities.io/developer/model-context-protocol',
            'excerpt': "PROBE runtime (recorded 2026-09-05): keyless JSON-RPC initialize POST to the official hosted MCP server https://api.capacities.io/mcp returned HTTP 401 with `WWW-Authenticate: Bearer resource_metadata=\"https://api.capacities.io/.well-known/oauth-protected-resource/mcp\", scope=\"mcp:read mcp:write\"` — the documented OAuth MCP endpoint is live, with read AND write scopes.",
            'fetchedAt': NOW,
        },
    ],
    'reflect': [
        {
            'id': 'reflect-probe-rt-1',
            'tier': 'probe',
            'url': 'https://reflect.academy/api',
            'excerpt': "PROBE runtime (recorded 2026-09-05): keyless GET to the documented REST base https://reflect.app/api/graphs returned HTTP 401 {\"error\":{\"type\":\"invalid_request\",\"message\":\"Authentication required\"}} — the OAuth2/access-token API documented at reflect.academy/api is live. Note the API is append-only for note content by design (end-to-end encryption means Reflect's servers cannot read notes).",
            'fetchedAt': NOW,
        },
    ],
    'poly': [
        {
            'id': 'poly-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.poly.app/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-14): https://docs.poly.app/llms.txt served an agent-oriented docs index ('# docs.poly.app', with a companion llms-full.txt and every page mirrored under /raw/*.md) covering the built-in file agent, Poly Mind, the poly CLI (25+ commands), and MCP integrations for Claude Code, Codex, ChatGPT, Gemini, and MCP-compatible IDEs.",
            'fetchedAt': NOW,
        },
        {
            'id': 'poly-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.poly.app/raw/integrations/using-mcp.md',
            'excerpt': "PROBE runtime (recorded 2026-09-14): keyless JSON-RPC initialize POST to Poly's hosted MCP server https://mcp.poly.app/mcp returned HTTP 401 with WWW-Authenticate Bearer resource_metadata=https://mcp.poly.app/.well-known/oauth-protected-resource/mcp — the hosted MCP server documented at docs.poly.app (search, fetch, and a virtual `poly` CLI as MCP tools; OAuth in-browser, no pasted keys) is live and speaks the MCP OAuth flow.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'open-rankings/notes-knowledge/evidence/{pid}.json'
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
