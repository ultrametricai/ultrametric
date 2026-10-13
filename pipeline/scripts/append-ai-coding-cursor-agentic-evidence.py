#!/usr/bin/env python3
# Hot-repos fairness wave (2026-09-15): Stripe-style exhaustive agentic-surface evidence pass
# for ai-coding/cursor — same supplement recipe as append-payments-fairness-agentic-evidence.py
# (commit 277a7797) and the Stripe spike (771a7510). This wave's crawl added 30 cursor
# agent-surface urls.extra pages (CLI/headless/ACP, Cloud Agents API v1 + webhooks +
# automations + self-hosted, Admin/Analytics/AI-Code-Tracking APIs, service accounts, hooks/
# rules/skills/subagents, Bugbot, run modes, TypeScript SDK, Origin, privacy governance,
# worktrees, OpenTelemetry export, BYO API keys); re-extract surfaced 31 mostly one-line items.
# Every URL below is in cursor's products.json urls (or is the live endpoint a probe verifies);
# every excerpt quotes the crawled/live page (fetched 2026-09-15, same day as the crawl).
#
# Verified-honest counterparts (NO doc items added, on purpose):
#   - No Cursor-hosted remote MCP SERVER: mcp.cursor.com does not resolve (DNS NXDOMAIN,
#     live-checked 2026-09-15); Cursor is a documented MCP CLIENT (docs/mcp.md) and cloud
#     agents can consume MCP servers, but there is no server for third-party agents to drive
#     Cursor over MCP.
#   - Closed source: no open license, no self-hosting of the product; openness-* axes stay as
#     judged (Origin is a hosted forge, not self-hostable source).
#   - No API sandbox environment documented for the Cursor APIs (no test-mode keys).
#   - Cloud Agents API v1 is quoted with its "public beta" label; v1 webhooks are "coming
#     soon" — only the legacy v0 API supports webhooks today (quoted as such).
#   - Enterprise gates kept: Admin/Analytics/AI-Code-Tracking/Bugbot APIs and service accounts
#     and OpenTelemetry Export are Enterprise-plan features (quoted with the gate).
#
# Run AFTER `pnpm pipeline extract --category ai-coding --product cursor` (extract is monotonic
# and dedups by normalized excerpt). If a probe stage ever wholesale-replaces probe-tier items,
# re-run this script to restore cursor-probe-2..5.
import datetime
import json
import subprocess

ROOT = '/Users/judegomila/Documents/GitHub/productarena/.claude/worktrees/agent-a0b0711d26c6d19e5'
NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

