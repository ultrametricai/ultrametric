#!/usr/bin/env python3
# Government-services arena bring-up (2026-10-05): supplements evidence packs with verbatim
# passages from CRAWLED/VERIFIED agency pages that the LLM extraction pass missed — the
# startup-immigration precedent (append-startup-immigration-docs-evidence.py): the generic
# extraction prompt is tuned for software products, so on agency corpora it starves out the
# facts this arena exists to judge — published operating windows and daily limits (EIN),
# mail-PIN latency and MFA mandates (EFTPS), ID.me biometric-liveness language, the image
# CAPTCHA on Delaware's mandatory-online filing, statutory fees and penalty schedules, and the
# sanctioned intermediary rails (designees, G-28 representatives, batch providers).
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
SEED = os.path.join(ROOT, 'seeds', 'government-services-supp-evidence.json')
DATA = os.path.join(os.path.dirname(ROOT), 'data', 'government-services')
CACHE = os.path.join(ROOT, 'cache', 'crawl', 'government-services')

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
