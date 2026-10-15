#!/usr/bin/env python3
# Hot-repos fairness wave (2026-09-15): identical supplement recipe to the Stripe agentic-
# capability spike (append-payments-stripe-agentic-evidence.py, 771a7510) and the payments
# fairness wave (append-payments-fairness-agentic-evidence.py, 277a7797), applied to
# serverless-databases/neon. This wave's crawl added 24 agent-surface urls.extra pages
# (neon.com/auth.md agent-claim flow, the CLI's agent-setup subcommands, Agent Skills, the
# hosted MCP server's tool/scoping docs, AI Gateway, Functions-for-agents, neon.ts,
# branching-for-agents, API-key scoping, the Management API llms.txt endpoint index); the
# monotonic re-extract surfaced 18 mostly one-line items. These verbatim passages quote the
# CRAWLED pages (rankings-engine/cache/crawl/serverless-databases/neon/*, fetched 2026-09-15) for
# content the per-source extraction caps starved out.
#
# Verified-honest counterparts (NO doc items added, on purpose):
#   - The hosted MCP server is OAuth/API-key gated; keyless access gets only the 401 challenge
#     (that's what neon-probe-6 records — no agent-washing it into "open access").
#   - The local stdio MCP package (@neondatabase/mcp-server-neon) is DEPRECATED in favor of the
#     hosted server; quoted as such. The /sse transport is deprecated with a documented
#     2026-10-01 retirement.
#   - AI Gateway and Neon Functions are Beta and region-limited (aws-us-east-2 /
#     aws-eu-central-1); frontier models are "rolling out gradually" behind early access —
#     labels kept verbatim.
#   - SQL Editor AI shares "no actual data", schema only — quoted with its scope intact.
#   - No undocumented mcp.* hosts beyond mcp.neon.tech were found (mcp.neon.tech/mcp is the
#     documented endpoint; /api/list-tools is documented on the MCP overview page).
#   - openness-*/privacy-* axes: out of this wave's scope; no supplements added there.
#
# Run AFTER `pnpm engine extract --product neon` (extract is monotonic and dedups by
# normalized excerpt). If a probe stage ever wholesale-replaces probe-tier items, re-run this
# script to restore neon-probe-6/7/8.
import datetime
import json
import subprocess

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

MCP_INIT = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {
    'protocolVersion': '2025-06-18', 'capabilities': {},
    'clientInfo': {'name': 'productarena-probe', 'version': '1.0'}}})

