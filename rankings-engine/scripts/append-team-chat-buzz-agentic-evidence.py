#!/usr/bin/env python3
# Hot-repos fairness wave (2026-09-15): the identical Stripe-spike supplement recipe
# (append-payments-stripe-agentic-evidence.py, 771a7510; append-payments-fairness-agentic-evidence.py,
# 277a7797) for team-chat/buzz. This wave's crawl added 15 buzz agent-surface urls.extra pages
# (AGENTS.md, NOSTR.md, VISION_AGENT/REMOTE_AGENTS, buzz-acp/buzz-agent/persona-pack/managed-skill,
# NIP-AA, admin API, agent benchmark, Helm chart, owned-agent discovery, git-credential-nostr,
# SECURITY.md); the extract run surfaced only 11 mostly one-line items from them. Every excerpt
# below quotes the crawled page verbatim (recon copies fetched 2026-09-15, same day as the crawl).
#
# Verified-honest absences (NO doc items added, on purpose — live-checked 2026-09-15):
#   - No hosted/remote MCP server: mcp.buzz.xyz does not resolve; buzz.xyz/mcp is 404. The MCP
#     surface is docs/MCP_DRIVEN_HOOKS.md (local hooks) + buzz-agent as MCP *client*.
#   - No llms.txt (buzz.xyz/llms.txt 404 — buzz-probe-1 already records this) and no
#     /.well-known/skills index or /.well-known/nostr.json on buzz.xyz.
#   - No published OpenAPI spec (buzz-probe-2 records the 404s); the machine spec surface is the
#     Nostr NIPs + docs/nips/* extensions instead.
#   - buzz-cli is NOT on crates.io ("crate `buzz-cli` does not exist") — CLI is build-from-source
#     (or the Desktop-bundled managed-agent copy); no brew/npm distribution either.
#   - openness-*/privacy-* axes untouched except where a crawled page speaks directly.
#
# Run AFTER `pnpm pipeline extract --category team-chat --product buzz` (extract is monotonic and
# dedups by normalized excerpt, so re-running extract after this keeps these items stable).
import datetime
import json
import subprocess

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
RAW = 'https://raw.githubusercontent.com/block/buzz/main'

