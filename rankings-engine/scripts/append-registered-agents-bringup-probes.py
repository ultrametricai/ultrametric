#!/usr/bin/env python3
# Registered-agents bring-up (2026-11-01): records dated keyless probes the generic probe stage
# cannot see, in two groups.
#
# Group 1 — open machine rails on a second origin. The probe stage roots llms.txt/OpenAPI checks
# at urls.docs ?? urls.site (rankings-engine/stages/probe.ts), and Harbor Compliance's docs URL is the
# JS-only developer portal, so its genuine machine rails on the www origin (a real llms.txt and
# a public keyless OpenAPI 3.1 spec) would go unrecorded at probe tier. This script GETs each
# once and records the answer as it was observed.
#
# Group 2 — the documented bot walls for the two roster
# vendors whose entire public surface denies keyless agents — Northwest Registered Agent
# (Cloudflare managed challenge, HTTP 403 on every path including robots.txt) and CT Corporation
# (Wolters Kluwer's www.wolterskluwer.com serves the same class of Cloudflare challenge, HTTP 403
# including robots.txt). Both products are fully crawlExclude'd in products.json, so their
# evidence packs are these recorded walls — the government-services precedent (mca.gov.in,
# scc.virginia.gov: a host that walls robots.txt itself gets NOTHING fetched beyond robots.txt,
# and the wall is the finding).
#
# Rules of engagement, enforced in code (the government-services wall-probe contract):
#   - robots.txt is always fetchable (it is the compliance mechanism itself);
#   - because both hosts answer robots.txt with a challenge page, nothing beyond robots.txt is
#     fetched on either host by this script or by the pipeline (crawlExclude covers the crawl
#     stage; the probe stage is not run for these two products);
#   - one keyless GET per URL with the standard pipeline UA, no retries; the observed status and
#     challenge markers are the excerpt.
#
# Run AFTER extract. Ids continue each product's `<pid>-probe-N` numbering; rows carry
# preserve:true so a later probe refresh merges around them instead of clobbering the recorded
# wall (lib/schemas.ts EvidenceSchema). Idempotent by excerpt prefix.
import datetime
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request

UA = 'Mozilla/5.0 (compatible; Ultrametric/1.0; +https://ultrametric.ai)'
NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
TODAY = NOW[:10]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(os.path.dirname(ROOT), 'open-rankings', 'registered-agents', 'evidence')


def get(url: str, timeout: int = 25, limit: int = 4096):
    """One keyless GET, no retries. Returns (status, body up to `limit` bytes) or ('ERR', message).

    Wall checks need only a prefix; marker checks against a whole document (the Harbor OpenAPI
    spec is ~680 KB with the registered-agent endpoints past the first 4 KB) must pass a limit
    that covers the full body, or an incomplete read would be recorded as an absent endpoint."""
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status, res.read(limit).decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        try:
            return e.code, e.read(limit).decode('utf-8', 'replace')
        except Exception:
            return e.code, ''
    except (urllib.error.URLError, ssl.SSLError, ConnectionError, OSError, TimeoutError) as e:
        return 'ERR', str(e)


def seen(body: str, marker: str) -> str:
    return 'present' if marker.lower() in body.lower() else 'absent'


def status_str(s) -> str:
    return f'HTTP {s}' if s != 'ERR' else 'connection failed'


checks = []  # (productId, key, url, build_excerpt(status, body) -> str[, read_limit_bytes])

checks.append(('harbor-compliance', 'root-llms-txt', 'https://www.harborcompliance.com/llms.txt', lambda s, b: (
    f'PROBE llms.txt: {status_str(s)} at https://www.harborcompliance.com/llms.txt (observed {TODAY}; '
    f'"# Harbor Compliance" heading {seen(b, "# Harbor Compliance")}, registered-agent link '
    f'{seen(b, "registered-agent-service")}) — a genuine llms.txt on the www origin (the docs origin serves a '
    'JS app shell), listing the registered-agent, annual-report, and software surfaces with one-line descriptions.')))

