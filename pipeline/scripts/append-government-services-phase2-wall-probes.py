#!/usr/bin/env python3
# Government-services Phase 2 (2026-10-07, founder GO on the §5 world roster in
# docs/vendor-research/government-agenticness-world.md): records the documented WALLS — and the
# few genuinely open machine rails — as probe-tier evidence for the 31 new agencies, as fresh,
# dated, single keyless GETs with the standard pipeline UA, run by this script itself (the
# Phase 1 contract from append-government-services-wall-probes.py: every excerpt states what was
# actually observed on the dated run, not what the research dossier remembered).
#
# Rules of engagement, enforced in code (same as Phase 1):
#   - robots.txt is always fetchable (it is the compliance mechanism itself);
#   - hosts whose robots are unreadable (403/5xx/transport error), blanket-disallowed, or that
#     ban AI agents by name get NOTHING fetched beyond robots.txt (mca.gov.in, nsws.gov.in,
#     efile.sunbiz.org, ohiosos.gov hosts, scc.virginia.gov hosts, tax.virginia.gov,
#     trademarks.ipo.gov.uk, developer.service.hmrc.gov.uk, aima.gov.pt, register.dpma.de);
#   - beyond robots.txt, a host is GET once, keylessly, only where its robots policy allows it
#     (checked live in the 2026-10-07 roster sweep before this script was written);
#   - documented API hosts (api.company-information.service.gov.uk, api.service.hmrc.gov.uk,
#     recherche-entreprises.api.gouv.fr, open.canada.ca, data.colorado.gov) take one keyless GET
#     against the documented endpoint to record its answer — the Phase 1 api.uspto.gov precedent;
#   - a connection error IS the observation (aima.gov.pt fails TLS verification to this client;
#     www.esteuer.de times out; mytax.colorado.gov does not resolve).
#
# Run AFTER extract (the probe stage is not used for this arena; extract rewrites only
# claimed-docs/github tiers and keeps probe items). Ids continue each product's existing
# `<pid>-probe-N` numbering; the script creates an empty evidence file for fully-walled
# products that never went through extract. Idempotent by excerpt prefix.
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
DATA = os.path.join(os.path.dirname(ROOT), 'data', 'government-services', 'evidence')


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


checks = []  # (productId, key, url, build_excerpt(status, body) -> str)

# ---- United Kingdom ----
checks.append(('companies-house', 'api-keyless-auth', 'https://api.company-information.service.gov.uk/company/00000006', lambda s, b: (
    f'PROBE Companies House REST API keyless GET: HTTP {s}, body starts {json.dumps(b.strip()[:80])} (observed {TODAY}, '
    'single GET, no retry) — a real public REST API that answers unauthenticated requests with a structured auth '
    'challenge: free registered API keys, an auth model, not a bot wall.')))

checks.append(('companies-house', 'govuk-content-api', 'https://www.gov.uk/api/content/set-up-business', lambda s, b: (
    f'PROBE GOV.UK Content API keyless GET: HTTP {s} at https://www.gov.uk/api/content/set-up-business, JSON body '
    f'{seen(b, "base_path")} (observed {TODAY}) — the one-stop layer above the registry serves every guidance page '
    'as keyless JSON, a machine rail with no US analogue.')))

checks.append(('companies-house', 'govuk-llms-txt', 'https://www.gov.uk/llms.txt', lambda s, b: (
    f'PROBE llms.txt: HTTP {s} at https://www.gov.uk/llms.txt (observed {TODAY}) — even GOV.UK, the best-instrumented '
    'government platform in this arena, publishes no agent-oriented docs index.')))

checks.append(('hmrc', 'api-platform-answer', 'https://api.service.hmrc.gov.uk/hello/world', lambda s, b: (
    f'PROBE HMRC API platform keyless GET: HTTP {s}, body starts {json.dumps(b.strip()[:90])} (observed {TODAY}, single '
    'GET, no retry) — a live, versioned production REST platform (Making Tax Digital) answering with a structured '
    'error contract, an auth/header model rather than a bot wall.')))