DOC_ITEMS = [
    # --- agents.md-standard contributor guide at the repo root (extra-15) ---
    ('buzz-supp-agents-md', f'{RAW}/AGENTS.md',
     'Buzz ships a root AGENTS.md — "AI Agent Contributor Guide... for AI agents contributing to the Buzz codebase" — with a Product Contract ("Before planning or reviewing a non-trivial change: Read VISION.md... Read the applicable guidance in TESTING.md"), the five-repo ecosystem map (block/buzz is "OSS source — relay, desktop app, mobile app, CLI, agent harness"), and the full crate map ("buzz-relay # WebSocket relay server — main entry point; also hosts git + huddle audio"). CLAUDE.md at the root points to AGENTS.md, and the repo mirrors vendor-shipped skills into .agents/, .claude/, .codex/, and .goose/skills/ so four agent harnesses discover them natively.'),
    # --- ACP harness: any ACP agent becomes a Buzz teammate (extra-19) ---
    ('buzz-supp-acp-harness', f'{RAW}/crates/buzz-acp/README.md',
     'buzz-acp is the "ACP harness that connects AI agents to Buzz. The harness listens for @mentions on the relay, prompts your agent, and the agent replies using the Buzz CLI... Supports any agent that speaks ACP over stdio: goose, codex (via codex-acp), and claude code (via claude-agent-acp)." Each agent gets its own first-class identity: "Each agent needs a Nostr keypair — this is the agent\'s identity in Buzz" (minted with `buzz-admin generate-key`, enrolled via `add-member`, which "publishes a kind:13534 membership event"), and "Running multiple agents? Mint a separate keypair for each."'),
    # --- the vendor's own ACP+MCP agent runtime (extra-20) ---
    ('buzz-supp-agent-runtime', f'{RAW}/crates/buzz-agent/README.md',
     'buzz-agent is Block\'s own agent runtime: "Minimal, unbreakable ACP-compliant LLM agent. Stdio in, tool calls out." It is an MCP client by design — "A client sends session/prompt. The agent loops: call the LLM → get tool calls → run them via MCP → feed results back → repeat" — and is provider-agnostic: documented quick starts run it against "Anthropic Messages API, OpenRouter, or any OpenAI-compat (vLLM, llama.cpp, Databricks, Block Gateway, Ollama, …)" plus "Databricks model serving via OAuth 2.0 PKCE". VISION_AGENT.md pairs it with buzz-dev-mcp ("an MCP server. It gives any agent a shell and a file editor") — "two crates of Rust purpose-built for headless autonomous coding work."'),
    # --- vendor-shipped managed-agent skill: NL agent management from chat (extra-22) ---
    ('buzz-supp-managed-skill', f'{RAW}/desktop/src-tauri/src/managed_agents/nest_skill.md',
     'The Desktop-bundled managed agent ships a packaged skill (frontmatter "name: buzz-cli") covering "relay operations: owner-reviewed agent drafts, messaging, channels, DMs, users, workflows, feed, reactions, canvas, social, repos, uploads, and agent memory." Conversational agent management is first-class: "When someone naturally asks to create an agent, ask for at most two things: the agent\'s name and what it should do day-to-day... Then run: buzz agents draft-create --channel <current-channel-uuid> --display-name ... --system-prompt ..." — with an explicit owner-review gate: "The command sends an encrypted draft to the owner\'s Desktop. It does not create the agent until the owner reviews and saves the form, so report the result as \'ready for review,\' never \'created.\'"'),
    # --- Persona Pack: portable machine spec for agent teams (extra-21) ---
    ('buzz-supp-persona-pack', f'{RAW}/crates/buzz-persona/PERSONA_PACK_SPEC.md',
     'The Persona Pack Specification defines "a portable, self-contained bundle that defines one or more AI agent personas for deployment in Buzz... a superset of the Open Plugin Spec — every valid Persona Pack is also a valid OPS package." "A pack contains: personas (identity + system prompt), skills (on-demand instruction sets), MCP server config, pack-level instructions, lifecycle hooks, and distribution metadata," with design goals "Portable — zip file or git repo; no Buzz tooling required to inspect" and "OPS-compatible — discoverable by any OPS-compatible tool"; the manifest is machine-readable .plugin/plugin.json against the OPS v1 JSON schema.'),
    # --- open wire protocol: any Nostr client is a client (extra-16) ---
    ('buzz-supp-nostr-open-protocol', f'{RAW}/NOSTR.md',
     '"Buzz is a Nostr relay that speaks NIP-29 (relay-based groups) natively. Third-party Nostr clients connect directly to buzz-relay using NIP-29 and NIP-42 authentication" — a documented open wire protocol ("Connect any NIP-29 client straight to the relay") with a feature-status table (group chat kind:9, reactions kind:7 per NIP-25) and a documented quick start including an optional pubkey allowlist (BUZZ_PUBKEY_ALLOWLIST) — API parity comes from the protocol itself rather than a separate bot API.'),
    # --- NIP-AA: owner-attested agent authentication (extra-23) ---
    ('buzz-supp-nip-aa-agent-auth', f'{RAW}/docs/nips/NIP-AA.md',
     'Buzz publishes its own agent-credential spec, NIP-AA "Agent Authentication": "An agent whose owner is a relay member MAY gain implicit relay access — without being explicitly enrolled in the member list — by presenting a NIP-OA auth tag during NIP-42 authentication." It closes a documented revocation hazard: "When a human\'s membership is revoked, their agents remain enrolled until manually removed... NIP-AA closes this gap... If the owner\'s membership is later revoked, the agent\'s next connection attempt fails automatically — no separate cleanup required." Agent keys are distinct principals ("An AI agent, bot, or automation process with its own Nostr keypair") with RFC-2119 normative language.'),
    # --- admin API: signed-event auth, two-tier principals, NIP-11 discovery (extra-24) ---
    ('buzz-supp-admin-api', f'{RAW}/docs/admin/README.md',
     'The deployment moderation dashboard/admin API authenticates with signed events, not tokens: "Every /api/admin/v1 request must carry a NIP-98 HTTP Auth header containing a signed kind-27235 event. The signer\'s pubkey is resolved against a two-tier principal model — Operator or Moderator — that grants capabilities accordingly." Token auth was deliberately removed ("BUZZ_ADMIN_TOKEN is no longer recognised... a stale token variable cannot silently run a deployment on a removed auth path"), and the API self-advertises for machine discovery: "the relay advertises the admin API origin in its NIP-11 relay-information document under an optional admin_api field."'),
    # --- remote agents: relay as the management plane (extra-18) ---
    ('buzz-supp-remote-agents', f'{RAW}/VISION_REMOTE_AGENTS.md',
     'Remote agents make headless operation the design center: "An agent in Buzz is more than just a process. It has a keypair, a name, a durable history, a reputation — all on the relay... after deploy, the desktop retains no substrate control channel... everything flows through the relay: you read the agent\'s messages to know how it\'s doing, you mention it to steer it, you tell a healthy agent to stop and it exits on its own." Substrates are pluggable behind a provider contract ("Kubernetes is the first substrate, not the point... preserve the agent\'s identity and fail closed with its key, converge to a single live instance no matter how deploys race... A conformance suite pins those behaviors").'),
    # --- vendor-maintained agent-behavior benchmark (extra-25) ---
    ('buzz-supp-agent-benchmark', f'{RAW}/benchmarks/buzz-dataset/README.md',
     'Block maintains a public agent-behavior benchmark for Buzz: "Harbor tasks that score Buzz product behavior, not just task correctness. Each task poses an ordinary-looking question; what is graded is how the agent answers it through Buzz — where the reply lands, who it notifies, what it was willing to read" — ten tasks including reply-to-thread, user-mention, create-channel-invite-users, memory-retrieval ("Answers from harness-seeded cold memory without the value appearing in channel history"), with graded behaviors that "have to come from buzz-acp\'s production base prompt."'),
    # --- Helm chart: production self-host distribution (extra-26) ---
    ('buzz-supp-helm-chart', f'{RAW}/deploy/charts/buzz/README.md',
     'Self-hosting has a first-class Helm distribution on GHCR: "helm install buzz oci://ghcr.io/block/buzz/charts/buzz --version 0.1.8" with two documented profiles — "Production (default): External managed Postgres/Redis/S3, secrets.existingSecret:, no chart-side autogen, HA-capable (replicaCount ≥ 2)" and "Quickstart (eval): In-cluster Postgres + Redis + MinIO... chart auto-generates relay + service secrets, single replica" — for "a single relay binary serving WebSocket + REST + web UI, backed by PostgreSQL, Redis, and S3-compatible object storage."'),
    # --- signed-event git credentials (extra-28) ---
    ('buzz-supp-git-nostr-credentials', f'{RAW}/crates/git-credential-nostr/README.md',
     'The built-in git hosting authenticates agents and humans the same way: git-credential-nostr is a "NIP-98 credential helper for git — signs HTTP auth events with your Nostr key so git can push/pull from Buzz\'s git server without passwords" (git 2.46+ authtype capability; registered via `git config --global credential.helper nostr`) — the agent\'s existing keypair is its git credential, no separate PAT to provision or leak.'),
    # --- governance guardrails for autonomous agents (extra-27) ---
    ('buzz-supp-owned-agent-guardrails', f'{RAW}/docs/owned-agent-discovery.md',
     'Agent autonomy is bounded by documented fail-closed governance: owned-agent discovery is seeded by "an owner-authored kind 30177 coordinate... It is not ownership proof. The latest agent kind 0 profile must have a valid envelope and exactly one valid NIP-OA auth tag... Invalid latest policy reserves the coordinate and fails closed: it cannot revive a legacy permission," and discovery is deliberately not authorization: "discovery alone does not authorize a message."'),
    # --- coordinated disclosure policy (extra-29) ---
    ('buzz-supp-security-policy', f'{RAW}/SECURITY.md',
     'Buzz has a formal coordinated-disclosure policy: private GitHub security advisories ("Do not report security vulnerabilities through a public GitHub issue"), a fallback contact (buzz@block.xyz), "an acknowledgment within 48 hours" and "a full response — including a timeline for a fix — within 7 days of initial contact."'),
]


