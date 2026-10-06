// Deterministic story-scope tagger: stamps `scope` (global | category | product — see
// lib/schemas.ts's StorySchema) onto every story in every category's stories.json. No LLM —
// pure keyword/structure rules so every assignment is reproducible and reviewable (the run
// prints one line per story: `<arena> <scope> [<rule>] <id>`). Re-runnable and idempotent.
//
// Rule ladder, first match wins (anything ambiguous falls through to 'category'):
//   1. canonical        → global   the 29 canonical lens ids (pipeline/agentic-stories.ts) are
//                                  cross-arena by definition; they also carry scope at the
//                                  source, this just backfills committed data files.
//   2. claims-probe     → product  claims-derived depth-mine stories (origin kind 'normalized',
//                                  promptVersion 'v2-depth' — distilled from ONE vendor's
//                                  unmapped claims, see pipeline/scripts/depth-mine.ts) where
//                                  exactly one product in the arena holds a positive (full/
//                                  partial) verdict: effectively a probe of that product's
//                                  specific claim, however neutrally the title is phrased.
//   3. strong-global    → global   concepts unambiguously meaningful for ANY software product
//                                  even when domain nouns appear nearby: 2FA/SSO/RBAC/audit
//                                  logs, pricing transparency (overage/seat/free tier), uptime
//                                  SLA/status page, documented rate limits, accessibility,
//                                  CVE track record.
//   4. domain-vocabulary→ category the arena's own nouns (treasury, payroll, proxy, kernel…):
//                                  a story speaking the domain's language is compared within
//                                  the domain, even if it also mentions a webhook or a CLI.
//   5. weak-global      → global   generic capabilities (CLI, webhooks, SDK, API keys/tokens,
//                                  self-host, offline, export/import, mobile app, docs/upgrade
//                                  guides, localization) that only count as global when NOT
//                                  phrased in domain vocabulary.
//   6. default          → category
//
// Cache safety: judge.ts's cellHash hashes only storyId + title + evidence + promptVersion —
// never the whole story object — so stamping `scope` can never bust the judge cache or trigger
// a re-judge (same contract as `origin`, see migrate-story-origin.ts).
import fs from 'node:fs'
import path from 'node:path'
import { stripPersonaPrefix } from '../../lib/data-helpers'
import { type Story, StorySchema, VerdictBaseSchema } from '../../lib/schemas'
import {
  AGENTIC_FEATURE_STORIES,
  AGENTIC_STORIES,
  API_QUALITY_STORIES,
  AUTOMATION_STORIES,
  OPENNESS_STORIES,
  PRIVACY_STORIES,
} from '../agentic-stories'
import { categoryDir, readCategories, writeJson } from '../paths'

export type StoryScope = NonNullable<Story['scope']>

export const CANONICAL_IDS = new Set(
  [
    ...AGENTIC_STORIES,
    ...AGENTIC_FEATURE_STORIES,
    ...API_QUALITY_STORIES,
    ...OPENNESS_STORIES,
    ...AUTOMATION_STORIES,
    ...PRIVACY_STORIES,
  ].map((s) => s.id),
)

// Tier 3: cross-software concepts that stay global even next to domain nouns. Matched against
// lowercased `id title group`.
export const STRONG_GLOBAL_PATTERNS: { rule: string; pattern: RegExp }[] = [
  { rule: 'auth', pattern: /\b(2fa|two[- ]factor|mfa\b|multi[- ]factor|single sign[- ]on|sso\b|saml|passkey|passwordless)/ },
  { rule: 'credentials', pattern: /\b(identity provider|enterprise identity|service account)/ },
  { rule: 'access-control', pattern: /\b(granular (user )?(permission|role)|role[- ]based|roles and permissions|permissions and roles|audit log)/ },
  { rule: 'pricing-transparency', pattern: /\b(pricing|overage|billing|billed|free tier|paid license|plan tier|usage cap|quota|seat[- s]|per[- ]seat|spending (cap|limit)|spend cap)/ },
  { rule: 'reliability', pattern: /\b(status page|uptime|incident (history|postmortem|status)|postmortem)/ },
  { rule: 'support-quality', pattern: /\b(customer support|support response|commercial support)/ },
  { rule: 'rate-limit-disclosure', pattern: /\b(documented rate limit|rate[- ]limit disclosure|rate limits and concurrency|concurrency cap)/ },
  { rule: 'accessibility', pattern: /\b(accessibilit|screen reader)/ },
  { rule: 'security-track-record', pattern: /\b(cve\b|security advisor|vulnerability disclos)/ },
]

// Tier 5: generic capabilities that are global only when the story is NOT phrased in the
// arena's domain vocabulary (a "payroll lifecycle events webhook" story is a payroll story).
export const WEAK_GLOBAL_PATTERNS: { rule: string; pattern: RegExp }[] = [
  { rule: 'cli', pattern: /\b(cli\b|command[- ]line)/ },
  { rule: 'webhooks', pattern: /\bwebhooks?\b/ },
  { rule: 'sdk', pattern: /\bsdks?\b/ },
  { rule: 'credentials', pattern: /\b(api key|access token|ssh key)/ },
  { rule: 'self-host', pattern: /\bself[- ]host/ },
  { rule: 'offline', pattern: /\boffline\b/ },
  { rule: 'export-import', pattern: /\b(export|import)\b|portable format|data portability/ },
  { rule: 'mobile-app', pattern: /\bmobile (app|device)\b/ },
  { rule: 'docs-quality', pattern: /\b(documentation|upgrade guide|migration guide|interactive tutorial|learning resources)\b/ },
  { rule: 'localization', pattern: /\b(localization|localized|translation|my own language)\b/ },
  { rule: 'open-source', pattern: /\bopen[- ]source\b|open license/ },
]

