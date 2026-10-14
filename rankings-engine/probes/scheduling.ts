import { CURL_MCP_INIT, type LocalProbe } from './types'

export const probes: LocalProbe[] = [
    {
      // Hosted Cal.com MCP server (documented at cal.com/docs/mcp-server) answers a keyless
      // JSON-RPC initialize with its OAuth 2.1 challenge — live and speaking the MCP auth flow.
      probeId: 'mcp-remote-handshake',
      productId: 'cal-com',
      storyIds: ['agentic-mcp-server', 'agent-scheduling-tool', 'agent-books-meeting'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.cal.com/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.cal.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // The vendor-published self-host docker image boots a REAL full Cal.com instance against a
      // throwaway postgres — the web app answers with its first-run setup wizard, then everything
      // is torn down. (calcom/cal.diy on Docker Hub had no published tags at recording time, so
      // this uses the last vendor-published calcom/cal.com image, v6.2.0-arm.)
      probeId: 'self-host-docker-boot',
      productId: 'cal-com',
      storyIds: ['self-host-scheduling-engine', 'openness-self-host'],
      bin: 'docker',
      argv: [
        'sh', '-c',
        'docker rm -f pa-cal pa-cal-db >/dev/null 2>&1; docker network rm pa-cal-net >/dev/null 2>&1; docker network create pa-cal-net >/dev/null; docker run -d --name pa-cal-db --network pa-cal-net -e POSTGRES_PASSWORD=cal -e POSTGRES_DB=calendso postgres:16-alpine >/dev/null; sleep 5; docker run -d --name pa-cal --network pa-cal-net -p 3210:3000 -e DATABASE_URL="postgresql://postgres:cal@pa-cal-db:5432/calendso" -e DATABASE_DIRECT_URL="postgresql://postgres:cal@pa-cal-db:5432/calendso" -e NEXTAUTH_SECRET="pa-probe-nextauth-secret-0123456789abcdef" -e CALENDSO_ENCRYPTION_KEY="pa-probe-encryption-key-0123456789ab" -e NEXT_PUBLIC_WEBAPP_URL="http://localhost:3210" calcom/cal.com:v6.2.0-arm >/dev/null; n=0; until curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://127.0.0.1:3210/auth/login | grep -qE "200|307"; do n=$((n+1)); [ $n -ge 120 ] && break; sleep 2; done; curl -s -o /dev/null -w "login page HTTP %{http_code}\\n" --max-time 5 -L http://127.0.0.1:3210/auth/login; curl -s --max-time 5 -L http://127.0.0.1:3210/auth/login | grep -oiE "<title>[^<]*</title>" | head -1; docker rm -f pa-cal pa-cal-db >/dev/null 2>&1; docker network rm pa-cal-net >/dev/null 2>&1',
      ],
      displayCommand: 'docker run calcom/cal.com:v6.2.0-arm (+ throwaway postgres:16)  # boot the vendor self-host image, poll /auth/login, print the page title',
      expect: /Setup \| Cal\.com/,
      timeoutMs: 420_000,
    },
    {
      // Hosted Calendly MCP server (documented at developer.calendly.com/docs/mcp) answers a
      // keyless JSON-RPC initialize with its OAuth challenge + resource metadata.
      probeId: 'mcp-remote-handshake',
      productId: 'calendly',
      storyIds: ['agentic-mcp-server', 'agent-scheduling-tool', 'agent-books-meeting'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.calendly.com',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.calendly.com -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // Reclaim's hosted MCP server answers a keyless initialize with 401 + OAuth resource
      // metadata (via the API-gateway-remapped WWW-Authenticate header).
      probeId: 'mcp-remote-handshake',
      productId: 'reclaim',
      storyIds: ['agentic-mcp-server', 'agent-scheduling-tool'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.reclaim.ai',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.reclaim.ai -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // The OAuth protected-resource metadata document the challenge points at is live too.
      probeId: 'mcp-remote-discovery',
      productId: 'reclaim',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: ['curl', '-s', '--max-time', '20', 'https://mcp.reclaim.ai/.well-known/oauth-protected-resource'],
      displayCommand: 'curl -s https://mcp.reclaim.ai/.well-known/oauth-protected-resource',
      expect: /"authorization_servers"/,
      timeoutMs: 30_000,
    },
    {
      // SavvyCal publishes a machine-readable OpenAPI 3.0 spec of the Meetings API, fetchable
      // keylessly (linked from developers.savvycal.com/api/savvycal-meetings-api).
      probeId: 'openapi-spec-fetch',
      productId: 'savvycal',
      storyIds: ['api-machine-spec', 'scheduling-rest-api'],
      bin: 'curl',
      argv: [
        'sh', '-c',
        'curl -s --max-time 20 https://api.savvycal.com/v1/spec | python3 -c \'import json,sys; d=json.load(sys.stdin); print("openapi", d["openapi"], "-", d["info"]["title"], "-", len(d["paths"]), "paths")\'',
      ],
      displayCommand: `curl -s https://api.savvycal.com/v1/spec | python3 -c '<print openapi version, title, path count>'`,
      expect: /openapi 3\.0\.0 - SavvyCal Meetings API - \d+ paths/,
      timeoutMs: 30_000,
    },
    {
      // Motion publishes an agent-oriented llms.txt on its main origin (the docs origin, which
      // the publish-probe stage checks, does not carry one).
      probeId: 'llms-txt-fetch',
      productId: 'motion',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://www.usemotion.com/llms.txt | head -3'],
      displayCommand: 'curl -s https://www.usemotion.com/llms.txt | head -3',
      expect: /# Usemotion/,
      timeoutMs: 30_000,
    },
    {
      // Motion's documented REST API (docs.usemotion.com/api-reference) is live: a keyless GET
      // to the tasks endpoint answers with a clean structured 401 — the API exists and
      // enforces its documented X-API-Key auth. Added launch-audit wave 4 (2026-09-22).
      probeId: 'api-keyless-401',
      productId: 'motion',
      storyIds: ['agentic-public-api'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -si --max-time 20 https://api.usemotion.com/v1/tasks | head -1; curl -s --max-time 20 https://api.usemotion.com/v1/tasks'],
      displayCommand: 'curl -si https://api.usemotion.com/v1/tasks | head -1; curl -s https://api.usemotion.com/v1/tasks',
      expect: /HTTP\/2 401[\s\S]*"message":"Unauthorized"/,
      timeoutMs: 30_000,
    },
]
