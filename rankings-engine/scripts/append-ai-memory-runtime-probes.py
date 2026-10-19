#!/usr/bin/env python3
# One-shot helper for the ai-memory arena bring-up (2026-09-05): appends probe-tier evidence
# items distilled from the recorded runtime probes in open-rankings/ai-memory/proofs/ (see
# rankings-engine/probes/ai-memory.ts — all 12 recorded probes passed).
# Run AFTER `pnpm engine probe --category ai-memory` — that stage wholesale-replaces
# probe-tier evidence and would wipe these items (re-run this script after any probe refresh).
import json
import datetime

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'mem0': [
        {
            'id': 'mem0-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.mem0.ai/platform/cli',
            'excerpt': "PROBE runtime (recorded 2026-09-05, mem0-cli 0.2.12 from pypi via uvx): `mem0 --help` runs keylessly and prints the full memory command surface — add/search/get/list/update/delete plus init/status/import/entity/event management and a --json agent mode — an official CLI an agent can drive end to end.",
            'fetchedAt': NOW,
        },
        {
            'id': 'mem0-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.mem0.ai/open-source/overview',
            'excerpt': "PROBE runtime (recorded 2026-09-05): pip package mem0ai 2.0.20 installs cleanly and `from mem0 import Memory` imports with no API key — the self-hosted OSS SDK is real and pip-installable (npm package mem0ai 3.1.8 also live on the registry).",
            'fetchedAt': NOW,
        },
        {
            'id': 'mem0-probe-rt-3',
            'tier': 'probe',
            'url': 'https://docs.mem0.ai/platform/mem0-mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-05): keyless JSON-RPC initialize POST to https://mcp.mem0.ai/mcp/ returned HTTP 401 with a `WWW-Authenticate: Bearer` OAuth challenge and protected-resource metadata (https://mcp.mem0.ai/.well-known/oauth-protected-resource) — the hosted Mem0 MCP server is live and speaks the MCP OAuth flow.",
            'fetchedAt': NOW,
        },
        {
            'id': 'mem0-probe-rt-4',
            'tier': 'probe',
            'url': 'https://docs.mem0.ai/platform/agent-signup',
            'excerpt': "PROBE llms.txt (fetched live 2026-09-05): docs.mem0.ai/llms.txt is written FOR agents — it documents autonomous agent signup (`mem0 init --agent` mints an evaluation API key in under 5 seconds with no email or dashboard; a human claims ownership later) plus routing rules, install commands, an OpenAPI spec link, and the hosted MCP endpoint.",
            'fetchedAt': NOW,
        },
    ],
    'zep': [
        {
            'id': 'zep-probe-rt-1',
            'tier': 'probe',
            'url': 'https://help.getzep.com/docs-mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-05): Zep's documentation MCP server at https://help.getzep.com/_mcp/server completed a full keyless JSON-RPC initialize handshake, answering with serverInfo {\"name\":\"fern-docs-mcp-server\"} over SSE — open agent access to the docs, no auth required.",
            'fetchedAt': NOW,
        },
        {
            'id': 'zep-probe-rt-2',
            'tier': 'probe',
            'url': 'https://help.getzep.com/memory-mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-05): keyless JSON-RPC initialize POST to the Memory MCP endpoint https://api.getzep.com/mcp returned HTTP 401 with `WWW-Authenticate: Bearer resource_metadata=\"https://api.getzep.com/.well-known/oauth-protected-resource/mcp\"` — the end-user Memory MCP server is live and IdP-gated exactly as documented.",
            'fetchedAt': NOW,
        },
        {
            'id': 'zep-probe-rt-3',
            'tier': 'probe',
            'url': 'https://help.getzep.com/graphiti/getting-started/overview',
            'excerpt': "PROBE runtime (recorded 2026-09-05): pypi graphiti-core 0.30.1 (Graphiti, Zep's open-source temporal knowledge-graph engine, 30.6k GitHub stars) installs and `from graphiti_core import Graphiti` imports with no API key — the OSS engine under Zep's Context Graphs is real and pip-installable.",
            'fetchedAt': NOW,
        },
    ],
    'letta': [
        {
            'id': 'letta-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.letta.com/platform/cli',
            'excerpt': "PROBE runtime (recorded 2026-09-05): `npx -y @letta-ai/letta-code --version` printed `0.31.12 (Letta Code)` keylessly — the official npm CLI installs and runs without an account.",
            'fetchedAt': NOW,
        },
        {
            'id': 'letta-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.letta.com/self-hosting',
            'excerpt': "PROBE runtime (recorded 2026-09-05): `letta server --backend local --listen ws://127.0.0.1:4500` booted the self-hosted App Server keylessly on this machine — no Letta account, no API key — and printed its listen URLs (`Listening on ws://127.0.0.1:4500`, `WebSocket: ws://127.0.0.1:4500/ws`); agent state stays on-device as documented.",
            'fetchedAt': NOW,
        },
    ],
    'supermemory': [
        {
            'id': 'supermemory-probe-rt-1',
            'tier': 'probe',
            'url': 'https://supermemory.ai/docs/supermemory-mcp/mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-05): keyless JSON-RPC initialize POST to https://mcp.supermemory.ai/mcp returned HTTP 401 with `WWW-Authenticate: Bearer resource_metadata=\"https://mcp.supermemory.ai/.well-known/oauth-protected-resource/mcp\"` — the hosted Supermemory MCP server is live and uses browser OAuth (no API key), as documented.",
            'fetchedAt': NOW,
        },
        {
            'id': 'supermemory-probe-rt-2',
            'tier': 'probe',
            'url': 'https://supermemory.ai/docs/api-reference/overview',
            'excerpt': "PROBE runtime (recorded 2026-09-05): GET https://supermemory.ai/openapi.json returned HTTP 200 with a machine-readable OpenAPI 3.1.0 spec (bearerAuth security scheme), and a keyless POST to the live API at https://api.supermemory.ai/v3/search drew a clean HTTP 401 — documented spec plus live, key-gated v3 API confirmed hands-on. (The docs-origin openapi probe's 404 is a path artifact: the spec lives at supermemory.ai/openapi.json.)",
            'fetchedAt': NOW,
        },
    ],
    'cognee': [
        {
            'id': 'cognee-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.cognee.ai/cognee-cli/overview',
            'excerpt': "PROBE runtime (recorded 2026-09-05, cognee 1.5.4 from pypi via uvx): `cognee-cli demo` ran a complete keyless memory roundtrip on this machine — loaded the bundled knowledge graph (47 nodes, 86 edges) into a local dataset and answered recall queries (\"Who works at Anthropic?\") using lexical retrieval with NO LLM key and no cloud; `cognee-cli forget --dataset demo` tore it down.",
            'fetchedAt': NOW,
        },
        {
            'id': 'cognee-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.cognee.ai/cognee-mcp/mcp-overview',
            'excerpt': "PROBE runtime (recorded 2026-09-05): first-party pypi package cognee-mcp 0.5.5 launched via uvx answered a stdio JSON-RPC initialize handshake with serverInfo {\"name\":\"Cognee\",\"version\":\"1.29.1\"} — the official MCP server runs locally, keylessly.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'open-rankings/ai-memory/evidence/{pid}.json'
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