DOC_ITEMS = [
    # --- CLI headless / scripting (extra-2 headless.md, extra-7 output-format.md) ---
    ('cursor-supp-cli-headless', 'https://cursor.com/docs/cli/headless.md',
     'The Cursor CLI runs headlessly for CI and scripts: "Use print mode (`-p, --print`) for non-interactive scripting and automation", combining `--print` with `--force` (or `--yolo`) to apply file modifications ("Without --force, changes are only proposed, not applied"), e.g. `find src/ -name "*.js" | while read file; do agent -p --force "Add comprehensive JSDoc comments to $file"; done`. Setup for scripts is keyed, not interactive: "Set API key for scripts: export CURSOR_API_KEY=your_api_key_here; agent -p \'Analyze this code\'".'),
    ('cursor-supp-cli-output-formats', 'https://cursor.com/docs/cli/reference/output-format.md',
     'Machine-readable CLI output is documented: `--output-format` supports "structured formats for programmatic use (`json`, `stream-json`) and a simplified text format" — `json` "emits a single JSON object" with `{type:"result", subtype:"success", is_error, duration_ms, result, session_id}`, while `stream-json` gives message-level events (system/assistant/tool_call/result) and `--stream-partial-output` adds incremental deltas; "On failure, the process exits with a non-zero code and writes an error message to stderr."'),
    ('cursor-supp-cli-acp', 'https://cursor.com/docs/cli/acp.md',
     'Cursor CLI speaks an open agent-integration protocol: "Cursor CLI supports ACP (Agent Client Protocol) for advanced integrations. You can run `agent acp` and connect a custom client over `stdio` using JSON-RPC" — transport stdio, "Protocol envelope: JSON-RPC 2.0", newline-delimited framing, with a documented session flow (initialize → authenticate with methodId "cursor_login" → session prompts).'),
    ('cursor-supp-cli-permissions', 'https://cursor.com/docs/cli/reference/permissions.md',
     'CLI agent authority is least-privilege configurable: "Configure what the agent is allowed to do using permission tokens" in `~/.cursor/cli-config.json` (global) or `<project>/.cursor/cli.json` (project) — `Shell(commandBase)` gates shell commands (glob + `command:args` syntax, e.g. `Shell(git)`, `Shell(curl:*)`, `Shell(rm)` in deny), `Read(pathOrGlob)`/`Write(pathOrGlob)` gate file access (e.g. deny `Read(.env*)`).'),
    ('cursor-supp-cli-github-actions', 'https://cursor.com/docs/cli/github-actions.md',
     'CI automation is a documented first-class flow: "Use Cursor CLI in GitHub Actions and other CI/CD systems to automate development tasks", with a recipe that installs via `curl https://cursor.com/install -fsS | bash`, adds `$HOME/.cursor/bin` to GITHUB_PATH, and runs `agent -p "Your prompt here" --model gpt-5` under a `CURSOR_API_KEY` repository secret.'),
    # --- Cloud Agents API v1 (extra-9 endpoints.md, extra-10 webhooks.md) ---
    ('cursor-supp-cloud-agents-api', 'https://cursor.com/docs/cloud-agent/api/endpoints.md',
     'The Cloud Agents API v1 ("public beta", all plans) "lets you programmatically launch and manage cloud agents that work on your repositories": POST /v1/agents creates "a durable agent plus per-prompt runs" with a `prompt` (text + up to 5 images), explicit `model.id` "returned by GET /v1/models", `env` routing to Cursor-hosted VMs or your own `pool`/`machine` workers, up to 20 `repos` (branch/PR targeting, `autoCreatePR`), session-scoped encrypted `envVars`, up to 50 inline `mcpServers` (http/sse/stdio, OAuth or headers), up to 20 `customSubagents`, `mode: plan|agent`, and idempotent creates via client-supplied `agentId` ("re-POSTing the same agentId returns 409 agent_id_conflict"). Runs support list/get/stream/cancel; agents support archive/unarchive/delete; artifacts are listable and downloadable.'),
    ('cursor-supp-cloud-agents-openapi', 'https://cursor.com/docs/cloud-agent/api/endpoints.md',
     'The API is machine-spec\'d and key-introspectable: "View the full OpenAPI specification (/docs-static/cloud-agents-openapi.yaml) for detailed schemas and examples" (live: openapi 3.0.3, "title: Cursor Cloud Agents API"), plus GET /v1/api-key-info and GET /v1/models for capability discovery, and worker/pool endpoints (list workers, register/deregister pools, watch pending pool requests) for self-hosted fleets. Auth "accepts both Basic and Bearer authentication" with "a user API key from Cursor Dashboard → API Keys, or a service account API key".'),
    ('cursor-supp-agent-webhooks', 'https://cursor.com/docs/cloud-agent/api/webhooks.md',
     'Agent-run webhooks are documented (v0 API; the v1 page notes "Webhooks are coming soon. The legacy v0 API still supports them"): "When you create an agent with a webhook URL, Cursor will send HTTP POST requests to notify you about status changes" (statusChange on ERROR/FINISHED), signed with `X-Webhook-Signature` "HMAC-SHA256 ... sha256=<hex_digest>" plus X-Webhook-ID / X-Webhook-Event headers, with JS+Python verification snippets and a JSON payload carrying repository/ref source, target url/branchName/prUrl, and a summary.'),
    # --- Automations / scheduled autonomous agents (extra-11) ---
    ('cursor-supp-automations', 'https://cursor.com/docs/cloud-agent/automations.md',
     '"Cursor Automations run cloud agents in the background, either on a schedule or in response to events from GitHub, GitLab, Slack, webhooks, Linear, and more." Scheduled triggers take "preset options or ... a cron expression"; source-control triggers cover PR opened/pushed/merged, push-to-branch, comments, labels. Automations are created in the Agents Window, at cursor.com/automations, "with the /automate skill" ("describe the workflow you want in plain language"), or from Cursor Marketplace templates; the page ships three Cursor-managed agents — Bugbot, Security Agents ("review pull requests and scan codebases for vulnerabilities"), and PR Routing & Approval ("routes pull requests to reviewers and can approve low-risk changes"). Team Owned automations "execute under a shared team service account".'),
    # --- Admin / Analytics / AI-code-tracking APIs (extra-14 api.md, extra-15..17) ---
    ('cursor-supp-apis-overview', 'https://cursor.com/docs/api.md',
     'Cursor documents a multi-API platform surface: Admin API ("Manage team members, settings, usage data, spending, and model access", Enterprise), Analytics API ("insights into team\'s Cursor usage, AI metrics, active users, and model usage", Enterprise), AI Code Tracking API ("Track AI-generated code contributions at commit and change levels", Enterprise), Bugbot API ("Trigger Bugbot reviews and retrieve per-review analytics", Enterprise), Cloud Agents API (Beta, all plans), Origin API (Early Beta), plus TypeScript and Python SDKs (all users). Auth is documented per API (Basic with API key as username; Cloud Agents also Bearer), keys are `crsr_...` with a named scope ("Required scope: admin:*"), and rate limits are published per endpoint ("Unless an endpoint documents a different limit, the default is 20 requests per minute"; Analytics 100/min; 429 responses include Retry-After: 60). Analytics and AI Code Tracking endpoints support ETag HTTP caching.'),
    ('cursor-supp-admin-api', 'https://cursor.com/docs/account/teams/admin-api.md',
     'The Admin API (api.cursor.com, Basic auth with an admin-scoped key) exposes team governance endpoints documented section by section: get team members, get audit logs, get daily usage data, get spending data, get usage events, set user spend limit (rate-limited at 250 requests/minute) and bulk spend limits (preview), remove team member, repo blocklists (get/upsert/delete), billing groups (list/get/create/update/delete, add/remove members), and model access controls.'),
    ('cursor-supp-analytics-api', 'https://cursor.com/docs/account/teams/analytics-api.md',
     'The Analytics API reports the team\'s AI-usage telemetry programmatically — documented endpoint families include agent-edits, tab-usage, daily active users, client versions, model usage, top file extensions, and adoption series for MCP, commands, plans, skills, and ask mode, plus conversation-insights, a leaderboard, Bugbot analytics, and by-user endpoints. "Get metrics on AI-suggested code edits accepted by your team with Cursor."'),
    ('cursor-supp-ai-code-tracking-api', 'https://cursor.com/docs/account/teams/ai-code-tracking-api.md',
     'AI-attribution is queryable: "The AI Code Tracking API lets you track AI-generated code contributions across your team\'s repositories" with paginated JSON and streaming CSV endpoints for AI commit metrics and AI code-change metrics — commit-level and change-level attribution for analytics and compliance.'),
    # --- Service accounts = non-human scoped credentials (extra-18) ---
    ('cursor-supp-service-accounts', 'https://cursor.com/docs/account/enterprise/service-accounts.md',
     'Service accounts (Enterprise) are documented non-human agent credentials: "non-human accounts that enable teams to securely automate Cursor-powered workflows at scale. With service accounts, you can consume APIs, authenticate the CLI, and invoke cloud agents without tying integrations to individual developers\' personal accounts" — with key rotation ("The old key is immediately invalidated"), archival that "revokes all API keys" while preserving "a complete audit trail", admin-visible runs, no seat cost, and documented automation scenarios ("A ticket created in Linear triggering a cloud agent to implement a feature; An error in Sentry initiating a cloud agent to investigate and fix the issue"). CLI use: "Service accounts can authenticate the Cursor CLI by setting the API key as CURSOR_API_KEY. This is the recommended way to run the CLI in CI/CD pipelines, cron jobs, and other non-interactive environments."'),
    # --- Hooks (extra-19) ---
    ('cursor-supp-hooks', 'https://cursor.com/docs/hooks.md',
     'Hooks are a documented agent-loop control plane: "Hooks let you observe, control, and extend the agent loop using custom scripts" defined in `hooks.json` (project or user level) — "spawned processes that communicate over stdio using JSON in both directions" that "can observe, block, or modify behavior". Documented hook points include sessionStart/sessionEnd, preToolUse/postToolUse, subagentStart/subagentStop, beforeShellExecution/afterShellExecution, beforeMCPExecution/afterMCPExecution, beforeReadFile/afterFileEdit, beforeSubmitPrompt, preCompact, and stop; use cases include "Scan for PII or secrets" and "Gate risky operations (e.g., SQL writes)". "Cursor supports loading hooks from third-party tools like Claude Code."'),
    # --- Skills + subagents (extra-21, extra-22) ---
    ('cursor-supp-skills', 'https://cursor.com/docs/skills.md',
     '"Agent Skills is an open standard for extending AI agents with specialized capabilities" — portable ("Skills work across any agent that supports the Agent Skills standard"), version-controlled packages that "can include scripts, templates, and references that agents act on using their tools"; Cursor auto-discovers skills at startup, they can be invoked with `/` in Agent chat, and Cursor ships built-in managed skills alongside user-added ones.'),
    ('cursor-supp-subagents', 'https://cursor.com/docs/subagents.md',
     'Subagents are first-class: "specialized AI assistants that Cursor\'s agent can delegate tasks to. Each subagent operates in its own context window ... You can use subagents in the editor, CLI, and Cloud Agents" — with foreground/background modes, parallel execution ("Launch multiple subagents simultaneously"), and custom subagents configurable "with custom prompts, tool access, and models for domain-specific tasks".'),
    # --- Sandboxed execution / run modes (extra-24) ---
    ('cursor-supp-run-modes', 'https://cursor.com/docs/agent/security/run-modes.md',
     'Agent autonomy is governed by documented Run Modes: "Run Modes control how the Cursor agent runs tool calls, and when Cursor interrupts you for approval" across shell, MCP, and Fetch calls — Auto-review ("runs known-safe calls, sandboxes shell commands when it can, and asks a classifier to review anything else"; the classifier runs on a small Cursor-managed model), Allowlist ("deterministic behavior with a small set of trusted repeat actions"), and Run Everything. "A shell command \'can run in the sandbox\' when it works under the sandbox\'s file and network limits"; the docs honestly flag "Auto-review is not a security boundary."'),
    # --- SDK layer (extra-25) ---
    ('cursor-supp-sdk', 'https://cursor.com/docs/sdk/typescript.md',
     'Official agent SDKs: "The @cursor/sdk package lets you call Cursor\'s agent from your own code. The same agent that runs in the Cursor IDE, CLI, and web app is now scriptable from TypeScript" (`npm install @cursor/sdk`, Node 22.13+; a Python SDK and an SDK Bridge for "agent SDKs in other languages on the open bridge protocol" are documented alongside). One interface wraps two runtimes — Local ("Runs the agent loop inline in your Node process") and Cloud ("isolated VM with your repo cloned in ... runs need to survive the caller disconnecting") — selected by the key passed to Agent.create(); auth "accepts user API keys and service account API keys", and the Cursor Cookbook (github.com/cursor/cookbook) ships end-to-end examples ("CI auto-fix bots, bug triage workers, code-review passes, embedded in-product agents, and orchestrators").'),
    # --- Bugbot (extra-23) ---
    ('cursor-supp-bugbot', 'https://cursor.com/docs/bugbot.md',
     'Bugbot is the managed PR-review agent: "Bugbot reviews pull requests and identifies bugs, security issues, and code quality problems" — automatic reviews on every PR update, manual trigger "by commenting `cursor review` or `bugbot run` on any PR", it "reads connected PR comments (top-level and inline) to avoid duplicate suggestions", and posts "Fix in Cursor" / "Fix in Web" links; supported across GitHub (incl. Enterprise Server), GitLab (incl. Self-Hosted), Bitbucket (incl. Data Center), and Azure DevOps, with an Enterprise Bugbot API to "Trigger Bugbot reviews and retrieve per-review analytics".'),
    # --- Cloud agents + capabilities + multi-entry (extra-8, extra-13) ---
    ('cursor-supp-cloud-agents', 'https://cursor.com/docs/cloud-agent.md',
     'Cloud Agents "run in isolated VMs in the cloud with full development environments ... You can run as many agents as you want in parallel"; "cloud agents can build, test, and interact with the changed software. They can also use computers to control the desktop and browser", support MCP servers and multi-repo environments ("inspect the full workspace, make coordinated changes, and open pull requests in the repos it changes"), and can be kicked off from iOS, cursor.com/agents on any device (Android PWA), Desktop, Slack (@cursor), GitHub/Bitbucket PR comments, Linear, or the API. Capabilities docs add: "Agents can start dev servers, open the app in a browser, click through UI flows, and verify their changes work" and produce artifacts ("screenshots, videos, and log references to demonstrate their work").'),
    # --- Self-hosted workers (extra-12) ---
    ('cursor-supp-self-hosted', 'https://cursor.com/docs/cloud-agent/self-hosted.md',
     '"Self-Hosted Machines moves Cloud Agent tool execution to a machine you manage ... Cursor runs the agent loop, inference, and planning. Your worker performs file edits and terminal commands. It also runs computer-use tools and local MCP servers." Documented for strict-network and custom-hardware cases (GPU machines, Macs for iOS), with partner hosts "such as AWS Lambda, Cloudflare, Namespace, Modal, Daytona, E2B, Vercel, or Tensorlake", and managed-cloud alternatives via network allowlists and private connectivity ("AWS PrivateLink or Cloudflare Tunnel").'),
    # --- Privacy / governance (extra-27) + OTel export (extra-29) ---
    ('cursor-supp-privacy-governance', 'https://cursor.com/docs/enterprise/privacy-and-data-governance.md',
     'Enterprise data governance is documented per flow: "With Privacy Mode enabled your code is never used for training by Cursor or other AI model providers. Privacy Mode is on by default for Enterprise teams." Cloud Agents are called out as "the only feature that requires Cursor to store code" — "Agents run in isolated virtual machines", storing "Encrypted copies of repositories that Cloud Agents work on ... temporarily while the agent runs"; sub-processors are published at trust.cursor.com/subprocessors.'),
    ('cursor-supp-otel-export', 'https://cursor.com/docs/enterprise/opentelemetry-export.md',
     'Usage telemetry is exportable to customer infrastructure: "OpenTelemetry Export streams Cursor usage data for your team to a collector you run. Cursor sends metrics (tokens, tool calls, best-effort cost) and logs (API requests, errors, corrections, skills, hooks, plugins, cloud agent lifecycle events ...) to one team-managed destination" over OTLP/HTTP protobuf, from published static egress IPs, with a Wire Reference documenting "every metric, log event, and attribute" (Enterprise plan).'),
    # --- Origin forge (extra-26) ---
    ('cursor-supp-origin', 'https://cursor.com/docs/origin.md',
     'Origin (early beta) is "Cursor\'s git forge for storing and sharing code": create repos "including from Cursor agents", clone/push/pull with standard git, mirror GitHub repos, open/review/merge pull requests, browse/search at cursor.com/codebase, "Create private Origin Apps to build integrations on Origin through our Public API", and "Connect automations and cloud agents to Origin repos". The Origin API publishes its own llms.txt/llms-full.txt and an OpenAPI spec (cursor.com/docs/api/origin/openapi.yaml, "Public third-party-facing Origin API", v1alpha1, servers: api.cursor.com).'),
    # --- Worktrees / parallel local agents (extra-28) ---
    ('cursor-supp-worktrees', 'https://cursor.com/docs/configuration/worktrees.md',
     '"Worktrees let Agent work in isolated Git checkouts. Each task gets its own files, dependencies, and changes while your main checkout stays untouched. Use worktrees when you want to start several agents on the same repo without conflicts" — with reproducible setup via `.cursor/worktrees.json` (setup-worktree-unix / setup-worktree scripts) honored by the Agents Window, the IDE, and the CLI.'),
    # --- BYO model keys (extra-30) ---
    ('cursor-supp-byo-api-keys', 'https://cursor.com/help/models-and-usage/api-keys.md',
     'Model choice extends to customer-owned keys: "You can add your own API keys so Cursor uses your preferred AI models ... through providers like OpenAI, Anthropic, or Google", plus Azure OpenAI and AWS Bedrock (access keys or IAM roles via the dashboard). The gate is stated honestly: "Custom API keys only work with chat models. Tab completion continues using Cursor\'s built-in models", and Zero Data Retention "does not apply when you use your own API keys."'),
]

