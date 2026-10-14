import type { LocalProbe } from './types'

// Applicant tracking systems, probed keylessly on the surfaces hiring agents actually touch:
// the famously keyless public job-board APIs (Greenhouse boards-api, Lever postings v0, Ashby
// posting-api, Workable apply API, Recruitee careers-site API — all probed against real live
// boards), Ashby's keyless OpenAPI 3.1 spec and agent-skills discovery document, and the
// llms.txt story across the roster (greenhouse.com, ashby both domains, workable both domains,
// docs.recruitee.com all 200; lever.co recorded as an honest 404 negative). All keyless,
// read-only. Verified live 2026-09-22.
export const probes: LocalProbe[] = [
  {
    // The keyless Job Board API that made Greenhouse the ATS integrations write against.
    probeId: 'job-board-api',
    productId: 'greenhouse',
    storyIds: ['hosted-careers-page', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://boards-api.greenhouse.io/v1/boards/greenhouse/jobs | head -c 200'],
    displayCommand: 'curl -s https://boards-api.greenhouse.io/v1/boards/greenhouse/jobs',
    expect: /"jobs":\[\{"absolute_url"/,
    timeoutMs: 30_000,
  },
  {
    // greenhouse.com publishes an llms.txt (the dev-docs domain does not — kept honest here).
    probeId: 'site-llms-txt',
    productId: 'greenhouse',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://www.greenhouse.com/llms.txt | head -3'],
    displayCommand: 'curl -s https://www.greenhouse.com/llms.txt | head -3',
    expect: /Official Information About Greenhouse/,
    timeoutMs: 30_000,
  },
  {
    // Lever's keyless postings API serves any customer's public jobs as JSON.
    probeId: 'postings-api',
    productId: 'lever',
    storyIds: ['hosted-careers-page', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 'https://api.lever.co/v0/postings/palantir?mode=json' | head -c 200`],
    displayCommand: `curl -s 'https://api.lever.co/v0/postings/palantir?mode=json'`,
    expect: /\[\{"additionalPlain"/,
    timeoutMs: 30_000,
  },
  {
    // Honest negative: lever.co publishes no llms.txt.
    probeId: 'site-llms-txt-absent',
    productId: 'lever',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s -o /dev/null -w "HTTP %{http_code}" --max-time 20 https://www.lever.co/llms.txt'],
    displayCommand: 'curl -s -o /dev/null -w "HTTP %{http_code}" https://www.lever.co/llms.txt',
    expect: /HTTP 404/,
    timeoutMs: 30_000,
  },
  {
    // Ashby's keyless public job-board API, probed against Ashby's own live board.
    probeId: 'job-board-api',
    productId: 'ashby',
    storyIds: ['hosted-careers-page', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://api.ashbyhq.com/posting-api/job-board/ashby | head -c 200'],
    displayCommand: 'curl -s https://api.ashbyhq.com/posting-api/job-board/ashby',
    expect: /"jobs":\[\{"id"/,
    timeoutMs: 30_000,
  },
  {
    // The only keyless OpenAPI spec in the arena — 1.1MB of OpenAPI 3.1.
    probeId: 'openapi-spec',
    productId: 'ashby',
    storyIds: ['api-machine-spec'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 30 https://developers.ashbyhq.com/openapi/ashby-api.json | head -c 120'],
    displayCommand: 'curl -s https://developers.ashbyhq.com/openapi/ashby-api.json | head -c 120',
    expect: /"openapi":"3\.1\.0"/,
    timeoutMs: 45_000,
  },
  {
    // llms.txt on the docs domain, with .md mirrors documented in its own header.
    probeId: 'docs-llms-txt',
    productId: 'ashby',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://developers.ashbyhq.com/llms.txt | head -3'],
    displayCommand: 'curl -s https://developers.ashbyhq.com/llms.txt | head -3',
    expect: /# Ashby Documentation/,
    timeoutMs: 30_000,
  },
  {
    // agentskills.io discovery document — the newest agent-docs surface in the roster.
    probeId: 'agent-skills-discovery',
    productId: 'ashby',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://developers.ashbyhq.com/.well-known/agent-skills/index.json | head -c 200'],
    displayCommand: 'curl -s https://developers.ashbyhq.com/.well-known/agent-skills/index.json',
    expect: /agentskills\.io/,
    timeoutMs: 30_000,
  },
  {
    // Workable's keyless public jobs API (v3 accounts endpoint, POST with empty filter).
    probeId: 'public-jobs-api',
    productId: 'workable',
    storyIds: ['hosted-careers-page', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', `curl -s --max-time 20 -X POST https://apply.workable.com/api/v3/accounts/blueground/jobs -H 'Content-Type: application/json' -d '{}' | head -c 200`],
    displayCommand: `curl -s -X POST https://apply.workable.com/api/v3/accounts/blueground/jobs -H 'Content-Type: application/json' -d '{}'`,
    expect: /"total":\d+,"results":\[/,
    timeoutMs: 30_000,
  },
  {
    // README-hosted docs llms.txt with the append-.md mirror instruction.
    probeId: 'docs-llms-txt',
    productId: 'workable',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://workable.readme.io/llms.txt | head -3'],
    displayCommand: 'curl -s https://workable.readme.io/llms.txt | head -3',
    expect: /# Workable Documentation/,
    timeoutMs: 30_000,
  },
  {
    // Recruitee's keyless per-company careers-site API (bunq's live board).
    probeId: 'careers-site-api',
    productId: 'recruitee',
    storyIds: ['hosted-careers-page', 'agentic-public-api'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -s --max-time 20 https://bunq.recruitee.com/api/offers/ | head -c 120'],
    displayCommand: 'curl -s https://bunq.recruitee.com/api/offers/',
    expect: /\{"offers":\[\{/,
    timeoutMs: 30_000,
  },
  {
    // docs.recruitee.com llms.txt (the marketing root has none — docs domain carries it).
    probeId: 'docs-llms-txt',
    productId: 'recruitee',
    storyIds: ['agentic-agent-docs'],
    bin: 'curl',
    argv: ['sh', '-c', 'curl -sL --max-time 20 https://docs.recruitee.com/llms.txt | head -3'],
    displayCommand: 'curl -s https://docs.recruitee.com/llms.txt | head -3',
    expect: /# Recruitee Documentation/,
    timeoutMs: 30_000,
  },
]
