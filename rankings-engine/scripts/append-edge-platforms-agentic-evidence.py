#!/usr/bin/env python3
# Hot-repos fairness wave (2026-09-15), edge-platforms lane: the identical supplement recipe to
# append-payments-stripe-agentic-evidence.py / append-payments-fairness-agentic-evidence.py, for
# vercel and cloudflare. This wave's crawl added 20 vercel + 16 cloudflare agent-surface
# urls.extra pages; the monotonic extract runs surfaced +18 / +25 mostly one-line items. The
# verbatim passages below are content those crawled/verified pages contain that the per-source
# extraction caps and the 40-story quota starved out of the packs.
#
# Every URL below is in that product's products.json urls (or is the live endpoint a probe
# verifies); every excerpt quotes the crawled/live page (live-checked 2026-09-15, the same day
# the crawl ran; recon copies under /tmp/pa-edge-recon at authoring time).
#
# Verified-honest counterparts (NO doc items added, on purpose):
#   - vercel: Vercel MCP has NO keyless mode — a bare JSON-RPC initialize gets HTTP 401
#     (vercel-probe-5), and the docs state "Vercel MCP only supports AI clients that have been
#     reviewed and approved by Vercel" (quoted with that restriction intact). Vercel Agent is
#     quoted with its public-beta + Pro/Enterprise availability intact. eve is quoted as Beta.
#   - cloudflare: no in-dashboard AI assistant page was found on the crawled surface — nothing
#     is claimed for one; the ONLY fully keyless Cloudflare MCP verified is the docs server
#     (cloudflare-probe-4); the Code Mode server is OAuth/API-token gated (cloudflare-probe-5),
#     quoted as such. Alpha/Beta labels are kept where the pages carry them.
#   - openness-*/privacy-*: out of this wave's scope; no agent-washing of unrelated axes.
#
# Run AFTER `pnpm engine extract --product <id>` (extraction is monotonic and dedups by
# normalized excerpt, so re-running extract after this keeps these items stable).
import datetime
import json
import subprocess

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

MCP_INIT = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {
    'protocolVersion': '2025-06-18', 'capabilities': {},
    'clientInfo': {'name': 'productarena-probe', 'version': '1.0'}}})

