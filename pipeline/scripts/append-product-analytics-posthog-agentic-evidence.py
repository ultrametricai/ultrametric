#!/usr/bin/env python3
# Hot-repos fairness wave (2026-09-15): the identical Stripe-spike / payments-fairness supplement
# recipe (append-payments-stripe-agentic-evidence.py, append-payments-fairness-agentic-evidence.py)
# run for product-analytics/posthog. This wave's crawl added 20 posthog agent-surface urls.extra
# pages (posthog-ai, MCP tools reference, self-driving, skills store, AI wizard incl. --signup,
# AI observability + shipped agent skills, MCP Analytics, Replay Vision, Workflows, Slack app,
# PostHog Desktop, /query API, personal-API-key scopes, CDP destinations, batch exports,
# per-endpoint OpenAPI, services/mcp README, ai-plugin README); the monotonic re-extract surfaced
# 14 mostly one-line items. These verbatim supplements carry the content the per-source extraction
# caps starved out of the pack even though the crawled corpus contains it verbatim.
#
# Every URL below is in posthog's products.json urls (or is the live endpoint a probe verifies);
# every excerpt quotes the crawled/live page (fetched 2026-09-15, same day the crawl ran).
#
# Verified-honest absences (NO doc items added, on purpose):
#   - no llms-full.txt (posthog.com/llms-full.txt is 404) — llms.txt is a per-page .md index
#     instead, every docs page renders as markdown at URL + `.md`;
#   - no /.well-known/skills/index.json (unlike Stripe) — PostHog skills ship via the MCP skills
#     store and a GitHub release zip (posthog-probe-7), not a well-known machine catalog;
#   - the wizard's `--ci` mode is "turned off in published builds" (quoted below, gate kept);
#   - MCP Analytics and the Slack app carry Beta labels — quoted with labels intact;
#   - openness-*/privacy-* axes are out of this wave's scope; no agent-washing of unrelated axes.
#
# Run AFTER `pnpm pipeline extract --product posthog` (extract is monotonic and dedups by
# normalized excerpt, so re-running extract after this keeps these items stable). If
# `pnpm pipeline probe --category product-analytics` ever wholesale-replaces probe-tier items,
# re-run this script to restore posthog-probe-6/7.
import datetime
import json
import subprocess

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

MCP_INIT = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {
    'protocolVersion': '2025-06-18', 'capabilities': {},
    'clientInfo': {'name': 'productarena-probe', 'version': '1.0'}}})

