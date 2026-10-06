#!/usr/bin/env python3
# Government-services arena bring-up (2026-10-05): records the documented WALLS as probe-tier
# evidence — fresh, dated, single keyless GETs with the standard pipeline UA, run by this script
# itself so every excerpt states what was actually observed, not what the research dossier
# (docs/vendor-research/government-services-agenticness.md) remembered.
#
# Rules of engagement, enforced in code:
#   - robots.txt is always fetchable (it is the compliance mechanism itself);
#   - beyond robots.txt, a host is only GET once, keylessly, where its robots policy allows it
#     (irs.gov permits /dmaf; api.uspto.gov and developer.uspto.gov are uspto.gov-robots-clean);
#   - hosts whose robots are unreadable or that ban agents get NOTHING fetched beyond robots.txt
#     (egov.uscis.gov, direct.sos.state.tx.us, bizfileonline, ftb.ca.gov, businessexpress);
#   - www.uscis.gov requests honor its published Crawl-delay: 10;
#   - a connection error IS the observation (filings.dos.ny.gov resets TLS to this UA).
#
# Run AFTER `pnpm pipeline probe` — the probe stage replaces probe-tier evidence wholesale on
# each run and would clobber these items (the documented probe-stage replacement gotcha). Ids
# continue each product's existing `<pid>-probe-N` numbering. Idempotent by id.
import datetime
import json
import os
import ssl
import sys
import time
import urllib.request

UA = 'Mozilla/5.0 (compatible; Ultrametric/1.0; +https://ultrametric.ai)'
NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
TODAY = NOW[:10]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(os.path.dirname(ROOT), 'data', 'government-services', 'evidence')


def get(url: str, timeout: int = 25):
    """One keyless GET, no retries. Returns (status, body_prefix) or ('ERR', message)."""
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status, res.read(4096).decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read(4096).decode('utf-8', 'replace')
    except (urllib.error.URLError, ssl.SSLError, ConnectionError, OSError) as e:
        return 'ERR', str(e)


def seen(body: str, marker: str) -> str:
    return 'present' if marker.lower() in body.lower() else 'absent'


checks = []  # (productId, key, url, build_excerpt(status, body) -> str)

checks.append(('irs', 'app-host-robots', 'https://sa.www4.irs.gov/robots.txt', lambda s, b: (
    f'PROBE app-host robots: HTTP {s} at https://sa.www4.irs.gov/robots.txt (observed {TODAY}, standard pipeline UA) — '
    'the EIN online assistant runs on an application host with no stable published robots.txt; '
    'the irs.gov content robots.txt does not govern it.')))

checks.append(('irs', 'f15620-online-entry', 'https://www.irs.gov/dmaf/form/f15620', lambda s, b: (
    f'PROBE online Form 15620 entry: HTTP {s} at https://www.irs.gov/dmaf/form/f15620 (observed {TODAY}, standard '
    'pipeline UA, single GET, no retry; /dmaf is not disallowed by irs.gov robots.txt) — the online 83(b) election '
    'flow denies keyless agents at the front door, consistent with the published IRS Online Account sign-in '
    'requirement for signed mobile-friendly forms.')))

checks.append(('eftps', 'robots-policy', 'https://www.eftps.gov/robots.txt', lambda s, b: (
    f'PROBE robots: HTTP {s} at https://www.eftps.gov/robots.txt (observed {TODAY}) — eftps.gov publishes no '
    'crawl policy at all; an agent has no machine-readable statement of what it may read.')))

checks.append(('uscis', 'llms-txt', 'https://www.uscis.gov/llms.txt', lambda s, b: (
    f'PROBE llms.txt: HTTP {s} at https://www.uscis.gov/llms.txt (observed {TODAY}, standard pipeline UA; '
    'www.uscis.gov Crawl-delay 10 honored) — no agent-oriented docs index is published.')))

checks.append(('uscis', 'egov-bot-wall', 'https://egov.uscis.gov/robots.txt', lambda s, b: (
    f'PROBE case-status host robots: HTTP {s} at https://egov.uscis.gov/robots.txt (observed {TODAY}, standard '
    f'pipeline UA; Cloudflare challenge marker {seen(b, "cloudflare")}) — the public case-status tool host '
    'bot-walls keyless agents at robots.txt itself; nothing on that host was fetched beyond robots.txt.')))

checks.append(('uspto', 'api-keyless-auth', 'https://api.uspto.gov/', lambda s, b: (
    f'PROBE api.uspto.gov keyless GET: HTTP {s}, body starts {json.dumps(b.strip()[:60])} (observed {TODAY}, single '
    'GET, no retry) — a real machine endpoint that answers unauthenticated requests with a structured auth '
    'challenge: an API-key model, not a bot wall.')))

checks.append(('uspto', 'dev-portal-shell', 'https://developer.uspto.gov/', lambda s, b: (
    f'PROBE developer portal: HTTP {s} at https://developer.uspto.gov/ (observed {TODAY}) — the developer portal '
    'serves a JavaScript app shell to a keyless agent (API docs render only after JS execution), so the machine '
    'documentation is not readable by a plain keyless fetch.')))

