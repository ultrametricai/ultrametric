#!/usr/bin/env python3
"""Apply the PR #562 review adjudication for agent-cost-estimate.

The story requires both a pre-submission cost calculation and itemized add-on
prices. The refreshed evidence proves the first through published base pricing,
MCP price discovery, and an x402 quote, but the cited sources do not itemize the
separate diarization, timestamp, labeling, or edge-transcription charges. A full
verdict is therefore unsupported under the prompt-v5 own-capability rule.

This dated audit keeps the current evidence hash, replaces the one judge result
with an evidence-citing partial verdict, and patches the matching cache entry so
the adjudication is stable on an unchanged pack. Derived rankings and intervals
must be regenerated after running it.
"""

import json
import os


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
VERDICTS = os.path.join(ROOT, 'open-rankings', 'speech-to-text', 'verdicts.json')
CACHE = os.path.join(
    ROOT,
    'rankings-engine',
    'cache',
    'judge',
    'speech-to-text',
    'speech-is-cheap',
    'agent-cost-estimate.json',
)

ADJUDICATED = {
    'productId': 'speech-is-cheap',
    'storyId': 'agent-cost-estimate',
    'verdict': 'partial',
    'quality': 7,
    'confidence': 'medium',
    'rationale': (
        'Speech is Cheap publishes its base per-minute and subscription pricing, the MCP '
        'check_access tool lists current prices, and the x402 API returns a free job quote before '
        'submission. These surfaces let an agent compute or retrieve the base job cost, but the '
        'cited sources do not itemize the separate prices for diarization, word timestamps, audio '
        'labeling, or edge transcription. Missing for 10: itemized add-on prices, explicit '
        'confirmation of how each option changes the quoted total, and independent or hands-on '
        'confirmation that the pre-submission quote matches the final charge.'
    ),
    'evidenceIds': [
        'speech-is-cheap-docs-28',
        'speech-is-cheap-docs-29',
        'speech-is-cheap-docs-11',
        'speech-is-cheap-docs-13',
        'speech-is-cheap-supp-mcp-tools',
        'speech-is-cheap-supp-x402',
    ],
}


def main() -> None:
    verdicts = json.load(open(VERDICTS))
    changed = False
    for index, row in enumerate(verdicts):
        if row['productId'] != ADJUDICATED['productId'] or row['storyId'] != ADJUDICATED['storyId']:
            continue
        if row == ADJUDICATED:
            print('verdicts.json: adjudicated verdict already in place')
        else:
            print(
                'ADJUDICATE speech-to-text/speech-is-cheap:agent-cost-estimate '
                f"{row['verdict']}/q{row['quality']} -> "
                f"{ADJUDICATED['verdict']}/q{ADJUDICATED['quality']} (PR #562 review)"
            )
            verdicts[index] = ADJUDICATED
            changed = True
        break
    else:
        raise SystemExit('abort: agent-cost-estimate row not found in verdicts.json')

    if changed:
        with open(VERDICTS, 'w') as handle:
            handle.write(json.dumps(verdicts, indent=2, ensure_ascii=False) + '\n')

    cached = json.load(open(CACHE))
    if cached.get('verdict') == ADJUDICATED:
        print('judge cache: adjudicated verdict already in place')
        return
    cached['verdict'] = ADJUDICATED
    with open(CACHE, 'w') as handle:
        handle.write(json.dumps(cached, indent=2, ensure_ascii=False) + '\n')
    print('judge cache patched: current evidence hash preserved')


if __name__ == '__main__':
    main()
