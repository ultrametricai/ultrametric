#!/usr/bin/env python3
# PR #562 review finding (Greptile, 2026-11-01): the issue #517 re-judge moved
# speech-to-text/speech-is-cheap:agentic-scoped-keys from none to partial q4 citing
# speech-is-cheap-supp-api-keys and speech-is-cheap-supp-mcp-server. The cited evidence
# documents separate, independently revocable API keys with identical permissions; the
# story asks for scoped or least-privilege credentials (keys restricted to particular
# endpoints, operations, or spend), and the judge rules exclude related-but-different
# controls from earning credit. Key separation without capability restriction is such a
# control, so the upgrade is unsupported by the evidence it cites.
#
# This script restores the baseline verdict for that one cell — the settle-churn-vs-ref.py
# revert mechanics: the baseline verdict row (from pre-refresh main, ref 8f381017f8)
# replaces the current row in verdicts.json, and the judge cache entry is patched in place
# (hash and keyVersion kept, verdict restored) so the next `pnpm engine judge` run does not
# resurrect the reverted grade. The baseline row cites no evidence ids, so it resolves
# against the current pack. Idempotent: a re-run finds the baseline verdict in place and
# writes nothing. Re-derive and recompute intervals after running.
#
# Usage: python3 rankings-engine/scripts/revert-speech-to-text-sic-scoped-keys-2026-11-01.py
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
VERDICTS = os.path.join(ROOT, 'open-rankings', 'speech-to-text', 'verdicts.json')
CACHE = os.path.join(ROOT, 'rankings-engine', 'cache', 'judge', 'speech-to-text', 'speech-is-cheap', 'agentic-scoped-keys.json')

# Baseline row, verbatim from 8f381017f8:open-rankings/speech-to-text/verdicts.json.
BASELINE = {
    'productId': 'speech-is-cheap',
    'storyId': 'agentic-scoped-keys',
    'verdict': 'none',
    'quality': 0,
    'confidence': 'medium',
    'rationale': 'Speech is Cheap is an API service, so scoped or least-privilege credentials for an agent is a fair question to ask of it. The only authentication evidence is a GET /v2/jobs/auth endpoint for testing authentication. Nothing documents issuing multiple keys, scoping permissions, or restricting a credential\'s privileges, so this earns no credit.',
    'evidenceIds': [],
}


def main() -> None:
    verdicts = json.load(open(VERDICTS))
    changed = False
    for i, row in enumerate(verdicts):
        if row['productId'] != BASELINE['productId'] or row['storyId'] != BASELINE['storyId']:
            continue
        if row == BASELINE:
            print('verdicts.json: baseline verdict already in place, nothing to do')
        else:
            print(f"REVERT speech-to-text/speech-is-cheap:agentic-scoped-keys {row['verdict']}/q{row['quality']} -> {BASELINE['verdict']}/q{BASELINE['quality']} (review finding, PR #562)")
            verdicts[i] = BASELINE
            changed = True
        break
    else:
        raise SystemExit('abort: agentic-scoped-keys row not found in verdicts.json')
    if changed:
        with open(VERDICTS, 'w') as f:
            f.write(json.dumps(verdicts, indent=2, ensure_ascii=False) + '\n')

    cached = json.load(open(CACHE))
    if cached.get('verdict') == BASELINE:
        print('judge cache: baseline verdict already in place, nothing to do')
        return
    cached_out = {**cached, 'verdict': BASELINE}
    with open(CACHE, 'w') as f:
        f.write(json.dumps(cached_out, indent=2, ensure_ascii=False) + '\n')
    print('judge cache patched: hash kept, verdict restored')


if __name__ == '__main__':
    main()
