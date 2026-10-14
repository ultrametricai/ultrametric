#!/usr/bin/env python3
# One-shot helper for the jo ai-assistants bring-up (YC X26 coverage-queue wave 2026-09-25).
# Appends probe-tier evidence items distilled from the recorded runtime probes in
# open-rankings/ai-assistants/proofs/jo/ (see rankings-engine/probes/ai-assistants.ts — both recorded probes
# passed). Run AFTER `pnpm engine probe --category ai-assistants --product jo` (or a spike
# pass, whose probe stage wholesale-replaces probe-tier evidence and would wipe these items) —
# re-run this script after any probe refresh.
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'jo': [
        {
            'id': 'jo-probe-rt-1',
            'tier': 'probe',
            'url': 'https://askjo.ai/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-25): keyless GET of https://askjo.ai/llms.txt returned jo's canonical llms.txt (text/plain) — '# jo — jo is a personal agent for real life. it runs on your Mac and on a small, always-available cloud computer that belongs only to you' — which tells agents to prefer it over scraping the site and documents surfaces (macOS/Telegram/WhatsApp/email), the wired-up integrations list, the per-user Fly machine architecture, ZDR model routing, and pricing.",
            'fetchedAt': NOW,
        },
        {
            'id': 'jo-probe-rt-2',
            'tier': 'probe',
            'url': 'https://askjo.ai/openapi.json',
            'excerpt': "PROBE runtime (recorded 2026-09-25): keyless GET of https://askjo.ai/openapi.json returned the backend's OpenAPI 3.1 spec ('\"openapi\":\"3.1.0\"', FastAPI, ~405 paths incl. /v1/auth/*, /v1/users/*, /v1/apple-messages/*) with the Swagger UI served at /docs — a machine-readable spec of the app/bridge API, though no developer program or public API keys are documented around it.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'open-rankings/ai-assistants/evidence/{pid}.json'
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
