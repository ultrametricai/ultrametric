#!/usr/bin/env python3
# Cross-arena vendor-geo re-earn (2026-10-27). PR #449 scoped vendorGeoFor to the arena a row
# was judged in, which honestly dropped the geo lines from four generated reviews whose rows
# were judged under a sibling arena: brex and ramp (expense-management; rows judged in
# startup-banking), square (mobile-payments; rows judged in payments), airwallex (payments;
# rows judged in startup-banking). This script re-earns those rows per arena:
#   - claimed-docs evidence rows quoting each vendor's OWN availability pages are appended to
#     the TARGET arena's evidence pack, each quote verified against the live page before
#     anything is written (no quote -> abort), so the availability documentation reaches that
#     arena's judge;
#   - jurisdictions/vendor-geo.json gains one row per (target arena, product, country) for the
#     eleven spike countries, judged against the target arena's offering.
# Findings that differ from the sibling-arena rows are recorded as found on 2026-10-27:
# Airwallex's eligible-countries list now includes India (onboarded via the SINGAPORE entity;
# the 2026-09-28 startup-banking row recorded it absent), and the per-location product table
# documents products only for the ten locations with local Airwallex entities, so
# Brazil/Mexico/India payments availability is onboarding-eligible but not product-documented
# (partial).
#
# Verification normalizes HTML to text (tags stripped, entities unescaped, whitespace
# collapsed, standalone single-digit footnote markers dropped) exactly as the Gusto entrants
# script (append-gusto-entrants-evidence-2026-10-23.py) did; stored excerpts are the page
# sentences plus an "(observed YYYY-MM-DD)" stamp.
#
# Run AFTER the packs exist (these are judged arenas). Ids continue each pack's existing
# `<pid>-docs-N` numbering. Idempotent by excerpt prefix and by (arena, product, country).
import datetime
import html
import json
import os
import re
import ssl
import sys
import time
import urllib.request

UA = 'Mozilla/5.0 (compatible; Ultrametric/1.0; +https://ultrametric.ai)'
NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
TODAY = NOW[:10]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(os.path.dirname(ROOT), 'open-rankings')
GEO = os.path.join(os.path.dirname(ROOT), 'jurisdictions', 'vendor-geo.json')

BREX_REQS = 'https://www.brex.com/support/brex-account-requirements'
BREX_GLOBAL = 'https://www.brex.com/product/global'
RAMP_APPLY = 'https://support.ramp.com/applying-and-signing-up-for-ramp-us-based'
SQUARE_INTL = 'https://squareup.com/help/us/en/article/4956-international-availability'
AWX_FEATURES = 'https://help.airwallex.com/hc/en-gb/articles/4411298079129-What-features-and-products-are-available-in-my-registered-business-location'
AWX_ELIGIBLE = 'https://help.airwallex.com/hc/en-gb/articles/4408591334937'

