#!/usr/bin/env python3
# Gusto cross-arena roster bring-up (2026-10-23): records evidence for the two debut entries
# (legal-ops, startup-banking) covering the business formation, banking, and Business Compliance
# offerings Gusto announced on 2026-10-01 and 2026-10-22.
#
# The wall is client-dependent, and this script records exactly what it observes: gusto.com
# answers HTTP 403 Cloudflare challenges to the engine's Node fetch and to curl, while its
# robots.txt (which publishes `Content-Signal: ai-train=yes, search=yes, ai-input=yes` and does
# not disallow the paths quoted here) and product pages answer HTTP 200 to this script's plain
# keyless HTTP/1.1 client. So:
#   - claimed-docs rows are quoted verbatim from Gusto's own pages, fetched here, with each
#     quote verified against the live page text before it is written (no quote → abort);
#   - one probe row per arena records the client-dependent wall observation (preserve: true so
#     a scheduled probe refresh keeps it — the documented probe-stage replacement gotcha);
#   - one community row per arena quotes the CPA Practice Advisor launch coverage.
#
# Verification normalizes HTML to text (tags stripped, entities unescaped, whitespace
# collapsed) and drops standalone single-digit footnote markers; stored excerpts are the page
# sentences minus those superscript markers.
#
# Run AFTER `pnpm engine extract` and `pnpm engine probe`. Ids continue each arena's existing
# `gusto-docs-N` / `gusto-probe-N` / `gusto-comm-N` numbering. Idempotent by excerpt.
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

START_URL = 'https://gusto.com/company-news/start-your-business'
COMPLIANCE_URL = 'https://gusto.com/product/business-compliance'
CPA_URL = 'https://www.cpapracticeadvisor.com/2026/10/22/gusto-touts-new-products-and-features-for-small-businesses/192269/'

# (arena, tier, abbrev, url, verbatim quote)
ROWS = [
    ('legal-ops', 'claimed-docs', 'docs', START_URL,
     'Gusto is expanding beyond its payroll, benefits, and compliance platform into business formation and banking products, helping entrepreneurs form their company, register for an EIN, and open a business bank account in a single guided flow.'),
    ('legal-ops', 'claimed-docs', 'docs', START_URL,
     'Company formation. Entrepreneurs can form their business directly through Gusto. EIN registration. Gusto guides business owners through registering for a federal EIN as part of the same flow.'),
    ('legal-ops', 'claimed-docs', 'docs', START_URL,
     'These capabilities are in early beta and will roll out to more entrepreneurs in the coming months.'),
    ('legal-ops', 'claimed-docs', 'docs', COMPLIANCE_URL,
     'State tax registration, foreign qualification, registered agent service, annual and initial report filing, government mail monitoring, proactive deadline alerts, and a dedicated compliance concierge team. Certificates of good standing, business license reports, and state account closures are available as add-ons.'),
    ('legal-ops', 'claimed-docs', 'docs', COMPLIANCE_URL,
     'When Gusto is your registered agent, your filing address stays private, and your mail is monitored and routed to you through Gusto.'),
    ('legal-ops', 'claimed-docs', 'docs', COMPLIANCE_URL,
     'It’s included for those on the Gusto Premium tier plan. Otherwise, it’s available as an add-on at $85 per month, per state you’re registered in ($1,020/year).'),
    ('legal-ops', 'claimed-docs', 'docs', COMPLIANCE_URL,
     'Our business compliance services handle required filings in all 50 states, so you can confidently grow your business without the guesswork.'),
    ('legal-ops', 'claimed-docs', 'docs', COMPLIANCE_URL,
     'Gusto Business Compliance is operational help, not legal, tax, or regulatory advice. It works alongside your accountant or lawyer, not in place of them.'),
    ('startup-banking', 'claimed-docs', 'docs', START_URL,
     'Gusto is expanding beyond its payroll, benefits, and compliance platform into business formation and banking products, helping entrepreneurs form their company, register for an EIN, and open a business bank account in a single guided flow.'),
    ('startup-banking', 'claimed-docs', 'docs', START_URL,
     'A day-one business bank account: no lengthy application, no branch visit, no minimum balance.'),
    ('startup-banking', 'claimed-docs', 'docs', START_URL,
     'Understand your cash flow. An updated Money Dashboard brings finances into one view including cash balance, what\'s coming in, what\'s going out, and what\'s coming up next.'),
    ('startup-banking', 'claimed-docs', 'docs', START_URL,
     'Gusto is a financial technology company, not a bank. Banking services provided by Increase Bank, Member FDIC.'),
    ('startup-banking', 'claimed-docs', 'docs', START_URL,
     'These capabilities are in early beta and will roll out to more entrepreneurs in the coming months.'),
    ('startup-banking', 'claimed-docs', 'docs', START_URL,
     'The moment a business owner hires their first employee, payroll runs in the same product you’re already using. Nothing to connect, nothing to import, nothing new to learn.'),
]