checks.append(('hmrc', 'developer-hub-robots', 'https://developer.service.hmrc.gov.uk/robots.txt', lambda s, b: (
    f'PROBE developer-hub robots: HTTP {s} at https://developer.service.hmrc.gov.uk/robots.txt (observed {TODAY}; '
    f'"Disallow: /" for * {seen(b, "Disallow: /")}, Googlebot-only Allow {seen(b, "Googlebot")}) — the country\'s best '
    'tax API hides its own API documentation from every crawler except Googlebot. Respected: nothing on that host '
    'was fetched beyond robots.txt.')))

checks.append(('uk-ipo', 'trademark-search-robots', 'https://trademarks.ipo.gov.uk/robots.txt', lambda s, b: (
    f'PROBE trade-mark search host robots: {status_str(s)} at https://trademarks.ipo.gov.uk/robots.txt (observed '
    f'{TODAY}, standard pipeline UA) — the search application host walls keyless agents at robots.txt itself; '
    'nothing on that host was fetched beyond robots.txt. The gov.uk guidance pages remain the open surface.')))

# ---- India ----
checks.append(('mca-india', 'front-door-robots', 'https://www.mca.gov.in/robots.txt', lambda s, b: (
    f'PROBE front-door robots: {status_str(s)} at https://www.mca.gov.in/robots.txt (observed {TODAY}, standard '
    'pipeline UA) — the national company registry walls keyless agents at robots.txt itself; nothing on mca.gov.in '
    'was fetched beyond robots.txt, and this product is judged from that recorded wall.')))

checks.append(('mca-india', 'nsws-robots', 'https://www.nsws.gov.in/robots.txt', lambda s, b: (
    f'PROBE National Single Window robots: {status_str(s)} at https://www.nsws.gov.in/robots.txt (observed {TODAY}) — '
    'the one-stop layer above the registry is walled the same way; nothing on that host was fetched beyond '
    'robots.txt.')))

checks.append(('gst-india', 'income-tax-shell', 'https://www.incometax.gov.in/iec/foportal/', lambda s, b: (
    f'PROBE income-tax e-filing front door: HTTP {s} at https://www.incometax.gov.in/iec/foportal/, {len(b)}-byte '
    f'prefix, app-root marker {seen(b, "app-root")} (observed {TODAY}, single GET) — the companion direct-tax portal '
    'serves a JavaScript application shell with no keyless HTML content, unlike the GST portal\'s readable pages.')))

checks.append(('ip-india', 'llms-txt', 'https://ipindia.gov.in/llms.txt', lambda s, b: (
    f'PROBE llms.txt: HTTP {s} at https://ipindia.gov.in/llms.txt (observed {TODAY}) — no agent-oriented docs index '
    'is published.')))

checks.append(('efrro-india', 'front-door-shell', 'https://indianfrro.gov.in/', lambda s, b: (
    f'PROBE front door: HTTP {s} at https://indianfrro.gov.in/ (observed {TODAY}; app-root marker '
    f'{seen(b, "app-root")}, script tags {seen(b, "<script")}) — the e-FRRO root answers 200 but serves a JavaScript '
    'application shell: converting the page to text for a keyless agent leaves 12 characters. The published '
    'reading surface is effectively script-only.')))

checks.append(('efrro-india', 'published-path-dead', 'https://indianfrro.gov.in/eservices/home.jsp', lambda s, b: (
    f'PROBE long-published e-FRRO entry path: HTTP {s} at https://indianfrro.gov.in/eservices/home.jsp (observed '
    f'{TODAY}) — the entry URL published across government guidance for years answers {s}; only the bare root '
    'serves the application entry.')))

# ---- Germany ----
checks.append(('elster', 'esteuer-artifacts', 'https://www.esteuer.de/', lambda s, b: (
    f'PROBE ERiC developer-artifact host: {status_str(s)}{"" if s != "ERR" else " (" + b[:80] + ")"} at '
    f'https://www.esteuer.de/ (observed {TODAY}, single GET, no retry; the 2026-10-06 dossier fetched taxonomy/'
    'download bundles keylessly from this host) — the sanctioned ERiC software channel\'s public artifact host no '
    'longer answers this keyless client; recorded as a dated change against the Phase 1 observation.')))

