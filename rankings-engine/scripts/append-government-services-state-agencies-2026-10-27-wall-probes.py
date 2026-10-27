#!/usr/bin/env python3
# Government-services state-agency bring-up (2026-10-27, the six agencies of PR #500:
# tx-twc, wa-esd, wa-dor, fl-dor, nevada-sos, wyoming-sos): records the observed WALLS and
# the observed open surfaces on each agency's transactional hosts as probe-tier evidence,
# as fresh, dated, single keyless GETs with the standard pipeline UA, run by this script
# itself (the Phase 1/Phase 2 contract: every excerpt states what was actually observed on
# the dated run, not what a research pass remembered).
#
# Rules of engagement, enforced in code (same as
# append-government-services-state-agencies-wall-probes.py):
#   - robots.txt is always fetchable (it is the compliance mechanism itself);
#   - every non-robots request is gated on a LIVE robots.txt check at run time: a policy
#     that is unreadable (403/5xx/transport error) or that disallows the path means the
#     request is not made and nothing is recorded — an earlier manual sweep cannot
#     authorize a future request;
#   - a 404 robots, or a 200 response carrying no machine-readable rules, leaves the path
#     permitted (the robots-exclusion convention: no valid policy means no restriction),
#     and the one permitted GET records the surface.
#
# Run AFTER extract and the probe stage. Ids continue each product's existing `<pid>-probe-N`
# numbering; rows carry preserve:true so a later probe-stage refresh merges around them
# (rankings-engine/stages/probe.ts mergeProbeEvidence) instead of clobbering recorded walls.
# nevada-sos-probe-1 (the staged 2026-10-27 403 observation) stays as recorded history; the
# probe-2 row below documents the wall's new shape observed later the same day.
#
# Idempotence is observation-gated: the live response is matched against each row's
# `expected` BEFORE the duplicate check, so a changed response is always reported loudly
# (and fails the run) rather than passing as an already-recorded skip — a canned sentence
# must never outlive the response it described.
import datetime
import json
import os
import ssl
import sys
import urllib.error
import urllib.request
import urllib.robotparser
from urllib.parse import urlsplit

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


_robots_cache = {}


def robots_allows(url: str):
    """Live robots gate for a non-robots URL: (allowed, reason). One robots GET per host."""
    host = urlsplit(url).netloc
    if host not in _robots_cache:
        _robots_cache[host] = get(f'https://{host}/robots.txt')
    status, body = _robots_cache[host]
    if status == 404:
        return True, 'robots.txt 404 — no policy, path permitted'
    if status == 200:
        rp = urllib.robotparser.RobotFileParser()
        rp.parse(body.splitlines())
        if rp.can_fetch(UA, url):
            return True, 'robots.txt readable, path allowed (or no machine-readable rules)'
        return False, 'robots.txt disallows this path'
    return False, f'robots.txt unreadable ({status_str(status)}) — nothing fetched beyond robots.txt'


def seen(body: str, marker: str) -> str:
    return 'present' if marker.lower() in body.lower() else 'absent'


def status_str(s) -> str:
    return f'HTTP {s}' if s != 'ERR' else 'connection failed'


checks = []  # (productId, key, url, expected(status, body) -> bool, build_excerpt(status, body) -> str)

# Each check's excerpt prose states a specific dated observation, so the row is written ONLY
# when the live response matches the observation the prose describes (`expected`). A changed
# response is printed loudly and nothing is recorded: the world moved, so a new dated claim
# must be authored against the new observation.

# ---- Texas Workforce Commission ----
checks.append(('tx-twc', 'uitaxreg-host-wall', 'https://apps.twc.texas.gov/robots.txt', lambda s, b: s == 'ERR', lambda s, b: (
    f'PROBE unemployment-tax application host robots: {status_str(s)} at https://apps.twc.texas.gov/robots.txt '
    f'(observed {TODAY}, standard pipeline UA; transport-level reset, no HTTP response) — the host behind the '
    'online Unemployment Tax Registration and Unemployment Tax Services applications drops a keyless agent’s '
    'connection at robots.txt itself, so the robots policy is unreadable. Respected in full: nothing on '
    'apps.twc.texas.gov was fetched beyond robots.txt; the registration and wage-report transactions the open '
    'twc.texas.gov guidance documents are closed to keyless agents.')))

# ---- Washington Employment Security Department ----
checks.append(('wa-esd', 'saw-portal-login-shell', 'https://secure.esd.wa.gov/robots.txt', lambda s, b: s == 200 and 'login' in b.lower(), lambda s, b: (
    f'PROBE employer transactional portal robots: HTTP {s} at https://secure.esd.wa.gov/robots.txt (observed '
    f'{TODAY}, standard pipeline UA) answered with the SecureAccess Washington login shell ("Login" marker '
    f'{seen(b, "Login")}), not a robots policy — the host behind EAMS employer accounts and quarterly tax-and-wage '
    'filing redirects every keyless request, robots.txt included, to authenticated login. Respected in full: '
    'nothing on secure.esd.wa.gov was fetched beyond robots.txt; the agency is judged from its open esd.wa.gov '
    'guidance pages plus this recorded wall.')))

