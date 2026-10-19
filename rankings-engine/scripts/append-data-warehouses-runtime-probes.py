#!/usr/bin/env python3
# One-shot helper for the data-warehouses arena bring-up (2026-09-06): appends probe-tier
# evidence items distilled from the recorded runtime probes in open-rankings/data-warehouses/proofs/
# (see rankings-engine/probes/data-warehouses.ts — all 11 recorded probes
# passed). Run AFTER `pnpm engine probe --category data-warehouses` — that stage
# wholesale-replaces probe-tier evidence and would wipe these items (re-run this script after
# any probe refresh).
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'snowflake': [
        {
            'id': 'snowflake-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.snowflake.com/en/developer-guide/snowflake-cli/index',
            'excerpt': "PROBE runtime (recorded 2026-09-06): the official Snowflake CLI installed and ran keylessly from pypi — `uvx --from snowflake-cli snow --version` printed Snowflake CLI version 3.26.0 with no account.",
            'fetchedAt': NOW,
        },
        {
            'id': 'snowflake-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.snowflake.com/en/developer-guide/snowflake-cli/index',
            'excerpt': "PROBE runtime (recorded 2026-09-06): `snow sql --help` documents a fully headless SQL execution surface — inline -q queries, files, stdin piping ('cat my.sql | snow sql -i'), and client-side variable substitution — exactly the path a scripted agent drives (credentials required at execution time).",
            'fetchedAt': NOW,
        },
    ],
    'databricks': [
        {
            'id': 'databricks-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.databricks.com/aws/en/dev-tools/cli/',
            'excerpt': "PROBE runtime (recorded 2026-09-06): the Databricks CLI installed via the vendor's brew tap and printed `Databricks CLI v1.15.0` keylessly; its help surface spans workspace, compute, Lakeflow jobs/pipelines, and a raw `databricks api` REST wrapper.",
            'fetchedAt': NOW,
        },
        {
            'id': 'databricks-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.databricks.com/aws/en/dev-tools/cli/',
            'excerpt': "PROBE runtime (recorded 2026-09-06): the Databricks CLI SHIPS vendor agent skills — `databricks aitools install --path /tmp/pa-dbx-skills` keylessly wrote 29 plain SKILL.md skill folders (databricks-docs, databricks-dbsql, databricks-lakeflow-connect, databricks-vector-search, …) with agentskills-style frontmatter, installable for Claude Code, Codex, Cursor, Copilot, and more.",
            'fetchedAt': NOW,
        },
    ],
    'bigquery': [
        {
            'id': 'bigquery-probe-rt-1',
            'tier': 'probe',
            'url': 'https://cloud.google.com/bigquery/docs/reference/rest',
            'excerpt': "PROBE runtime (recorded 2026-09-06): the BigQuery v2 REST discovery document downloaded keylessly from bigquery.googleapis.com and parsed cleanly — id bigquery:v2, basePath /bigquery/v2/, resources datasets/jobs/models/projects/routines/rowAccessPolicies/tabledata/tables — a machine-readable, self-describing API surface.",
            'fetchedAt': NOW,
        },
        {
            'id': 'bigquery-probe-rt-2',
            'tier': 'probe',
            'url': 'https://github.com/googleapis/mcp-toolbox',
            'excerpt': "PROBE runtime (recorded 2026-09-06): Google's official MCP Toolbox for Databases ran from npm — `npx -y @toolbox-sdk/server --version` printed toolbox version 1.10.0 keylessly; starting the prebuilt BigQuery toolset requires ADC credentials and a BIGQUERY_PROJECT (documented), so the live server handshake is credential-gated.",
            'fetchedAt': NOW,
        },
    ],
    'motherduck': [
        {
            'id': 'motherduck-probe-rt-1',
            'tier': 'probe',
            'url': 'https://motherduck.com/docs/concepts/architecture-and-capabilities/',
            'excerpt': "PROBE runtime (recorded 2026-09-06): the engine under MotherDuck ran FULLY keyless on a laptop — `duckdb -c` built a 1,000,000-row table and ran an aggregate GROUP BY (4 regions × 250,000 rows with summed revenue) in one command, a REAL analytical roundtrip with zero accounts or configuration.",
            'fetchedAt': NOW,
        },
        {
            'id': 'motherduck-probe-rt-2',
            'tier': 'probe',
            'url': 'https://github.com/motherduckdb/mcp-server-motherduck',
            'excerpt': "PROBE runtime (recorded 2026-09-06): the official mcp-server-motherduck (pypi, via uvx) completed a FULL keyless stdio initialize handshake (serverInfo mcp-server-motherduck 1.0.8) against an in-memory DuckDB, then executed a REAL analytical SQL query through MCP tools/call execute_query — an aggregate GROUP BY returning 2 rows with counts and sums — the complete agent path with no MotherDuck account.",
            'fetchedAt': NOW,
        },
        {
            'id': 'motherduck-probe-rt-3',
            'tier': 'probe',
            'url': 'https://motherduck.com/docs/sql-reference/mcp/',
            'excerpt': "PROBE runtime (recorded 2026-09-06): a keyless JSON-RPC initialize POST to the hosted remote MCP server https://api.motherduck.com/mcp returned HTTP 401 with WWW-Authenticate Bearer resource_metadata=https://api.motherduck.com/.well-known/oauth-protected-resource/mcp — the managed MCP endpoint is live and speaks the MCP OAuth flow.",
            'fetchedAt': NOW,
        },
        {
            'id': 'motherduck-probe-rt-4',
            'tier': 'probe',
            'url': 'https://motherduck.com/llms.txt',
            'excerpt': "PROBE runtime (recorded 2026-09-06): MotherDuck publishes an agentskills.io-conformant discovery manifest at /.well-known/agent-skills/index.json (schema schemas.agentskills.io/discovery/0.2.0) listing machine-readable skills with digests, alongside /.well-known/mcp.json and an every-page-as-markdown convention — agent-oriented docs as a first-class surface.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'open-rankings/data-warehouses/evidence/{pid}.json'
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
