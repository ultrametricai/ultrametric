#!/usr/bin/env python3
# One-shot helper for the data-pipelines arena bring-up (2026-09-08): appends probe-tier
# evidence items distilled from the recorded runtime probes in open-rankings/data-pipelines/proofs/
# (see rankings-engine/probes/data-pipelines.ts — all 11 recorded probes
# passed). Run AFTER `pnpm engine probe --category data-pipelines` — that stage wholesale-
# replaces probe-tier evidence and would wipe these items (re-run this script after any probe
# refresh). Signature probes here are REAL scaffolds and boots: dlt init wrote a working
# pipeline, create-dagster + dagster dev booted a live webserver, meltano init laid out a
# full project — plus first-party stdio MCP handshakes for dlt and PyAirbyte.
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'airbyte': [
        {
            'id': 'airbyte-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.airbyte.com/developers/pyairbyte',
            'excerpt': "PROBE runtime (recorded 2026-09-08): PyAirbyte installed keylessly from pypi into a throwaway venv (uv pip install airbyte) and imported cleanly — printed 'PA_PROBE_OK pyairbyte 0.59.0'. The install also surfaces Airbyte's documented anonymous-telemetry notice on first import.",
            'fetchedAt': NOW,
        },
        {
            'id': 'airbyte-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.airbyte.com/community/mcp-servers',
            'excerpt': "PROBE runtime (recorded 2026-09-08): PyAirbyte ships a first-party MCP server binary — piping a JSON-RPC initialize into the bundled `airbyte-mcp` completed a FULL keyless stdio handshake with serverInfo {name: airbyte-mcp, version: 3.4.7} and instructions describing PyAirbyte connector management and data integration.",
            'fetchedAt': NOW,
        },
        {
            'id': 'airbyte-probe-rt-3',
            'tier': 'probe',
            'url': 'https://docs.airbyte.com/developers/api-documentation',
            'excerpt': "PROBE runtime (recorded 2026-09-08): the hosted Airbyte API is live and cleanly auth-gated — a keyless GET https://api.airbyte.com/v1/connections returned HTTP 401 with WWW-Authenticate Bearer resource_metadata pointing at api.airbyte.com/.well-known/oauth-protected-resource.",
            'fetchedAt': NOW,
        },
    ],
    'fivetran': [
        {
            'id': 'fivetran-probe-rt-1',
            'tier': 'probe',
            'url': 'https://fivetran.com/docs/developer-resources/rest-api',
            'excerpt': "PROBE runtime (recorded 2026-09-08): Fivetran's documented REST API is live and cleanly auth-gated — a keyless GET https://api.fivetran.com/v1/connectors returned HTTP 401 with a WWW-Authenticate: Basic challenge and a JSON error body, matching the documented API-key authentication.",
            'fetchedAt': NOW,
        },
    ],
    'dagster': [
        {
            'id': 'dagster-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.dagster.io/getting-started/installation',
            'excerpt': "PROBE runtime (recorded 2026-09-08): the full agent-builds-a-project path ran keylessly end to end — `uvx create-dagster@latest project pa-probe --uv-sync` scaffolded a complete project (pyproject.toml, src, tests, uv.lock) in a throwaway fixture, `uv run dagster dev` booted ('Serving dagster-webserver on http://127.0.0.1:13334'), and GET /server_info answered {dagster_webserver_version: 1.13.21}. Self-cleaned.",
            'fetchedAt': NOW,
        },
        {
            'id': 'dagster-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.dagster.io/api/clis/dg-cli/dg-cli-configuration',
            'excerpt': "PROBE runtime (recorded 2026-09-08): the official dagster CLI installed keylessly from pypi via uvx and printed 'dagster, version 1.13.21'.",
            'fetchedAt': NOW,
        },
    ],
    'dlt': [
        {
            'id': 'dlt-probe-rt-1',
            'tier': 'probe',
            'url': 'https://dlthub.com/docs/reference/command-line-interface',
            'excerpt': "PROBE runtime (recorded 2026-09-08): a REAL `dlt init chess duckdb` scaffold ran keylessly in a throwaway fixture — it fetched the verified source, wrote chess_pipeline.py with runnable pipeline code, a .dlt/secrets.toml template, and requirements.txt ('Verified source chess was added to your project!'). Self-cleaned.",
            'fetchedAt': NOW,
        },
        {
            'id': 'dlt-probe-rt-2',
            'tier': 'probe',
            'url': 'https://github.com/dlt-hub/dlt-mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-08): dltHub's official MCP server (pypi dlt-mcp, published by dltHub) completed a FULL keyless stdio initialize handshake via `uv run --with dlt-mcp[duckdb] dlt-mcp` — serverInfo {name: 'dlt MCP', version: 4.0.3}, instructions 'Helps you build with the dlt Python library', with tools, prompts, and resources capabilities.",
            'fetchedAt': NOW,
        },
        {
            'id': 'dlt-probe-rt-3',
            'tier': 'probe',
            'url': 'https://dlthub.com/docs/reference/installation',
            'excerpt': "PROBE runtime (recorded 2026-09-08): the dlt CLI installed keylessly from pypi via uvx and printed 'dlt 1.30.0'.",
            'fetchedAt': NOW,
        },
    ],
    'meltano': [
        {
            'id': 'meltano-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.meltano.com/getting-started/installation',
            'excerpt': "PROBE runtime (recorded 2026-09-08): `uvx meltano init pa-probe` ran keylessly in a throwaway fixture and laid out a complete ELT project — extract/load/transform/orchestrate/analyze directories, meltano.yml, and dev/staging/prod environments initialized. The CLI itself printed 'meltano, version 4.2.2'. Self-cleaned.",
            'fetchedAt': NOW,
        },
        {
            'id': 'meltano-probe-rt-2',
            'tier': 'probe',
            'url': 'https://hub.meltano.com',
            'excerpt': "PROBE runtime (recorded 2026-09-08): MeltanoHub's plugin registry API answered keylessly — GET hub.meltano.com/meltano/api/v1/plugins/extractors/index returned the machine-readable index of Singer taps with default variants and per-variant refs (e.g. tap-sproutsocial, tap-adwords), the catalog surface an agent can query directly.",
            'fetchedAt': NOW,
        },
    ],
}

for product, items in ITEMS.items():
    path = f'open-rankings/data-pipelines/evidence/{product}.json'
    with open(path) as f:
        evidence = json.load(f)
    existing = {e['id'] for e in evidence}
    added = [i for i in items if i['id'] not in existing]
    evidence.extend(added)
    with open(path, 'w') as f:
        json.dump(evidence, f, indent=2)
        f.write('\n')
    print(f'{product}: +{len(added)} runtime probe items ({len(evidence)} total)')