checks.append(('dpma', 'register-robots', 'https://register.dpma.de/robots.txt', lambda s, b: (
    f'PROBE DPMAregister robots: HTTP {s} at https://register.dpma.de/robots.txt (observed {TODAY}; "Disallow: /" '
    f'for * {seen(b, "Disallow: /")}) — the register-search host disallows all crawling except enumerated Allow '
    'paths that do not clearly cover the search surface. Respected: nothing on that host was fetched beyond '
    'robots.txt.')))

checks.append(('handelsregister', 'llms-txt', 'https://www.handelsregister.de/llms.txt', lambda s, b: (
    f'PROBE llms.txt: HTTP {s} at https://www.handelsregister.de/llms.txt (observed {TODAY}) — no agent-oriented '
    'docs index is published on the common register portal.')))

# ---- France ----
checks.append(('inpi-guichet-unique', 'annuaire-incapsula', 'https://annuaire-entreprises.data.gouv.fr/robots.txt', lambda s, b: (
    f'PROBE Annuaire des Entreprises robots: HTTP {s} at https://annuaire-entreprises.data.gouv.fr/robots.txt '
    f'(observed {TODAY}; Incapsula marker {seen(b, "_Incapsula_Resource")}) — the state company-directory web UI '
    'serves a bot-management shell even for robots.txt; nothing on that host was fetched beyond robots.txt.')))

checks.append(('inpi-guichet-unique', 'recherche-entreprises-api', 'https://recherche-entreprises.api.gouv.fr/search?q=inpi', lambda s, b: (
    f'PROBE recherche-entreprises API keyless GET: HTTP {s}, JSON body {seen(b, "results")} (observed {TODAY}, single '
    'GET) — the state\'s company-data API answers a keyless agent with full registry JSON: the machine rail is open '
    'even while the filing front doors sit behind Incapsula shells.')))

checks.append(('inpi-ip-operations', 'data-inpi-keyless', 'https://data.inpi.fr/', lambda s, b: (
    f'PROBE data.inpi.fr keyless GET: HTTP {s} (observed {TODAY}, single GET, no retry) — INPI\'s IP open-data '
    'portal denies keyless agents at the front door; IP data access requires an account-issued token.')))

checks.append(('anef-france', 'front-door-shell', 'https://administration-etrangers-en-france.interieur.gouv.fr/', lambda s, b: (
    f'PROBE ANEF front door: HTTP {s} at https://administration-etrangers-en-france.interieur.gouv.fr/ (observed '
    f'{TODAY}; {len(b)}-byte prefix, script tags {seen(b, "<script")}) — the digital-administration portal for '
    'foreign nationals serves a ~3 KB JavaScript shell to a keyless agent; converting it to text leaves under 200 '
    'characters. Every transaction sits behind the shell and an account.')))

checks.append(('anef-france', 'parent-ministry-cloudflare', 'https://www.interieur.gouv.fr/', lambda s, b: (
    f'PROBE parent-ministry front door: HTTP {s} at https://www.interieur.gouv.fr/ (observed {TODAY}; Cloudflare '
    f'challenge marker {seen(b, "Just a moment")}) — the ministry hosting ANEF challenges keyless agents with a '
    'Cloudflare interstitial; the ANEF application host itself serves only a 3 KB JavaScript shell keylessly.')))

# ---- Portugal ----
checks.append(('aima-portugal', 'front-door-tls', 'https://aima.gov.pt/robots.txt', lambda s, b: (
    f'PROBE front door: {status_str(s)}{"" if s != "ERR" else " (" + b[:110] + ")"} at https://aima.gov.pt/robots.txt '
    f'(observed {TODAY}, standard pipeline UA, single attempt after an identical failure in the roster sweep) — the '
    'immigration agency\'s site fails TLS verification for this keyless client, where the 2026-10-06 dossier saw an '
    'open robots.txt and a 200 landing; recorded as a dated change. Nothing on the host was fetched.')))

