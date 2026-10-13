#!/usr/bin/env python3
# Hot-repos fairness wave (2026-09-15): Stripe-style exhaustive agentic-surface evidence pass for
# backend-as-a-service/supabase — same supplement recipe as
# append-payments-fairness-agentic-evidence.py (commit 277a7797). This wave's crawl added 19
# supabase agent-surface urls.extra pages (ai-tools stack, MCP .md mirror, plugins, agent skills,
# byo-mcp, webhooks/cron/queues, backups/PITR, FTS, image transforms, api-keys, MFA/SAML,
# advisors, security, logs, dashboard AI assistant); the monotonic extract surfaced ~23 mostly
# one-line items from them. This script appends the verbatim passages the per-source extraction
# caps starved out, plus 2 live keyless probes that fail loudly if reality changes.
#
# Every URL below is in supabase's products.json urls (or is the live endpoint a probe verifies);
# every excerpt quotes the crawled/live page (crawl + live checks ran 2026-09-15).
#
# Verified-honest counterparts (NO doc items added, on purpose):
#   - no first-party offline-first sync product is documented (offline-first-sync stands as
#     judged; community options like PowerSync are third-party).
#   - no public API deprecation/versioning-policy page was found (Management API is /v1 and the
#     Data API rides PostgREST, but there is no documented deprecation policy) —
#     api-versioning-policy is left to the judge with no supplement.
#   - the CI/PAT path to the MCP server is quoted WITH its coarse-grained caveat ("for now all
#     scopes are required"); the 13 granular OAuth scopes shown by probe-10 apply to the OAuth
#     login flow, not PATs.
#
# Run AFTER `pnpm pipeline extract --category backend-as-a-service --product supabase` (extract
# is monotonic and dedups by normalized excerpt, so re-running extract keeps these items stable).
import datetime
import json
import subprocess

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

MCP_INIT = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {
    'protocolVersion': '2025-06-18', 'capabilities': {},
    'clientInfo': {'name': 'productarena-probe', 'version': '1.0'}}})

