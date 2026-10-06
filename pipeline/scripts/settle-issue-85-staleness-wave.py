#!/usr/bin/env python3
# Churn settle for the issue #85 staleness wave (2026-10-06), revert-churn.ts pattern.
#
# Each repair in this wave changes one product's evidence pack and re-judges that pack
# (the judge cellHash covers the whole pack, so every cell re-rolls). The re-judge
# stability policy (METHODOLOGY, docs/ACCURACY.md "Human review points") rules that a
# verdict/quality flip citing NO evidence new to the pack is re-roll noise and is
# reverted to the pre-wave baseline; flips attributable to added, removed, or
# materially changed evidence stand.
#
# Keep rule per flipped cell (verdict or quality moved vs the baseline):
#   - new verdict cites an ADDED id, or
#   - old verdict cited a REMOVED id (the old row can no longer stand: it cites an
#     id absent from the pack), or
#   - the cell cites a MATERIALLY changed id (same id, new claim content).
# URL-refresh-only edits (same claim text relocated) are NOT material; flips that only
# touch them revert.
#
# Reverting patches BOTH data/<arena>/verdicts.json and the judge cache entry
# (pipeline/cache/judge/<arena>/<product>/<story>.json — hash kept, verdict object
# replaced) so a future judge run does not resurrect the churn.
#
# Usage: python3 pipeline/scripts/settle-issue-85-staleness-wave.py \
#            <arena> <product> <baseline-verdicts.json> \
#            [--added id,id] [--removed id,id] [--changed-material id,id] [--write]
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def parse_args(argv):
    arena, product, baseline = argv[1], argv[2], argv[3]
    opts = {'added': set(), 'removed': set(), 'changed': set(), 'write': False}
    i = 4
    while i < len(argv):
        a = argv[i]
        if a == '--write':
            opts['write'] = True
        elif a == '--added':
            i += 1
            opts['added'] |= set(argv[i].split(','))
        elif a == '--removed':
            i += 1
            opts['removed'] |= set(argv[i].split(','))
        elif a == '--changed-material':
            i += 1
            opts['changed'] |= set(argv[i].split(','))
        else:
            raise SystemExit(f'unknown arg: {a}')
        i += 1
    return arena, product, baseline, opts


def main():
    arena, product, baseline_file, opts = parse_args(sys.argv)
    cur_file = os.path.join(ROOT, 'data', arena, 'verdicts.json')
    cur = json.load(open(cur_file))
    old = json.load(open(baseline_file))
    o = {(v['productId'], v['storyId']): v for v in old}
    reverts, keeps = [], []
    for idx, nv in enumerate(cur):
        k = (nv['productId'], nv['storyId'])
        if k[0] != product or k not in o:
            continue
        ov = o[k]
        if ov['verdict'] == nv['verdict'] and ov['quality'] == nv['quality']:
            continue
        old_ids, new_ids = set(ov['evidenceIds']), set(nv['evidenceIds'])
        keep = bool(new_ids & opts['added']) or bool(old_ids & opts['removed']) \
            or bool((old_ids | new_ids) & opts['changed'])
        line = (f"{k[1]}: {ov['verdict']} q{ov['quality']} -> {nv['verdict']} q{nv['quality']}")
        if keep:
            keeps.append(line)
        else:
            reverts.append((idx, k, ov, line))
    print(f'=== settle {arena}/{product} ({"WRITE" if opts["write"] else "DRY RUN"}) ===')
    print(f'KEEP (evidence-driven): {len(keeps)}')
    for l in keeps:
        print('  keep   ', l)
    print(f'REVERT (re-roll noise, no new evidence cited): {len(reverts)}')
    for _, _, _, l in reverts:
        print('  revert ', l)
    if not opts['write']:
        return
    for idx, k, ov, _ in reverts:
        cur[idx] = dict(ov)
        cache_file = os.path.join(ROOT, 'pipeline', 'cache', 'judge', arena, product, f'{k[1]}.json')
        cached = json.load(open(cache_file))
        cached['verdict'] = dict(ov)
        with open(cache_file, 'w') as f:
            f.write(json.dumps(cached, indent=2) + '\n')
    with open(cur_file, 'w') as f:
        f.write(json.dumps(cur, indent=2) + '\n')
    print(f'wrote {cur_file} + {len(reverts)} cache patch(es)')


if __name__ == '__main__':
    main()
