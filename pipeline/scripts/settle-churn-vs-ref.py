#!/usr/bin/env python3
# Churn settle vs a git ref — the spike-engine churn rule (pipeline/scripts/spike-engine.ts
# churnDecision, itself the revert-churn-*-wave.ts rule) applied end-to-end over a whole
# evidence wave for one product: a verdict flip survives only when it cites at least one
# evidence id that did not exist at the baseline ref; every other flip is reverted to the
# baseline verdict — UNLESS the baseline verdict's citations no longer resolve in the current
# evidence file (the probe stage wholesale-replaces tier:'probe' ids; restoring a verdict with
# dangling citations would make lib/data.ts throw), in which case the fresh judgment stands.
# Reverts patch the judge cache too (keep the current hash, restore the old verdict) so the
# next judge run doesn't resurrect the churn.
#
# Usage: python3 pipeline/scripts/settle-churn-vs-ref.py <ref> <arena> <productId>
import json
import subprocess
import sys

ref, arena, pid = sys.argv[1], sys.argv[2], sys.argv[3]

def git_show(path):
    out = subprocess.run(['git', 'show', f'{ref}:{path}'], capture_output=True, text=True)
    if out.returncode != 0:
        return None
    return json.loads(out.stdout)

old_evidence = git_show(f'rankings/{arena}/evidence/{pid}.json') or []
old_verdicts = git_show(f'rankings/{arena}/verdicts.json') or []
old_ids = {e['id'] for e in old_evidence}
old_by_story = {v['storyId']: v for v in old_verdicts if v['productId'] == pid}

cur_evidence = json.load(open(f'rankings/{arena}/evidence/{pid}.json'))
cur_ids = {e['id'] for e in cur_evidence}
verdicts_path = f'rankings/{arena}/verdicts.json'
verdicts = json.load(open(verdicts_path))

kept = reverted = unchanged = 0
settled = []
for v in verdicts:
    if v['productId'] != pid:
        settled.append(v)
        continue
    old = old_by_story.get(v['storyId'])
    if old is None:
        kept += 1
        settled.append(v)
        continue
    if old['verdict'] == v['verdict'] and old['quality'] == v['quality']:
        unchanged += 1
        settled.append(v)
        continue
    cites_new = any(i not in old_ids for i in v['evidenceIds'])
    if cites_new:
        kept += 1
        settled.append(v)
        continue
    old_resolves = all(i in cur_ids for i in old['evidenceIds'])
    if not old_resolves:
        kept += 1
        settled.append(v)
        continue
    reverted += 1
    print(f"REVERT {arena}/{pid}:{v['storyId']} {v['verdict']}/q{v['quality']} -> {old['verdict']}/q{old['quality']} (no new citation vs {ref})")
    cache_file = f'pipeline/cache/judge/{arena}/{pid}/{v["storyId"]}.json'
    try:
        cached = json.load(open(cache_file))
        cached_out = {'hash': cached['hash'], 'verdict': old}
        open(cache_file, 'w').write(json.dumps(cached_out, indent=2, ensure_ascii=False) + '\n')
    except FileNotFoundError:
        print(f'  WARN no judge cache at {cache_file} — verdict reverted in verdicts.json only')
    settled.append(old)

open(verdicts_path, 'w').write(json.dumps(settled, indent=2, ensure_ascii=False) + '\n')
print(f'settle: {arena}/{pid} — {kept} flips kept, {reverted} reverted, {unchanged} cells unchanged vs {ref}')
