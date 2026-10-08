#!/usr/bin/env python3
# One-shot helper for the grok-build ai-coding bring-up (family-judgement wave, founder GO
# 2026-10-08). Appends the probe-tier evidence item distilled from the recorded runtime probe
# in data/ai-coding/proofs/grok-build/ (see pipeline/probes/ai-coding.ts — docs-md-mirror
# passed). Run AFTER `pnpm pipeline probe --category ai-coding --product grok-build` (the probe
# stage wholesale-replaces probe-tier evidence and would wipe this item) — re-run this script
# after any probe refresh.
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'grok-build': [
        {
            'id': 'grok-build-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.x.ai/build/overview.md',
            'excerpt': "PROBE runtime (recorded 2026-10-08): keyless GET of https://docs.x.ai/build/overview.md returned the markdown mirror of the Grok Build overview — '# Grok Build — Grok Build is a powerful and extensible coding agent. Use it via an interactive TUI, headlessly in scripts or bots, or through the Agent Client Protocol (ACP) in other apps' — docs.x.ai's llms.txt documents the convention (append .md, or send Accept: text/markdown) and indexes the full Grok Build docs section.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'data/ai-coding/evidence/{pid}.json'
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
