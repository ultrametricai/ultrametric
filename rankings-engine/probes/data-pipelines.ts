import { MCP_INITIALIZE, type LocalProbe } from './types'

  // Data pipelines & ELT: a CLI-native arena, so the signature keyless proofs are REAL
  // scaffolds and boots — `dlt init` writes a working pipeline into a mktemp fixture,
  // create-dagster scaffolds a project and `dagster dev` boots the webserver far enough to
  // answer /server_info with its version JSON, meltano init lays out a full project — plus
  // stdio MCP initialize handshakes against the first-party servers (pypi dlt-mcp, PyAirbyte's
  // bundled airbyte-mcp) and keyless auth-challenges from the hosted APIs. All keyless,
  // self-cleaned, no accounts.
export const probes: LocalProbe[] = [
    {
      // PyAirbyte installs keylessly from pypi and imports.
      probeId: 'pyairbyte-install-import',
      productId: 'airbyte',
      storyIds: ['agentic-sdks', 'pipelines-as-code'],
      bin: 'uv',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && uv venv -q && uv pip install -q airbyte && ./.venv/bin/python -c "from importlib.metadata import version; import airbyte; print('PA_PROBE_OK pyairbyte', version('airbyte'))" ; cd / && rm -rf "$d"`,
      ],
      displayCommand: `mktemp -d && uv venv && uv pip install airbyte && python -c "import airbyte; print('PA_PROBE_OK pyairbyte', version('airbyte'))"`,
      expect: /PA_PROBE_OK pyairbyte \d+\.\d+/,
      timeoutMs: 300_000,
    },
    {
      // PyAirbyte ships a first-party MCP server binary: FULL keyless stdio initialize
      // handshake — serverInfo airbyte-mcp.
      probeId: 'mcp-stdio-handshake',
      productId: 'airbyte',
      storyIds: ['agentic-mcp-server', 'agent-operates-pipelines'],
      bin: 'uv',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && uv venv -q && uv pip install -q airbyte && { printf '%s\\n' '${MCP_INITIALIZE.trim().replace(/'/g, "'\\''")}'; sleep 8; } | ./.venv/bin/airbyte-mcp 2>/dev/null | head -1 | cut -c 1-400 ; cd / && rm -rf "$d"`,
      ],
      displayCommand: `uv pip install airbyte && printf '<jsonrpc initialize>' | airbyte-mcp  # first-party stdio MCP bundled with PyAirbyte`,
      expect: /"serverInfo":\{"name":"airbyte-mcp"/,
      timeoutMs: 300_000,
    },
    {
      // The hosted Airbyte API answers keylessly with a Bearer challenge + OAuth
      // protected-resource metadata.
      probeId: 'api-auth-challenge',
      productId: 'airbyte',
      storyIds: ['agentic-public-api', 'agent-builds-pipeline'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s -i --max-time 20 https://api.airbyte.com/v1/connections | head -4'],
      displayCommand: 'curl -si https://api.airbyte.com/v1/connections | head -4',
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // Fivetran's documented REST API is live and cleanly auth-gated keylessly.
      probeId: 'api-auth-challenge',
      productId: 'fivetran',
      storyIds: ['agentic-public-api', 'agent-operates-pipelines'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s -i --max-time 20 https://api.fivetran.com/v1/connectors | head -6'],
      displayCommand: 'curl -si https://api.fivetran.com/v1/connectors | head -6',
      expect: /www-authenticate: Basic/i,
      timeoutMs: 30_000,
    },
    {
      // The full agent-builds-a-project path, keylessly: create-dagster scaffolds a real
      // project (uv-synced), `dagster dev` boots, and /server_info answers with version JSON.
      // Self-cleaned; the ephemeral webserver is killed after the check.
      probeId: 'scaffold-dev-boot',
      productId: 'dagster',
      storyIds: ['agent-builds-pipeline', 'local-dev-testing', 'agentic-official-cli'],
      bin: 'uvx',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && uvx -q create-dagster@latest project pa-probe --uv-sync 2>&1 | tail -3; ls pa-probe; cd pa-probe && (uv run dagster dev -p 13334 > "$d/devlog.txt" 2>&1 & n=0; while [ $n -lt 45 ] && ! grep -q "Serving dagster-webserver" "$d/devlog.txt"; do sleep 2; n=$((n+1)); done; grep -E "Serving dagster-webserver" "$d/devlog.txt" | head -1; curl -s --max-time 5 http://127.0.0.1:13334/server_info; echo; pkill -f "dagster dev -p 13334" 2>/dev/null; pkill -f dagster-webserver 2>/dev/null; pkill -f dagster-daemon 2>/dev/null); cd / && rm -rf "$d"`,
      ],
      displayCommand: `mktemp -d && uvx create-dagster@latest project pa-probe --uv-sync && cd pa-probe && uv run dagster dev -p 13334 & curl http://127.0.0.1:13334/server_info  # scaffold + real webserver boot, keyless`,
      expect: /"dagster_webserver_version"/,
      timeoutMs: 480_000,
    },
    {
      // Official dagster CLI installs keylessly from pypi via uvx.
      probeId: 'cli-version',
      productId: 'dagster',
      storyIds: ['agentic-official-cli'],
      bin: 'uvx',
      argv: ['sh', '-c', 'uvx dagster --version 2>&1 | tail -1'],
      displayCommand: 'uvx dagster --version',
      expect: /dagster, version \d+\.\d+\.\d+/,
      timeoutMs: 300_000,
    },
    {
      // A REAL `dlt init` scaffold in a throwaway fixture: verified-source pipeline code,
      // secrets template, and requirements land on disk with no account and no keys.
      probeId: 'init-scaffold',
      productId: 'dlt',
      storyIds: ['agent-builds-pipeline', 'pipelines-as-code', 'agentic-official-cli'],
      bin: 'uvx',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && printf 'y\\n' | uvx --with 'dlt[duckdb]' dlt init chess duckdb 2>&1 | tail -8; echo "--- files ---"; ls -a | head -8; head -3 chess_pipeline.py; cd / && rm -rf "$d"`,
      ],
      displayCommand: `mktemp -d && uvx --with 'dlt[duckdb]' dlt init chess duckdb && ls && head chess_pipeline.py  # real pipeline scaffold, no credentials`,
      expect: /Verified source chess was added to your project/,
      timeoutMs: 300_000,
    },
    {
      // dltHub's official MCP server (pypi dlt-mcp) completes a FULL keyless stdio initialize
      // handshake — serverInfo "dlt MCP".
      probeId: 'mcp-stdio-handshake',
      productId: 'dlt',
      storyIds: ['agentic-mcp-server', 'agent-operates-pipelines'],
      bin: 'uv',
      argv: [
        'sh', '-c',
        `{ printf '%s\\n' '${MCP_INITIALIZE.trim().replace(/'/g, "'\\''")}'; sleep 10; } | uv run --with 'dlt-mcp[duckdb]' dlt-mcp 2>/dev/null | head -1 | cut -c 1-400`,
      ],
      displayCommand: `printf '<jsonrpc initialize>' | uv run --with 'dlt-mcp[duckdb]' dlt-mcp  # official dltHub MCP, stdio, keyless`,
      expect: /"serverInfo":\{"name":"dlt MCP"/,
      timeoutMs: 300_000,
    },
    {
      probeId: 'cli-version',
      productId: 'dlt',
      storyIds: ['agentic-official-cli'],
      bin: 'uvx',
      argv: ['sh', '-c', 'uvx dlt --version 2>&1 | tail -1'],
      displayCommand: 'uvx dlt --version',
      expect: /dlt \d+\.\d+\.\d+/,
      timeoutMs: 300_000,
    },
    {
      // meltano init lays out a complete ELT project (extract/load/transform/orchestrate dirs,
      // meltano.yml, environments) keylessly in a throwaway fixture.
      probeId: 'init-scaffold',
      productId: 'meltano',
      storyIds: ['agent-builds-pipeline', 'pipelines-as-code', 'agentic-official-cli'],
      bin: 'uvx',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && uvx meltano init pa-probe 2>&1 | tail -6; ls pa-probe; cd / && rm -rf "$d"`,
      ],
      displayCommand: 'mktemp -d && uvx meltano init pa-probe && ls pa-probe',
      expect: /Meltano Environments initialized/,
      timeoutMs: 300_000,
    },
    {
      // MeltanoHub's plugin registry API answers keylessly with the machine-readable
      // extractor index (Singer taps + variants).
      probeId: 'hub-registry-api',
      productId: 'meltano',
      storyIds: ['connector-catalog-breadth', 'agentic-public-api'],
      bin: 'curl',
      argv: ['sh', '-c', `curl -sL --max-time 20 'https://hub.meltano.com/meltano/api/v1/plugins/extractors/index' | head -c 400`],
      displayCommand: `curl -sL 'https://hub.meltano.com/meltano/api/v1/plugins/extractors/index' | head -c 400`,
      expect: /"tap-/,
      timeoutMs: 30_000,
    },
]
