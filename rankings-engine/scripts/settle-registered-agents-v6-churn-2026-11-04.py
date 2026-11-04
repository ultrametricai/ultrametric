#!/usr/bin/env python3
# Settle the registered-agents v6 migration churn (2026-11-04, PR #564 third review round).
#
# The arena's evidence fix (verbatim pricing/coverage supplements) migrated the category to
# judge prompt v6, re-rolling all 408 cells. Against the v5 baseline (b13ddb3211) the roll
# produced 31 downgrades — the intended effect of the stricter verbatim-support prompt — and
# four upgrades. Stability policy (CONTRIBUTING.md; settle-business-phone-ringcentral-churn.ts
# precedent): an upgrade stands only on new in-scope evidence.
#
#   KEEP   doola:flat-published-pricing  none → partial  — cites the new verbatim price rows
#          (doola-supp-1/supp-3), the exact gap the second review round asked to close.
#   KEEP   doola:sop-acceptance-scanning partial → full  — cites doola-supp-3, whose same-day
#          scan passage is squarely the story's subject.
#   REVERT doola:agentic-scoped-keys     none → partial  — cites only pre-existing evidence
#          (doola-docs-8, doola-docs-2: key create/revoke and sandbox isolation); a prompt-only
#          re-roll upgrade with no new substance is churn.
#   REVERT doola:urgent-notice-escalation none → partial — the newly cited rows (supp-3 scan
#          speed, supp-2 coverage) are out of scope for an urgent-alert story, and the cell's
#          own rationale concedes no lawsuit-triggered notification is shown (reviewed finding,
#          2026-11-04 round: scanning credit must not transfer to alerting).
#
# Mechanism (the na-harmonize / mobile-payments settle contract): restore the baseline verdict
# row in verdicts.json and replace the verdict payload inside the CURRENT judge-cache entry,
# leaving its hash and keyVersion as the v6 run stamped them, so a later judge run replays the
# settled result instead of resurrecting the churn.
#
# Usage: python3 rankings-engine/scripts/settle-registered-agents-v6-churn-2026-11-04.py [--write]
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(ROOT)
WRITE = '--write' in sys.argv
BASELINE_REF = 'b13ddb3211'
CATEGORY = 'registered-agents'
REVERT = [('doola', 'agentic-scoped-keys'), ('doola', 'urgent-notice-escalation')]

verdicts_path = os.path.join(REPO, 'open-rankings', CATEGORY, 'verdicts.json')
baseline = json.loads(subprocess.run(
    ['git', 'show', f'{BASELINE_REF}:open-rankings/{CATEGORY}/verdicts.json'],
    capture_output=True, text=True, cwd=REPO, check=True).stdout)
base_by_key = {(r['productId'], r['storyId']): r for r in baseline}
current = json.load(open(verdicts_path))

changed = 0
settled = []
for row in current:
    key = (row['productId'], row['storyId'])
    if key not in REVERT:
        settled.append(row)
        continue
    base = base_by_key[key]
    print(f"REVERT {key[0]}:{key[1]}: {row['verdict']} q{row['quality']} -> {base['verdict']} q{base['quality']}")
    settled.append(base)
    changed += 1
    if WRITE:
        cache_path = os.path.join(ROOT, 'cache', 'judge', CATEGORY, key[0], f'{key[1]}.json')
        cache = json.load(open(cache_path))
        cache['verdict'] = base
        with open(cache_path, 'w') as f:
            json.dump(cache, f, indent=2, ensure_ascii=False)
            f.write('\n')

print(f'settle: {changed} upgrade flips reverted as churn; downgrades and evidence-backed upgrades untouched')
if WRITE:
    with open(verdicts_path, 'w') as f:
        json.dump(settled, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print(f'wrote {verdicts_path} — run: pnpm engine derive --category {CATEGORY}')
else:
    print('dry run — pass --write to apply')