# (arena, productId, url, verbatim quote) -> one claimed-docs evidence row each.
EVIDENCE = [
    ('expense-management', 'brex', BREX_REQS,
     'All Brex applicants are required to have a US EIN issued by the IRS, a valid US incorporation, US operations, and a US physical address.'),
    ('expense-management', 'brex', BREX_GLOBAL,
     'Issue physical and virtual cards in 60+ countries with built-in controls and no charge for international delivery.'),
    ('expense-management', 'brex', BREX_GLOBAL,
     'Pay your global statements and reimbursements to and from local bank accounts to avoid intercompany transactions and accelerate payments.'),
    ('expense-management', 'brex', BREX_GLOBAL,
     'Manage budgets and spend limits in over 100 currencies and embed localized expense policies to enable spend for entities, individuals, and departments.'),
    ('expense-management', 'ramp', RAMP_APPLY,
     'To qualify for Ramp, your business must be: Be registered in the United States Be a corporation, limited liability company, or LP (nonprofits welcome).'),
    ('expense-management', 'ramp', RAMP_APPLY,
     'Have most of your operations and corporate spending in the US (although we do support international transactions)'),
    ('expense-management', 'ramp', RAMP_APPLY,
     'All applicants must include an employer identification number (EIN) on the application. This is a legal compliance requirement that cannot be waived.'),
    ('mobile-payments', 'square', SQUARE_INTL,
     'Card payment acceptance with the Square app is currently available in the US, Canada, Australia, Japan, the United Kingdom, Republic of Ireland, France and Spain. We currently don’t support payment card processing outside of these countries'),
    ('mobile-payments', 'square', SQUARE_INTL,
     'You must be located in the country where you activated your account to process card payments.'),
    ('mobile-payments', 'square', SQUARE_INTL,
     'You’re unable to change the country of an existing Square account, but you’re always welcome to open a new account and select any supported country.'),
    ('payments', 'airwallex', AWX_ELIGIBLE,
     'To apply for an Airwallex business account, your business must be registered in a supported country or territory. This geographic requirement does not guarantee approval; other account eligibility criteria also apply. The Airwallex Entity that onboards your business depends on its registration location.'),
    ('payments', 'airwallex', AWX_ELIGIBLE,
     'If your registration location is not listed, Airwallex is unable to process your application at this time.'),
    ('payments', 'airwallex', AWX_FEATURES,
     'Available features and products will vary depending on the location of your business registered entity. This is because each region requires the right local licenses to provide our full suite of services.'),
    ('payments', 'airwallex', AWX_FEATURES,
     'Airwallex supports businesses across 50+ countries.'),
]

# Eligible-countries table fragments verified live so the vendor-geo notes below quote only
# what the page says today (the rows themselves cite AWX_ELIGIBLE / AWX_FEATURES).
AWX_TABLE_CHECKS = [
    'Brazil BR UNITED STATES OF AMERICA',
    'Mexico MX UNITED STATES OF AMERICA',
    'India IN SINGAPORE',
    'Germany DE NETHERLANDS',
    'France FR NETHERLANDS',
    'United Kingdom GB UNITED KINGDOM',
    'United States of America US UNITED STATES OF AMERICA',
]
AWX_FEATURE_CHECKS = [
    'Registered business location Global Accounts FX & Transfers Borderless Cards Payment Links & Plugins Expense Management Bill Pay',
    '** United Kingdom registered businesses only',
    '*European Economic Area countries and Switzerland',
]

BREX_LOCKED = (
    'US entities only for the expense-management offering: "All Brex applicants are required to '
    'have a US EIN issued by the IRS, a valid US incorporation, US operations, and a US physical '
    'address." The global spend features serve a US-anchored customer’s employees abroad, not '
    'locally registered companies.'
)
RAMP_LOCKED = (
    'US-registered businesses only: applicants must "Be registered in the United States" and '
    '"Have most of your operations and corporate spending in the US (although we do support '
    'international transactions)"; the EIN requirement "cannot be waived".'
)
SQUARE_OUT = (
    'Not supported for in-person acceptance: "We currently don’t support payment card '
    'processing outside of these countries" (US, Canada, Australia, Japan, the United Kingdom, '
    'Republic of Ireland, France and Spain).'
)


def awx_absent(country: str) -> str:
    return (
        f'{country} is absent from the eligible-countries list: "If your registration location '
        'is not listed, Airwallex is unable to process your application at this time."'
    )


