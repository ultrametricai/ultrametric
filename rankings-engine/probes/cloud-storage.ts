import type { LocalProbe } from './types'

// Cloud storage platforms, probed keylessly on their machine surfaces: Dropbox's API v2
// answers a keyless POST with a structured per-endpoint error and dropbox.com publishes an
// llms.txt; Google Drive v3 serves its full discovery document keyless and a clean structured
// 403 on the files collection; Box's API answers a distinctive Bearer challenge, developer.box.com
// publishes an llms.txt, and mcp.box.com serves keyless OAuth protected-resource metadata for its
// hosted MCP server; Microsoft Graph answers a structured keyless error on /me/drive and Learn
// serves the driveItem delta reference. Honest negatives recorded: www.box.com/pricing sits
// behind a Cloudflare challenge and microsoft.com's OneDrive plans page bot-walls keyless curl,
// so neither pricing page is machine-readable. All keyless, read-only. Verified live 2026-09-23.
export const probes: LocalProbe[] = [
  {
    // API v2 answers a keyless POST with a structured, endpoint-specific error string.
    probeId: 'api-keyless-error',
    productId: 'dropbox',
    storyIds: ['agentic-public-api', 'files-upload-download-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s -X POST --max-time 20 https://api.dropboxapi.com/2/files/list_folder | head -c 200'],
    displayCommand: 'curl -s -X POST https://api.dropboxapi.com/2/files/list_folder',
    expect: /Error in call to API function "files\/list_folder"/,
    timeoutMs: 30_000,
  },
  {
    probeId: 'site-llms-txt',
    productId: 'dropbox',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://www.dropbox.com/llms.txt | head -3'],
    displayCommand: 'curl -s https://www.dropbox.com/llms.txt | head -3',
    expect: /# Dropbox/,
    timeoutMs: 30_000,
  },
  {
    // Official `dropbox` JS SDK resolves on the public npm registry.
    probeId: 'npm-sdk',
    productId: 'dropbox',
    storyIds: ['agentic-sdks'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://registry.npmjs.org/dropbox | head -c 200'],
    displayCommand: 'curl -s https://registry.npmjs.org/dropbox | head -c 200',
    expect: /"name":"dropbox"/,
    timeoutMs: 30_000,
  },
  {
    // The Drive v3 discovery document is fetchable keyless.
    probeId: 'discovery-doc',
    productId: 'google-drive',
    storyIds: ['api-machine-spec', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 https://www.googleapis.com/discovery/v1/apis/drive/v3/rest | grep -m1 -o '"id": "drive:v3"'`],
    displayCommand: `curl -s https://www.googleapis.com/discovery/v1/apis/drive/v3/rest | grep '"id"'`,
    expect: /"id": "drive:v3"/,
    timeoutMs: 30_000,
  },
  {
    // The files collection answers keyless with a clean structured 403.
    probeId: 'api-keyless-error',
    productId: 'google-drive',
    storyIds: ['files-upload-download-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://www.googleapis.com/drive/v3/files | head -c 300'],
    displayCommand: 'curl -s https://www.googleapis.com/drive/v3/files',
    expect: /Method doesn't allow unregistered callers/,
    timeoutMs: 30_000,
  },
  {
    // Official @googleapis/drive client resolves on the public npm registry.
    probeId: 'npm-sdk',
    productId: 'google-drive',
    storyIds: ['agentic-sdks'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://registry.npmjs.org/@googleapis%2Fdrive | head -c 200'],
    displayCommand: 'curl -s https://registry.npmjs.org/@googleapis%2Fdrive | head -c 200',
    expect: /"name":"@googleapis\/drive"/,
    timeoutMs: 30_000,
  },
  {
    // The Box API answers keyless with a distinctive Bearer challenge header (body is empty).
    probeId: 'api-keyless-401',
    productId: 'box',
    storyIds: ['agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s -D - -o /dev/null --max-time 20 https://api.box.com/2.0/users/me | head -c 400'],
    displayCommand: 'curl -s -D - -o /dev/null https://api.box.com/2.0/users/me',
    expect: /error_description="The access token was not found\."/,
    timeoutMs: 30_000,
  },
  {
    probeId: 'dev-llms-txt',
    productId: 'box',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://developer.box.com/llms.txt | head -3'],
    displayCommand: 'curl -s https://developer.box.com/llms.txt | head -3',
    expect: /# Box Dev Docs/,
    timeoutMs: 30_000,
  },
  {
    // Box's hosted MCP server serves keyless OAuth protected-resource metadata naming itself.
    probeId: 'mcp-oauth-metadata',
    productId: 'box',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://mcp.box.com/.well-known/oauth-protected-resource | head -c 300'],
    displayCommand: 'curl -s https://mcp.box.com/.well-known/oauth-protected-resource',
    expect: /"resource_name": "Box Model Context Protocol Server"/,
    timeoutMs: 30_000,
  },
  {
    // Honest negative: www.box.com/pricing sits behind a Cloudflare challenge, so the
    // published prices are not machine-readable keyless (we match the wall text itself).
    probeId: 'pricing-bot-wall',
    productId: 'box',
    storyIds: ['storage-pricing-transparency'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://www.box.com/pricing | head -c 200'],
    displayCommand: 'curl -sL https://www.box.com/pricing | head -c 200',
    expect: /Just a moment\.\.\./,
    timeoutMs: 30_000,
  },
  {
    // Microsoft Graph answers /me/drive keyless with a structured JSON error.
    probeId: 'graph-keyless-error',
    productId: 'onedrive',
    storyIds: ['agentic-public-api', 'files-upload-download-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://graph.microsoft.com/v1.0/me/drive | head -c 200'],
    displayCommand: 'curl -s https://graph.microsoft.com/v1.0/me/drive',
    expect: /"code":"InvalidAuthenticationToken"/,
    timeoutMs: 30_000,
  },
  {
    // The driveItem delta reference (change tracking for OneDrive files) serves keyless.
    probeId: 'delta-doc',
    productId: 'onedrive',
    storyIds: ['delta-change-listing'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -sL --max-time 20 'https://learn.microsoft.com/en-us/graph/api/driveitem-delta?view=graph-rest-1.0' | grep -m1 -o '<title>[^<]*'`],
    displayCommand: `curl -sL 'https://learn.microsoft.com/en-us/graph/api/driveitem-delta?view=graph-rest-1.0' | grep '<title>'`,
    expect: /driveItem: delta - Microsoft Graph v1\.0/,
    timeoutMs: 30_000,
  },
  {
    // Official Microsoft Graph JS client resolves on the public npm registry.
    probeId: 'npm-sdk',
    productId: 'onedrive',
    storyIds: ['agentic-sdks'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://registry.npmjs.org/@microsoft%2Fmicrosoft-graph-client | head -c 200'],
    displayCommand: 'curl -s https://registry.npmjs.org/@microsoft%2Fmicrosoft-graph-client | head -c 200',
    expect: /"name":"@microsoft\/microsoft-graph-client"/,
    timeoutMs: 30_000,
  },
  {
    // Honest negative: microsoft.com's OneDrive plans page bot-walls keyless curl, so the
    // published consumer prices are not machine-readable keyless (we match the wall title).
    probeId: 'pricing-bot-wall',
    productId: 'onedrive',
    storyIds: ['storage-pricing-transparency'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -sL --max-time 20 https://www.microsoft.com/en-us/microsoft-365/onedrive/compare-onedrive-plans | grep -m1 -o '<title>[^<]*' | head -c 120`],
    displayCommand: `curl -sL https://www.microsoft.com/en-us/microsoft-365/onedrive/compare-onedrive-plans | grep '<title>'`,
    expect: /Your request has been blocked/,
    timeoutMs: 30_000,
  },
  {
    // Honest negative: developers.google.com publishes no llms.txt (404) — recorded absence
    // from the 2026-09-23 depth spike over the Drive docs surface.
    probeId: 'docs-llms-txt-absent',
    productId: 'google-drive',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL -o /dev/null -w "HTTP %{http_code}" --max-time 20 https://developers.google.com/llms.txt'],
    displayCommand: 'curl -sL -o /dev/null -w "HTTP %{http_code}" https://developers.google.com/llms.txt',
    expect: /HTTP 404/,
    timeoutMs: 30_000,
  },
  {
    // Honest negative: learn.microsoft.com publishes no llms.txt (404 after the locale
    // redirect) — recorded absence from the 2026-09-23 depth spike over the Graph docs surface.
    probeId: 'docs-llms-txt-absent',
    productId: 'onedrive',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL -o /dev/null -w "HTTP %{http_code}" --max-time 20 https://learn.microsoft.com/llms.txt'],
    displayCommand: 'curl -sL -o /dev/null -w "HTTP %{http_code}" https://learn.microsoft.com/llms.txt',
    expect: /HTTP 404/,
    timeoutMs: 30_000,
  },
]
