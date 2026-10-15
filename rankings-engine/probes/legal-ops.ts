import type { LocalProbe } from './types'

export const probes: LocalProbe[] = [
    {
      // docs.stripe.com serves the markdown source of every docs page at URL + .md — the
      // Atlas guide included, so an agent can read the incorporation docs without a browser.
      probeId: 'docs-md-endpoint',
      productId: 'stripe-atlas',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.stripe.com/atlas.md | head -8'],
      displayCommand: 'curl -s https://docs.stripe.com/atlas.md | head -8',
      expect: /# Stripe Atlas/,
      timeoutMs: 30_000,
    },
    {
      // Stripe's docs-wide llms.txt index carries a dedicated Atlas section linking every
      // Atlas guide as agent-readable markdown.
      probeId: 'llms-docs-index',
      productId: 'stripe-atlas',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', "curl -s --max-time 20 https://docs.stripe.com/llms.txt | grep -A 4 '## Atlas'"],
      displayCommand: "curl -s https://docs.stripe.com/llms.txt | grep -A 4 '## Atlas'",
      expect: /Stripe Atlas to incorporate/,
      timeoutMs: 30_000,
    },
    {
      // beglaubigt.de's site-root llms.txt is a hand-written agent index: services, legal
      // grounding (BeurkG §40a, eIDAS), and entry points — readable without a browser.
      probeId: 'llms-site-index',
      productId: 'beglaubigt',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://beglaubigt.de/llms.txt | head -4'],
      displayCommand: 'curl -s https://beglaubigt.de/llms.txt | head -4',
      expect: /digital notarization, incorporations of GmbHs/,
      timeoutMs: 30_000,
    },
    {
      // The API docs ship their own llms.txt indexing every endpoint — the Incorporation
      // section documents the machine-callable GmbH/UG formation API.
      probeId: 'llms-docs-index',
      productId: 'beglaubigt',
      storyIds: ['agentic-agent-docs', 'agentic-public-api'],
      bin: 'curl',
      argv: ['sh', '-c', "curl -s --max-time 20 https://docs.beglaubigt.de/llms.txt | grep -A 2 'Initiate Incorporation'"],
      displayCommand: "curl -s https://docs.beglaubigt.de/llms.txt | grep -A 2 'Initiate Incorporation'",
      expect: /creates an incorporation request for a company in Germany/,
      timeoutMs: 30_000,
    },
    {
      // The production REST API answers a keyless request to a documented v1 endpoint with a
      // clean 401 JSON auth challenge — live, Bearer-token-gated, exactly as the docs describe.
      probeId: 'api-auth-gate',
      productId: 'beglaubigt',
      storyIds: ['agentic-public-api'],
      bin: 'curl',
      argv: ['curl', '-s', '-i', '--max-time', '20', 'https://api.beglaubigt.de/v1/notarization/123e4567-e89b-12d3-a456-426614174000'],
      displayCommand: 'curl -si https://api.beglaubigt.de/v1/notarization/<uuid>',
      expect: /401[\s\S]*Unauthorized: Invalid API token/,
      timeoutMs: 30_000,
    },
    {
      // Clerky's developer portal publishes llms.txt with .md doc mirrors — the agent-docs
      // surface in one keyless fetch (found in the 2026-09-15 crawl-gap fix: the founder flagged
      // Clerky's 0/100 AI-era score; the pack had only marketing pages).
      probeId: 'llms-docs-index',
      productId: 'clerky',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -sL --max-time 20 https://developers.clerky.com/llms.txt | head -6'],
      displayCommand: 'curl -sL https://developers.clerky.com/llms.txt | head -6',
      expect: /developers\.clerky\.com.*index\.md/,
      timeoutMs: 30_000,
    },
    {
      // The remote MCP server at the documented URL (developers.clerky.com/mcp-server) answers a
      // keyless initialize with a clean OAuth challenge — live and gated exactly as documented
      // (read-only tools, team-scoped access after auth).
      probeId: 'mcp-auth-challenge',
      productId: 'clerky',
      storyIds: ['agentic-mcp-server'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 -X POST https://mcp.clerky.com/mcp -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d \'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"pa-probe","version":"1.0"}}}\' -w "\\nHTTP %{http_code}"'],
      displayCommand: 'curl -s -X POST https://mcp.clerky.com/mcp -d <initialize> (no token)',
      expect: /Authentication required[\s\S]*HTTP 401/,
      timeoutMs: 30_000,
    },
    {
      // Honest negative: www.firstbase.io publishes no llms.txt (404) — recorded absence from
      // the 2026-09-23 depth spike.
      probeId: 'site-llms-txt-absent',
      productId: 'firstbase',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -sL -o /dev/null -w "HTTP %{http_code}" --max-time 20 https://www.firstbase.io/llms.txt'],
      displayCommand: 'curl -sL -o /dev/null -w "HTTP %{http_code}" https://www.firstbase.io/llms.txt',
      expect: /HTTP 404/,
      timeoutMs: 30_000,
    },
    {
      // Honest negative from the 2026-09-24 depth spike: Firstbase has no developer-docs
      // surface at all — docs.firstbase.io does not resolve (NXDOMAIN; developers. and api.
      // subdomains are equally absent). Complements the llms.txt 404 above: not just no
      // machine docs index, no docs host, period.
      probeId: 'docs-domain-absent',
      productId: 'firstbase',
      storyIds: ['agentic-agent-docs', 'agentic-public-api'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -sS --max-time 20 https://docs.firstbase.io/ 2>&1 | head -1'],
      displayCommand: 'curl -sS https://docs.firstbase.io/  # NXDOMAIN — no docs host exists',
      expect: /Could not resolve host: docs\.firstbase\.io/,
      timeoutMs: 30_000,
    },
]
