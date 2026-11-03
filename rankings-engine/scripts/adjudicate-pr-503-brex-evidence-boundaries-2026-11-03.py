#!/usr/bin/env python3
"""Correct two Brex over-credit cells found in PR #503 exact-head review.

The cross-arena geography pass added Brex Global evidence. That evidence directly
supports Brex's own global-reimbursement flow through local bank accounts, but it
does not establish payout in the employee's local currency, the story's central
requirement. The reviewed full/q7 row therefore becomes partial/q5 rather than
falling back to the pre-evidence none/q0 row.

The same pass moved ``card-policy-controls`` from partial/q5 to partial/q6 using
generic built-in-controls and localized-policy statements. Those additions do not
document the story's missing merchant-category, merchant-specific or point-of-sale
behavior, so the exact current-main partial/q5 judgment is restored.

This dated adjudication is fail-closed and idempotent. It patches matching cache
payloads while preserving their historical hash and key version. Main's prompt v6
deliberately leaves these pre-v6 caches stale until an explicitly reviewed category
migration.

Usage:
  python3 rankings-engine/scripts/adjudicate-pr-503-brex-evidence-boundaries-2026-11-03.py
  python3 rankings-engine/scripts/adjudicate-pr-503-brex-evidence-boundaries-2026-11-03.py --write
"""

import argparse
import json
import os


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CATEGORY = 'expense-management'
PRODUCT = 'brex'
VERDICTS_PATH = os.path.join(
    ROOT, 'open-rankings', CATEGORY, 'verdicts.json'
)
EVIDENCE_PATH = os.path.join(
    ROOT, 'open-rankings', CATEGORY, 'evidence', f'{PRODUCT}.json'
)
CACHE_DIR = os.path.join(
    ROOT, 'rankings-engine', 'cache', 'judge', CATEGORY, PRODUCT
)


BEFORE = {
    'global-reimbursements': {
        'productId': 'brex',
        'storyId': 'global-reimbursements',
        'verdict': 'full',
        'quality': 7,
        'confidence': 'medium',
        'rationale': (
            "Brex's Global product page says it can pay reimbursements to and from local "
            'bank accounts, avoiding intercompany transactions, as part of its own platform '
            '(brex-docs-73). It also says budgets and spend limits can be managed in over '
            '100 currencies (brex-docs-74), and that reimbursements are filed inside Brex '
            '(brex-docs-23). Together these support handling foreign-employee reimbursements '
            'without a separate international payments process. Missing for 10: an explicit '
            "statement that reimbursements pay out in the employee's local currency, the list "
            'of supported payout countries and currencies, API or detailed docs for '
            'international reimbursement payouts, and independent or hands-on corroboration.'
        ),
        'evidenceIds': ['brex-docs-73', 'brex-docs-74', 'brex-docs-23'],
    },
    'card-policy-controls': {
        'productId': 'brex',
        'storyId': 'card-policy-controls',
        'verdict': 'partial',
        'quality': 6,
        'confidence': 'medium',
        'rationale': (
            "Brex's own marketing says it can 'automatically block out-of-policy purchases, "
            "with preset rules and limits' and offers 'auto-enforced controls' on spend "
            "limits. Its Budgets API manages Spend Limits, and its global cards ship with "
            "'built-in controls', which covers amount-based restriction and point-of-sale "
            'blocking. However, nothing in the evidence documents restricting cards by '
            'merchant category or by specific merchant, and all support is vendor marketing. '
            'Missing for 10: documented merchant-category and merchant-level card '
            'restrictions, explicit point-of-sale decline or auto-lock behavior detail, '
            'independent or hands-on corroboration.'
        ),
        'evidenceIds': [
            'brex-docs-36',
            'brex-docs-9',
            'brex-docs-5',
            'brex-docs-72',
            'brex-docs-32',
            'brex-docs-74',
        ],
    },
}


AFTER = {
    'global-reimbursements': {
        'productId': 'brex',
        'storyId': 'global-reimbursements',
        'verdict': 'partial',
        'quality': 5,
        'confidence': 'medium',
        'rationale': (
            "Brex's own Global page documents paying reimbursements to and from local bank "
            'accounts to avoid intercompany transactions, and Brex documents automated '
            'reimbursement filing. This directly establishes a built-in global-reimbursement '
            "flow, but not the story's required payout in the employee's local currency. "
            'Missing for 10: explicit local-currency payout to the employee, supported payout '
            'countries and currencies, API or detailed lifecycle documentation, independent '
            'or hands-on corroboration.'
        ),
        'evidenceIds': ['brex-docs-73', 'brex-docs-23'],
    },
    'card-policy-controls': {
        'productId': 'brex',
        'storyId': 'card-policy-controls',
        'verdict': 'partial',
        'quality': 5,
        'confidence': 'medium',
        'rationale': (
            "Brex's marketing says it can 'automatically block out-of-policy purchases, with "
            "preset rules and limits' with 'auto-enforced controls,' and its Budgets API "
            'manages spend limits, including monthly user limits via integrations. That '
            'covers amount limits and policy-based blocking. However, nothing in the evidence '
            'documents restricting cards by merchant category or by specific merchant. The '
            'point-of-sale decline claim also rests only on marketing copy. Missing for 10: '
            'documented category/MCC and merchant-level card restrictions, technical docs on '
            'real-time authorization declines or auto-locks, independent or hands-on '
            'corroboration.'
        ),
        'evidenceIds': [
            'brex-docs-36',
            'brex-docs-9',
            'brex-docs-5',
            'brex-docs-32',
            'brex-docs-64',
        ],
    },
}