DOC_ITEMS = [
    # --- Hosted MCP server tool surface (extra-5 docs/ai/neon-mcp-server.md) ---
    ('neon-supp-mcp-tool-surface', 'https://neon.com/docs/ai/neon-mcp-server',
     'The hosted Neon MCP Server exposes a 113-tool surface ("Tools preview: 113 enabled") spanning the whole platform: SQL ("Run SQL", "Run SQL Transaction", "Explain SQL Statement", "List Slow Queries", "Inspect Database"), schema work ("Prepare Database Migration", "Complete Database Migration", "Compare database schema"), project/branch lifecycle (create/update/delete project, "Recover a deleted project", create/reset/restore branches, "Finalize branch restore from snapshot"), snapshots (create/restore/schedule), compute endpoints (create/start/suspend/restart), Neon Auth (enable/disable, OAuth providers, auth users), the Data API, Neon Functions ("Deploy code to a function", triggers, custom domains), Object Storage (buckets, objects, presigned uploads), scoped credentials ("Issue a scoped credential on the branch", revoke, rotate), branch logs, and the branch AI Gateway endpoint — plus "Search" and "Fetch" navigation tools.'),
    ('neon-supp-mcp-scoping-readonly', 'https://neon.com/docs/ai/neon-mcp-server',
     'The MCP server ships documented least-privilege controls: a read-only mode via `?readonly=true` ("Limit tools to read-safe actions. Good default for exploration"), tool-category scoping via repeatable `?category=<name>` parameters (e.g. `https://mcp.neon.tech/mcp?category=querying&category=schema`), and a project-scoped mode ("Project ID (optional): Scopes the agent to a single project. Hides project-wide management tools"). Configurations are verifiable keylessly: "To verify which tools are active for a given config without authenticating: curl \\"https://mcp.neon.tech/api/list-tools?readonly=true&category=querying\\"". The hosted server also publishes the static egress IPs it connects from.'),
    ('neon-supp-mcp-transport', 'https://neon.com/docs/ai/neon-mcp-server',
     'Transport and packaging are explicit: "The hosted Neon MCP Server uses Streamable HTTP at `https://mcp.neon.tech/mcp`. The older HTTP+SSE endpoint (`https://mcp.neon.tech/sse`) is deprecated and will stop working on or after October 1, 2026... SSE is not supported with API key authentication." "The local stdio package (`@neondatabase/mcp-server-neon`) is deprecated. Use the hosted server" — clients that only speak stdio bridge via `npx -y mcp-remote@latest https://mcp.neon.tech/mcp`. The `inspect_database` tool "runs inside a read-only transaction" and exposes the same 15 read-only checks as `neon inspect db` (table/index sizes, unused indexes, stalled queries with waits and blockers, cache hit rate, bloat, replication state).'),
    # --- Agent-claim / claimable flow (extra-17 neon.com/auth.md, extra-35 claimable reference) ---
    ('neon-supp-agent-claim-flow', 'https://neon.com/auth.md',
     'neon.com/auth.md is an agent-addressed provisioning runbook: "You need a Neon project and no human is signed in. Provision now. A human claims it later if they want to keep it." The CLI path is `neon claim create` (reads neon.ts, "The CLI writes `DATABASE_URL` (and granted service URLs) to `.env` or `.env.local`"); the REST path registers an anonymous agent identity at `POST https://claimable.neon.tech/v1/agent/identity` ({"type":"anonymous","capabilities":["postgres","data_api","auth"],"source":"your-agent"}), returns a durable `identity_assertion` ("Store it like an API key"), exchanges it for short-lived bearer tokens via an RFC 7523 jwt-bearer grant, and hands the human a `verification_uri_complete` to claim the project ("The unclaimed project dies at `expires_at` (72 hours today)").'),
    # --- Config as code (extra-34 docs/reference/neon-ts.md) ---
    ('neon-supp-neon-ts-config', 'https://neon.com/docs/reference/neon-ts.md',
     '"`neon.ts` is a TypeScript config file you commit to your repository. It declares which Neon services exist on your project and how each branch is configured" — static service declarations (`auth`, `dataApi`, preview services like Functions, Storage, AI Gateway) plus a `branch` closure for per-branch tuning (TTLs like `{ ttl: "7d" }` for auto-expiring branches, compute sizing, protected status). "neon.ts itself is declarative: it only describes the policy. `neon config` / `neon deploy` (below) are how the CLI runs it. To call the same `inspect` / `plan` / `apply` logic from your own script or CI job instead of the CLI, see `@neon/config-runtime`."'),
    # --- CLI agent-setup subcommands (extra-26 init, extra-27 mcp, extra-28 skills, extra-29 plugins) ---
    ('neon-supp-cli-agent-setup', 'https://neon.com/docs/cli/init.md',
     'The Neon CLI ships a family of agent-setup subcommands: "The `init` command sets up the current directory to use Neon with your AI coding assistant... it installs agent tooling (either the Neon plugin, or agent skills and the Neon MCP server), links a Neon project, and can write a `neon.ts` config"; `neon mcp` "installs the Neon MCP Server into your coding agents by writing their MCP config files"; `neon plugins` installs the Neon plugin ("which bundles the MCP server and agent skills") into "agents that support plugin marketplaces (such as Cursor, Claude Code, and Codex)"; and `neon skills` installs agent skills. The supported agent list is explicit: "antigravity, cline, cline-cli, claude-code, claude-desktop, codex, cursor, gemini-cli, goose, github-copilot-cli, grok-build, opencode, vscode, windsurf, and zed". For unattended use, "pass -y and --agent for an unattended agent setup".'),
    ('neon-supp-agent-skills', 'https://neon.com/docs/ai/agent-skills.md',
     '"Agent Skills are structured context files (SKILL.md) that give AI coding assistants accurate knowledge of Neon\'s platform, APIs, SDKs, and best practices... Skills cover Postgres, Auth, Neon Functions, Object Storage, AI Gateway, branching workflows, and more." Install paths: `neon skills` (interactive, pre-selects detected agents), `neon plugins` (bundles skills + MCP server), or — "For any AI tool that supports the Agent Skills format" — `npx skills add neondatabase/agent-skills -y` from the public github.com/neondatabase/agent-skills repository; `neon skills update` refreshes installed skills to their latest versions.'),
    # --- Terminal docs assistant (extra-24 cli/ask.md) ---
    ('neon-supp-cli-ask', 'https://neon.com/docs/cli/ask.md',
     'The CLI has a built-in assistant: "The `ask` command sends a question to the Neon assistant and prints the answer to your terminal: `neon ask --prompt \\"<question>\\"`. The assistant answers from Neon\'s documentation... No login is required, and it doesn\'t touch your projects or account." For scripted/agent use, "`--output json` and `--output yaml` both return the full answer at once as a single `text` field, instead of streaming markdown."'),
    # --- AI Gateway (extra-32 docs/ai-gateway/overview.md) ---
    ('neon-supp-ai-gateway', 'https://neon.com/docs/ai-gateway/overview.md',
     '"Neon AI Gateway is the LLM gateway built into the Neon backend. One Neon credential gives you access to models across multiple providers. Standard AI SDKs work without code changes. Each branch gets its own gateway endpoint." It "serves frontier models like GPT (`gpt-5`) and Gemini (`gemini-3-flash`) alongside open-weight models like Qwen and gpt-oss". Honest gates kept verbatim: "AI Gateway is in beta and currently available in AWS US East (Ohio) (`aws-us-east-2`) and AWS Europe (Frankfurt) (`aws-eu-central-1`)"; "Frontier models from OpenAI and Google are rolling out gradually."'),
    # --- Functions as an agent runtime (extra-33 docs/compute/functions/agents.md) ---
    ('neon-supp-functions-agents', 'https://neon.com/docs/compute/functions/agents.md',
     '"Neon Functions are a long-running home for AI agents. A single request can stream a response for minutes while the agent calls models and tools, with the Neon AI Gateway wired in automatically and Postgres next to your code." Unlike "lambda-style serverless [that] caps execution at roughly 10 to 60 seconds", Neon Functions "begin responding within 15 minutes, then keep an active stream open while data flows (send at least one byte every 15 minutes on a quiet stream)". "Declare the AI Gateway and the function in `neon.ts`. `neon deploy` provisions the gateway and injects its credentials at runtime". Beta label kept: "The Neon Functions is in Beta."'),
    # --- Fleet-scale agent platforms (extra-31 branching/branching-for-agents.md) ---
    ('neon-supp-branching-for-agents', 'https://neon.com/branching/branching-for-agents.md',
     'Neon documents the database-per-agent/per-user pattern as a first-class workload: "Full-stack agentic platforms, codegen tools, CMS builders, and internal developer platforms need to provision databases per user, per app, or per version... Neon supports a project-per-user model at large scale. Platforms can manage tens of thousands (in some cases, millions) of projects programmatically through the Neon API. Project creation, configuration, and cleanup are fully automated, and because Neon resources are ephemeral by design, idle databases don\'t incur ongoing compute overhead." Snapshots serve as agent checkpoints: "Snapshots capture precise versions of schema and data; Restores allow platforms to move between versions instantly."'),
    # --- Scoped API keys (extra-37 docs/manage/api-keys.md) ---
    ('neon-supp-api-key-scoping', 'https://neon.com/docs/manage/api-keys.md',
     'Neon API keys come in three documented scopes: "Personal API Key (Any user; All organization projects where the user is a member), Organization API Key (Organization administrators; All projects within the organization), Project-scoped API Key (Organization administrators; Single specified project)". "Each key\'s secret is shown only once at creation... revocation is immediate and permanent", keys are "valid until revoked", and "Only organization Admins can create organization or project-scoped keys."'),
    # --- Machine-readable API index (extra-36 docs/reference/api/llms.txt) ---
    ('neon-supp-api-llms-index', 'https://neon.com/docs/reference/api/llms.txt',
     'The Management API ships an LLM-addressed endpoint index at docs/reference/api/llms.txt: "# Neon Management API / Base URL: https://console.neon.tech/api/v2 / Auth: `Authorization: Bearer $NEON_API_KEY`", grouping every endpoint by resource with a per-endpoint .md page (e.g. "Get branch AI Gateway endpoint `GET /projects/{project_id}/branches/{branch_id}/ai_gateway`", "Create API key `POST /api_keys`") and linking the machine-readable OpenAPI spec at neon.com/api_spec/release/v2.json "for request/response validation and codegen".'),
    # --- In-product AI, honest scope (extra-39 docs/security/ai-use-in-neon.md) ---
    ('neon-supp-sql-editor-ai', 'https://neon.com/docs/security/ai-use-in-neon.md',
     '"The Neon SQL Editor includes AI-powered features to assist with writing, optimizing, and generating names for SQL queries. To enable these capabilities, we share your database schema with the AI agent, but no actual data is shared. Neon currently uses Amazon Bedrock as the LLM provider for the Neon SQL Editor." Neon also "provides AI-powered chat assistance across multiple platforms" drawing on "public sources such as Neon docs and GitHub repos without ingesting PII."'),
    # --- Auth webhooks (extra-38 docs/auth/guides/webhooks.md, extra-40 auth/overview.md) ---
    ('neon-supp-auth-webhooks', 'https://neon.com/docs/auth/guides/webhooks.md',
     'Managed Better Auth (part of the Neon backend) emits authentication events to customer endpoints: webhooks let you "Handle authentication events with custom server logic", including "letting you replace the built-in email provider with custom delivery channels (SMS, WhatsApp, custom SMTP)". Per the Auth overview, "Every database branch gets its own isolated auth environment, so you can test sign-up, login, and OAuth flows" per branch.'),
    # --- Copilot agents (extra-23 docs/ai/ai-github-copilot-agents.md) ---
    ('neon-supp-copilot-agents', 'https://neon.com/docs/ai/ai-github-copilot-agents.md',
     'Neon ships "custom agents for safe database migrations and query optimization in VS Code" for GitHub Copilot: the documented pattern has the agents "run safe schema migrations and query optimizations on temporary Neon branches, keeping production untouched" until changes are verified.'),
]

