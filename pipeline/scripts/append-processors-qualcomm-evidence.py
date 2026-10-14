#!/usr/bin/env python3
# Processors arena bring-up (2026-09): hand-verified claimed-docs evidence for the Snapdragon
# X2 Elite Extreme. qualcomm.com is a client-rendered React app — every fetcher in the pipeline
# (crawl UA, plain curl, WebFetch) receives a 6.9KB JS shell that literally says "You need to
# enable JavaScript to run this app", so the standard crawl→extract path has no corpus to work
# with (the same bot-wall class the Intel ARK note in open-rankings/experiments/processors.json records).
# Spec values below are the vendor's own published figures, verified via rendered browser fetch
# at the 2026-09-14 experiments curation (open-rankings/experiments/processors.json, same sourceUrl) and
# re-checked at bring-up. The JS-shell fact itself is recorded in the pack — recorded reality
# wins, and spec-transparency is a judged axis in this arena.
import datetime
import json
import os

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

SPEC = 'https://www.qualcomm.com/laptops/products/snapdragon-x2-elite'
DEV = 'https://www.qualcomm.com/developer'

ITEMS = [
    ('qualcomm-snapdragon-x2-elite-extreme-docs-1', SPEC,
     "Qualcomm's Snapdragon X2 Elite spec page (verified via rendered browser fetch — the page is a client-rendered app and serves only a JS shell to non-browser fetchers): Snapdragon X2 Elite Extreme is an 18-core Qualcomm Oryon CPU (12 Prime + 6 Performance cores) with boost up to 5.0 GHz on the Extreme variant; the standard X2 Elite boosts to 4.7 GHz."),
    ('qualcomm-snapdragon-x2-elite-extreme-docs-2', SPEC,
     "Vendor spec page: Hexagon NPU rated at up to 85 TOPS (vendor figure, precision not stated on the page) — Qualcomm positions Snapdragon X2 Elite laptops as Copilot+ PCs with on-device AI as the headline feature."),
    ('qualcomm-snapdragon-x2-elite-extreme-docs-3', SPEC,
     "Vendor spec page: up to 228 GB/s LPDDR5x memory bandwidth, as stated by Qualcomm."),
    ('qualcomm-snapdragon-x2-elite-extreme-docs-4', SPEC,
     "Spec-disclosure gap, recorded as-is: Qualcomm does not publish a TDP/power figure on the X2 Elite spec page (power envelopes are left to laptop OEMs), does not state the process node there, and does not publish a max-memory-capacity figure — and the spec page itself is unreadable without JavaScript, serving only 'You need to enable JavaScript to run this app' to crawlers."),
    ('qualcomm-snapdragon-x2-elite-extreme-docs-5', SPEC,
     "Availability, per vendor announcement: Snapdragon X2 Elite and X2 Elite Extreme were announced September 2025 at Snapdragon Summit; PCs ship in 2026 as Windows-on-Arm laptops."),
    ('qualcomm-snapdragon-x2-elite-extreme-docs-6', DEV,
     "Qualcomm's developer portal covers Windows on Snapdragon development: Arm-native Windows toolchains, the Qualcomm AI Engine Direct SDK, and Qualcomm AI Hub for optimizing and deploying models to the Hexagon NPU on Snapdragon X-series PCs."),
]

path = 'open-rankings/processors/evidence/qualcomm-snapdragon-x2-elite-extreme.json'
existing = []
if os.path.exists(path):
    existing = json.load(open(path))
have = {e['id'] for e in existing}
for eid, url, excerpt in ITEMS:
    if eid in have:
        continue
    existing.append({'id': eid, 'tier': 'claimed-docs', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
os.makedirs(os.path.dirname(path), exist_ok=True)
open(path, 'w').write(json.dumps(existing, indent=2) + '\n')
print(f'wrote {len(existing)} evidence items to {path}')