// Tier 4: each arena's own nouns — deliberately tight lists of strong domain words (matched
// against lowercased `id title group`), not exhaustive vocabularies. A word here means "this
// story is speaking the domain's language"; generic words (work, tool, platform, data) never
// belong here or they would swallow the genuinely global stories.
export const DOMAIN_VOCAB: Record<string, string[]> = {
  'agent-frameworks': ['agent', 'tool', 'orchestrat', 'workflow', 'handoff', 'llm', 'model', 'guardrail', 'checkpoint', 'human-in-the-loop', 'human approval', 'memory', 'trace', 'eval', 'structured output', 'streaming', 'multi-agent', 'context window', 'scaffold'],
  'agent-sandboxes': ['sandbox', 'isolat', 'untrusted', 'code execution', 'microvm', 'container', 'snapshot', 'cold start', 'egress', 'runtime', 'vcpu', 'gpu', 'per-second', 'fleet', 'agent', 'browser', 'filesystem', 'teardown', 'provision'],
  'desktop-os': ['desktop', 'kernel', 'driver', 'boot', 'hardware', 'window', 'disk', 'firewall', 'distro', 'wallpaper', 'clipboard', 'phone', 'tablet', 'virtual machine', 'app store', 'app catalog', 'operating system', 'linux', 'tpm', 'gpu'],
  'startup-banking': ['bank', 'payment', 'card', 'invoice', 'treasury', 'yield', 'currenc', 'ach', 'wire', 'deposit', 'accounting', 'ledger', 'vendor', 'spend', 'cash', 'fdic', 'transaction', 'bill', 'procurement', 'financ', 'exchange rate', 'money'],
  'project-management': ['task', 'sprint', 'issue', 'roadmap', 'project', 'initiative', 'backlog', 'kanban', 'whiteboard', 'portfolio', 'time.tracking', 'dependenc', 'agent'],
  'web-scraping': ['scrap', 'crawl', 'proxy', 'captcha', 'selector', 'html', 'extract', 'browser', 'page', 'url', 'robots', 'headless', 'anti-bot', 'residential', 'screenshot'],
  'mobile-dev': ['ssh', 'terminal', 'git', 'repo', 'phone', 'mobile', 'device', 'commit', 'host', 'mosh', 'shell', 'unix', 'agent'],
  'code-hosting': ['repositor', 'repo\\b', 'git\\b', 'commit', 'merge', 'branch', 'pull request', 'pipeline', 'ci/cd', 'code', 'package registr', 'runner', 'issue'],
  'ai-coding': ['code', 'coding', 'agent', 'ide\\b', 'model', 'repo', 'diff', 'terminal', 'session', 'codebase', 'pull request', 'lint'],
  'edge-platforms': ['deploy', 'edge', 'serverless', 'cdn', 'dns', 'domain', 'traffic', 'runtime', 'infra', 'scaling', 'autoscal', 'container', 'function', 'tls', 'ddos', 'waf', 'postgres', 'database', 'preview', 'rollback', 'log'],
  'frontend-frameworks': ['component', 'dom\\b', 'framework', 'render', 'hydration', 'bundle', 'reactiv', 'template', 'routing', 'state management', 'scaffold', 'browser', 'polyfill', 'typescript', 'ssr'],
  'local-llm-runtimes': ['model', 'inference', 'gpu', 'quantiz', 'llm', 'token', 'cpu', 'runtime', 'vram', 'gguf', 'lora', 'decoding', 'serving', 'chat'],
  'self-hosted-assistants': ['assistant', 'agent', 'self-host', 'gateway', 'messenger', 'whatsapp', 'telegram', 'discord', 'imessage', 'slack\\b', 'channel', 'skill', 'plugin', 'model', 'ollama', 'local model', 'memory', 'browser', 'shell', 'exec', 'sandbox', 'secret', 'credential', 'voice', 'wizard', 'installer', 'docker', 'subagent', 'swarm', 'session', 'chat'],
  payroll: ['payroll', 'employee', 'contractor', 'tax', 'w-2', 'w-4', '1099', 'i-9', 'pay\\b', 'hire', 'benefit', 'pto', 'onboard', 'deposit', 'wage'],
  'compliance-automation': ['compliance', 'soc 2', 'iso 27001', 'hipaa', 'gdpr', 'pci', 'framework', 'control', 'evidence', 'audit', 'auditor', 'trust center', 'questionnaire', 'risk', 'policy', 'policies', 'vendor', 'access review', 'training', 'monitoring', 'drift', 'integration'],
  'applicant-tracking': ['candidate', 'hiring', 'recruit', 'interview', 'pipeline', 'job\\b', 'jobs\\b', 'careers', 'scorecard', 'offer', 'sourcing', 'referral', 'onsite', 'scheduling', 'applicant', 'resume', 'talent', 'hire', 'eeoc', 'onboarding'],
  'domain-registrars': ['domain', 'tld\\b', 'registr', 'whois', 'dns\\b', 'dnssec', 'nameserver', 'transfer', 'renew', 'epp\\b', 'availability', 'pricing', 'ssl\\b', 'email forwarding', 'registry', 'lock', 'aftermarket', 'premium'],
  'sso-identity': ['sso\\b', 'saml', 'oidc', 'scim', 'identity', 'idp\\b', 'directory', 'provision', 'deprovision', 'mfa', 'passkey', 'fido2', 'device', 'lifecycle', 'access', 'group', 'app catalog', 'ldap', 'radius', 'hris', 'certification', 'terraform', 'siem', 'workforce', 'employee', 'offboard'],
  'cloud-storage': ['file\\b', 'files', 'folder', 'upload', 'download', 'sync', 'share', 'shared link', 'permission', 'revision', 'version', 'delta', 'webhook', 'search', 'metadata', 'preview', 'thumbnail', 'signature', 'e-sign', 'data room', 'storage', 'quota', 'audit', 'team', 'admin'],
  'cloud-platforms': ['cloud', 'iac\\b', 'terraform', 'cloudformation', 'iam\\b', 'credential', 'budget', 'spend', 'billing', 'cost', 'region', 'kubernetes', 'serverless', 'function', 'database', 'free tier', 'sandbox', 'account', 'quickstart', 'deploy', 'status', 'inference', 'agent runtime', 'vpc\\b', 'compute'],
  'product-feedback': ['feedback', 'changelog', 'roadmap', 'portal', 'customer', 'release note', 'widget', 'vote', 'request', 'initiative'],
  'software-factory': ['agent', 'code', 'repo', 'pull request', 'task', 'ci\\b', 'build', 'diff', 'model'],
  'api-platforms': ['api\\b', 'collection', 'request', 'spec', 'gateway', 'mock', 'endpoint', 'openapi', 'contract'],
  'team-chat': ['channel', 'message', 'thread', 'topic', 'huddle', 'meeting', 'call\\b', 'workspace', 'chat', 'bot\\b', 'emoji', 'dm\\b', 'notification', 'guest', 'slash command', 'workflow'],
  'backend-as-a-service': ['database', 'schema', 'auth', 'storage', 'function', 'realtime', 'migration', 'row-level', 'vector', 'embedding', 'quer', 'backend', 'emulator', 'bucket', 'sign-in', 'postgres', 'sync', 'backup'],
  'llm-evals-observability': ['trace', 'tracing', 'span', 'eval', 'llm\\b', 'prompt', 'dataset', 'experiment', 'scorer', 'judge', 'annotation', 'token', 'guardrail', 'playground', 'model', 'latency', 'observab'],
  'ai-search-apis': ['search', 'query', 'result', 'index', 'snippet', 'citation', 'crawl', 'extract', 'news', 'domain', 'web\\b', 'page', 'answer', 'rag\\b', 'serp', 'retrieval', 'freshness'],
  terminals: ['terminal', 'shell', 'scrollback', 'pane', 'tab\\b', 'multiplex', 'tmux', 'prompt', 'command', 'ssh', 'rendering', 'gpu', 'font', 'ligature', 'color scheme', 'theme', 'dotfile', 'quake', 'graphics protocol', 'terminfo', 'kitten'],
  'package-managers': ['package', 'dependenc', 'lockfile', 'install', 'registr', 'manifest', 'workspace', 'monorepo', 'toolchain', 'runtime', 'version', 'pin\\b', 'binar', 'cache', 'formula', 'tap\\b', 'overlay', 'mirror', 'vulnerab', 'supply.chain', 'node_modules', 'bootstrap'],
  'vector-databases': ['vector', 'embedding', 'index', 'collection', 'similarity', 'ann\\b', 'hnsw', 'recall', 'rerank', 'hybrid', 'sparse', 'dense', 'metadata', 'namespace', 'tenant', 'shard', 'replica', 'quantiz', 'upsert', 'rag\\b', 'semantic', 'latency', 'serverless'],
  'frontier-models': ['model', 'llm', 'token', 'context window', 'weights', 'fine-tun', 'tool calling', 'function calling', 'structured output', 'streaming', 'prompt caching', 'batch', 'benchmark', 'model card', 'system card', 'deprecat', 'inference', 'reasoning', 'multimodal', 'frontier', 'typed', 'confidence', 'probabilit', 'sdk', 'quickstart', 'playground'],
  'inference-providers': ['model', 'inference', 'token', 'llm', 'gpu', 'serverless', 'endpoint', 'fine-tun', 'lora', 'batch', 'throughput', 'latenc', 'openai', 'chat completion', 'completions', 'embedding', 'quantiz', 'serving', 'stream', 'tokens/s'],
  'auth-platforms': ['auth', 'login', 'sign-in', 'sign-up', 'session', 'mfa', 'passkey', 'passwordless', 'sso\\b', 'saml', 'oidc', 'oauth', 'token', 'user', 'organization', 'tenant', 'rbac', 'permission', 'identity', 'scim', 'jwt', 'credential', 'idp\\b', 'consent'],
  'mcp-infrastructure': ['mcp\\b', 'server', 'registr', 'tool', 'agent', 'gateway', 'oauth', 'connect', 'catalog', 'toolkit', 'integration', 'meta-tool', 'inspector', 'playground', 'uplink', 'publish', 'vault', 'end user', 'allowlist', 'trigger', 'openapi'],
  'browser-agents': ['browser', 'page', 'dom\\b', 'session', 'captcha', 'stealth', 'proxy', 'headless', 'playwright', 'puppeteer', 'cdp\\b', 'selector', 'click', 'form', 'web task', 'navigat', 'extract', 'screenshot', 'fingerprint', 'profile', 'replay', 'agent', 'login', '2fa', 'workflow'],
  'ai-memory': ['memory', 'memories', 'recall', 'remember', 'forget', 'knowledge graph', 'entity', 'entities', 'session', 'context', 'retrieval', 'fact', 'graph', 'embedding', 'agent', 'llm', 'summariz', 'ingest', 'temporal', 'ttl\\b', 'expiration', 'multi-tenant', 'tenant'],
  'voice-agents': ['voice', 'call\\b', 'calls', 'phone', 'telephony', 'sip\\b', 'dial', 'barge-in', 'interrupt', 'turn-taking', 'turn detection', 'tts\\b', 'stt\\b', 'transcri', 'latency', 'dtmf', 'ivr\\b', 'voicemail', 'agent', 'conversation', 'outbound', 'inbound', 'clon', 'speech', 'campaign', 'transfer'],
  'notes-knowledge': ['note', 'notes', 'vault', 'backlink', 'wiki-link', 'graph', 'daily note', 'journal', 'markdown', 'plugin', 'template', 'local-first', 'offline', 'e2ee', 'end-to-end', 'publish', 'import', 'export', 'mobile', 'clip', 'block reference', 'transclusion', 'knowledge base', 'pkm\\b', 'sync'],
  'meeting-ai': ['meeting', 'meetings', 'transcri', 'notetaker', 'recording', 'speaker', 'diariz', 'summar', 'action item', 'calendar', 'bot\\b', 'botless', 'zoom', 'google meet', 'teams\\b', 'consent', 'retention', 'crm\\b', 'follow-up', 'soundbite', 'highlight', 'call\\b', 'calls'],
  'gpu-clouds': ['gpu', 'instance', 'cluster', 'provision', 'spot\\b', 'interruptible', 'preempt', 'on-demand', 'per-second', 'billing', 'vram', 'cuda', 'nvlink', 'interconnect', 'multi-node', 'training', 'inference', 'jupyter', 'ssh', 'volume', 'storage', 'template', 'docker image', 'availability', 'capacity', 'datacenter', 'h100', 'slurm', 'kubernetes', 'serverless', 'marketplace', 'idle', 'auto-shutdown', 'agent'],
  'feature-flags': ['flag', 'toggle', 'gate\\b', 'gates', 'rollout', 'roll out', 'experiment', 'a/b', 'variant', 'variation', 'targeting', 'segment', 'kill switch', 'evaluation', 'evaluate', 'bootstrap', 'streaming update', 'environment', 'approval', 'change request', 'stale', 'holdout', 'metric', 'stats engine', 'edge', 'relay', 'openfeature', 'agent'],
  'serverless-databases': ['database', 'db\\b', 'postgres', 'mysql', 'sqlite', 'libsql', 'sql\\b', 'branch', 'schema', 'migration', 'replica', 'backup', 'restore', 'point-in-time', 'pitr', 'connection', 'pooler', 'pooling', 'serverless', 'scale-to-zero', 'autoscal', 'quer', 'vector', 'embedding', 'analytical', 'warehouse', 'ddl\\b', 'orm\\b', 'dump', 'table', 'row'],
  'search-infra': ['search', 'index', 'indexes', 'indices', 'indexing', 'typo', 'facet', 'filter', 'relevance', 'ranking', 'rank', 'synonym', 'query', 'queries', 'hybrid', 'semantic', 'vector', 'embedding', 'autocomplete', 'instant', 'document', 'record', 'crawler', 'analytics', 'merchandis', 'federated', 'highlight'],
  scheduling: ['booking', 'book\\b', 'books', 'scheduling', 'schedule', 'reschedul', 'calendar', 'availability', 'meeting', 'invitee', 'attendee', 'event type', 'round-robin', 'round robin', 'collective', 'time zone', 'timezone', 'buffer', 'no-show', 'reminder', 'focus time', 'habit', 'working hours', 'slot', 'double-book', 'routing form', 'cancel'],
  'design-tools': ['design', 'prototyp', 'vector', 'canvas', 'component', 'variant', 'design token', 'design system', 'layer', 'frame', 'artboard', 'auto layout', 'constraint', 'handoff', 'inspect', 'multiplayer', 'cursor', 'plugin', 'library', 'libraries', 'style', 'mockup', 'wireframe', 'figma file', 'export', 'svg\\b', 'asset', 'brand kit', 'template'],
  'agent-skills': ['skill', 'skills', 'plugin', 'marketplace', 'agent', 'harness', 'frontmatter', 'skill.md', 'instruction', 'methodology', 'workflow', 'trigger', 'activat', 'coding agent', 'claude code', 'codex', 'cursor', 'collection', 'catalog', 'meta-skill', 'install', 'template', 'spec\\b'],
  'incident-management': ['incident', 'on-call', 'oncall', 'alert', 'page\\b', 'paging', 'escalat', 'schedule', 'rotation', 'shift', 'responder', 'postmortem', 'retrospective', 'status page', 'runbook', 'timeline', 'severity', 'sev\\b', 'mttr', 'mtta', 'slo\\b', 'outage', 'downtime', 'monitoring', 'observability', 'stakeholder', 'follow-up', 'acknowledg', 'ack\\b', 'war room', 'agent'],
  'customer-data-platforms': ['event\\b', 'events', 'tracking plan', 'track\\b', 'identify\\b', 'profile', 'identity', 'stitch', 'audience', 'segment', 'trait', 'cohort', 'activation', 'destination', 'source\\b', 'sources', 'pipeline', 'warehouse', 'reverse etl', 'reverse-etl', 'composable', 'consent', 'suppression', 'deletion', 'pii\\b', 'ingest', 'stream', 'replay', 'backfill', 'sdk', 'customer data', 'cdp\\b', 'agent'],
  'ecommerce-platforms': ['storefront', 'checkout', 'cart', 'catalog', 'product', 'merchant', 'order', 'inventory', 'fulfillment', 'shipping', 'tax\\b', 'taxes', 'payment', 'pos\\b', 'b2b', 'wholesale', 'theme', 'headless', 'commerce', 'buyer', 'shopper', 'discount', 'subscription', 'variant', 'marketplace', 'channel', 'store\\b', 'stores', 'sell\\b', 'selling', 'conversion', 'abandoned', 'duties', 'currenc', 'agent'],
  email: ['email', 'inbox', 'mail\\b', 'compose', 'draft', 'send\\b', 'sending', 'reply', 'replies', 'thread', 'triage', 'snooze', 'label', 'archive', 'snippet', 'template', 'signature', 'recipient', 'sender', 'newsletter', 'attachment', 'imap', 'jmap', 'smtp', 'gmail', 'outlook', 'calendar', 'invite', 'read status', 'tracking pixel', 'masked', 'alias', 'contact', 'agent', 'unsubscribe'],
  'docs-platforms': ['docs\\b', 'documentation', 'docs site', 'page\\b', 'pages\\b', 'mdx\\b', 'markdown', 'openapi', 'api reference', 'playground', 'llms.txt', 'reader', 'writer', 'author', 'editor', 'snippet', 'style guide', 'broken link', 'preview deployment', 'versioned', 'localization', 'translat', 'search', 'theme', 'custom domain', 'subpath', 'static bundle', 'change request', 'publish', 'navigation', 'assistant', 'agent', 'citation'],
  'ai-code-review': ['review', 'reviewer', 'reviews', 'pull request', 'pr\\b', 'prs\\b', 'diff', 'merge', 'commit', 'branch\\b', 'repo\\b', 'repos\\b', 'repositor', 'codebase', 'monorepo', 'inline comment', 'suggestion', 'suggested', 'bug\\b', 'bugs\\b', 'false positive', 'noise', 'severity', 'nit', 'style guide', 'status check', 'ci\\b', 'finding', 'fix\\b', 'fixes', 'patch', 'coding agent', 'ide\\b', 'agent'],
  'document-extraction': ['document', 'pdf', 'ocr\\b', 'parse', 'parsing', 'parsed', 'extract', 'page\\b', 'pages\\b', 'table', 'layout', 'scan', 'scanned', 'handwrit', 'chunk', 'markdown', 'schema', 'field\\b', 'fields', 'bounding box', 'bbox', 'citation', 'provenance', 'confidence', 'classif', 'split', 'invoice', 'multilingual', 'file type', 'upload', 'rag\\b', 'embedding', 'docx', 'pptx', 'xlsx', 'figure', 'chart', 'agent'],
  'data-pipelines': ['pipeline', 'connector', 'sync\\b', 'syncs', 'syncing', 'extract', 'load\\b', 'ingest', 'source\\b', 'sources', 'destination', 'warehouse', 'schema', 'incremental', 'backfill', 'cdc\\b', 'change data capture', 'reverse etl', 'elt\\b', 'etl\\b', 'dbt\\b', 'orchestrat', 'dag\\b', 'asset', 'lineage', 'transform', 'schedul', 'cron', 'run\\b', 'runs\\b', 'retry', 'retries', 'freshness', 'observab', 'alert', 'row\\b', 'rows\\b', 'table', 'stream', 'batch', 'dataset', 'agent'],
  'durable-workflows': ['workflow', 'workflows', 'durable', 'execution', 'step\\b', 'steps\\b', 'activit', 'checkpoint', 'retry', 'retries', 'backoff', 'idempoten', 'resume', 'replay', 'determinis', 'crash', 'sleep', 'wait\\b', 'waits\\b', 'signal', 'schedul', 'cron', 'trigger', 'event\\b', 'events\\b', 'queue', 'concurrenc', 'rate limit', 'throttl', 'debounce', 'fan-out', 'fan-in', 'child workflow', 'run\\b', 'runs\\b', 'worker', 'orchestrat', 'versioning', 'deploy', 'timeline', 'human-in-the-loop', 'approval', 'agent loop', 'agent', 'long-running', 'saga', 'compensat', 'state machine'],
  'ai-support-agents': ['support', 'ticket', 'customer', 'conversation', 'resolution', 'resolve', 'deflect', 'escalat', 'handoff', 'hand-off', 'help center', 'knowledge base', 'kb\\b', 'article', 'macro', 'agent\\b', 'agents\\b', 'copilot', 'chatbot', 'csat', 'answer', 'reply', 'replies', 'refund', 'order\\b', 'account\\b', 'procedure', 'sop\\b', 'guardrail', 'hallucinat', 'tone\\b', 'brand voice', 'channel', 'chat\\b', 'email', 'voice', 'phone', 'whatsapp', 'slack', 'multilingual', 'language', 'sentiment', 'triage', 'simulation', 'qa\\b', 'quality assurance', 'helpdesk', 'zendesk', 'salesforce', 'intercom', 'per-resolution', 'shopper', 'inquir'],
  'billing-subscriptions': ['subscription', 'billing', 'invoice', 'invoic', 'dunning', 'proration', 'prorat', 'metering', 'metered', 'usage event', 'usage-based', 'mrr\\b', 'churn', 'renewal', 'trial', 'coupon', 'promotion code', 'plan\\b', 'plans\\b', 'entitlement', 'tiered', 'graduated', 'per-unit', 'overage', 'credit note', 'revenue recognition', 'asc 606', 'ifrs 15', 'deferred revenue', 'general ledger', 'erp\\b', 'tax\\b', 'vat\\b', 'gst\\b', 'currency', 'payment method', 'card\\b', 'delinquen', 'grace period', 'billing cycle', 'anniversary billing', 'price point', 'grandfather', 'subscriber', 'recurring'],
  'fraud-prevention': ['fraud', 'risk score', 'risk scor', 'scoring', 'chargeback', 'dispute', 'representment', 'liability', 'guarantee', 'review queue', 'manual review', 'blocklist', 'block list', 'allowlist', 'allow list', 'velocity', 'rules engine', 'rule\\b', 'rules\\b', 'transaction', 'authorization', 'issuer', 'card testing', 'account takeover', 'ato\\b', 'fake account', 'promo abuse', 'policy abuse', 'false positive', 'approval rate', 'decline', '3ds\\b', 'sca\\b', 'psd2', 'exemption', 'device fingerprint', 'behavioral', 'bot\\b', 'bots\\b', 'buying agent', 'merchant', 'checkout', 'order\\b', 'orders\\b', 'psp\\b', 'processor', 'gateway', 'case management', 'investigation', 'analyst'],
  'agentic-commerce': ['agent', 'agents', 'commerce', 'checkout', 'cart', 'catalog', 'merchant', 'order', 'payment', 'pay\\b', 'pays', 'wallet', 'token', 'credential', 'mandate', 'spend', 'refund', 'dispute', 'chargeback', 'settlement', 'stablecoin', 'usdc', 'x402', '402\\b', 'mpp\\b', 'ucp\\b', 'acp\\b', 'ap2\\b', 'protocol', 'facilitator', 'buyer', 'shopper', 'shopping', 'purchase', 'transaction', 'fees', 'card\\b', 'cards', 'kya\\b', 'identity', 'trust tier', 'discovery', 'bazaar', 'directory', 'feed\\b', 'webhook', 'fulfillment', 'tracking'],
  'card-issuing': ['card\\b', 'cards\\b', 'issuing', 'issue\\b', 'issued', 'virtual card', 'physical card', 'cardholder', 'pan\\b', 'cvv\\b', 'authorization', 'auth\\b', 'decline', 'clearing', 'settlement', 'reversal', 'mcc\\b', 'merchant', 'spend limit', 'velocity', 'bin\\b', 'program\\b', 'prefund', 'just-in-time', 'jit\\b', 'interchange', 'network', 'visa', 'mastercard', 'apple pay', 'google pay', 'wallet', 'tokeniz', 'pin\\b', '3ds\\b', 'dispute', 'chargeback', 'kyc\\b', 'kyb\\b', 'pci\\b', 'ledger', 'balance', 'funding', 'reconcil', 'fulfillment', 'card art', 'reissue', 'agent'],
  'tax-automation': ['tax\\b', 'taxes', 'taxab', 'sales tax', 'vat\\b', 'gst\\b', 'nexus', 'jurisdiction', 'rate\\b', 'rates\\b', 'rooftop', 'threshold', 'registration', 'register', 'filing', 'file\\b', 'filed', 'remit', 'return\\b', 'returns\\b', 'exemption', 'exempt', 'certificate', 'resale', 'invoice', 'invoic', 'reverse charge', 'oss\\b', 'ioss\\b', 'marketplace facilitator', 'liability', 'audit', 'accrual', 'calculation', 'checkout', 'transaction', 'product code', 'tax code', 'digital goods', 'saas\\b', 'economic nexus', 'voluntary disclosure', 'vda\\b', 'penalty', 'penalties', 'compliance', 'agent'],
  'banking-as-a-service': ['bank\\b', 'banking', 'account\\b', 'accounts\\b', 'deposit', 'fdic\\b', 'fbo\\b', 'ach\\b', 'wire\\b', 'wires\\b', 'rtp\\b', 'fednow', 'swift', 'check\\b', 'checks\\b', 'routing number', 'account number', 'transfer', 'money movement', 'kyc\\b', 'kyb\\b', 'onboarding', 'sponsor', 'charter', 'partner bank', 'ledger', 'balance', 'reconcil', 'statement', 'interest', 'yield', 'sweep', 'compliance', 'bsa\\b', 'aml\\b', 'sar\\b', 'sanctions', 'monitoring', 'hold\\b', 'holds\\b', 'freeze', 'limit', 'debit card', 'card\\b', 'reg e', 'return\\b', 'returns\\b', 'webhook', 'counterparty', '1099', 'agent'],
  'marketplace-payments': ['marketplace', 'platform\\b', 'seller', 'sellers', 'merchant', 'sub-merchant', 'submerchant', 'payfac', 'payment facilitator', 'onboard', 'kyb\\b', 'kyc\\b', 'split\\b', 'splits\\b', 'route\\b', 'routing', 'transfer', 'payout', 'payouts', 'application fee', 'take rate', 'buy rate', 'markup', 'interchange', 'settlement', 'balance', 'ledger', 'hold\\b', 'holds\\b', 'escrow', 'negative balance', 'chargeback', 'dispute', 'liability', '1099-k', '1099', 'tax form', 'embedded', 'component', 'white-label', 'dashboard', 'reconcil', 'statement', 'instant payout', 'cross-border', 'currency', 'terminal', 'in-person', 'checkout', 'agent'],
  'processors': ['cpu\\b', 'cpus\\b', 'soc\\b', 'chip\\b', 'chips\\b', 'silicon', 'core\\b', 'cores\\b', 'clock', 'ghz\\b', 'boost', 'ipc\\b', 'npu\\b', 'neural engine', 'tops\\b', 'tdp\\b', 'watt', 'power envelope', 'perf-per-watt', 'performance per watt', 'memory bandwidth', 'unified memory', 'ddr5', 'lpddr', 'socket', 'chipset', 'pcie', 'lanes', 'x86', 'arm\\b', 'apple silicon', 'integrated graphics', 'igpu', 'media engine', 'encode', 'decode', 'benchmark', 'multi-core', 'single-thread', 'compile', 'render', 'battery', 'fanless', 'thermal', 'throttl', 'laptop', 'desktop', 'mini-pc', 'instruction set', 'avx', 'virtualization', 'hypervisor', 'spec sheet', 'llm\\b', 'inference', 'quantized'],
  'gpus': ['gpu\\b', 'gpus\\b', 'graphics card', 'vram\\b', 'hbm\\b', 'gddr', 'memory bandwidth', 'bus width', 'tensor', 'tflops', 'tops\\b', 'fp8\\b', 'fp4\\b', 'fp16\\b', 'bf16\\b', 'sparsity', 'cuda', 'rocm', 'hip\\b', 'tensorrt', 'vllm', 'driver', 'kernel module', 'nvlink', 'infinity fabric', 'interconnect', 'multi-gpu', 'rack', 'datacenter', 'training', 'inference', 'llm\\b', 'quantized', 'upscal', 'dlss', 'fsr\\b', 'frame generation', 'ray tracing', '4k\\b', 'refresh', 'fps\\b', 'game\\b', 'games', 'gaming', 'board power', 'tgp\\b', 'tdp\\b', 'connector', 'cooling', 'psu\\b', 'encoder', 'decoder', 'av1\\b', 'hevc', 'nvenc', 'isv\\b', 'ecc\\b', 'workstation', 'benchmark'],
  'identity-verification': ['identity', 'verification', 'verify', 'verified', 'kyc\\b', 'kyb\\b', 'document\\b', 'documents', 'passport', 'driver', 'license', 'selfie', 'liveness', 'biometric', 'face\\b', 'facial', 'deepfake', 'injection', 'watchlist', 'sanction', 'pep\\b', 'adverse media', 'aml\\b', 'screening', 'monitoring', 'applicant', 'inquiry', 'session', 'onboarding', 'review\\b', 'workflow', 'template', 'extraction', 'ocr\\b', 'ssn\\b', 'database check', 'phone\\b', 'redact', 'retention', 'consent', 'gdpr\\b', 'bipa\\b', 'duplicate', 'fraud', 'risk signal', 'reusable', 'agent'],
  'banking-data-apis': ['bank\\b', 'banks\\b', 'banking', 'account\\b', 'accounts', 'linking', 'link\\b', 'linked', 'aggregation', 'institution', 'transactions', 'transaction', 'balance', 'balances', 'ownership', 'owner\\b', 'routing', 'ach\\b', 'auth\\b', 'oauth', 'consent', 'open banking', 'open finance', 'pay by bank', 'payment initiation', 'vrp\\b', 'recurring', 'refresh', 'webhook', 'enrichment', 'categor', 'income', 'cashflow', 'cash flow', 'payroll', 'sandbox', 'test drive', 'connect\\b', 'connection', 'processor token', 'data access', 'scope', 'deletion', 'coverage', 'agent'],
  'stablecoin-payments': ['stablecoin', 'stablecoins', 'usdc\\b', 'usdt\\b', 'usdg\\b', 'pyusd\\b', 'crypto', 'wallet', 'wallets', 'onramp', 'on-ramp', 'offramp', 'off-ramp', 'payout', 'payouts', 'disbursement', 'chain\\b', 'chains\\b', 'blockchain', 'network\\b', 'ethereum', 'solana', 'base\\b', 'tempo\\b', 'mint\\b', 'redeem', 'issuance', 'reserve', 'attestation', 'custody', 'custodial', 'travel rule', 'sanction', 'kyc\\b', 'kyb\\b', 'testnet', 'faucet', 'gas\\b', 'settlement', 'settle', 'conversion', 'convert', 'fx\\b', 'quote\\b', 'treasury', 'virtual account', 'deposit address', 'x402\\b', 'mpp\\b', 'ap2\\b', 'acp\\b', 'agent'],
  'email-marketing': ['campaign', 'broadcast', 'newsletter', 'email', 'send', 'sends', 'sender', 'subject line', 'segment', 'audience', 'subscriber', 'contact', 'list\\b', 'lists', 'tag\\b', 'tags', 'automation', 'flow\\b', 'flows', 'journey', 'drip', 'welcome series', 'winback', 'lifecycle', 'deliverability', 'spf\\b', 'dkim', 'dmarc', 'bounce', 'suppress', 'unsubscrib', 'spam', 'can-spam', 'open rate', 'opens', 'click', 'transactional', 'template', 'mjml', 'personalization', 'webhook', 'a/b test', 'attribution', 'engagement', 'marketer', 'export', 'import', 'migrat'],
  'email-apis': ['email', 'send\\b', 'sends', 'sending', 'sender', 'transactional', 'deliverability', 'spf\\b', 'dkim', 'dmarc', 'dns\\b', 'domain', 'bounce', 'complaint', 'suppress', 'unsubscrib', 'spam', 'inbox placement', 'reputation', 'dedicated ip', 'warmup', 'template', 'merge', 'personalization', 'mjml', 'react email', 'webhook', 'event\\b', 'events', 'open\\b', 'opens', 'click', 'inbound', 'parse', 'mx\\b', 'smtp', 'relay', 'sandbox', 'test mode', 'idempoten', 'batch', 'scheduled', 'rate limit', 'throughput', 'subaccount', 'subuser', 'message id', 'recipient', 'attachment', 'quickstart', 'sdk\\b', 'agent'],
  'virtual-mailboxes': ['mail\\b', 'mailbox', 'mailing address', 'street address', 'po box', 'p.o. box', 'usps', '1583', 'cmra\\b', 'notari', 'scan\\b', 'scans', 'scanning', 'scanned', 'ocr\\b', 'envelope', 'forward', 'forwarding', 'shred', 'package', 'parcel', 'carrier', 'check\\b', 'checks', 'deposit', 'registered agent', 'service of process', 'llc\\b', 'formation', 'incorporat', 'compliance', 'irs\\b', 'proof of address', 'kyc\\b', 'bank\\b', 'location', 'locations', 'jurisdiction', 'recipient', 'webhook', 'zapier', 'export', 'storage', 'agent'],
  'startup-law-firms': ['law\\b', 'laws\\b', 'lawyer', 'legal', 'attorney', 'counsel', 'firm\\b', 'firms\\b', 'incorporat', 'formation', 'charter', 'bylaws', 'board consent', 'founder stock', 'vesting', '83(b)', 'safe\\b', 'safes\\b', 'convertible', 'priced round', 'series a', 'seed round', 'term sheet', 'financing', 'venture', 'vc\\b', 'investor', 'fund\\b', 'funds\\b', 'patent', 'trademark', 'copyright', 'trade secret', 'ip\\b', 'intellectual property', 'open.source licens', 'litigation', 'prosecution', 'employment', 'offer letter', 'piia', 'ciiaa', 'option plan', '409a', 'equity comp', 'executive comp', 'privacy', 'gdpr', 'ccpa', 'dpdp', 'data protection', 'regulator', 'cross-border', 'jurisdiction', 'office\\b', 'offices', 'flip\\b', 'emi\\b', 'vsop', 'esop', 'document generator', 'template', 'guide', 'accelerator', 'deferred fee', 'fixed fee', 'flat fee', 'retainer', 'billing rate', 'engagement letter', 'client portal', 'matter\\b', 'diligence', 'm&a\\b', 'exit\\b', 'clause', 'contract', 'agreement'],
  'government-services': ['irs\\b', 'ein\\b', 'uscis', 'uspto', 'sam\\.gov', 'eftps', 'fincen', 'franchise tax', 'secretary of state', 'sos\\b', 'registry', 'registrar', 'incorporat', 'formation', 'annual report', 'filing\\b', 'filings\\b', 'file\\b', 'filed\\b', 'statutory', 'statute', 'agency', 'agencies', 'government', 'federal', 'state\\b', 'jurisdiction', 'form\\b', 'forms\\b', 'petition', 'application', 'applicant', 'case\\b', 'docket', 'tax\\b', 'taxes\\b', 'taxpayer', 'e-file', 'transmitter', 'designee', 'registered agent', 'authorized provider', 'attestation', 'perjury', 'signature', 'wet-sign', 'id\\.me', 'login\\.gov', 'identity-proofing', 'identity proofing', 'liveness', 'captcha', 'robots\\.txt', 'bot wall', 'crawl', 'processing time', 'deadline', 'penalty', 'penalties', 'fee\\b', 'fees\\b', 'mail\\b', 'fax\\b', 'paper\\b', 'trademark', 'patent', 'entity\\b', 'entities\\b', 'founder\\b'],
  'startup-immigration': ['visa\\b', 'visas\\b', 'immigration', 'immigrant', 'uscis', 'petition', 'o-1\\b', 'o-1a', 'h-1b', 'h1b', 'e-2\\b', 'tn\\b', 'eb-1', 'eb-2', 'niw\\b', 'green card', 'parole', 'consulate', 'consular', 'rfe\\b', 'noid\\b', 'premium processing', 'i-907', 'i-129', 'i-140', 'lca\\b', 'cap-exempt', 'lottery', 'extraordinary ability', 'self-sponsor', 'sponsorship', 'sponsor', 'beneficiary', 'adjudicat', 'attorney', 'lawyer', 'counsel', 'law firm', 'case status', 'evidence binder', 'support letter', 'expert letter', 'filing fee', 'flat fee', 'approval rate', 'processing time', 'timeline', 'dependent', 'h-4\\b', 'o-3\\b', 'work authorization', 'founder\\b', 'origin country', 'backlog', 'expedite', '221(g)', 'dol\\b', 'foia\\b', 'accelerator', 'eligibility', 'qualifier', 'assessment'],
  'equity-management': ['cap table', 'capitalization', 'equity', 'share', 'shares', 'stock', 'option', 'grant', 'vest', 'safe\\b', 'safes', 'convertible', 'warrant', '409a', 'valuation', 'stakeholder', 'shareholder', 'dilution', 'waterfall', 'exercis', 'rsu', 'rsa\\b', 'esop', 'board', 'consent', 'certificate', 'strike price', 'fmv\\b', '83(b)', 'rule 701', 'form 3921', 'asc 718', 'secondar', 'tender', 'liquidity', 'data room', 'investor', 'founder', 'round', 'pro forma', 'emi\\b', 'hmrc', 'ownership', 'fundrais', 'diligence', 'counsel', 'law firm', 'hris', 'scenario'],
  'error-tracking': ['error', 'errors', 'crash', 'exception', 'stack trace', 'stacktrace', 'sourcemap', 'source map', 'symbolicat', 'dsym', 'proguard', 'breadcrumb', 'fingerprint', 'grouping', 'dedup', 'issue\\b', 'issues', 'release', 'regression', 'crash-free', 'session', 'alert', 'triage', 'assign', 'resolve', 'ignore', 'snooze', 'spike', 'quota', 'event\\b', 'events', 'ingest', 'sdk\\b', 'sdks', 'environment', 'tag\\b', 'tags', 'affected user', 'user feedback', 'root cause', 'suspect commit', 'scrub', 'pii\\b', 'jira', 'pagerduty', 'monitoring', 'symbol', 'minif', 'deploy', 'agent'],
  'expense-management': ['expense', 'expenses', 'spend', 'card\\b', 'cards', 'corporate card', 'virtual card', 'receipt', 'reimburs', 'per-diem', 'per diem', 'mileage', 'approval', 'approv', 'policy', 'policies', 'budget', 'transaction', 'merchant', 'categoriz', 'coding', 'accounting', 'quickbooks', 'netsuite', 'xero', 'ledger', 'close\\b', 'accrual', 'invoice', 'bill\\b', 'bills', 'vendor', 'travel', 'flight', 'hotel', 'itinerary', 'trip\\b', 'audit trail', 'currenc', 'entity', 'entities', 'ach\\b', 'payout', 'finance', 'ocr\\b', 'subscription', 'limit', 'decline', 'statement', 'procurement', 'agent'],
  'data-warehouses': ['warehouse', 'lakehouse', 'sql\\b', 'quer', 'table', 'schema', 'dataset', 'analytics', 'analytical', 'ingest', 'pipeline', 'streaming', 'notebook', 'semantic', 'metric', 'lineage', 'masking', 'dbt\\b', 'iceberg', 'delta', 'parquet', 'csv\\b', 'object storage', 'time.travel', 'compute', 'slot', 'credit', 'dbu\\b', 'marketplace', 'share', 'sharing', 'bi\\b', 'jdbc', 'odbc', 'agent', 'governed'],
  'security-keys': ['key\\b', 'keys\\b', 'fido2', 'fido\\b', 'webauthn', 'u2f\\b', 'passkey', 'resident key', 'credential', 'attestation', 'piv\\b', 'smart card', 'smartcard', 'openpgp', 'pgp\\b', 'gpg\\b', 'otp\\b', 'totp', 'hotp', 'challenge-response', 'nfc\\b', 'usb-c', 'usb-a', 'biometric', 'fingerprint', 'pin\\b', 'touch\\b', 'tap\\b', 'firmware', 'fips', 'common criteria', 'enroll', 'provision', 'fleet', 'idp\\b', 'okta', 'entra', 'phishing-resistant', 'hardware', 'token\\b', 'ssh\\b', 'signing', 'lockout', 'backup key', 'security key', 'authenticat', 'agent'],
  'authenticator-apps': ['totp', 'hotp', '2fa\\b', 'mfa\\b', 'two-factor', 'one-time', 'code\\b', 'codes\\b', 'qr\\b', 'seed\\b', 'seeds\\b', 'secret', 'passkey', 'vault', 'backup', 'sync\\b', 'e2ee', 'end-to-end', 'export', 'import', 'migrat', 'lock-in', 'watch\\b', 'browser extension', 'autofill', 'desktop app', 'self-host', 'open source', 'app lock', 'biometric', 'breach', 'watchtower', 'number matching', 'push\\b', 'phishing', 'audit', 'shared vault', 'credential', 'password', 'login', 'sign-in', 'account\\b', 'accounts\\b', 'authenticat', 'agent'],
  'game-engines': ['game\\b', 'games\\b', 'engine', 'render', 'shader', 'scene', 'scenes', 'node\\b', 'nodes\\b', 'sprite', 'tilemap', 'physics', 'collision', 'raycast', 'ecs\\b', 'entity', 'prefab', 'asset', 'assets', 'import', 'gltf', 'fbx\\b', 'usd\\b', 'editor', 'viewport', 'inspector', 'script', 'gdscript', 'blueprint', 'c#\\b', 'c\\+\\+', 'rust\\b', 'hot reload', 'headless', 'batch mode', 'batchmode', 'export', 'build\\b', 'builds\\b', 'ci\\b', 'platform', 'console', 'webgl', 'webgpu', 'browser', 'mobile', 'multiplayer', 'dedicated server', 'royalt', 'license', 'runtime fee', 'per-install', 'source access', 'marketplace', 'asset store', 'copilot', 'inference', 'profiler', 'level\\b', 'gameplay', 'animation', 'audio\\b', 'agent'],
}

