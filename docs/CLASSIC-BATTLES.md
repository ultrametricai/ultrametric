# Classic battles Ultrametric is missing

A prioritized backlog of classic product rivalries that would make strong rankings. Priority
weighs: (1) how iconic/searched the head-to-head is, (2) how well our evidence ladder
(docs, GitHub, community, keyless probes) can judge it, (3) agent-era relevance — whether
the products differ meaningfully on APIs, CLIs, and MCP surface, which is what the Arena
Score actually measures.

Format per battle: proposed ranking id → products → the 3 stories that would decide it →
expected agent-access differentiators.

---

## 1. `notes-knowledge` — Notion vs Obsidian (vs Anytype)

- **Products:** notion, obsidian, anytype
- **Deciding stories:**
  1. As a power-user, I can keep my notes as local plain-text files I own forever (offline/openness).
  2. As a developer, I can query and update my knowledge base through a documented API.
  3. As an ai-native user, I can let an agent search and write into my workspace safely (scoped access).
- **Agent-access differentiators:** Notion has a mature public API, official MCP server, and SDKs; Obsidian is local-first with a plugin API but no official cloud API or MCP (community REST plugin only); Anytype is open-source with local-first sync. Expect Notion to win agent-access while Obsidian wins openness/privacy — a genuinely close Overall score race.

## 2. `team-chat` — Slack vs Discord vs Microsoft Teams (vs Zulip) — ✅ SHIPPED

Now a live ranking (`data/team-chat/`): 22 manual stories + 29 canonical, hands-on probes
confirmed Slack's official MCP server docs AND a live auth-gated remote MCP endpoint at
api.slack.com/mcp, Zulip's full OpenAPI spec + keyless API on chat.zulip.org, and Microsoft
Graph's $metadata as Teams' machine-readable surface.

- **Products:** slack, discord, ms-teams, zulip
- **Deciding stories:**
  1. As a developer, I can build bots/automations against a documented events + messaging API.
  2. As an ai-native user, I can connect an agent via an official MCP server to read/post messages.
  3. As a platform-engineer, I can export the full message history in open formats (openness).
- **Agent-access differentiators:** Slack has an official MCP server, granular scoped tokens, and webhooks; Discord's API is bot-centric with no official MCP; Teams routes everything through Microsoft Graph (powerful but heavyweight auth); Zulip is fully open-source with complete API parity. High traffic topic, very contestable.

## 3. `observability` — Datadog vs Grafana (vs New Relic)

- **Products:** datadog, grafana, new-relic
- **Deciding stories:**
  1. As a platform-engineer, I can define dashboards/monitors as code and version them.
  2. As an ai-native user, I can have an agent query metrics/logs/traces to diagnose an incident.
  3. As a devops-lead, I can self-host the full stack to keep telemetry in-house.
- **Agent-access differentiators:** Grafana ships an official MCP server + fully open-source self-host path; Datadog has broad APIs, Terraform provider, and an MCP server (preview) but no self-host; New Relic has NerdGraph. Openness axis should split the field sharply.

## 4. `data-warehouses` — Snowflake vs Databricks (vs ClickHouse)

- **Products:** snowflake, databricks, clickhouse
- **Deciding stories:**
  1. As a data-engineer, I can run SQL programmatically via official drivers/REST with sandboxed roles.
  2. As an ai-native user, I can point an agent at the warehouse via MCP/semantic layer and get governed answers.
  3. As a platform-engineer, I can manage warehouses/pipelines as declarative config in CI.
- **Agent-access differentiators:** Both giants now ship MCP servers and AI SQL assistants (Snowflake Cortex vs Databricks Assistant); ClickHouse is open-source with an official MCP server and local `clickhouse-local` CLI. Pricing-model evidence (credits vs DBUs) is famously contested — good community-evidence ranking.

## 5. `design-tools` — Figma vs Penpot (vs Sketch)

- **Products:** figma, penpot, sketch
- **Deciding stories:**
  1. As a developer, I can extract design tokens/components through a documented API.
  2. As an ai-native user, I can have an agent read a design file and generate code from it (MCP).
  3. As a designer, I can self-host the tool and own my design files in an open format.
- **Agent-access differentiators:** Figma's Dev Mode MCP server is the flagship agent story of 2025-26; Penpot is open-source, self-hostable, SVG-native with an API; Sketch is macOS-native with file-format openness but a thin cloud API. Clean three-way split across the Overall score components.

