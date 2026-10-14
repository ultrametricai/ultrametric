import type { LocalProbe } from './types'

export const probes: LocalProbe[] = [
    {
      // developer.konghq.com serves the LLM-optimized markdown source of the Insomnia intro at
      // /insomnia.md, so an agent can read the API-client docs without a browser.
      probeId: 'docs-md-endpoint',
      productId: 'insomnia',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', 'curl -s --max-time 20 https://developer.konghq.com/insomnia.md | head -8'],
      displayCommand: 'curl -s https://developer.konghq.com/insomnia.md | head -8',
      expect: /title: Insomnia/,
      timeoutMs: 30_000,
    },
    {
      // Kong's docs-wide llms.txt index carries a dedicated Insomnia section linking every
      // Insomnia guide (incl. the Inso CLI) as agent-readable markdown.
      probeId: 'llms-docs-index',
      productId: 'insomnia',
      storyIds: ['agentic-agent-docs'],
      bin: 'curl',
      argv: ['sh', '-c', "curl -s --max-time 20 https://developer.konghq.com/llms.txt | grep -A 4 '^## Insomnia'"],
      displayCommand: "curl -s https://developer.konghq.com/llms.txt | grep -A 4 '## Insomnia'",
      expect: /Inso CLI/,
      timeoutMs: 30_000,
    },
]