# (arena, productId, country, status, sourceUrl, note)
GEO_ROWS = [
    ('expense-management', 'brex', 'US', 'available', BREX_REQS,
     'Home market: sign-up requires "a US EIN issued by the IRS, a valid US incorporation, US operations, and a US physical address"; the full expense-management product is available.'),
    *[('expense-management', 'brex', c, 'unavailable', BREX_REQS, BREX_LOCKED)
      for c in ('UK', 'IN', 'DE', 'FR', 'BR', 'MX', 'AR', 'CO', 'CL', 'PE')],
    ('expense-management', 'ramp', 'US', 'available', RAMP_APPLY,
     'The apply path is "Qualifications to apply for Ramp (U.S. based)": a US-registered corporation, LLC, or LP with an EIN; the full expense-management product is available.'),
    *[('expense-management', 'ramp', c, 'unavailable', RAMP_APPLY, RAMP_LOCKED)
      for c in ('UK', 'IN', 'DE', 'FR', 'BR', 'MX', 'AR', 'CO', 'CL', 'PE')],
    ('mobile-payments', 'square', 'US', 'available', SQUARE_INTL,
     'Home market: "Card payment acceptance with the Square app is currently available in the US, Canada, Australia, Japan, the United Kingdom, Republic of Ireland, France and Spain."'),
    ('mobile-payments', 'square', 'UK', 'available', SQUARE_INTL,
     'The United Kingdom is one of the eight countries with in-person "Card payment acceptance with the Square app"; sellers must be "located in the country where you activated your account".'),
    ('mobile-payments', 'square', 'FR', 'available', SQUARE_INTL,
     'France is one of the eight countries with in-person "Card payment acceptance with the Square app"; sellers must be "located in the country where you activated your account".'),
    *[('mobile-payments', 'square', c, 'unavailable', SQUARE_INTL, SQUARE_OUT)
      for c in ('IN', 'DE', 'BR', 'MX', 'AR', 'CO', 'CL', 'PE')],
    ('payments', 'airwallex', 'US', 'available', AWX_FEATURES,
     'The United States is a registered-business location with Payment Links & Plugins (online payment acceptance) in the per-location product table.'),
    ('payments', 'airwallex', 'UK', 'available', AWX_FEATURES,
     'Payments are available for UK-registered businesses; the product table flags its Payments column "United Kingdom registered businesses only".'),
    ('payments', 'airwallex', 'DE', 'available', AWX_FEATURES,
     'Served via the Europe row of the per-location product table (EEA countries and Switzerland; German businesses onboard to the NETHERLANDS entity) with Payments available.'),
    ('payments', 'airwallex', 'FR', 'available', AWX_FEATURES,
     'Served via the Europe row of the per-location product table (EEA countries and Switzerland; French businesses onboard to the NETHERLANDS entity) with Payments available.'),
    ('payments', 'airwallex', 'IN', 'partial', AWX_ELIGIBLE,
     'Changed since the 2026-09-28 spike: India now appears on the eligible-countries list ("India IN SINGAPORE"), but the per-location product table covers only the ten local-entity locations, so payments availability for India-registered businesses is onboarding-eligible yet not product-documented.'),
    ('payments', 'airwallex', 'BR', 'partial', AWX_ELIGIBLE,
     'Brazil onboards to the US entity per the eligible-countries list ("Brazil BR UNITED STATES OF AMERICA"); the per-location product table does not document which products, including payment acceptance, a Brazil-registered business receives.'),
    ('payments', 'airwallex', 'MX', 'partial', AWX_ELIGIBLE,
     'Mexico onboards to the US entity per the eligible-countries list ("Mexico MX UNITED STATES OF AMERICA"); the per-location product table does not document which products, including payment acceptance, a Mexico-registered business receives.'),
    ('payments', 'airwallex', 'AR', 'unavailable', AWX_ELIGIBLE, awx_absent('Argentina')),
    ('payments', 'airwallex', 'CO', 'unavailable', AWX_ELIGIBLE, awx_absent('Colombia')),
    ('payments', 'airwallex', 'CL', 'unavailable', AWX_ELIGIBLE, awx_absent('Chile')),
    ('payments', 'airwallex', 'PE', 'unavailable', AWX_ELIGIBLE, awx_absent('Peru')),
]


def get(url: str, timeout: int = 30):
    """One keyless GET, no retries. Returns (status, body) or ('ERR', message)."""
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status, res.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read(8192).decode('utf-8', 'replace')
    except (urllib.error.URLError, ssl.SSLError, ConnectionError, OSError) as e:
        return 'ERR', str(e)


