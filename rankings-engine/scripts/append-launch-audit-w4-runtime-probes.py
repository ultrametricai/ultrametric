#!/usr/bin/env python3
# Launch-audit wave 4 (2026-09-22), B5 evidence depth: appends probe-tier evidence items
# distilled from the recorded keyless probes for the claimed-docs-only products (zero prior
# probe/github-tier evidence) — muse, gemini (ai-assistants), motion (scheduling), tilled
# (marketplace-payments), notebooklm (ai-research-agents), sift (fraud-prevention),
# google-titan (security-keys), intel-core-ultra-7-258v + amd-ryzen-9-9950x3d (processors).
# Every item cites a PA_RECORD proof in open-rankings/<arena>/proofs/ (pipeline/probes/<arena>.ts);
# negatives are recorded honestly — an absence proof is still probe-tier.
# Run AFTER `pnpm pipeline probe --category <arena>` (and after any spike pass) — that stage
# wholesale-replaces probe-tier evidence and would wipe these items (re-run after refreshes).
import datetime
import json
import os
import sys

# Optional arena filter: `python3 ... <arena> [<arena> ...]` appends only those arenas (used
# by the wave-4 lane to fold each arena right after ITS spike pass, never mid-spike).
ONLY = set(sys.argv[1:])

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
DAY = NOW[:10]

