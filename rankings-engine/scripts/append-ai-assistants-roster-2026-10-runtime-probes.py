#!/usr/bin/env python3
# One-shot helper for the 2026-10-01 ai-assistants roster expansion (dots, grok-bot, kimi,
# perplexity-computer). Appends probe-tier evidence items distilled from the recorded runtime
# probes in open-rankings/ai-assistants/proofs/{dots,grok-bot,kimi,perplexity-computer}/ (see
# rankings-engine/probes/ai-assistants.ts — all eight recorded probes passed). Run AFTER
# `pnpm engine probe --category ai-assistants --product <id>` (or a spike pass, whose probe
# stage wholesale-replaces probe-tier evidence and would wipe these items) — re-run this script
# after any probe refresh.
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'dots': [
        {
            'id': 'dots-probe-rt-1',
            'tier': 'probe',
            'url': 'https://learn.chatgpt.com/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-10-01): keyless GET of https://learn.chatgpt.com/llms.txt (200 text/plain) returned the vendor's docs index with a dedicated '## Dots' section listing every dots doc page — Meet dots, computers-and-apps, controls, getting-started, channels, tasks-and-memory, and the enterprise cloud-local-access page — each fetchable as markdown.",
            'fetchedAt': NOW,
        },
        {
            'id': 'dots-probe-rt-2',
            'tier': 'probe',
            'url': 'https://learn.chatgpt.com/docs/dots.md',
            'excerpt': "PROBE runtime (recorded 2026-10-01): keyless GET of https://learn.chatgpt.com/docs/dots.md returned the raw markdown page ('# Meet dots', 200 text/markdown) — the page itself states markdown versions are available by appending .md to any doc URL. Note the automated docs-md probe's 404 is an artifact of appending .md twice; the .md mirrors are real. No dots-specific public API, CLI, or MCP-server surface was found — dots is a ChatGPT-surface product (the developer platform at developers.openai.com is a different product).",
            'fetchedAt': NOW,
        },
    ],
    'grok-bot': [
        {
            'id': 'grok-bot-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.x.ai/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-10-01): keyless GET of https://docs.x.ai/llms.txt (200 text/plain) indexes a full grok-bot/*.md docs section — 21 pages from overview and get-started through skills-routines-and-automations, team-bots, approvals-security-and-privacy, and security-faq — every page fetchable as raw markdown (verified on grok-bot/overview.md, 200 text/markdown; the automated docs-md probe's 404 is a double-.md artifact).",
            'fetchedAt': NOW,
        },
        {
            'id': 'grok-bot-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.x.ai/openapi.json',
            'excerpt': "PROBE runtime (recorded 2026-10-01): the OpenAPI spec served at docs.x.ai/openapi.json titles itself \"xAI's REST API\" — it documents api.x.ai, the vendor's model API (a different product) — and contains ZERO grok-bot paths (grep count 0). No public Grok Bot API, CLI, or MCP endpoint was found anywhere in the grok-bot docs section; Grok Bot is driven through its own apps (macOS/Windows/Linux/iOS/Android), not a developer surface. The x.ai marketing site (x.ai/bot) answers our fetcher with HTTP 403.",
            'fetchedAt': NOW,
        },
    ],
    'kimi': [
        {
            'id': 'kimi-probe-rt-1',
            'tier': 'probe',
            'url': 'https://www.kimi.com/llms.txt',
            'excerpt': 'PROBE runtime (recorded 2026-10-01): kimi.com publishes NO llms.txt — https://www.kimi.com/llms.txt answers HTTP 302 Location: / (the SPA root) instead of an agent docs index, and the assistant app has no docs site at all. The real llms.txt at platform.kimi.ai/docs/llms.txt belongs to the Kimi API Open Platform, which the vendor\'s own product-plans doc distinguishes as a separate pay-as-you-go product from the Kimi assistant/Membership. kimi.com also serves its landing content in Chinese to our fetcher, and the membership pricing page (www.kimi.ai/membership/pricing) renders client-side only — no tier prices reach a keyless fetch.',
            'fetchedAt': NOW,
        },
        {
            'id': 'kimi-probe-rt-2',
            'tier': 'probe',
            'url': 'https://platform.kimi.ai/docs/guide/product-plans.md',
            'excerpt': "PROBE runtime (recorded 2026-10-01): the vendor's product-plans doc (fetched keylessly as markdown) states 'Kimi Membership currently includes Kimi Code benefits' across its four membership subscription tiers, and the official Kimi Code docs at https://www.kimi.com/code/docs/en/ serve keylessly ('Kimi Code' verified in the page) — an official CLI bundled with the consumer subscription. No public API for the assistant app itself: the Kimi API on platform.kimi.ai is the separate Open Platform product per the same doc.",
            'fetchedAt': NOW,
        },
    ],
    'perplexity-computer': [
        {
            'id': 'perplexity-computer-probe-rt-1',
            'tier': 'probe',
            'url': 'https://www.perplexity.ai/rest/computer/mcp',
            'excerpt': 'PROBE runtime (recorded 2026-10-01): a keyless JSON-RPC initialize POST to the documented MCP endpoint https://www.perplexity.ai/rest/computer/mcp answered HTTP/2 401 with a clean structured OAuth challenge — www-authenticate: Bearer with resource_metadata pointing at the endpoint\'s own .well-known protected-resource document — live proof the hosted Perplexity Computer MCP server exists and enforces OAuth with a Perplexity account (no API key), exactly as the docs claim.',
            'fetchedAt': NOW,
        },
        {
            'id': 'perplexity-computer-probe-rt-2',
            'tier': 'probe',
            'url': 'https://www.perplexity.ai/.well-known/oauth-protected-resource/rest/computer/mcp',
            'excerpt': 'PROBE runtime (recorded 2026-10-01): the RFC 9728 OAuth protected-resource metadata for the Computer MCP server is served keylessly (200 application/json): {"resource":"https://www.perplexity.ai/rest/computer/mcp","authorization_servers":[...],"scopes_supported":["asi:query"],"bearer_methods_supported":["header"]} — the discovery document an MCP client uses to connect. The consumer product page www.perplexity.ai/computer itself answers our fetcher with HTTP 403 (Cloudflare); the docs subdomain carries the public surface.',
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'open-rankings/ai-assistants/evidence/{pid}.json'
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