DOC_ITEMS = {
    'vercel': [
        # --- Vercel MCP (extra-2 vercel-mcp.md) ---
        ('vercel-supp-mcp-server', 'https://vercel.com/docs/agent-resources/vercel-mcp.md',
         'Vercel MCP is "Vercel\'s official MCP server. It\'s a remote MCP with OAuth that gives AI tools secure access to your Vercel projects available at: https://mcp.vercel.com", implementing "the latest MCP Authorization and Streamable HTTP specifications". Quick setup is one command: `npx -y add-mcp https://mcp.vercel.com -g`. Access is gated by a client allowlist — "To ensure secure access, Vercel MCP only supports AI clients that have been reviewed and approved by Vercel" — with documented setup for Claude Code, Claude.ai and Claude for desktop, ChatGPT, Codex CLI, Cursor, and other approved clients.'),
        # --- MCP tool inventory (extra-3 vercel-mcp/tools.md) ---
        ('vercel-supp-mcp-tools', 'https://vercel.com/docs/agent-resources/vercel-mcp/tools.md',
         'The documented Vercel MCP tool inventory spans docs, projects, deployments, observability, analytics, agent observability, and domain purchases: `search_vercel_documentation`; `list_teams`/`list_projects`/`get_project`; `list_deployments`/`get_deployment`/`get_deployment_build_logs` ("Use `errorsOnly` to return only failing lines"); `get_runtime_logs` and `get_runtime_errors` ("grouped runtime error clusters... error name, occurrence count, affected routes, sample messages... Time ranges can span up to 7 days"); `deploy_to_vercel`; `get_web_analytics` ("query visitors, page views, and custom events"); Agent Runs observability tools (`list_agent_run_projects`, `list_agent_runs`, `get_agent_run`, `get_agent_run_trace` — "including turns, messages, reasoning, tool calls, token usage... to debug exact agent behavior in production"); and `check_domain_availability_and_price` plus `buy_domain` purchase tools. Each tool documents parameters and a sample prompt.'),
        # --- Agent plugin (extra-4 vercel-plugin.md) ---
        ('vercel-supp-plugin', 'https://vercel.com/docs/agent-resources/vercel-plugin.md',
         'The Vercel plugin (`npx plugins add vercel/vercel-plugin`) "gives supported AI coding tools Vercel-specific context, skills, agents, and slash commands" — an "Ecosystem graph" ("A relational knowledge graph covering every Vercel product, library, CLI, API, and service, with decision matrices and cross-product workflows"), 28 skills, and slash commands like `/vercel-plugin:nextjs`, `/vercel-plugin:ai-sdk`, and `/vercel-plugin:deploy prod`. Supported tools: Claude Code, OpenAI Codex, Grok Build, Cursor, GitHub Copilot, and Kimi Code. "The default installation keeps automation lightweight and activates session-start context only in empty directories and detected Vercel or Next.js projects."'),
        # --- Skills ecosystem (extra-5 skills.md) ---
        ('vercel-supp-skills', 'https://vercel.com/docs/agent-resources/skills.md',
         'Vercel publishes an official directory of agent skills: "An agent skill is a packaged capability that extends an AI agent with a specific, production ready behavior such as data access, automation, or domain logic... Install any skill using the skills CLI: `npx skills add <owner/repo>`... Skills work with 18+ AI agents including Claude Code, GitHub Copilot, Cursor, Cline, and many others." The skills CLI auto-detects eve projects and offers to install skills for the eve building agent.'),
        # --- Machine-readable onboarding playbook (extra-6 get-started.md) ---
        ('vercel-supp-agent-playbook', 'https://vercel.com/get-started.md',
         'vercel.com/get-started.md is an agent-executable onboarding playbook with machine frontmatter (`name: vercel-get-started`, `supported_surfaces: [cli, plugin, skills, mcp]`, runtimes listing Claude Code, Cursor, Codex CLI, VS Code with Copilot, Windsurf, Gemini CLI): "Hand your coding agent this playbook to set up Vercel: install the CLI, add Vercel platform guidance, and connect the official Vercel MCP server once for use across projects." It instructs the agent to act, not paraphrase: "Perform actions yourself when terminal or file access is available... Pause only for user authentication, approval, or UI actions you cannot perform. Do not merely return commands for the user to copy."'),
        # --- CLI agent guidance generator (extra-8 cli.md + extra-9 cli/agent.md) ---
        ('vercel-supp-cli-agent-init', 'https://vercel.com/docs/cli/agent.md',
         '`vercel agent init` "writes a section related to Vercel deployment best practices in your project\'s agent guidance file so coding agents and assistants have context for how the project should build, deploy, and integrate with Vercel features. The section is wrapped in `<!-- VERCEL BEST PRACTICES START -->` and `<!-- VERCEL BEST PRACTICES END -->` markers so it can be re-applied non-destructively. The target file is `AGENTS.md` by default; when run from Claude Code, the target is `CLAUDE.md`." A sibling `vercel skills` command "Discover[s] agent skills relevant to your project".'),
        # --- Scoped tokens (extra-10 access-tokens.md) ---
        ('vercel-supp-scoped-tokens', 'https://vercel.com/docs/accounts/access-tokens.md',
         'Vercel access tokens are scope-limited by construction: "Every token carries a scope that determines which resources it can reach", with three documented scoping levels (personal account, team, project). "A project-scoped token denies any request to another project, to a user-level resource, or to a team-level resource. This keeps jobs, tools, and workflows constrained to the projects they need rather than granting them the entire team or your full account."'),
        # --- Webhooks (extra-11 webhooks.md) ---
        ('vercel-supp-webhooks', 'https://vercel.com/docs/webhooks.md',
         'Vercel webhooks deliver platform events as HTTP POSTs with a documented JSON envelope (`id`, `type`, `createdAt`, `payload`, `region`): deployment events ("Deployment Created... Deployment Succeeded... Deployment Promoted... Deployment Rollback... Deployment Error... Deployment Cancelled"), project events (project created/removed), and a documented supported-event-type list with per-event payloads in the webhooks API reference.'),
        # --- Built-in assistant (extra-15 agent.md) ---
        ('vercel-supp-vercel-agent', 'https://vercel.com/docs/agent.md',
         'Vercel Agent "is an AI assistant built into Vercel. Use it to understand your projects, investigate production issues, review code, and take approved actions... Vercel Agent uses context from your Vercel projects, deployments, logs, metrics, configuration, usage, and connected repositories. It can use secure sandboxes to reproduce issues, validate generated code, and run checks before suggested changes reach production." Availability: "Chat in Slack, dashboard chat, Investigations, and Code Review are in public beta for Pro and Enterprise teams."'),
        # --- Agent framework + agent-run observability (extra-16 eve.md, extra-3 tools.md) ---
        ('vercel-supp-eve-agent-runs', 'https://vercel.com/docs/eve.md',
         '"Build durable backend AI agents with eve, an open-source, filesystem-first framework. Agent files compile into an app that runs locally or on Vercel" (Beta). Agent Runs are "the observability layer for agents built with the eve framework on Vercel", exposed through both the Vercel MCP and CLI — list runs, inspect one run, and "Get the trace for a single eve Agent Run, including turns, messages, reasoning, tool calls, token usage".'),
        # --- AI Gateway + Workflows + Sandbox as the agent runtime stack (extra-14/17/13) ---
        ('vercel-supp-agent-runtime-stack', 'https://vercel.com/docs/ai-gateway.md',
         'The documented agent runtime stack: AI Gateway — "Use one managed gateway from any infrastructure to centralize credentials, log requests, control spend, and fail over across providers" with "no markup on token prices" (llms.txt); Vercel Workflows — "runs multi-step logic as durable code that can retry failed steps, wait for external events, and resume across crashes and deployments"; Vercel Sandbox — "Run untrusted or agent-generated code in isolated Linux microVMs. Use Vercel Sandbox for agent workflows, debugging, and one-off commands."'),
        # --- Machine-legible docs + agent guidance (extra-1 llms.txt, verified by vercel-probe-1) ---
        ('vercel-supp-llms-agent-guidance', 'https://vercel.com/llms.txt',
         'Vercel\'s llms.txt ships explicit per-agent guidance: "How agents should use Vercel — For research, fetch the Markdown documentation indexes below and follow their links to individual Markdown pages. For REST API calls, read the OpenAPI description and authentication documentation before choosing an operation. Ask for approval before changing account resources. For Vercel MCP, use an OAuth-capable MCP client and let the user authorize access to their Vercel account." It links the full corpus (docs/llms-full.txt), the REST API OpenAPI description (openapi.vercel.sh), a documentation sitemap, a product taxonomy JSON, a documentation graph JSON, and an experimental /.well-known/ai-catalog.json agent resource catalog.'),
    ],
    'cloudflare': [
        # --- Managed remote MCP fleet (extra-9 mcp-server-cloudflare README + extra-8 docs page) ---
        ('cloudflare-supp-mcp-fleet', 'https://raw.githubusercontent.com/cloudflare/mcp-server-cloudflare/HEAD/README.md',
         'Cloudflare operates a fleet of managed remote MCP servers, "allowing you to connect to Cloudflare\'s service from an MCP client (e.g. Cursor, Claude) and use natural language to accomplish tasks through your Cloudflare account". Documented server URLs: the Code Mode server (mcp.cloudflare.com/mcp, recommended), Documentation (docs.mcp.cloudflare.com/mcp), Workers Bindings (bindings.mcp.cloudflare.com/mcp), Workers Builds (builds.mcp.cloudflare.com/mcp), Observability (observability.mcp.cloudflare.com/mcp), Container sandbox (containers.mcp.cloudflare.com/mcp), Browser Run (browser.mcp.cloudflare.com/mcp), Logpush (logs.mcp.cloudflare.com/mcp), AI Gateway (ai-gateway.mcp.cloudflare.com/mcp), AutoRAG (autorag.mcp.cloudflare.com/mcp), Audit Logs (auditlogs.mcp.cloudflare.com/mcp), DNS Analytics (dns-analytics.mcp.cloudflare.com/mcp), DEX (dex.mcp.cloudflare.com/mcp), CASB (casb.mcp.cloudflare.com/mcp), Radar (radar.mcp.cloudflare.com/mcp), and Blog (blog.mcp.cloudflare.com/mcp). "Every server in this repository exposes the same stateless Streamable HTTP handler at `/mcp` and `/sse`."'),
        # --- Code Mode MCP (extra-10 cloudflare/mcp README) ---
        ('cloudflare-supp-codemode-mcp', 'https://raw.githubusercontent.com/cloudflare/mcp/HEAD/README.md',
         'The recommended Cloudflare MCP server is "a token-efficient MCP server for the entire Cloudflare API. 2500 endpoints in 1k tokens, powered by Code Mode" — the documented token comparison: "Native MCP (full schemas): 2,594 tools, ~1,170,000 tokens; Native MCP (required params only): ~244,000; Code Mode: 2 tools, ~1,000". Auth is OAuth with permission selection ("you will be redirected to Cloudflare to authorize via OAuth and select the permissions to grant to your agent"), and "For CI/CD or automation, you can create a Cloudflare API token with the permissions you need and pass it as a bearer token in the Authorization header. Both user tokens and account tokens are supported."'),
        # --- Skills plugin (extra-8 servers-for-cloudflare page) ---
        ('cloudflare-supp-skills-plugin', 'https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/index.md',
         'Cloudflare ships an agent plugin: "You can install the Cloudflare Skills plugin, which bundles the Cloudflare MCP servers alongside contextual skills and slash commands for building on Cloudflare. The plugin works with any agent that supports the Agent Skills standard, including Claude Code, OpenCode, OpenAI Codex, and Pi." Documented installs: `/plugin marketplace add cloudflare/skills` (Claude Code), Cursor Marketplace, `npx skills add https://github.com/cloudflare/skills`, or cloning skill folders into each agent\'s skills directory.'),
        # --- Agent setup hub (extra-21 agent-setup) ---
        ('cloudflare-supp-agent-setup', 'https://developers.cloudflare.com/agent-setup/index.md',
         'developers.cloudflare.com/agent-setup is a dedicated onboarding hub: "Cloudflare provides Skills and MCP servers so your agent can seamlessly build on the Cloudflare platform. Pick an agent below to get started" — with step-by-step guides for Claude Code, Codex, Cursor, GitHub Copilot, OpenCode, Windsurf, Visual Studio Code, Command Code, and Bionic, a capability/pricing comparison table, and the note "Every agent listed supports Skills and MCP." Every docs page also carries "Copy as Markdown", "View as Markdown", and "Agent setup" links.'),
        # --- Agents SDK (extra-11 cloudflare/agents README + extra-7 agents/index.md) ---
        ('cloudflare-supp-agents-sdk', 'https://raw.githubusercontent.com/cloudflare/agents/HEAD/README.md',
         'The Agents SDK (`npm install agents`): "Agents are persistent, stateful execution environments for agentic workloads, powered by Cloudflare Durable Objects. Each agent has its own state, storage, and lifecycle — with built-in support for real-time communication, scheduling, AI model calls, MCP, workflows, and more. Agents hibernate when idle and wake on demand. You can run millions of them — one per user, per session, per game room — each costs nothing when inactive." The docs add: "connect chat, voice, email, Slack, and webhooks to a durable agent runtime with Browser, Sandbox, AI Search, MCP, Payments, and other MCP tools... Deploy once and Cloudflare runs your agents across its global network, scaling to tens of millions of instances."'),
        # --- Think harness (extra-19 think) ---
        ('cloudflare-supp-think-harness', 'https://developers.cloudflare.com/agents/harnesses/think/index.md',
         '`@cloudflare/think` is an opinionated agent harness: it "lets you build a stateful AI chat agent — one that streams replies, remembers the conversation, and calls tools — by extending a single base class. You provide a model with `getModel()`, and Think wires up the rest of the chat lifecycle for you: the agentic loop (the model calls tools, reads the results, and keeps going until it has an answer), message persistence, streaming, client tools, stream resumption, and extensions — all backed by Durable Object SQLite. Think works as both a top-level agent... and a sub-agent (a child agent that another agent drives over RPC via `chat()`)." Built-ins include "workspace tools (including bash), custom tools, approvals, MCP tools, code execution, browser tools".'),
        # --- Sandbox SDK (extra-14 sandbox) ---
        ('cloudflare-supp-sandbox-sdk', 'https://developers.cloudflare.com/sandbox/index.md',
         'The Sandbox SDK "enables you to run untrusted code securely in isolated environments. Built on Containers, Sandbox SDK provides a simple API for executing commands, managing files, running background processes, and exposing services — all from your Workers applications. Sandboxes are ideal for building AI agents that need to execute code... Each sandbox runs in its own isolated container with a full Linux environment" — e.g. `const sandbox = getSandbox(env.Sandbox, \'user-123\'); const result = await sandbox.exec(\'python --version\')`.'),
        # --- Agent payments: MPP + x402 (extra-20 + agents llms.txt) ---
        ('cloudflare-supp-agent-payments', 'https://developers.cloudflare.com/agents/tools/payments/mpp/pay-from-agents-sdk/index.md',
         'Cloudflare documents agent payments in BOTH directions: "Use the Cloudflare Agents SDK to pay MPP services. The `mppx` SDK handles payment retries for HTTP requests and Model Context Protocol (MCP) tool calls" (Machine Payments Protocol), with sibling guides to "Accept Machine Payments Protocol (MPP) payments from an origin, Cloudflare Worker route, or Model Context Protocol (MCP) tool" and, for x402, "Charge per tool call in an MCP server using paidTool."'),
        # --- Event subscriptions (extra-18 queues/event-subscriptions) ---
        ('cloudflare-supp-event-subscriptions', 'https://developers.cloudflare.com/queues/event-subscriptions/index.md',
         '"Event subscriptions allow you to receive messages when events occur across your Cloudflare account. Cloudflare products (e.g., KV, Workers AI, Workers) can publish structured events to a queue, which you can then consume with Workers or HTTP pull consumers to build custom workflows, integrations, or logic... An event is a structured record of something happening in your Cloudflare account – like a Workers AI batch request being queued, a Worker build completing, or an R2 bucket being created" — with a documented events-and-schemas catalog per event type.'),
        # --- AI Search (extra-17 ai-search) ---
        ('cloudflare-supp-ai-search', 'https://developers.cloudflare.com/ai-search/index.md',
         'Cloudflare AI Search is "The search primitive for your applications and agents... a managed search service. Index your content and query it with natural language from a Workers binding, REST API, or MCP server. AI Search lets you add search to any application or agent without having to build an entire retrieval infrastructure. Create an instance, give it your data, and search it with natural language."'),
        # --- Machine-legible docs (extra-6 llms.txt + per-product indexes) ---
        ('cloudflare-supp-llms-md-mirrors', 'https://developers.cloudflare.com/llms.txt',
         'The developer docs are fully machine-legible: developers.cloudflare.com/llms.txt indexes the platform where "Each product below links to its own llms.txt, which contains a full index of that product\'s documentation pages" (e.g. workers/llms.txt, agents/llms.txt); a whole-corpus llms-full.txt exists; per-product index pages carry "Fetch the complete documentation index at: .../llms.txt" headers; and "Any page can also be retrieved as Markdown by sending an `Accept: text/markdown` header to the page\'s URL without the `index.md` suffix" (agents/llms.txt), alongside the /index.md mirror of every page.'),
    ],
}


