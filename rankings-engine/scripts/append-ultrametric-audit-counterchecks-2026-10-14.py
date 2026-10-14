#!/usr/bin/env python3
# Records the 2026-10-14 adversarial bias audit's two hands-on counter-checks (header of
# pipeline/scripts/bias-audit-ultrametric-refresh-2026-10-14.py, committed f670b9b3e) as
# preserved probe-tier evidence rows in the ultrametric agent-skills pack. The audit applied
# its corrections to verdicts + judge cache; this puts the counter-evidence itself in the
# pack so the next re-judge sees it directly, and preserve: true keeps it through probe-stage
# refreshes (pipeline/stages/probe.ts mergeProbeEvidence) — the replacement clobber is what
# erased the 2026-10-08 counter-checks and triggered the #4 -> #2 regression the audit
# corrected. Removal of these rows is itself an audit-correction act: another explicit dated
# script, never a refresh.
#
# fetchedAt is the audit's commit timestamp (f670b9b3e, 2026-10-14T10:20:10-07:00), the dated
# record of when the counter-checks were recorded. Idempotent: existing ids are skipped.
import json
import os

RECORDED_AT = '2026-10-14T17:20:10.000Z'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVIDENCE = os.path.join(os.path.dirname(ROOT), 'open-rankings', 'agent-skills', 'evidence', 'ultrametric.json')

ITEMS = [
    {
        'id': 'ultrametric-audit-20261014-1',
        'tier': 'probe',
        'url': 'https://api.ultrametric.ai/contracts/openapi.json',
        'excerpt': 'PROBE audit counter-check (recorded 2026-10-14, pipeline/scripts/bias-audit-ultrametric-refresh-2026-10-14.py): the DOCUMENTED OpenAPI contract location 404s on both hosts — GET https://api.ultrametric.ai/contracts/openapi.json → 404 {"schemaVersion":1,"error":{"code":"NOT_FOUND","message":"Endpoint not found."}}; GET https://docs.ultrametric.ai/contracts/openapi.json → 404 "Asset not found". Reproduces the 2026-10-08 audit fetch and affirmatively contradicts "the 404s were only at generic paths, not the documented /contracts/openapi.json" (the probe stage records the generic-path 404s separately).',
        'fetchedAt': RECORDED_AT,
        'preserve': True,
    },
    {
        'id': 'ultrametric-audit-20261014-2',
        'tier': 'probe',
        'url': 'https://api.ultrametric.ai/mcp',
        'excerpt': 'PROBE audit counter-check (recorded 2026-10-14, pipeline/scripts/bias-audit-ultrametric-refresh-2026-10-14.py): POST initialize to the documented MCP endpoint https://api.ultrametric.ai/mcp → 401 {"schemaVersion":1,"error":{"code":"AUTH_REQUIRED","message":"Sign in to continue."}} with `www-authenticate: Bearer resource_metadata="https://api.ultrametric.ai/.well-known/oauth-protected-resource"` — the same RFC 9728 wall the 2026-10-08 audit recorded; no initialize/tools/list session has ever been observed.',
        'fetchedAt': RECORDED_AT,
        'preserve': True,
    },
]

ev = json.load(open(EVIDENCE))
existing = {e['id'] for e in ev}
for item in ITEMS:
    if item['id'] in existing:
        print(f"ultrametric: {item['id']} already present, skipping")
        continue
    ev.append(item)
    print(f"ultrametric: appended {item['id']}")
with open(EVIDENCE, 'w') as f:
    # ensure_ascii=False matches pipeline writeJson (JSON.stringify keeps unicode literal).
    f.write(json.dumps(ev, indent=2, ensure_ascii=False) + '\n')
