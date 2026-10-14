#!/usr/bin/env python3
# One-shot helper for the design-tools arena bring-up (2026-09-07): appends probe-tier evidence
# items distilled from the recorded runtime probes in open-rankings/design-tools/proofs/ (see
# rankings-engine/probes/design-tools.ts — all 7 recorded probes passed).
# Run AFTER `pnpm engine probe --category design-tools` — that stage wholesale-replaces
# probe-tier evidence and would wipe these items (re-run this script after any probe refresh).
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'figma': [
        {
            'id': 'figma-probe-rt-1',
            'tier': 'probe',
            'url': 'https://developers.figma.com/docs/code-connect/quickstart-guide/',
            'excerpt': "PROBE runtime (recorded 2026-09-07): the official Code Connect CLI ran keylessly from npm — `npx -y @figma/code-connect --version` printed `2.0.0` with no account or token.",
            'fetchedAt': NOW,
        },
        {
            'id': 'figma-probe-rt-2',
            'tier': 'probe',
            'url': 'https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/',
            'excerpt': "PROBE runtime (recorded 2026-09-07): keyless JSON-RPC initialize POST to Figma's hosted remote MCP server https://mcp.figma.com/mcp returned HTTP 401 with WWW-Authenticate Bearer resource_metadata=https://mcp.figma.com/.well-known/oauth-protected-resource, scope=mcp:connect, authorization_uri=api.figma.com — the hosted MCP endpoint documented in the remote-server installation guide is live and speaks the MCP OAuth flow.",
            'fetchedAt': NOW,
        },
        {
            'id': 'figma-probe-rt-3',
            'tier': 'probe',
            'url': 'https://github.com/figma/rest-api-spec',
            'excerpt': "PROBE runtime (recorded 2026-09-14): Figma's official machine-readable REST API spec fetched keylessly — `curl https://raw.githubusercontent.com/figma/rest-api-spec/main/openapi/openapi.yaml` returned a 400KB OpenAPI 3.1.0 document (info.title 'Figma API', version 0.42.0) published in the vendor's own figma/rest-api-spec repo.",
            'fetchedAt': NOW,
        },
    ],
    'spline': [
        {
            'id': 'spline-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.spline.design/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-14): https://docs.spline.design/llms.txt served an agent-oriented docs index ('# Spline Documentation') with every page mirrored as .md — covering the AI Agent ('build and edit 3D scenes by describing what you want'), AI Textures, the Real-time API, Webhooks, the Code tab, and desktop MCP support.",
            'fetchedAt': NOW,
        },
    ],
    'rive': [
        {
            'id': 'rive-probe-rt-1',
            'tier': 'probe',
            'url': 'https://rive.app/docs/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-14): https://rive.app/docs/llms.txt served an agent-oriented docs index ('# Rive') with every docs page mirrored as raw .md, spanning editor, AI Agent, MCP integration, scripting (Luau + WGSL), data binding, and all platform runtimes.",
            'fetchedAt': NOW,
        },
        {
            'id': 'rive-probe-rt-2',
            'tier': 'probe',
            'url': 'https://rive.app/docs/editor/ai/mcp.md',
            'excerpt': "PROBE runtime (recorded 2026-09-14): Rive's own MCP integration doc fetched keylessly as raw markdown — '# Rive MCP Integration', stating MCP is available in the desktop editor (Windows/macOS) with tools to create/manage Rive files, build shapes/layouts/component instances, edit state machines and keyframes, work with data binding, and edit Luau scripts/WGSL shaders.",
            'fetchedAt': NOW,
        },
    ],
    'penpot': [
        {
            'id': 'penpot-probe-rt-1',
            'tier': 'probe',
            'url': 'https://help.penpot.app/technical-guide/getting-started/',
            'excerpt': "PROBE runtime (recorded 2026-09-07): the OFFICIAL Penpot docker compose (vendor-published docker-compose.yaml: frontend, backend, exporter, postgres, valkey, and a first-party penpotapp/mcp service shipped with enable-mcp in the default flags) booted a REAL full self-hosted Penpot — the frontend answered '<title>Penpot | Full-stack design</title>' on :9001 within seconds of container start.",
            'fetchedAt': NOW,
        },
        {
            'id': 'penpot-probe-rt-2',
            'tier': 'probe',
            'url': 'https://penpot.dev/ai/mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-07): the self-hosted first-party penpot-mcp service completed a FULL keyless JSON-RPC initialize handshake over Streamable HTTP, answering serverInfo {\"name\":\"penpot\",\"version\":\"1.0.0\"} with tools capability and instructions pointing agents at its `high_level_overview` tool — an MCP server you run on your own infrastructure, no cloud account at all.",
            'fetchedAt': NOW,
        },
    ],
    'canva': [
        {
            'id': 'canva-probe-rt-1',
            'tier': 'probe',
            'url': 'https://www.canva.dev/docs/apps/quickstart.md',
            'excerpt': "PROBE runtime (recorded 2026-09-07): the official Canva Apps CLI ran keylessly from npm — `npx -y @canva/cli --version` printed `2.11.0` with no account.",
            'fetchedAt': NOW,
        },
        {
            'id': 'canva-probe-rt-2',
            'tier': 'probe',
            'url': 'https://www.canva.dev/docs/mcp.md',
            'excerpt': "PROBE runtime (recorded 2026-09-07): keyless JSON-RPC initialize POST to Canva's hosted MCP server https://mcp.canva.com/mcp returned HTTP 401 with WWW-Authenticate Bearer resource_metadata=https://mcp.canva.com/.well-known/oauth-protected-resource/mcp — the hosted MCP server documented at canva.dev/docs/mcp (design generation, editing, search, export, comments as MCP tools) is live and speaks the MCP OAuth flow.",
            'fetchedAt': NOW,
        },
    ],
    'framer': [
        {
            'id': 'framer-probe-rt-1',
            'tier': 'probe',
            'url': 'https://www.framer.com/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-07): https://www.framer.com/llms.txt served an agent-oriented index ('# Framer') that documents markdown mirrors of every page via ?md, canonical /agents/ and /agents/external/ pages for connecting Claude Code/Cursor/Codex to canvas content, and positions the product for AI agents.",
            'fetchedAt': NOW,
        },
    ],
    'sketch': [
        {
            'id': 'sketch-probe-rt-1',
            'tier': 'probe',
            'url': 'https://www.sketch.com/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-07): https://www.sketch.com/llms.txt served a full docs index ('# Sketch') for agent consumption, covering getting-started, prototyping, developer-handoff, and workspace docs.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'open-rankings/design-tools/evidence/{pid}.json'
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
