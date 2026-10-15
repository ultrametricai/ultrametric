import { CURL_MCP_INIT, MCP_INITIALIZE, type LocalProbe } from './types'

export const probes: LocalProbe[] = [
    {
      // Official Neon CLI (npm package renamed neonctl → neon): version prints keylessly.
      probeId: 'cli-version',
      productId: 'neon',
      storyIds: ['agentic-official-cli'],
      bin: 'npx',
      argv: ['npx', '-y', 'neon@latest', '--version'],
      displayCommand: 'npx -y neon@latest --version',
      expect: /\d+\.\d+\.\d+/,
      timeoutMs: 120_000,
    },
    {
      // Hosted Neon MCP server answers keylessly with its OAuth challenge.
      probeId: 'mcp-remote-handshake',
      productId: 'neon',
      storyIds: ['agentic-mcp-server', 'agent-provisions-database'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.neon.tech/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.neon.tech/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // Documented keyless tool-inventory endpoint: verifies read-only + category scoping and
      // returns the scoped tool list with guardrail notices ("to verify which tools are active
      // for a given config without authenticating" — docs/ai/neon-mcp-server).
      probeId: 'mcp-list-tools-readonly',
      productId: 'neon',
      storyIds: ['agentic-mcp-server', 'agentic-scoped-keys'],
      bin: 'curl',
      argv: ['curl', '-s', '--max-time', '20', 'https://mcp.neon.tech/api/list-tools?readonly=true&category=querying'],
      displayCommand: 'curl -s "https://mcp.neon.tech/api/list-tools?readonly=true&category=querying"',
      expect: /"name":"run_sql".*"readOnlySafe":true/,
      timeoutMs: 30_000,
    },
    {
      // `neon claim` creates/claims a temporary project with NO account — the CLI face of the
      // neon.com/auth.md agent-provisioning flow. Help prints keylessly.
      probeId: 'cli-claim-help',
      productId: 'neon',
      storyIds: ['agent-provisions-database', 'agentic-headless'],
      bin: 'npx',
      argv: ['npx', '-y', 'neon@latest', 'claim', '--help'],
      displayCommand: 'npx -y neon@latest claim --help',
      expect: /Create a temporary Neon project without an account/,
      timeoutMs: 120_000,
    },
    {
      // `neon ask` answers from Neon's docs in the terminal, keylessly ("No login is required"),
      // with `--output json` for machine-readable agent use.
      probeId: 'cli-ask-docs-assistant',
      productId: 'neon',
      storyIds: ['agentic-builtin-assistant'],
      bin: 'npx',
      argv: ['npx', '-y', 'neon@latest', 'ask', '--prompt', 'What is a Neon branch?', '--output', 'json'],
      displayCommand: `npx -y neon@latest ask --prompt 'What is a Neon branch?' --output json`,
      expect: /"text":/,
      timeoutMs: 120_000,
    },
    {
      // Official Turso CLI, installed via the vendor's get.tur.so installer into ~/.turso.
      probeId: 'cli-version',
      productId: 'turso',
      storyIds: ['agentic-official-cli', 'cli-daily-workflow'],
      bin: 'sh',
      argv: ['sh', '-c', '"$HOME/.turso/turso" --version'],
      displayCommand: 'turso --version  # installed via `curl -sSfL https://get.tur.so/install.sh | bash`',
      expect: /turso version v\d+\.\d+\.\d+/,
      timeoutMs: 30_000,
    },
    {
      // `turso dev` boots a KEYLESS local libSQL server (sqld); a real SQL roundtrip —
      // CREATE / INSERT / SELECT — runs over the Hrana HTTP pipeline API, then the server dies.
      probeId: 'local-dev-roundtrip',
      productId: 'turso',
      storyIds: ['local-keyless-engine', 'agentic-headless'],
      bin: 'sh',
      argv: [
        'sh', '-c',
        'export PATH="$HOME/.turso:$PATH"; rm -f /tmp/pa-turso-probe.db*; pkill -f "sqld" 2>/dev/null; (turso dev --db-file /tmp/pa-turso-probe.db --port 8085 >/tmp/pa-turso-probe.log 2>&1 &); n=0; until curl -s --max-time 2 http://127.0.0.1:8085/health >/dev/null 2>&1; do n=$((n+1)); [ $n -ge 20 ] && break; sleep 1; done; curl -s --max-time 10 -X POST http://127.0.0.1:8085/v2/pipeline -H "Content-Type: application/json" -d "{\\"requests\\":[{\\"type\\":\\"execute\\",\\"stmt\\":{\\"sql\\":\\"CREATE TABLE arenas (id INTEGER PRIMARY KEY)\\"}},{\\"type\\":\\"execute\\",\\"stmt\\":{\\"sql\\":\\"INSERT INTO arenas (id) VALUES (6)\\"}},{\\"type\\":\\"execute\\",\\"stmt\\":{\\"sql\\":\\"SELECT id*7 AS answer FROM arenas\\"}},{\\"type\\":\\"close\\"}]}"; echo; grep -i "sqld listening" /tmp/pa-turso-probe.log | head -1; pkill -f "sqld"; rm -f /tmp/pa-turso-probe.db* /tmp/pa-turso-probe.log',
      ],
      displayCommand: 'turso dev --db-file /tmp/pa-turso-probe.db --port 8085  # local libSQL, no account — then CREATE/INSERT/SELECT (6*7) over the Hrana HTTP API',
      expect: /"type":"integer","value":"42"/,
      timeoutMs: 90_000,
    },
    {
      // Hosted Turso Cloud MCP server answers keylessly with its OAuth challenge.
      probeId: 'mcp-remote-handshake',
      productId: 'turso',
      storyIds: ['agentic-mcp-server', 'agent-provisions-database'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.turso.ai/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.turso.ai/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'cli-version',
      productId: 'planetscale',
      storyIds: ['agentic-official-cli'],
      bin: 'pscale',
      argv: ['pscale', '--version'],
      displayCommand: 'pscale --version  # installed via `brew install planetscale/tap/pscale`',
      expect: /pscale version \d+\.\d+\.\d+/,
      timeoutMs: 30_000,
    },
    {
      // `pscale --skill` prints a packaged agent guide (frontmatter name: pscale-cli) keylessly —
      // vendor-shipped agent docs inside the CLI binary itself.
      probeId: 'cli-agent-skill',
      productId: 'planetscale',
      storyIds: ['agentic-agent-docs', 'agentic-headless'],
      bin: 'pscale',
      argv: ['sh', '-c', 'pscale --skill | cat'],
      displayCommand: 'pscale --skill',
      expect: /name: pscale-cli/,
      timeoutMs: 30_000,
    },
    {
      // Hosted PlanetScale MCP server answers keylessly with its OAuth challenge.
      probeId: 'mcp-remote-handshake',
      productId: 'planetscale',
      storyIds: ['agentic-mcp-server', 'agent-safe-sql-operations'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.pscale.dev/mcp/planetscale',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.pscale.dev/mcp/planetscale -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // Single official binary from the vendor's `curl https://clickhouse.com/ | sh` installer.
      probeId: 'cli-version',
      productId: 'clickhouse',
      storyIds: ['agentic-official-cli'],
      bin: 'sh',
      argv: ['sh', '-c', '"$HOME/.clickhouse-bin/clickhouse" --version'],
      displayCommand: 'clickhouse --version  # installed via `curl https://clickhouse.com/ | sh`',
      expect: /ClickHouse local version \d+\.\d+/,
      timeoutMs: 30_000,
    },
    {
      // clickhouse-local runs a REAL analytical SQL roundtrip fully keylessly — CREATE TABLE,
      // INSERT, aggregate SELECT — no server, no account, no config.
      probeId: 'local-query-roundtrip',
      productId: 'clickhouse',
      storyIds: ['local-keyless-engine', 'analytical-queries', 'openness-self-host'],
      bin: 'sh',
      argv: [
        'sh', '-c',
        '"$HOME/.clickhouse-bin/clickhouse" local --query "CREATE TABLE arenas (id UInt32, name String) ENGINE = MergeTree ORDER BY id; INSERT INTO arenas VALUES (1, \'serverless\'), (2, \'databases\'); SELECT concat(\'PA_PROBE_OK rows=\', toString(count()), \' names=\', arrayStringConcat(groupArray(name), \'+\')) FROM arenas;"',
      ],
      displayCommand: `clickhouse local --query "CREATE TABLE arenas ...; INSERT INTO arenas VALUES ...; SELECT concat('PA_PROBE_OK rows=', toString(count()), ...) FROM arenas;"`,
      expect: /PA_PROBE_OK rows=2 names=serverless\+databases/,
      timeoutMs: 60_000,
    },
    {
      // Official mcp-clickhouse (pypi) completes a FULL keyless stdio initialize handshake —
      // serverInfo comes back openly; connection credentials are only needed at tool-call time.
      probeId: 'mcp-stdio-handshake',
      productId: 'clickhouse',
      storyIds: ['agentic-mcp-server', 'agent-safe-sql-operations'],
      bin: 'uvx',
      argv: [
        'sh', '-c',
        `printf '%s\\n' '${MCP_INITIALIZE.trim().replace(/'/g, "'\\''")}' | CLICKHOUSE_HOST=localhost CLICKHOUSE_USER=default CLICKHOUSE_PASSWORD= uvx mcp-clickhouse 2>/dev/null | head -1`,
      ],
      displayCommand: `printf '<jsonrpc initialize>' | uvx mcp-clickhouse  # stdio handshake, no ClickHouse credentials`,
      expect: /"serverInfo":\{"name":"mcp-clickhouse"/,
      timeoutMs: 180_000,
    },
    {
      probeId: 'cli-version',
      productId: 'cockroachdb',
      storyIds: ['agentic-official-cli'],
      bin: 'cockroach',
      argv: ['cockroach', 'version'],
      displayCommand: 'cockroach version  # installed via `brew install cockroachdb/tap/cockroach`',
      expect: /Build Tag:\s+v\d+\.\d+/,
      timeoutMs: 30_000,
    },
    {
      // `cockroach demo` boots a KEYLESS in-memory single-node cluster and runs a real SQL
      // roundtrip — CREATE / INSERT / SELECT — then exits on its own.
      probeId: 'local-demo-roundtrip',
      productId: 'cockroachdb',
      storyIds: ['local-keyless-engine', 'agentic-headless'],
      bin: 'cockroach',
      argv: [
        'cockroach', 'demo', '--no-example-database', '--insecure=true',
        '-e', "CREATE TABLE arenas (id INT PRIMARY KEY, name STRING); INSERT INTO arenas VALUES (1, 'serverless-databases'); SELECT 'ROUNDTRIP=' || count(*)::STRING FROM arenas;",
      ],
      displayCommand: `cockroach demo --no-example-database --insecure=true -e "CREATE TABLE arenas ...; INSERT ...; SELECT 'ROUNDTRIP=' || count(*)::STRING FROM arenas;"`,
      expect: /ROUNDTRIP=1/,
      timeoutMs: 120_000,
    },
    {
      // Hosted CockroachDB Cloud MCP server answers keylessly with its OAuth challenge.
      probeId: 'mcp-remote-handshake',
      productId: 'cockroachdb',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://cockroachlabs.cloud/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://cockroachlabs.cloud/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // Official Supabase CLI: version prints keylessly (bare semver on stdout). Same probe as
      // the backend-as-a-service module — supabase's second arena membership (founder ask
      // 2026-09-23: judged against neon in serverless-databases).
      probeId: 'cli-version',
      productId: 'supabase',
      storyIds: ['agentic-official-cli'],
      bin: 'npx',
      argv: ['npx', '-y', 'supabase', '--version'],
      displayCommand: 'npx -y supabase --version',
      expect: /\d+\.\d+\.\d+/,
      timeoutMs: 120_000,
    },
    {
      // Hosted Supabase MCP server answers keylessly with its OAuth challenge (RFC 9728
      // metadata pointer) — verified live 2026-09-23.
      probeId: 'mcp-remote-handshake',
      productId: 'supabase',
      storyIds: ['agentic-mcp-server', 'agent-provisions-database'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.supabase.com/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.supabase.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // Machine-discoverable agent-skills catalog at a well-known URL (agentskills.io discovery
      // spec), keyless — the index `npx skills add supabase/agent-skills` consumes.
      probeId: 'agent-skills-wellknown',
      productId: 'supabase',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['curl', '-s', '--max-time', '20', 'https://supabase.com/.well-known/agent-skills/index.json'],
      displayCommand: 'curl -s https://supabase.com/.well-known/agent-skills/index.json',
      expect: /schemas\.agentskills\.io\/discovery/,
      timeoutMs: 30_000,
    },
]
