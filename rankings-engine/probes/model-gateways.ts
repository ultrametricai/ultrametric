import type { LocalProbe } from './types'

export const probes: LocalProbe[] = [
    {
      // developer.konghq.com serves the LLM-optimized markdown source of the AI Gateway intro
      // at /ai-gateway.md, so an agent can read the gateway docs without a browser.
      probeId: 'docs-md-endpoint',
      productId: 'kong-ai-gateway',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://developer.konghq.com/ai-gateway.md | head -8'],
      displayCommand: 'curl -s https://developer.konghq.com/ai-gateway.md | head -8',
      expect: /title: "Kong AI Gateway"/,
      timeoutMs: 30_000,
    },
    {
      // Kong's docs-wide llms.txt index carries a dedicated AI Gateway section linking every
      // AI Gateway guide (providers, policies, MCP/A2A traffic) as agent-readable markdown.
      probeId: 'llms-docs-index',
      productId: 'kong-ai-gateway',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', "curl -s --max-time 20 https://developer.konghq.com/llms.txt | grep -A 4 '^## AI Gateway'"],
      displayCommand: "curl -s https://developer.konghq.com/llms.txt | grep -A 4 '## AI Gateway'",
      expect: /introduction to AI Gateway/,
      timeoutMs: 30_000,
    },
]
