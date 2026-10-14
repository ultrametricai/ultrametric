#!/usr/bin/env python3
# One-shot helper for the ai-code-review arena bring-up (2026-09-10): appends probe-tier
# evidence items distilled from the recorded runtime probes in open-rankings/ai-code-review/proofs/
# (see pipeline/probes/ai-code-review.ts — all 19 recorded probes passed). Run AFTER
# `pnpm pipeline probe --category ai-code-review` — that stage wholesale-replaces probe-tier
# evidence and would wipe these items (re-run this script after any probe refresh).
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'coderabbit': [
        {
            'id': 'coderabbit-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.coderabbit.ai/getting-started/quickstart',
            'excerpt': "PROBE runtime (recorded 2026-09-10): CodeRabbit's docs are agent-readable — https://docs.coderabbit.ai/llms.txt serves a live index ('# CodeRabbit', headline 'Agentic Change Management'), and every page serves a clean markdown mirror at URL+.md (getting-started/quickstart.md returned '# Quickstart' with a documentation-index preamble pointing agents at llms.txt).",
            'fetchedAt': NOW,
        },
    ],
    'greptile': [
        {
            'id': 'greptile-probe-rt-1',
            'tier': 'probe',
            'url': 'https://www.greptile.com/docs/mcp-v2/overview',
            'excerpt': "PROBE runtime (recorded 2026-09-10): Greptile's remote MCP server completed a FULL keyless JSON-RPC initialize handshake — POST https://api.greptile.com/mcp returned HTTP 200 with serverInfo {name: 'Greptile MCP Server', version: 1.0.0}, tools capability, and usage instructions for parsing tool results.",
            'fetchedAt': NOW,
        },
        {
            'id': 'greptile-probe-rt-2',
            'tier': 'probe',
            'url': 'https://www.greptile.com/docs/code-review/greptile-json-reference',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the public review API is live and cleanly auth-gated — a keyless POST to https://api.greptile.com/v2/repositories returned {\"error\":\"No API key provided\"}.",
            'fetchedAt': NOW,
        },
        {
            'id': 'greptile-probe-rt-3',
            'tier': 'probe',
            'url': 'https://www.greptile.com/docs/code-review/greptile-cli',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the official CLI installed keylessly from npm (npx -y greptile --version) and printed 3.5.2 — terminal-first code review an agent can script. Docs are agent-readable too: https://www.greptile.com/docs/llms.txt serves the index ('# Greptile') and every page mirrors to markdown at URL+.md (quickstart.md returned '# 5-Minute Quickstart'). Caveat recorded honestly: the old docs.greptile.com domain is dead/parked — the live docs moved under greptile.com/docs.",
            'fetchedAt': NOW,
        },
    ],
    'graphite': [
        {
            'id': 'graphite-probe-rt-1',
            'tier': 'probe',
            'url': 'https://graphite.com/docs/install-the-cli',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the official Graphite CLI installed keylessly from npm (npx -y @withgraphite/graphite-cli --version) and printed 1.8.6 (~50k weekly npm downloads).",
            'fetchedAt': NOW,
        },
        {
            'id': 'graphite-probe-rt-2',
            'tier': 'probe',
            'url': 'https://graphite.com/docs/ai-reviews',
            'excerpt': "PROBE runtime (recorded 2026-09-10): Graphite's docs serve llms.txt at https://graphite.com/docs/llms.txt ('# Graphite') and per-page markdown mirrors (ai-reviews.md returned '# AI Reviews'). Caveats recorded honestly: the site-root https://graphite.com/llms.txt is a soft-404 'Page not found', and the docs llms.txt links point at a mintlify.dev preview domain rather than the canonical graphite.com URLs (the same slugs do work on graphite.com).",
            'fetchedAt': NOW,
        },
    ],
    'qodo': [
        {
            'id': 'qodo-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.qodo.ai/agentic-toolbox/mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-10): Qodo's hosted MCP gateway is live and cleanly auth-gated — a keyless JSON-RPC initialize POST to https://sdk.qodo.ai/v1/tools/mcp/ returned HTTP 401 with WWW-Authenticate: Bearer realm=\"auth_required\" and {\"error\":{\"code\":\"MT-AUTH-MISSING\",\"message\":\"Bearer authentication is needed\"}}.",
            'fetchedAt': NOW,
        },
        {
            'id': 'qodo-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.qodo.ai/code-review/overview',
            'excerpt': "PROBE runtime (recorded 2026-09-10): Qodo's docs are agent-readable — https://docs.qodo.ai/llms.txt serves a live index ('# Qodo ... AI code review and governance platform', stamped 'Last updated: 2026-09-06'), and every page serves a markdown mirror at URL+.md (code-review/overview.md returned '# How Qodo code review works').",
            'fetchedAt': NOW,
        },
    ],
    'cursor-bugbot': [
        {
            'id': 'cursor-bugbot-probe-rt-1',
            'tier': 'probe',
            'url': 'https://cursor.com/docs/bugbot',
            'excerpt': "PROBE runtime (recorded 2026-09-10): Cursor's docs are agent-readable — https://cursor.com/llms.txt serves a live index ('# Cursor Documentation') with .md links for every page, and the Bugbot page's markdown mirror (https://cursor.com/docs/bugbot.md) returned '# Bugbot / Bugbot reviews pull requests and identifies bugs, security issues, and code quality problems.'",
            'fetchedAt': NOW,
        },
    ],
    'cubic': [
        {
            'id': 'cubic-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.cubic.dev/ide/mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-10): cubic's remote MCP server is live and cleanly auth-gated — a keyless JSON-RPC initialize POST to https://www.cubic.dev/api/mcp returned HTTP 401 with WWW-Authenticate: Bearer resource_metadata=\"https://www.cubic.dev/.well-known/oauth-protected-resource/api/mcp\".",
            'fetchedAt': NOW,
        },
        {
            'id': 'cubic-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.cubic.dev/ide/cli-review',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the official cubic CLI installed keylessly from npm (npx -y @cubic-dev-ai/cli --version) and printed 1.10.8. Docs are agent-readable: https://docs.cubic.dev/llms.txt serves the index ('# cubic documentation') and pages mirror to markdown at URL+.md (ai-review/quickstart.md returned '# Developer quickstart').",
            'fetchedAt': NOW,
        },
    ],
}

for product, items in ITEMS.items():
    path = f'open-rankings/ai-code-review/evidence/{product}.json'
    with open(path) as f:
        evidence = json.load(f)
    existing = {e['id'] for e in evidence}
    added = [i for i in items if i['id'] not in existing]
    evidence.extend(added)
    with open(path, 'w') as f:
        json.dump(evidence, f, indent=2)
        f.write('\n')
    print(f'{product}: +{len(added)} runtime probe items ({len(evidence)} total)')
