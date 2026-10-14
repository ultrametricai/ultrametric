import { CURL_MCP_INIT, type LocalProbe } from './types'

// Transactional email APIs, probed keylessly on the agent-era surfaces the arena judges:
// Resend's full stack (real llms.txt, OpenAPI 3 spec, /.well-known/mcp.json discovery,
// published agent skills, and an mcp.resend.com initialize that answers with its OAuth
// protected-resource challenge — the missive precedent), Postmark's llms.txt AND
// machine-readable pricing.txt, Mailgun's docs llms.txt with an .md-mirrored MCP server page,
// and every vendor's official SDK resolving on the public npm registry (@aws-sdk/client-sesv2
// is the SES-specific client). Honest negative recorded: sendgrid.com/llms.txt is an HTML
// catch-all, not machine docs — the incumbent has no llms.txt. All keyless, read-only.
export const probes: LocalProbe[] = [
  {
    // resend.com/llms.txt is a real agent-oriented index ("For AI agents and automation…").
    probeId: 'site-llms-txt',
    productId: 'resend',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://resend.com/llms.txt | head -3'],
    displayCommand: 'curl -s https://resend.com/llms.txt | head -3',
    expect: /# Resend/,
    timeoutMs: 30_000,
  },
  {
    // A public OpenAPI 3 spec at the vendor root — the machine-readable API contract.
    probeId: 'openapi-spec',
    productId: 'resend',
    storyIds: ['api-machine-spec', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://resend.com/openapi.json | head -c 200'],
    displayCommand: 'curl -s https://resend.com/openapi.json | head -c 200',
    expect: /"openapi": "3\./,
    timeoutMs: 30_000,
  },
  {
    // MCP discovery document at the well-known path.
    probeId: 'mcp-discovery',
    productId: 'resend',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://resend.com/.well-known/mcp.json | head -c 200'],
    displayCommand: 'curl -s https://resend.com/.well-known/mcp.json | head -c 200',
    expect: /"name": "Resend"/,
    timeoutMs: 30_000,
  },
  {
    // The hosted MCP server answers a keyless initialize with its OAuth protected-resource
    // challenge — proof the endpoint exists and speaks the protocol (missive precedent).
    probeId: 'mcp-remote-handshake',
    productId: 'resend',
    storyIds: ['agentic-mcp-server'],
    bin: 'curl',
    argv: ['curl', '-s', '-i', '--max-time', '20', '-X', 'POST', 'https://mcp.resend.com/mcp',
      '-H', 'Content-Type: application/json',
      '-H', 'Accept: application/json, text/event-stream',
      '-d', CURL_MCP_INIT],
    displayCommand: `curl -si -X POST https://mcp.resend.com/mcp -H 'Content-Type: application/json' -d '<jsonrpc initialize>'`,
    expect: /oauth-protected-resource/,
    timeoutMs: 30_000,
  },
  {
    // Published agent skills behind a schema'd discovery index.
    probeId: 'agent-skills-index',
    productId: 'resend',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://resend.com/.well-known/agent-skills/index.json | head -c 200'],
    displayCommand: 'curl -s https://resend.com/.well-known/agent-skills/index.json | head -c 200',
    expect: /schemas\.agentskills\.io/,
    timeoutMs: 30_000,
  },
  {
    // The official Node SDK resolves on the public npm registry.
    probeId: 'npm-version',
    productId: 'resend',
    storyIds: ['agentic-sdks', 'quickstart-first-email'],
    bin: 'npm',
    argv: ['npm', 'view', 'resend', 'version'],
    displayCommand: 'npm view resend version',
    expect: /\d+\.\d+\.\d+/,
    timeoutMs: 60_000,
  },
  {
    // postmarkapp.com/llms.txt is a real docs index.
    probeId: 'site-llms-txt',
    productId: 'postmark',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://postmarkapp.com/llms.txt | head -3'],
    displayCommand: 'curl -s https://postmarkapp.com/llms.txt | head -3',
    expect: /# Postmark/,
    timeoutMs: 30_000,
  },
  {
    // Machine-readable pricing at pricing.txt — pricing transparency an agent can read.
    probeId: 'pricing-txt',
    productId: 'postmark',
    storyIds: ['public-pricing-clarity', 'agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://postmarkapp.com/pricing.txt | head -3'],
    displayCommand: 'curl -s https://postmarkapp.com/pricing.txt | head -3',
    expect: /# Postmark Pricing/,
    timeoutMs: 30_000,
  },
  {
    // The official SDK (maintained by ActiveCampaign) resolves on npm.
    probeId: 'npm-version',
    productId: 'postmark',
    storyIds: ['agentic-sdks'],
    bin: 'npm',
    argv: ['npm', 'view', 'postmark', 'version'],
    displayCommand: 'npm view postmark version',
    expect: /\d+\.\d+\.\d+/,
    timeoutMs: 60_000,
  },
  {
    // documentation.mailgun.com serves a docs-map llms.txt whose first section links the
    // MCP server page.
    probeId: 'docs-llms-txt',
    productId: 'mailgun',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://documentation.mailgun.com/llms.txt | head -3'],
    displayCommand: 'curl -s https://documentation.mailgun.com/llms.txt | head -3',
    expect: /# Mailgun Documentation/,
    timeoutMs: 30_000,
  },
  {
    // The MCP server docs mirror to clean Markdown at the .md URL.
    probeId: 'mcp-docs-md-mirror',
    productId: 'mailgun',
    storyIds: ['agentic-mcp-server', 'agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://documentation.mailgun.com/docs/mailgun/mcp.md | head -3'],
    displayCommand: 'curl -s https://documentation.mailgun.com/docs/mailgun/mcp.md | head -3',
    expect: /# Mailgun MCP Server/,
    timeoutMs: 30_000,
  },
  {
    // The official mailgun.js SDK resolves on npm.
    probeId: 'npm-version',
    productId: 'mailgun',
    storyIds: ['agentic-sdks'],
    bin: 'npm',
    argv: ['npm', 'view', 'mailgun.js', 'version'],
    displayCommand: 'npm view mailgun.js version',
    expect: /\d+\.\d+\.\d+/,
    timeoutMs: 60_000,
  },
  {
    // Deliberate negative: the incumbent's llms.txt URL answers the marketing site's HTML
    // catch-all, not machine docs — recorded as the honest agent-docs gap.
    probeId: 'llms-txt-catch-all',
    productId: 'sendgrid',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://sendgrid.com/llms.txt | head -2'],
    displayCommand: 'curl -s https://sendgrid.com/llms.txt | head -2',
    expect: /<!DOCTYPE HTML>/i,
    timeoutMs: 30_000,
  },
  {
    // The official @sendgrid/mail SDK resolves on npm.
    probeId: 'npm-version',
    productId: 'sendgrid',
    storyIds: ['agentic-sdks'],
    bin: 'npm',
    argv: ['npm', 'view', '@sendgrid/mail', 'version'],
    displayCommand: 'npm view @sendgrid/mail version',
    expect: /\d+\.\d+\.\d+/,
    timeoutMs: 60_000,
  },
  {
    // The SES-specific official AWS SDK v3 client resolves on npm.
    probeId: 'npm-version',
    productId: 'amazon-ses',
    storyIds: ['agentic-sdks'],
    bin: 'npm',
    argv: ['npm', 'view', '@aws-sdk/client-sesv2', 'version'],
    displayCommand: 'npm view @aws-sdk/client-sesv2 version',
    expect: /\d+\.\d+\.\d+/,
    timeoutMs: 60_000,
  },
]