def read_json(path: str):
    with open(path, encoding='utf-8') as handle:
        return json.load(handle)


def write_json(path: str, value) -> None:
    with open(path, 'w', encoding='utf-8') as handle:
        handle.write(json.dumps(value, indent=2, ensure_ascii=False) + '\n')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()

    evidence = read_json(EVIDENCE_PATH)
    evidence_by_id = {item.get('id'): item for item in evidence}
    if len(evidence_by_id) != len(evidence):
        raise SystemExit('abort: duplicate Brex evidence id')
    for evidence_id in ('brex-docs-23', 'brex-docs-73'):
        if evidence_id not in evidence_by_id:
            raise SystemExit(f'abort: required direct evidence {evidence_id} is absent')
    if 'local bank accounts' not in evidence_by_id['brex-docs-73'].get('excerpt', ''):
        raise SystemExit('abort: brex-docs-73 no longer contains the reviewed support')

    verdicts = read_json(VERDICTS_PATH)
    pending = []
    already = []

    for story_id, before in BEFORE.items():
        after = AFTER[story_id]
        unknown_ids = [item for item in after['evidenceIds'] if item not in evidence_by_id]
        if unknown_ids:
            raise SystemExit(
                f'abort: {PRODUCT}:{story_id} settled row cites unknown evidence '
                f'{", ".join(unknown_ids)}'
            )
        matches = [
            (index, row)
            for index, row in enumerate(verdicts)
            if row.get('productId') == PRODUCT and row.get('storyId') == story_id
        ]
        if len(matches) != 1:
            raise SystemExit(
                f'abort: expected one {CATEGORY}/{PRODUCT}:{story_id} row, '
                f'found {len(matches)}'
            )
        index, row = matches[0]
        cache_path = os.path.join(CACHE_DIR, f'{story_id}.json')
        cache = read_json(cache_path)
        if cache.get('keyVersion') != 'v2' or not isinstance(cache.get('hash'), str):
            raise SystemExit(
                f'abort: {PRODUCT}:{story_id} lacks audited historical v2 cache metadata'
            )
        if cache.get('verdict') != row:
            raise SystemExit(
                f'abort: {PRODUCT}:{story_id} cache and verdicts.json disagree'
            )
        if row == after:
            already.append(story_id)
            print(
                f'ALREADY {CATEGORY}/{PRODUCT}:{story_id} '
                f"{after['verdict']}/q{after['quality']}"
            )
            continue
        if row != before:
            raise SystemExit(
                f'abort: {PRODUCT}:{story_id} drifted from reviewed or settled row'
            )
        pending.append((story_id, index, cache_path, cache))
        print(
            f'ADJUDICATE {CATEGORY}/{PRODUCT}:{story_id} '
            f"{before['verdict']}/q{before['quality']} -> "
            f"{after['verdict']}/q{after['quality']}"
        )

    if args.write:
        for story_id, index, cache_path, cache in pending:
            after = AFTER[story_id]
            original_hash = cache['hash']
            original_key_version = cache['keyVersion']
            cache['verdict'] = after
            verdicts[index] = after
            write_json(cache_path, cache)
            verified_cache = read_json(cache_path)
            if (
                verified_cache.get('verdict') != after
                or verified_cache.get('hash') != original_hash
                or verified_cache.get('keyVersion') != original_key_version
            ):
                raise SystemExit(
                    f'abort: {PRODUCT}:{story_id} cache write verification failed'
                )
        write_json(VERDICTS_PATH, verdicts)
        verified = read_json(VERDICTS_PATH)
        for story_id, after in AFTER.items():
            rows = [
                row for row in verified
                if row.get('productId') == PRODUCT and row.get('storyId') == story_id
            ]
            if rows != [after]:
                raise SystemExit(
                    f'abort: {PRODUCT}:{story_id} verdict write verification failed'
                )

    print(
        f"{len(pending)} cell(s) {'adjudicated' if args.write else 'would adjudicate'}; "
        f'{len(already)} already adjudicated'
    )
    print('Applied and verified.' if args.write else 'Dry run only — pass --write to apply.')


if __name__ == '__main__':
    main()