checks.append(('irn-portugal', 'eportugal-path-dead', 'https://eportugal.gov.pt/en/espaco-empresa/empresa-online', lambda s, b: (
    f'PROBE published Empresa Online entry path: HTTP {s} at https://eportugal.gov.pt/en/espaco-empresa/empresa-online '
    f'(observed {TODAY}) — the flagship online-incorporation entry URL as published answers {s}; the living '
    'guidance sits on justica.gov.pt instead.')))

checks.append(('at-financas', 'llms-txt', 'https://www.portaldasfinancas.gov.pt/llms.txt', lambda s, b: (
    f'PROBE llms.txt: HTTP {s} at https://www.portaldasfinancas.gov.pt/llms.txt (observed {TODAY}) — no '
    'agent-oriented docs index is published.')))

checks.append(('inpi-portugal', 'llms-txt', 'https://inpi.justica.gov.pt/llms.txt', lambda s, b: (
    f'PROBE llms.txt: HTTP {s} at https://inpi.justica.gov.pt/llms.txt (observed {TODAY}) — no agent-oriented docs '
    'index is published on the Justiça platform.')))

# ---- Canada ----
checks.append(('corporations-canada', 'open-canada-ckan', 'https://open.canada.ca/data/api/action/package_search?rows=1', lambda s, b: (
    f'PROBE open.canada.ca CKAN API keyless GET: HTTP {s}, JSON body {seen(b, "success")} (observed {TODAY}, single '
    'GET) — the national open-data layer answers keyless agents with structured JSON; the registry itself documents '
    'no transactional API on any surface checked.')))

checks.append(('cra', 'llms-txt', 'https://www.canada.ca/llms.txt', lambda s, b: (
    f'PROBE llms.txt: HTTP {s} at https://www.canada.ca/llms.txt (observed {TODAY}) — no agent-oriented docs index '
    'on the canada.ca platform.')))

# ---- US states ----
checks.append(('colorado-sos', 'socrata-data-api', 'https://data.colorado.gov/resource/4ykn-tg5h.json?$limit=1', lambda s, b: (
    f'PROBE business-entities data API keyless GET: HTTP {s}, JSON body {seen(b, "entityid")} (observed {TODAY}, '
    'single GET; data.colorado.gov robots crawl-delay 1 honored) — one of only two verified keyless state '
    'business-registry data APIs in the 50-state sweep, served from the Socrata open-data platform rather than the '
    'registry itself.')))

checks.append(('colorado-sos', 'mytax-dns', 'https://mytax.colorado.gov/', lambda s, b: (
    f'PROBE state tax portal: {status_str(s)}{"" if s != "ERR" else " (" + b[:90] + ")"} at '
    f'https://mytax.colorado.gov/ (observed {TODAY}, single attempt; also unresolvable in the 2026-10-06 sweep, '
    'twice) — the GenTax filing portal does not resolve from this vantage; tax.colorado.gov guidance pages remain '
    'the open tax surface and are part of this product\'s crawled corpus.')))

checks.append(('florida-dos', 'efile-robots-503', 'https://efile.sunbiz.org/robots.txt', lambda s, b: (
    f'PROBE e-filing host robots: HTTP {s} at https://efile.sunbiz.org/robots.txt (observed {TODAY}, after an '
    'identical answer in the roster sweep; the 2026-10-06 dossier saw this host serve a page with no robots '
    'directives) — the filing host now answers robots.txt with a server error, a front-door wall by the '
    'conservative reading; nothing on that host was fetched beyond robots.txt. The dos.fl.gov guidance pages '
    'remain open.')))

checks.append(('washington-sos', 'mydor-shell', 'https://secure.dor.wa.gov/', lambda s, b: (
    f'PROBE My DOR tax portal: HTTP {s} at https://secure.dor.wa.gov/, {len(b)}-byte prefix (observed {TODAY}, '
    'single GET) — the state tax filing portal serves a JavaScript application shell with no keyless HTML '
    'content.')))

checks.append(('ohio-sos', 'www-robots-403', 'https://www.ohiosos.gov/robots.txt', lambda s, b: (
    f'PROBE front-door robots: {status_str(s)} at https://www.ohiosos.gov/robots.txt (observed {TODAY}, standard '
    'pipeline UA) — the Secretary of State\'s own site walls keyless agents at robots.txt itself; nothing on '
    'ohiosos.gov was fetched beyond robots.txt. The product is judged from the state\'s open Gateway and tax '
    'surfaces plus this recorded wall.')))