PROBES = []


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


def mcp_oauth_probe():
    """Live-verify the hosted MCP server's keyless behavior: a bare JSON-RPC initialize gets an
    HTTP 401 with an RFC 9728 www-authenticate resource_metadata pointer, and that metadata
    resolves with authorization_servers. Fails loudly if reality changes."""
    base = 'https://mcp.neon.tech'
    status, raw = curl(f'{base}/mcp', method='POST',
                       headers=['Content-Type: application/json',
                                'Accept: application/json, text/event-stream'],
                       data=MCP_INIT, include_headers=True)
    if status != 401 or 'resource_metadata' not in raw:
        raise SystemExit(f'neon mcp probe: keyless initialize returned {status} without resource_metadata: {raw[:300]}')
    meta_url = f'{base}/.well-known/oauth-protected-resource/mcp'
    status2, meta = curl(meta_url)
    if status2 != 200 or '"authorization_servers"' not in meta:
        raise SystemExit(f'neon mcp probe: protected-resource metadata returned {status2}: {meta[:200]}')
    meta_json = json.loads(meta)
    return ('PROBE mcp-oauth (' + NOW[:10] + f'): keyless JSON-RPC initialize to {base}/mcp answers HTTP 401 with '
            'www-authenticate: Bearer error="invalid_token", error_description="No authorization provided", '
            'resource_metadata=' + meta_url + '; that metadata (HTTP 200) publishes ' + json.dumps(meta_json) +
            ' — a live, OAuth-gated remote MCP server per the MCP authorization spec.')


