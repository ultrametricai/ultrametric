#!/usr/bin/env python3
# One-shot helper for the voice-agents arena bring-up (2026-09-05): appends probe-tier evidence
# items distilled from the recorded runtime probes in open-rankings/voice-agents/proofs/ (see
# rankings-engine/probes/voice-agents.ts — all 13 recorded probes passed).
# Run AFTER `pnpm engine probe --category voice-agents` — that stage wholesale-replaces
# probe-tier evidence and would wipe these items (re-run this script after any probe refresh).
import json
import datetime

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'vapi': [
        {
            'id': 'vapi-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.vapi.ai/cli',
            'excerpt': "PROBE runtime (recorded 2026-09-05): the official Vapi CLI installed via the vendor's one-liner (`curl -sSL https://vapi.ai/install.sh | bash`) and `vapi --version` printed `vapi version 0.2.1` keylessly, with man pages for assistant and call management.",
            'fetchedAt': NOW,
        },
        {
            'id': 'vapi-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.vapi.ai/sdk/mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-05): keyless JSON-RPC initialize POST to the hosted MCP server https://mcp.vapi.ai/mcp returned HTTP 401 — the endpoint is live and bearer-key-gated exactly as documented (API key as Authorization: Bearer).",
            'fetchedAt': NOW,
        },
    ],
    'retell': [
        {
            'id': 'retell-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.retellai.com/get-started/cli',
            'excerpt': "PROBE runtime (recorded 2026-09-05): `npx -y @retell-ai/retell-cli --version` printed `retell 0.13.0 (OpenAPI 3.0.0, catalog v4)` keylessly — the official npm CLI installs and runs without an account.",
            'fetchedAt': NOW,
        },
        {
            'id': 'retell-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.retellai.com/get-started/mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-05): the hosted MCP server at https://mcp.retellai.com completed a full KEYLESS JSON-RPC initialize handshake, answering serverInfo {\"name\":\"retell-sdk\",\"version\":\"3.0.0\"} with instructions describing its three meta-tools (list_api_endpoints, get_api_endpoint_schema, invoke_api_endpoint) — the entire Retell API is agent-reachable through MCP, with the API key only needed at tool-call time.",
            'fetchedAt': NOW,
        },
    ],
    'elevenlabs-agents': [
        {
            'id': 'elevenlabs-agents-probe-rt-1',
            'tier': 'probe',
            'url': 'https://www.npmjs.com/package/@elevenlabs/cli',
            'excerpt': "PROBE runtime (recorded 2026-09-05): `npx -y @elevenlabs/cli --version` printed `elevenlabs 1.1.0` keylessly — the official ElevenLabs CLI (successor to @elevenlabs/agents-cli, which now redirects to it) installs and runs from npm without an account.",
            'fetchedAt': NOW,
        },
        {
            'id': 'elevenlabs-agents-probe-rt-2',
            'tier': 'probe',
            'url': 'https://elevenlabs.io/docs/eleven-agents/operate/hosted-mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-05): keyless JSON-RPC initialize POST to the hosted MCP server https://api.elevenlabs.io/v1/mcp returned HTTP 401 with `WWW-Authenticate: Bearer resource_metadata=\"https://api.us.elevenlabs.io/.well-known/oauth-protected-resource\"` — the documented hosted MCP endpoint is live and speaks the MCP OAuth flow.",
            'fetchedAt': NOW,
        },
    ],
    'bland': [
        {
            'id': 'bland-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.bland.ai/sdks/cli',
            'excerpt': "PROBE runtime (recorded 2026-09-05): `npx -y bland-cli --version` printed `0.6.2` keylessly — the official npm CLI (bland-cli, with dev terminal) installs and runs without an account.",
            'fetchedAt': NOW,
        },
        {
            'id': 'bland-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.bland.ai/integrations/mcp/overview',
            'excerpt': "PROBE runtime (recorded 2026-09-05): keyless JSON-RPC initialize POST to the hosted MCP endpoint https://api.bland.ai/v1/mcp returned HTTP 401 — the remote MCP server is live and API-key-gated exactly as the MCP integration docs describe.",
            'fetchedAt': NOW,
        },
    ],
    'livekit-agents': [
        {
            'id': 'livekit-agents-probe-rt-1',
            'tier': 'probe',
            'url': 'https://github.com/livekit/livekit-cli',
            'excerpt': "PROBE runtime (recorded 2026-09-05): `lk --version` printed `lk version 2.18.6` after a plain `brew install livekit-cli` — the official CLI runs keylessly.",
            'fetchedAt': NOW,
        },
        {
            'id': 'livekit-agents-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.livekit.io/home/self-hosting/deployment.md',
            'excerpt': "PROBE runtime (recorded 2026-09-05): `livekit-server --dev` (brew-installed, Apache-2.0 OSS) booted on this machine with NO account or key — logs show 'starting in development mode' with placeholder keys, and http://localhost:7880 answered HTTP 200 — the self-hosted WebRTC/SIP backbone under LiveKit Agents verified hands-on.",
            'fetchedAt': NOW,
        },
        {
            'id': 'livekit-agents-probe-rt-3',
            'tier': 'probe',
            'url': 'https://docs.livekit.io/agents/start/voice-ai.md',
            'excerpt': "PROBE runtime (recorded 2026-09-05): pypi livekit-agents 1.8.0 installs and `import livekit.agents` succeeds with no key (npm @livekit/agents 1.8.0 also live, ~498k weekly downloads) — the open-source agents framework is real and pip-installable.",
            'fetchedAt': NOW,
        },
    ],
    'pipecat': [
        {
            'id': 'pipecat-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.pipecat.ai/api-reference/cli/overview.md',
            'excerpt': "PROBE runtime (recorded 2026-09-05): the official Pipecat CLI (pypi pipecat-ai[cli]) ran keylessly via uvx — `pipecat --help` lists init (project scaffolding), cloud (deploy to Pipecat Cloud), eval (behavioral evals), and context-hub (local docs/examples/API index built for coding agents).",
            'fetchedAt': NOW,
        },
        {
            'id': 'pipecat-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.pipecat.ai/pipecat/get-started/quickstart.md',
            'excerpt': "PROBE runtime (recorded 2026-09-05): pypi pipecat-ai 1.8.1 (BSD-2 OSS) installs and `import pipecat` succeeds with no key, printing its startup banner — the open-source voice-agent framework is real, pip-installable, and self-hostable.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'open-rankings/voice-agents/evidence/{pid}.json'
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
