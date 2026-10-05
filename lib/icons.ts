// The site's one emoji icon system for concepts (arena icons live in data/arena-icons.json and
// are consumed as-is — see app/layout.tsx / components/ArenaMenu.tsx). Client-safe and pure (no
// node builtins, no React): imported from both server pages and client components
// (CompareBuilder, StoryVerdictsTable via components/ThemeIcon.tsx).
//
// Consistency rule: same concept = same icon everywhere. Themes resolve through ONE ordered
// keyword-rule list (privacy is 🔒 in every arena's taxonomy), and metrics through ONE map —
// never a per-page emoji. Every functional icon must ship with a tooltip naming the concept:
// use themeTooltip()/metricTooltip() (or components/IconChip.tsx, which enforces a title).

// ---------- Theme names ----------

// Plain-language display overrides for theme/group ids whose literal humanization is jargon
// (founder 2026-09-30: "'action primitives' means nothing to people"). The machine id stays
// everywhere — URLs, schema fields, data files — only the display text changes, and it changes
// in ONE place so every render site (matrix headers, product-page cards, checklists, battles,
// markdown) stays consistent.
const THEME_LABEL_OVERRIDES: Record<string, string> = {
  'action-primitives': 'Agent actions',
}

// 'privacy-posture' → 'Privacy posture' — the ONLY user-facing spelling of a kebab-case
// theme/group id (dashes never reach the UI). First word capitalized, the rest left as-is.
export function humanizeTheme(theme: string): string {
  const override = THEME_LABEL_OVERRIDES[theme]
  if (override !== undefined) return override
  const words = theme.replace(/-/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// ---------- Theme icons ----------

// Fallback for a theme no rule matches. Exported so the unit test can assert every LIVE theme
// resolves to a real icon — a new theme id that falls through to this is a test failure, which
// is the point: extend THEME_RULES when the taxonomy grows.
export const THEME_FALLBACK_ICON = '🏷️'

// Ordered keyword rules over the kebab-case theme id — first match wins, so more specific
// concepts (privacy, security, payments) sit above broad catch-alls (data, workflow, platform).
// Bucketing by keyword keeps ~400 live theme ids covered by ~60 rules and gives new themes a
// sensible icon for free whenever they reuse existing vocabulary.
const THEME_RULES: Array<[RegExp, string]> = [
  // Hardware arenas (processors, gpus)
  [/gaming|game\b/, '🎮'],
  [/power-|cooling|thermal|wattage/, '🔋'],
  [/spec-transparency|spec-sheet/, '📚'],
  // Code review & extraction arenas
  [/codebase-understanding/, '🧭'],
  [/ocr|multilingual|handwriting/, '🔤'],
  [/^interaction$|interaction/, '💬'],
  [/^surfaces$|surfaces/, '🧩'],
  // Trust & safety
  [/privacy|consent|cookieless|tracking/, '🔒'],
  [/security|guardrails|safety|anti-bot|stealth|isolation|secret|sast|scanning|supply-chain|dependency|vulnerab/, '🛡️'],
  [/auth|sso|mfa|passwordless|credential|rbac|permission|tenan|key-management|session-management/, '🔑'],
  [/compliance|governance|audit|policy|licensing|trust|legal|pci/, '⚖️'],
  [/contract|esignature|document-automation|incorporation|registered-agent/, '📜'],
  // Identity verification & KYC arena (data-checks falls through to the data bucket;
  // idv-agent-access falls through to the agent robot — both deliberate)
  [/verification-flows|document-coverage|biometric-liveness|watchlist-screening|verification-orchestration/, '🛂'],
  // Error tracking & expense management arenas
  [/error|crash|grouping|regression/, '🚨'],
  [/sourcemap|symbolicat/, '🗺️'],
  [/scrubbing/, '🔒'],
  [/^receipts-|reimburs/, '🧾'],
  [/travel|trip-/, '✈️'],
  // Agents & AI
  [/agent|autonom|human-in-the-loop|human-oversight|orchestration|nl-task|copilot/, '🤖'],
  [/memory|recall|graph-entity|context/, '🧠'],
  [/prompt|ai-|-ai$|llm|model|fine-tune|quantization|multimodal|embedding|vector|rag|openai-compat/, '✨'],
  [/evals|guardrail/, '🧪'],
  [/mcp|tools-function|structured-tool|tool-curation|action-primitives|skill/, '🛠️'],
  // Money
  // Stablecoin rails before the generic payment bucket so acceptance/payouts keep the coin
  [/stablecoin|onramp-conversion|wallets-balances|payouts-offramp|settlement-treasury/, '🪙'],
  // Banking-data (open banking) themes before the generic buckets that would misfile them
  [/account-linking|transactions-enrichment|balance-ownership|institution-coverage|data-freshness/, '🔗'],
  [/payment|checkout|payout|cards|spend|disputes|refund|accept/, '💳'],
  [/card-lifecycle|auth-decisioning|wallets-tokenization|program-management|issuing/, '💳'],
  [/seller-onboarding|funds-routing|platform-monetization|payfac-liability|embedded-experience/, '💳'],
  [/banking|treasury|yield|equity|fundraising|cap-table/, '🏦'],
  [/account-provisioning|money-movement|sponsor-model/, '🏦'],
  [/payroll|benefits|contractor|hiring|onboarding-hiring/, '💰'],
  [/invoic|billing|bills|ledger|accounting|reconciliation|statements|coa|close-collaboration|subscription|dunning|metering|revenue-recognition/, '🧾'],
  [/entitlement/, '🎛️'],
  [/fraud|risk-scoring|rules-engine|review-queue/, '🕵️'],
  [/pricing|cost|economics|valuation|409a/, '💲'],
  [/tax|currency|nexus|filing-remittance|exemption|global-vat/, '🌐'],
  // Commerce & CRM
  [/catalog|inventory|storefront|commerce|b2b|wholesale|shipping|receipts|merchant|order|fulfillment/, '🛒'],
  [/crm|contacts|pipeline-management|audiences|identity-resolution|cdp/, '📇'],
  // Email marketing (before the generic email rule: campaign/audience concepts are 📣, the
  // one-to-one transactional-sending theme stays ✉️ via the email rule below)
  [/campaign|broadcast|newsletter|deliverability|audience-segmentation|lifecycle-automation/, '📣'],
  [/template-content/, '📝'],
  // Comms & scheduling
  [/email|composing|inbox|triage|transactional-sending/, '✉️'],
  [/chat|channel|thread|calls|huddles|bots|telephony|voice|tts|latency-turntaking/, '💬'],
  [/calendar|scheduling|booking|time-pto|capacity|availability|on-call/, '📅'],
  [/meeting|transcription|recording|notes-summaries/, '🎙️'],
  [/capture|video|media|images/, '🎥'],
  // Search & knowledge
  [/search|discovery|retrieval|relevance|indexing|freshness|coverage|extraction|citations|research|literature|answers|files-analysis/, '🔎'],
  [/docs|documentation|api-reference|knowledge|learning|reference/, '📚'],
  [/notes|writing|authoring|editing|templates|versioning|localization|linking/, '📝'],
  // Data
  [/analytics|insights|dashboards|reporting|funnels|retention|experiment|flags|metrics|semantic-layer|report-output/, '📊'],
  [/data|warehouse|sql|etl|dbt|ingestion|event|schema|migration|database|storage|sync|replication|import|export|backup|snapshot|state|durability|lifecycle/, '🗄️'],
  [/streaming|realtime|batch|async|queue/, '🔁'],
  // Build & ship
  [/code|git|repo|ci-|-ci$|ide|terminal|shell|typescript|monorepo|branching|scripting|dev-experience|developer|dx|debugging|replay|local-dev|dev-handoff/, '💻'],
  [/deploy|hosting|publish|serverless|edge|infra|cluster|provisioning|plan-apply|providers|self-host|ota|rollout|release/, '🚀'],
  [/install|setup|toolchain|bring-up|reproducibility/, '📥'],
  [/performance|latency|speed|caching|scale|parallelism|hardware|gpu|dedicated-capacity/, '⚡'],
  [/reliability|errors|recovery|status|incident|alerting|slos|postmortem|escalation|offline|noise/, '🚨'],
  [/observability|tracing|telemetry|monitoring|otel|instrumentation|logs|slo/, '📡'],
  [/testing|quality|validation|mocking|review|simulation|accuracy/, '🧪'],
  [/workflow|automation|runbooks|triggers|orchestr|daily|processes|planning|tracking|roadmap|prioritization|tasks|projects/, '⚙️'],
  // Platform & ecosystem
  [/api|sdk|webhook|connector|integration|ecosystem|plugin|extensib|marketplace|apps|embed|platform|headless|unified|registry|gateway|routing|protocols|clients|destinations|hosted-servers|serving|endpoints|functions|edge-compute/, '🔌'],
  [/open|oss|portability|ownership|local-first|standards/, '🔓'],
  [/collab|team|sharing|multiplayer|workspace|multi-tenancy|orgs|multi-entity|community|stakeholder/, '👥'],
  // Product surface
  [/design|theming|visual|vector-editing|components|prototyping|ui|ux|ergonomics|customization|config|window|panes|keyboard|filters|controls|output-formats/, '🎨'],
  [/mobile|devices|cross-platform|desktop|fleet|teleoperation/, '📱'],
  [/onboarding|migration|adoption|learning-curve|intake|feedback|support/, '🧭'],
  [/network|connectivity|access|remote|ssh|vpn|pooling/, '🌐'],
  [/js-rendering|ssr|fullstack|reactivity|framework|spec-design|intent-to-spec|codebase|generation|execution|implementation|building/, '💻'],
  [/operations|admin|management|control|governance/, '⚙️'],
]

// Exact overrides checked BEFORE the keyword rules — the few ids where a keyword would land on
// the wrong bucket ('api-quality' contains "quality" but is the apiQuality metric's theme twin,
// so it must share that metric's plug, not the testing flask).
const THEME_EXACT: Record<string, string> = {
  'api-quality': '🔌',
  // security-keys arena
  'protocol-coverage': '🔑',
  'beyond-fido': '🪪',
  'form-factors': '🔑',
  'enrollment-recovery': '📥',
  // authenticator-apps arena
  'totp-core': '🔢',
  'passkey-support': '🔑',
  // self-hosted-assistants arena ('messaging-surfaces' would land on the generic surfaces
  // puzzle-piece and 'computer-control' on the operations gear — both wrong concepts here)
  'messaging-surfaces': '💬',
  'computer-control': '🖥️',
  // compliance-automation arena ('framework-coverage' would land on the AI sparkle and
  // 'evidence-collection' on the laptop — both wrong concepts here)
  'framework-coverage': '📋',
  'evidence-collection': '📥',
  'questionnaire-automation': '📝',
  // applicant-tracking arena (careers-page/structured-interviews fall through to the tag
  // fallback; offer-management lands on the operations gear)
  'careers-page': '📣',
  'structured-interviews': '📝',
  'offer-management': '✍️',
  // domain-registrars arena (registration-transfer falls through to the tag fallback)
  'registration-transfer': '🌐',
  // sso-identity arena (app-catalog would land on the commerce cart, scim-provisioning on the
  // deploy rocket, device-trust on the compliance scales, lifecycle-automation on the campaign
  // megaphone — all wrong concepts here)
  'app-catalog': '🧩',
  'scim-provisioning': '🔁',
  'device-trust': '💻',
  'directory-core': '📖',
  'lifecycle-automation': '🔄',
  'identity-observability': '📜',
  // game-engines arena
  'core-engine': '🎮',
  'editor-tooling': '🛠️',
  'asset-pipeline': '🧱',
  'platform-export': '🚀',
  // cloud-storage arena ('storage-pricing' would land on the data drum before the pricing
  // dollar; 'sync-webhooks' reads better as the sync loop than the drum)
  'storage-pricing': '💲',
  'sync-webhooks': '🔁',
  // cloud-platforms arena ('iac-surface' falls through to the tag fallback; 'identity-access'
  // would land on the laptop; 'core-platform' on the API plug — IAM keys and compute fit)
  'iac-surface': '🏗️',
  'identity-access': '🔑',
  'core-platform': '🖥️',
  // frontier-models arena ('capability-surface' would land on the generic surfaces puzzle
  // piece; the rest are new vocabulary)
  'capability-surface': '🧠',
  'pricing-rate-limits': '💸',
  'model-transparency': '📋',
  'model-lifecycle': '🔁',
  'weights-licensing': '⚖️',
  'developer-onboarding': '🚀',
  'safety-usage-policy': '🛡️',
  'ecosystem-availability': '🌐',
  // email-apis arena ('send-api' would land on the generic api plug and 'deliverability'
  // has no keyword rule at all)
  'send-api': '📤',
  'deliverability': '📬',
  'templates-content': '📝',
  'events-webhooks': '🪝',
  'inbound-mail': '📥',
  'developer-experience': '🛠️',
  'sending-scale': '📈',
  // virtual-mailboxes arena (physical mail vocabulary is new)
  'address-setup': '📍',
  'mail-scanning': '📠',
  'forwarding-shipping': '📦',
  'check-deposit': '🏦',
  'business-services': '🏢',
  'integrations-access': '🧩',
  'plans-locations': '🗺️',
  'trust-reliability': '🛡️',
  // startup-law-firms arena (legal-practice vocabulary is new; 'ip-protection' would otherwise
  // fall through to the fallback and 'fee-transparency' must not land on a generic pricing rule)
  'formation-incorporation': '🏛️',
  'venture-financing': '💰',
  'ip-protection': '💡',
  'employment-equity': '🧑‍💼',
  'privacy-data-counsel': '🔏',
  'cross-border-reach': '🌍',
  'startup-program': '🎓',
  'fee-transparency': '🧾',
  'legal-tech-enablement': '⚙️',
  // startup-immigration arena (visa-practice vocabulary; 'timelines-fees' must not land on a
  // generic pricing rule and 'platform-experience' would otherwise hit the fallback)
  'visa-strategy': '🧭',
  'petition-execution': '📑',
  'timelines-fees': '⏱️',
  'platform-experience': '🖥️',
  'startup-ecosystem': '🎓',
  'employer-sponsor-support': '🏢',
  'origin-country-reach': '🌏',
  'credentialed-expertise': '🎖️',
}

// Emoji for a story theme id — every live theme in data/*/stories.json must resolve to a
// non-fallback icon (enforced by lib/__tests__/icons.test.ts).
export function themeIcon(theme: string): string {
  const exact = THEME_EXACT[theme]
  if (exact) return exact
  for (const [test, icon] of THEME_RULES) {
    if (test.test(theme)) return icon
  }
  return THEME_FALLBACK_ICON
}

// Hand-written one-liners for the themes buyers actually meet: every global/cross-arena theme
// plus the most common category themes across arenas (everything appearing in ≥7 stories in
// data/*/stories.json — enforced for the top 40 by lib/__tests__/icons.test.ts). Arena-specific
// niche ids get an honest generic instead. Tooltips are REQUIRED wherever a theme icon renders —
// founder rule — and the same text renders VISIBLY as a subtitle under theme group headers.
// Style: lowercase fragment (it follows "Name — " in tooltips; themeExplanation() capitalizes).
const THEME_DESCRIPTIONS: Record<string, string> = {
  // Fintech-data arenas (identity-verification / banking-data-apis / stablecoin-payments)
  'integration-dx': 'sandboxes, test modes, webhooks, and how fast a developer gets to a working integration',
  // Global themes — scored on every product, comparable across all arenas.
  agenticness: 'how well agents can access and operate the product',
  'agent-access': 'MCP, CLI, and API access for agents',
  'agentic-features': 'AI/agent features built into the product',
  'api-quality': 'depth and reliability of the public API — machine specs, docs, versioning discipline',
  'privacy-posture': 'data-handling and privacy stories',
  openness: 'open source, data portability, and self-hosting stories',
  'automation-depth': 'how much of the product can run unattended',
  // Common category themes, ordered roughly by how many stories carry them.
  'pricing-limits': 'free-tier ceilings, usage caps, and rate limits before you have to pay',
  'dev-experience': 'day-to-day developer experience — setup friction, docs, debugging, iteration speed',
  security: 'security posture and hardening stories',
  'performance-hardware': 'raw speed and hardware efficiency — throughput, latency, resource use',
  'pricing-plans': 'plan structure and value — what each tier costs and what it unlocks',
  'automation-workflows': 'building automations — triggers, actions, branching, scheduling',
  'accounts-payments': 'opening accounts and moving money — setup, transfers, payment rails',
  ecosystem: 'integrations, plugins, and third-party ecosystem stories',
  'scale-reliability': 'behavior under load — scaling limits, uptime, failure handling',
  'edge-compute': 'running code at the edge — regions, cold starts, runtime limits',
  'git-code': 'core git and code operations — cloning, branching, pushing, code browsing',
  'ecosystem-tooling': 'surrounding tooling — plugins, templates, community packages',
  'deploy-workflow': 'the commit-to-production path — builds, previews, rollbacks',
  'planning-tracking': 'planning and tracking work — issues, sprints, boards, status',
  onboarding: 'getting started and time-to-first-value stories',
  'components-reactivity': 'the component model — state, reactivity, rendering, composition',
  'cards-spend': 'issuing cards and controlling spend — limits, approvals, expense capture',
  'ux-tooling': 'the working surface itself — layout, ergonomics, quality-of-life tooling',
  'serving-api': 'serving models over an API — endpoints, compatibility, reliability',
  integrations: 'connecting to other tools — breadth and depth of built-in integrations',
  'extraction-quality': 'how faithfully content is extracted — structure, fidelity, edge cases',
  'terminal-ssh': 'terminal and SSH workflows — shells, sessions, remote access',
  'repos-collaboration': 'working on repos together — pull requests, reviews, permissions',
  'networking-security': 'network controls and isolation — private access, firewalls, encryption',
  'storage-data': 'storing and moving data — persistence, formats, durability',
  'review-quality-gates': 'quality gates on changes — review flow, required checks, merge protection',
  performance: 'speed in practice — latency, throughput, responsiveness',
  observability: 'seeing what the system is doing — logs, metrics, traces, alerts',
  customization: 'bending the product to your needs — settings, theming, extension points',
  collaboration: 'working as a team — sharing, comments, roles, simultaneous editing',
  'capture-intake': 'getting things in fast — capture, import, inbox flows',
  'tracing-instrumentation': 'instrumenting code and tracing requests end to end',
  'review-safety': 'keeping generated changes safe — diffs, approvals, guardrails',
  'model-support': 'which models run and how well — coverage, formats, update cadence',
  'js-rendering': 'handling JavaScript-heavy pages — rendering, waiting, dynamic content',
  'install-setup': 'getting it installed and running — prerequisites, packaging, first run',
  'evals-datasets': 'measuring quality — datasets, eval runs, regression tracking',
  'ci-cd': 'continuous integration and delivery — pipelines, runners, caching',
  'autonomous-implementation': 'end-to-end implementation by the agent — multi-file changes, task completion',
  'scale-parallelism': 'running many jobs at once — concurrency, fleets, queueing',
  // Displayed as "Agent actions" (THEME_LABEL_OVERRIDES) — plain words for what it covers.
  'action-primitives': 'what an agent can do on a page — click, type, and act on described elements',
  'running-agents': 'operating agents in production — sessions, persistence, recovery',
  'provisioning-lifecycle': 'creating, updating, and tearing down resources across their lifecycle',
  'plan-apply': 'the plan/apply loop — previewing infrastructure changes and applying them safely',
  'ide-terminal-integration': 'meeting you in the IDE and terminal — extensions, inline flows, context',
  'human-oversight': 'keeping a human in the loop — approvals, checkpoints, interrupts',
  'ecosystem-integrations': 'the surrounding ecosystem — integrations, marketplaces, community packages',
  'database-realtime': 'database and realtime features — queries, subscriptions, live sync',
  'code-generation': 'quality of generated code — correctness, style, fit to the codebase',
  'codebase-understanding': 'how deeply the tool maps your repo — cross-file context, architecture awareness, history',
  'interaction': 'how you steer it — commands, replies, review conversations, configurability in the loop',
  'surfaces': 'where it meets your workflow — IDE, CLI, web, PR comments, CI checks',
  'anti-bot': 'getting past bot defenses — CAPTCHAs, fingerprinting, blocks',
  'agent-building': 'building agents — abstractions, tool wiring, control flow',
  // security-keys arena
  'protocol-coverage': 'FIDO2/WebAuthn depth — resident-key passkeys, user verification, credential management',
  'beyond-fido': 'what the key does beyond FIDO — PIV smart card, OpenPGP, OTP slots, hardware-backed SSH',
  'form-factors': 'the physical lineup — NFC, USB-C/A, biometrics, certified and hardened models',
  'enrollment-recovery': 'getting keys enrolled and surviving loss — setup flows, backup keys, lockout recovery',
  'fleet-management': 'keys at organization scale — bulk provisioning, delivery services, IdP policies',
  'developer-tooling': 'building with and managing the key — CLIs, SDKs, attestation',
  'firmware-openness': 'what runs on the device — open-source firmware, update policy, vulnerability response',
  'ecosystem-compat': 'where the key works — platforms, browsers, service compatibility catalogs',
  // authenticator-apps arena
  'totp-core': 'the TOTP fundamentals — QR enrollment, organization, offline codes, non-standard tokens',
  'passkey-support': 'passkeys in the vault — storage, sign-in, cross-ecosystem sync',
  'sync-backup': 'not losing your accounts — encrypted backup, multi-device sync, recovery',
  'portability': 'your secrets stay yours — open export, bulk import, device migration',
  'self-hosting': 'running it yourself — self-hosted servers, open-source clients',
  'security-posture': 'how it protects itself — app lock, E2EE design, audits, breach alerting',
  'team-admin': 'shared and managed use — shared vaults, org policies, programmatic provisioning',
  // self-hosted-assistants arena
  'self-host-install': 'getting it running on your own machine — installers, Docker, updates, recovery',
  // compliance-automation arena
  'framework-coverage': 'the frameworks it can carry — SOC 2, ISO 27001, HIPAA, cross-framework mapping',
  'evidence-collection': 'proof gathered by machine — integrations, automated evidence, custom pushes',
  'continuous-monitoring': 'catching drift early — continuous control tests, alerts, device and vendor checks',
  'audit-workflow': 'the audit itself — auditor access, auditor network, honest readiness',
  'trust-center': 'showing your posture — hosted trust pages, report sharing, freshness',
  'questionnaire-automation': 'security questionnaires answered — AI drafts from real controls, format coverage',
  'risk-policy': 'the program behind the audit — risk register, policies, training',
  'workforce-compliance': 'people as controls — onboarding/offboarding proof, access reviews',
  // applicant-tracking arena
  'pipeline-management': 'running the funnel — stages, candidate records, collaboration, approvals',
  'careers-page': 'where candidates apply — hosted careers pages, job-board distribution, forms',
  'interview-scheduling': 'getting interviews booked — self-scheduling, panels, interviewer prep',
  'structured-interviews': 'judging candidates fairly — scorecards, interview plans, bias controls',
  'sourcing-crm': 'filling the top of funnel — talent pools, sequences, referrals',
  'offer-management': 'closing the hire — offer letters, e-signature, onboarding handoff',
  'recruiting-analytics': 'seeing the funnel honestly — conversion, time-to-hire, exports',
  'recruiting-ai': 'the AI layer — screening, interview notes, drafted outreach, safeguards',
  // domain-registrars arena
  'domain-search': 'finding the name — availability search and APIs, TLD breadth, premiums',
  'registration-transfer': 'owning the name — registration APIs, transfers, renewals, bulk ops',
  'dns-management': 'pointing the name — DNS hosting, record APIs, DNSSEC',
  'whois-privacy': 'protecting the name — free WHOIS privacy, transfer/registry locks, account security',
  'pricing-transparency': 'honest prices — published per-TLD lists, at-cost claims, pricing APIs',
  'registrar-platform': 'the developer surface — sandboxes, API keys, bundled basics, host connect',
  // sso-identity arena
  'app-catalog': 'apps behind one login — SSO catalogs, custom SAML/OIDC, user portals',
  'scim-provisioning': 'accounts that manage themselves — SCIM, instant deprovisioning, HRIS sync',
  'mfa-policy': 'stronger sign-in — phishing-resistant MFA, adaptive policies, passwordless',
  'device-trust': 'only healthy devices — posture checks in policy, device management',
  'directory-core': 'the source of truth — users/groups APIs, group rules, legacy LDAP/RADIUS',
  'lifecycle-automation': 'identity on autopilot — workflows, access certification, config as code',
  'identity-observability': 'seeing every event — system logs, SIEM streaming, incident transparency',
  'agent-identity': 'agents as identities — cross-app access, token vaulting, scoped agent credentials',
  // cloud-storage arena
  'files-api': 'files as an API — upload/download endpoints, resumable sessions, revision history',
  'sync-webhooks': 'staying in sync — delta/cursor listing, change webhooks, desktop clients',
  'sharing-permissions': 'who can see what — programmable shared links, granular roles, external-sharing governance',
  'search-metadata': 'finding and tagging files — content search APIs, custom metadata schemas',
  'content-workflows': 'work happening on the files — previews, e-signature, co-editing, AI over content',
  'admin-governance': 'running the team tenant — member/group admin APIs, audit-log access',
  'storage-pricing': 'what the gigabytes cost — published quotas, per-user prices, free tiers',
  // cloud-platforms arena
  'iac-surface': 'infrastructure as code — first-party IaC, official Terraform providers, import/drift',
  'identity-access': 'who and what gets in — fine-grained IAM, short-lived workload credentials, agent scoping',
  'cost-controls': 'keeping the bill sane — budgets and alerts, cost APIs and exports, published pricing',
  'core-platform': 'the compute basics — managed Kubernetes, serverless, databases, regions',
  'platform-docs': 'docs at platform scale — consistent service references, status and incident transparency',
  'ai-platform': 'AI as a platform service — managed inference, agent runtimes',
  'messaging-surfaces': 'where you talk to it — WhatsApp/Telegram/Discord channels, voice, native apps',
  'model-backends': 'the models behind it — multi-provider keys, local models, failover, cost visibility',
  'skills-plugins': 'extending it — skill registries, plugin authoring, ecosystem scale and safety',
  'computer-control': 'hands on the computer — shell and file exec, browser automation, paired devices',
  'credential-security': 'keeping your keys and machine safe — secret stores, sandboxing, approval gates',
  'memory-context': 'what it remembers — persistent memory, knowledge bases, context you can inspect',
  'orchestration-multi-agent': 'more than one agent — named agents, routing, subagents and swarms',
  // game-engines arena
  'core-engine': 'the engine core — rendering, 2D, physics, performance at scale',
  'scripting': 'writing the game — languages, visual scripting, iteration speed',
  'editor-tooling': 'the editor as a product — scene tools, extensibility, team workflows',
  'asset-pipeline': 'getting content in — automated import, formats, marketplaces',
  'platform-export': 'shipping everywhere — desktop, mobile, console, browser payloads',
  'headless-automation': 'the engine without a human — CLI builds, CI test runs, dedicated servers',
  'ai-workflows': 'AI in the engine loop — agent-driven editors, copilots, codegen-friendly APIs, runtime inference',
  'licensing-openness': 'the terms you build on — licenses, royalties, source access, pricing stability',
  // frontier-models arena
  'capability-surface': 'what the model can do for code — tool calling, structured/typed outputs, streaming, context, reasoning controls',
  'pricing-rate-limits': 'the cost of intelligence — public per-token prices, rate limits, caching and batch discounts, spend controls',
  'model-transparency': 'what the vendor admits — model/system cards, reproducible benchmarks, documented failure modes',
  'model-lifecycle': 'models as dependencies — versioned IDs, aliases, deprecation policies, changelogs, discovery endpoints',
  'weights-licensing': 'who owns the weights — open downloads, licenses, fine-tuning access, derivative ecosystems',
  'developer-onboarding': 'zero to first call — self-serve keys, quickstarts, cookbooks, drop-in compatibility',
  'safety-usage-policy': 'the rules of use — usage policies, published safety evaluations, guardrail tooling',
  'ecosystem-availability': 'where else it lives — cloud and gateway distribution, coding-agent integrations, community scale',
  // email-apis arena
  'send-api': 'the core send — single and batch endpoints, idempotent retries, scheduled delivery',
  'deliverability': 'reaching the inbox — guided SPF/DKIM/DMARC, reputation insight, suppressions, dedicated IPs',
  'templates-content': 'the message itself — template APIs, merge-field personalization, email-as-code',
  'events-webhooks': 'what happened to the email — delivery webhooks, signed payloads, per-message event history',
  'inbound-mail': 'receiving email — MX-to-webhook parsing and routing rules',
  'developer-experience': 'zero to first email — quickstarts, sandbox test modes, SMTP fallback',
  'sending-scale': 'growing past one app — subaccount isolation, documented throughput and rate limits',
  // virtual-mailboxes arena
  'address-setup': 'becoming addressable — real street addresses, the USPS 1583 flow, proof banks accept',
  'mail-scanning': 'paper to pixels — open-and-scan turnaround, OCR, retention and shredding controls',
  'forwarding-shipping': 'moving the physical thing — forwarding rules, package acceptance and consolidation',
  'check-deposit': 'mail that is money — check deposit service and published deposit terms',
  'business-services': 'beyond the mailbox — registered agent, formation tie-ins, compliance-mail flagging',
  'integrations-access': 'mail as data — public APIs for mail items, new-mail webhooks, bulk scan export',
  'plans-locations': 'what it costs where — transparent per-item pricing and location network breadth',
  'trust-reliability': 'who touches your mail — facility security, scan protection, human support',
  // startup-law-firms arena
  'formation-incorporation': 'day-zero counsel — incorporation, founder stock and vesting, 83(b) guidance',
  'venture-financing': 'the fundraise — SAFEs and convertibles, priced rounds, both-sides market fluency',
  'ip-protection': 'owning the invention — patent strategy, trademarks, IP litigation, open-source counseling',
  'employment-equity': 'hiring people — offer and IP-assignment paperwork, option plans, executive comp',
  'privacy-data-counsel': 'data as a legal problem — GDPR/CCPA counseling, incident response, regulator experience',
  'cross-border-reach': 'more than one jurisdiction — own offices abroad, cross-border rounds, flips',
  'startup-program': 'what the firm gives away — open document generators, published guides, accelerator programs',
  'fee-transparency': 'what it costs — published startup packages, deferred-fee terms, stated engagement models',
  'legal-tech-enablement': 'the firm as software — client portals, document automation, published AI tooling',
  // startup-immigration arena
  'visa-strategy': 'which visa and why — O-1 qualification assessment, the full pathway menu, founder self-sponsorship',
  'petition-execution': 'the filing itself — petition prep, RFE responses, premium processing, the green-card continuation',
  'timelines-fees': 'what it costs and how long — published flat fees, separated government fees, stated approval-rate basis',
  'platform-experience': 'the case as software — status dashboards, structured document collection, stated AI-drafting posture',
  'startup-ecosystem': 'what the provider gives away — open visa guides, free eligibility tools, accelerator programs',
  'employer-sponsor-support': 'the company side — H-1B transfers and registrations, LCA compliance, team-scale mobility',
  'origin-country-reach': 'where founders come from — origin-country guidance, consulate specifics, honest plan-B counsel',
  'credentialed-expertise': 'who signs the petition — licensed attorneys of record, government-data-grounded claims',
}

// Honest fallback for an arena-specific niche theme no bespoke line covers.
function genericThemeDetail(theme: string): string {
  return `stories about ${humanizeTheme(theme).toLowerCase()} in this arena`
}

// True when a theme has a bespoke hand-written explanation (vs the generic fallback) — the
// coverage test asserts this for the top-40 most-used themes across data/*/stories.json.
export function hasBespokeThemeExplanation(theme: string): boolean {
  return theme in THEME_DESCRIPTIONS
}

// One-line explanation of a theme WITHOUT the theme name — for visible subtitles under group
// titles that already print the name (product-page "By theme" cards, checklist/report group
// headers, battle sections). Sentence-cased for standalone display.
export function themeExplanation(theme: string): string {
  const detail = THEME_DESCRIPTIONS[theme] ?? genericThemeDetail(theme)
  return detail.charAt(0).toUpperCase() + detail.slice(1)
}

// Name + explanation, for hover tooltips in compact spots (matrix headers, icon chips) where a
// visible subtitle wouldn't fit.
export function themeTooltip(theme: string): string {
  const detail = THEME_DESCRIPTIONS[theme] ?? genericThemeDetail(theme)
  return `${humanizeTheme(theme)} — ${detail}`
}

// ---------- Metric icons ----------

// The comparison/leaderboard metrics. One entry per CONCEPT; aliases below map the various
// field spellings (aiEra/overallScore, agenticApp/aiNative, …) onto them.
const METRICS: Record<string, { icon: string; tooltip: string }> = {
  overallScore: { icon: '🏆', tooltip: 'Overall score — overall agent-tested score for the AI era (0–100)' },
  agentReady: { icon: '🤖', tooltip: 'Agent-ready — how well AI agents can access and operate the product' },
  aiNative: { icon: '✨', tooltip: 'Built-in AI — how agentic the product experience itself is' },
  apiQuality: { icon: '🔌', tooltip: 'API quality — depth and reliability of the public API' },
  openness: { icon: '🔓', tooltip: 'Openness — open source, data portability, and self-hosting' },
  automation: { icon: '⚙️', tooltip: 'Automation — how much of the product can run unattended' },
  privacy: { icon: '🔒', tooltip: 'Privacy — data-handling and privacy posture' },
  popularity: { icon: '⭐', tooltip: 'Popularity — GitHub stars and adoption signals' },
  confidence: { icon: '🎯', tooltip: 'Confidence — how solid the evidence behind the score is' },
  access: { icon: '🛠️', tooltip: 'Agent access — MCP, CLI, and API availability' },
  coverage: { icon: '📊', tooltip: 'Coverage — share of judged stories with real evidence' },
}

const METRIC_ALIASES: Record<string, keyof typeof METRICS> = {
  aiEra: 'overallScore',
  score: 'coverage',
  arenaScore: 'overallScore',
  paScore: 'overallScore', // legacy, pre-rename spelling
  'agent-ready': 'agentReady',
  agenticApp: 'aiNative',
  'ai-native': 'aiNative',
  'api-quality': 'apiQuality',
  openSource: 'openness',
  stars: 'popularity',
}

function metricEntry(metric: string): { icon: string; tooltip: string } | null {
  return METRICS[metric] ?? METRICS[METRIC_ALIASES[metric] ?? ''] ?? null
}

// Emoji for a comparison metric key ('' for an unknown key — callers render nothing rather
// than a wrong icon).
export function metricIcon(metric: string): string {
  return metricEntry(metric)?.icon ?? ''
}

// The REQUIRED tooltip for a metric icon — naming the concept, per the site-wide rule.
export function metricTooltip(metric: string): string {
  return metricEntry(metric)?.tooltip ?? ''
}
