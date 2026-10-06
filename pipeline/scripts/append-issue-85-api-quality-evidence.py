#!/usr/bin/env python3
# API-quality crawl-gap fix for the issue #85 work queue (2026-10-06) — same precedent as
# append-api-quality-docs-evidence.py (the 54-product Mercury audit): the gap signature is
# `agentic-public-api` full/partial while ALL four api-quality stories are zero-evidence none.
# Every URL below was live-checked on 2026-10-06 and every excerpt quotes the live page.
#
# Verified-honest counterparts (NO items added, on purpose — the figma/databricks precedent):
#   - thoropass: no public API docs portal exists (thoropass.com/api 404, api.thoropass.com
#     404, docs/developers subdomains unresolvable; the help center documents only the MCP
#     server). All four api-quality nones stand.
#   - zero (email): open-source email client; its programmatic surface is the MCP server and
#     self-hosted internals. No REST API reference, machine spec, sandbox, or versioning
#     policy is published (0.email/llms.txt serves the SPA shell, repo has none).
#   - secureframe api-sandbox: no sandbox/test environment is documented anywhere on the
#     developer portal.
#   - sift api-machine-spec: no downloadable OpenAPI/machine-readable spec is published on
#     developers.sift.com.
import datetime
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    ('compliance-automation', 'secureframe'): [
        ('secureframe-supp-api-reference', 'https://api.secureframe.com/docs',
         'developer.secureframe.com serves a rendered OpenAPI reference (api.secureframe.com/docs): "Secureframe exposes a REST API for use by customers, partners, and community developers. The Secureframe API utilizes resource-oriented endpoints and returns requests in the form of standard JSON responses, based on the JSON API spec. Search utilizes Lucene Syntax." The reference opens every tagged endpoint group with request/response schemas.'),
        ('secureframe-supp-openapi-embedded', 'https://api.secureframe.com/docs',
         'The complete machine-readable spec is published in the reference page itself: the document embeds the full "openapi: 3.0.0 / info: title: Secureframe API" OpenAPI definition that the renderer consumes (~490KB page source). No separate raw-spec download URL is documented.'),
        ('secureframe-supp-versioning-policy', 'https://api.secureframe.com/docs',
         'Docs, "Versioning": "Secureframe makes many additive API changes that are _backwards compatible_ and able to be supported in all API versions: Adding operations, Adding optional parameters, ... Backwards _incompatible_ changes require Secureframe to release a new dated API version, as the[y] can potentially break an integration." The intro pins "API URL (latest version): https://api.secureframe.com".'),
    ],
    ('fraud-prevention', 'sift'): [
        ('sift-supp-sandbox', 'https://developers.sift.com/docs/curl/apis-overview/core-topics/sandbox',
         'Docs, "Sandbox": "Sift recommends that developers utilize the sandbox environment when testing new elements of Sift. This sandbox environment allows you to send test events or client data to Sift without impacting the scores Sift produces in production." Sandbox API keys are issued per account ("Use your Sandbox REST API key for accessing Sandbox users when testing. Switch to your Production API key for your live integration"), and "Selecting sandbox mode will switch you to the sandbox view so you can see all your test data in the console (e.g. Explore, Queues, Workflows, etc.)."'),
        ('sift-supp-versioned-changelog', 'https://developers.sift.com/docs/curl/apis-overview/core-topics/changelog',
         'The API reference is published per dated version (v205/v204/v203 selectable; versioned URL pattern /docs/v205/...), with a running dated changelog including explicit deprecations: "March 2025 API: Added $card_bin_metadata field to the $payment_method"; "February 2025 API: Added $iata_carrier_code field to the Segment for flights; API: Marked $iata_carrier_code Booking field as \'Deprecated\'".'),
        ('sift-supp-api-reference-examples', 'https://developers.sift.com/docs/curl/apis-overview',
         'developers.sift.com is a full API reference portal (Events, Decisions, Score, Workflows, Webhooks APIs) with per-language implementations selectable per page (curl, Python, Java, and more) and request/response examples, e.g. webhook signature verification shown in each language. (No live try-it runner is documented.)'),
    ],
}

EXTRA_URLS = {
    ('compliance-automation', 'secureframe'): ['https://api.secureframe.com/docs'],
    ('fraud-prevention', 'sift'): [
        'https://developers.sift.com/docs/curl/apis-overview',
        'https://developers.sift.com/docs/curl/apis-overview/core-topics/sandbox',
        'https://developers.sift.com/docs/curl/apis-overview/core-topics/changelog',
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
        with open(ef, 'w') as f:
            f.write(json.dumps(ev, indent=2) + '\n')
        print(f'{arena}/{pid}: +{added} evidence items ({len(ev)} total)')

        pf = os.path.join(ROOT, 'data', arena, 'products.json')
        ps = json.load(open(pf))
        for p in ps:
            if p['id'] != pid:
                continue
            extra = p['urls'].setdefault('extra', [])
            for u in EXTRA_URLS[(arena, pid)]:
                if u not in extra:
                    extra.append(u)
        with open(pf, 'w') as f:
            f.write(json.dumps(ps, indent=2) + '\n')


if __name__ == '__main__':
    main()
