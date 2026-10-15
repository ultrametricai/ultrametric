import type { LocalProbe } from './types'

// Virtual mailbox services, probed keylessly on the arena's honest question: does mail have
// an agent surface at all? Stable does — a real llms.txt on the marketing site AND a docs
// llms.txt fronting its Mail Items/Checks/Webhooks API. VirtualPostMail's API gateway answers
// a keyless request with a structured JSON 401 (the endpoint exists; auth is the only gate),
// while its marketing site 404s llms.txt — both recorded. Earth Class Mail's deliberate
// negatives document the LegalZoom absorption: its feature pages 301 to legalzoom.com and its
// llms.txt URL answers an HTML catch-all. Anytime Mailbox's llms.txt 404 completes the honest
// low. All keyless, read-only.
export const probes: LocalProbe[] = [
  {
    // The marketing site serves a real llms.txt index.
    probeId: 'site-llms-txt',
    productId: 'stable',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://www.usestable.com/llms.txt | head -2'],
    displayCommand: 'curl -s https://www.usestable.com/llms.txt | head -2',
    expect: /usestable\.com llms\.txt/,
    timeoutMs: 30_000,
  },
  {
    // The developer docs ship their own llms.txt fronting the Stable API.
    probeId: 'docs-llms-txt',
    productId: 'stable',
    storyIds: ['agentic-agent-docs', 'mail-items-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.usestable.com/llms.txt | head -2'],
    displayCommand: 'curl -s https://docs.usestable.com/llms.txt | head -2',
    expect: /# Stable Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Every docs page mirrors to Markdown — here the MailItem object, the core API resource.
    probeId: 'docs-md-mirror',
    productId: 'stable',
    storyIds: ['mail-items-api', 'agentic-public-api'],
    // The .md mirror opens with frontmatter + an llms.txt index pointer before the content,
    // so grep the body for the resource name instead of matching a head slice.
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.usestable.com/docs/the-mail-item-object.md | grep -m1 -o "MailItem represents a physical piece of mail"'],
    displayCommand: 'curl -s https://docs.usestable.com/docs/the-mail-item-object.md | grep -m1 -o "MailItem represents a physical piece of mail"',
    expect: /MailItem represents a physical piece of mail/,
    timeoutMs: 30_000,
  },
  {
    // Webhook docs mirror to Markdown — new-mail events are a documented first-party surface.
    probeId: 'webhooks-docs-md',
    productId: 'stable',
    storyIds: ['new-mail-webhooks', 'agentic-webhooks'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.usestable.com/docs/webhooks.md | grep -m1 -io "webhook" '],
    displayCommand: 'curl -s https://docs.usestable.com/docs/webhooks.md | grep -m1 -io webhook',
    expect: /webhook/i,
    timeoutMs: 30_000,
  },
  {
    // The API gateway exists and answers keyless requests with a structured JSON 401 —
    // the documented VPM API is real; auth is the only gate.
    probeId: 'api-auth-challenge',
    productId: 'virtualpostmail',
    storyIds: ['mail-items-api', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s -i --max-time 20 https://api.virtualpostmail.com | head -8'],
    displayCommand: 'curl -si https://api.virtualpostmail.com | head -8',
    expect: /401[\s\S]*Unauthorized/,
    timeoutMs: 30_000,
  },
  {
    // Deliberate negative: no llms.txt on the marketing site (404) — no machine docs surface.
    probeId: 'llms-txt-404',
    productId: 'virtualpostmail',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s -o /dev/null -w "HTTP %{http_code}" --max-time 20 https://www.virtualpostmail.com/llms.txt'],
    displayCommand: 'curl -s -o /dev/null -w "HTTP %{http_code}" https://www.virtualpostmail.com/llms.txt',
    expect: /HTTP 404/,
    timeoutMs: 30_000,
  },
  {
    // Deliberate negative recording the LegalZoom absorption: the ECM feature pages 301 off
    // the vendor domain to legalzoom.com's LZ Virtual Mail overview.
    probeId: 'legalzoom-redirect',
    productId: 'earth-class-mail',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s -o /dev/null -w "HTTP %{http_code} %{url_effective}" -L --max-time 20 https://www.earthclassmail.com/how-it-works'],
    displayCommand: 'curl -s -o /dev/null -w "HTTP %{http_code} %{url_effective}" -L https://www.earthclassmail.com/how-it-works',
    expect: /HTTP 200 https:\/\/www\.legalzoom\.com\//,
    timeoutMs: 30_000,
  },
  {
    // Deliberate negative: no llms.txt (404) — Anytime Mailbox has no machine docs surface.
    probeId: 'llms-txt-404',
    productId: 'anytime-mailbox',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s -o /dev/null -w "HTTP %{http_code}" --max-time 20 https://www.anytimemailbox.com/llms.txt'],
    displayCommand: 'curl -s -o /dev/null -w "HTTP %{http_code}" https://www.anytimemailbox.com/llms.txt',
    expect: /HTTP 404/,
    timeoutMs: 30_000,
  },
]
