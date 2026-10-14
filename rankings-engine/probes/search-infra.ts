import { CURL_MCP_INIT, MCP_INITIALIZE, type LocalProbe } from './types'

export const probes: LocalProbe[] = [
    {
      // Official Algolia CLI runs keylessly from npm.
      probeId: 'cli-version',
      productId: 'algolia',
      storyIds: ['agentic-official-cli'],
      bin: 'npx',
      argv: ['npx', '-y', '@algolia/cli', '--version'],
      displayCommand: 'npx -y @algolia/cli --version',
      expect: /algolia version \d+\.\d+\.\d+/,
      timeoutMs: 120_000,
    },
    {
      // Hosted Algolia MCP server answers keylessly with its OAuth challenge.
      probeId: 'mcp-remote-handshake',
      productId: 'algolia',
      storyIds: ['agentic-mcp-server', 'agent-search-tool'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.algolia.com/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.algolia.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // The full Meilisearch engine binary (brew) prints its version with no account.
      probeId: 'server-version',
      productId: 'meilisearch',
      storyIds: ['agentic-official-cli', 'self-host-full-featured'],
      bin: 'meilisearch',
      argv: ['meilisearch', '--version'],
      displayCommand: 'meilisearch --version  # installed via `brew install meilisearch`',
      expect: /meilisearch \d+\.\d+\.\d+/,
      timeoutMs: 30_000,
    },
    {
      // Boots a fully keyless local Meilisearch (no master key = dev mode), indexes two
      // documents, and runs a REAL typo-tolerant search ("serverles") over HTTP, then dies.
      probeId: 'local-index-search-roundtrip',
      productId: 'meilisearch',
      storyIds: ['five-minute-quickstart', 'typo-tolerance', 'agentic-headless'],
      bin: 'meilisearch',
      argv: [
        'sh', '-c',
        'rm -rf /tmp/pa-meili-probe; pkill -f "meilisearch --db-path /tmp/pa-meili-probe" 2>/dev/null; (meilisearch --db-path /tmp/pa-meili-probe --http-addr 127.0.0.1:7777 --no-analytics >/tmp/pa-meili-probe.log 2>&1 &); n=0; until curl -s --max-time 2 http://127.0.0.1:7777/health | grep -q available; do n=$((n+1)); [ $n -ge 30 ] && break; sleep 1; done; curl -s -X POST http://127.0.0.1:7777/indexes/arenas/documents -H "Content-Type: application/json" -d "[{\\"id\\":1,\\"name\\":\\"serverless databases\\"},{\\"id\\":2,\\"name\\":\\"search infrastructure\\"}]"; echo; sleep 2; curl -s "http://127.0.0.1:7777/indexes/arenas/search?q=serverles"; echo; pkill -f "meilisearch --db-path /tmp/pa-meili-probe"; rm -rf /tmp/pa-meili-probe /tmp/pa-meili-probe.log',
      ],
      displayCommand: 'meilisearch --db-path /tmp/pa-meili-probe --http-addr 127.0.0.1:7777  # no master key, then index 2 docs + typo search q=serverles over HTTP',
      expect: /"hits":\[\{"id":1,"name":"serverless databases"\}\]/,
      timeoutMs: 120_000,
    },
    {
      // Official meilisearch-mcp (pypi) completes a FULL keyless stdio initialize handshake.
      probeId: 'mcp-stdio-handshake',
      productId: 'meilisearch',
      storyIds: ['agentic-mcp-server', 'agent-search-tool'],
      bin: 'uvx',
      argv: [
        'sh', '-c',
        `printf '%s\\n' '${MCP_INITIALIZE.trim().replace(/'/g, "'\\''")}' | uvx meilisearch-mcp 2>/dev/null | head -1`,
      ],
      displayCommand: `printf '<jsonrpc initialize>' | uvx meilisearch-mcp  # stdio handshake, no Meilisearch instance`,
      expect: /"serverInfo":\{"name":"meilisearch"/,
      timeoutMs: 180_000,
    },
    {
      probeId: 'server-version',
      productId: 'typesense',
      storyIds: ['agentic-official-cli', 'self-host-full-featured'],
      bin: 'sh',
      argv: ['sh', '-c', '"/opt/homebrew/opt/typesense-server@30.2/bin/typesense-server" --version 2>&1 | head -1'],
      displayCommand: 'typesense-server --version  # installed via `brew install typesense/tap/typesense-server@30.2`',
      expect: /Typesense \d+\.\d+/,
      timeoutMs: 30_000,
    },
    {
      // Boots a local Typesense with a self-set local API key (no account, no cloud), creates a
      // collection, indexes a document, and runs a REAL typo-tolerant search ("serch infra").
      probeId: 'local-index-search-roundtrip',
      productId: 'typesense',
      storyIds: ['five-minute-quickstart', 'typo-tolerance', 'self-host-full-featured'],
      bin: 'sh',
      argv: [
        'sh', '-c',
        'rm -rf /tmp/pa-ts-probe; mkdir -p /tmp/pa-ts-probe; pkill -f "typesense-server" 2>/dev/null; ("/opt/homebrew/opt/typesense-server@30.2/bin/typesense-server" --data-dir /tmp/pa-ts-probe --api-key=localdev --api-port 8188 >/tmp/pa-ts-probe.log 2>&1 &); n=0; until curl -s --max-time 2 http://127.0.0.1:8188/health | grep -q "\\"ok\\":true"; do n=$((n+1)); [ $n -ge 30 ] && break; sleep 1; done; curl -s -X POST http://127.0.0.1:8188/collections -H "X-TYPESENSE-API-KEY: localdev" -H "Content-Type: application/json" -d "{\\"name\\":\\"arenas\\",\\"fields\\":[{\\"name\\":\\"name\\",\\"type\\":\\"string\\"}]}" >/dev/null; curl -s -X POST http://127.0.0.1:8188/collections/arenas/documents -H "X-TYPESENSE-API-KEY: localdev" -d "{\\"name\\":\\"search infrastructure arena\\"}"; echo; curl -s "http://127.0.0.1:8188/collections/arenas/documents/search?q=serch%20infra&query_by=name" -H "X-TYPESENSE-API-KEY: localdev"; echo; pkill -f "typesense-server"; rm -rf /tmp/pa-ts-probe /tmp/pa-ts-probe.log',
      ],
      displayCommand: 'typesense-server --data-dir /tmp/pa-ts-probe --api-key=localdev --api-port 8188  # local self-set key, then create collection + index doc + typo search q="serch infra"',
      expect: /<mark>search<\/mark> <mark>infra<\/mark>structure arena/,
      timeoutMs: 120_000,
    },
    {
      // Official @elastic/mcp-server-elasticsearch (npm) completes a FULL keyless stdio
      // initialize handshake — only a placeholder ES_URL is needed, no cluster, no credentials.
      probeId: 'mcp-stdio-handshake',
      productId: 'elastic',
      storyIds: ['agentic-mcp-server', 'agent-search-tool'],
      bin: 'npx',
      argv: [
        'sh', '-c',
        `printf '%s\\n' '${MCP_INITIALIZE.trim().replace(/'/g, "'\\''")}' | ES_URL=http://127.0.0.1:9299 npx -y @elastic/mcp-server-elasticsearch 2>/dev/null | grep '"serverInfo"' | head -1`,
      ],
      displayCommand: `printf '<jsonrpc initialize>' | ES_URL=http://127.0.0.1:9299 npx -y @elastic/mcp-server-elasticsearch  # stdio handshake, no cluster`,
      expect: /"serverInfo":\{"name":"elasticsearch-mcp"/,
      timeoutMs: 180_000,
    },
    {
      // Full Elasticsearch boots locally in docker with security disabled (the engine itself is
      // free and runs with no account), then a REAL index + search roundtrip runs over HTTP.
      probeId: 'local-docker-roundtrip',
      productId: 'elastic',
      storyIds: ['self-host-full-featured', 'five-minute-quickstart'],
      bin: 'docker',
      argv: [
        'sh', '-c',
        'docker rm -f pa-es >/dev/null 2>&1; docker run -d --name pa-es -e discovery.type=single-node -e xpack.security.enabled=false -e ES_JAVA_OPTS="-Xms512m -Xmx512m" -p 9299:9200 docker.elastic.co/elasticsearch/elasticsearch:9.5.3 >/dev/null; n=0; until curl -s --max-time 2 http://127.0.0.1:9299/ | grep -q "You Know, for Search"; do n=$((n+1)); [ $n -ge 90 ] && break; sleep 2; done; curl -s -X POST "http://127.0.0.1:9299/arenas/_doc/1?refresh=true" -H "Content-Type: application/json" -d "{\\"name\\":\\"search infrastructure arena\\"}"; echo; curl -s "http://127.0.0.1:9299/arenas/_search?q=name:infrastructure"; echo; docker rm -f pa-es >/dev/null',
      ],
      displayCommand: 'docker run docker.elastic.co/elasticsearch/elasticsearch:9.5.3 (single-node, security off)  # then index a doc + query q=name:infrastructure over HTTP',
      expect: /"_source":\{"name":"search infrastructure arena"\}/,
      timeoutMs: 420_000,
    },
    {
      // The OSS TypeScript engine installs from npm and runs a REAL in-process index + insert +
      // typo-tolerant search roundtrip in one node invocation — no server, no account at all.
      probeId: 'sdk-node-roundtrip',
      productId: 'orama',
      storyIds: ['agentic-sdks', 'five-minute-quickstart', 'typo-tolerance'],
      bin: 'npm',
      argv: [
        'sh', '-c',
        'rm -rf /tmp/pa-orama-probe; mkdir -p /tmp/pa-orama-probe; cd /tmp/pa-orama-probe; npm init -y >/dev/null 2>&1; npm i @orama/orama >/dev/null 2>&1; node --input-type=module -e \'import { create, insert, search } from "@orama/orama"; const db = create({ schema: { name: "string" } }); insert(db, { name: "serverless databases arena" }); insert(db, { name: "search infrastructure arena" }); const r = search(db, { term: "infrastucture", tolerance: 2 }); console.log("PA_PROBE_OK hits=" + r.count, JSON.stringify(r.hits.map((h) => h.document.name)));\'; cd /; rm -rf /tmp/pa-orama-probe',
      ],
      displayCommand: `npm i @orama/orama && node -e 'create → insert ×2 → search({ term: "infrastucture", tolerance: 2 })'  # in-process, no server`,
      expect: /PA_PROBE_OK hits=1 \["search infrastructure arena"\]/,
      timeoutMs: 180_000,
    },
]
