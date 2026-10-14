import type { LocalProbe } from './types'

// Hyperscaler developer surfaces, probed keylessly on their machine endpoints: every provider's
// official Terraform provider resolves on the public registry with download counts; AWS STS,
// Azure Resource Manager, and OCI's compute API all answer keyless requests with distinctive
// structured auth errors (the exact surfaces agents hit first); Google's Compute discovery
// document and status incidents JSON are fetchable keyless; docs.aws.amazon.com publishes a
// full llms.txt while cloud.google.com/docs and azure.microsoft.com do not (honest negatives —
// cloud.google.com/llms.txt itself soft-200s an HTML page); AWS, Microsoft, Google, and Oracle
// each keep an official MCP server repo with a raw-fetchable README. All keyless, read-only.
// Verified live 2026-09-23.
export const probes: LocalProbe[] = [
  {
    // Official hashicorp/aws provider on the public registry (7.6B+ downloads).
    probeId: 'terraform-provider',
    productId: 'aws',
    storyIds: ['terraform-provider-quality'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://registry.terraform.io/v1/providers/hashicorp/aws | head -c 200'],
    displayCommand: 'curl -s https://registry.terraform.io/v1/providers/hashicorp/aws',
    expect: /"id":"hashicorp\/aws\//,
    timeoutMs: 30_000,
  },
  {
    // STS answers keyless GetCallerIdentity with a structured signed-request error.
    probeId: 'sts-keyless-error',
    productId: 'aws',
    storyIds: ['agentic-public-api', 'agentic-scoped-keys'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 "https://sts.amazonaws.com/?Action=GetCallerIdentity&Version=2011-06-15" | head -c 300'],
    displayCommand: 'curl -s "https://sts.amazonaws.com/?Action=GetCallerIdentity&Version=2011-06-15"',
    expect: /<Code>MissingAuthenticationToken<\/Code>/,
    timeoutMs: 30_000,
  },
  {
    // The AWS docs portal publishes a structured llms.txt for agents.
    probeId: 'docs-llms-txt',
    productId: 'aws',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.aws.amazon.com/llms.txt | head -c 200'],
    displayCommand: 'curl -s https://docs.aws.amazon.com/llms.txt | head -c 200',
    expect: /# Amazon Web Services \(AWS\) Documentation/,
    timeoutMs: 30_000,
  },
  {
    // awslabs/mcp: the official suite of AWS MCP servers, README fetchable raw.
    probeId: 'mcp-servers-readme',
    productId: 'aws',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://raw.githubusercontent.com/awslabs/mcp/main/README.md | head -c 200'],
    displayCommand: 'curl -sL https://raw.githubusercontent.com/awslabs/mcp/main/README.md | head -c 200',
    expect: /# Open source MCP servers for AWS/,
    timeoutMs: 30_000,
  },
  {
    // Official hashicorp/google provider on the public registry.
    probeId: 'terraform-provider',
    productId: 'google-cloud',
    storyIds: ['terraform-provider-quality'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://registry.terraform.io/v1/providers/hashicorp/google | head -c 200'],
    displayCommand: 'curl -s https://registry.terraform.io/v1/providers/hashicorp/google',
    expect: /"id":"hashicorp\/google\//,
    timeoutMs: 30_000,
  },
  {
    // The Compute Engine API discovery document is fetchable keyless (machine-readable spec).
    probeId: 'compute-discovery',
    productId: 'google-cloud',
    storyIds: ['api-machine-spec', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 https://www.googleapis.com/discovery/v1/apis/compute/v1/rest | grep -m1 -o '"documentationLink": "https://cloud.google.com/compute/"'`],
    displayCommand: `curl -s https://www.googleapis.com/discovery/v1/apis/compute/v1/rest | grep '"documentationLink"'`,
    expect: /"documentationLink": "https:\/\/cloud\.google\.com\/compute\/"/,
    timeoutMs: 30_000,
  },
  {
    // Cloud Status publishes its full incident history as keyless JSON.
    probeId: 'status-incidents-json',
    productId: 'google-cloud',
    storyIds: ['status-incident-transparency'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://status.cloud.google.com/incidents.json | head -c 120'],
    displayCommand: 'curl -s https://status.cloud.google.com/incidents.json | head -c 120',
    expect: /\[\{"id":/,
    timeoutMs: 30_000,
  },
  {
    // Honest negative: the Google Cloud docs portal publishes no llms.txt (404 after redirect).
    probeId: 'docs-llms-txt-absent',
    productId: 'google-cloud',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL -o /dev/null -w "HTTP %{http_code}" --max-time 20 https://cloud.google.com/docs/llms.txt'],
    displayCommand: 'curl -sL -o /dev/null -w "HTTP %{http_code}" https://cloud.google.com/docs/llms.txt',
    expect: /HTTP 404/,
    timeoutMs: 30_000,
  },
  {
    // Official hashicorp/azurerm provider on the public registry.
    probeId: 'terraform-provider',
    productId: 'azure',
    storyIds: ['terraform-provider-quality'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://registry.terraform.io/v1/providers/hashicorp/azurerm | head -c 200'],
    displayCommand: 'curl -s https://registry.terraform.io/v1/providers/hashicorp/azurerm',
    expect: /"id":"hashicorp\/azurerm\//,
    timeoutMs: 30_000,
  },
  {
    // Azure Resource Manager answers keyless with a structured JSON auth error.
    probeId: 'arm-keyless-error',
    productId: 'azure',
    storyIds: ['agentic-public-api', 'agentic-scoped-keys'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 "https://management.azure.com/subscriptions?api-version=2022-12-01" | head -c 200'],
    displayCommand: 'curl -s "https://management.azure.com/subscriptions?api-version=2022-12-01"',
    expect: /"code":"AuthenticationFailed"/,
    timeoutMs: 30_000,
  },
  {
    // The official Azure MCP Server lives in microsoft/mcp (Azure/azure-mcp is archived).
    probeId: 'mcp-server-readme',
    productId: 'azure',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://raw.githubusercontent.com/microsoft/mcp/main/servers/Azure.Mcp.Server/README.md | head -c 600'],
    displayCommand: 'curl -sL https://raw.githubusercontent.com/microsoft/mcp/main/servers/Azure.Mcp.Server/README.md | head -c 600',
    expect: /Azure MCP Server/,
    timeoutMs: 30_000,
  },
  {
    // Honest negative: azure.microsoft.com publishes no llms.txt.
    probeId: 'site-llms-txt-absent',
    productId: 'azure',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s -o /dev/null -w "HTTP %{http_code}" --max-time 20 https://azure.microsoft.com/llms.txt'],
    displayCommand: 'curl -s -o /dev/null -w "HTTP %{http_code}" https://azure.microsoft.com/llms.txt',
    expect: /HTTP 404/,
    timeoutMs: 30_000,
  },
  {
    // Official oracle/oci provider on the public registry.
    probeId: 'terraform-provider',
    productId: 'oracle-cloud',
    storyIds: ['terraform-provider-quality'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://registry.terraform.io/v1/providers/oracle/oci | head -c 200'],
    displayCommand: 'curl -s https://registry.terraform.io/v1/providers/oracle/oci',
    expect: /"id":"oracle\/oci\//,
    timeoutMs: 30_000,
  },
  {
    // The OCI compute API answers keyless with a structured NotAuthenticated JSON error.
    probeId: 'iaas-keyless-error',
    productId: 'oracle-cloud',
    storyIds: ['agentic-public-api', 'agentic-scoped-keys'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://iaas.us-ashburn-1.oraclecloud.com/20160918/instances | head -c 200'],
    displayCommand: 'curl -s https://iaas.us-ashburn-1.oraclecloud.com/20160918/instances',
    expect: /"code" : "NotAuthenticated"/,
    timeoutMs: 30_000,
  },
  {
    // OCI's status page exposes a keyless statuspage-style JSON API.
    probeId: 'status-api-json',
    productId: 'oracle-cloud',
    storyIds: ['status-incident-transparency'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://ocistatus.oraclecloud.com/api/v2/status.json | head -c 200'],
    displayCommand: 'curl -s https://ocistatus.oraclecloud.com/api/v2/status.json',
    expect: /"name" : "OCI"/,
    timeoutMs: 30_000,
  },
  {
    // oracle/mcp: Oracle's official MCP server repo, README fetchable raw.
    probeId: 'mcp-server-readme',
    productId: 'oracle-cloud',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://raw.githubusercontent.com/oracle/mcp/main/README.md | head -c 200'],
    displayCommand: 'curl -sL https://raw.githubusercontent.com/oracle/mcp/main/README.md | head -c 200',
    expect: /# Oracle MCP Server Repository/,
    timeoutMs: 30_000,
  },
]
