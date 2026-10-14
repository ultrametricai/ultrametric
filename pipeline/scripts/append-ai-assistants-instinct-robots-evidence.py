#!/usr/bin/env python3
# One-shot helper for the Instinct ai-assistants bring-up (founder ask 2026-10-02).
#
# Instinct (instinct.com) is invite-only and its ToS prohibits automated access to the
# Services ("any robot, spider, crawlers, scraper"), so this bring-up deliberately runs NO
# hands-on probes and NO path-fishing (no /llms.txt, /openapi.json, /docs guesses) against
# instinct.com. The ONLY direct HTTP observations recorded are the two crawler-facing
# metadata files the vendor publishes specifically for automated consumption — robots.txt
# and the sitemap it points at — each fetched once on 2026-10-02 with the pipeline's
# identified UA. robots.txt (last-modified 2026-10-02) allows ALL user-agents on ALL paths,
# which is what sanctioned the standard single-fetch crawl of the public pages (homepage,
# /terms, /privacy-policy) used for the claimed-docs tier.
#
# Run AFTER extract/collect-community (both preserve probe-tier items, but a future spike's
# probe stage wholesale-replaces the probe tier — re-run this script after any probe refresh;
# see the probe-stage-replacement gotcha).
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'instinct': [
        {
            'id': 'instinct-probe-rt-1',
            'tier': 'probe',
            'url': 'https://instinct.com/robots.txt',
            'excerpt': "PROBE (single fetch, 2026-10-02): https://instinct.com/robots.txt serves HTTP 200 text/plain (last-modified 2026-10-02) explicitly allowing every crawler — named Allow:/ blocks for Googlebot/Bingbot/Applebot/OAI-SearchBot/ChatGPT-User/PerplexityBot/Claude-SearchBot/Claude-User plus a default 'User-agent: * / Allow: /' — and points at https://instinct.com/sitemap.xml. This robots grant is what permitted the single-fetch crawl of the public pages; no other automated access was made (the ToS bars robots/scrapers from the Services, and the product is invite-only, so no hands-on or path-fishing probes were run).",
            'fetchedAt': NOW,
        },
        {
            'id': 'instinct-probe-rt-2',
            'tier': 'probe',
            'url': 'https://instinct.com/sitemap.xml',
            'excerpt': "PROBE (single fetch, 2026-10-02): the vendor's own sitemap at https://instinct.com/sitemap.xml declares exactly ONE url — the homepage (<loc>https://instinct.com/</loc>, changefreq weekly) — so the vendor's declared public crawl surface contains no docs site, no developer/API pages, and no pricing page. Consistent with the homepage/ToS mentioning no API, MCP, CLI, or developer surface: Instinct is an agent that consumes other products' surfaces and exposes none of its own to agents.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'open-rankings/ai-assistants/evidence/{pid}.json'
    ev = json.load(open(path))
    existing = {e['id'] for e in ev}
    for item in items:
        if item['id'] in existing:
            print(f'{pid}: {item["id"]} already present, skipping')
            continue
        ev.append(item)
        print(f'{pid}: appended {item["id"]}')
    with open(path, 'w') as f:
        f.write(json.dumps(ev, indent=2) + '\n')
