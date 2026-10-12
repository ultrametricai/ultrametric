#!/usr/bin/env python3
# One-shot helper for the durable-workflows arena bring-up (2026-09-10): appends probe-tier
# evidence items distilled from the recorded runtime probes in rankings/durable-workflows/proofs/
# (see pipeline/probes/durable-workflows.ts — all 28 recorded probes passed). Run AFTER
# `pnpm pipeline probe --category durable-workflows` — that stage wholesale-replaces probe-tier
# evidence and would wipe these items (re-run this script after any probe refresh). The arena's
# signature: every vendor ships a real CLI installable keylessly from a public registry, and
# every vendor serves llms.txt — the densest agent-legible arena probed so far.
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'temporal': [
        {
            'id': 'temporal-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.temporal.io',
            'excerpt': "PROBE runtime (recorded 2026-09-10): Temporal's docs are agent-legible — https://docs.temporal.io/llms.txt serves '# Temporal Platform Documentation' with instructions to append .md to any page URL, and per-page .md mirrors work (workflows.md returned '# Temporal Workflow').",
            'fetchedAt': NOW,
        },
        {
            'id': 'temporal-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.temporal.io/ai',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the hosted docs MCP server advertised under 'Tools for agents' in Temporal's own llms.txt is live — a keyless JSON-RPC initialize POST to https://temporal.mcp.kapa.ai answered HTTP 401 with WWW-Authenticate Bearer resource_metadata=.well-known/oauth-protected-resource, a real auth-gated MCP endpoint.",
            'fetchedAt': NOW,
        },
        {
            'id': 'temporal-probe-rt-3',
            'tier': 'probe',
            'url': 'https://docs.temporal.io/cli',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the official CLI runs locally and printed 'temporal version 1.8.3 (Server 1.31.2, UI 2.50.1)' — one binary bundling the client, a dev server, and the web UI for the local dev loop.",
            'fetchedAt': NOW,
        },
    ],
    'inngest': [
        {
            'id': 'inngest-probe-rt-1',
            'tier': 'probe',
            'url': 'https://www.inngest.com/docs',
            'excerpt': "PROBE runtime (recorded 2026-09-10): Inngest's llms.txt is live ('# Inngest — the durable workflow engine for AI applications') and docs serve markdown mirrors under /docs-markdown/ (learn/how-functions-are-executed returned '# How Inngest functions are executed: Durable Execution').",
            'fetchedAt': NOW,
        },
        {
            'id': 'inngest-probe-rt-2',
            'tier': 'probe',
            'url': 'https://www.inngest.com/docs/cli',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the official CLI installed keylessly from npm — `npx -y inngest-cli@latest --version` printed 'inngest version 1.44.0' (the CLI that runs the local Dev Server).",
            'fetchedAt': NOW,
        },
        {
            'id': 'inngest-probe-rt-3',
            'tier': 'probe',
            'url': 'https://www.inngest.com/docs/ai-dev-tools/mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the hosted Cloud MCP server is live — a keyless JSON-RPC initialize POST to https://api.inngest.com/mcp answered HTTP 401 with WWW-Authenticate: Bearer realm=\"inngest-mcp\" ('Missing or invalid access token'), the clean OAuth challenge of a real MCP endpoint (a local Dev Server MCP is also documented).",
            'fetchedAt': NOW,
        },
        {
            'id': 'inngest-probe-rt-4',
            'tier': 'probe',
            'url': 'https://api-docs.inngest.com',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the public REST API is live and cleanly auth-gated — a keyless GET to https://api.inngest.com/v1/events returned HTTP 401 {\"error\":\"Unauthorized\"} with an x-inngest-server-kind: cloud header.",
            'fetchedAt': NOW,
        },
    ],
    'trigger-dev': [
        {
            'id': 'trigger-dev-probe-rt-1',
            'tier': 'probe',
            'url': 'https://trigger.dev/docs',
            'excerpt': "PROBE runtime (recorded 2026-09-10): Trigger.dev's docs are agent-legible — https://trigger.dev/docs/llms.txt serves a live '# Trigger.dev' index and per-page .md mirrors work (how-it-works.md returned '# How Trigger.dev works').",
            'fetchedAt': NOW,
        },
        {
            'id': 'trigger-dev-probe-rt-2',
            'tier': 'probe',
            'url': 'https://trigger.dev/docs/cli-introduction',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the official CLI installed keylessly from npm — `npx -y trigger.dev@latest --version` printed 4.5.16.",
            'fetchedAt': NOW,
        },
        {
            'id': 'trigger-dev-probe-rt-3',
            'tier': 'probe',
            'url': 'https://trigger.dev/docs/mcp-introduction',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the CLI ships a first-party stdio MCP server — piping a JSON-RPC initialize into `npx -y trigger.dev@latest mcp` completed a FULL keyless handshake (protocolVersion 2025-06-18, serverInfo {name: trigger, version: 4.5.16}).",
            'fetchedAt': NOW,
        },
        {
            'id': 'trigger-dev-probe-rt-4',
            'tier': 'probe',
            'url': 'https://trigger.dev/docs/management/overview',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the public management API is live and cleanly auth-gated — a keyless GET to https://api.trigger.dev/api/v1/projects returned HTTP 401 with an RFC-7807 application/problem+json body {\"title\": \"Unauthorized\"}.",
            'fetchedAt': NOW,
        },
    ],
    'restate': [
        {
            'id': 'restate-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.restate.dev',
            'excerpt': "PROBE runtime (recorded 2026-09-10): Restate's docs are agent-legible — https://docs.restate.dev/llms.txt serves a live '# Restate' index and per-page .md mirrors work (hosting/overview.md returned '# Choose how to run Restate').",
            'fetchedAt': NOW,
        },
        {
            'id': 'restate-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.restate.dev/develop/ai-assistant',
            'excerpt': "PROBE runtime (recorded 2026-09-10): Restate's hosted docs MCP server completed a FULL keyless initialize handshake — a JSON-RPC POST to https://docs.restate.dev/mcp answered with protocolVersion 2025-06-18 and serverInfo {name: Restate, version: 1.0.0}, no auth wall at all.",
            'fetchedAt': NOW,
        },
        {
            'id': 'restate-probe-rt-3',
            'tier': 'probe',
            'url': 'https://docs.restate.dev/installation',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the official CLI installed keylessly from npm — `npx -y @restatedev/restate --version` printed 'restate-cli 1.7.9 (aarch64-apple-darwin)'.",
            'fetchedAt': NOW,
        },
    ],
    'hatchet': [
        {
            'id': 'hatchet-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.hatchet.run',
            'excerpt': "PROBE runtime (recorded 2026-09-10): Hatchet's docs are agent-legible — https://docs.hatchet.run/llms.txt serves '# Hatchet Documentation' and per-page .md mirrors work, demonstrated on the cookbook for exposing Hatchet tasks as agent tools (hatchet-and-mcp.md returned '# Hatchet and MCP: Exposing Tasks and Workflows as Agent Tools').",
            'fetchedAt': NOW,
        },
        {
            'id': 'hatchet-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.hatchet.run/reference/python',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the Python SDK installed keylessly from PyPI into a throwaway uvx environment and imported — printed 'hatchet-sdk 1.40.1'.",
            'fetchedAt': NOW,
        },
        {
            'id': 'hatchet-probe-rt-3',
            'tier': 'probe',
            'url': 'https://docs.hatchet.run/reference/cli',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the official CLI installer at https://install.hatchet.run/install.sh is real and public ('# Hatchet CLI Installation Script'), and Hatchet Cloud's API refuses keyless requests cleanly (HTTP 403, JSON content-type, hardened security headers).",
            'fetchedAt': NOW,
        },
    ],
    'dbos': [
        {
            'id': 'dbos-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.dbos.dev',
            'excerpt': "PROBE runtime (recorded 2026-09-10): DBOS's docs are agent-legible — https://docs.dbos.dev/llms.txt serves '# DBOS Documentation' with per-page .md links, and .md mirrors work (architecture.md returned '# DBOS Architecture').",
            'fetchedAt': NOW,
        },
        {
            'id': 'dbos-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.dbos.dev/quickstart',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the dbos CLI installed keylessly from PyPI into a throwaway uvx environment — `uvx --from dbos dbos --help` printed 'Usage: dbos [OPTIONS] COMMAND' with init/start/migrate/reset/postgres commands for the local dev loop.",
            'fetchedAt': NOW,
        },
        {
            'id': 'dbos-probe-rt-3',
            'tier': 'probe',
            'url': 'https://docs.dbos.dev/integrations/mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the official Conductor MCP server completed a FULL keyless stdio initialize handshake — piping a JSON-RPC initialize into `uvx dbos-mcp` answered with serverInfo {name: dbos-conductor}.",
            'fetchedAt': NOW,
        },
        {
            'id': 'dbos-probe-rt-4',
            'tier': 'probe',
            'url': 'https://docs.dbos.dev/production/conductor-api',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the Conductor control-plane API publishes a machine-readable OpenAPI 3.1 spec keylessly — https://cloud.dbos.dev/conductor/v2/openapi.json returned component schemas on a bare GET.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'rankings/durable-workflows/evidence/{pid}.json'
    with open(path) as f:
        evidence = json.load(f)
    existing = {e['id'] for e in evidence}
    new = [i for i in items if i['id'] not in existing]
    evidence.extend(new)
    with open(path, 'w') as f:
        json.dump(evidence, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print(f'{pid}: +{len(new)} runtime probe items ({len(evidence)} total)')
