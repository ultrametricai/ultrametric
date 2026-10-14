#!/usr/bin/env python3
# One-shot gap-closing supplement for the email arena bring-up (2026-09-06) — the kitty/
# auth-platforms/data-warehouses precedent: verbatim quotes lifted from ALREADY-CRAWLED vendor
# doc pages (rankings-engine/cache/crawl/email/...) that multiple extract passes did not surface,
# covering capabilities the taxonomy asks about directly (Missive snooze / command bar, Fastmail
# snooze). Quotes are byte-for-byte from the cited pages; re-run is idempotent by evidence id.
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'missive': [
        {
            'id': 'missive-docs-supp-1',
            'tier': 'claimed-docs',
            'url': 'https://missiveapp.com/docs/core-features/conversations/snoozing',
            'excerpt': "Snoozing temporarily hides a conversation until a specific time, then brings it back to your Inbox. Use it to defer emails you can't deal with right now without losing track of them.",
            'fetchedAt': NOW,
        },
        {
            'id': 'missive-docs-supp-2',
            'tier': 'claimed-docs',
            'url': 'https://missiveapp.com/docs/core-features/conversations/snoozing',
            'excerpt': 'You can also snooze by swiping a conversation (configurable in Settings > Preferences > Swipes), or by opening the command bar with ⌘/Ctrl + K and typing "snooze".',
            'fetchedAt': NOW,
        },
        {
            'id': 'missive-docs-supp-4',
            'tier': 'claimed-docs',
            'url': 'https://missiveapp.com/docs/core-features/canned-responses',
            'excerpt': 'Canned responses (or templates) are pre-written replies to common questions. Instead of typing the same answer repeatedly, you write it once and insert it with a few keystrokes. In Missive, you can create a collection of canned responses and share them with a team or your entire company.',
            'fetchedAt': NOW,
        },
        {
            'id': 'missive-docs-supp-5',
            'tier': 'claimed-docs',
            'url': 'https://missiveapp.com/docs/core-features/canned-responses/using-variables',
            'excerpt': "You can easily customize your responses or templates with dynamic content like your recipient's name by using our variables templating engine.",
            'fetchedAt': NOW,
        },
        {
            'id': 'missive-docs-supp-3',
            'tier': 'claimed-docs',
            'url': 'https://missiveapp.com/docs/advanced-features/command-bar/using-the-command-bar',
            'excerpt': 'Master the command bar: keyboard shortcuts and quick commands. You can use the following patterns to initiate a search: search searc sear sea se s {query} … you can search in all of your messages, in your contacts or in the messages inside a specific label.',
            'fetchedAt': NOW,
        },
    ],
    'fastmail': [
        {
            'id': 'fastmail-docs-supp-1',
            'tier': 'claimed-docs',
            'url': 'https://www.fastmail.com/features/',
            'excerpt': 'Snooze messages to just when you need them. Whether it’s tickets to that stadium gig in September, or a bill due next Thursday, sometimes you receive an email now that you need to see then.',
            'fetchedAt': NOW,
        },
        {
            'id': 'fastmail-docs-supp-2',
            'tier': 'claimed-docs',
            'url': 'https://www.fastmail.help/hc/en-us/articles/11517883953039-Offline-support',
            'excerpt': "If you're offline when a snoozed message is scheduled to return to your Inbox, you will not see the snoozed message reappear until you're back online.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'open-rankings/email/evidence/{pid}.json'
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
