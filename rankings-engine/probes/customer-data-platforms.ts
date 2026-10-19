import { CURL_MCP_INIT, type LocalProbe } from './types'

  // Customer data platforms: the signature keyless proofs are (a) live JSON-RPC initialize
  // POSTs against the hosted MCP servers RudderStack and Jitsu document — both answer with
  // their OAuth challenge + protected-resource metadata, the documented gating — (b) live,
  // self-describing API surfaces (Segment's Public API and ingest API, mParticle's events API,
  // Hightouch's REST API all answer keyless requests with structured auth/validation errors),
  // and (c) real npm installs of each vendor's official SDK into throwaway fixtures. All
  // keyless; no accounts, no events actually ingested.
export const probes: LocalProbe[] = [
    {
      // Segment's Public API is live and cleanly auth-gated keylessly.
      probeId: 'public-api-auth-challenge',
      productId: 'segment',
      storyIds: ['agentic-public-api', 'agent-manages-pipeline'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s -i --max-time 20 https://api.segmentapis.com/sources | sed -n 1,3p; curl -s --max-time 20 https://api.segmentapis.com/sources'],
      displayCommand: 'curl -si https://api.segmentapis.com/sources  # Segment Public API answers keylessly with a structured auth error',
      expect: /"type":"unauthorized","message":"Authorization header is required"/,
      timeoutMs: 30_000,
    },
    {
      // The tracking ingest endpoint is live and self-describing: an empty keyless POST
      // returns a structured error naming the missing write key.
      probeId: 'ingest-api-live',
      productId: 'segment',
      storyIds: ['server-ingest-http', 'sdk-event-collection'],
      bin: 'curl',
      argv: ['sh', '-c', `curl -s --max-time 20 -X POST https://api.segment.io/v1/track -H 'Content-Type: application/json' -d '{}'`],
      displayCommand: `curl -s -X POST https://api.segment.io/v1/track -H 'Content-Type: application/json' -d '{}'  # live ingest endpoint answers with a structured validation error`,
      expect: /"message": "An invalid write key was provided"/,
      timeoutMs: 30_000,
    },
    {
      // Official @segment/analytics-node installs keylessly from npm and exports Analytics.
      probeId: 'npm-install-sdk-roundtrip',
      productId: 'segment',
      storyIds: ['agentic-sdks', 'sdk-event-collection'],
      bin: 'npm',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && npm init -y >/dev/null 2>&1 && npm install @segment/analytics-node --no-fund --no-audit --loglevel=error && node -e "const m=require('@segment/analytics-node'); console.log('PA_PROBE_OK segment Analytics:', typeof m.Analytics)" ; cd / && rm -rf "$d"`,
      ],
      displayCommand: `mktemp -d && npm install @segment/analytics-node && node -e "console.log('PA_PROBE_OK segment Analytics:', typeof require('@segment/analytics-node').Analytics)"`,
      expect: /PA_PROBE_OK segment Analytics: function/,
      timeoutMs: 240_000,
    },
    {
      // RudderStack's hosted remote MCP server answers a keyless initialize with its OAuth
      // challenge + protected-resource metadata (documented at docs/ai-features/rudderstack-mcp).
      probeId: 'mcp-remote-handshake',
      productId: 'rudderstack',
      storyIds: ['agentic-mcp-server', 'agent-manages-pipeline'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.rudderstack.com/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.rudderstack.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /resource_metadata="https:\/\/mcp\.rudderstack\.com\/\.well-known\/oauth-protected-resource"/,
      timeoutMs: 30_000,
    },
    {
      // Official @rudderstack/rudder-sdk-node installs keylessly from npm.
      probeId: 'npm-install-sdk-roundtrip',
      productId: 'rudderstack',
      storyIds: ['agentic-sdks', 'sdk-event-collection'],
      bin: 'npm',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && npm init -y >/dev/null 2>&1 && npm install @rudderstack/rudder-sdk-node --no-fund --no-audit --loglevel=error && node -e "const m=require('@rudderstack/rudder-sdk-node'); console.log('PA_PROBE_OK rudder Analytics:', typeof (m.default ?? m))" ; cd / && rm -rf "$d"`,
      ],
      displayCommand: `mktemp -d && npm install @rudderstack/rudder-sdk-node && node -e "console.log('PA_PROBE_OK rudder Analytics:', typeof require('@rudderstack/rudder-sdk-node'))"`,
      expect: /PA_PROBE_OK rudder Analytics: function/,
      timeoutMs: 240_000,
    },
    {
      // mParticle's server-to-server events API is live and auth-gated keylessly (bare 401).
      probeId: 'events-api-auth-challenge',
      productId: 'mparticle',
      storyIds: ['server-ingest-http', 'agentic-public-api'],
      bin: 'curl',
      argv: ['sh', '-c', `curl -s -i --max-time 20 -X POST https://s2s.mparticle.com/v2/events -H 'Content-Type: application/json' -d '{}' | sed -n 1,4p`],
      displayCommand: `curl -si -X POST https://s2s.mparticle.com/v2/events -H 'Content-Type: application/json' -d '{}'  # live events API answers 401 keylessly`,
      expect: /HTTP\/[12](?:\.1)? 401/,
      timeoutMs: 30_000,
    },
    {
      // Official @mparticle/web-sdk installs keylessly from npm.
      probeId: 'npm-install-sdk-roundtrip',
      productId: 'mparticle',
      storyIds: ['agentic-sdks', 'sdk-event-collection'],
      bin: 'npm',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && npm init -y >/dev/null 2>&1 && npm install @mparticle/web-sdk --no-fund --no-audit --loglevel=error && node -e "const m=require('@mparticle/web-sdk'); console.log('PA_PROBE_OK mparticle init:', typeof m.init)" ; cd / && rm -rf "$d"`,
      ],
      displayCommand: `mktemp -d && npm install @mparticle/web-sdk && node -e "console.log('PA_PROBE_OK mparticle init:', typeof require('@mparticle/web-sdk').init)"`,
      expect: /PA_PROBE_OK mparticle init: function/,
      timeoutMs: 240_000,
    },
    {
      // Jitsu's hosted MCP server ("Jitsu runs an MCP server, so AI agents can manage your
      // pipeline directly") answers a keyless initialize with its OAuth challenge.
      probeId: 'mcp-remote-handshake',
      productId: 'jitsu',
      storyIds: ['agentic-mcp-server', 'agent-manages-pipeline'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://use.jitsu.com/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://use.jitsu.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /Bearer realm="jitsu-mcp"/,
      timeoutMs: 30_000,
    },
    {
      // Official @jitsu/js SDK installs keylessly from npm and exports jitsuAnalytics.
      probeId: 'npm-install-sdk-roundtrip',
      productId: 'jitsu',
      storyIds: ['agentic-sdks', 'sdk-event-collection'],
      bin: 'npm',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && npm init -y >/dev/null 2>&1 && npm install @jitsu/js --no-fund --no-audit --loglevel=error && node -e "import('@jitsu/js').then(m=>console.log('PA_PROBE_OK jitsu jitsuAnalytics:', typeof m.jitsuAnalytics))" ; cd / && rm -rf "$d"`,
      ],
      displayCommand: `mktemp -d && npm install @jitsu/js && node -e "import('@jitsu/js').then(m=>console.log('PA_PROBE_OK jitsu jitsuAnalytics:', typeof m.jitsuAnalytics))"`,
      expect: /PA_PROBE_OK jitsu jitsuAnalytics: function/,
      timeoutMs: 240_000,
    },
    {
      // Jitsu is REALLY self-hostable from source: a keyless shallow clone lands the
      // docker-compose self-host entrypoint and MIT license in a scratch dir.
      probeId: 'scratch-clone-selfhost',
      productId: 'jitsu',
      storyIds: ['openness-self-host', 'openness-open-license'],
      bin: 'git',
      argv: [
        'sh', '-c',
        'rm -rf /tmp/pa-jitsu; git clone --depth 1 https://github.com/jitsucom/jitsu.git /tmp/pa-jitsu 2>&1 | tail -1; echo "--- root files ---"; ls /tmp/pa-jitsu | head -14; echo "--- license ---"; head -3 /tmp/pa-jitsu/LICENSE; echo "--- compose ---"; ls /tmp/pa-jitsu/docker-compose.yml; rm -rf /tmp/pa-jitsu',
      ],
      displayCommand: 'git clone --depth 1 https://github.com/jitsucom/jitsu.git  # then list root files, LICENSE head, docker-compose.yml',
      expect: /MIT License/,
      timeoutMs: 180_000,
    },
    {
      // Hightouch's REST API is live and cleanly auth-gated keylessly.
      probeId: 'api-auth-challenge',
      productId: 'hightouch',
      storyIds: ['agentic-public-api', 'agent-queries-activates-audiences'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s -i --max-time 20 https://api.hightouch.com/api/v1/syncs | sed -n 1,3p; curl -s --max-time 20 https://api.hightouch.com/api/v1/syncs'],
      displayCommand: 'curl -si https://api.hightouch.com/api/v1/syncs  # REST API answers keylessly with a structured auth error',
      expect: /"message":"Authentication error"/,
      timeoutMs: 30_000,
    },
    {
      // Hightouch publishes an agent-oriented llms.txt describing itself and its docs surface.
      probeId: 'llms-txt-fetch',
      productId: 'hightouch',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://hightouch.com/llms.txt | head -4'],
      displayCommand: 'curl -s https://hightouch.com/llms.txt | head -4',
      expect: /# Hightouch/,
      timeoutMs: 30_000,
    },
]