def curl(url, method='GET', headers=None, data=None, include_headers=False):
    cmd = ['curl', '-s', '--max-time', '25', '-w', '\n---META %{http_code}']
    if include_headers:
        cmd.insert(1, '-i')
    if method != 'GET':
        cmd += ['-X', method]
    for h in headers or []:
        cmd += ['-H', h]
    if data is not None:
        cmd += ['-d', data]
    r = subprocess.run(cmd + [url], capture_output=True, text=True, timeout=35)
    body, _, meta = r.stdout.rpartition('\n---META ')
    return int(meta.strip() or 0), body


def mcp_oauth_probe(product, endpoint, meta_url):
    """Live-verify an OAuth-gated remote MCP endpoint: keyless JSON-RPC initialize answers
    HTTP 401 with an RFC 9728 www-authenticate resource_metadata pointer, and that metadata
    resolves with authorization_servers. Fails loudly if reality changes."""
    status, raw = curl(endpoint, method='POST',
                       headers=['Content-Type: application/json',
                                'Accept: application/json, text/event-stream'],
                       data=MCP_INIT, include_headers=True)
    if status != 401 or 'resource_metadata' not in raw:
        raise SystemExit(f'{product} mcp probe: keyless initialize returned {status} without resource_metadata: {raw[:300]}')
    status2, meta = curl(meta_url)
    if status2 != 200 or '"authorization_servers"' not in meta:
        raise SystemExit(f'{product} mcp probe: protected-resource metadata returned {status2}: {meta[:200]}')
    meta_json = json.loads(meta)
    return ('PROBE mcp-oauth (' + NOW[:10] + f'): keyless JSON-RPC initialize to {endpoint} answers HTTP 401 with '
            f'www-authenticate resource_metadata={meta_url}; that metadata (HTTP 200) publishes '
            + json.dumps(meta_json)[:600] +
            ' — a live, OAuth-gated remote MCP server per the MCP authorization spec.')


