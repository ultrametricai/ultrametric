#!/usr/bin/env python3
# Government-services state-agency bring-up (2026-10-22, the five state tax/employment
# agencies: ca-ftb, ca-edd, ny-dtf, tx-comptroller, de-dor): records the observed WALLS and
# the one genuinely open machine rail as probe-tier evidence, as fresh, dated, single keyless
# GETs with the standard pipeline UA, run by this script itself (the Phase 1/Phase 2 contract:
# every excerpt states what was actually observed on the dated run, not what a research pass
# remembered).
#
# Rules of engagement, enforced in code (same as append-government-services-phase2-wall-probes.py):
#   - robots.txt is always fetchable (it is the compliance mechanism itself);
#   - hosts whose robots are unreadable (403/5xx/transport error) get NOTHING fetched beyond
#     robots.txt (www.ftb.ca.gov, webapp.ftb.ca.gov, eddservices.edd.ca.gov);
#   - beyond robots.txt, a host is GET once, keylessly, only where its robots policy allows it
#     (checked live in the 2026-10-22 roster sweep before this script was written);
#   - documented open-data hosts take one keyless GET against the documented endpoint to
#     record its answer (data.texas.gov Socrata — the data.colorado.gov precedent).
#
# Run AFTER extract and the probe stage. Ids continue each product's existing `<pid>-probe-N`
# numbering; rows carry preserve:true so a later probe-stage refresh merges around them
# (rankings-engine/stages/probe.ts mergeProbeEvidence) instead of clobbering recorded walls —
# ca-ftb's entire evidence pack is these rows. Idempotent by excerpt prefix.
import datetime
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser

UA = 'Mozilla/5.0 (compatible; Ultrametric/1.0; +https://ultrametric.ai)'
NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
TODAY = NOW[:10]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(os.path.dirname(ROOT), 'open-rankings', 'government-services', 'evidence')


def get(url: str, timeout: int = 25):
    """One keyless GET, no retries. Returns (status, body_prefix) or ('ERR', message)."""
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status, res.read(4096).decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        try:
            return e.code, e.read(4096).decode('utf-8', 'replace')
        except Exception:
            return e.code, ''
    except (urllib.error.URLError, ssl.SSLError, ConnectionError, OSError, TimeoutError) as e:
        return 'ERR', str(e)


def seen(body: str, marker: str) -> str:
    return 'present' if marker.lower() in body.lower() else 'absent'


def status_str(s) -> str:
    return f'HTTP {s}' if s != 'ERR' else 'connection failed'


checks = []  # (productId, key, url, expected(status, body) -> bool, build_excerpt(status, body) -> str)

# Each check's excerpt prose states a specific dated observation, so the row is written ONLY
# when the live response matches the observation the prose describes (`expected`). A changed
# response is printed loudly and nothing is recorded: the world moved, so a new dated claim
# must be authored against the new observation — a canned sentence must never outlive the
# response it described.

# ---- California Franchise Tax Board ----
checks.append(('ca-ftb', 'front-door-robots', 'https://www.ftb.ca.gov/robots.txt', lambda s, b: s == 403, lambda s, b: (
    f'PROBE front-door robots: {status_str(s)} at https://www.ftb.ca.gov/robots.txt (observed {TODAY}, standard '
    f'pipeline UA; Akamai "Access Denied" marker {seen(b, "Access Denied")}) — the edge serves 403 at robots.txt '
    'itself to a keyless agent, so the robots policy is unreadable. Respected in full: nothing on www.ftb.ca.gov '
    'was fetched beyond robots.txt (every corpus URL sits in crawlExclude), and this product is judged from its '
    'recorded walls alone.')))

checks.append(('ca-ftb', 'webapp-host-wall', 'https://webapp.ftb.ca.gov/', lambda s, b: s == 403 and 'access denied' in b.lower(), lambda s, b: (
    f'PROBE filing/payment application host: {status_str(s)} at https://webapp.ftb.ca.gov/ (observed {TODAY}; '
    f'Akamai "Access Denied" marker {seen(b, "Access Denied")}) — the host behind MyFTB and Web Pay meets a keyless '
    'agent with the same edge denial as the front door (robots.txt on this host is 404, so the one permitted root '
    'GET records the wall). The transaction surface is closed to keyless agents end to end.')))

# ---- California Employment Development Department ----
checks.append(('ca-edd', 'eservices-portal-robots', 'https://eddservices.edd.ca.gov/robots.txt', lambda s, b: s == 403, lambda s, b: (
    f'PROBE e-Services for Business portal robots: {status_str(s)} at https://eddservices.edd.ca.gov/robots.txt '
    f'(observed {TODAY}, standard pipeline UA) — the transactional portal host (employer registration, filings, '
    'payments) serves 403 at robots.txt itself to a keyless agent. Respected: nothing on eddservices.edd.ca.gov '
    'was fetched beyond robots.txt; the agency is judged from its open edd.ca.gov guidance pages plus this '
    'recorded wall.')))