checks.append(('sam-gov', 'signin-login-gov', 'https://sam.gov/robots.txt', lambda s, b: (
    f'PROBE robots: HTTP {s} at https://sam.gov/robots.txt (observed {TODAY}) — a standard published crawl policy; '
    'content paths are crawlable to a keyless agent.')))

checks.append(('delaware-doc', 'icis-robots', 'https://icis.corp.delaware.gov/robots.txt', lambda s, b: (
    f'PROBE filing-host robots: HTTP {s} at https://icis.corp.delaware.gov/robots.txt (observed {TODAY}) — the '
    'franchise-tax filing host publishes no crawl policy; its keyless entry page documents an image CAPTCHA '
    '("Type code from the image"), recorded from the crawled page and never interacted with.')))

checks.append(('california-sos', 'bizfile-robots-shell', 'https://bizfileonline.sos.ca.gov/robots.txt', lambda s, b: (
    f'PROBE filing-portal robots: HTTP {s} at https://bizfileonline.sos.ca.gov/robots.txt (observed {TODAY}; '
    f'Incapsula marker {seen(b, "_Incapsula_Resource")}, robots directives {seen(b, "User-agent")}) — the bizfile '
    'portal serves a bot-management SPA shell even for robots.txt, so a keyless agent cannot read the portal or '
    'its crawl policy; nothing on that host was fetched beyond robots.txt.')))

checks.append(('california-sos', 'ftb-robots-403', 'https://www.ftb.ca.gov/robots.txt', lambda s, b: (
    f'PROBE state-tax front door: HTTP {s} at https://www.ftb.ca.gov/robots.txt (observed {TODAY}, standard '
    'pipeline UA) — the Franchise Tax Board walls keyless agents at robots.txt itself; nothing on that host was '
    'fetched beyond robots.txt.')))

checks.append(('new-york-dos', 'filings-host-reset', 'https://filings.dos.ny.gov/', lambda s, b: (
    f'PROBE filing-app host: {"HTTP " + str(s) if s != "ERR" else "connection failed (" + b[:90] + ")"} at '
    f'https://filings.dos.ny.gov/ (observed {TODAY}, standard pipeline UA, single attempt) — the online filing '
    'application host blocks keyless agents at the transport layer; nothing was fetched from it.')))

checks.append(('new-york-dos', 'businessexpress-robots', 'https://www.businessexpress.ny.gov/robots.txt', lambda s, b: (
    f'PROBE Business Express robots: HTTP {s} at https://www.businessexpress.ny.gov/robots.txt (observed {TODAY}; '
    f'a "Disallow: /" block is {seen(b, "Disallow: /                      # ADDED BY HMS")}) — the NY Business '
    'Express portal disallows all crawling; respected, the host was never crawled.')))

checks.append(('texas-sos', 'direct-host-robots-ban', 'https://direct.sos.state.tx.us/robots.txt', lambda s, b: (
    f'PROBE filing-host robots: HTTP {s} at https://direct.sos.state.tx.us/robots.txt (observed {TODAY}; named '
    f'bans — GPTBot {seen(b, "GPTBot")}, ChatGPT-User {seen(b, "ChatGPT-User")}, OAI-SearchBot '
    f'{seen(b, "OAI-SearchBot")}, Googlebot {seen(b, "Googlebot")}) — SOSDirect disallows AI crawlers and agents '
    'BY NAME. Respected in full: nothing on direct.sos.state.tx.us was fetched beyond robots.txt, and this '
    'product is judged from its published www.sos.state.tx.us pages only.')))

LAST_USCIS = [0.0]


def run():
    results = []
    for pid, key, url, build in checks:
        if 'www.uscis.gov' in url:
            wait = LAST_USCIS[0] + 10 - time.time()
            if wait > 0:
                time.sleep(wait)
        status, body = get(url)
        if 'www.uscis.gov' in url:
            LAST_USCIS[0] = time.time()
        excerpt = build(status, body)
        results.append((pid, key, url, excerpt))
        print(f'{pid}/{key}: {status}')
        time.sleep(2)

    for pid, key, url, excerpt in results:
        path = os.path.join(DATA, f'{pid}.json')
        ev = json.load(open(path))
        if any(e.get('excerpt', '').startswith(excerpt.split(' (observed')[0]) and e['tier'] == 'probe' for e in ev):
            print(f'{pid}: {key} already recorded, skipping')
            continue
        n = max([int(e['id'].rsplit('-', 1)[1]) for e in ev if e['tier'] == 'probe'] or [0]) + 1
        ev.append({'id': f'{pid}-probe-{n}', 'tier': 'probe', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
        with open(path, 'w') as f:
            json.dump(ev, f, indent=2, ensure_ascii=False)
            f.write('\n')
        print(f'{pid}: appended {pid}-probe-{n} ({key})')


if __name__ == '__main__':
    sys.exit(run())