def vercel_ai_catalog_probe():
    status, body = curl('https://vercel.com/.well-known/ai-catalog.json')
    if status != 200 or '"specVersion"' not in body:
        raise SystemExit(f'vercel ai-catalog probe: returned {status}: {body[:200]}')
    cat = json.loads(body)
    names = ', '.join(e.get('displayName', '?') for e in cat.get('entries', []))
    return ('PROBE ai-catalog (' + NOW[:10] + '): GET https://vercel.com/.well-known/ai-catalog.json returns HTTP 200 '
            f'application/ai-catalog+json, specVersion {cat.get("specVersion")}, host "Vercel" with documentationUrl '
            f'https://vercel.com/docs/agent-resources; entries: {names} — a live machine-readable agent resource catalog.')


def cloudflare_docs_mcp_probe():
    """The docs MCP server initializes FULLY KEYLESSLY — a real JSON-RPC result, no auth."""
    status, raw = curl('https://docs.mcp.cloudflare.com/mcp', method='POST',
                       headers=['Content-Type: application/json',
                                'Accept: application/json, text/event-stream'],
                       data=MCP_INIT)
    if status != 200 or '"serverInfo"' not in raw:
        raise SystemExit(f'cloudflare docs mcp probe: keyless initialize returned {status}: {raw[:300]}')
    line = next((l[6:] for l in raw.splitlines() if l.startswith('data: ')), '{}')
    info = json.loads(line).get('result', {}).get('serverInfo', {})
    return ('PROBE mcp-keyless (' + NOW[:10] + '): keyless JSON-RPC initialize to https://docs.mcp.cloudflare.com/mcp '
            f'returns HTTP 200 text/event-stream with a real initialize result — serverInfo {json.dumps(info)}, '
            'protocolVersion 2025-06-18, tools+prompts capabilities — a live remote MCP server usable with NO credentials at all.')


