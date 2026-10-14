import { CURL_MCP_INIT, MCP_INITIALIZE, type LocalProbe } from './types'

  // Vector databases: the signature keyless proof is "an agent provisions a collection through
  // the public API without credentials" — run for real against ephemeral local instances
  // (docker containers on throwaway ports, chroma's local server, milvus-lite's embedded file
  // store, qdrant-client's in-process mode), all self-cleaned. MCP handshakes cover the two
  // first-party stdio servers (uvx-published) plus Pinecone's keyless hosted docs MCP endpoint.
  // The python3/uvx probes expect the operator to prepend a scratch venv (chromadb +
  // qdrant-client + pymilvus[milvus_lite]) to PATH; binAvailable skips them gracefully otherwise.
export const probes: LocalProbe[] = [
    {
      probeId: 'mcp-remote-handshake',
      productId: 'pinecone',
      storyIds: ['agentic-mcp-server', 'agentic-agent-docs'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://docs.pinecone.io/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://docs.pinecone.io/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /"serverInfo"/,
      timeoutMs: 30_000,
    },
    {
      // Full keyless provision roundtrip against a real self-hosted server: boot the official
      // docker image on a throwaway port with anonymous access, create a collection via the
      // REST API, read the schema back, tear the container down.
      probeId: 'docker-provision-roundtrip',
      productId: 'weaviate',
      storyIds: ['openness-self-host', 'agentic-public-api'],
      bin: 'docker',
      argv: [
        'sh', '-c',
        'docker rm -f pa-weaviate-probe >/dev/null 2>&1; docker run -d --name pa-weaviate-probe -p 18080:8080 -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true -e PERSISTENCE_DATA_PATH=/var/lib/weaviate cr.weaviate.io/semitechnologies/weaviate:latest && n=0; while [ $n -lt 45 ] && ! curl -s http://localhost:18080/v1/.well-known/ready >/dev/null 2>&1; do sleep 2; n=$((n+1)); done; curl -s http://localhost:18080/v1/meta | head -c 240; echo; curl -s -X POST http://localhost:18080/v1/schema -H "Content-Type: application/json" -d "{\\"class\\":\\"PaProbe\\",\\"vectorizer\\":\\"none\\"}" | head -c 240; echo; curl -s http://localhost:18080/v1/schema | head -c 240; echo; docker rm -f pa-weaviate-probe >/dev/null 2>&1',
      ],
      displayCommand: 'docker run -d --name pa-weaviate-probe -p 18080:8080 -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true cr.weaviate.io/semitechnologies/weaviate:latest && curl -X POST localhost:18080/v1/schema -d \'{"class":"PaProbe","vectorizer":"none"}\' && curl localhost:18080/v1/schema',
      expect: /"classes":\[\{"class":"PaProbe"/,
      timeoutMs: 180_000,
    },
    {
      // Same keyless provision roundtrip for qdrant: boot the official image on a throwaway
      // port, PUT a collection through the REST API, list it back, tear down.
      probeId: 'docker-provision-roundtrip',
      productId: 'qdrant',
      storyIds: ['openness-self-host', 'agentic-public-api'],
      bin: 'docker',
      argv: [
        'sh', '-c',
        'docker rm -f pa-qdrant-probe >/dev/null 2>&1; docker run -d --name pa-qdrant-probe -p 16333:6333 qdrant/qdrant && n=0; while [ $n -lt 45 ] && ! curl -s http://localhost:16333/readyz >/dev/null 2>&1; do sleep 2; n=$((n+1)); done; curl -s http://localhost:16333/ ; echo; curl -s -X PUT http://localhost:16333/collections/pa_probe -H "Content-Type: application/json" -d "{\\"vectors\\":{\\"size\\":8,\\"distance\\":\\"Cosine\\"}}"; echo; curl -s http://localhost:16333/collections; echo; docker rm -f pa-qdrant-probe >/dev/null 2>&1',
      ],
      displayCommand: 'docker run -d --name pa-qdrant-probe -p 16333:6333 qdrant/qdrant && curl -X PUT localhost:16333/collections/pa_probe -d \'{"vectors":{"size":8,"distance":"Cosine"}}\' && curl localhost:16333/collections',
      expect: /"collections":\[\{"name":"pa_probe"\}\]/,
      timeoutMs: 180_000,
    },
    {
      // First-party MCP server (uvx-published mcp-server-qdrant) speaking stdio against a
      // throwaway local store — no cloud, no credentials.
      probeId: 'mcp-stdio-handshake',
      productId: 'qdrant',
      storyIds: ['agentic-mcp-server'],
      bin: 'uvx',
      argv: [
        'sh', '-c',
        'rm -rf /tmp/pa-qdrant-mcp; QDRANT_LOCAL_PATH=/tmp/pa-qdrant-mcp COLLECTION_NAME=pa-probe uvx mcp-server-qdrant',
      ],
      displayCommand: `echo '<jsonrpc initialize>' | QDRANT_LOCAL_PATH=/tmp/pa-qdrant-mcp COLLECTION_NAME=pa-probe uvx mcp-server-qdrant`,
      stdinPayload: MCP_INITIALIZE,
      expect: /"serverInfo"/,
      longRunning: true,
      timeoutMs: 90_000,
    },
    {
      probeId: 'cli-help',
      productId: 'chroma',
      storyIds: ['agentic-official-cli'],
      bin: 'chroma',
      argv: ['sh', '-c', 'chroma --help | cat'],
      displayCommand: 'chroma --help',
      expect: /A CLI for Chroma/,
      timeoutMs: 30_000,
    },
    {
      // Keyless provision roundtrip against chroma's own local server: `chroma run` on a
      // throwaway port + path, create a collection via the v2 REST API, list it back, kill.
      probeId: 'local-server-provision-roundtrip',
      productId: 'chroma',
      storyIds: ['embedded-local-mode', 'agentic-public-api'],
      bin: 'chroma',
      argv: [
        'sh', '-c',
        'pkill -f "chroma run --path /tmp/pa-chroma-probe" 2>/dev/null; rm -rf /tmp/pa-chroma-probe; (chroma run --path /tmp/pa-chroma-probe --port 8765 >/dev/null 2>&1 &); n=0; while [ $n -lt 30 ] && ! curl -s http://localhost:8765/api/v2/heartbeat >/dev/null 2>&1; do sleep 1; n=$((n+1)); done; curl -s http://localhost:8765/api/v2/heartbeat; echo; curl -s -X POST http://localhost:8765/api/v2/tenants/default_tenant/databases/default_database/collections -H "Content-Type: application/json" -d "{\\"name\\":\\"pa_probe\\"}" | head -c 240; echo; curl -s http://localhost:8765/api/v2/tenants/default_tenant/databases/default_database/collections | head -c 240; echo; pkill -f "chroma run --path /tmp/pa-chroma-probe"; rm -rf /tmp/pa-chroma-probe',
      ],
      displayCommand: 'chroma run --path /tmp/pa-chroma-probe --port 8765 & curl -X POST localhost:8765/api/v2/tenants/default_tenant/databases/default_database/collections -d \'{"name":"pa_probe"}\' && curl localhost:8765/api/v2/tenants/default_tenant/databases/default_database/collections',
      expect: /"name":"pa_probe"/,
      timeoutMs: 120_000,
    },
    {
      // First-party chroma-mcp stdio server against an ephemeral in-memory client.
      probeId: 'mcp-stdio-handshake',
      productId: 'chroma',
      storyIds: ['agentic-mcp-server'],
      bin: 'uvx',
      argv: ['sh', '-c', 'uvx chroma-mcp --client-type ephemeral'],
      displayCommand: `echo '<jsonrpc initialize>' | uvx chroma-mcp --client-type ephemeral`,
      stdinPayload: MCP_INITIALIZE,
      expect: /"serverInfo"/,
      longRunning: true,
      timeoutMs: 90_000,
    },
    {
      // Milvus Lite embedded mode: create a collection against a throwaway local file store
      // through the official pymilvus client — the documented laptop-scale deployment.
      probeId: 'milvus-lite-provision-roundtrip',
      productId: 'milvus',
      storyIds: ['embedded-local-mode', 'agentic-sdks'],
      bin: 'python3',
      argv: [
        'sh', '-c',
        'rm -rf /tmp/pa-milvus-probe.db && python3 -c \'from pymilvus import MilvusClient; c = MilvusClient("/tmp/pa-milvus-probe.db"); c.create_collection("pa_probe", dimension=8); print("PA_PROBE_OK", c.list_collections())\' ; rm -rf /tmp/pa-milvus-probe.db',
      ],
      displayCommand: `python3 -c 'from pymilvus import MilvusClient; c = MilvusClient("/tmp/pa-milvus-probe.db"); c.create_collection("pa_probe", dimension=8); print("PA_PROBE_OK", c.list_collections())'`,
      expect: /PA_PROBE_OK \['pa_probe'\]/,
      timeoutMs: 120_000,
    },
    {
      // HelixDB's docs publish a full llms.txt index.
      probeId: 'llms-docs-index',
      productId: 'helixdb',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.helix-db.com/llms.txt | head -6'],
      displayCommand: 'curl -s https://docs.helix-db.com/llms.txt | head -6',
      expect: /# HelixDB/,
      timeoutMs: 30_000,
    },
    {
      // Helix Cloud's hosted MCP answers a keyless initialize with its OAuth challenge
      // (WorkOS-backed per docs) — live and speaking the protocol.
      probeId: 'mcp-remote-handshake',
      productId: 'helixdb',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.helix-db.com/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.helix-db.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // Real pip install of the OSS embedded database into a throwaway uv venv, then an
      // import + version print — install AND import roundtrip in one transcript, self-cleaned.
      // No server, no key: LanceDB's embedded mode runs entirely in-process.
      probeId: 'pip-install-import-roundtrip',
      productId: 'lancedb',
      storyIds: ['agentic-sdks', 'embedded-local-mode'],
      bin: 'sh',
      argv: [
        'sh', '-c',
        `d=$(mktemp -d) && cd "$d" && uv venv -q && uv pip install -q lancedb && ./.venv/bin/python -c "from importlib.metadata import version; import lancedb; print('PA_PROBE_OK lancedb', version('lancedb'))" ; rc=$?; cd / && rm -rf "$d"; exit $rc`,
      ],
      displayCommand: `mktemp -d && uv venv && uv pip install lancedb && python -c "import lancedb; print('PA_PROBE_OK lancedb', version('lancedb'))"`,
      expect: /PA_PROBE_OK lancedb \d+\.\d+/,
      timeoutMs: 240_000,
    },
    {
      // Docs-wide llms.txt index — every LanceDB docs page mirrored as .md for agents.
      probeId: 'llms-docs-index',
      productId: 'lancedb',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.lancedb.com/llms.txt | head -4'],
      displayCommand: 'curl -s https://docs.lancedb.com/llms.txt | head -4',
      expect: /# LanceDB/,
      timeoutMs: 30_000,
    },
]
