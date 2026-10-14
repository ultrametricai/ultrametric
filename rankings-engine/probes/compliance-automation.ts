import type { LocalProbe } from './types'

// Compliance-automation platforms, probed keylessly on the surfaces that separate the field:
// Vanta's Mintlify developer hub (llms.txt + a keyless 176-path OpenAPI spec), Oneleet's fully
// keyless 114-path public OpenAPI, Drata's extractable OpenAPI page-data and Intercom help
// llms.txt, Secureframe's marketing-site llms.txt with .md page mirrors, Sprinto's GitBook docs
// (llms.txt + .md mirrors), and Thoropass's help-center llms.txt + live hosted trust center.
// Honest negatives recorded on both sides of the wall: vanta.com and oneleet.com publish no
// llms.txt, drata.com and sprinto.com serve bot walls (403) on their entire marketing sites,
// and docs.secureframe.com sits behind a Cloudflare Access login. All keyless, read-only.
// Verified live 2026-09-22.
export const probes: LocalProbe[] = [
  {
    probeId: 'dev-llms-txt',
    productId: 'vanta',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://developer.vanta.com/llms.txt | head -3'],
    displayCommand: 'curl -s https://developer.vanta.com/llms.txt | head -3',
    expect: /# Vanta Developer Hub/,
    timeoutMs: 30_000,
  },
  {
    // Keyless OpenAPI spec for the 176-path Manage Vanta API.
    probeId: 'openapi-spec',
    productId: 'vanta',
    storyIds: ['api-machine-spec'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 30 https://developer.vanta.com/reference/manage-vanta.json | head -c 60'],
    displayCommand: 'curl -s https://developer.vanta.com/reference/manage-vanta.json | head -c 60',
    expect: /"openapi": "3\.0\.0"/,
    timeoutMs: 45_000,
  },
  {
    // Honest negative: the marketing site publishes no llms.txt (the dev hub carries it).
    probeId: 'site-llms-txt-absent',
    productId: 'vanta',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s -o /dev/null -w "HTTP %{http_code}" --max-time 20 https://www.vanta.com/llms.txt'],
    displayCommand: 'curl -s -o /dev/null -w "HTTP %{http_code}" https://www.vanta.com/llms.txt',
    expect: /HTTP 404/,
    timeoutMs: 30_000,
  },
  {
    probeId: 'help-llms-txt',
    productId: 'drata',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://help.drata.com/llms.txt | head -3'],
    displayCommand: 'curl -s https://help.drata.com/llms.txt | head -3',
    expect: /# Drata Help Center/,
    timeoutMs: 30_000,
  },
  {
    // The 145-path v2 OpenAPI (with its public-api server URL) is extractable keyless from the
    // Redocly page-data of the developer portal.
    probeId: 'openapi-page-data',
    productId: 'drata',
    storyIds: ['api-machine-spec'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 30 https://developers.drata.com/page-data/openapi/reference/v2/overview/page-data.json | grep -o 'public-api.drata.com/public/v2' | head -1`],
    displayCommand: `curl -s https://developers.drata.com/page-data/openapi/reference/v2/overview/page-data.json | grep -o 'public-api.drata.com/public/v2'`,
    expect: /public-api\.drata\.com\/public\/v2/,
    timeoutMs: 45_000,
  },
  {
    // Honest negative, recorded: the entire drata.com marketing site (including pricing)
    // serves a bot wall to keyless fetches.
    probeId: 'site-bot-wall',
    productId: 'drata',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s -o /dev/null -w "HTTP %{http_code}" --max-time 20 https://drata.com'],
    displayCommand: 'curl -s -o /dev/null -w "HTTP %{http_code}" https://drata.com',
    expect: /HTTP 403/,
    timeoutMs: 30_000,
  },
  {
    probeId: 'site-llms-txt',
    productId: 'secureframe',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://secureframe.com/llms.txt | head -3'],
    displayCommand: 'curl -s https://secureframe.com/llms.txt | head -3',
    expect: /# Secureframe: Build trust\. Unlock growth\./,
    timeoutMs: 30_000,
  },
  {
    // Every marketing page mirrors to Markdown at the .md URL — here the pricing page.
    probeId: 'site-md-mirror',
    productId: 'secureframe',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://secureframe.com/pricing.md | head -3'],
    displayCommand: 'curl -s https://secureframe.com/pricing.md | head -3',
    expect: /# Secureframe packages/,
    timeoutMs: 30_000,
  },
  {
    // Honest negative, recorded: the support knowledge base sits behind a Cloudflare Access
    // login wall — not public.
    probeId: 'kb-access-wall',
    productId: 'secureframe',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -sL --max-time 20 https://docs.secureframe.com | grep -m1 -o 'Cloudflare Access'`],
    displayCommand: `curl -sL https://docs.secureframe.com | grep -o 'Cloudflare Access'`,
    expect: /Cloudflare Access/,
    timeoutMs: 30_000,
  },
  {
    // The only fully keyless public OpenAPI in the arena at a clean URL (114 paths, service
    // keys or MCP OAuth tokens as documented auth).
    probeId: 'openapi-spec',
    productId: 'oneleet',
    storyIds: ['api-machine-spec'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 30 https://api.oneleet.com/api/v1/public/openapi.json | grep -m1 -o 'Oneleet Public API'`],
    displayCommand: `curl -s https://api.oneleet.com/api/v1/public/openapi.json | grep -o 'Oneleet Public API'`,
    expect: /Oneleet Public API/,
    timeoutMs: 45_000,
  },
  {
    // Honest negative: no llms.txt on either oneleet.com or docs.oneleet.com.
    probeId: 'site-llms-txt-absent',
    productId: 'oneleet',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL -o /dev/null -w "HTTP %{http_code}" --max-time 20 https://www.oneleet.com/llms.txt'],
    displayCommand: 'curl -sL -o /dev/null -w "HTTP %{http_code}" https://www.oneleet.com/llms.txt',
    expect: /HTTP 404/,
    timeoutMs: 30_000,
  },
  {
    probeId: 'docs-llms-txt',
    productId: 'sprinto',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.sprinto.com/llms.txt | head -3'],
    displayCommand: 'curl -s https://docs.sprinto.com/llms.txt | head -3',
    expect: /# Sprinto Docs/,
    timeoutMs: 30_000,
  },
  {
    // GitBook docs mirror to Markdown at the .md URL.
    probeId: 'docs-md-mirror',
    productId: 'sprinto',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -sL --max-time 20 https://docs.sprinto.com/getting-started/quickstart.md | grep -m1 'Why Sprinto'`],
    displayCommand: `curl -s https://docs.sprinto.com/getting-started/quickstart.md | grep 'Why Sprinto'`,
    expect: /# Why Sprinto/,
    timeoutMs: 30_000,
  },
  {
    // Honest negative, recorded: sprinto.com (including pricing) serves a bot wall keyless.
    probeId: 'site-bot-wall',
    productId: 'sprinto',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s -o /dev/null -w "HTTP %{http_code}" --max-time 20 https://sprinto.com'],
    displayCommand: 'curl -s -o /dev/null -w "HTTP %{http_code}" https://sprinto.com',
    expect: /HTTP 403/,
    timeoutMs: 30_000,
  },
  {
    probeId: 'help-llms-txt',
    productId: 'thoropass',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://help.thoropass.com/llms.txt | head -3'],
    displayCommand: 'curl -s https://help.thoropass.com/llms.txt | head -3',
    expect: /# Thoropass Help Center/,
    timeoutMs: 30_000,
  },
  {
    // The hosted trust center answers live.
    probeId: 'trust-center-live',
    productId: 'thoropass',
    storyIds: ['public-trust-center'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s -o /dev/null -w "HTTP %{http_code}" --max-time 20 https://trust.thoropass.com/'],
    displayCommand: 'curl -s -o /dev/null -w "HTTP %{http_code}" https://trust.thoropass.com/',
    expect: /HTTP 200/,
    timeoutMs: 30_000,
  },
]