checks.append(('ohio-sos', 'bsportal-robots-403', 'https://bsportal.ohiosos.gov/robots.txt', lambda s, b: (
    f'PROBE Ohio Business Central robots: {status_str(s)} at https://bsportal.ohiosos.gov/robots.txt (observed '
    f'{TODAY}) — the filing portal walls keyless agents at robots.txt itself; nothing on that host was fetched '
    'beyond robots.txt.')))

checks.append(('minnesota-sos', 'radware-landing', 'https://www.sos.state.mn.us/', lambda s, b: (
    f'PROBE front door: HTTP {s} at https://www.sos.state.mn.us/ (observed {TODAY}; Radware marker '
    f'{seen(b, "Radware")}, CAPTCHA marker {seen(b, "captcha")}) — robots.txt is absent (404), but the landing page '
    'itself is a Radware Bot Manager CAPTCHA interstitial for a keyless agent: the registry\'s public reading '
    'surface is bot-walled in practice. Recorded, never interacted with; mblsportal.sos.mn.gov remains the open '
    'surface and is part of this product\'s crawled corpus.')))

checks.append(('minnesota-sos', 'mndor-radware', 'https://www.mndor.state.mn.us/', lambda s, b: (
    f'PROBE DOR e-Services front door: {status_str(s)}{"" if s != "ERR" else " (" + b[:90] + ")"} at '
    f'https://www.mndor.state.mn.us/ (observed {TODAY}; perfdrive/Radware marker {seen(b, "perfdrive")}) — the state '
    'tax e-services host meets keyless agents with the Radware Bot Manager validation flow (validate.perfdrive.com '
    'redirect recorded in the 2026-10-06 sweep). Recorded, never interacted with.')))

checks.append(('virginia-scc', 'www-robots-disallow', 'https://www.scc.virginia.gov/robots.txt', lambda s, b: (
    f'PROBE front-door robots: HTTP {s} at https://www.scc.virginia.gov/robots.txt (observed {TODAY}; "Disallow: /" '
    f'for * {seen(b, "Disallow: /")}) — the Commission\'s own site disallows all crawling for every agent. '
    'Respected in full: nothing on www.scc.virginia.gov was fetched beyond robots.txt, and this product is judged '
    'from its recorded walls alone.')))

checks.append(('virginia-scc', 'cis-robots-disallow', 'https://cis.scc.virginia.gov/robots.txt', lambda s, b: (
    f'PROBE Clerk\'s Information System robots: HTTP {s} at https://cis.scc.virginia.gov/robots.txt (observed '
    f'{TODAY}; "Disallow: /" for * {seen(b, "Disallow: /")}) — the filing system disallows all crawling; respected, '
    'the host was never crawled.')))

checks.append(('virginia-scc', 'tax-named-ai-ban', 'https://www.tax.virginia.gov/robots.txt', lambda s, b: (
    f'PROBE state-tax robots: HTTP {s} at https://www.tax.virginia.gov/robots.txt (observed {TODAY}; named ban — '
    f'GPTBot {seen(b, "GPTBot")} with Disallow: / {seen(b, "Disallow: /")}) — Virginia Tax bans GPTBot-class AI '
    'agents BY NAME, the second named-AI-agent ban found in the state sweep after Texas SOSDirect. Treated as '
    'anti-agent posture per the Texas precedent: nothing on that host was fetched beyond robots.txt.')))


def run():
    results = []
    last_host = {}
    for pid, key, url, build in checks:
        host = url.split('/')[2]
        wait = last_host.get(host, 0) + 2 - time.time()
        if wait > 0:
            time.sleep(wait)
        status, body = get(url)
        last_host[host] = time.time()
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
        ev.append({'id': f'{pid}-probe-{n}', 'tier': 'probe', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
        with open(path, 'w') as f:
            json.dump(ev, f, indent=2, ensure_ascii=False)
            f.write('\n')
        print(f'{pid}: appended {pid}-probe-{n} ({key})')


if __name__ == '__main__':
    sys.exit(run())