DOC_ITEMS = [
    # --- MCP server full documented surface (extra-13 ai-tools/mcp.md) ---
    ('supabase-supp-mcp-tool-groups', 'https://supabase.com/docs/guides/ai-tools/mcp.md',
     'The Supabase MCP server "provides tools organized into feature groups. All groups except Storage are enabled by default": Database (`list_tables`, `list_extensions`, `list_migrations`, `apply_migration`, `execute_sql`), Debugging (`query_logs` — "Run a read-only SQL query against project logs to filter, aggregate, or join across log fields", `get_advisors` — "Get security and performance advisors"), Development (`get_project_url`, `get_publishable_keys`, `generate_typescript_types`), Edge Functions (`list_edge_functions`, `get_edge_function`, `deploy_edge_function`), Account management (`list_projects`/`get_project`, `create_project`/`pause_project`/`restore_project`, `list_organizations`/`get_organization`, `get_cost`/`confirm_cost` — "Disabled when using project-scoped mode"), Docs (`search_docs`), experimental Branching (`create_branch`/`list_branches`/`delete_branch`, `merge_branch`/`reset_branch`/`rebase_branch`), and Storage (disabled by default: `list_storage_buckets`, `get_storage_config`/`update_storage_config`).'),
    ('supabase-supp-mcp-config-params', 'https://supabase.com/docs/guides/ai-tools/mcp.md',
     'The hosted MCP server is configured per-connection via URL query parameters: "`read_only=true` — Execute all queries as a read-only Postgres user; `project_ref=<id>` — Scope to a specific project (disables account tools); `features=<groups>` — Enable only specific tool groups (comma-separated)... Parameters can be combined: https://mcp.supabase.com/mcp?project_ref=abc123&read_only=true". The same server ships locally with the CLI: "When using Supabase CLI for local development, the MCP server is available at http://localhost:54321/mcp."'),
    ('supabase-supp-mcp-agent-security', 'https://supabase.com/docs/guides/ai-tools/mcp.md',
     'The MCP docs prescribe autonomous-agent guardrails explicitly: "An unattended monitoring routine cannot request approval during each run. Approve in advance only the project-scoped, read-only tools that the routine needs. The routine must stop and report a recommendation instead of running a write operation." For CI, "you can create a personal access token (PAT) with the necessary scopes and pass it as a header to the MCP server" ("Grant write access to all of the available scopes. In the future, the MCP server will support more fine-grained scopes, but for now all scopes are required"). Documented mitigations include read-only mode ("executes SQL queries as a read-only Postgres user"), branching ("test changes in a safe environment before merging them to production"), and feature groups ("reduce the attack surface and limits the actions that LLMs can perform").'),
    # --- The four-layer agent-tools stack (extra-12 ai-tools.md) ---
    ('supabase-supp-ai-tools-stack', 'https://supabase.com/docs/guides/ai-tools.md',
     'Supabase documents a four-layer agent stack: "MCP (Model Context Protocol): a live connection between your agent and your actual Supabase project. Once connected, your agent can call tools to query data, run migrations, deploy Edge Functions, and more. Agent Skills: portable, on-demand instructions your agent loads when it needs Supabase- or Postgres-specific procedural knowledge... Plugin: a single install that bundles the MCP server and Agent Skills together for a specific agent. Prompts: static prompt files you copy into your project for agents that don\'t support MCP, plugins, or skills natively." Per-agent setup is documented for Antigravity, Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, Grok, Kimi Code, omp, VS Code, Warp and more, and "See how these tools perform on real Supabase tasks in Supabase Evals, our open-source benchmark for AI coding agents."'),
    ('supabase-supp-agent-plugin', 'https://supabase.com/docs/guides/ai-tools/plugins.md',
     'The Supabase Plugin for AI Coding Agents "bundles the Supabase MCP server and Supabase agent skills so your agent can query your database, manage migrations, deploy Edge Functions, and follow Supabase and Postgres best practices — without manual configuration." Quick install: `npx plugins add supabase-community/supabase-plugin` — "The plugins package auto-detects your installed AI coding agents and installs the Supabase plugin to all of them with one command."'),
    ('supabase-supp-agent-skills', 'https://supabase.com/docs/guides/ai-tools/ai-skills.md',
     '"Agent Skills are folders of instructions, scripts, and resources that agents can discover and use to do things more accurately and efficiently... Skills solve this by giving agents access to procedural knowledge and company-, team-, and user-specific context they can load on demand." Install: `npx skills add supabase/agent-skills` (or `--skill SKILL_NAME` for one skill); "Skills are installed at project scope by default, placing them in your repository so contributors and cloud agents all share the same setup. Pass `--global` to install across all your projects instead", and "--all" adds skills for all detected agents at once.'),
    ('supabase-supp-byo-mcp', 'https://supabase.com/docs/guides/ai-tools/byo-mcp.md',
     'Supabase also documents the platform side of MCP: "Build and deploy Model Context Protocol (MCP) servers on Supabase using Edge Functions" — "Host your own MCP server on Supabase Edge Functions so your users can connect their AI agents to your product" (auth support for MCP on Edge Functions is quoted as "coming soon").'),
    # --- Eventing + automation primitives (extra-18/19/20 webhooks/cron/queues) ---
    ('supabase-supp-db-webhooks', 'https://supabase.com/docs/guides/database/webhooks.md',
     '"Database Webhooks allow you to send real-time data from your database to another system whenever a table event occurs. You can hook into three table events: `INSERT`, `UPDATE`, and `DELETE`. All events are fired *after* a database row is changed" — implemented as "a convenience wrapper around triggers using the pg_net extension", with payloads delivered as HTTP requests to any endpoint (including Edge Functions).'),
    ('supabase-supp-cron', 'https://supabase.com/docs/guides/cron.md',
     '"Supabase Cron is a Postgres Module that simplifies scheduling recurring Jobs with cron syntax and monitoring Job runs inside Postgres. Cron Jobs can be created via SQL or the Integrations -> Cron interface inside the Dashboard, and can run anywhere from every second to once a year... Every Job can run SQL snippets or database functions with zero network latency or make an HTTP request, such as invoking a Supabase Edge Function."'),
    ('supabase-supp-queues', 'https://supabase.com/docs/guides/queues.md',
     '"Supabase Queues is a Postgres-native durable Message Queue system with guaranteed delivery built on the pgmq database extension... Queues couples the reliability of Postgres with the simplicity Supabase\'s platform and developer experience, enabling developers to manage Background Tasks with zero configuration."'),
    # --- Backups/PITR (extra-21) ---
    ('supabase-supp-backups-pitr', 'https://supabase.com/docs/guides/platform/backups.md',
     '"We automatically back up all Pro, Team, and Enterprise Plan projects on a daily basis" (7/14/up-to-30 days of daily backups by plan), and "Point-in-Time Recovery (PITR) allows you to back up a project at shorter intervals, giving you the option to restore to any chosen point with up to seconds of granularity... With PITR, you can back up to the point of disaster" (PITR is a Pro/Team/Enterprise add-on; "a combination of physical backups and Write Ahead Log (WAL) file archiving makes PITR possible").'),
    # --- Built-in FTS + image pipeline (extra-22/23) ---
    ('supabase-supp-fulltext-search', 'https://supabase.com/docs/guides/database/full-text-search.md',
     '"Postgres has built-in functions to handle Full Text Search queries. This is like a \'search engine\' within Postgres" — the guide documents `to_tsvector`/`to_tsquery` usage, match operators, and search-column indexing directly against the project database, with no external search service.'),
    ('supabase-supp-image-transformations', 'https://supabase.com/docs/guides/storage/serving/image-transformations.md',
     '"Supabase Storage offers the functionality to optimize and resize images on the fly. Any image stored in your buckets can be transformed and optimized for fast delivery" (labeled: "Image Resizing is currently enabled for Pro Plan and above"), with transform options on signed/public URLs and client-library support.'),
    # --- Key model (extra-24 api-keys.md) ---
    ('supabase-supp-api-key-model', 'https://supabase.com/docs/guides/api/api-keys.md',
     'The API-key model is documented least-privilege by construction: "Anything you ship: browser, mobile app, CLI, script — Publishable key — Anyone can read it, so it only reaches what Row Level Security allows. Anything you control: server, Edge Function, cron job — Secret key — It bypasses Row Level Security, so it must never leave your control." Each key type maps to a distinct Postgres role, and the guide covers retrieval, wiring, and "rotating one that leaked."'),
    # --- MFA/SSO (extra-25/26) ---
    ('supabase-supp-auth-mfa', 'https://supabase.com/docs/guides/auth/auth-mfa.md',
     '"Multi-factor authentication (MFA), sometimes called two-factor authentication (2FA), adds an additional layer of security to your application" — Supabase Auth MFA for application users, with documented enrollment/challenge/verify flows and app-level enforcement guidance.'),
    ('supabase-supp-auth-saml-sso', 'https://supabase.com/docs/guides/auth/sso/auth-sso-saml.md',
     '"Supabase Auth supports enterprise-level Single Sign-On (SSO) for any identity providers compatible with the SAML 2.0 protocol" — documented providers include "Google Workspaces (formerly known as G Suite), Okta, Auth0", Microsoft Entra/AD and more, for project end-users (dashboard-org SSO is documented separately at guides/platform/sso).'),
    # --- Advisors as an agent surface (extra-27) ---
    ('supabase-supp-advisors-agent-surface', 'https://supabase.com/docs/guides/database/database-advisors.md',
     'Advisors are "Deterministic security and performance findings you or an agent can pull as part of ongoing observability... programmatic checks that ship with the platform. They inspect the live schema and return deterministic findings, such as missing indexes or incorrectly configured RLS policies." Documented access is agent-symmetric: "You or an agent can pull the same checks from: Studio (Security Advisor and Performance Advisor), MCP (`get_advisors`), CLI (`supabase db advisors`), Management API (security advisors and performance advisors)."'),
    # --- Compliance (extra-28 security.md) ---
    ('supabase-supp-compliance', 'https://supabase.com/docs/guides/security.md',
     '"Supabase is SOC 2 Type 2 compliant and regularly audited. All projects at Supabase are governed by the same set of compliance controls", with a SOC 2 Compliance Guide and a HIPAA Compliance Guide — "Additional security and compliance controls for projects that deal with electronic Protected Health Information (ePHI) and require HIPAA compliance are available through the HIPAA add-on."'),
    # --- Telemetry opt-out (extras[1] CLI getting-started page, ## Telemetry section) ---
    ('supabase-supp-telemetry-optout', 'https://supabase.com/docs/guides/local-development/cli/getting-started',
     '"The Supabase CLI collects telemetry data about general usage. Participating in this program is optional, and you can opt out at any time... You can disable telemetry by running: `supabase telemetry disable`" (plus `supabase telemetry status`/`enable`), and "You can also opt out using the `SUPABASE_TELEMETRY_DISABLED=1` environment variable. The broader `DO_NOT_TRACK=1` convention is also respected."'),
    # --- Dashboard AI assistant (extra-30 features/ai-assistant) ---
    ('supabase-supp-ai-assistant', 'https://supabase.com/features/ai-assistant',
     '"Supabase AI Assistant is integrated into the Supabase Dashboard to drastically improve your database management experience... when designing a new database schema, it can generate all necessary SQL queries based on your specifications... If you encounter an error in your SQL code, the Assistant can quickly analyze the issue and suggest solutions... while working on a specific table, the Assistant can provide instant feedback and recommendations tailored to that context." The Edge Functions docs add a delegation path: "You can also use Supabase\'s AI Assistant to generate and deploy functions automatically. Go to your project > Deploy a new function > Via AI Assistant."'),
    # --- Machine-readable docs index for agents (live llms.txt; verified alongside probe-1) ---
    ('supabase-supp-llms-agent-resources', 'https://supabase.com/llms.txt',
     'supabase.com/llms.txt ends with an explicit "API and agent resources" section: "Supabase Management API OpenAPI spec (https://supabase.com/openapi.json): OpenAPI 3.0 description of the Management API for managing organizations, projects, branches, and configuration" and "Supabase MCP server (https://mcp.supabase.com/mcp): Streamable HTTP MCP endpoint, OAuth-protected, for managing projects, database schema, and queries from MCP clients" — plus per-language reference corpora for agents (llms/js.txt, dart, swift, kotlin, python, csharp, server, cli, api) and the full-corpus llms-full.txt.'),
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


def skills_wellknown_probe():
    """Live-verify the machine-discoverable agent-skills index (agentskills.io discovery spec)."""
    url = 'https://supabase.com/.well-known/agent-skills/index.json'
    status, body = curl(url)
    if status != 200 or 'schemas.agentskills.io/discovery' not in body:
        raise SystemExit(f'supabase skills probe: {url} returned {status}: {body[:200]}')
    data = json.loads(body)
    names = [s.get('name') for s in data.get('skills', [])]
    if 'supabase' not in names:
        raise SystemExit(f'supabase skills probe: no "supabase" skill in index: {names}')
    return ('PROBE skills-wellknown (' + NOW[:10] + f'): GET {url} returns HTTP 200 with '
            '"$schema": "' + data['$schema'] + '" and a Supabase-maintained skills catalog '
            f'(skills: {names}) — a machine-discoverable agent-skills index per the agentskills.io '
            'discovery spec, consumed by `npx skills add supabase/agent-skills`.')


def mcp_oauth_scopes_probe():
    """Live-verify the hosted MCP server's keyless OAuth challenge AND its published scope list."""
    status, raw = curl('https://mcp.supabase.com/mcp', method='POST',
                       headers=['Content-Type: application/json',
                                'Accept: application/json, text/event-stream'],
                       data=MCP_INIT, include_headers=True)
    if status != 401 or 'resource_metadata' not in raw:
        raise SystemExit(f'supabase mcp probe: keyless initialize returned {status} without resource_metadata: {raw[:300]}')
    meta_url = 'https://mcp.supabase.com/.well-known/oauth-protected-resource/mcp'
    status2, meta = curl(meta_url)
    if status2 != 200 or '"scopes_supported"' not in meta:
        raise SystemExit(f'supabase mcp probe: protected-resource metadata returned {status2}: {meta[:200]}')
    meta_json = json.loads(meta)
    return ('PROBE mcp-oauth-scopes (' + NOW[:10] + '): keyless JSON-RPC initialize to '
            'https://mcp.supabase.com/mcp answers HTTP 401 with www-authenticate resource_metadata='
            + meta_url + '; that metadata (HTTP 200) names the resource "' + meta_json.get('resource_name', '')
            + '", authorization_servers ' + json.dumps(meta_json.get('authorization_servers'))
            + ' and publishes granular OAuth scopes ' + json.dumps(meta_json.get('scopes_supported'))
            + ' — a live, OAuth-gated remote MCP server with a per-scope permission model (RFC 9728).')


PROBES = [
    ('supabase-probe-9', 'https://supabase.com/.well-known/agent-skills/index.json', skills_wellknown_probe),
    ('supabase-probe-10', 'https://mcp.supabase.com/mcp', mcp_oauth_scopes_probe),
]


def main():
    path = 'rankings/backend-as-a-service/evidence/supabase.json'
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
    print(f'supabase: wrote {len(ev)} items')


if __name__ == '__main__':
    main()