def curl(url, extra_args=None):
    cmd = ['curl', '-s', '--max-time', '25', '-w', '\n---META %{http_code}'] + (extra_args or [])
    r = subprocess.run(cmd + [url], capture_output=True, text=True, timeout=35)
    body, _, meta = r.stdout.rpartition('\n---META ')
    return int(meta.strip() or 0), body


def agents_md_probe():
    """Live-verify the root AGENTS.md agent contributor guide."""
    status, body = curl(f'{RAW}/AGENTS.md')
    if status != 200 or 'AI Agent Contributor Guide' not in body:
        raise SystemExit(f'buzz AGENTS.md probe: {status} or missing marker: {body[:200]}')
    first = ' / '.join(line for line in body.splitlines()[:4] if line.strip())[:300]
    return ('PROBE agents-md (' + NOW[:10] + f'): GET {RAW}/AGENTS.md returns HTTP 200; opening lines: "{first}" '
            '— a root agents.md-standard contributor guide for AI agents working on the Buzz codebase.')


def skills_mirror_probe():
    """Live-verify the vendor-shipped skill pack and its four harness mirror paths."""
    status, body = curl(f'{RAW}/desktop/src-tauri/src/managed_agents/nest_skill.md')
    if status != 200 or 'name: buzz-cli' not in body:
        raise SystemExit(f'buzz skill probe: nest_skill.md returned {status} without buzz-cli frontmatter')
    mirrors = []
    for harness in ('.agents', '.claude', '.codex', '.goose'):
        s, _ = curl(f'{RAW}/{harness}/skills/sprout-cli/SKILL.md')
        if s != 200:
            raise SystemExit(f'buzz skill probe: {harness} mirror returned {s}')
        mirrors.append(harness)
    return ('PROBE agent-skills (' + NOW[:10] + '): the vendor-shipped managed-agent skill (frontmatter "name: '
            'buzz-cli", covering owner-reviewed agent drafts, messaging, channels, DMs, workflows, repos, and agent '
            'memory) is live at desktop/src-tauri/src/managed_agents/nest_skill.md (HTTP 200), and the repo mirrors '
            'skills for four agent harnesses — ' + ', '.join(mirrors) + '/skills/ all answer HTTP 200.')


