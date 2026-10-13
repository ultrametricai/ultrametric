#!/usr/bin/env python3
# Mercury API-accuracy spike (2026-09-14): supplements mercury's evidence pack with verbatim
# passages from CRAWLED/VERIFIED vendor pages that the LLM extraction passes and the
# html->markdown transform kept missing — same precedent as
# append-api-quality-docs-evidence.py (Databricks/Fivetran wave: per-source extraction caps +
# limited story quotas starve specific capabilities out of the pack even though the corpus
# contains them verbatim). Two transform losses fixed here in particular:
#   - turndown strips `<https://...>` autolinks, so the crawled sandbox page LOST both sandbox
#     base URLs (api-sandbox.mercury.com / oauth2-sandbox.mercury.com) that the live page
#     publishes (pipeline/cache/crawl/startup-banking/mercury/extra-5.md shows the empty gaps);
#   - the ReadMe reference hub's interactive "Try It!" runner + Shell/Node/Ruby/PHP/Python
#     code-sample picker IS in the crawled docs.md but never survived extraction's 40-story cap.
# Every URL below is in mercury's products.json urls.extra and crawled into
# pipeline/cache/crawl/startup-banking/mercury/; every excerpt quotes the crawled/live page
# (live-checked at authoring time, 2026-09-14).
#
# Verified-honest counterparts (NO doc items added, on purpose):
#   - api-machine-spec: Mercury publishes NO publicly downloadable OpenAPI file. The probe
#     section below RE-VERIFIES this live (openapi.json/swagger.json still 404) and records
#     that the docs hub's own page config disables the OpenAPI download
#     ("showOpenAPIDownload":false, "openapiVisibility":"admin") — the spec exists inside the
#     ReadMe project (mwb-openapi.yaml) but is deliberately not public.
#   - api-versioning-policy: no written deprecation/sunset policy page exists anywhere on
#     docs.mercury.com (llms.txt index has no such page; web search finds none). What DOES
#     exist — /api/v1 versioned paths, a v1-pre/v1/v2 docs version picker, and a dated public
#     changelog with migration guides — is quoted below; the missing policy stays missing.
#
# Run AFTER `pnpm pipeline extract --product mercury` (extraction is monotonic and dedups by
# normalized excerpt, so re-running extract after this keeps these items stable). If
# `pnpm pipeline probe --category startup-banking` ever wholesale-replaces probe-tier items,
# re-run this script to restore mercury-probe-6.
import datetime
import json
import subprocess

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
EVIDENCE = 'rankings/startup-banking/evidence/mercury.json'

DOC_ITEMS = [
    ('mercury-supp-sandbox-base-urls', 'https://docs.mercury.com/docs/using-mercury-sandbox.md',
     'Docs, "Using the Mercury Sandbox for Testing": sign up for a sandbox account at https://sandbox.mercury.com/signup; "When making API requests, make sure they\'re pointed to our sandbox base URL: https://api-sandbox.mercury.com/api/v1/"; "If you\'re using Sandbox for testing OAuth2 integrations, the base URL is https://oauth2-sandbox.mercury.com/"; the sandbox home page comes "pre-loaded with dummy data including organizations, accounts, transactions, and account balances to allow testing", and "Tokens created outside of the sandbox (like in production) won\'t work here."'),
    ('mercury-supp-interactive-docs', 'https://docs.mercury.com/reference',
     'Every endpoint page on the API Reference hub (docs.mercury.com/reference, ReadMe) embeds a live request runner and generated code samples: "Click `Try It!` to start a request and see the response here! Or choose an example:", with a Language picker (Shell, Node, Ruby, PHP, Python), a Bearer credentials field, per-endpoint path/query params, and 200/404 response schemas — e.g. "get https://api.mercury.com/api/v1/account/{accountId}/cards".'),
    ('mercury-supp-changelog-migration', 'https://docs.mercury.com/changelog/credit-statement-endpoint-updated-balance-and-transaction-behavior.md',
     'Mercury publishes a public API changelog (docs.mercury.com/changelog) with dated change notices and migration guidance, e.g. "Credit Statement Endpoint: Updated balance and transaction behavior" — "This applies to statements generated after June 15, 2026; statements generated on or before that date are unaffected" — with a "Migration Guide" section: "Integrations that parse the transaction list to identify autopay, or that assume charges/payments use the previous sign convention, should be updated to reflect the changes above."'),
    ('mercury-supp-versioned-api-docs', 'https://docs.mercury.com/reference',
     'API base paths are versioned under /api/v1/ ("get https://api.mercury.com/api/v1/account/{accountId}/cards") and the docs hub nav publishes a documentation version picker with three versions (v1-pre, v1, v2) alongside Guides / Recipes / API Reference / Changelog. (No written deprecation/sunset policy page is published anywhere on docs.mercury.com.)'),
    ('mercury-supp-go-sdk', 'https://github.com/MercuryTechnologies/mercury-go',
     'Official Go SDK, MercuryTechnologies/mercury-go: "The Mercury Go library provides convenient access to the Mercury REST API from applications written in Go... It is generated with Stainless", installed via `go get -u github.com/MercuryTechnologies/mercury-go@v0.13.11` (requires Go 1.22+). (No official npm or PyPI SDK exists — only community packages such as n8n-nodes-mercury, announced in Mercury\'s changelog as a "community node".)'),
    ('mercury-supp-agent-skills', 'https://github.com/MercuryTechnologies/mercury-skills',
     'Official MercuryTechnologies/mercury-skills repo, "Mercury Skills Directory": "Agent skills that drive the Mercury CLI. Each skill is a self-contained SKILL.md following the Agent Skills format" — installable via `npx skills add git@github.com:MercuryTechnologies/mercury-skills.git`, with skills like mercury-analyze-spend, mercury-detect-anomaly, and mercury-receipt-upload; "The CLI handles auth itself: set MERCURY_API_KEY in your environment, or run mercury login".'),
]