DOC_ITEMS = [
    # --- Hosted MCP server (extra-13 tools.md, extra-30 services/mcp README, docs extra-8) ---
    ('posthog-supp-mcp-tools-inventory', 'https://posthog.com/docs/model-context-protocol/tools.md',
     'The PostHog MCP tools reference documents 953 MCP tools across 65 product categories: "The PostHog MCP server exposes function-calling MCP tools across every PostHog product – from feature flags and experiments to error tracking, logs, surveys, and SQL. Your agent picks the right MCP tool based on the goals and context already in the conversation." Categories include AI observability (81 tools), Customer analytics (73), Signals (60), Experiments (40), Tasks (31), Warehouse sources (31), Workflows (30), Error tracking (28), Feature flags (27), Replay vision (23), Skills (22), Logs (21), Dashboards (18), MCP analytics (16), Endpoints (14), plus Access control, Billing, Notebooks, Surveys, and more. "MCP tool names are stable and can be used with the `tools` query parameter to scope a session to a specific subset."'),
    ('posthog-supp-mcp-cli-mode', 'https://posthog.com/docs/model-context-protocol/tools.md',
     'In CLI mode, "the default for most clients, the MCP server registers a single `exec` tool instead of one tool per endpoint. Agents pass it CLI-style command strings to list, search, inspect, and call the tools above on demand, which keeps context usage small" — documented commands: `tools` (list), `search <regex_pattern>`, `info [--json] <tool_name>`, `schema <tool_name> [field_path]` (dot-notation drill-down), and `call [--json] [--confirm] <tool_name> <json_input>` where "--confirm is required by the CLI for destructive tools." On hosts that support MCP apps, CLI mode also registers a separate `render-ui` tool for rendering interactive visualizations.'),
    ('posthog-supp-mcp-hosted-clients', 'https://posthog.com/docs/model-context-protocol.md',
     'The PostHog MCP server "is a free, hosted endpoint that lets your AI agent use PostHog – with just plain text questions your agents can ship a feature flag from a prompt, dig into a stack trace without leaving your editor, run a HogQL query through Claude, triage a support ticket, set up a CDP destination, and much more. It works with any MCP-compatible client, including PostHog Desktop, Claude Code, Claude Desktop, Cursor, Codex, VS Code, Windsurf, and Zed." "The server URL is https://mcp.posthog.com/mcp. The PostHog authentication server automatically routes you to the correct data region (US or EU) based on the account you log in with." Install: `npx @posthog/wizard mcp add`. "You can also run governed metrics from your semantic layer (beta), so every agent session answers \'what\'s our MRR?\' with the same canonical definition."'),
    ('posthog-supp-mcp-scoping', 'https://raw.githubusercontent.com/PostHog/posthog/master/services/mcp/README.md',
     'The MCP server supports per-session tool scoping via URL parameters — "https://mcp.posthog.com/mcp?tools=dashboard-get,feature-flag-get-all,execute-sql" and feature filters like "?features=flags&tools=dashboard-get" — plus a documented Streamable HTTP transport for calling MCP from code ("Streamable HTTP requires the `Accept` header to include both JSON and SSE"). "The MCP server runs in PostHog\'s US and EU Kubernetes clusters and stores session state in the region you connect to. A stateless Cloudflare Worker in front of it only authenticates requests and routes them to your cloud region; it does not store any sensitive data."'),
    # --- PostHog AI in-product assistant (extra-12 posthog-ai.md) ---
    ('posthog-supp-posthog-ai-analyst', 'https://posthog.com/docs/posthog-ai.md',
     '"PostHog AI is an AI product analyst that lives inside PostHog. Ask it a question in plain English and it queries your data, builds the insight, writes the SQL, or finds the session replay – then explains what it found... It also does the work, not just the analysis. PostHog AI creates dashboards, surveys, alerts, and feature flags, edits filters in the UI alongside you, and remembers what it learns about your product between conversations. Ask it for a change that belongs in code and it starts a coding task against a repository you\'ve connected, then reports back when there\'s a pull request to review." It lives "in a chat sidebar and in inline entry points throughout the UI", also answers in Slack, and "respects access controls, so it can only see what you can see."'),
    # --- Self-driving loop (extra-14 self-driving.md) ---
    ('posthog-supp-self-driving-loop', 'https://posthog.com/docs/self-driving.md',
     '"PostHog makes your product self-driving. It watches how people actually use your product, finds what\'s worth fixing, opens a pull request, and measures whether the change worked. You review and merge. Turning it on takes one command: `npx @posthog/wizard self-driving`... It runs as a loop. Scouts and signal sources emit signals, signals group into reports, and an agent investigates each report. When a report is actionable, PostHog opens a pull request for you to review and merge; when it needs your input, it surfaces the report in your inbox instead. PostHog then checks whether the change worked and feeds the result back into the next pass." Dogfooded in public: "A troop of more than 90 scouts... watches the PostHog app, and reports about posthog.com become pull requests on the public repo that builds it." Pricing is per outcome: "you pay a flat $15 per pull request, your first three each month are free, reports are always free."'),
    # --- Skills store (extra-15 skills.md) ---
    ('posthog-supp-skills-store', 'https://posthog.com/docs/skills.md',
     '"Skills are versioned, reusable instructions for AI agents, stored centrally in PostHog... following the Agent Skills specification – across any tool, for any team member." The MCP server exposes a dedicated tool family: skill-list, skill-get, skill-file-get, skill-create, skill-update ("Publish a new version – provide full body, incremental edits, or file_edits"), skill-file-create/delete/rename, and skill-duplicate. "Every edit creates an immutable version, with `base_version` concurrency checks"; "Agents use these with progressive disclosure: discover by description, fetch the body only when relevant, and pull individual files on demand." "Every scout is a skill you can read, edit, or write yourself", and a community skills store lets you "install skills shared by other PostHog users, or publish your own."'),
    ('posthog-supp-ai-obs-skills', 'https://posthog.com/docs/ai-observability/skills.md',
     '"PostHog ships agent skills for AI Observability that teach your coding agent how to investigate LLM traces, costs, clusters, evaluations, and failures through the PostHog MCP server. They\'re the same skills PostHog\'s own background agents run" — documented skills: analyzing-expensive-users, creating-online-evaluations, exploring-ai-failures, exploring-llm-clusters, exploring-llm-costs, exploring-llm-evaluations, exploring-llm-traces, each with its MCP tool list. "Every PostHog skill also ships as `skills.zip` on the latest skills release – ready-to-use `SKILL.md` directories you can drop into your agent\'s skills folder (like `.claude/skills/` for Claude Code)."'),
    # --- AI wizard (extra-16/17) ---
    ('posthog-supp-ai-wizard', 'https://posthog.com/docs/ai-engineering/ai-wizard.md',
     '"The PostHog wizard is an agentic CLI tool that uses AI to set up and manage PostHog in your codebase. By default, it installs and instruments PostHog for you with a single command: `npx -y @posthog/wizard@latest`... The wizard can also audit an existing integration, migrate you from another vendor, upload source maps, set up Revenue Analytics, and diagnose configuration issues." Running it "Scans your codebase and app architecture", "Creates custom events based on real product flows", "Writes code and instruments the PostHog SDKs client-side and server-side", "Generates insights and dashboards in the PostHog app", and "Optionally installs the PostHog MCP server for your AI agent" — across 26+ documented frameworks and languages.'),
    ('posthog-supp-wizard-signup', 'https://posthog.com/docs/ai-engineering/wizard-signup.md',
     'Terminal-native account provisioning: "You don\'t need to fill out a signup form to start using PostHog. The AI wizard can create a brand-new PostHog account, spin up a project, and wire up the SDK in your codebase, all from one command": `npx @posthog/wizard@latest --signup --email you@example.com --region us`. "Behind the scenes it talks to PostHog\'s provisioning API over OAuth 2.0 with PKCE, which means there are no secrets to copy around"; partners "provisioning accounts for your own users programmatically" use the provisioning API directly. Documented limits kept honest: "The wizard has a `--ci` mode, but it\'s turned off in published builds", and "Signing up this way doesn\'t mint a personal API key".'),
    # --- AI observability (extra-18) ---
    ('posthog-supp-ai-observability', 'https://posthog.com/docs/ai-observability.md',
     '"AI Observability captures every call your AI product makes to an LLM – the prompt, the response, the tokens, the cost, the latency, and the tools it reached for along the way – and stitches them into traces you can actually read... every trace comes with the user who triggered it, their session replay, and any exceptions the request threw. That same trace data is what evaluations score and what Self-driving reads when it files a report about your AI product\'s quality." Surfaces: PostHog Web (playground, cost/latency, failure clustering), PostHog MCP ("Pull up traces, costs, and errors from any MCP client or AI editor"), PostHog Desktop (Beta), and API; it can also "Forward traces you already collect in Helicone, Langfuse, Traceloop, or Keywords AI."'),
    # --- MCP Analytics (extra-20) ---
    ('posthog-supp-mcp-analytics', 'https://posthog.com/docs/mcp-analytics.md',
     '"MCP Analytics shows you how AI agents actually use your MCP tools: which ones get called, what the agent was trying to do, which model the agent reports using, where calls fail, and which capabilities agents asked for that you don\'t offer yet. It works on PostHog\'s own hosted MCP server and on any server you instrument with the MCP Analytics SDKs. Every tool invocation lands as a single `$mcp_tool_call` event on your standard events table... Those calls also feed Self-driving, which spots tools that need fixing and files a report – and opens a pull request when the server is one you own." Label kept: "MCP Analytics is in beta. The `@posthog/mcp` SDK is published as a `0.x` release... Pin a version and don\'t depend on it for production reporting yet."'),
    # --- Replay Vision (extra-21) ---
    ('posthog-supp-replay-vision', 'https://posthog.com/docs/replay-vision.md',
     '"Replay Vision uses AI to automatically watch your session recordings and turn what it sees into structured, queryable data. You configure scanners – named AI probes that describe what to look for – and PostHog applies them to your recordings, producing observations you can query, chart, and alert on... Replay Vision actually watches the video of each recording alongside its events" (rendered sped-up video + raw events sent to a Google Gemini model), each observation persisted "as a queryable `$recording_observed` event". Documented uses: "Spot dead ends", "Classify intent", "Score frustration", "Summarize sessions". Setup is agentic too: "Run `npx @posthog/wizard replay-vision` in your project directory. It reads your codebase and creates three scanners written for your product."'),
    # --- Workflows (extra-22) ---
    ('posthog-supp-workflows', 'https://posthog.com/docs/workflows.md',
     '"Workflows is PostHog\'s no-code, drag-and-drop tool for automating processes and sending messages to your users. You decide when a workflow is triggered, who it reaches, and what happens at each step – triggers, delays, audience splits, message sends, and PostHog actions. Because workflows run on the same events and person properties you already send to PostHog, you can act on real product behavior instead of a separate marketing dataset. Any real-time destination in PostHog can be dropped into" a workflow.'),
    # --- Slack agent (extra-23) ---
    ('posthog-supp-slack-agent', 'https://posthog.com/docs/slack.md',
     'The PostHog Slack app (Beta — "Commands, scopes, and behavior are still moving"): "`@PostHog` brings PostHog into any Slack channel, thread, or DM. Mention the bot with a question about your product data and it answers in-thread using the PostHog MCP... Mention `@PostHog` with a fix, an edit, or a feature idea and it plans the work in a sandboxed environment, edits files, runs your checks, and opens a draft PR. The PR links back to the Slack thread it came from... It\'s the same agent that powers PostHog AI and PostHog Desktop." Tasks can mix code and product data: "@PostHog add a feature flag to the new checkout page and roll it out to everyone with an @example.com email address".'),
    # --- PostHog Desktop (extra-24) ---
    ('posthog-supp-desktop-agents', 'https://posthog.com/docs/posthog-desktop.md',
     '"PostHog Desktop brings coding agents, product context, and team processes into one app... Pick Pi, Claude Code, or Codex, then decide where the agent should work: Local for a focused change on your current branch, Worktree for isolated local work on its own branch, Cloud for work that should continue after you close the app." Agents get "Live product context beside PostHog SDK calls, including event activity, flag rollout, and Experiment status", "PostHog skills", "PostHog\'s MCP server to query insights, dashboards, Feature Flags, errors, and other project data", and "Other MCP servers for services such as issue trackers, design tools, and internal APIs."'),
    # --- /query API (extra-25) ---
    ('posthog-supp-query-endpoint', 'https://posthog.com/docs/api/queries.md',
     'Programmatic SQL over the API: "To create a query, you make a `POST` request to the `/api/projects/:project_id/query/` endpoint" with `kind: HogQLQuery` and SQL, authenticated by "A personal API key for your project with the Query Read permission." Guardrails documented honestly: "The `/query` endpoint is intended for ad-hoc analytics and embedded use cases. It is not a supported export mechanism"; "`OFFSET` pagination is not supported for programmatic requests... It currently returns HTTP 400 for personal API keys. Use keyset pagination on `timestamp` instead"; bulk/recurring exports must use batch exports or file download exports.'),
    # --- Scoped keys (extra-26) ---
    ('posthog-supp-scoped-keys', 'https://posthog.com/docs/api/personal-api-keys.md',
     'Personal API keys are scoped by construction: "You can create multiple, give them different scopes, and each can be invalidated individually... Choose the scopes for your key. We recommended selecting only the scopes required for the API endpoints you really need." Apps that other users connect should "Use OAuth instead so users can grant your app scoped access without sharing their own keys." Org-level governance is documented: admins can audit every key with access — "Scopes – The API scopes granted to the key (e.g., `insight:read`), or `*` for full access", access scope (org-wide / specific projects / unscoped), and last-used timestamps — while "The actual key secret is never exposed".'),
    # --- Realtime destinations (extra-27) ---
    ('posthog-supp-realtime-destinations', 'https://posthog.com/docs/cdp/destinations.md',
     '"As PostHog data arrives, you can export it immediately to other tools... PostHog enables you to send realtime data to dozens of pre-configured destinations", plus a generic webhook destination that can "send events to any HTTP endpoint, using whatever request method, URL parameter values, and JSON payload structure your application requires." Destinations are filterable ("by event types, properties, or any SQL statement you can come up with"), testable ("Every destination includes a built-in testing interface"), observable ("the metrics and logs tabs will let you monitor usage and inspect errors"), and programmable: "you can view and edit the underlying Hog code that drives it."'),
    # --- Per-endpoint OpenAPI (extra-29) ---
    ('posthog-supp-endpoints-openapi', 'https://posthog.com/docs/endpoints/openapi-sdk-generation.md',
     'PostHog Endpoints (saved, governed queries exposed as API routes) each publish a machine spec: "Each endpoint exposes an OpenAPI 3.0 spec that you can use to generate typed SDK clients for your preferred language" — fetched via `GET <ph_app_host>/api/projects/{project_id}/endpoints/{endpoint_name}/openapi.json`; "The spec includes request schemas (with any variables your endpoint defines), response schemas, and authentication requirements."'),
    # --- CLI agent surface (extra-9 cli.md, crawled) ---
    ('posthog-supp-cli-agent-first', 'https://posthog.com/docs/cli.md',
     '"The PostHog CLI lets you use PostHog from your terminal, your coding agents, local scripts, and CI/CD pipelines" — "Use `posthog-cli api` to access PostHog\'s API and MCP tool catalog from shell-friendly commands, including running SQL queries against your data", plus source-map upload, schema management, and task CRUD. Headless auth is documented for agents: "For CI/CD, headless environments, or agents running without a browser, set environment variables instead" (POSTHOG_CLI_HOST / POSTHOG_CLI_PROJECT_ID / POSTHOG_CLI_API_KEY), and "For broad agent workflows, create a personal API key with the MCP Server preset. For narrower automation, grant only the scopes needed for the specific command." Install: `npx @posthog/wizard cli add` — "Installs the CLI and adds instructions to your coding agent."'),
    # --- AI plugin (extra-31 ai-plugin README) ---
    ('posthog-supp-ai-plugin', 'https://raw.githubusercontent.com/PostHog/ai-plugin/HEAD/README.md',
     '"Official PostHog plugin for AI clients. Access PostHog products directly from your AI coding tool." Claude Code install is one command — `claude plugin install posthog` — followed by OAuth via /mcp; the README covers installation in Claude Code, Codex, Cursor, and Gemini CLI, and the plugin "bundles every PostHog skill and keeps them up to date", including the skills-store skill that "teaches your agent exactly how to discover, load, create, and update skills via the PostHog MCP tools."'),
]


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