def helm_oci_probe():
    """Live-verify the keyless GHCR OCI Helm distribution."""
    status, tok_body = curl('https://ghcr.io/token?scope=repository:block/buzz/charts/buzz:pull')
    tok = json.loads(tok_body).get('token') if status == 200 else None
    if not tok:
        raise SystemExit(f'buzz helm probe: ghcr token endpoint returned {status}')
    status2, tags = curl('https://ghcr.io/v2/block/buzz/charts/buzz/tags/list',
                         extra_args=['-H', f'Authorization: Bearer {tok}'])
    if status2 != 200 or '"tags"' not in tags:
        raise SystemExit(f'buzz helm probe: tags/list returned {status2}: {tags[:200]}')
    tag_list = json.loads(tags)['tags']
    return ('PROBE helm-oci (' + NOW[:10] + '): the documented `helm install ... oci://ghcr.io/block/buzz/charts/buzz` '
            'distribution is live — an anonymous GHCR pull token lists published chart versions '
            + json.dumps(tag_list) + ' at ghcr.io/v2/block/buzz/charts/buzz/tags/list (HTTP 200, keyless).')


PROBES = [
    ('buzz-probe-5', f'{RAW}/AGENTS.md', agents_md_probe),
    ('buzz-probe-6', f'{RAW}/desktop/src-tauri/src/managed_agents/nest_skill.md', skills_mirror_probe),
    ('buzz-probe-7', 'https://ghcr.io/v2/block/buzz/charts/buzz/tags/list', helm_oci_probe),
]


def main():
    path = 'open-rankings/team-chat/evidence/buzz.json'
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
    print(f'buzz: wrote {len(ev)} items')


if __name__ == '__main__':
    main()