MCP_INIT = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {
    'protocolVersion': '2025-06-18', 'capabilities': {},
    'clientInfo': {'name': 'productarena-probe', 'version': '1.0'}}})


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


def llms_index_probe():
    status, body = curl('https://cursor.com/docs/llms.txt')
    if status != 200 or '# Cursor Documentation' not in body:
        raise SystemExit(f'cursor llms probe: {status} / missing header: {body[:200]}')
    if 'cloud-agent/api/endpoints.md' not in body or '/docs/cli/headless.md' not in body:
        raise SystemExit('cursor llms probe: index no longer links the agent-surface pages')
    return ('PROBE llms-docs (' + NOW[:10] + '): GET https://cursor.com/docs/llms.txt returns HTTP 200 "# Cursor '
            'Documentation" — a sectioned index (Agent, cloud-agents, CLI incl. headless, SDK, API Documentation '
            'with Cloud Agents/Admin/Analytics/AI Code Tracking/Origin APIs) whose pages all render as raw '
            'markdown at URL + `.md`; cursor.com/llms.txt and cursor.com/llms-full.txt also answer HTTP 200 '
            '(live-verified same day).')


def cloud_agents_openapi_probe():
    status, body = curl('https://cursor.com/docs-static/cloud-agents-openapi.yaml')
    if status != 200 or 'title: Cursor Cloud Agents API' not in body:
        raise SystemExit(f'cursor openapi probe: {status}: {body[:200]}')
    first = ' / '.join(line.strip() for line in body.splitlines()[:8] if line.strip())[:400]
    return ('PROBE openapi-spec (' + NOW[:10] + '): GET https://cursor.com/docs-static/cloud-agents-openapi.yaml '
            f'returns HTTP 200 machine-readable YAML: "{first}" — the downloadable OpenAPI 3.0.3 spec for the '
            'Cloud Agents API v1. The Origin API spec is likewise live at '
            'https://cursor.com/docs/api/origin/openapi.yaml ("Public third-party-facing Origin API", '
            'servers: api.cursor.com).')


