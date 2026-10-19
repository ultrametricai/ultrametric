import { CURL_MCP_INIT, MCP_INITIALIZE, type LocalProbe } from './types'

export const probes: LocalProbe[] = [
    {
      probeId: 'cli-version',
      productId: 'launchdarkly',
      storyIds: ['agentic-official-cli'],
      bin: 'ldcli',
      argv: ['ldcli', '--version'],
      displayCommand: 'ldcli --version  # installed via `brew tap launchdarkly/homebrew-tap && brew install ldcli`',
      expect: /ldcli version \d+\.\d+\.\d+/,
      timeoutMs: 30_000,
    },
    {
      // Official npm MCP server completes a full keyless stdio initialize handshake
      // (tool calls authenticate later with an API key).
      probeId: 'mcp-stdio-handshake',
      productId: 'launchdarkly',
      storyIds: ['agentic-mcp-server', 'agent-toggles-flag-safely'],
      bin: 'npx',
      argv: ['sh', '-c', 'npx -y @launchdarkly/mcp-server start --transport stdio'],
      displayCommand: `echo '<jsonrpc initialize>' | npx -y @launchdarkly/mcp-server start --transport stdio`,
      stdinPayload: MCP_INITIALIZE,
      expect: /"serverInfo":\{"name":"LaunchDarkly"/,
      longRunning: true,
      timeoutMs: 180_000,
    },
    {
      // Documented hosted MCP endpoint draws a keyless 401 — live and auth-gated.
      probeId: 'mcp-remote-handshake',
      productId: 'launchdarkly',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.launchdarkly.com/mcp/launchdarkly',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.launchdarkly.com/mcp/launchdarkly -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /HTTP\/2 401/,
      timeoutMs: 30_000,
    },
    {
      probeId: 'cli-version',
      productId: 'statsig',
      storyIds: ['agentic-official-cli'],
      bin: 'npx',
      argv: ['npx', '-y', '@statsig/siggy', '--version'],
      displayCommand: 'npx -y @statsig/siggy --version',
      expect: /\d+\.\d+\.\d+/,
      timeoutMs: 120_000,
    },
    {
      // Hosted Statsig MCP answers keylessly with its OAuth protected-resource challenge.
      probeId: 'mcp-remote-handshake',
      productId: 'statsig',
      storyIds: ['agentic-mcp-server', 'agent-toggles-flag-safely'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://api.statsig.com/v1/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://api.statsig.com/v1/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /HTTP\/2 401/,
      timeoutMs: 30_000,
    },
    {
      // Documented no-auth docs MCP server: full keyless initialize (serverInfo statsig-docs).
      probeId: 'docs-mcp-handshake',
      productId: 'statsig',
      storyIds: ['agentic-agent-docs', 'agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        `curl -s --max-time 20 -X POST https://docs.statsig.com/api/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 500`,
      ],
      displayCommand: `curl -s -X POST https://docs.statsig.com/api/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /"serverInfo":\{"name":"statsig-docs"/,
      timeoutMs: 30_000,
    },
    {
      // Official npm MCP server: full keyless stdio initialize handshake.
      probeId: 'mcp-stdio-handshake',
      productId: 'growthbook',
      storyIds: ['agentic-mcp-server', 'agent-toggles-flag-safely'],
      bin: 'npx',
      argv: ['sh', '-c', 'npx -y @growthbook/mcp'],
      displayCommand: `echo '<jsonrpc initialize>' | npx -y @growthbook/mcp`,
      stdinPayload: MCP_INITIALIZE,
      expect: /"serverInfo":\{"name":"GrowthBook MCP/,
      longRunning: true,
      timeoutMs: 180_000,
    },
    {
      // Full keyless self-host roundtrip: boot mongo + the official image, register the first
      // user through the API, create an org and a boolean feature, mint an SDK connection, and
      // read the flag back from the keyless SDK-payload endpoint. Self-cleaned.
      probeId: 'docker-flag-create-evaluate-roundtrip',
      productId: 'growthbook',
      storyIds: ['self-host-open-source', 'openness-self-host', 'agent-toggles-flag-safely'],
      bin: 'docker',
      argv: [
        'sh', '-c',
        'docker rm -f pa-gb-probe pa-gb-mongo >/dev/null 2>&1; docker network rm pa-gb-net >/dev/null 2>&1; docker network create pa-gb-net >/dev/null && docker run -d --name pa-gb-mongo --network pa-gb-net -e MONGO_INITDB_ROOT_USERNAME=root -e MONGO_INITDB_ROOT_PASSWORD=password mongo:6 >/dev/null && docker run -d --name pa-gb-probe --network pa-gb-net -p 13100:3100 -e "MONGODB_URI=mongodb://root:password@pa-gb-mongo:27017/growthbook?authSource=admin" -e APP_ORIGIN=http://localhost:13000 -e API_HOST=http://localhost:13100 -e JWT_SECRET=pa-probe-secret -e ENCRYPTION_KEY=pa-probe-enc-key growthbook/growthbook:latest >/dev/null; n=0; until curl -s http://localhost:13100/healthcheck >/dev/null 2>&1; do n=$((n+1)); [ $n -ge 90 ] && break; sleep 2; done; curl -s http://localhost:13100/healthcheck; echo; curl -s -X POST http://localhost:13100/auth/register -H "Content-Type: application/json" -d "{\\"companyname\\":\\"PA Probe\\",\\"name\\":\\"PA Probe\\",\\"email\\":\\"probe@example.com\\",\\"password\\":\\"pa-Probe-Passw0rd!\\"}" >/dev/null; TOKEN=$(curl -s -X POST http://localhost:13100/auth/login -H "Content-Type: application/json" -d "{\\"email\\":\\"probe@example.com\\",\\"password\\":\\"pa-Probe-Passw0rd!\\"}" | python3 -c "import json,sys; print(json.load(sys.stdin)[\\"token\\"])"); ORG=$(curl -s -X POST http://localhost:13100/organization -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\\"company\\":\\"PA Probe\\"}" | python3 -c "import json,sys; print(json.load(sys.stdin)[\\"orgId\\"])"); echo "org: $ORG"; TOKEN=$(curl -s -X POST http://localhost:13100/auth/login -H "Content-Type: application/json" -d "{\\"email\\":\\"probe@example.com\\",\\"password\\":\\"pa-Probe-Passw0rd!\\"}" | python3 -c "import json,sys; print(json.load(sys.stdin)[\\"token\\"])"); curl -s -X POST http://localhost:13100/feature -H "Authorization: Bearer $TOKEN" -H "X-Organization: $ORG" -H "Content-Type: application/json" -d "{\\"id\\":\\"pa-probe-flag\\",\\"valueType\\":\\"boolean\\",\\"defaultValue\\":\\"true\\",\\"description\\":\\"probe\\",\\"environmentSettings\\":{\\"production\\":{\\"enabled\\":true,\\"rules\\":[]}},\\"project\\":\\"\\",\\"tags\\":[]}" | head -c 120; echo; KEY=$(curl -s -X POST http://localhost:13100/sdk-connections -H "Authorization: Bearer $TOKEN" -H "X-Organization: $ORG" -H "Content-Type: application/json" -d "{\\"name\\":\\"pa-probe\\",\\"languages\\":[\\"javascript\\"],\\"environment\\":\\"production\\",\\"sdkVersion\\":\\"1.0.0\\",\\"projects\\":[]}" | python3 -c "import json,sys; print(json.load(sys.stdin)[\\"connection\\"][\\"key\\"])"); echo "sdk key: $KEY"; curl -s "http://localhost:13100/api/features/$KEY"; echo; docker rm -f pa-gb-probe pa-gb-mongo >/dev/null 2>&1; docker network rm pa-gb-net >/dev/null 2>&1',
      ],
      displayCommand: 'docker run -d mongo:6 && docker run -d -p 13100:3100 growthbook/growthbook && POST /auth/register && POST /organization && POST /feature {id: pa-probe-flag} && POST /sdk-connections && curl /api/features/<sdk-key>',
      // The API pretty-prints its JSON, so allow whitespace/newlines between the tokens.
      expect: /"pa-probe-flag":[\s\S]{0,40}"defaultValue":\s*true/,
      timeoutMs: 420_000,
    },
    {
      // Hosted Flagsmith MCP endpoint draws a keyless 401 — live and key-gated as documented.
      probeId: 'mcp-remote-handshake',
      productId: 'flagsmith',
      storyIds: ['agentic-mcp-server', 'agent-toggles-flag-safely'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.flagsmith.com',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.flagsmith.com -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /HTTP\/2 401/,
      timeoutMs: 30_000,
    },
    {
      // Full keyless self-host roundtrip: postgres + the official unified image, register the
      // first user via the API, create org → project → environment, create a flag enabled by
      // default, then evaluate it KEYLESSLY via the environment's client-side key. Self-cleaned.
      probeId: 'docker-flag-create-evaluate-roundtrip',
      productId: 'flagsmith',
      storyIds: ['self-host-open-source', 'openness-self-host', 'agent-toggles-flag-safely'],
      bin: 'docker',
      argv: [
        'sh', '-c',
        'docker rm -f pa-flagsmith-probe pa-flagsmith-db >/dev/null 2>&1; docker network rm pa-flagsmith-net >/dev/null 2>&1; docker network create pa-flagsmith-net >/dev/null && docker run -d --name pa-flagsmith-db --network pa-flagsmith-net -e POSTGRES_DB=flagsmith -e POSTGRES_USER=flagsmith -e POSTGRES_PASSWORD=flagsmith postgres:16-alpine >/dev/null && docker run -d --name pa-flagsmith-probe --network pa-flagsmith-net -p 18000:8000 -e "DATABASE_URL=postgresql://flagsmith:flagsmith@pa-flagsmith-db:5432/flagsmith" -e "DJANGO_ALLOWED_HOSTS=*" flagsmith/flagsmith:latest >/dev/null; n=0; until curl -s http://localhost:18000/health >/dev/null 2>&1; do n=$((n+1)); [ $n -ge 90 ] && break; sleep 2; done; curl -s -i http://localhost:18000/health | head -1; curl -s -X POST http://localhost:18000/api/v1/auth/users/ -H "Content-Type: application/json" -d "{\\"email\\":\\"probe@example.com\\",\\"password\\":\\"pa-Probe-Passw0rd!\\",\\"first_name\\":\\"PA\\",\\"last_name\\":\\"Probe\\"}" >/dev/null; TOKEN=$(curl -s -X POST http://localhost:18000/api/v1/auth/login/ -H "Content-Type: application/json" -d "{\\"email\\":\\"probe@example.com\\",\\"password\\":\\"pa-Probe-Passw0rd!\\"}" | python3 -c "import json,sys; print(json.load(sys.stdin)[\\"key\\"])"); ORG=$(curl -s -X POST http://localhost:18000/api/v1/organisations/ -H "Authorization: Token $TOKEN" -H "Content-Type: application/json" -d "{\\"name\\":\\"PA Probe Org\\"}" | python3 -c "import json,sys; print(json.load(sys.stdin)[\\"id\\"])"); PROJ=$(curl -s -X POST http://localhost:18000/api/v1/projects/ -H "Authorization: Token $TOKEN" -H "Content-Type: application/json" -d "{\\"name\\":\\"pa-probe\\",\\"organisation\\":$ORG}" | python3 -c "import json,sys; print(json.load(sys.stdin)[\\"id\\"])"); ENVKEY=$(curl -s -X POST http://localhost:18000/api/v1/environments/ -H "Authorization: Token $TOKEN" -H "Content-Type: application/json" -d "{\\"name\\":\\"Development\\",\\"project\\":$PROJ}" | python3 -c "import json,sys; print(json.load(sys.stdin)[\\"api_key\\"])"); echo "env key: $ENVKEY"; curl -s -X POST "http://localhost:18000/api/v1/projects/$PROJ/features/" -H "Authorization: Token $TOKEN" -H "Content-Type: application/json" -d "{\\"name\\":\\"pa_probe_flag\\",\\"default_enabled\\":true}" | head -c 120; echo; curl -s http://localhost:18000/api/v1/flags/ -H "X-Environment-Key: $ENVKEY" | head -c 400; echo; docker rm -f pa-flagsmith-probe pa-flagsmith-db >/dev/null 2>&1; docker network rm pa-flagsmith-net >/dev/null 2>&1',
      ],
      displayCommand: 'docker run -d postgres:16-alpine && docker run -d -p 18000:8000 flagsmith/flagsmith && POST /api/v1/auth/users/ && POST /organisations/ && POST /projects/ && POST /environments/ && POST /features/ {pa_probe_flag} && curl /api/v1/flags/ -H "X-Environment-Key: <key>"',
      expect: /"name":"pa_probe_flag".*"enabled":true|"enabled":true.*"pa_probe_flag"/,
      timeoutMs: 420_000,
    },
    {
      // Full keyless self-host roundtrip: postgres + the official image with INIT tokens,
      // create a flag via the Admin API, attach a strategy, enable it in development, then
      // evaluate it through the Client API — the exact loop an agent runs. Self-cleaned.
      probeId: 'docker-flag-create-evaluate-roundtrip',
      productId: 'unleash',
      storyIds: ['self-host-open-source', 'openness-self-host', 'agent-toggles-flag-safely'],
      bin: 'docker',
      argv: [
        'sh', '-c',
        'docker rm -f pa-unleash-probe pa-unleash-db >/dev/null 2>&1; docker network rm pa-unleash-net >/dev/null 2>&1; docker network create pa-unleash-net >/dev/null && docker run -d --name pa-unleash-db --network pa-unleash-net -e POSTGRES_DB=unleash -e POSTGRES_USER=unleash -e POSTGRES_PASSWORD=unleash postgres:16-alpine >/dev/null && docker run -d --name pa-unleash-probe --network pa-unleash-net -p 14242:4242 -e DATABASE_HOST=pa-unleash-db -e DATABASE_NAME=unleash -e DATABASE_USERNAME=unleash -e DATABASE_PASSWORD=unleash -e DATABASE_SSL=false -e "INIT_ADMIN_API_TOKENS=*:*.pa-probe-admin-token" -e "INIT_CLIENT_API_TOKENS=default:development.pa-probe-client-token" unleashorg/unleash-server:latest >/dev/null; n=0; until curl -s http://localhost:14242/health >/dev/null 2>&1; do n=$((n+1)); [ $n -ge 90 ] && break; sleep 2; done; curl -s http://localhost:14242/health; echo; curl -s -X POST http://localhost:14242/api/admin/projects/default/features -H "Authorization: *:*.pa-probe-admin-token" -H "Content-Type: application/json" -d "{\\"name\\":\\"pa-probe-flag\\",\\"type\\":\\"release\\"}" | head -c 170; echo; curl -s -X POST http://localhost:14242/api/admin/projects/default/features/pa-probe-flag/environments/development/strategies -H "Authorization: *:*.pa-probe-admin-token" -H "Content-Type: application/json" -d "{\\"name\\":\\"default\\"}" | head -c 120; echo; curl -s -X POST http://localhost:14242/api/admin/projects/default/features/pa-probe-flag/environments/development/on -H "Authorization: *:*.pa-probe-admin-token" -o /dev/null -w "enable -> HTTP %{http_code}"; echo; curl -s http://localhost:14242/api/client/features/pa-probe-flag -H "Authorization: default:development.pa-probe-client-token"; echo; docker rm -f pa-unleash-probe pa-unleash-db >/dev/null 2>&1; docker network rm pa-unleash-net >/dev/null 2>&1',
      ],
      displayCommand: 'docker run -d postgres:16-alpine && docker run -d -p 14242:4242 -e INIT_ADMIN_API_TOKENS=... -e INIT_CLIENT_API_TOKENS=... unleashorg/unleash-server && POST /api/admin/projects/default/features {pa-probe-flag} && POST .../strategies && POST .../environments/development/on && curl /api/client/features/pa-probe-flag',
      expect: /"name":"pa-probe-flag","type":"release","enabled":true/,
      timeoutMs: 420_000,
    },
    {
      // Unleash's docs MCP endpoint completes a full keyless initialize handshake.
      probeId: 'docs-mcp-handshake',
      productId: 'unleash',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        `curl -s --max-time 20 -X POST https://docs.getunleash.io/_mcp/server -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '${CURL_MCP_INIT.replace(/'/g, `'\\''`)}' | head -c 400`,
      ],
      displayCommand: `curl -s -X POST https://docs.getunleash.io/_mcp/server -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /"serverInfo"/,
      timeoutMs: 30_000,
    },
]