## 6. `infra-as-code` — Terraform vs Pulumi (vs OpenTofu)

- **Products:** terraform, pulumi, opentofu
- **Deciding stories:**
  1. As a platform-engineer, I can preview and apply infra changes headlessly in CI with policy checks.
  2. As a developer, I can define infrastructure in a general-purpose language with types and tests.
  3. As an ai-native user, I can let an agent plan/apply with least-privilege credentials and review gates.
- **Agent-access differentiators:** All three are CLI-first (strong agent-access baseline); differentiators are license (BSL vs Apache-2 fork), Pulumi's automation API + AI features, and registry/provider openness. The Terraform→OpenTofu fork drama supplies rich community evidence.

## 7. `payments` — Stripe vs Adyen vs PayPal (Braintree)

- **Products:** stripe, adyen, paypal
- **Deciding stories:**
  1. As a developer, I can integrate a full payment flow from docs alone in a sandbox account.
  2. As an ai-native user, I can drive payments/refunds/reporting through an agent with scoped, auditable keys.
  3. As a finance-lead, I can reconcile settlements automatically via reports API/webhooks.
- **Agent-access differentiators:** Stripe's docs, OpenAPI spec, llms.txt, and agent toolkit are the industry benchmark; Adyen is powerful but enterprise-gated (no self-serve sandbox parity); PayPal ships an official MCP server but legacy API sprawl. Already on the roadmap queue ("payments w/ Stripe") — this is the highest-priority new ranking.

## 8. `backend-as-a-service` — Supabase vs Firebase (vs Appwrite, Convex) — ✅ SHIPPED

Now a live ranking (`data/backend-as-a-service/`) with Convex taking the fourth slot
(reactive TypeScript backend with an FSL→Apache open-source core) over PocketBase: 22
manual stories + 29 canonical. Hands-on probes: all four CLIs install from npm and
version-print headlessly (supabase 2.116.0, firebase-tools 15.29.0, convex 1.45.0,
appwrite-cli 27.3.0); Convex and Firebase MCP servers answer stdio initialize keylessly;
Supabase's remote MCP is live and auth-gated; `npx supabase init` scaffolds a project
with no login.

- **Products:** supabase, firebase, appwrite, convex
- **Deciding stories:**
  1. As a developer, I can stand up auth + database + storage from the CLI in minutes.
  2. As an ai-native user, I can have an agent create and migrate schemas via MCP/CLI safely (branching).
  3. As a platform-engineer, I can self-host the whole stack and export all data (openness).
- **Agent-access differentiators:** Supabase has an official MCP server, database branching, and full OSS self-host; Firebase counters with Gemini-assisted tooling but is closed and export-hostile (Firestore lock-in); Appwrite/PocketBase are the pure-OSS spoilers. Likely the most vibe-coded-app-relevant ranking in the list.

## 9. `auth-identity` — Auth0 vs Clerk (vs Keycloak, WorkOS)

- **Products:** auth0, clerk, keycloak, workos
- **Deciding stories:**
  1. As a developer, I can add sign-in with prebuilt components/SDKs in under an hour.
  2. As a platform-engineer, I can self-host the identity provider and export users (openness/exit-cost).
  3. As an ai-native user, I can manage users/orgs/roles through an agent with scoped machine credentials.
- **Agent-access differentiators:** Clerk is component-first with modern DX; Auth0 has the deepest management API + extensibility; Keycloak is the self-host yardstick; WorkOS owns enterprise SSO. Pricing-cliff community evidence (Auth0 MAU pricing, Clerk per-MAU) is abundant.

## 10. `feature-flags` — LaunchDarkly vs Statsig vs PostHog (flags)

- **Products:** launchdarkly, statsig, posthog, flagsmith
- **Deciding stories:**
  1. As a developer, I can evaluate flags locally/at the edge with official SDKs and relay/proxy options.
  2. As a product-manager, I can run experiments tied to flags with trustworthy stats.
  3. As an ai-native user, I can have an agent create, target, and retire flags via API/MCP with audit logs.
- **Agent-access differentiators:** PostHog is open-source with a broad API + MCP server and bundles analytics; Statsig leads on experimentation stats + generous free tier; LaunchDarkly is the enterprise incumbent with the deepest governance. Flagsmith adds a self-host baseline.