def to_text(body: str) -> str:
    text = re.sub(r'<script[^>]*>.*?</script>', ' ', body, flags=re.S)
    text = re.sub(r'<style[^>]*>.*?</style>', ' ', text, flags=re.S)
    text = html.unescape(re.sub(r'<[^>]+>', ' ', text))
    text = re.sub(r'\s\d\s', ' ', ' ' + text + ' ')  # standalone footnote markers
    return re.sub(r'\s+', ' ', text).replace(' :', ':').replace(' ,', ',').strip()


def norm(q: str) -> str:
    return re.sub(r'\s+', ' ', re.sub(r'\s\d\s', ' ', ' ' + q + ' ')).replace(' :', ':').replace(' ,', ',').strip()


def append_evidence(arena: str, pid: str, url: str, excerpt: str) -> None:
    path = os.path.join(DATA, arena, 'evidence', f'{pid}.json')
    ev = json.load(open(path))
    prefix = excerpt.split(' (observed')[0]
    if any(e['tier'] == 'claimed-docs' and e.get('excerpt', '').startswith(prefix) for e in ev):
        print(f'{arena}/{pid}: docs row already recorded, skipping: {prefix[:60]}')
        return
    n = max([int(e['id'].rsplit('-', 1)[1]) for e in ev if e['id'].startswith(f'{pid}-docs-')] or [0]) + 1
    ev.append({'id': f'{pid}-docs-{n}', 'tier': 'claimed-docs', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
    with open(path, 'w') as f:
        json.dump(ev, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print(f'{arena}/{pid}: appended {pid}-docs-{n}')


def run() -> int:
    texts = {}
    for url in (BREX_REQS, BREX_GLOBAL, RAMP_APPLY, SQUARE_INTL, AWX_FEATURES, AWX_ELIGIBLE):
        status, body = get(url)
        print(f'{url}: {status}')
        if status != 200:
            print(f'abort: {url} answered {status}; nothing recorded', file=sys.stderr)
            return 1
        texts[url] = to_text(body)
        time.sleep(2)

    for _arena, _pid, url, quote in EVIDENCE:
        if norm(quote) not in texts[url]:
            print(f'abort: quote not found verbatim on {url}: {quote[:80]}', file=sys.stderr)
            return 1
    for frag in AWX_TABLE_CHECKS:
        if norm(frag) not in texts[AWX_ELIGIBLE]:
            print(f'abort: eligible-countries fragment not found: {frag}', file=sys.stderr)
            return 1
    for frag in AWX_FEATURE_CHECKS:
        if norm(frag) not in texts[AWX_FEATURES]:
            print(f'abort: product-table fragment not found: {frag}', file=sys.stderr)
            return 1

    for arena, pid, url, quote in EVIDENCE:
        append_evidence(arena, pid, url, norm(quote) + f' (observed {TODAY})')

    rows = json.load(open(GEO))
    existing = {(r['arenaId'], r['productId'], r['country']) for r in rows}
    added = 0
    for arena, pid, country, geo_status, src, note in GEO_ROWS:
        if (arena, pid, country) in existing:
            print(f'skip existing: {arena}/{pid}/{country}')
            continue
        rows.append({'productId': pid, 'arenaId': arena, 'country': country, 'status': geo_status,
                     'sourceUrl': src, 'note': note, 'checkedAt': TODAY})
        added += 1
    # ensure_ascii=True matches the file's committed house format (build-vendor-geo.py wrote it
    # with escaped non-ASCII); keeping it avoids a re-escaping diff.
    with open(GEO, 'w') as f:
        json.dump(rows, f, indent=2, ensure_ascii=True)
        f.write('\n')
    print(f'vendor-geo: appended {added} rows; total {len(rows)}')
    return 0


if __name__ == '__main__':
    sys.exit(run())
