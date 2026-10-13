#!/usr/bin/env python3
# Settle the 2026-09-21 Muse supplementary-evidence re-judge under the standard churn policy
# (spike-engine churnDecision / revert-churn-*-wave.ts): a verdict flip is kept only when it
# cites at least one evidence id that did not exist before the pass (here the three
# muse-supp-* items appended by append-ai-assistants-muse-docs-evidence.py); every other flip
# is judge re-roll noise and is reverted to the spike-settled verdict, with the judge cache
# patched in place (same hash, restored verdict) so the next judge run doesn't resurrect it.
#
# Inputs:
#   --before <verdicts.json snapshot taken before the re-judge>
#   --old-ids <json array of evidence ids that existed before the append>
import argparse
import json
import os

ap = argparse.ArgumentParser()
ap.add_argument('--before', required=True)
ap.add_argument('--old-ids', required=True)
ap.add_argument('--write', action='store_true')
args = ap.parse_args()

ARENA = 'ai-assistants'
PRODUCT = 'muse'
VERDICTS = f'rankings/{ARENA}/verdicts.json'
CACHE_DIR = f'pipeline/cache/judge/{ARENA}/{PRODUCT}'

old_ids = set(json.load(open(args.old_ids)))
before = {v['storyId']: v for v in json.load(open(args.before)) if v['productId'] == PRODUCT}
current = json.load(open(VERDICTS))
cur_evidence_ids = {e['id'] for e in json.load(open(f'rankings/{ARENA}/evidence/{PRODUCT}.json'))}

kept, reverted, unchanged = 0, 0, 0
settled = []
for v in current:
    if v['productId'] != PRODUCT:
        settled.append(v)
        continue
    old = before.get(v['storyId'])
    if old is None:
        settled.append(v)
        kept += 1
        continue
    if old['verdict'] == v['verdict'] and old['quality'] == v['quality']:
        settled.append(v)
        unchanged += 1
        continue
    cites_new = any(i not in old_ids for i in v['evidenceIds'])
    if cites_new:
        print(f"KEEP   {PRODUCT}:{v['storyId']} {old['verdict']}/q{old['quality']} -> {v['verdict']}/q{v['quality']} (cites new evidence)")
        settled.append(v)
        kept += 1
        continue
    old_resolves = all(i in cur_evidence_ids for i in old['evidenceIds'])
    if not old_resolves:
        print(f"KEEP   {PRODUCT}:{v['storyId']} (old citations no longer resolve)")
        settled.append(v)
        kept += 1
        continue
    print(f"REVERT {PRODUCT}:{v['storyId']} {v['verdict']}/q{v['quality']} -> {old['verdict']}/q{old['quality']} (no new citation)")
    settled.append(old)
    reverted += 1
    if args.write:
        cache_file = os.path.join(CACHE_DIR, f"{v['storyId']}.json")
        if os.path.exists(cache_file):
            cached = json.load(open(cache_file))
            with open(cache_file, 'w') as f:
                f.write(json.dumps({'hash': cached['hash'], 'verdict': old}, indent=2, ensure_ascii=False))

print(f"settle: {kept} kept, {reverted} reverted, {unchanged} unchanged")
if args.write:
    with open(VERDICTS, 'w') as f:
        f.write(json.dumps(settled, indent=2, ensure_ascii=False) + '\n')
    print(f"wrote {VERDICTS}")
else:
    print('dry run (pass --write to apply)')
