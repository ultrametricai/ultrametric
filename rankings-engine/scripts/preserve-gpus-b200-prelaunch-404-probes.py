#!/usr/bin/env python3
# gpus refresh (2026-10-23): marks nvidia-b200's recorded 2026-09-24 negative probe row
# (nvidia-b200-probe-3 — all four docs.nvidia.com OpenAPI candidate paths returned 404) with
# preserve: true before the category-wide probe re-run. The row is dated counter-evidence of
# what the vendor surface answered at recording time; the probe stage regenerates unmarked
# probe-tier rows wholesale (rankings-engine/stages/probe.ts, mergeProbeEvidence), so without
# the flag the refresh would drop the recorded negative instead of recording the fresh fetch
# alongside it. preserve is not part of cellHash (judge.ts hashes [id, excerpt]), so marking
# the row does not bust the judge cache by itself. Idempotent: a row already marked is skipped.
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(os.path.dirname(ROOT), 'open-rankings', 'gpus', 'evidence', 'nvidia-b200.json')
PRESERVE_IDS = {'nvidia-b200-probe-3'}

ev = json.load(open(PATH))
changed = False
for row in ev:
    if row['id'] in PRESERVE_IDS and row.get('tier') == 'probe':
        if row.get('preserve') is True:
            print(f"{row['id']}: already preserved, skipping")
            continue
        assert '404' in row['excerpt'], f"{row['id']} is not the recorded 404 row"
        row['preserve'] = True
        changed = True
        print(f"{row['id']}: marked preserve: true")

if changed:
    with open(PATH, 'w') as f:
        json.dump(ev, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print(f'wrote {PATH}')
else:
    print('no changes')