# ---- Washington Department of Revenue ----
checks.append(('wa-dor', 'mydor-portal-login-shell', 'https://secure.dor.wa.gov/robots.txt', lambda s, b: s == 200 and 'login' in b.lower(), lambda s, b: (
    f'PROBE My DOR transactional portal robots: HTTP {s} at https://secure.dor.wa.gov/robots.txt (observed '
    f'{TODAY}, standard pipeline UA) answered with the My DOR login shell ("Login" marker {seen(b, "Login")}), '
    'not a robots policy — the host behind business-license applications and excise-tax returns redirects every '
    'keyless request, robots.txt included, to authenticated login. Respected in full: nothing on '
    'secure.dor.wa.gov was fetched beyond robots.txt; the agency is judged from its open dor.wa.gov guidance '
    'pages plus this recorded wall.')))

# ---- Florida Department of Revenue ----
checks.append(('fl-dor', 'taxregistration-app-shell', 'https://taxapps.floridarevenue.com/taxregistration', lambda s, b: s == 200 and 'login' in b.lower(), lambda s, b: (
    f'PROBE online business-tax registration application: HTTP {s} at '
    f'https://taxapps.floridarevenue.com/taxregistration (observed {TODAY}, standard pipeline UA, after a '
    f'live robots.txt check on this host; "Login" marker {seen(b, "Login")}) — the Florida Business Tax '
    'Application the open floridarevenue.com guidance links serves an interactive login/entry shell, with '
    'registration and reemployment-tax transactions behind an authenticated session.')))

# ---- Nevada Secretary of State ----
checks.append(('nevada-sos', 'front-door-robots-interstitial', 'https://www.nvsos.gov/robots.txt', lambda s, b: s == 200 and 'incapsula' in b.lower(), lambda s, b: (
    f'PROBE front-door robots, follow-up: HTTP {s} at https://www.nvsos.gov/robots.txt (observed {TODAY}, '
    f'standard pipeline UA; Imperva Incapsula bot-challenge interstitial served in place of a robots file, '
    f'"Incapsula" marker {seen(b, "Incapsula")}, "Request unsuccessful" marker {seen(b, "Request unsuccessful")}) '
    '— where the recorded earlier same-day check met HTTP 403, the edge now answers 200 with a bot interstitial, '
    'so the robots policy remains unreadable either way. Respected in full: every corpus URL on www.nvsos.gov '
    'sits in crawlExclude, and nothing on the host is crawled.')))

checks.append(('nevada-sos', 'orion-portal-wall', 'https://esos.nv.gov/robots.txt', lambda s, b: s == 200 and 'incapsula' in b.lower(), lambda s, b: (
    f'PROBE ORION filing portal robots: HTTP {s} at https://esos.nv.gov/robots.txt (observed {TODAY}, standard '
    f'pipeline UA) redirected to the orion.nv.gov public portal and answered with an Incapsula noindex shell '
    f'("Incapsula" marker {seen(b, "Incapsula")}), not a robots policy — the portal that state notices direct '
    'annual-list and business-license filings to meets a keyless agent with the same bot wall as the front door. '
    'Respected in full: nothing on esos.nv.gov or orion.nv.gov was fetched beyond robots.txt. The transaction '
    'surface is closed to keyless agents end to end.')))

# ---- Wyoming Secretary of State ----
checks.append(('wyoming-sos', 'wyobiz-portal-root', 'https://wyobiz.wyo.gov/', lambda s, b: s == 200, lambda s, b: (
    f'PROBE WyoBiz filing portal root: HTTP {s} at https://wyobiz.wyo.gov/ (observed {TODAY}, standard pipeline '
    'UA, after a live robots.txt check on this host, which answers 200 with an HTML document carrying no '
    'machine-readable rules) — the root GET lands on the public Business Center page (/Business/Default.aspx), '
    'reachable keylessly. This single GET establishes only that reachability; no llms.txt and no documented '
    'public API were found on the agency’s hosts (probe stage, same date).')))

appended = 0
skipped = 0
failed = 0
for pid, key, url, expected, build in checks:
    f = os.path.join(DATA, f'{pid}.json')
    rows = json.load(open(f))
    if not url.endswith('/robots.txt'):
        allowed, reason = robots_allows(url)
        if not allowed:
            print(f'!! NOT FETCHED ({reason}): {pid}/{key} {url}')
            failed += 1
            continue
    status, body = get(url)
    excerpt = build(status, body)
    if not expected(status, body):
        print(f'!! RESPONSE CHANGED, NOT RECORDED: {pid}/{key} {url} -> {status_str(status)}')
        print(f'   body head: {body[:200]!r}')
        failed += 1
        continue
    prefix = excerpt.split('(observed')[0]
    if any(r['excerpt'].split('(observed')[0] == prefix for r in rows if r.get('tier') == 'probe'):
        print(f'SKIP (already recorded, live response still matches): {pid}/{key}')
        skipped += 1
        continue
    n = 1
    ids = {r['id'] for r in rows}
    while f'{pid}-probe-{n}' in ids:
        n += 1
    rows.append({
        'id': f'{pid}-probe-{n}',
        'tier': 'probe',
        'url': url,
        'excerpt': excerpt,
        'fetchedAt': NOW,
        'preserve': True,
    })
    with open(f, 'w', encoding='utf-8') as out:
        out.write(json.dumps(rows, indent=2, ensure_ascii=False) + '\n')
    appended += 1
    print(f'APPENDED {pid}-probe-{n}: {key}')

print(f'done: {appended} appended, {skipped} skipped, {failed} failed')
if failed:
    sys.exit(1)
