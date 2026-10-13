#!/usr/bin/env python3
# One-shot helper for the docs-platforms arena bring-up (2026-09-08): appends probe-tier
# evidence items distilled from the recorded runtime probes in rankings/docs-platforms/proofs/
# (see pipeline/probes/docs-platforms.ts — all 20 recorded probes
# passed). Run AFTER `pnpm pipeline probe --category docs-platforms` — that stage wholesale-
# replaces probe-tier evidence and would wipe these items (re-run this script after any probe
# refresh). The arena's signature: every excerpt below is a vendor demonstrating ON ITS OWN
# DOCS the agent-docs feature it sells to customers.
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'mintlify': [
        {
            'id': 'mintlify-probe-rt-1',
            'tier': 'probe',
            'url': 'https://www.mintlify.com/docs/ai/llmstxt',
            'excerpt': "PROBE runtime (recorded 2026-09-08): Mintlify drinks its own champagne — its own docs serve a live llms.txt index at https://www.mintlify.com/docs/llms.txt ('# Mintlify ... making it accessible to AI agents'), and every page serves a clean markdown mirror at URL+.md (https://www.mintlify.com/docs/quickstart.md returned '# Quickstart' with an agent-oriented documentation-index preamble).",
            'fetchedAt': NOW,
        },
        {
            'id': 'mintlify-probe-rt-2',
            'tier': 'probe',
            'url': 'https://www.mintlify.com/docs/ai/model-context-protocol',
            'excerpt': "PROBE runtime (recorded 2026-09-08): the per-site Search MCP server Mintlify generates for every customer docs site is live on its own docs — a keyless JSON-RPC initialize POST to https://www.mintlify.com/docs/mcp completed a FULL handshake (HTTP 200, event-stream, serverInfo with tools capability).",
            'fetchedAt': NOW,
        },
        {
            'id': 'mintlify-probe-rt-3',
            'tier': 'probe',
            'url': 'https://www.mintlify.com/docs/search-index/mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-08): the Mintlify Index MCP at https://index.mintlify.com completed a FULL keyless initialize handshake — serverInfo {name: mintlify-universal-search, version: 1.0.0} with instructions for research across publisher docs and the web; response headers advertise a 5,000-request/day keyless rate limit.",
            'fetchedAt': NOW,
        },
        {
            'id': 'mintlify-probe-rt-4',
            'tier': 'probe',
            'url': 'https://www.mintlify.com/docs/ai/mintlify-mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-08): the hosted admin MCP server (write access for AI tools to edit pages and open PRs) is live and cleanly auth-gated — a keyless initialize POST to https://mcp.mintlify.com returned HTTP 401 with WWW-Authenticate Bearer resource_metadata=https://mcp.mintlify.com/.well-known/oauth-protected-resource.",
            'fetchedAt': NOW,
        },
        {
            'id': 'mintlify-probe-rt-5',
            'tier': 'probe',
            'url': 'https://www.mintlify.com/docs/cli/install',
            'excerpt': "PROBE runtime (recorded 2026-09-08): the official CLI installed keylessly from npm (npx -y mint) and printed its command surface, including `mint validate` (strict build validation), `mint broken-links`, `mint export` (static site export for air-gapped deployment), and `mint dev` local preview.",
            'fetchedAt': NOW,
        },
    ],
    'gitbook': [
        {
            'id': 'gitbook-probe-rt-1',
            'tier': 'probe',
            'url': 'https://gitbook.com/docs/getting-started/llm-ready-docs',
            'excerpt': "PROBE runtime (recorded 2026-09-08): GitBook's own docs serve a live llms.txt at https://gitbook.com/docs/llms.txt ('# GitBook ...'), and every published page serves a markdown mirror at URL+.md (https://gitbook.com/docs/getting-started/quickstart.md returned '# Quickstart' with a preamble pointing agents at the llms.txt index).",
            'fetchedAt': NOW,
        },
        {
            'id': 'gitbook-probe-rt-2',
            'tier': 'probe',
            'url': 'https://gitbook.com/docs/ai-for-your-readers/mcp-servers-for-published-docs',
            'excerpt': "PROBE runtime (recorded 2026-09-08): the MCP server GitBook auto-generates for every published site is live on GitBook's own docs — a keyless JSON-RPC initialize POST to https://gitbook.com/docs/~gitbook/mcp completed a FULL handshake (HTTP 200 event-stream, serverInfo, tools capability with listChanged).",
            'fetchedAt': NOW,
        },
        {
            'id': 'gitbook-probe-rt-3',
            'tier': 'probe',
            'url': 'https://gitbook.com/docs/docs-as-code/gitbook-mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-08): GitBook's organization-level write MCP server (create sites, open change requests, edit content) is live and cleanly auth-gated — a keyless initialize POST to https://mcp.gitbook.com/mcp returned HTTP 401 with WWW-Authenticate Bearer resource_metadata=https://mcp.gitbook.com/.well-known/oauth-protected-resource.",
            'fetchedAt': NOW,
        },
    ],
    'readme': [
        {
            'id': 'readme-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.readme.com/main/docs/ai-discoverability',
            'excerpt': "PROBE runtime (recorded 2026-09-08): ReadMe's own docs serve llms.txt with built-in retrieval — https://docs.readme.com/llms.txt?query=mcp+server returned a ranked 'Search Results' list of matching pages, and every page serves a markdown mirror at URL+.md (your-projects-mcp-server.md returned '# MCP' with agent-oriented usage instructions in the preamble).",
            'fetchedAt': NOW,
        },
        {
            'id': 'readme-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.readme.com/main/docs/your-projects-mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-08): the per-project MCP server ReadMe ships for customer docs hubs is live on ReadMe's own docs — a keyless JSON-RPC initialize POST to https://docs.readme.com/mcp completed a FULL handshake with serverInfo {name: 'ReadMe Documentation', version: 1.0.0}.",
            'fetchedAt': NOW,
        },
        {
            'id': 'readme-probe-rt-3',
            'tier': 'probe',
            'url': 'https://github.com/readmeio/rdme',
            'excerpt': "PROBE runtime (recorded 2026-09-08): the official rdme CLI installed keylessly from npm (npx -y rdme --version) and printed rdme/10.9.6 darwin-arm64 — the docs-as-code sync surface an agent or CI pipeline drives headlessly.",
            'fetchedAt': NOW,
        },
    ],
    'docusaurus': [
        {
            'id': 'docusaurus-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docusaurus.io/docs/installation',
            'excerpt': "PROBE runtime (recorded 2026-09-08): a real keyless scaffold roundtrip — `npx -y create-docusaurus@latest pa-probe classic --typescript --skip-install` in a throwaway fixture generated a complete self-hostable docs site (docusaurus.config.ts, sidebars.ts, docs/, blog/, src/, static/) with no account, no keys, and no vendor lock-in.",
            'fetchedAt': NOW,
        },
    ],
    'fern': [
        {
            'id': 'fern-probe-rt-1',
            'tier': 'probe',
            'url': 'https://buildwithfern.com/learn/docs/ai-features/mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-08): Fern's docs MCP server is live on its own docs — a keyless JSON-RPC initialize POST to https://buildwithfern.com/learn/_mcp/server completed a FULL handshake with serverInfo {name: fern-docs-mcp-server, version: 1.0.0}. Caveat, recorded honestly: Fern's own llms.txt advertises the endpoint as https://buildwithfern.com/_mcp/server, which returns 404 — the live endpoint sits under the /learn docs subpath.",
            'fetchedAt': NOW,
        },
        {
            'id': 'fern-probe-rt-2',
            'tier': 'probe',
            'url': 'https://buildwithfern.com/learn/docs/ai-features/llms-txt',
            'excerpt': "PROBE runtime (recorded 2026-09-08): Fern's own docs drink the champagne — https://buildwithfern.com/llms.txt opens with a literal '## Instructions for AI Agents' section (append .md to any page, per-section llms.txt indexes), and the .md mirror works on the very page documenting the feature (llms-txt.md returned '# `llms.txt`').",
            'fetchedAt': NOW,
        },
        {
            'id': 'fern-probe-rt-3',
            'tier': 'probe',
            'url': 'https://buildwithfern.com/openapi.json',
            'excerpt': "PROBE runtime (recorded 2026-09-08): every Fern-hosted docs domain serves a machine-readable spec — a keyless GET https://buildwithfern.com/openapi.json returned OpenAPI 3.1.0 titled 'Fern Public API' (scoped docs tokens, search credentials, current-user resolution).",
            'fetchedAt': NOW,
        },
        {
            'id': 'fern-probe-rt-4',
            'tier': 'probe',
            'url': 'https://buildwithfern.com/learn/cli-api-reference/cli-reference/overview',
            'excerpt': "PROBE runtime (recorded 2026-09-08): the official Fern CLI installed keylessly from npm (npx -y fern-api --version) and printed 5.115.0.",
            'fetchedAt': NOW,
        },
    ],
}

for product, items in ITEMS.items():
    path = f'rankings/docs-platforms/evidence/{product}.json'
    with open(path) as f:
        evidence = json.load(f)
    existing = {e['id'] for e in evidence}
    added = [i for i in items if i['id'] not in existing]
    evidence.extend(added)
    with open(path, 'w') as f:
        json.dump(evidence, f, indent=2)
        f.write('\n')
    print(f'{product}: +{len(added)} runtime probe items ({len(evidence)} total)')