CPA_QUOTES = {
    'startup-banking': 'form an LLC, open a business bank account, and see where their money stands in Gusto, before they hire anyone',
    'legal-ops': 'Gusto Business Compliance handles obligations that trip up owners, especially when they hire in a new state, including state tax registration, annual report filing, and government mail monitoring',
}


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


def seen(body: str, marker: str) -> str:
    return 'present' if marker.lower() in body.lower() else 'absent'


def append(arena: str, tier: str, abbrev: str, url: str, excerpt: str, preserve: bool = False):
    path = os.path.join(DATA, arena, 'evidence', 'gusto.json')
    ev = json.load(open(path))
    prefix = excerpt.split(' (observed')[0]
    if any(e['tier'] == tier and e.get('excerpt', '').startswith(prefix) for e in ev):
        print(f'{arena}: {abbrev} row already recorded, skipping: {prefix[:60]}')
        return
    n = max([int(e['id'].rsplit('-', 1)[1]) for e in ev if e['id'].startswith(f'gusto-{abbrev}-')] or [0]) + 1
    row = {'id': f'gusto-{abbrev}-{n}', 'tier': tier, 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW}
    if preserve:
        row['preserve'] = True
    ev.append(row)
    with open(path, 'w') as f:
        json.dump(ev, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print(f'{arena}: appended gusto-{abbrev}-{n} ({tier})')


def run():
    robots_status, robots_body = get('https://gusto.com/robots.txt')
    print(f'gusto.com/robots.txt: {robots_status}')
    time.sleep(2)

    texts = {}
    for url in (START_URL, COMPLIANCE_URL, CPA_URL):
        status, body = get(url)
        print(f'{url}: {status}')
        if status != 200:
            print(f'abort: {url} answered {status}; nothing recorded', file=sys.stderr)
            return 1
        texts[url] = to_text(body)
        time.sleep(2)

    for arena, tier, abbrev, url, quote in ROWS:
        if norm(quote) not in texts[url]:
            print(f'abort: quote not found verbatim on {url}: {quote[:80]}', file=sys.stderr)
            return 1
    for arena, quote in CPA_QUOTES.items():
        if norm(quote) not in texts[CPA_URL]:
            print(f'abort: quote for {arena} not found verbatim in the CPA article', file=sys.stderr)
            return 1

    wall = (
        f'PROBE front-door wall (client-dependent): robots.txt HTTP {robots_status} to a plain keyless HTTP/1.1 '
        f'client (observed {TODAY}; Content-Signal ai-input marker {seen(robots_body, "ai-input=yes")}), while the '
        'same URL and every gusto.com page answer HTTP 403 Cloudflare challenges to the engine\'s Node fetch and to '
        'curl — so the crawl stage excludes gusto.com, page claims for this entry were recorded by the dated '
        'evidence script after verifying each quote against the live page, and crawled claims come from Gusto\'s '
        'own press releases on PR Newswire.'
    )

    for arena in ('legal-ops', 'startup-banking'):
        append(arena, 'probe', 'probe', 'https://gusto.com/robots.txt', wall, preserve=True)
    for arena, tier, abbrev, url, quote in ROWS:
        append(arena, tier, abbrev, url, norm(quote) + f' (observed {TODAY})')
    for arena, quote in CPA_QUOTES.items():
        append(arena, 'community', 'comm', CPA_URL, f'{norm(quote)} (observed {TODAY}, CPA Practice Advisor, 2026-10-22)')
    return 0


if __name__ == '__main__':
    sys.exit(run())
