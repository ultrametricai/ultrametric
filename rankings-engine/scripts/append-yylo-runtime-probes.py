#!/usr/bin/env python3
# One-shot helper for the yylo bring-up (issue #19, 2026-09-14): appends probe-tier evidence
# items distilled from the recorded keyless probes in open-rankings/software-factory/proofs/yylo/ (see
# rankings-engine/probes/software-factory.ts — both recorded probes passed). Both probes are
# metadata-only (npm registry view + raw LICENSE fetch): no vendor-submitted code is executed,
# per the vendor-submission security policy applied to this first community submission.
# Run AFTER `pnpm engine probe --category software-factory --product yylo` — that stage
# wholesale-replaces probe-tier evidence and would wipe these items (re-run this script after
# any probe refresh).
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'yylo': [
        {
            'id': 'yylo-probe-rt-1',
            'tier': 'probe',
            'url': 'https://www.npmjs.com/package/@yylo/cli',
            'excerpt': "PROBE runtime (recorded 2026-09-14): `npm view @yylo/cli name version bin` — the official CLI is live on the public npm registry (@yylo/cli 0.2.2) and publishes the documented launchers as package bins: yylo, yy, ypl, feedback-yylo. Registry metadata only; no package code executed.",
            'fetchedAt': NOW,
        },
        {
            'id': 'yylo-probe-rt-2',
            'tier': 'probe',
            'url': 'https://github.com/yylo-dev/yylo/blob/main/LICENSE',
            'excerpt': "PROBE runtime (recorded 2026-09-14): `curl -s https://raw.githubusercontent.com/yylo-dev/yylo/HEAD/LICENSE | head -3` returns 'MIT License / Copyright (c) 2026 JUNO AI INC.' — the full CLI source repo is public under MIT.",
            'fetchedAt': NOW,
        },
    ],
}


def main() -> None:
    path = 'open-rankings/software-factory/evidence/yylo.json'
    with open(path) as fh:
        evidence = json.load(fh)
    existing = {e['id'] for e in evidence}
    added = 0
    for items in ITEMS.values():
        for item in items:
            if item['id'] not in existing:
                evidence.append(item)
                added += 1
    with open(path, 'w') as fh:
        json.dump(evidence, fh, indent=2)
        fh.write('\n')
    print(f'appended {added} probe-tier items -> {len(evidence)} total')


if __name__ == '__main__':
    main()