ITEMS = {
    'ai-assistants': {
        'muse': [
            ('muse-probe-rt-1', 'https://muse.ai/llms.txt',
             f"PROBE runtime (recorded {DAY}): keyless GETs of https://muse.ai/llms.txt and https://muse.ai/openapi.json both returned HTTP 401 — Muse auth-walls its entire non-marketing surface. No published llms.txt, no public API spec; the 401 (rather than 404) shows the origin is live and the gating is deliberate."),
            ('muse-probe-rt-2', 'https://muse.ai/.well-known/mcp/server-card.json',
             f"PROBE runtime (recorded {DAY}): Muse publishes no MCP discovery surface — the .well-known MCP server card returned HTTP 404, and the api.muse.ai origin (which answers in application/json, so it exists) returned HTTP 404 on a keyless /v1/ping with no discovery or spec route. No keyless developer surface behind the assistant."),
        ],
        'gemini': [
            ('gemini-probe-rt-1', 'https://gemini.google.com/llms.txt',
             f"PROBE runtime (recorded {DAY}): the Gemini consumer app publishes neither an llms.txt nor a .well-known MCP server card on gemini.google.com — both returned clean HTTP 404s keylessly. The assistant app itself exposes no agent-docs or MCP discovery surface (the Gemini developer API is a separate product on ai.google.dev, not this app)."),
        ],
    },
    'scheduling': {
        'motion': [
            ('motion-probe-rt-1', 'https://www.usemotion.com/llms.txt',
             f"PROBE runtime (recorded {DAY}): https://www.usemotion.com/llms.txt served a text/plain agent-oriented overview ('# Usemotion') covering the AI calendar, meeting assistant, tasks, and pricing — published on the main origin (docs.usemotion.com answers /llms.txt with an HTML app shell, not a docs index)."),
            ('motion-probe-rt-2', 'https://docs.usemotion.com/api-reference/',
             f"PROBE runtime (recorded {DAY}): a keyless GET of https://api.usemotion.com/v1/tasks returned a clean structured HTTP 401 {{\"message\":\"Unauthorized\",\"statusCode\":401}} — the REST API documented at docs.usemotion.com/api-reference is live and enforces its documented X-API-Key auth."),
        ],
    },
    'marketplace-payments': {
        'tilled': [
            ('tilled-probe-rt-1', 'https://docs.tilled.com/api-reference',
             f"PROBE runtime (recorded {DAY}): a keyless GET of https://api.tilled.com/v1/payment-intents returned a structured HTTP 400 naming the documented header contract — {{\"statusCode\":400,\"message\":\"'tilled-account' header required.\"}} — the public API documented at docs.tilled.com/api-reference is live and validates its per-merchant header before auth even runs."),
            ('tilled-probe-rt-2', 'https://tilled.com/llms.txt',
             f"PROBE runtime (recorded {DAY}): Tilled publishes no llms.txt — https://tilled.com/llms.txt 308-redirects to www.tilled.com where it returns HTTP 404, and docs.tilled.com answers unknown paths with 500s. No agent-oriented docs index on either origin (absence recorded honestly)."),
        ],
    },
    'ai-research-agents': {
        'notebooklm': [
            ('notebooklm-probe-rt-1', 'https://support.google.com/gemininotebook/answer/16215270?hl=en',
             f"PROBE runtime (recorded {DAY}): the vendor's sources help page fetched keylessly and documents both sides of the research loop — upload-your-own-corpus ('sources for your notebook') and the Deep Research / Fast Research modes that gather web sources into the notebook. Crawlable HTML, no auth."),
            ('notebooklm-probe-rt-2', 'https://support.google.com/gemininotebook/answer/16322204?hl=en',
             f"PROBE runtime (recorded {DAY}): the public-notebooks help page fetched keylessly, documenting public notebook sharing (the arena's collaboration story) as served, crawlable HTML."),
        ],
    },
    'fraud-prevention': {
        'sift': [
            ('sift-probe-rt-1', 'https://developers.sift.com/docs/curl/events-api/overview',
             f"PROBE runtime (recorded {DAY}): a keyless POST to https://api.sift.com/v205/events returned Sift's documented status-51 error — {{\"status\":51,\"error_message\":\"Invalid API Key...\"}} — the Events API (the real-time scoring ingestion path documented at developers.sift.com) is live and answers keyless calls in its documented error vocabulary."),
            ('sift-probe-rt-2', 'https://sift.com/llms.txt',
             f"PROBE runtime (recorded {DAY}): https://sift.com/llms.txt served a real text/plain agent-oriented company/product overview ('# Sift — Fraud Prevention Platform for Digital Business', self-dated 'Last updated: 2026-08-13') — vendor-published agent docs on the main origin (developers.sift.com answers /llms.txt with a 403)."),
        ],
    },
    'security-keys': {
        'google-titan': [
            ('google-titan-probe-rt-1', 'https://cloud.google.com/security/products/titan-security-key',
             f"PROBE runtime (recorded {DAY}): Google's own Titan Security Key product page answered a keyless curl and names the product — the canonical spec surface (models, FIDO/U2F support) is live. Titan ships no vendor CLI, SDK, API, or MCP surface of its own (fleet management goes through the Google Workspace Admin console, a separate product) — spec-page liveness is the product's only keyless developer-facing surface."),
        ],
    },
    'processors': {
        'intel-core-ultra-7-258v': [
            ('intel-core-ultra-7-258v-probe-rt-1', 'https://www.intel.com/content/www/us/en/products/sku/240957/intel-core-ultra-7-processor-258v-12m-cache-up-to-4-80-ghz/specifications.html',
             f"PROBE runtime (recorded {DAY}): Intel's ARK specifications page for the Core Ultra 7 258V answered a keyless curl and names the part — a full machine-fetchable spec sheet (cores, clocks, power, memory support), same surface the 285K's recorded probe verifies."),
            ('intel-core-ultra-7-258v-probe-rt-2', 'https://www.intel.com/llms.txt',
             f"PROBE runtime (recorded {DAY}): https://www.intel.com/llms.txt served a real text/plain llms.txt (self-described as 'a structured index of intel.com content optimized for AI language model discovery', maintained quarterly) whose Products index links the Core Ultra series pages this part belongs to — vendor-published agent-discovery docs, fetched keylessly."),
        ],
        'amd-ryzen-9-9950x3d': [
            ('amd-ryzen-9-9950x3d-probe-rt-1', 'https://www.amd.com/en/products/processors/desktops/ryzen/9000-series/amd-ryzen-9-9950x3d.html',
             f"PROBE runtime (recorded {DAY}): a keyless non-browser fetch of AMD's 9950X3D spec page is refused by the www.amd.com bot wall — the connection is reset at the HTTP/2 layer (curl: (92) INTERNAL_ERROR) — so no spec value on the page is reachable by a crawler or agent without a rendering browser. The finding IS the transparency gap; AMD demonstrably exempts developer surfaces it wants agents to reach (ryzenai.docs.amd.com answers keylessly), and www.amd.com/llms.txt redirects to a 404 page."),
        ],
    },
}

for cat, products in ITEMS.items():
    if ONLY and cat not in ONLY:
        continue
    for pid, items in products.items():
        path = f'open-rankings/{cat}/evidence/{pid}.json'
        existing = json.load(open(path)) if os.path.exists(path) else []
        have = {e['id'] for e in existing}
        added = 0
        for eid, url, excerpt in items:
            if eid in have:
                continue
            existing.append({'id': eid, 'tier': 'probe', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
            added += 1
        open(path, 'w').write(json.dumps(existing, indent=2, ensure_ascii=False) + '\n')
        print(f'{cat}/{pid}: +{added} probe items ({len(existing)} total)')