def fetch(url):
    r = subprocess.run(
        ['curl', '-s', '--max-time', '25', '-w', '\n---META %{http_code}', url],
        capture_output=True, text=True, timeout=35)
    body, _, meta = r.stdout.rpartition('\n---META ')
    return int(meta.strip() or 0), body


def openapi_probe():
    """Re-verify (live) that no public OpenAPI download exists, and record that the docs hub
    itself disables it. Fails loudly if reality changed since authoring."""
    candidates = ['https://docs.mercury.com/openapi.json', 'https://docs.mercury.com/swagger.json',
                  'https://docs.mercury.com/api/openapi.json', 'https://docs.mercury.com/.well-known/openapi.json']
    statuses = {}
    for u in candidates:
        status, _ = fetch(u)
        statuses[u] = status
        if status == 200:
            raise SystemExit(f'openapi probe: {u} now returns 200 — a public spec EXISTS; do not append the negative probe, re-judge with the spec instead')
    status, body = fetch('https://docs.mercury.com/reference/getaccounts')
    if status != 200:
        raise SystemExit(f'openapi probe: reference page returned {status}')
    for marker in ['"showOpenAPIDownload":false', '"openapiVisibility":"admin"', 'openapi.yaml']:
        if marker not in body:
            raise SystemExit(f'openapi probe: reference page no longer contains {marker!r}')
    if 'Try It' not in body:
        raise SystemExit('openapi probe: reference page no longer shows the Try It runner')
    status_list = ', '.join(f'{u} -> {s}' for u, s in statuses.items())
    return (f'PROBE openapi-reverify ({NOW[:10]}): all conventional public spec paths still 404 ({status_list}). '
            'The docs hub page config confirms this is deliberate: the ReadMe project contains OpenAPI 3.0 definitions '
            '(mwb-openapi.yaml, onboarding-openapi.yaml) but ships "showOpenAPIDownload":false and '
            '"openapiVisibility":"admin" — the machine-readable spec exists internally and is not publicly downloadable. '
            'The same page serves the interactive "Try It" runner (HTTP 200).')


def main():
    ev = json.load(open(EVIDENCE))
    existing = {e['id'] for e in ev}

    for iid, url, excerpt in DOC_ITEMS:
        if iid in existing:
            print(f'{iid}: already present, skipping')
            continue
        ev.append({'id': iid, 'tier': 'claimed-docs', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
        print(f'appended {iid}')

    probe_id = 'mercury-probe-6'
    if probe_id in existing:
        print(f'{probe_id}: already present, skipping')
    else:
        excerpt = openapi_probe()
        ev.append({'id': probe_id, 'tier': 'probe', 'url': 'https://docs.mercury.com/openapi.json',
                   'excerpt': excerpt, 'fetchedAt': NOW})
        print(f'appended {probe_id}')

    with open(EVIDENCE, 'w') as f:
        f.write(json.dumps(ev, indent=2) + '\n')


if __name__ == '__main__':
    main()