## 11. `no-code-databases` — Airtable vs Baserow vs NocoDB

- **Products:** airtable, baserow, nocodb
- **Deciding stories:**
  1. As a product-manager, I can build a relational base with views, forms, and automations without code.
  2. As a developer, I can treat the base as a database via a complete REST API (API parity).
  3. As a platform-engineer, I can self-host on top of my own Postgres/MySQL (openness).
- **Agent-access differentiators:** Airtable's API is polished but rate-limited and closed; Baserow and NocoDB are open-source, self-hostable, and NocoDB can mount existing databases. Agents love spreadsheet-shaped state stores — high ai-native persona relevance.

## 12. `error-monitoring` — Sentry vs Rollbar (vs GlitchTip, Highlight)

- **Products:** sentry, rollbar, glitchtip
- **Deciding stories:**
  1. As a developer, I can get symbolicated, deduplicated errors with release/source-map tracking.
  2. As an ai-native user, I can let an agent triage: query issues via API/MCP and open fixes (Seer-style).
  3. As a platform-engineer, I can self-host the whole pipeline (openness).
- **Agent-access differentiators:** Sentry ships an official MCP server + AI autofix and a (mostly) open self-host path; Rollbar is API-solid but static; GlitchTip is the lightweight OSS Sentry-compatible spoiler. The agent-triage story is where the gap has become dramatic.

## 13. `comm-apis` — Twilio vs Vonage (vs Plivo, Telnyx)

- **Products:** twilio, vonage, telnyx
- **Deciding stories:**
  1. As a developer, I can send SMS/voice from a sandbox number using official SDKs in minutes.
  2. As an ai-native user, I can build a voice agent (streaming, barge-in) on the platform's realtime APIs.
  3. As a finance-lead, I can predict per-message/minute costs and get usage via API (pricing transparency).
- **Agent-access differentiators:** Twilio's docs/API surface remains the reference but pricing complexity draws community fire; Telnyx competes on price + modern API; Vonage on enterprise reach. Voice-agent readiness (media streams, WebSocket APIs) is the new deciding axis.

## 14. `search-apis` — Algolia vs Meilisearch vs Typesense

- **Products:** algolia, meilisearch, typesense
- **Deciding stories:**
  1. As a developer, I can index documents and get typo-tolerant instant search with one CLI/SDK call.
  2. As a platform-engineer, I can self-host with predictable memory/cost at scale (openness/pricing).
  3. As an ai-native user, I can run hybrid semantic + keyword search and expose it to agents via API/MCP.
- **Agent-access differentiators:** Meilisearch and Typesense are open-source, self-hostable, with clean REST APIs and official MCP servers; Algolia has the deepest relevance tooling but per-record pricing lock-in. Small product count, crisp axes — an easy high-quality ranking.

## 15. `password-managers` — 1Password vs Bitwarden (vs KeePassXC)

- **Products:** 1password, bitwarden, keepassxc
- **Deciding stories:**
  1. As a developer, I can inject secrets into local dev/CI without plaintext files (op CLI / bws).
  2. As an ai-native user, I can grant an agent scoped, auditable access to specific secrets (service accounts).
  3. As a power-user, I can self-host or fully export my vault in open formats.
- **Agent-access differentiators:** 1Password's `op` CLI + Connect server + service accounts vs Bitwarden's open-source server, `bws` secrets manager, and full self-host; KeePassXC is the offline/openness pole with no cloud API by design. Secrets management is the choke point of every agent deployment — highly on-thesis.

---

## Recommended next five (priority order)

~~backend-as-a-service~~ and ~~team-chat~~ shipped (see #2 and #8 above) — the queue moves up:

1. **payments** (Stripe vs Adyen vs PayPal) — already queued internally; strongest evidence surface, benchmark-setting docs, huge search demand.
2. **observability** (Datadog vs Grafana) — enormous spend, MCP servers on both sides, clean self-host axis.
3. **infra-as-code** (Terraform vs Pulumi vs OpenTofu) — license-fork drama supplies community evidence; CLI-first products score cleanly on our probes.
4. **auth-identity** (Auth0 vs Clerk vs Keycloak) — natural follow-on to backend-as-a-service; pricing-cliff community evidence is abundant.
5. **error-monitoring** (Sentry vs Rollbar vs GlitchTip) — Sentry's MCP + AI autofix story makes the agent-triage gap dramatic.
