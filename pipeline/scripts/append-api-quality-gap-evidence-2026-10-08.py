#!/usr/bin/env python3
# API-quality crawl-gap fix, 2026-10-08 wave: hightouch, missive, jan — the three products
# outside the issue #85 lane still carrying the gap signature (`agentic-public-api` full while
# ALL four api-quality stories are zero-evidence none). Same precedent as
# append-api-quality-docs-evidence.py (the 54-product Mercury audit) and
# append-issue-85-api-quality-evidence.py. Every URL below was live-checked on 2026-10-08 and
# every excerpt quotes the live page (or, for the Hightouch spec, the live JSON document).
#
# Verified-honest counterparts (NO items added, on purpose — the figma/databricks precedent):
#   - hightouch api-sandbox: no sandbox or test environment is documented anywhere in the
#     developer docs; api-versioning-policy: no written versioning/deprecation policy page —
#     only the versioned base path /api/v1 (the TLS-cipher sunset note on the API guide is a
#     transport change, not an API versioning policy).
#   - missive api-machine-spec: no OpenAPI/machine-readable spec is published; api-sandbox:
#     no test environment or sandbox mode is documented.
#   - jan api-machine-spec: no OpenAPI document is published for the local server;
#     api-sandbox: nothing documented (the product IS a local runtime); api-versioning-policy:
#     no policy page — "/v1" is described only as following OpenAI's convention.
import datetime
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    ('customer-data-platforms', 'hightouch'): [
        ('hightouch-supp-openapi-spec', 'https://api.hightouch.io/api/swagger.json',
         'Hightouch publishes a machine-readable OpenAPI 3.0.0 document at api.hightouch.io/api/swagger.json: info.title "Hightouch API", description "Hightouch Public Rest API to access syncs, models, sources and destinations", 36 documented paths, servers pinned to "https://api.hightouch.com/api/v1".'),
        ('hightouch-supp-api-reference', 'https://hightouch.com/docs/api-reference',
         'docs/api-reference is the rendered REST reference for the public API: the page bundle mounts RedocStandalone with specUrl "https://api.hightouch.io/api/swagger.json", so the reference is generated from the published OpenAPI document (request/response schemas per endpoint; no live try-it runner is documented).'),
        ('hightouch-supp-api-guide-limits', 'https://hightouch.com/docs/developer-tools/api-guide',
         'API guide: "Append the endpoint path to the base URL. For example, to list syncs, send a request to https://api.hightouch.com/api/v1/syncs. Authenticate each request by passing your API key as a bearer token in the Authorization header"; "The Hightouch API rate limit is 200 requests per 10 seconds per workspace"; "The Hightouch REST API requires TLS 1.2 or later."'),
    ],
    ('email', 'missive'): [
        ('missive-supp-endpoints-reference', 'https://missiveapp.com/docs/developers/rest-api/endpoints.md',
         'Docs, "Endpoints": "Complete reference for Missive API endpoints: analytics, conversations, drafts, posts, contacts, labels, and more", with per-endpoint example requests against https://public.missiveapp.com/v1/. Every docs page serves raw Markdown by appending .md ("Markdown versions of documentation pages are available by appending .md to page URLs") and the index is published at https://missiveapp.com/docs/llms.txt. (No live try-it runner and no OpenAPI spec are documented.)'),
        ('missive-supp-rate-limits', 'https://missiveapp.com/docs/developers/rest-api/rate-limits.md',
         'Docs, "Rate Limits": "Maximum of 5 concurrent requests at any given time; 300 requests per minute (equivalent to 5 requests per second); 900 requests per 15 minutes (equivalent to 1 request per second)". On breach "Missive API will return the following HTTP error status code: 429 Too Many Requests" with Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining and X-RateLimit-Reset headers.'),
        ('missive-supp-breaking-change-notes', 'https://missiveapp.com/docs/developers/rest-api/endpoints.md',
         'The /v1 reference flags compatibility changes inline rather than via a standalone policy page: a dated warning hint "Breaking change for WhatsApp — For WhatsApp messages, the id in from_field and to_fields identifies authors and recipients by their Business-Scoped User ID (BSUID) ... instead of the contact\'s phone number", and superseded fields stay documented as aliases ("account_author — Legacy alias for from_field"). No versioning/deprecation policy page exists.'),
    ],
    ('local-llm-runtimes', 'jan'): [
        ('jan-supp-api-reference', 'https://www.jan.ai/docs/desktop/api-preference',
         'Docs, "API Reference": "Jan\'s local API server exposes an OpenAI-compatible REST API at http://127.0.0.1:1337. Use it as a drop-in replacement for cloud APIs in any application that supports OpenAI-compatible endpoints." Documents GET /v1/models, POST /v1/chat/completions ("Supports streaming, tool calling, and multi-turn conversations") and POST /v1/messages ("Anthropic-compatible messages endpoint. Jan automatically translates requests to the internal format, so you can use Anthropic SDK clients pointed at your local server"), each with curl examples and sample responses. (No OpenAPI spec download, try-it console, sandbox, or versioning policy is documented.)'),
        ('jan-supp-v1-prefix', 'https://www.jan.ai/docs/desktop/api-server',
         'Local API Server settings document the versioned base path as a compatibility convention, not a policy: "API Prefix — The base path for all API endpoints. /v1 (Default): Follows OpenAI\'s convention. The chat completions endpoint would be http://127.0.0.1:1337/v1/chat/completions. You can change this or leave it empty if desired."'),
    ],
}

EXTRA_URLS = {
    ('customer-data-platforms', 'hightouch'): [
        'https://hightouch.com/docs/api-reference',
        'https://api.hightouch.io/api/swagger.json',
    ],
    ('email', 'missive'): [
        'https://missiveapp.com/docs/developers/rest-api/rate-limits.md',
        'https://missiveapp.com/docs/llms.txt',
    ],
    ('local-llm-runtimes', 'jan'): [
        'https://www.jan.ai/docs/desktop/api-preference',
    ],
}


def main():
    for (arena, pid), items in ITEMS.items():
        ef = os.path.join(ROOT, 'data', arena, 'evidence', f'{pid}.json')
        ev = json.load(open(ef))
        have = {e['id'] for e in ev}
        added = 0
        for iid, url, excerpt in items:
            if iid in have:
                continue
            ev.append({'id': iid, 'tier': 'claimed-docs', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
            added += 1
        if added:
            with open(ef, 'w') as f:
                f.write(json.dumps(ev, indent=2, ensure_ascii=False) + '\n')
        print(f'{arena}/{pid}: +{added} evidence items ({len(ev)} total)')

        pf = os.path.join(ROOT, 'data', arena, 'products.json')
        ps = json.load(open(pf))
        changed = False
        for p in ps:
            if p['id'] != pid:
                continue
            extra = p['urls'].setdefault('extra', [])
            for url in EXTRA_URLS.get((arena, pid), []):
                if url not in extra:
                    extra.append(url)
                    changed = True
        if changed:
            with open(pf, 'w') as f:
                f.write(json.dumps(ps, indent=2, ensure_ascii=False) + '\n')
            print(f'{arena}/{pid}: urls.extra updated')


if __name__ == '__main__':
    main()
