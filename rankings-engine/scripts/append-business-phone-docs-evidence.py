#!/usr/bin/env python3
# Business-phone bring-up supplement (2026-10-26, PR #484 review): appends verbatim passages
# from CRAWLED/VERIFIED pages that the LLM extraction pass missed — the government-services /
# startup-immigration precedent. The review flagged RingCentral's agentic-scoped-keys cell as
# citing only credential creation; the application-scopes documentation lives on the crawled
# permissions page this seed quotes.
#
# Same verification contract: every seed item carries a `quote` field that MUST be a verbatim
# substring of the cached crawl page mapped from its `url` (site.md / docs.md / extra-N.md per
# products.json); the script verifies all of them and refuses to write anything on the first
# mismatch. The `quote` is verification-only and is not written to evidence.
import datetime
import json
import os
import sys

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED = os.path.join(ROOT, 'seeds', 'business-phone-supp-evidence.json')
DATA = os.path.join(os.path.dirname(ROOT), 'open-rankings', 'business-phone')
CACHE = os.path.join(ROOT, 'cache', 'crawl', 'business-phone')

seed = json.load(open(SEED))
products = {p['id']: p for p in json.load(open(os.path.join(DATA, 'products.json')))}


def cache_file(pid: str, url: str) -> str:
    urls = products[pid]['urls']
    norm = url.rstrip('/')
    if norm == urls['site'].rstrip('/'):
        return os.path.join(CACHE, pid, 'site.md')
    if urls.get('docs') and norm == urls['docs'].rstrip('/'):
        return os.path.join(CACHE, pid, 'docs.md')
    for i, u in enumerate(urls.get('extra') or []):
        if norm == u.rstrip('/'):
            return os.path.join(CACHE, pid, f'extra-{i}.md')
    raise SystemExit(f'{pid}: url not in products.json corpus: {url}')


# Pass 1: verify every quote verbatim against its cached page.
failures = []
for pid, items in seed.items():
    if pid.startswith('$'):
        continue
    for item in items:
        path = cache_file(pid, item['url'])
        text = open(path).read()
        if item['quote'] not in text:
            failures.append(f"{pid}/{item['id']}: quote not found in {os.path.basename(path)}")
if failures:
    print('VERIFICATION FAILED — nothing written:')
    for f in failures:
        print(' ', f)
    sys.exit(1)
print('all quotes verified verbatim against the crawl cache')

# Pass 2: append (idempotent by id).
for pid, items in seed.items():
    if pid.startswith('$'):
        continue
    path = os.path.join(DATA, 'evidence', f'{pid}.json')
    ev = json.load(open(path))
    existing = {e['id'] for e in ev}
    for item in items:
        if item['id'] in existing:
            print(f"{pid}: {item['id']} already present, skipping")
            continue
        ev.append({'id': item['id'], 'tier': 'claimed-docs', 'url': item['url'],
                   'excerpt': item['excerpt'], 'fetchedAt': NOW})
        print(f"{pid}: appended {item['id']}")
    with open(path, 'w') as f:
        json.dump(ev, f, indent=2, ensure_ascii=False)
        f.write('\n')
