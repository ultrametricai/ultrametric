#!/usr/bin/env python3
# Startup-law-firms arena bring-up (2026-09-30): supplements evidence packs with verbatim
# passages from CRAWLED/VERIFIED firm pages that the LLM extraction pass kept missing — the
# data-warehouses/auth-platforms precedent (append-data-warehouses-docs-evidence.py): the
# generic extraction prompt is tuned for software products, so on law-firm corpora it surfaced
# only 5-10 items per firm (mostly the interactive tools) and starved the practice-page claims
# (patent prosecution, venture deal volume, offices, published startup programs) out of the
# packs even though the crawl cache contains them verbatim. Every excerpt below was curated
# FROM the pipeline crawl cache (pipeline/cache/crawl/startup-law-firms/<firm>/) and quotes the
# cited firm page (checked at authoring time, 2026-09-30). Extraction is monotonic and dedups
# by normalized excerpt, so re-running extract after this keeps these items stable.
#
# Honest absences preserved on purpose: no fee items for firms that publish no fees (Bar
# Council of India rules for CAM/IndusLaw/Trilegal; Cooley/Gunderson/Goodwin/Latham publish
# none), no IP-prosecution items for Gunderson Dettmer (it has no IP prosecution/litigation
# practice), no open-resource items for VLP.
#
# The curated items live in pipeline/seeds/startup-law-firms-supp-evidence.json (one list per
# productId) so the excerpts are reviewable data, not code.
import datetime
import json
import os

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED = os.path.join(ROOT, 'seeds', 'startup-law-firms-supp-evidence.json')
DATA = os.path.join(os.path.dirname(ROOT), 'open-rankings', 'startup-law-firms', 'evidence')

ITEMS = json.load(open(SEED))

for pid, items in ITEMS.items():
    path = os.path.join(DATA, f'{pid}.json')
    ev = json.load(open(path))
    existing = {e['id'] for e in ev}
    for item in items:
        if item['id'] in existing:
            print(f"{pid}: {item['id']} already present, skipping")
            continue
        ev.append({'id': item['id'], 'tier': 'claimed-docs', 'url': item['url'], 'excerpt': item['excerpt'], 'fetchedAt': NOW})
        print(f"{pid}: appended {item['id']}")
    with open(path, 'w') as f:
        f.write(json.dumps(ev, indent=2) + '\n')