export function domainPattern(categoryId: string): RegExp | null {
  const words = DOMAIN_VOCAB[categoryId]
  if (!words || words.length === 0) return null
  return new RegExp(`\\b(${words.join('|')})`, 'i')
}

export interface ScopeContext {
  // Compiled domain vocabulary for the story's arena (null → no domain veto).
  domain: RegExp | null
  // How many products in the arena hold a positive (full/partial) verdict on this story.
  positiveVerdicts: number
}

export function scopeForStory(story: Story, ctx: ScopeContext): { scope: StoryScope; rule: string } {
  // 1. Canon is global by definition (also tagged at the source in pipeline/agentic-stories.ts).
  if (CANONICAL_IDS.has(story.id) || story.origin?.kind === 'canonical') {
    return { scope: 'global', rule: 'canonical' }
  }

  // 2. Claims-derived depth-mine story that only one product actually holds: an effective
  //    product-specific probe, however neutrally depth-mine.ts phrased it.
  if (
    story.origin?.kind === 'normalized' &&
    story.origin.promptVersion === 'v2-depth' &&
    ctx.positiveVerdicts === 1
  ) {
    return { scope: 'product', rule: 'claims-probe' }
  }

  // Persona clause stripped so a persona like "open-source-maintainer" never triggers a
  // capability pattern — only the capability text, the id, and the group are matched.
  const text = `${story.id} ${stripPersonaPrefix(story.title)} ${story.group}`.toLowerCase()

  // 3. Strong global concepts survive domain phrasing (2FA is 2FA even in a banking arena).
  for (const { rule, pattern } of STRONG_GLOBAL_PATTERNS) {
    if (pattern.test(text)) return { scope: 'global', rule: `global:${rule}` }
  }

  // 4. Domain vocabulary → this arena's own comparison, not a cross-software one.
  const domainMatch = ctx.domain?.exec(text)
  if (domainMatch) return { scope: 'category', rule: `domain:${domainMatch[1]}` }

  // 5. Generic capability phrased outside the domain's vocabulary.
  for (const { rule, pattern } of WEAK_GLOBAL_PATTERNS) {
    if (pattern.test(text)) return { scope: 'global', rule: `global:${rule}` }
  }

  // 6. Ambiguous defaults to category — the honest middle.
  return { scope: 'category', rule: 'default' }
}

