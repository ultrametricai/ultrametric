#!/usr/bin/env python3
# gpus refresh (2026-10-23): records the www.amd.com bot wall as dated probe-tier evidence for
# the three AMD products whose front doors live there (amd-mi355x, amd-mi325x, amd-rx-9070-xt).
# The 2026-10-23 category crawl found www.amd.com dropping connections to the standard pipeline
# UA ("fetch failed" on every product page and on robots.txt itself), so those URLs move to
# crawlExclude per the government-services precedent (append-government-services-wall-probes.py)
# and the wall is recorded here instead of being re-fetched on every crawl.
#
# Rules of engagement, enforced in code:
#   - each front door gets ONE keyless GET with the standard pipeline UA, no retries;
#   - a connection error IS the observation (the filings.dos.ny.gov precedent);
#   - rows carry preserve: true so probe-stage refreshes keep them
#     (rankings-engine/stages/probe.ts, mergeProbeEvidence).
# Ids continue each product's existing `<pid>-probe-N` numbering. Idempotent by id.
import datetime
import json
import os
import ssl
import urllib.request

UA = 'Mozilla/5.0 (compatible; Ultrametric/1.0; +https://ultrametric.ai)'
NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
TODAY = NOW[:10]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(os.path.dirname(ROOT), 'open-rankings', 'gpus', 'evidence')

FRONT_DOORS = {
    'amd-mi355x': 'https://www.amd.com/en/products/accelerators/instinct/mi350/mi355x.html',
    'amd-mi325x': 'https://www.amd.com/en/products/accelerators/instinct/mi300/mi325x.html',
    'amd-rx-9070-xt': 'https://www.amd.com/en/products/graphics/desktops/radeon/9000-series/amd-radeon-rx-9070xt.html',
}


def get(url: str, timeout: int = 25):
    """One keyless GET, no retries. Returns (status, note)."""
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status, f'served {len(res.read(4096))}+ bytes'
    except urllib.error.HTTPError as e:
        return e.code, 'HTTP error page'
    except (urllib.error.URLError, ssl.SSLError, ConnectionError, OSError, TimeoutError) as e:
        return 'ERR', str(e) or type(e).__name__


for pid, url in FRONT_DOORS.items():
    path = os.path.join(DATA, f'{pid}.json')
    ev = json.load(open(path))
    marker = f'PROBE front-door wall (observed {TODAY}'
    if any(marker in e.get('excerpt', '') for e in ev):
        print(f'{pid}: wall row for {TODAY} already present, skipping')
        continue
    status, note = get(url)
    n = 0
    ids = {e['id'] for e in ev}
    while f'{pid}-probe-{n + 1}' in ids:
        n += 1
    row = {
        'id': f'{pid}-probe-{n + 1}',
        'tier': 'probe',
        'url': url,
        'excerpt': (
            f'PROBE front-door wall (observed {TODAY}, standard pipeline UA, single keyless GET, no retry): '
            f'{"HTTP " + str(status) if status != "ERR" else "connection failed (" + note + ")"} at {url} — '
            'www.amd.com does not answer the pipeline user agent (the 2026-10-23 category crawl saw the same '
            'failure on every www.amd.com page and on robots.txt itself), so the vendor front door is '
            'crawlExcluded and the wall recorded here; AMD product documentation remains crawlable at '
            'rocm.docs.amd.com and instinct.docs.amd.com.'
        ),
        'fetchedAt': NOW,
        'preserve': True,
    }
    ev.append(row)
    with open(path, 'w') as f:
        json.dump(ev, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print(f'{pid}: appended {row["id"]} ({status}; {note})')
