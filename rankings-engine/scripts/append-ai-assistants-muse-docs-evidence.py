#!/usr/bin/env python3
# Muse (ai-assistants) crawl-gap fix, 2026-09-21 deep-index wave: supplements the evidence pack
# with verbatim passages from CRAWLED/VERIFIED vendor pages the LLM extraction pass missed —
# same precedent as append-api-quality-docs-evidence.py (per-source extraction caps starve
# specific capabilities out of the pack even though the corpus contains them verbatim).
# Context: the 2026-09-21 spike re-crawl of Muse's post-launch surface (marketing homepage now
# public; "How We Built Safety Into Muse" at research.meta.ai, the security.muse.ai redirect
# target, added to urls.extra) contains explicit first-party statements on (1) the model-
# training opt-out switch, (2) free inspect/edit/download of all VM files including memory,
# and (3) the Mac client + WhatsApp channel — but the judged cells privacy-no-training,
# training-opt-out, export-my-data, openness-full-export, and desktop-app were decided on a
# pack that lacked those lines. Every excerpt below is verbatim from the crawled page in
# pipeline/cache/crawl/ai-assistants/muse/ (checked at authoring time, 2026-09-21).
#
# Verified-honest counterparts (NO items added, on purpose):
#   - voice-conversation / image-understanding: the privacy policy lists "text, voice, photos"
#     only as a data-inventory category, not a documented capability — cells stay as judged.
#   - agentic-public-api / api-*: muse.ai exposes no developer surface at all (llms.txt /docs
#     /api /openapi.json all 307 to the homepage; api.muse.ai 404s; no MCP well-knowns) —
#     the none/na cells are the honest reading, no probe recorded (ChatGPT/Claude precedent).
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

SAFETY_BLOG = 'https://research.meta.ai/blog/security-and-safety-for-ai-agents-our-approach-with-muse'

ITEMS = {
    ('ai-assistants', 'muse'): [
        ('muse-supp-training-optout', SAFETY_BLOG,
         '"How We Built Safety Into Muse", Our Policy Around Data: trajectories "are sanitized to remove key personally identifiable information before being used in training. We think this is a good default... If you do not want your data to be used in model training at all, you can opt-out via a simple switch in Muse settings."'),
        ('muse-supp-vm-files-export', SAFETY_BLOG,
         '"How We Built Safety Into Muse", Our Policy Around Data: "All the files you put in your VM and everything Muse generates or uses on your behalf is stored there. You can inspect, edit and download these files freely, including Muse’s memory about you." Plus: "Your VM data is backed up continuously so you can restore it if something goes wrong."'),
        ('muse-supp-mac-whatsapp-clients', 'https://muse.ai',
         'Homepage, "Designed around the way you already communicate": "Chat with your agent in the same way you message with other people, using the Muse app on mobile, Mac, or directly in WhatsApp. There\'s no learning curve, just tell Muse what you want to get done."'),
    ],
}

for (category, pid), items in ITEMS.items():
    path = f'open-rankings/{category}/evidence/{pid}.json'
    ev = json.load(open(path))
    existing = {e['id'] for e in ev}
    appended = 0
    for iid, url, excerpt in items:
        if iid in existing:
            print(f'{category}/{pid}: {iid} already present, skipping')
            continue
        ev.append({'id': iid, 'tier': 'claimed-docs', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
        print(f'{category}/{pid}: appended {iid}')
        appended += 1
    if appended:
        with open(path, 'w') as f:
            f.write(json.dumps(ev, indent=2, ensure_ascii=False) + '\n')
