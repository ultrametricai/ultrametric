#!/usr/bin/env python3
# Ultrametric bring-up (agent-skills, 2026-10-08): appends the committed keyless self-eval
# sweep (https://github.com/ultrametricai/ultrametric/blob/a548b2576f22ab805ca1ff102e731af4a6d4bd9e/docs/self-eval-probes/transcript-self-eval-keyless.txt, recorded 2026-10-07 per
# https://github.com/ultrametricai/ultrametric/blob/a548b2576f22ab805ca1ff102e731af4a6d4bd9e/docs/SELF-EVAL.md) to the evidence pack as probe-tier items — the supp-evidence precedent
# (append-startup-law-firms-docs-evidence.py), with tier 'probe' because every excerpt quotes
# a recorded keyless session rather than a vendor page. fetchedAt is the recording timestamp,
# not the append time, so the evidence stays dated to when the probes actually ran (item 9,
# the arena-command defect, carries its own 2026-10-08 re-verification date in the excerpt).
#
# The negatives are the point: the process auth wall (selfeval-4) and the MCP initialize
# refusal (selfeval-5) are the owner product's recorded walls, kept per the house rules.
#
# The curated items live in rankings-engine/seeds/agent-skills-ultrametric-selfeval-evidence.json so
# the excerpts are reviewable data, not code. Idempotent: existing ids are skipped.
#
# 2026-10-14: the items now carry preserve: true (the seed is the source), so once appended
# they survive probe-stage refreshes (rankings-engine/stages/probe.ts mergeProbeEvidence) — the
# 2026-10-14 refresh had clobbered them, which let the judge re-grade the owner product on a
# docs-only pack (see rankings-engine/scripts/bias-audit-ultrametric-refresh-2026-10-14.py).
import json
import os

RECORDED_AT = '2026-10-07T18:24:00.000Z'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED = os.path.join(ROOT, 'seeds', 'agent-skills-ultrametric-selfeval-evidence.json')
DATA = os.path.join(os.path.dirname(ROOT), 'open-rankings', 'agent-skills', 'evidence')

seed = json.load(open(SEED))

for pid, items in seed.items():
    if pid.startswith('_'):
        continue
    path = os.path.join(DATA, f'{pid}.json')
    ev = json.load(open(path))
    existing = {e['id'] for e in ev}
    for item in items:
        if item['id'] in existing:
            print(f"{pid}: {item['id']} already present, skipping")
            continue
        row = {'id': item['id'], 'tier': 'probe', 'url': item['url'], 'excerpt': item['excerpt'], 'fetchedAt': RECORDED_AT}
        if item.get('preserve') is True:
            row['preserve'] = True
        ev.append(row)
        print(f"{pid}: appended {item['id']}")
    with open(path, 'w') as f:
        # ensure_ascii=False matches pipeline writeJson (JSON.stringify keeps unicode literal).
        f.write(json.dumps(ev, indent=2, ensure_ascii=False) + '\n')