def posthog_mcp_probe():
    """Live-verify the hosted MCP server's keyless behavior: a bare JSON-RPC initialize gets an
    HTTP 401 with an RFC 9728 www-authenticate resource_metadata pointer, and that metadata
    resolves with authorization_servers and granular scopes. Fails loudly if reality changes."""
    base = 'https://mcp.posthog.com'
    status, raw = curl(f'{base}/mcp', method='POST',
                       headers=['Content-Type: application/json',
                                'Accept: application/json, text/event-stream'],
                       data=MCP_INIT, include_headers=True)
    if status != 401 or 'resource_metadata' not in raw:
        raise SystemExit(f'posthog mcp probe: keyless initialize returned {status} without resource_metadata: {raw[:300]}')
    meta_url = f'{base}/.well-known/oauth-protected-resource/mcp'
    status2, meta = curl(meta_url)
    if status2 != 200 or '"authorization_servers"' not in meta:
        raise SystemExit(f'posthog mcp probe: protected-resource metadata returned {status2}: {meta[:200]}')
    meta_json = json.loads(meta)
    scopes = meta_json.get('scopes_supported', [])
    sample = ', '.join(s for s in scopes if ':' in s)[:400]
    return ('PROBE mcp-oauth (' + NOW[:10] + f'): keyless JSON-RPC initialize to {base}/mcp answers HTTP 401 with '
            'www-authenticate: Bearer resource_metadata=' + meta_url + ' ("No token provided, please provide a valid '
            'API token. View the documentation for more information: https://posthog.com/docs/model-context-protocol"); '
            'that metadata (HTTP 200) publishes authorization_servers=' + json.dumps(meta_json.get('authorization_servers'))
            + f' and {len(scopes)} granular OAuth scopes (e.g. {sample}...) — a live, OAuth-gated remote MCP server '
            'per the MCP authorization spec, with per-resource read/write scopes.')


