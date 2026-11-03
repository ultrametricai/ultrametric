#!/usr/bin/env python3
"""Remove adjacent-feature credit from two Zoom Scribe cells in PR #563.

Exact-head review found that the scoped judge credited an OpenAPI document plus
a separate transcription playground toward an *interactive API reference*, and
credited files-per-batch plus lifecycle states toward *concurrent job limits and
queueing*. Neither pair delivers its story under prompt v5's partial-credit
boundary.

This dated adjudication is fail-closed and idempotent. Each verdict and its
matching judge cache must be either the exact reviewed input below or the exact
adjudicated output. Cache hashes are preserved. Derived rankings and projections
must be regenerated after applying it.

Usage:
  python3 rankings-engine/scripts/adjudicate-submission-489-zoom-adjacent-credit-2026-11-03.py
  python3 rankings-engine/scripts/adjudicate-submission-489-zoom-adjacent-credit-2026-11-03.py --write
"""

import argparse
import json
import os


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
VERDICTS_PATH = os.path.join(ROOT, 'open-rankings', 'speech-to-text', 'verdicts.json')
CACHE_DIR = os.path.join(
    ROOT,
    'rankings-engine',
    'cache',
    'judge',
    'speech-to-text',
    'zoom-scribe',
)


BEFORE = {
    'api-interactive-docs': {
        'productId': 'zoom-scribe',
        'storyId': 'api-interactive-docs',
        'verdict': 'partial',
        'quality': 4,
        'confidence': 'low',
        'rationale': (
            'Zoom publishes a structured, OpenAPI-backed AI Services API reference covering '
            'the Scribe operations, and a machine-readable spec is served live. Separately, '
            'there is an interactive console where users can record speech, use a sample '
            'conversation, upload a file, or enter a URL to try transcription. Neither piece '
            'is shown to be an interactive reference with in-page runnable request examples, '
            'so support is only partial. missing for 10: evidence of \'try it\'/runnable '
            'request execution inside the API reference itself, code samples tied to each '
            'endpoint, independent or hands-on corroboration of the interactive experience.'
        ),
        'evidenceIds': [
            'zoom-scribe-supp-openapi-docs',
            'zoom-scribe-supp-openapi-probe',
            'zoom-scribe-docs-23',
            'zoom-scribe-docs-24',
        ],
    },
    'batch-concurrency': {
        'productId': 'zoom-scribe',
        'storyId': 'batch-concurrency',
        'verdict': 'partial',
        'quality': 3,
        'confidence': 'medium',
        'rationale': (
            'Batch mode handles high-volume transcription, accepting up to 10,000 audio '
            'files per job or 1,000 from a manifest, including all files under an S3 prefix '
            'with glob filters. That gives developers a first-party way to process many files '
            'at once. The evidence never documents concurrency limits, parallel job execution, '
            'or queueing behavior, which are the core of this story. missing for 10: '
            'documented per-account concurrency limits, documented queueing and backpressure '
            'behavior when limits are exceeded, explicit support for running multiple jobs in '
            'parallel, rate-limit/429 handling guidance, independent corroboration.'
        ),
        'evidenceIds': [
            'zoom-scribe-docs-4',
            'zoom-scribe-docs-5',
        ],
    },
}


AFTER = {
    'api-interactive-docs': {
        'productId': 'zoom-scribe',
        'storyId': 'api-interactive-docs',
        'verdict': 'none',
        'quality': 0,
        'confidence': 'medium',
        'rationale': (
            'An interactive API reference is a fair capability to ask of a developer API, '
            'so the axis applies. The evidence shows a static OpenAPI-backed reference and a '
            'separate transcription playground, but neither provides runnable requests inside '
            'the API reference. A machine-readable spec and an adjacent product demo do not '
            'deliver this story, so they earn no credit.'
        ),
        'evidenceIds': [],
    },
    'batch-concurrency': {
        'productId': 'zoom-scribe',
        'storyId': 'batch-concurrency',
        'verdict': 'none',
        'quality': 0,
        'confidence': 'medium',
        'rationale': (
            'Concurrent-job limits and queueing are fair capabilities to ask of a batch '
            'transcription API, so the axis applies. The evidence documents only how many '
            'files fit in one batch and the lifecycle of one job; it does not show multiple '
            'jobs running concurrently, concurrency limits, or queue and backpressure '
            'behavior. Batch capacity and a QUEUED state are adjacent primitives, so they '
            'earn no credit for this story.'
        ),
        'evidenceIds': [],
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

    verdicts = read_json(VERDICTS_PATH)
    pending = []
    already = []

    for story_id, before in BEFORE.items():
        after = AFTER[story_id]
        matches = [
            (index, row)
            for index, row in enumerate(verdicts)
            if row.get('productId') == 'zoom-scribe' and row.get('storyId') == story_id
        ]
        if len(matches) != 1:
            raise SystemExit(f'abort: expected one zoom-scribe:{story_id} row, found {len(matches)}')

        index, row = matches[0]
        cache_path = os.path.join(CACHE_DIR, f'{story_id}.json')
        cache = read_json(cache_path)
        cached_row = cache.get('verdict')

        if row == after and cached_row == after:
            already.append(story_id)
            print(f'ALREADY speech-to-text/zoom-scribe:{story_id} none/q0')
            continue

        if row != before:
            raise SystemExit(
                f'abort: speech-to-text/zoom-scribe:{story_id} verdict drifted from reviewed input'
            )
        if cached_row != before:
            raise SystemExit(
                f'abort: speech-to-text/zoom-scribe:{story_id} cache and verdicts.json disagree'
            )

        pending.append((story_id, index, cache_path, cache))
        print(
            f'ADJUDICATE speech-to-text/zoom-scribe:{story_id} '
            f"{before['verdict']}/q{before['quality']} -> none/q0"
        )

    if args.write:
        for story_id, index, cache_path, cache in pending:
            after = AFTER[story_id]
            verdicts[index] = after
            original_hash = cache.get('hash')
            cache['verdict'] = after
            write_json(cache_path, cache)
            verified_cache = read_json(cache_path)
            if verified_cache.get('hash') != original_hash or verified_cache.get('verdict') != after:
                raise SystemExit(
                    f'abort: speech-to-text/zoom-scribe:{story_id} cache write verification failed'
                )
        write_json(VERDICTS_PATH, verdicts)

        verified_verdicts = read_json(VERDICTS_PATH)
        for story_id in BEFORE:
            rows = [
                row for row in verified_verdicts
                if row.get('productId') == 'zoom-scribe' and row.get('storyId') == story_id
            ]
            if rows != [AFTER[story_id]]:
                raise SystemExit(
                    f'abort: speech-to-text/zoom-scribe:{story_id} verdict write verification failed'
                )

    print(
        f"{len(pending)} cell(s) {'adjudicated' if args.write else 'would adjudicate'}; "
        f'{len(already)} already adjudicated'
    )
    print('Applied and verified.' if args.write else 'Dry run only — pass --write to apply.')


if __name__ == '__main__':
    main()