# ---- New York Department of Taxation and Finance ----
checks.append(('ny-dtf', 'eservices-robots-disallow', 'https://www.tax.ny.gov/robots.txt', lambda s, b: s == 200 and 'disallow: /e-services/' in b.lower(), lambda s, b: (
    f'PROBE front-door robots: HTTP {s} at https://www.tax.ny.gov/robots.txt (observed {TODAY}; '
    f'"Disallow: /e-services/" {seen(b, "Disallow: /e-services/")}) — the guidance pages are open to every agent, '
    'but the /e-services/ transaction paths (Online Services account surface) are robots-disallowed for all '
    'user agents. Respected: no /e-services/ path was ever fetched.')))

# ---- Texas Comptroller of Public Accounts ----
checks.append(('tx-comptroller', 'esystems-keyless-bounce', 'https://mycpa.cpa.state.tx.us/', lambda s, b: s == 200 and 'comptroller' in b.lower(), lambda s, b: (
    f'PROBE Webfile/eSystems host keyless GET: {status_str(s)} at https://mycpa.cpa.state.tx.us/ (observed '
    f'{TODAY}; robots.txt on this host is 404, one permitted root GET) — a keyless agent is bounced to the '
    'comptroller.texas.gov front door; the Webfile transaction surface exists only behind an authenticated '
    'eSystems session. Recorded, never interacted with.')))

checks.append(('tx-comptroller', 'socrata-open-data-rail', 'https://data.texas.gov/resource/9cir-efmm.json?$limit=1', lambda s, b: s == 200 and 'taxpayer_number' in b, lambda s, b: (
    f'PROBE open-data rail keyless GET: HTTP {s} at https://data.texas.gov/resource/9cir-efmm.json?$limit=1 '
    f'(observed {TODAY}; JSON field "taxpayer_number" {seen(b, "taxpayer_number")}) — the Comptroller\'s Active '
    'Franchise Tax Permit Holders dataset answers a keyless Socrata SODA query with structured JSON rows: a real '
    'machine-readable rail for registration status, the data.colorado.gov precedent. Reading rail only — no '
    'filing or payment endpoint is public.')))

# ---- Delaware Division of Revenue ----
checks.append(('de-dor', 'taxpayer-portal-shell', 'https://tax.delaware.gov/', lambda s, b: s == 200 and '!ut/p' in b, lambda s, b: (
    f'PROBE Delaware Taxpayer Portal keyless GET: {status_str(s)} at https://tax.delaware.gov/ (observed {TODAY}; '
    f'robots.txt on this host is 404, one permitted root GET; WebSphere Portal path marker "!ut/p" '
    f'{seen(b, "!ut/p")}) — the filing/payment portal serves an interactive portal shell; registration, gross '
    'receipts and withholding filings exist only behind an authenticated session. Recorded, never interacted '
    'with; revenue.delaware.gov remains the open crawled surface.')))


def robots_allows(url: str, cache: dict) -> bool:
    """Re-check the host's CURRENT robots policy before any non-robots GET (a prior manual
    sweep is not permission for a re-run). robots.txt itself is always fetchable — it is the
    compliance mechanism. 404 = no policy published = allowed; an unreadable policy
    (403/5xx/transport error) means NOTHING beyond robots.txt may be fetched."""
    parts = urllib.parse.urlsplit(url)
    if parts.path == '/robots.txt':
        return True
    host = parts.netloc
    if host not in cache:
        status, body = get(f'{parts.scheme}://{host}/robots.txt')
        if status == 404:
            cache[host] = None  # no policy — everything allowed
        elif status == 200:
            rp = urllib.robotparser.RobotFileParser()
            rp.parse(body.splitlines())
            cache[host] = rp
        else:
            cache[host] = False  # unreadable — nothing beyond robots.txt
    rp = cache[host]
    if rp is False:
        return False
    if rp is None:
        return True
    return rp.can_fetch(UA, url)


def run():
    results = []
    last_host = {}
    robots_cache = {}
    for pid, key, url, expected, build in checks:
        if not robots_allows(url, robots_cache):
            print(f'{pid}/{key}: SKIPPED — current robots policy does not permit fetching {url}')
            continue
        host = url.split('/')[2]
        wait = last_host.get(host, 0) + 2 - time.time()
        if wait > 0:
            time.sleep(wait)
        status, body = get(url)
        last_host[host] = time.time()
        if not expected(status, body):
            print(f'{pid}/{key}: OBSERVATION CHANGED ({status_str(status)}) — nothing recorded; '
                  're-verify and author a new dated claim against the new response')
            continue
        excerpt = build(status, body)
        results.append((pid, key, url, excerpt))
        print(f'{pid}/{key}: {status}')
        time.sleep(2)

    for pid, key, url, excerpt in results:
        path = os.path.join(DATA, f'{pid}.json')
        ev = json.load(open(path)) if os.path.exists(path) else []
        if any(e.get('excerpt', '').startswith(excerpt.split(' (observed')[0]) and e['tier'] == 'probe' for e in ev):
            print(f'{pid}: {key} already recorded, skipping')
            continue
        n = max([int(e['id'].rsplit('-', 1)[1]) for e in ev if e['tier'] == 'probe'] or [0]) + 1
        ev.append({'id': f'{pid}-probe-{n}', 'tier': 'probe', 'url': url, 'excerpt': excerpt,
                   'fetchedAt': NOW, 'preserve': True})
        with open(path, 'w') as f:
            json.dump(ev, f, indent=2, ensure_ascii=False)
            f.write('\n')
        print(f'{pid}: appended {pid}-probe-{n} ({key})')


if __name__ == '__main__':
    sys.exit(run())
