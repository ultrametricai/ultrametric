import { CURL_MCP_INIT, MCP_INITIALIZE, type LocalProbe } from './types'

export const probes: LocalProbe[] = [
    {
      // The official Snowflake CLI installs and prints its version keylessly from pypi.
      probeId: 'cli-version',
      productId: 'snowflake',
      storyIds: ['agentic-official-cli'],
      bin: 'uvx',
      argv: ['uvx', '--from', 'snowflake-cli', 'snow', '--version'],
      displayCommand: 'uvx --from snowflake-cli snow --version',
      // The pty recording colorizes the version segments — allow ANSI escapes inside.
      expect: /Snowflake CLI version: .{0,12}\d+\.\d+/,
      timeoutMs: 180_000,
    },
    {
      // `snow sql` documents a fully headless SQL surface: -q, files, and stdin piping
      // ("cat my.sql | snow sql -i") — exactly the path an agent scripts.
      probeId: 'cli-headless-sql-help',
      productId: 'snowflake',
      storyIds: ['agent-runs-sql-headless', 'agentic-headless'],
      bin: 'uvx',
      argv: ['uvx', '--from', 'snowflake-cli', 'snow', 'sql', '--help'],
      displayCommand: 'uvx --from snowflake-cli snow sql --help',
      expect: /Executes Snowflake query/,
      timeoutMs: 180_000,
    },
    {
      probeId: 'cli-version',
      productId: 'databricks',
      storyIds: ['agentic-official-cli'],
      bin: 'databricks',
      argv: ['databricks', '--version'],
      displayCommand: 'databricks --version  # installed via `brew tap databricks/tap && brew install databricks`',
      expect: /Databricks CLI v\d+\.\d+\.\d+/,
      timeoutMs: 60_000,
    },
    {
      // The Databricks CLI SHIPS vendor agent skills: `databricks aitools install --path <dir>`
      // writes the full skill set as plain SKILL.md folders to a scratch dir — keyless, no
      // workspace, no state.
      probeId: 'cli-agent-skills-scratch',
      productId: 'databricks',
      storyIds: ['agentic-agent-docs', 'agentic-official-cli'],
      bin: 'databricks',
      argv: [
        'sh', '-c',
        'rm -rf /tmp/pa-dbx-skills; databricks aitools install --path /tmp/pa-dbx-skills; echo "--- installed skills ---"; find /tmp/pa-dbx-skills -name SKILL.md | sort | head -8; echo "--- frontmatter of databricks-docs ---"; sed -n 1,3p /tmp/pa-dbx-skills/databricks-docs/SKILL.md; rm -rf /tmp/pa-dbx-skills',
      ],
      displayCommand: 'databricks aitools install --path /tmp/pa-dbx-skills  # vendor-shipped agent skills, then list + print one SKILL.md frontmatter',
      expect: /name: databricks-docs/,
      timeoutMs: 180_000,
    },
    {
      // BigQuery's REST surface is publicly self-describing: the v2 discovery document
      // downloads keylessly and machine-readably.
      probeId: 'rest-discovery',
      productId: 'bigquery',
      storyIds: ['agentic-public-api', 'api-machine-spec'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        `curl -s https://bigquery.googleapis.com/discovery/v1/apis/bigquery/v2/rest | python3 -c 'import sys, json; d = json.load(sys.stdin); print("id:", d["id"]); print("title:", d["title"]); print("basePath:", d["basePath"]); print("resources:", ", ".join(sorted(d["resources"])))'`,
      ],
      displayCommand: `curl -s https://bigquery.googleapis.com/discovery/v1/apis/bigquery/v2/rest | python3 -c '<print id/title/basePath/resources>'`,
      // The discovery JSON's top-level key order varies between responses — parse it instead of
      // grepping the first lines.
      expect: /id: bigquery:v2/,
      timeoutMs: 60_000,
    },
    {
      // Google's official MCP Toolbox for Databases (BigQuery prebuilt tools) runs from npm and
      // prints its version keylessly; a live server needs ADC credentials + BIGQUERY_PROJECT.
      probeId: 'mcp-toolbox-version',
      productId: 'bigquery',
      storyIds: ['agentic-mcp-server'],
      bin: 'npx',
      argv: ['npx', '-y', '@toolbox-sdk/server', '--version'],
      displayCommand: 'npx -y @toolbox-sdk/server --version  # MCP Toolbox for Databases (prebuilt BigQuery tools)',
      expect: /toolbox version \d+\.\d+\.\d+/,
      timeoutMs: 180_000,
    },
    {
      // The engine under MotherDuck runs FULLY keyless on this machine: a REAL analytical
      // roundtrip — build a 1M-row table, then an aggregate GROUP BY — in one command.
      probeId: 'local-analytical-roundtrip',
      productId: 'motherduck',
      storyIds: ['local-dev-loop', 'full-sql-surface', 'agentic-official-cli'],
      bin: 'duckdb',
      argv: [
        'duckdb', '-c',
        'CREATE TABLE events AS SELECT range AS id, range % 4 AS region, range * 1.5 AS revenue FROM range(1000000); SELECT region, count(*) AS n, round(sum(revenue),1) AS total_revenue FROM events GROUP BY region ORDER BY region;',
      ],
      displayCommand: `duckdb -c 'CREATE TABLE events AS SELECT ... FROM range(1000000); SELECT region, count(*), sum(revenue) FROM events GROUP BY region'  # keyless in-memory engine`,
      expect: /250000/,
      timeoutMs: 120_000,
    },
    {
      // The official DuckDB/MotherDuck MCP server (pypi) completes a FULL keyless stdio
      // initialize handshake against an in-memory DuckDB — no MotherDuck account.
      probeId: 'mcp-stdio-handshake',
      productId: 'motherduck',
      storyIds: ['agentic-mcp-server', 'agent-runs-sql-headless'],
      bin: 'uvx',
      argv: [
        'sh', '-c',
        `{ printf '%s\\n' '${MCP_INITIALIZE.trim().replace(/'/g, "'\\''")}'; sleep 8; } | uvx mcp-server-motherduck --db-path :memory: --read-write 2>/dev/null | head -1 | cut -c 1-400`,
      ],
      displayCommand: `printf '<jsonrpc initialize>' | uvx mcp-server-motherduck --db-path :memory: --read-write  # stdio handshake, no account`,
      expect: /"serverInfo":\{"name":"mcp-server-motherduck"/,
      timeoutMs: 180_000,
    },
    {
      // A REAL analytical query THROUGH MCP: initialize → initialized → tools/call execute_query
      // (aggregate GROUP BY over 1000 generated rows) — the full agent path, entirely keyless.
      probeId: 'mcp-query-roundtrip',
      productId: 'motherduck',
      storyIds: ['agent-runs-sql-headless', 'agentic-mcp-server', 'local-dev-loop'],
      bin: 'uvx',
      argv: [
        'sh', '-c',
        `{ printf '%s\\n%s\\n%s\\n' '${MCP_INITIALIZE.trim().replace(/'/g, "'\\''")}' '{"jsonrpc":"2.0","method":"notifications/initialized"}' '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"execute_query","arguments":{"sql":"SELECT region, count(*) AS n, sum(revenue) AS total FROM (SELECT range % 2 AS region, range * 1.5 AS revenue FROM range(1000)) GROUP BY region ORDER BY region"}}}'; sleep 10; } | uvx mcp-server-motherduck --db-path :memory: --read-write 2>/dev/null | tail -1 | cut -c 1-900`,
      ],
      displayCommand: `printf '<initialize> <initialized> <tools/call execute_query GROUP BY>' | uvx mcp-server-motherduck --db-path :memory: --read-write  # real SQL through MCP, keyless`,
      expect: /374250/,
      timeoutMs: 180_000,
    },
    {
      // The hosted MotherDuck remote MCP answers keylessly with its OAuth challenge.
      probeId: 'mcp-remote-handshake',
      productId: 'motherduck',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://api.motherduck.com/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://api.motherduck.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // MotherDuck publishes an agentskills.io-conformant discovery manifest at
      // /.well-known/agent-skills — agent-oriented docs as a first-class, machine-readable surface.
      probeId: 'agent-skills-manifest',
      productId: 'motherduck',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        'curl -s https://motherduck.com/.well-known/agent-skills/index.json | head -20',
      ],
      displayCommand: 'curl -s https://motherduck.com/.well-known/agent-skills/index.json | head -20',
      expect: /schemas\.agentskills\.io/,
      timeoutMs: 60_000,
    },
]
