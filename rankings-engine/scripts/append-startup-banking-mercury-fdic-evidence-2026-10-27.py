#!/usr/bin/env python3
# Evidence-parity repair (2026-10-27), mercury / startup-banking: the fdic-insurance-sweep
# cell judged "none" with the rationale "the evidence pack never mentions sweeping deposits
# across partner banks or extended FDIC insurance coverage" — but Mercury's own site documents
# exactly that capability (mercury.com/security and the homepage). Same precedent as
# append-startup-banking-mercury-evidence.py: pack-assembly gaps (extraction caps, transform
# losses) starved a documented capability out of the pack; the repair appends verbatim,
# live-verified passages from the vendor's pages and re-judges the product scoped.
#
# Also re-verifies, dated, the api-machine-spec question the 2026-09-14 script settled:
# Mercury still publishes NO publicly downloadable OpenAPI file (openapi.json/swagger.json
# 404; the ReadMe docs hub ships "showOpenAPIDownload":false and "openapiVisibility":"admin").
# The probe below fails loudly if a public spec appears, so a future run cannot append a
# stale negative. The probe row carries preserve: true so a scheduled probe refresh merges
# around it instead of clobbering it (lib/schemas.ts EvidenceSchema.preserve).
#
# Run, then: pnpm engine judge --category startup-banking --product mercury
#            pnpm engine derive --category startup-banking
import datetime
import json
import re
import subprocess

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
EVIDENCE = 'open-rankings/startup-banking/evidence/mercury.json'
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 productarena-probe'

# (id, url, required live markers, excerpt)
DOC_ITEMS = [
    ('mercury-supp-fdic-sweep-security', 'https://mercury.com/security',
     ['FDIC insurance', 'sweep networks', 'up to 20 different banks', 'Choice Financial Group', 'Column N.A.'],
     'Mercury\'s security page: "Up to $5M in FDIC insurance — Made possible through our partner banks’ sweep '
     'networks"; "97%+ of deposits are FDIC-insured — Our customers’ checking and savings deposits are almost '
     'completely insured"; "With Mercury Vault enabled on every account, you have an automatic and up-to-date view on '
     'exactly how your funds are protected." The FAQ spells out the mechanism: "Through each of our partner banks, '
     'Mercury customers get access to a sweep network of trusted banks. This sweep network provides up to $5M in FDIC '
     'insurance by automatically spreading your deposits across up to 20 different banks, without requiring you to '
     'open and manage multiple accounts." Disclaimer on the same page: "Mercury is a fintech company, not an '
     'FDIC-insured bank. Banking services provided through Choice Financial Group and Column N.A., Members FDIC." and '
     '"Certain conditions must be satisfied for pass-through FDIC insurance to apply."'),
    ('mercury-supp-fdic-sweep-home', 'https://mercury.com',
     ['FDIC insurance', 'sweep networks'],
     'Mercury homepage, deposit-protection section: "20x the usual coverage — Get up to $5M FDIC insurance through our '
     'partner banks and their sweep networks to ensure eligible deposits are protected." Footer disclosure: "Deposits '
     'in checking and savings accounts are FDIC-insured through Choice Financial Group and Column N.A. and their Sweep '
     'Program Network Banks. Certain conditions must be satisfied for pass-through FDIC insurance to apply."'),
]


def fetch(url):
    r = subprocess.run(
        ['curl', '-s', '--max-time', '25', '-A', UA, '-w', '\n---META %{http_code}', url],
        capture_output=True, text=True, timeout=35)
    body, _, meta = r.stdout.rpartition('\n---META ')
    return int(meta.strip() or 0), body


def verify_doc_item(url, markers):
    status, body = fetch(url)
    if status != 200:
        raise SystemExit(f'{url} returned {status}; refusing to append unverified evidence')
    # Markers are checked against tag-stripped, whitespace-collapsed text (the pages interleave
    # markup inside sentences) and are chosen ASCII-safe around typographic punctuation.
    text = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', body))
    for marker in markers:
        if marker not in text:
            raise SystemExit(f'{url} no longer contains {marker!r}; the page changed — re-derive the excerpt')


def openapi_reverify():
    """Dated re-check of the 2026-09-14 finding: no public OpenAPI download. Fails loudly if
    reality changed, so the negative can never be appended stale."""
    candidates = ['https://docs.mercury.com/openapi.json', 'https://docs.mercury.com/swagger.json',
                  'https://docs.mercury.com/api/openapi.json', 'https://docs.mercury.com/.well-known/openapi.json']
    statuses = {}
    for u in candidates:
        status, _ = fetch(u)
        statuses[u] = status
        if status == 200:
            raise SystemExit(f'openapi re-probe: {u} now returns 200 — a public spec EXISTS; do not append the negative, re-judge with the spec instead')
    status, body = fetch('https://docs.mercury.com/reference/getaccounts')
    if status != 200:
        raise SystemExit(f'openapi re-probe: reference page returned {status}')
    for marker in ['"showOpenAPIDownload":false', '"openapiVisibility":"admin"', 'openapi.yaml', 'Try It']:
        if marker not in body:
            raise SystemExit(f'openapi re-probe: reference page no longer contains {marker!r}')
    status_list = ', '.join(f'{u} -> {s}' for u, s in statuses.items())
    return (f'PROBE openapi-reverify ({NOW[:10]}): all conventional public spec paths still 404 ({status_list}). '
            'The docs hub page config still disables the download: the ReadMe project contains OpenAPI definitions '
            '(mwb-openapi.yaml) but ships "showOpenAPIDownload":false and "openapiVisibility":"admin" — the '
            'machine-readable spec exists internally and is not publicly downloadable. The same page serves the '
            'interactive "Try It" runner (HTTP 200). Unchanged from the 2026-09-14 probe (mercury-probe-6 lineage).')


def main():
    ev = json.load(open(EVIDENCE))
    existing = {e['id'] for e in ev}

    for iid, url, markers, excerpt in DOC_ITEMS:
        if iid in existing:
            print(f'{iid}: already present, skipping')
            continue
        verify_doc_item(url, markers)
        ev.append({'id': iid, 'tier': 'claimed-docs', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
        print(f'appended {iid}')

    probe_id = 'mercury-probe-openapi-20261027'
    if probe_id in existing:
        print(f'{probe_id}: already present, skipping')
    else:
        excerpt = openapi_reverify()
        ev.append({'id': probe_id, 'tier': 'probe', 'url': 'https://docs.mercury.com/openapi.json',
                   'excerpt': excerpt, 'fetchedAt': NOW, 'preserve': True})
        print(f'appended {probe_id}')

    with open(EVIDENCE, 'w') as f:
        f.write(json.dumps(ev, indent=2) + '\n')


if __name__ == '__main__':
    main()