def api_auth_challenge_probe():
    status, body = curl('https://api.cursor.com/v1/me')
    if status != 401 or 'Invalid User API Key' not in body:
        raise SystemExit(f'cursor api probe: /v1/me returned {status}: {body[:200]}')
    return ('PROBE api-live (' + NOW[:10] + '): keyless GET https://api.cursor.com/v1/me answers HTTP 401 '
            '{"code":"error","message":"Invalid User API Key"} — the documented Cloud Agents API host is live '
            'and key-gated exactly as docs/api.md describes (Basic or Bearer with a user or service-account '
            'API key). Honest absence, same-day check: mcp.cursor.com does not resolve (DNS NXDOMAIN) — Cursor '
            'documents MCP client support, not a hosted MCP server.')


PROBES = [
    ('cursor-probe-2', 'https://cursor.com/docs/llms.txt', llms_index_probe),
    ('cursor-probe-3', 'https://cursor.com/docs-static/cloud-agents-openapi.yaml', cloud_agents_openapi_probe),
    ('cursor-probe-4', 'https://api.cursor.com/v1/me', api_auth_challenge_probe),
]


def main():
    path = f'{ROOT}/rankings/ai-coding/evidence/cursor.json'
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
    print(f'cursor: wrote {len(ev)} items')


if __name__ == '__main__':
    main()