def posthog_skills_release_probe():
    """Live-verify the published agent-skills release asset (skills.zip) exists keylessly."""
    url = 'https://github.com/PostHog/posthog/releases/download/agent-skills-latest/skills.zip'
    r = subprocess.run(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code} %{redirect_url}',
                        '--max-time', '25', url], capture_output=True, text=True, timeout=35)
    code, _, redirect = r.stdout.partition(' ')
    if code != '302' or 'skills.zip' not in redirect:
        raise SystemExit(f'posthog skills probe: {url} returned {code} (redirect: {redirect[:120]})')
    return ('PROBE agent-skills-release (' + NOW[:10] + f'): GET {url} answers HTTP 302 to a signed release asset '
            '(response-content-disposition filename=skills.zip) — the documented "latest skills release" from '
            'posthog.com/docs/ai-observability/skills.md ("Every PostHog skill also ships as `skills.zip`... '
            'ready-to-use `SKILL.md` directories you can drop into your agent\'s skills folder") is live and keyless.')


PROBES = [
    ('posthog-probe-6', 'https://mcp.posthog.com/mcp', posthog_mcp_probe),
    ('posthog-probe-7', 'https://github.com/PostHog/posthog/releases/download/agent-skills-latest/skills.zip',
     posthog_skills_release_probe),
]


def main():
    path = 'rankings/product-analytics/evidence/posthog.json'
    ev = json.load(open(path))
    existing = {e['id'] for e in ev}

    for iid, url, excerpt in DOC_ITEMS:
        if iid in existing:
            print(f'{iid}: already present, skipping')
            continue
        ev.append({'id': iid, 'tier': 'claimed-docs', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
        print(f'appended {iid}')

    for probe_id, probe_url, run in PROBES:
        if probe_id in existing:
            print(f'{probe_id}: already present, skipping')
            continue
        excerpt = run()
        ev.append({'id': probe_id, 'tier': 'probe', 'url': probe_url, 'excerpt': excerpt, 'fetchedAt': NOW})
        print(f'appended {probe_id}')

    with open(path, 'w') as f:
        f.write(json.dumps(ev, indent=2, ensure_ascii=False) + '\n')
    print(f'posthog: wrote {len(ev)} items')


if __name__ == '__main__':
    main()