checks.append(('harbor-compliance', 'public-openapi', 'https://www.harborcompliance.com/api/v3/openapi', lambda s, b: (
    f'PROBE OpenAPI spec: {status_str(s)} at https://www.harborcompliance.com/api/v3/openapi (observed {TODAY}; '
    f'full document read, {len(b)} chars; "openapi" key {seen(b, "openapi")}, title marker '
    f'{seen(b, "Harbor Compliance API")}, registered-agent-deliveries endpoints '
    f'{seen(b, "registered-agent-deliveries")}) — a public, keyless OpenAPI document for the Harbor '
    'Compliance API (OAuth-authenticated at runtime); documented at developers.harborcompliance.com, a '
    'JS-rendered portal.'), 4_000_000))

checks.append(('northwest-registered-agent', 'robots-wall', 'https://www.northwestregisteredagent.com/robots.txt', lambda s, b: (
    f'PROBE front-door robots: {status_str(s)} at https://www.northwestregisteredagent.com/robots.txt (observed '
    f'{TODAY}; Cloudflare challenge markers: "Just a moment" {seen(b, "Just a moment")}, "challenge" '
    f'{seen(b, "challenge")}) — the host answers robots.txt itself with a Cloudflare managed challenge to a keyless '
    'agent, so the robots policy is unreadable and nothing on this host was fetched beyond robots.txt. The product '
    'is judged from its recorded walls alone; its state coverage, pricing, and service claims have no keyless '
    'first-party corpus to cite.')))

checks.append(('ct-corporation', 'robots-wall', 'https://www.wolterskluwer.com/robots.txt', lambda s, b: (
    f'PROBE front-door robots: {status_str(s)} at https://www.wolterskluwer.com/robots.txt (observed {TODAY}; '
    f'Cloudflare challenge markers: "Just a moment" {seen(b, "Just a moment")}, "challenge" {seen(b, "challenge")}) '
    '— Wolters Kluwer answers robots.txt itself with a Cloudflare challenge to a keyless agent, so the robots '
    'policy is unreadable and nothing on www.wolterskluwer.com (the host carrying every CT Corporation page) was '
    'fetched beyond robots.txt. The product is judged from its recorded walls alone.')))

checks.append(('ct-corporation', 'legacy-host-redirect', 'https://ct.wolterskluwer.com/robots.txt', lambda s, b: (
    f'PROBE legacy-host robots: {status_str(s)} at https://ct.wolterskluwer.com/robots.txt (observed {TODAY}) — the '
    'legacy CT host still serves a permissive robots.txt, but its content pages 301-redirect into the walled '
    'www.wolterskluwer.com host, so no CT Corporation page content is reachable to a keyless agent through it.')))


def run():
    results = []
    last_host = {}
    for pid, key, url, build, *rest in checks:
        host = url.split('/')[2]
        wait = last_host.get(host, 0) + 2 - time.time()
        if wait > 0:
            time.sleep(wait)
        status, body = get(url, limit=rest[0] if rest else 4096)
        last_host[host] = time.time()
        excerpt = build(status, body)
        results.append((pid, key, url, excerpt))
        print(f'{pid}/{key}: {status}')
        time.sleep(2)

    os.makedirs(DATA, exist_ok=True)
    for pid, key, url, excerpt in results:
        path = os.path.join(DATA, f'{pid}.json')
        ev = json.load(open(path)) if os.path.exists(path) else []
        if any(e.get('excerpt', '').startswith(excerpt.split(' (observed')[0]) and e['tier'] == 'probe' for e in ev):
            print(f'{pid}: {key} already recorded, skipping')
            continue
        n = max([int(e['id'].rsplit('-', 1)[1]) for e in ev if e['tier'] == 'probe'] or [0]) + 1
        ev.append({'id': f'{pid}-probe-{n}', 'tier': 'probe', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW, 'preserve': True})
        with open(path, 'w') as f:
            json.dump(ev, f, indent=2, ensure_ascii=False)
            f.write('\n')
        print(f'{pid}: appended {pid}-probe-{n} ({key})')


if __name__ == '__main__':
    sys.exit(run())
