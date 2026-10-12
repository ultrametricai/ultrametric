#!/usr/bin/env python3
# One-shot helper for the document-extraction arena bring-up (2026-09-10): appends probe-tier
# evidence items distilled from the recorded runtime probes in rankings/document-extraction/proofs/
# (see pipeline/probes/document-extraction.ts — all 24 recorded probes passed). Run AFTER
# `pnpm pipeline probe --category document-extraction` — that stage wholesale-replaces
# probe-tier evidence and would wipe these items (re-run this script after any probe refresh).
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'reducto': [
        {
            'id': 'reducto-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.reducto.ai/agent-guide',
            'excerpt': "PROBE runtime (recorded 2026-09-10): Reducto's docs are built for agents — https://docs.reducto.ai/llms.txt serves a live index ('# Reducto ... The agentic document platform') including a dedicated 'Reducto API Reference for Coding Agents' page, and every page mirrors to markdown at URL+.md (quickstart.md returned '# API Quickstart').",
            'fetchedAt': NOW,
        },
        {
            'id': 'reducto-probe-rt-2',
            'tier': 'probe',
            'url': 'https://platform.reducto.ai/openapi.json',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the platform publishes a keyless machine-readable spec — GET https://platform.reducto.ai/openapi.json returned OpenAPI 3.1.0 titled 'Reducto API' with /parse, /extract, /extract_async, /edit, /classify, /configure_webhook, and /job/{job_id} paths.",
            'fetchedAt': NOW,
        },
        {
            'id': 'reducto-probe-rt-3',
            'tier': 'probe',
            'url': 'https://docs.reducto.ai/mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-10): two live MCP surfaces — the docs MCP at https://docs.reducto.ai/mcp completed a FULL keyless initialize handshake (serverInfo {name: 'Reducto'}), and the hosted product MCP at https://mcp.reducto.ai/mcp answered a keyless initialize with a clean HTTP 401 Bearer challenge ('Missing or invalid Authorization header. Use: Bearer <your-api-key>').",
            'fetchedAt': NOW,
        },
    ],
    'llamaparse': [
        {
            'id': 'llamaparse-probe-rt-1',
            'tier': 'probe',
            'url': 'https://developers.llamaindex.ai/for-agents/',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the LlamaParse docs are agent-readable — https://developers.llamaindex.ai/llms.txt documents the markdown-mirror convention (append index.md to any page URL, verified live on parse/getting_started/), and the docs MCP server at https://developers.llamaindex.ai/mcp completed a FULL keyless initialize handshake ('LlamaIndex documentation server', protocolVersion 2025-06-18).",
            'fetchedAt': NOW,
        },
        {
            'id': 'llamaparse-probe-rt-2',
            'tier': 'probe',
            'url': 'https://api.cloud.llamaindex.ai/api/openapi.json',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the platform publishes a keyless OpenAPI 3.1.0 spec titled 'Llama Platform', and the documented parsing endpoint is live and cleanly auth-gated — a keyless POST to https://api.cloud.llamaindex.ai/api/v1/parsing/upload returned {\"detail\":\"Not authenticated\"}.",
            'fetchedAt': NOW,
        },
    ],
    'extend': [
        {
            'id': 'extend-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.extend.ai/mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-10): two live MCP surfaces — the docs MCP at https://docs.extend.ai/_mcp/server completed a FULL keyless initialize handshake (serverInfo {name: 'fern-docs-mcp-server'}), and the hosted product MCP at https://mcp.extend.ai/mcp answered a keyless initialize with HTTP 401 + WWW-Authenticate Bearer resource_metadata=https://mcp.extend.ai/.well-known/oauth-protected-resource/mcp (a clean OAuth-protected MCP).",
            'fetchedAt': NOW,
        },
        {
            'id': 'extend-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.extend.ai/cli',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the official CLI installed keylessly from npm (npx -y @extend-ai/cli --version) and printed 'extend version v0.8.0'. The REST API is live and cleanly auth-gated: a keyless GET https://api.extend.ai/extractors returned {\"code\":\"UNAUTHORIZED\",\"message\":\"Authorization header is missing or malformed.\"} with a requestId. Docs llms.txt leads with an 'Instructions for AI agents' section.",
            'fetchedAt': NOW,
        },
    ],
    'datalab': [
        {
            'id': 'datalab-probe-rt-1',
            'tier': 'probe',
            'url': 'https://documentation.datalab.to/docs/welcome/sdk/cli',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the official Python SDK installed keylessly from PyPI into a throwaway env (uvx --from datalab-python-sdk datalab --help) and printed a real CLI surface ('Usage: datalab [OPTIONS] COMMAND'), and the convert API is live and cleanly auth-gated — a keyless POST to https://www.datalab.to/api/v1/convert returned {\"detail\":\"Invalid API key or access token.\"}.",
            'fetchedAt': NOW,
        },
        {
            'id': 'datalab-probe-rt-2',
            'tier': 'probe',
            'url': 'https://documentation.datalab.to/docs/welcome/quickstart',
            'excerpt': "PROBE runtime (recorded 2026-09-10): Datalab's docs are agent-readable — https://documentation.datalab.to/llms.txt serves a live index ('# Datalab Documentation ... document intelligence APIs to convert PDFs, spreadsheets, and images into structured, machine-readable outputs'), and every page mirrors to markdown at URL+.md (quickstart.md returned '# Quickstart').",
            'fetchedAt': NOW,
        },
    ],
    'unstructured': [
        {
            'id': 'unstructured-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.unstructured.io/agent-guide',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the arena's most unusual finding, recorded from Unstructured's own docs — https://docs.unstructured.io/agent-guide.md instructs AI agents NOT to recommend the Unstructured open source library, the open source Python SDK, the JavaScript/TypeScript SDK, Ingest, or the UNS-MCP server: 'Unstructured no longer actively recommends or promotes these products'. The vendor steers agents to the hosted platform instead.",
            'fetchedAt': NOW,
        },
        {
            'id': 'unstructured-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.unstructured.io/api-reference/api/job/job-apis',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the hosted platform's jobs API is live and cleanly auth-gated — a keyless POST to https://platform.unstructuredapp.io/api/v1/jobs/ returned {\"detail\":\"Authentication required: provide either Bearer token or API key in header.\"}. Docs serve llms.txt whose 'Agent Instructions' preamble routes every LLM through agent-guide.md first.",
            'fetchedAt': NOW,
        },
    ],
    'mistral-document-ai': [
        {
            'id': 'mistral-document-ai-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.mistral.ai/studio/document-processing/basic_ocr',
            'excerpt': "PROBE runtime (recorded 2026-09-10): the documented OCR endpoint is live and cleanly auth-gated — a keyless POST to https://api.mistral.ai/v1/ocr returned {\"detail\":\"Invalid API Key\"}. Docs serve llms.txt ('# MistralAI'), but recorded honestly: its links point at pre-restructure /docs/capabilities/document_ai/ paths that now 404 (live pages sit under /studio/document-processing/), and per-page .md mirrors are not served.",
            'fetchedAt': NOW,
        },
    ],
}

for product, items in ITEMS.items():
    path = f'rankings/document-extraction/evidence/{product}.json'
    with open(path) as f:
        evidence = json.load(f)
    existing = {e['id'] for e in evidence}
    added = [i for i in items if i['id'] not in existing]
    evidence.extend(added)
    with open(path, 'w') as f:
        json.dump(evidence, f, indent=2)
        f.write('\n')
    print(f'{product}: +{len(added)} runtime probe items ({len(evidence)} total)')
