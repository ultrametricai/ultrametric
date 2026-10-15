#!/usr/bin/env python3
# Accuracy-engine work queue, 2026-10-14 (issue #292) — the worst-stale arena is
# notes-knowledge, where five products carry the api-quality gap signature (`agentic-public-api`
# full/partial while ALL four api-quality stories are zero-evidence none). Same precedent as
# append-issue-85-api-quality-evidence.py and append-api-quality-gap-evidence-2026-10-08.py.
# Every URL below was live-checked on 2026-10-14 and every excerpt quotes the live page (or the
# live spec document).
#
# Verified-honest counterparts (NO items added, on purpose — the figma/databricks precedent):
#   - anytype api-sandbox: no sandbox or test environment is documented on developers.anytype.io
#     or in the anyproto/anytype-api portal repo; no try-it console is documented on the
#     reference (it is a written reference plus the published spec).
#   - capacities api-sandbox: no sandbox/test environment is referenced in the Beta docs or on
#     the developers.capacities.io successor portal landing page; only production is documented.
#   - reflect api-versioning-policy: no versioning or deprecation policy is published
#     (openpm package version 0.1.0 is a spec revision, not a policy); api-sandbox: no test
#     environment is documented.
#   - logseq api-machine-spec: no OpenAPI/machine-readable spec is published (probe-verified
#     404s on plugins-doc.logseq.com candidates); api-sandbox and api-versioning-policy:
#     nothing documented — the server is a local, user-run process.
#   - poly: verified honest no-op across all four api-quality stories — docs.poly.app documents
#     user-facing features, a CLI, and MCP integration only; no public REST API reference,
#     spec, sandbox, or versioning policy exists (probe-verified 404s on openapi candidates).
#     The gap signature will keep flagging it; that is the honest state (thoropass precedent).
#
# Also in the queue: the government-services/cra agent-docs contradiction (the cline
# signature) — the pack's cra-probe-1 recorded "HTTP 200" at canada.ca/llms.txt, but the
# `agentic-agent-docs` verdict is a zero-evidence none whose rationale calls the 200
# ambiguous. The cra section below re-probes the URL itself with redirects disabled and
# records what is actually observed (a 302 to the canada.ca error page — a soft 404), per the
# append-government-services-wall-probes.py convention. Run it AFTER any probe stage run: the
# probe stage replaces probe-tier evidence wholesale (the documented probe-stage replacement
# gotcha).
import datetime
import json
import os
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
TODAY = NOW[:10]
UA = 'Mozilla/5.0 (compatible; Ultrametric/1.0; +https://ultrametric.ai)'

ITEMS = {
    ('notes-knowledge', 'anytype'): [
        ('anytype-supp-openapi-v2', 'https://developers.anytype.io/openapi-v2.yaml',
         'Anytype publishes a machine-readable OpenAPI document at developers.anytype.io/openapi-v2.yaml: info "title: Anytype API", "version: \\"2025-11-08\\"", with full component schemas and documented error responses ("Unauthorized ... Missing, unknown, revoked or expired key"). The spec file lives in the anyproto/anytype-api developer-portal repo as openapi-v2.yaml, synced from the anytype-heart core and published at /openapi-v2.yaml on releases.'),
        ('anytype-supp-api-versions', 'https://developers.anytype.io/docs/reference/',
         'The API reference is versioned with dated releases: "API Version: 2025-11-08", a version picker listing "API v2 — pre-release" alongside "API v1" versions "2025-11-08 (latest)", "2025-05-20", "2025-04-22", and a Changelog section. Portal banner: "Pre-release: Anytype API v2 is now available to try - objects as editable JSON documents, built for agents and humans." No written deprecation policy page and no try-it console are published.'),
    ],
    ('notes-knowledge', 'capacities'): [
        ('capacities-supp-openapi', 'https://api.capacities.io/openapi.json',
         'Capacities publishes a machine-readable OpenAPI document at api.capacities.io/openapi.json: "openapi":"3.0.3", info title "Capacities API", version "1.0.0". The developer docs link it directly: "If you need programmatic access to the API specification, you can download the OpenAPI 3.0 Specification" (docs.capacities.io/raw/developer/api.md).'),
        ('capacities-supp-interactive-reference', 'https://api.capacities.io/docs',
         'The hosted reference at api.capacities.io/docs renders the OpenAPI document as an interactive dashboard with authenticated try-it: the spec\'s own description reads "Interactive **reference** for all routes of the Capacities API. You can add your `cap-api-…` token in the **`Bearer Token`** field to make requests in this dashboard." The developer docs point to it as the endpoint reference ("You can read about all API endpoints here: Reference").'),
        ('capacities-supp-beta-deprecation', 'https://docs.capacities.io/raw/developer/api.md',
         'The developer docs carry a dated deprecation notice for the Beta API generation: "This is the documentation for the Capacities API Beta, which will be discontinued on **September 1, 2026**. The new Capacities API is available at developers.capacities.io. Please migrate your integrations before the deprecation date." The successor portal\'s sections cover "Authentication, SDKs, versioning, rate limits, concurrency, and error handling" and an "Interactive OpenAPI specification with every endpoint, schema, rate limit, and TypeScript SDK sample". Rate limits are documented per user per endpoint: "Current rate limits can be obtained from the response header based on the `RateLimit-Remaining` header fields (HTTP standardization draft, IETF)."'),
    ],
    ('notes-knowledge', 'reflect'): [
        ('reflect-supp-openpm-spec', 'https://openpm.ai/packages/reflect',
         'Reflect\'s full API reference is published as an OpenAPI package on openpm, linked from the vendor docs ("For a full list of API endpoints, see our documentation on openpm here" — reflect.academy/api): machine-readable spec at openpm.ai/packages/reflect/openapi.json ("openapi": "3.0.0", info title "reflect", version "0.1.0", description "This API is for the note-taking app Reflect. It supports appending data to your notes, returning a list of the links you\'ve bookmarked, and a few oth[er things]"), documenting GET /graphs, GET and POST /graphs/{graphId}/links, PUT /graphs/{graphId}/daily-notes, POST /graphs/{graphId}/notes, and GET /users/me with OAuth2 scopes read:graph / write:graph.'),
        ('reflect-supp-api-surface-bounds', 'https://reflect.academy/api',
         'The API docs document the live REST base with bearer auth ("curl \'https://reflect.app/api/graphs\' -H \'Authorization: Bearer YOUR_ACCESS_TOKEN\'") and state the constraint that bounds the surface: "Your notes contents are end-to-end encrypted. Our servers can\'t read the contents of your notes, so we can\'t serve them up in the API." No versioning or deprecation policy and no sandbox or test environment are documented anywhere in the API docs.'),
    ],
    ('notes-knowledge', 'logseq'): [
        ('logseq-supp-local-api-server-details', 'https://raw.githubusercontent.com/logseq/docs/master/pages/Local%20Http%20server.md',
         'The local HTTP API server ships its own API documentation and a single method-dispatch endpoint: "By default, api documentation is available at http://127.0.0.1:12315/."; "POST `/api` - `method` can be any of the ones listed in https://plugins-doc.logseq.com/. `args` is an array of arguments to pass to method."; "Supports CORS for use from another web page or a browser extension." Auth is a user-created bearer token (worked curl examples: "curl -X POST http://127.0.0.1:12315/api -H \\"Authorization: Bearer {replace with your-token-value-here}\\""). No OpenAPI document, sandbox, or versioning policy is published.'),
    ],
}