function main(): void {
  const totals: Record<StoryScope, number> = { global: 0, category: 0, product: 0 }
  for (const cat of readCategories()) {
    const dataDir = categoryDir(cat.id)
    const storiesPath = path.join(dataDir, 'stories.json')
    if (!fs.existsSync(storiesPath)) continue

    const stories = StorySchema.array().parse(JSON.parse(fs.readFileSync(storiesPath, 'utf8')))
    const verdictsPath = path.join(dataDir, 'verdicts.json')
    const verdicts = fs.existsSync(verdictsPath)
      ? VerdictBaseSchema.array().parse(JSON.parse(fs.readFileSync(verdictsPath, 'utf8')))
      : []
    const positiveByStory = new Map<string, number>()
    for (const v of verdicts) {
      if (v.verdict === 'full' || v.verdict === 'partial') {
        positiveByStory.set(v.storyId, (positiveByStory.get(v.storyId) ?? 0) + 1)
      }
    }
    const domain = domainPattern(cat.id)

    const counts: Record<StoryScope, number> = { global: 0, category: 0, product: 0 }
    const tagged = stories.map((s) => {
      const { scope, rule } = scopeForStory(s, { domain, positiveVerdicts: positiveByStory.get(s.id) ?? 0 })
      counts[scope] += 1
      totals[scope] += 1
      console.log(`${cat.id} ${scope.padEnd(8)} [${rule}] ${s.id}`)
      return { ...s, scope }
    })
    writeJson(storiesPath, tagged)
    console.log(
      `tag-story-scopes: ${cat.id} — ${counts.global} global, ${counts.category} category, ${counts.product} product\n`,
    )
  }
  console.log(
    `tag-story-scopes: TOTAL — ${totals.global} global, ${totals.category} category, ${totals.product} product`,
  )
}

if (require.main === module) {
  main()
}