PROBES = {
    'vercel': [
        ('vercel-probe-5', 'https://mcp.vercel.com',
         lambda: mcp_oauth_probe('vercel', 'https://mcp.vercel.com',
                                 'https://mcp.vercel.com/.well-known/oauth-protected-resource')),
        ('vercel-probe-6', 'https://vercel.com/.well-known/ai-catalog.json', vercel_ai_catalog_probe),
    ],
    'cloudflare': [
        ('cloudflare-probe-4', 'https://docs.mcp.cloudflare.com/mcp', cloudflare_docs_mcp_probe),
        ('cloudflare-probe-5', 'https://mcp.cloudflare.com/mcp',
         lambda: mcp_oauth_probe('cloudflare', 'https://mcp.cloudflare.com/mcp',
                                 'https://mcp.cloudflare.com/.well-known/oauth-protected-resource/mcp')),
    ],
}


def main():
    for product in ('vercel', 'cloudflare'):
        path = f'open-rankings/edge-platforms/evidence/{product}.json'
        ev = json.load(open(path))
        existing = {e['id'] for e in ev}

        for iid, url, excerpt in DOC_ITEMS[product]:
            if iid in existing:
                print(f'{iid}: already present, skipping')
                continue
            ev.append({'id': iid, 'tier': 'claimed-docs', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
            print(f'appended {iid}')

        for probe_id, probe_url, run in PROBES[product]:
            if probe_id in existing:
                print(f'{probe_id}: already present, skipping')
                continue
            excerpt = run()
            ev.append({'id': probe_id, 'tier': 'probe', 'url': probe_url, 'excerpt': excerpt, 'fetchedAt': NOW})
            print(f'appended {probe_id}')

        with open(path, 'w') as f:
            f.write(json.dumps(ev, indent=2, ensure_ascii=False) + '\n')
        print(f'{product}: wrote {len(ev)} items')


if __name__ == '__main__':
    main()
