#!/usr/bin/env python3
# One-shot helper for the gpu-clouds arena bring-up (2026-09-05): appends probe-tier evidence
# items distilled from the recorded runtime probes in open-rankings/gpu-clouds/proofs/ (see
# rankings-engine/probes/gpu-clouds.ts — all 12 recorded probes passed).
# Run AFTER `pnpm engine probe --category gpu-clouds` — that stage wholesale-replaces
# probe-tier evidence and would wipe these items (re-run this script after any probe refresh).
import json
import datetime

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'runpod': [
        {
            'id': 'runpod-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.runpod.io/runpodctl/overview.md',
            'excerpt': "PROBE runtime (recorded 2026-09-05): the official Runpod CLI installed via `brew install runpod/runpodctl/runpodctl` and ran keylessly — `runpodctl version` printed `runpodctl 2.12.0` and `runpodctl --help` lists pod, serverless, template, and hub resource management.",
            'fetchedAt': NOW,
        },
        {
            'id': 'runpod-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.runpod.io/get-started/mcp-servers.md',
            'excerpt': "PROBE runtime (recorded 2026-09-05): keyless JSON-RPC initialize POST to the hosted API MCP server https://mcp.getrunpod.io/ returned HTTP 401 with `WWW-Authenticate: Bearer realm=\"mcp\", resource_metadata=\".../.well-known/oauth-protected-resource\"` — the documented Sign-in-with-Runpod OAuth flow is live.",
            'fetchedAt': NOW,
        },
        {
            'id': 'runpod-probe-rt-3',
            'tier': 'probe',
            'url': 'https://docs.runpod.io/get-started/mcp-servers.md',
            'excerpt': "PROBE runtime (recorded 2026-09-05): the documented no-auth docs MCP server at https://docs.runpod.io/mcp completed a FULL keyless JSON-RPC initialize handshake, answering serverInfo over streamable HTTP — Runpod's documentation knowledge base is directly agent-reachable.",
            'fetchedAt': NOW,
        },
        {
            'id': 'runpod-probe-rt-4',
            'tier': 'probe',
            'url': 'https://docs.runpod.io/api-reference/overview.md',
            'excerpt': "PROBE runtime (recorded 2026-09-05): https://rest.runpod.io/v1/openapi.json serves the REST API's OpenAPI spec keylessly, and a bare GET to https://rest.runpod.io/v1/pods answers HTTP 401 — the Pod-provisioning REST API is live and API-key-gated exactly as documented.",
            'fetchedAt': NOW,
        },
    ],
    'lambda-labs': [
        {
            'id': 'lambda-labs-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs-api.lambda.ai/api/cloud',
            'excerpt': "PROBE runtime (recorded 2026-09-05): https://cloud.lambda.ai/api/v1/openapi.json serves the full Lambda Cloud API OpenAPI 3.1 spec (title 'Lambda Cloud API', documented rate limits: 1 req/s general, launch limited per 12s) keylessly, and a bare GET to /api/v1/instances answers HTTP 401 — the instance-provisioning REST API is live and key-gated.",
            'fetchedAt': NOW,
        },
    ],
    'coreweave': [
        {
            'id': 'coreweave-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.coreweave.com/products/cks/reference/cks-api.md',
            'excerpt': "PROBE runtime (recorded 2026-09-05): a bare GET to the documented CKS provisioning API https://api.coreweave.com/v1beta1/cks/clusters answered HTTP 401 — the cluster create/list/delete REST API is live and Bearer-token-gated exactly as the API reference describes.",
            'fetchedAt': NOW,
        },
        {
            'id': 'coreweave-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.coreweave.com/mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-05): the docs MCP endpoint https://docs.coreweave.com/mcp completed a FULL keyless JSON-RPC initialize handshake, answering serverInfo {\"name\":\"CoreWeave Docs\"} with search/retrieval tools over the documentation — CoreWeave's docs are directly agent-reachable over MCP.",
            'fetchedAt': NOW,
        },
    ],
    'vast-ai': [
        {
            'id': 'vast-ai-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.vast.ai/cli/hello-world.md',
            'excerpt': "PROBE runtime (recorded 2026-09-05): the official Vast.ai CLI (pypi `vastai`) installed via uvx and ran keylessly — `vastai --help` prints the full command surface including search offers, create instance, and destroy instance.",
            'fetchedAt': NOW,
        },
        {
            'id': 'vast-ai-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.vast.ai/cli/hello-world.md',
            'excerpt': "PROBE runtime (recorded 2026-09-05): `vastai search offers 'gpu_name=RTX_4090 num_gpus=1' -o dph` searched the LIVE GPU marketplace with NO account and NO API key, returning real RTX 4090 offers with CUDA versions, vCPUs, RAM, disk, and per-hour prices — an agent can comparison-shop the whole market before any signup.",
            'fetchedAt': NOW,
        },
        {
            'id': 'vast-ai-probe-rt-3',
            'tier': 'probe',
            'url': 'https://docs.vast.ai/api-reference/introduction.md',
            'excerpt': "PROBE runtime (recorded 2026-09-05): a bare keyless GET to https://console.vast.ai/api/v0/bundles/ returned live marketplace offers as JSON including `dph_total` (per-GPU-hour price), gpu_name, cpu specs, and reliability fields — the offer-search REST endpoint is public.",
            'fetchedAt': NOW,
        },
    ],
    'paperspace': [
        {
            'id': 'paperspace-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.digitalocean.com/reference/paperspace/pspace/install/',
            'excerpt': "PROBE runtime (recorded 2026-09-05): the official installer (`curl -fsSL https://paperspace.com/install.sh | sh`) installed the pspace CLI into ~/.paperspace/bin keylessly; `pspace version` printed `pspace v1.10.2` and `pspace --help` lists machine, custom-template, autoscaling-group, and deployment management.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'open-rankings/gpu-clouds/evidence/{pid}.json'
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