EXTRA_URLS = {
    ('notes-knowledge', 'anytype'): [
        'https://developers.anytype.io/openapi-v2.yaml',
    ],
    ('notes-knowledge', 'capacities'): [
        'https://api.capacities.io/openapi.json',
        'https://api.capacities.io/docs',
        'https://developers.capacities.io',
    ],
    ('notes-knowledge', 'reflect'): [
        'https://openpm.ai/packages/reflect',
    ],
}

# government-services/cra: re-probe canada.ca/llms.txt with redirects disabled and record the
# actual observation, so the agentic-agent-docs verdict has a citable, unambiguous probe item.
CRA_PROBE_URL = 'https://www.canada.ca/llms.txt'


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def probe_cra() -> str:
    opener = urllib.request.build_opener(NoRedirect)
    req = urllib.request.Request(CRA_PROBE_URL, headers={'User-Agent': UA})
    try:
        with opener.open(req, timeout=25) as res:
            status, location = res.status, res.headers.get('Location', '')
    except urllib.error.HTTPError as e:
        status, location = e.code, e.headers.get('Location', '')
    except OSError as e:
        return f'PROBE llms.txt: connection error at {CRA_PROBE_URL} (observed {TODAY}) — {e}'
    loc = f' -> Location {location}' if location else ''
    note = ''
    if 300 <= status < 400 and 'errors/404' in location:
        note = (' — the path redirects to the canada.ca error page, a soft 404: no llms.txt or '
                'agent-oriented docs index is published on the canada.ca platform. This resolves the '
                'earlier ambiguous reading in cra-probe-1, whose "HTTP 200" was the error page '
                'reached after following this redirect.')
    return f'PROBE llms.txt: HTTP {status} at {CRA_PROBE_URL}{loc} (observed {TODAY}, redirects not followed){note}'


def main():
    for (arena, pid), items in ITEMS.items():
        ef = os.path.join(ROOT, 'open-rankings', arena, 'evidence', f'{pid}.json')
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

        pf = os.path.join(ROOT, 'open-rankings', arena, 'products.json')
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

    ef = os.path.join(ROOT, 'open-rankings', 'government-services', 'evidence', 'cra.json')
    ev = json.load(open(ef))
    if not any(e['id'] == 'cra-probe-2' for e in ev):
        excerpt = probe_cra()
        ev.append({'id': 'cra-probe-2', 'tier': 'probe', 'url': CRA_PROBE_URL, 'excerpt': excerpt, 'fetchedAt': NOW})
        with open(ef, 'w') as f:
            f.write(json.dumps(ev, indent=2, ensure_ascii=False) + '\n')
        print(f'government-services/cra: +1 probe item — {excerpt[:120]}')
    else:
        print('government-services/cra: cra-probe-2 already present')


if __name__ == '__main__':
    main()
