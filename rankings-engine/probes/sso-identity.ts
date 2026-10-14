import type { LocalProbe } from './types'

// Workforce identity providers, probed keylessly on their machine surfaces: Okta's own org
// serves OIDC discovery and a structured keyless API error, and its Terraform provider (102M+
// downloads) resolves on the public registry; JumpCloud publishes keyless OpenAPI 3.1 YAML and
// an agentic-IAM llms.txt; Rippling's v2 REST root answers a clean keyless 401 and its
// developer llms.txt scopes the API for agents; Google's Directory API discovery document and
// Microsoft Graph's $metadata are both fetchable keyless, and learn.microsoft.com exposes its
// POST-only MCP endpoint. Honest negative recorded: developers.google.com has no llms.txt.
// All keyless, read-only. Verified live 2026-09-22.
export const probes: LocalProbe[] = [
  {
    // Okta's own production org answers OIDC discovery keyless.
    probeId: 'oidc-discovery',
    productId: 'okta',
    storyIds: ['agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://okta.okta.com/.well-known/openid-configuration | head -c 150'],
    displayCommand: 'curl -s https://okta.okta.com/.well-known/openid-configuration',
    expect: /"issuer":"https:\/\/okta\.okta\.com"/,
    timeoutMs: 30_000,
  },
  {
    // The management API answers keyless with a structured Okta error code.
    probeId: 'api-keyless-error',
    productId: 'okta',
    storyIds: ['directory-users-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://okta.okta.com/api/v1/users | head -c 200'],
    displayCommand: 'curl -s https://okta.okta.com/api/v1/users',
    expect: /"errorCode":"E0000005"/,
    timeoutMs: 30_000,
  },
  {
    // Official partner-tier Terraform provider on the public registry (102M+ downloads).
    probeId: 'terraform-provider',
    productId: 'okta',
    storyIds: ['config-as-code'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://registry.terraform.io/v1/providers/okta/okta | head -c 200'],
    displayCommand: 'curl -s https://registry.terraform.io/v1/providers/okta/okta',
    expect: /"id":"okta\/okta/,
    timeoutMs: 30_000,
  },
  {
    probeId: 'site-llms-txt',
    productId: 'okta',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://www.okta.com/llms.txt | head -3'],
    displayCommand: 'curl -s https://www.okta.com/llms.txt | head -3',
    expect: /# Okta and Auth0 Platforms/,
    timeoutMs: 30_000,
  },
  {
    // Keyless OpenAPI 3.1 YAML for the full v2 API.
    probeId: 'openapi-yaml',
    productId: 'jumpcloud',
    storyIds: ['api-machine-spec', 'directory-users-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://docs.jumpcloud.com/api/2.0/index.yaml | head -5'],
    displayCommand: 'curl -s https://docs.jumpcloud.com/api/2.0/index.yaml | head -5',
    expect: /openapi: 3\.1\.0/,
    timeoutMs: 30_000,
  },
  {
    probeId: 'site-llms-txt',
    productId: 'jumpcloud',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://jumpcloud.com/llms.txt | head -3'],
    displayCommand: 'curl -s https://jumpcloud.com/llms.txt | head -3',
    expect: /# JumpCloud/,
    timeoutMs: 30_000,
  },
  {
    // The v2 REST root answers a clean keyless JSON 401 (the endpoint agents will hit).
    probeId: 'rest-keyless-error',
    productId: 'rippling-it',
    storyIds: ['agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://rest.ripplingapis.com/workers | head -c 120'],
    displayCommand: 'curl -s https://rest.ripplingapis.com/workers',
    expect: /"Incorrect authentication credentials\."/,
    timeoutMs: 30_000,
  },
  {
    // Developer-docs llms.txt that scopes the current API surface for agents.
    probeId: 'dev-llms-txt',
    productId: 'rippling-it',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://developer.rippling.com/llms.txt | head -3'],
    displayCommand: 'curl -s https://developer.rippling.com/llms.txt | head -3',
    expect: /# Rippling Developer Documentation/,
    timeoutMs: 30_000,
  },
  {
    // The Directory API's discovery document is fetchable keyless.
    probeId: 'directory-discovery',
    productId: 'google-workspace',
    storyIds: ['directory-users-api', 'api-machine-spec'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 'https://admin.googleapis.com/$discovery/rest?version=directory_v1' | grep -m1 -o '"title": "Admin SDK API"'`],
    displayCommand: `curl -s 'https://admin.googleapis.com/$discovery/rest?version=directory_v1' | grep '"title"'`,
    expect: /"title": "Admin SDK API"/,
    timeoutMs: 30_000,
  },
  {
    // Honest negative: developers.google.com publishes no llms.txt.
    probeId: 'docs-llms-txt-absent',
    productId: 'google-workspace',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s -o /dev/null -w "HTTP %{http_code}" --max-time 20 https://developers.google.com/llms.txt'],
    displayCommand: 'curl -s -o /dev/null -w "HTTP %{http_code}" https://developers.google.com/llms.txt',
    expect: /HTTP 404/,
    timeoutMs: 30_000,
  },
  {
    // Microsoft Graph's full EDMX metadata answers keyless.
    probeId: 'graph-metadata',
    productId: 'microsoft-entra',
    storyIds: ['directory-users-api', 'api-machine-spec'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 30 'https://graph.microsoft.com/v1.0/$metadata' | head -c 200`],
    displayCommand: `curl -s 'https://graph.microsoft.com/v1.0/$metadata' | head -c 200`,
    expect: /edmx:Edmx/,
    timeoutMs: 45_000,
  },
  {
    // learn.microsoft.com serves a live POST-only MCP endpoint (405 on GET proves it exists).
    probeId: 'learn-mcp-endpoint',
    productId: 'microsoft-entra',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s -o /dev/null -w "HTTP %{http_code}" --max-time 20 https://learn.microsoft.com/api/mcp'],
    displayCommand: 'curl -s -o /dev/null -w "HTTP %{http_code}" https://learn.microsoft.com/api/mcp',
    expect: /HTTP 405/,
    timeoutMs: 30_000,
  },
  {
    // Official azuread Terraform provider resolves on the public registry.
    probeId: 'terraform-provider',
    productId: 'microsoft-entra',
    storyIds: ['config-as-code'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://registry.terraform.io/v1/providers/hashicorp/azuread | head -c 200'],
    displayCommand: 'curl -s https://registry.terraform.io/v1/providers/hashicorp/azuread',
    expect: /"id":"hashicorp\/azuread/,
    timeoutMs: 30_000,
  },
]
