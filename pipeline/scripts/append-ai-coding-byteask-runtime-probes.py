#!/usr/bin/env python3
# One-shot helper for the byteask ai-coding bring-up (YC F26 coverage-queue wave 2026-09-25).
# Appends probe-tier evidence items distilled from the recorded runtime probes in
# rankings/ai-coding/proofs/byteask/ (see pipeline/probes/ai-coding.ts — both recorded probes
# passed). Run AFTER `pnpm pipeline probe --category ai-coding --product byteask` (or a spike
# pass, whose probe stage wholesale-replaces probe-tier evidence and would wipe these items) —
# re-run this script after any probe refresh.
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'byteask': [
        {
            'id': 'byteask-probe-rt-1',
            'tier': 'probe',
            'url': 'https://byteask.ai/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-25): keyless GET of https://byteask.ai/llms.txt returned the product-site llms.txt index (text/plain) — '# ByteAsk — An AI coding agent for C and C++. It edits your repository from the terminal, then drives the real toolchain (the compiler, the sanitizers, gdb, and your test suite) before it shows you a diff' — with install channels, editor connectors, pricing tiers, and data-handling policy in the same agent-readable file.",
            'fetchedAt': NOW,
        },
        {
            'id': 'byteask-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.byteask.ai/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-25): the docs subdomain serves its own llms.txt index — '# ByteAsk Docs — Documentation for ByteAsk, an AI coding agent for C and C++ that runs in your terminal and verifies its own work against the real toolchain' — listing every CLI documentation page (overview, features, self-hosted models, CLI reference, headless/CI, slash commands, changelog). byteask.ai's /docs/* paths are an SPA shell that answers unknown pages with HTTP 200.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'rankings/ai-coding/evidence/{pid}.json'
    ev = json.load(open(path))
    existing = {e['id'] for e in ev}
    for item in items:
        if item['id'] in existing:
            print(f'{pid}: {item["id"]} already present, skipping')
            continue
        ev.append(item)
        print(f'{pid}: appended {item["id"]}')
    with open(path, 'w') as f:
        f.write(json.dumps(ev, indent=2) + '\n')