def mcp_list_tools_probe():
    """Live-verify the documented keyless tool-inventory endpoint with read-only + category scoping."""
    url = 'https://mcp.neon.tech/api/list-tools?readonly=true&category=querying'
    status, body = curl(url)
    if status != 200 or '"run_sql"' not in body or '"readOnly":true' not in body.replace(' ', ''):
        raise SystemExit(f'neon list-tools probe: {url} returned {status} or unexpected body: {body[:200]}')
    data = json.loads(body)
    names = [t['name'] for t in data['tools']]
    notice = (data.get('notices') or [''])[0][:220]
    return ('PROBE mcp-list-tools (' + NOW[:10] + f'): GET {url} returns HTTP 200 keylessly with '
            + json.dumps({'grant': data.get('grant'), 'readOnly': data.get('readOnly')}) +
            f' and the scoped tool list {json.dumps(names)} — every tool carries "readOnlySafe": true and JSON-Schema '
            f'inputs, and the server injects guardrail notices verbatim: "{notice}..." (documented on '
            'docs/ai/neon-mcp-server as the way "to verify which tools are active for a given config without authenticating").')


def api_llms_index_probe():
    """Live-verify the Management API's llms.txt endpoint index."""
    url = 'https://neon.com/docs/reference/api/llms.txt'
    status, body = curl(url)
    if status != 200 or '# Neon Management API' not in body or 'api_spec/release/v2.json' not in body:
        raise SystemExit(f'neon api llms probe: {url} returned {status} or missing markers: {body[:200]}')
    first = ' / '.join(line for line in body.splitlines()[:6] if line.strip())[:300]
    return ('PROBE llms-docs (' + NOW[:10] + f'): GET {url} returns HTTP 200; opening lines: "{first}" — an '
            'LLM-addressed index of every Management API endpoint with per-endpoint .md pages and the OpenAPI spec '
            'link (neon.com/api_spec/release/v2.json).')


PROBES = [
    ('neon-probe-6', 'https://mcp.neon.tech/mcp', mcp_oauth_probe),
    ('neon-probe-7', 'https://mcp.neon.tech/api/list-tools?readonly=true&category=querying', mcp_list_tools_probe),
    ('neon-probe-8', 'https://neon.com/docs/reference/api/llms.txt', api_llms_index_probe),
]


def main():
    path = 'open-rankings/serverless-databases/evidence/neon.json'
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
    print(f'neon: wrote {len(ev)} items')


if __name__ == '__main__':
    main()
