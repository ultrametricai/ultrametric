#!/usr/bin/env python3
# One-shot helper for the ai-support-agents arena bring-up (2026-09-10): appends probe-tier
# evidence items distilled from the recorded runtime probes in rankings/ai-support-agents/proofs/
# (see pipeline/probes/ai-support-agents.ts — all 22 recorded probes passed). Run AFTER
# `pnpm pipeline probe --category ai-support-agents` — that stage wholesale-replaces probe-tier
# evidence and would wipe these items (re-run this script after any probe refresh). The arena's
# signature split, recorded honestly in both directions: Fin/Pylon/Lorikeet/Parahelp expose
# agent-legible docs and cleanly auth-gated keyless API/MCP surfaces; Sierra and Decagon
# login-gate their technical docs entirely — a finding, not a gap.
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'intercom-fin': [
        {
            'id': 'intercom-fin-probe-rt-1',
            'tier': 'probe',
            'url': 'https://fin.ai/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-10): Fin publishes agent-legible docs on both its surfaces — https://fin.ai/llms.txt serves a live '# Fin — llms.txt' index, and https://developers.intercom.com/llms.txt serves '# Intercom and Fin Developer Platform' with a per-page .md table of contents for the whole API doc set.",
            'fetchedAt': NOW,
        },
        {
            'id': 'intercom-fin-probe-rt-2',
            'tier': 'probe',
            'url': 'https://developers.intercom.com/docs/references/introduction',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the public REST API is live and cleanly auth-gated — a keyless GET to https://api.intercom.io/me returned HTTP 401 with structured JSON {\"type\":\"error.list\",\"errors\":[{\"code\":\"missing_authorization\"}]} and a request id.",
            'fetchedAt': NOW,
        },
        {
            'id': 'intercom-fin-probe-rt-3',
            'tier': 'probe',
            'url': 'https://developers.intercom.com/docs/guides/mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the documented hosted MCP server is live — a keyless JSON-RPC initialize POST to https://mcp.intercom.com/mcp answered HTTP 401 with WWW-Authenticate: Bearer realm=\"OAuth\", error=\"invalid_token\" — the OAuth challenge of a real, auth-gated MCP endpoint.",
            'fetchedAt': NOW,
        },
        {
            'id': 'intercom-fin-probe-rt-4',
            'tier': 'probe',
            'url': 'https://github.com/intercom/intercom-node',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the official Node SDK is published and current on the public npm registry — `npm view intercom-client name version` returned intercom-client 7.x (registry reports ~247K weekly downloads).",
            'fetchedAt': NOW,
        },
    ],
    'decagon': [
        {
            'id': 'decagon-probe-rt-1',
            'tier': 'probe',
            'url': 'https://decagon.ai/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-10): decagon.ai serves a live llms.txt ('# Decagon' with a resource index) — the marketing site is agent-legible even though the technical docs are not.",
            'fetchedAt': NOW,
        },
        {
            'id': 'decagon-probe-rt-2',
            'tier': 'probe',
            'url': 'https://decagon.ai/product/overview',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the public sitemap enumerates Decagon's product surface keylessly — /product/ pages for aop, chat, email, voice, integrations, testing-qa, insights-and-reporting, watchtower, experiments, suggestions, and duet.",
            'fetchedAt': NOW,
        },
        {
            'id': 'decagon-probe-rt-3',
            'tier': 'probe',
            'url': 'https://docs.decagon.ai/',
            'excerpt': "PROBE runtime finding (recorded 2026-09-10): docs.decagon.ai is login-gated — a keyless request redirects to /login (Vercel-hosted), so Decagon publishes no public technical documentation, llms.txt, or .md mirrors for agents or evaluating buyers to read.",
            'fetchedAt': NOW,
        },
    ],
    'sierra': [
        {
            'id': 'sierra-probe-rt-1',
            'tier': 'probe',
            'url': 'https://sierra.ai/resources/research/tau-bench',
            'excerpt': "PROBE runtime (recorded 2026-09-10): Sierra's agent benchmark is genuinely open — the official sierra-research/tau-bench repository README fetched keylessly from GitHub, the published benchmark for evaluating conversational agents on simulated user interactions.",
            'fetchedAt': NOW,
        },
        {
            'id': 'sierra-probe-rt-2',
            'tier': 'probe',
            'url': 'https://sierra.ai/product/agent-sdk',
            'excerpt': "PROBE runtime (recorded 2026-09-10): sierra.ai's public sitemap enumerates the platform surface keylessly — /product/ pages for agent-sdk, agent-studio, channels, voice, insights, explorer, live-assist, trust-and-reliability, ghostwriter, and horizon.",
            'fetchedAt': NOW,
        },
        {
            'id': 'sierra-probe-rt-3',
            'tier': 'probe',
            'url': 'https://docs.sierra.ai/',
            'excerpt': "PROBE runtime finding (recorded 2026-09-10): docs.sierra.ai has no agent-legible surface — /llms.txt resolves (HTTP 200) to the login SPA's text/html shell rather than a plain-text index; the docs and Agent SDK reference are login-gated to contracted customers.",
            'fetchedAt': NOW,
        },
    ],
    'pylon': [
        {
            'id': 'pylon-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.usepylon.com/pylon-docs/integrations/pylon-mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-10): Pylon's docs are agent-legible — https://docs.usepylon.com/pylon-docs/llms.txt serves a live '# Pylon' index, and per-page .md mirrors work (integrations/pylon-mcp.md returned '# Pylon MCP' documenting the server URL https://mcp.usepylon.com, OAuth 2.0/AuthKit, Streamable HTTP).",
            'fetchedAt': NOW,
        },
        {
            'id': 'pylon-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.usepylon.com/pylon-docs/developer/api/api-reference',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the public REST API at api.usepylon.com is live and cleanly auth-gated — a keyless GET returned HTTP 401 with an x-pylon-request-id header and structured JSON: 'Token must follow Bearer authorization scheme' citing RFC 6750.",
            'fetchedAt': NOW,
        },
        {
            'id': 'pylon-probe-rt-3',
            'tier': 'probe',
            'url': 'https://docs.usepylon.com/pylon-docs/integrations/pylon-mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the first-party MCP server is live — a keyless JSON-RPC initialize POST to https://mcp.usepylon.com answered HTTP 401 with WWW-Authenticate: Bearer resource_metadata=\"https://mcp.usepylon.com/.well-known/oauth-protected-resource\" (the metadata endpoint itself is publicly readable).",
            'fetchedAt': NOW,
        },
    ],
    'lorikeet': [
        {
            'id': 'lorikeet-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.lorikeetcx.ai/mcp/mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-10): Lorikeet's public docs index leads with its MCP server — https://docs.lorikeetcx.ai/llms.txt lists 'Lorikeet MCP Server' and per-page .md mirrors work (mcp/mcp-server.md returned '# Lorikeet MCP Server' documenting the OAuth remote server at https://mcp.lorikeetcx.ai).",
            'fetchedAt': NOW,
        },
        {
            'id': 'lorikeet-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.lorikeetcx.ai/api-reference',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the public API at api.lorikeetcx.ai answers keyless requests with a structured RFC-7807-style error — 'Missing LORIKEET_CLIENT_ID in authorization header' with a type URL linking its own error documentation.",
            'fetchedAt': NOW,
        },
        {
            'id': 'lorikeet-probe-rt-3',
            'tier': 'probe',
            'url': 'https://docs.lorikeetcx.ai/mcp/mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the hosted MCP endpoint https://mcp.lorikeetcx.ai is live — a keyless GET is refused with HTTP 405 Method Not Allowed, consistent with a streamable-HTTP MCP server that only speaks POST.",
            'fetchedAt': NOW,
        },
    ],
    'parahelp': [
        {
            'id': 'parahelp-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.parahelp.com/customer-agent/api',
            'excerpt': "PROBE runtime (recorded 2026-09-10): Parahelp's docs are agent-legible (Mintlify) — https://docs.parahelp.com/llms.txt serves '# Parahelp docs' with a per-page .md index, and .md mirrors work (customer-agent/api.md returned '# API' pointing at the full reference).",
            'fetchedAt': NOW,
        },
        {
            'id': 'parahelp-probe-rt-2',
            'tier': 'probe',
            'url': 'https://app.parahelp.com/api/docs',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the public API reference at https://app.parahelp.com/api/docs is reachable keylessly — no login wall in front of the API documentation surface.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'rankings/ai-support-agents/evidence/{pid}.json'
    with open(path) as f:
        evidence = json.load(f)
    existing = {e['id'] for e in evidence}
    new = [i for i in items if i['id'] not in existing]
    evidence.extend(new)
    with open(path, 'w') as f:
        json.dump(evidence, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print(f'{pid}: +{len(new)} runtime probe items ({len(evidence)} total)')
