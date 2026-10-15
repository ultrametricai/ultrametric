import { CURL_MCP_INIT, type LocalProbe } from './types'

export const probes: LocalProbe[] = [
    {
      // Missive's GitBook docs publish a full llms.txt index (missed by the generic probe,
      // which only checks the site origin — the docs live under /docs).
      probeId: 'llms-docs-index',
      productId: 'missive',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://missiveapp.com/docs/llms.txt | head -6'],
      displayCommand: 'curl -s https://missiveapp.com/docs/llms.txt | head -6',
      expect: /# Missive Docs/,
      timeoutMs: 30_000,
    },
    {
      // Missive's docs serve markdown at any page URL + .md — the MCP-server page names the
      // hosted endpoint machine-readably.
      probeId: 'docs-md-endpoint',
      productId: 'missive',
      storyIds: ['agentic-agent-docs', 'agentic-mcp-server'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://missiveapp.com/docs/ai/mcp/server.md | head -8'],
      displayCommand: 'curl -s https://missiveapp.com/docs/ai/mcp/server.md | head -8',
      expect: /mcp\.missiveapp\.com/,
      timeoutMs: 30_000,
    },
    {
      // The hosted Missive MCP server answers a keyless initialize with its OAuth challenge —
      // and the advertised scopes (conversations, contacts, drafts:deliver, calendars) are the
      // agent capability surface in one header.
      probeId: 'mcp-remote-handshake',
      productId: 'missive',
      storyIds: ['agentic-mcp-server', 'agent-email-end-to-end'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.missiveapp.com',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.missiveapp.com -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // Fastmail's documented JMAP API endpoint is live and auth-gated: a keyless GET returns
      // 401 with a Bearer challenge + OAuth protected-resource metadata.
      probeId: 'jmap-session-challenge',
      productId: 'fastmail',
      storyIds: ['agentic-public-api', 'open-protocol-access'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s -i --max-time 20 https://api.fastmail.com/jmap/session | head -6'],
      displayCommand: 'curl -si https://api.fastmail.com/jmap/session | head -6',
      expect: /www-authenticate: Bearer/i,
      timeoutMs: 30_000,
    },
    {
      // RFC 8620 JMAP autodiscovery: /.well-known/jmap redirects to the live session endpoint.
      probeId: 'jmap-autodiscovery',
      productId: 'fastmail',
      storyIds: ['open-protocol-access', 'agentic-public-api'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s -i --max-time 20 https://api.fastmail.com/.well-known/jmap | head -6'],
      displayCommand: 'curl -si https://api.fastmail.com/.well-known/jmap | head -6',
      expect: /location: https:\/\/api\.fastmail\.com\/jmap\/session/i,
      timeoutMs: 30_000,
    },
    {
      // Zero is REALLY self-hostable from source: a keyless shallow clone lands MCP.md,
      // AGENT.md, and the production docker-compose in a scratch dir.
      probeId: 'scratch-clone-selfhost',
      productId: 'zero',
      storyIds: ['self-host-option', 'openness-self-host'],
      bin: 'git',
      argv: [
        'sh', '-c',
        'rm -rf /tmp/pa-zero; git clone --depth 1 https://github.com/Mail-0/Zero.git /tmp/pa-zero 2>&1 | tail -1; echo "--- root files ---"; ls /tmp/pa-zero | head -16; echo "--- MCP.md ---"; sed -n 1,3p /tmp/pa-zero/MCP.md; echo "--- compose files ---"; ls /tmp/pa-zero/docker-compose.db.yaml /tmp/pa-zero/docker-compose.prod.yaml; rm -rf /tmp/pa-zero',
      ],
      displayCommand: 'git clone --depth 1 https://github.com/Mail-0/Zero.git /tmp/pa-zero  # then list root files, MCP.md head, compose files',
      expect: /Zero MCP/,
      timeoutMs: 180_000,
    },
    {
      // AgentMail's site-root llms.txt is written FOR agents — step-by-step onboarding
      // instructions, not a docs index (the docs domain has its own).
      probeId: 'llms-site-agent-onboarding',
      productId: 'agentmail',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -sL --max-time 20 https://www.agentmail.to/llms.txt | head -6'],
      displayCommand: 'curl -sL https://www.agentmail.to/llms.txt | head -6',
      expect: /# AgentMail: Email for AI Agents/,
      timeoutMs: 30_000,
    },
    {
      // Docs domain publishes its own llms.txt index (Fern docs).
      probeId: 'llms-docs-index',
      productId: 'agentmail',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.agentmail.to/llms.txt | head -6'],
      displayCommand: 'curl -s https://docs.agentmail.to/llms.txt | head -6',
      expect: /# AgentMail \| Documentation/,
      timeoutMs: 30_000,
    },
    {
      // The hosted AgentMail MCP server answers a keyless initialize with its OAuth challenge
      // (Bearer + protected-resource metadata) — endpoint exists and speaks the protocol.
      probeId: 'mcp-remote-handshake',
      productId: 'agentmail',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: [
        'curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.agentmail.to/mcp',
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json, text/event-stream',
        '-d', CURL_MCP_INIT,
      ],
      displayCommand: `curl -si -X POST https://mcp.agentmail.to/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
      expect: /oauth-protected-resource/,
      timeoutMs: 30_000,
    },
    {
      // The Gmail API publishes a keyless machine-readable discovery document — the full REST
      // surface (methods, OAuth scopes) as JSON, no key required.
      probeId: 'api-discovery-doc',
      productId: 'gmail',
      storyIds: ['api-machine-spec', 'agentic-public-api'],
      bin: 'curl',
      // The discovery doc's top-level key order varies between responses, so grep the whole
      // document for its stable title instead of matching a byte prefix.
      argv: ['sh', '-c', `curl -s --max-time 20 'https://gmail.googleapis.com/$discovery/rest?version=v1' | grep -o '"title": "Gmail API"' | head -1`],
      displayCommand: `curl -s 'https://gmail.googleapis.com/$discovery/rest?version=v1' | grep -o '"title": "Gmail API"'`,
      expect: /"title": "Gmail API"/,
      timeoutMs: 30_000,
    },
    {
      // A keyless call to the live API answers a structured JSON 401 naming the exact
      // credential it wants — the endpoint is real and its errors are machine-readable.
      probeId: 'api-auth-challenge',
      productId: 'gmail',
      storyIds: ['agentic-public-api', 'agentic-scoped-keys'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://gmail.googleapis.com/gmail/v1/users/me/profile | head -c 200'],
      displayCommand: 'curl -s https://gmail.googleapis.com/gmail/v1/users/me/profile | head -c 200',
      expect: /"code": 401/,
      timeoutMs: 30_000,
    },
    {
      // Deliberate negative: Gmail ships no llms.txt on its developer docs host — the API is
      // deep but the agent-docs surface is Google's generic portal.
      probeId: 'llms-txt-404',
      productId: 'gmail',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s -o /dev/null -w "HTTP %{http_code}" --max-time 20 https://developers.google.com/llms.txt'],
      displayCommand: 'curl -s -o /dev/null -w "HTTP %{http_code}" https://developers.google.com/llms.txt',
      expect: /HTTP 404/,
      timeoutMs: 30_000,
    },
]
