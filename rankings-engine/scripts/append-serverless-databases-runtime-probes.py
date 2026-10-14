#!/usr/bin/env python3
# One-shot helper for the serverless-databases arena bring-up (2026-09-06): appends probe-tier
# evidence items distilled from the recorded runtime probes in open-rankings/serverless-databases/proofs/
# (see rankings-engine/probes/serverless-databases.ts — all 14 recorded
# probes passed). Run AFTER `pnpm engine probe --category serverless-databases` — that stage
# wholesale-replaces probe-tier evidence and would wipe these items (re-run this script after
# any probe refresh).
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

ITEMS = {
    'neon': [
        {
            'id': 'neon-probe-rt-1',
            'tier': 'probe',
            'url': 'https://neon.com/docs/cli/install',
            'excerpt': "PROBE runtime (recorded 2026-09-06): the official Neon CLI ran keylessly from npm — `npx -y neon@latest --version` printed `4.14.1` with no account (the npm package was renamed neonctl → neon; the binary is invoked as `neon`).",
            'fetchedAt': NOW,
        },
        {
            'id': 'neon-probe-rt-2',
            'tier': 'probe',
            'url': 'https://neon.com/docs/ai/neon-mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-06): keyless JSON-RPC initialize POST to the hosted MCP server https://mcp.neon.tech/mcp returned HTTP 401 with WWW-Authenticate Bearer and resource_metadata pointing at https://mcp.neon.tech/.well-known/oauth-protected-resource/mcp — the documented remote MCP endpoint is live and speaks the MCP OAuth flow.",
            'fetchedAt': NOW,
        },
    ],
    'turso': [
        {
            'id': 'turso-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.turso.tech/cli/introduction',
            'excerpt': "PROBE runtime (recorded 2026-09-06): the official Turso CLI installed via the vendor's get.tur.so installer and `turso --version` printed `turso version v1.0.32` keylessly; the installer also ships the sqld libSQL server binary for local development.",
            'fetchedAt': NOW,
        },
        {
            'id': 'turso-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.turso.tech/local-development',
            'excerpt': "PROBE runtime (recorded 2026-09-06): `turso dev --db-file /tmp/pa-turso-probe.db --port 8085` booted a fully keyless local libSQL server (sqld listening on port 8085) and a REAL SQL roundtrip ran over the Hrana HTTP pipeline API — CREATE TABLE, INSERT id 6, SELECT id*7 returned {\"type\":\"integer\",\"value\":\"42\"} — no account, no cloud dependency.",
            'fetchedAt': NOW,
        },
        {
            'id': 'turso-probe-rt-3',
            'tier': 'probe',
            'url': 'https://docs.turso.tech/integrations/mcp',
            'excerpt': "PROBE runtime (recorded 2026-09-06): keyless JSON-RPC initialize POST to the hosted MCP server https://mcp.turso.ai/mcp returned HTTP 401 with WWW-Authenticate Bearer resource_metadata=https://mcp.turso.ai/.well-known/oauth-protected-resource/mcp — the documented OAuth-based agent endpoint (manage databases, branch, run SQL) is live.",
            'fetchedAt': NOW,
        },
    ],
    'planetscale': [
        {
            'id': 'planetscale-probe-rt-1',
            'tier': 'probe',
            'url': 'https://planetscale.com/docs/cli',
            'excerpt': "PROBE runtime (recorded 2026-09-06): `pscale --version` printed `pscale version 0.329.0` keylessly after `brew install planetscale/tap/pscale` — the CLI's own help steers agents to `pscale --skill` and `pscale auth check --format json`.",
            'fetchedAt': NOW,
        },
        {
            'id': 'planetscale-probe-rt-2',
            'tier': 'probe',
            'url': 'https://planetscale.com/docs/agent-setup/prompt',
            'excerpt': "PROBE runtime (recorded 2026-09-06): `pscale --skill` printed a complete vendor-shipped agent guide keylessly — Markdown frontmatter `name: pscale-cli` with instructions for automated agents (always pass --format json, placeholder substitution from org/database/branch list output) baked into the CLI binary itself.",
            'fetchedAt': NOW,
        },
        {
            'id': 'planetscale-probe-rt-3',
            'tier': 'probe',
            'url': 'https://planetscale.com/docs/mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-06): keyless JSON-RPC initialize POST to the hosted MCP server https://mcp.pscale.dev/mcp/planetscale returned HTTP 401 with WWW-Authenticate Bearer resource_metadata=https://mcp.pscale.dev/.well-known/oauth-protected-resource/mcp/planetscale — the documented hosted MCP endpoint (with a separate insights-only variant that excludes query execution) is live and speaks the MCP OAuth flow.",
            'fetchedAt': NOW,
        },
    ],
    'clickhouse': [
        {
            'id': 'clickhouse-probe-rt-1',
            'tier': 'probe',
            'url': 'https://clickhouse.com/docs/get-started/setup/install.md',
            'excerpt': "PROBE runtime (recorded 2026-09-06): the vendor's `curl https://clickhouse.com/ | sh` installer downloaded the single official binary and `clickhouse --version` printed `ClickHouse local version 26.9.1.749 (official build)` — no account, no key.",
            'fetchedAt': NOW,
        },
        {
            'id': 'clickhouse-probe-rt-2',
            'tier': 'probe',
            'url': 'https://clickhouse.com/docs/concepts/features/tools-and-utilities/clickhouse-local.md',
            'excerpt': "PROBE runtime (recorded 2026-09-06): clickhouse-local ran a REAL analytical SQL roundtrip fully keylessly — CREATE TABLE (MergeTree), INSERT two rows, aggregate SELECT with count()/groupArray returned `PA_PROBE_OK rows=2 names=serverless+databases` — no server process, no config, no account.",
            'fetchedAt': NOW,
        },
        {
            'id': 'clickhouse-probe-rt-3',
            'tier': 'probe',
            'url': 'https://github.com/ClickHouse/mcp-clickhouse',
            'excerpt': "PROBE runtime (recorded 2026-09-06): the official mcp-clickhouse server (pypi, run via uvx) completed a FULL keyless stdio JSON-RPC initialize handshake, answering serverInfo {\"name\":\"mcp-clickhouse\",\"version\":\"0.6.0\"} with instructions pointing at the official ClickHouse Agent Skills repo (github.com/ClickHouse/agent-skills) — database credentials are only needed at tool-call time.",
            'fetchedAt': NOW,
        },
    ],
    'cockroachdb': [
        {
            'id': 'cockroachdb-probe-rt-1',
            'tier': 'probe',
            'url': 'https://docs.cockroachlabs.com/docs/stable/install-cockroachdb-mac',
            'excerpt': "PROBE runtime (recorded 2026-09-06): `cockroach version` printed `Build Tag: v26.3.1` keylessly after `brew install cockroachdb/tap/cockroach` — the full database binary installs with no account.",
            'fetchedAt': NOW,
        },
        {
            'id': 'cockroachdb-probe-rt-2',
            'tier': 'probe',
            'url': 'https://docs.cockroachlabs.com/docs/stable/cockroach-demo',
            'excerpt': "PROBE runtime (recorded 2026-09-06): `cockroach demo --no-example-database --insecure=true -e ...` booted a keyless in-memory single-node cluster and ran a REAL SQL roundtrip — CREATE TABLE, INSERT, and a SELECT that returned ROUNDTRIP=1 — entirely offline, no cloud account.",
            'fetchedAt': NOW,
        },
        {
            'id': 'cockroachdb-probe-rt-3',
            'tier': 'probe',
            'url': 'https://docs.cockroachlabs.com/docs/cockroachcloud/connect-to-the-cockroachdb-cloud-mcp-server',
            'excerpt': "PROBE runtime (recorded 2026-09-06): keyless JSON-RPC initialize POST to the managed MCP server https://cockroachlabs.cloud/mcp returned HTTP 401 with WWW-Authenticate Bearer realm=\"mcp\" and resource_metadata=https://cockroachlabs.cloud/.well-known/oauth-protected-resource/mcp — the documented CockroachDB Cloud MCP endpoint is live and OAuth-gated exactly as documented.",
            'fetchedAt': NOW,
        },
    ],
}

for pid, items in ITEMS.items():
    path = f'open-rankings/serverless-databases/evidence/{pid}.json'
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
