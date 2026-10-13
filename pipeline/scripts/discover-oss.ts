// OSS discovery sweep: finds top open-source software PRODUCTS worth adding to arenas.
// Sweeps GitHub's most-starred repos (a global stars:>15000 pass plus per-topic passes) via
// `gh api search/repositories` (authenticated CLI, same pattern as pipeline/stages/
// popularity.ts), filters out non-products (awesome lists, books, tutorials, interview prep),
// classifies each survivor into an EXISTING arena (rankings/categories.json) or a PROPOSED new
// arena using pure string heuristics — NO LLM calls — and captures cheap signals (llms.txt
// served by homepage or repo root, MCP/CLI mentions). Output:
//   - rankings/oss-candidates.json  (all candidates, sorted by stars desc)
//   - stdout: Markdown coverage report (redirect outside this repository to retain it)
// Re-runnable and rate-limit-aware: total `gh api` requests are hard-capped (MAX_GH_REQUESTS)
// and search calls are paced under GitHub's 30-req/min search limit. Discovery only — this
// script never edits any rankings/<category>/products.json.
//
// Run: pnpm exec tsx pipeline/scripts/discover-oss.ts
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { ProductSchema } from '../../lib/schemas'
import { DATA_DIR, readCategories, readJson } from '../paths'

// ---------------------------------------------------------------------------
// Budgets (keep the script polite and re-runnable)
// ---------------------------------------------------------------------------
const MAX_GH_REQUESTS = 150 // hard cap on authenticated `gh api` calls per run
const SEARCH_PACE_MS = 2100 // stays under the 30-req/min search-API limit
const RELEASE_CHECK_LIMIT = 250 // plain-HTTPS github.com HEADs (not gh API quota)
const LLMS_CHECK_LIMIT = 350 // llms.txt HEAD checks, top-N candidates by stars
const HEAD_TIMEOUT_MS = 3500
const HEAD_CONCURRENCY = 14

let ghRequests = 0

function ghApiJson<T>(pathAndQuery: string, jq: string): T | null {
  if (ghRequests >= MAX_GH_REQUESTS) {
    console.warn(`discover-oss: gh request budget (${MAX_GH_REQUESTS}) exhausted, skipping ${pathAndQuery}`)
    return null
  }
  ghRequests += 1
  try {
    const out = execFileSync('gh', ['api', pathAndQuery, '--jq', jq], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: 60_000,
    })
    return JSON.parse(out) as T
  } catch (err) {
    console.warn(`discover-oss: WARN gh api ${pathAndQuery} failed: ${(err as Error).message.slice(0, 200)}`)
    return null
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array<R>(items.length)
  let next = 0
  async function worker(): Promise<void> {
    while (next < items.length) {
      const idx = next++
      results[idx] = await fn(items[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function headRequest(url: string, redirect: 'follow' | 'manual'): Promise<Response | null> {
  try {
    return await fetch(url, {
      method: 'HEAD',
      redirect,
      signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
      headers: { 'user-agent': 'ultrametric-oss-discovery' },
    })
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Sweep
// ---------------------------------------------------------------------------
interface SearchRepo {
  full_name: string
  name: string
  description: string | null
  stargazers_count: number
  language: string | null
  homepage: string | null
  topics: string[]
  license: string | null
  archived: boolean
  fork: boolean
}

const SEARCH_JQ =
  '[.items[] | {full_name, name, description, stargazers_count, language, homepage, topics, license: (.license.spdx_id // null), archived, fork}]'

const TOPIC_SWEEPS = ['developer-tools', 'self-hosted', 'cli', 'database', 'observability', 'automation', 'ai', 'llm']

const SWEEPS: { label: string; q: string; pages: number }[] = [
  { label: 'top-stars', q: 'stars:>15000', pages: 4 },
  ...TOPIC_SWEEPS.map((t) => ({ label: `topic:${t}`, q: `topic:${t} stars:>5000`, pages: 2 })),
]

async function sweepRepos(): Promise<{ repos: SearchRepo[]; rawResults: number }> {
  const byName = new Map<string, SearchRepo>()
  let rawResults = 0
  for (const sweep of SWEEPS) {
    for (let page = 1; page <= sweep.pages; page++) {
      const q = encodeURIComponent(sweep.q)
      const items = ghApiJson<SearchRepo[]>(
        `search/repositories?q=${q}&sort=stars&order=desc&per_page=100&page=${page}`,
        SEARCH_JQ,
      )
      if (!items) continue
      rawResults += items.length
      for (const repo of items) {
        const key = repo.full_name.toLowerCase()
        if (!byName.has(key)) byName.set(key, repo)
      }
      await sleep(SEARCH_PACE_MS)
    }
    console.log(`swept ${sweep.label}: ${byName.size} unique repos so far`)
  }
  return { repos: [...byName.values()], rawResults }
}

// ---------------------------------------------------------------------------
// Product filter: usable software products only
// ---------------------------------------------------------------------------
const EXCLUDE_RE = new RegExp(
  [
    /\bawesome\b/, /interview/, /roadmap/, /tutorials?\b/, /\bbooks?\b/, /cheat[\s-]?sheets?\b/,
    /\blist of\b/, /curated (list|collection)/, /collection of/, /\bcourses?\b/, /coding challenges/,
    /\bleetcode\b/, /free[\s-]programming/, /study (guide|plan)/, /learning (path|resources?)/,
    /\bhandbook\b/, /\bprimer\b/, /build your own/, /\d+ days? of/, /sample (code|apps?)/,
    /\bboilerplates?\b/, /starter (kit|template)/, /\bexamples? (of|for)\b/, /how to (become|cook)/,
    /\bwikipedia\b/, /system design/, /(algorithms|data structures) (and|&) (algorithms|data structures)/,
    /\bthe algorithms\b/, /question[s]? (and|&) answers/, /curriculum/, /counting stars/,
    /best practices/, /from scratch/, /\bconcepts\b/, /\bexercises\b/, /demo apps?\b/,
    /\bresumes?\b/, /cookbook/, /models and examples/, /source code for/, /self-?learning/,
    /自学/, /指南/, /教程/, /activation methods|activator\b/,
  ]
    .map((r) => r.source)
    .join('|'),
)

function isExcluded(repo: SearchRepo): boolean {
  if (repo.archived || repo.fork) return true
  const hay = `${repo.name} ${repo.description ?? ''} ${repo.topics.join(' ')}`.toLowerCase()
  return EXCLUDE_RE.test(hay)
}

function normalizeHomepage(homepage: string | null): string | null {
  const h = (homepage ?? '').trim()
  if (!h) return null
  if (/^https?:\/\//i.test(h)) return h
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(h)) return `https://${h}`
  return null
}

// A repo without a homepage still counts as a product if it publishes GitHub releases
// (Location of /releases/latest redirects to /releases/tag/... when releases exist —
// plain github.com HTTPS, does not consume gh API quota).
async function hasReleases(fullName: string): Promise<boolean> {
  const res = await headRequest(`https://github.com/${fullName}/releases/latest`, 'manual')
  if (!res) return false
  const location = res.headers.get('location') ?? ''
  return location.includes('/releases/tag/')
}

// ---------------------------------------------------------------------------
// Arena classification (pure heuristics — no LLM)
// ---------------------------------------------------------------------------
type Target = { existing: string } | { proposed: string }

// Proposed NEW arenas the sweep can suggest, with a hand-set relevance weight for AI-era
// measurement (agenticness, LLM workflows, machine-readable docs) used to rank suggestions:
// score = uncovered candidate density x aiRelevance.
const PROPOSED_ARENAS: Record<string, { name: string; aiRelevance: number }> = {
  'agent-platforms': { name: 'AI Agent Platforms & Frameworks', aiRelevance: 1.0 },
  'agent-skills': { name: 'Agent Skills & Memory', aiRelevance: 1.0 },
  'agent-sandboxes': { name: 'Agent Code Execution Sandboxes', aiRelevance: 1.0 },
  'open-models': { name: 'Open LLM Model Releases', aiRelevance: 0.9 },
  'llm-finetuning': { name: 'LLM Fine-Tuning Tools', aiRelevance: 0.9 },
  'doc-processing': { name: 'Document Processing & OCR', aiRelevance: 0.8 },
  'llm-frameworks': { name: 'LLM App Frameworks & Gateways', aiRelevance: 1.0 },
  'vector-databases': { name: 'Vector Databases', aiRelevance: 1.0 },
  'ai-chat-interfaces': { name: 'Self-Hosted AI Chat Interfaces', aiRelevance: 0.9 },
  'workflow-automation': { name: 'Workflow Automation', aiRelevance: 0.9 },
  observability: { name: 'Observability & Monitoring', aiRelevance: 0.9 },
  'image-generation': { name: 'Image & Media Generation Tools', aiRelevance: 0.8 },
  databases: { name: 'Databases', aiRelevance: 0.8 },
  'product-analytics': { name: 'Product & Web Analytics', aiRelevance: 0.8 },
  'backend-platforms': { name: 'Backend-as-a-Service', aiRelevance: 0.8 },
  'search-engines': { name: 'Search & Retrieval Engines', aiRelevance: 0.8 },
  'code-editors': { name: 'Code Editors & IDEs', aiRelevance: 0.8 },
  'browser-automation': { name: 'Browser Automation & E2E Testing', aiRelevance: 0.8 },
  'ml-frameworks': { name: 'ML & Deep Learning Frameworks', aiRelevance: 0.7 },
  'data-orchestration': { name: 'Data Pipelines & Orchestration', aiRelevance: 0.7 },
  'internal-tools': { name: 'Low-Code & Internal Tools', aiRelevance: 0.7 },
  'api-clients': { name: 'API Clients & HTTP Tools', aiRelevance: 0.7 },
  'notes-knowledge': { name: 'Notes & Knowledge Management', aiRelevance: 0.7 },
  'auth-identity': { name: 'Auth & Identity', aiRelevance: 0.7 },
  'terminal-tools': { name: 'Terminals & Shell Tools', aiRelevance: 0.7 },
  'headless-cms': { name: 'Headless CMS & Content Platforms', aiRelevance: 0.6 },
  'secrets-passwords': { name: 'Passwords & Secrets Management', aiRelevance: 0.6 },
  'container-platforms': { name: 'Containers & Orchestration', aiRelevance: 0.6 },
  'event-streaming': { name: 'Event Streaming & Message Queues', aiRelevance: 0.6 },
  'reverse-proxies': { name: 'Proxies, Gateways & Web Servers', aiRelevance: 0.6 },
  'security-tools': { name: 'Security & Scanning Tools', aiRelevance: 0.6 },
  'ci-cd': { name: 'CI/CD & GitOps', aiRelevance: 0.6 },
  'dev-toolchains': { name: 'Runtimes, Package Managers & Build Tools', aiRelevance: 0.6 },
  'programming-languages': { name: 'Programming Languages', aiRelevance: 0.5 },
  browsers: { name: 'Web Browsers', aiRelevance: 0.5 },
  'design-tools': { name: 'Design, Diagramming & Whiteboards', aiRelevance: 0.5 },
  'data-visualization': { name: 'Graphics, Charts & Visualization', aiRelevance: 0.5 },
  'game-engines': { name: 'Game Engines', aiRelevance: 0.4 },
  'remote-desktop': { name: 'Remote Desktop & Access', aiRelevance: 0.4 },
  'backend-frameworks': { name: 'Backend Web Frameworks', aiRelevance: 0.5 },
  'mobile-frameworks': { name: 'Mobile App Frameworks', aiRelevance: 0.5 },
  'desktop-app-frameworks': { name: 'Desktop App Frameworks', aiRelevance: 0.5 },
  'network-tunnels': { name: 'VPNs, Tunnels & Overlay Networks', aiRelevance: 0.5 },
  'static-site-generators': { name: 'Static Site & Docs Generators', aiRelevance: 0.5 },
  'team-chat': { name: 'Team Chat & Communication', aiRelevance: 0.5 },
  'object-storage': { name: 'Files, Storage & Backup', aiRelevance: 0.4 },
  'home-automation': { name: 'Home Automation & IoT', aiRelevance: 0.4 },
  'media-servers': { name: 'Media Servers & Tools', aiRelevance: 0.4 },
}

const e = (id: string): Target => ({ existing: id })
const p = (id: string): Target => {
  if (!PROPOSED_ARENAS[id]) throw new Error(`unknown proposed arena: ${id}`)
  return { proposed: id }
}

// High-precision overrides for famous repos whose descriptions defeat keyword rules
// (e.g. Astro calls itself a "web framework", Supabase a "Postgres development platform").
const KNOWN_REPOS: Record<string, Target> = {
  // existing arenas
  'openai/codex': e('ai-coding'), 'anthropics/claude-code': e('ai-coding'),
  'google-gemini/gemini-cli': e('ai-coding'), 'aider-ai/aider': e('ai-coding'),
  'paul-gauthier/aider': e('ai-coding'), 'cline/cline': e('ai-coding'),
  'continuedev/continue': e('ai-coding'), 'all-hands-ai/openhands': e('ai-coding'),
  'tabbyml/tabby': e('ai-coding'), 'block/goose': e('ai-coding'),
  'plandex-ai/plandex': e('ai-coding'), 'pythagora-io/gpt-pilot': e('ai-coding'),
  'gpt-engineer-org/gpt-engineer': e('ai-coding'), 'sst/opencode': e('ai-coding'),
  'roovetgit/roo-code': e('ai-coding'), 'abi/screenshot-to-code': e('ai-coding'),
  'qwenlm/qwen-code': e('ai-coding'), 'stackblitz/bolt.new': e('ai-coding'),
  'ollama/ollama': e('local-llm-runtimes'), 'ggml-org/llama.cpp': e('local-llm-runtimes'),
  'ggerganov/llama.cpp': e('local-llm-runtimes'), 'vllm-project/vllm': e('local-llm-runtimes'),
  'nomic-ai/gpt4all': e('local-llm-runtimes'), 'mudler/localai': e('local-llm-runtimes'),
  'janhq/jan': e('local-llm-runtimes'), 'oobabooga/text-generation-webui': e('local-llm-runtimes'),
  'mlc-ai/mlc-llm': e('local-llm-runtimes'), 'exo-explore/exo': e('local-llm-runtimes'),
  'sgl-project/sglang': e('local-llm-runtimes'), 'lostruins/koboldcpp': e('local-llm-runtimes'),
  'huggingface/text-generation-inference': e('local-llm-runtimes'), 'mozilla-ocho/llamafile': e('local-llm-runtimes'),
  'facebook/react': e('frontend-frameworks'), 'vuejs/vue': e('frontend-frameworks'),
  'vuejs/core': e('frontend-frameworks'), 'angular/angular': e('frontend-frameworks'),
  'sveltejs/svelte': e('frontend-frameworks'), 'solidjs/solid': e('frontend-frameworks'),
  'preactjs/preact': e('frontend-frameworks'), 'qwikdev/qwik': e('frontend-frameworks'),
  'alpinejs/alpine': e('frontend-frameworks'), 'lit/lit': e('frontend-frameworks'),
  'emberjs/ember.js': e('frontend-frameworks'), 'vercel/next.js': e('frontend-frameworks'),
  'nuxt/nuxt': e('frontend-frameworks'), 'remix-run/react-router': e('frontend-frameworks'),
  'remix-run/remix': e('frontend-frameworks'), 'withastro/astro': e('frontend-frameworks'),
  'gatsbyjs/gatsby': e('frontend-frameworks'), 'bigskysoftware/htmx': e('frontend-frameworks'),
  'jquery/jquery': e('frontend-frameworks'),
  'go-gitea/gitea': e('code-hosting'), 'gitlabhq/gitlabhq': e('code-hosting'),
  'forgejo/forgejo': e('code-hosting'), 'gogs/gogs': e('code-hosting'),
  'makeplane/plane': e('project-management'), 'mattermost/focalboard': e('project-management'),
  'opf/openproject': e('project-management'), 'go-vikunja/vikunja': e('project-management'),
  'coollabsio/coolify': e('edge-platforms'), 'dokploy/dokploy': e('edge-platforms'),
  'dokku/dokku': e('edge-platforms'), 'caprover/caprover': e('edge-platforms'),
  'openfaas/faas': e('edge-platforms'),
  'unclecode/crawl4ai': e('web-scraping'), 'scrapy/scrapy': e('web-scraping'),
  'mendableai/firecrawl': e('web-scraping'), 'apify/crawlee': e('web-scraping'),
  'gocolly/colly': e('web-scraping'), 'dgtlmoon/changedetection.io': e('web-scraping'),
  // proposed arenas
  'open-webui/open-webui': p('ai-chat-interfaces'), 'lobehub/lobe-chat': p('ai-chat-interfaces'),
  'danny-avila/librechat': p('ai-chat-interfaces'), 'chatgptnextweb/nextchat': p('ai-chat-interfaces'),
  'mintplex-labs/anything-llm': p('ai-chat-interfaces'), 'chatboxai/chatbox': p('ai-chat-interfaces'),
  'langchain-ai/langchain': p('llm-frameworks'), 'run-llama/llama_index': p('llm-frameworks'),
  'deepset-ai/haystack': p('llm-frameworks'), 'stanfordnlp/dspy': p('llm-frameworks'),
  'microsoft/semantic-kernel': p('llm-frameworks'), 'berriai/litellm': p('llm-frameworks'),
  'pydantic/pydantic-ai': p('llm-frameworks'),
  'langgenius/dify': p('agent-platforms'), 'flowiseai/flowise': p('agent-platforms'),
  'langflow-ai/langflow': p('agent-platforms'), 'crewaiinc/crewai': p('agent-platforms'),
  'microsoft/autogen': p('agent-platforms'), 'ag2ai/ag2': p('agent-platforms'),
  'geekan/metagpt': p('agent-platforms'), 'significant-gravitas/autogpt': p('agent-platforms'),
  'transformeroptimus/superagi': p('agent-platforms'), 'agno-agi/agno': p('agent-platforms'),
  'langchain-ai/langgraph': p('agent-platforms'), 'openbmb/chatdev': p('agent-platforms'),
  'openinterpreter/open-interpreter': p('agent-platforms'), 'composiohq/composio': p('agent-platforms'),
  'qdrant/qdrant': p('vector-databases'), 'milvus-io/milvus': p('vector-databases'),
  'weaviate/weaviate': p('vector-databases'), 'chroma-core/chroma': p('vector-databases'),
  'facebookresearch/faiss': p('vector-databases'), 'lancedb/lancedb': p('vector-databases'),
  'pgvector/pgvector': p('vector-databases'),
  'n8n-io/n8n': p('workflow-automation'), 'activepieces/activepieces': p('workflow-automation'),
  'huginn/huginn': p('workflow-automation'), 'windmill-labs/windmill': p('workflow-automation'),
  'node-red/node-red': p('workflow-automation'), 'temporalio/temporal': p('workflow-automation'),
  'kestra-io/kestra': p('workflow-automation'), 'automatisch/automatisch': p('workflow-automation'),
  'grafana/grafana': p('observability'), 'prometheus/prometheus': p('observability'),
  'getsentry/sentry': p('observability'), 'signoz/signoz': p('observability'),
  'louislam/uptime-kuma': p('observability'), 'netdata/netdata': p('observability'),
  'jaegertracing/jaeger': p('observability'), 'zabbix/zabbix': p('observability'),
  'victoriametrics/victoriametrics': p('observability'), 'grafana/loki': p('observability'),
  'nicolargo/glances': p('observability'), 'healthchecks/healthchecks': p('observability'),
  'posthog/posthog': p('product-analytics'), 'plausible/analytics': p('product-analytics'),
  'matomo-org/matomo': p('product-analytics'), 'umami-software/umami': p('product-analytics'),
  'openreplay/openreplay': p('product-analytics'),
  'supabase/supabase': p('backend-platforms'), 'pocketbase/pocketbase': p('backend-platforms'),
  'appwrite/appwrite': p('backend-platforms'), 'parse-community/parse-server': p('backend-platforms'),
  'nhost/nhost': p('backend-platforms'),
  'redis/redis': p('databases'), 'postgres/postgres': p('databases'),
  'clickhouse/clickhouse': p('databases'), 'duckdb/duckdb': p('databases'),
  'surrealdb/surrealdb': p('databases'), 'pingcap/tidb': p('databases'),
  'cockroachdb/cockroach': p('databases'), 'influxdata/influxdb': p('databases'),
  'questdb/questdb': p('databases'), 'dragonflydb/dragonfly': p('databases'),
  'valkey-io/valkey': p('databases'), 'mariadb/server': p('databases'),
  'mongodb/mongo': p('databases'), 'etcd-io/etcd': p('databases'),
  'apache/cassandra': p('databases'), 'scylladb/scylladb': p('databases'),
  'rethinkdb/rethinkdb': p('databases'), 'neo4j/neo4j': p('databases'),
  'tursodatabase/libsql': p('databases'),
  'elastic/elasticsearch': p('search-engines'), 'meilisearch/meilisearch': p('search-engines'),
  'typesense/typesense': p('search-engines'), 'opensearch-project/opensearch': p('search-engines'),
  'valeriansaliou/sonic': p('search-engines'), 'manticoresoftware/manticoresearch': p('search-engines'),
  'microsoft/vscode': p('code-editors'), 'neovim/neovim': p('code-editors'),
  'vim/vim': p('code-editors'), 'zed-industries/zed': p('code-editors'),
  'helix-editor/helix': p('code-editors'), 'lapce/lapce': p('code-editors'),
  'coder/code-server': p('code-editors'), 'vscodium/vscodium': p('code-editors'),
  'microsoft/playwright': p('browser-automation'), 'puppeteer/puppeteer': p('browser-automation'),
  'seleniumhq/selenium': p('browser-automation'), 'cypress-io/cypress': p('browser-automation'),
  'browser-use/browser-use': p('browser-automation'), 'browserbase/stagehand': p('browser-automation'),
  'pytorch/pytorch': p('ml-frameworks'), 'tensorflow/tensorflow': p('ml-frameworks'),
  'keras-team/keras': p('ml-frameworks'), 'scikit-learn/scikit-learn': p('ml-frameworks'),
  'google/jax': p('ml-frameworks'), 'huggingface/transformers': p('ml-frameworks'),
  'dmlc/xgboost': p('ml-frameworks'), 'microsoft/lightgbm': p('ml-frameworks'),
  'paddlepaddle/paddle': p('ml-frameworks'), 'ml-explore/mlx': p('ml-frameworks'),
  'openai/whisper': p('ml-frameworks'), 'ultralytics/ultralytics': p('ml-frameworks'),
  'opencv/opencv': p('ml-frameworks'),
  'automatic1111/stable-diffusion-webui': p('image-generation'), 'comfyanonymous/comfyui': p('image-generation'),
  'lllyasviel/fooocus': p('image-generation'), 'invoke-ai/invokeai': p('image-generation'),
  'appsmithorg/appsmith': p('internal-tools'), 'tooljet/tooljet': p('internal-tools'),
  'budibase/budibase': p('internal-tools'), 'nocodb/nocodb': p('internal-tools'),
  'teableio/teable': p('internal-tools'), 'refinedev/refine': p('internal-tools'),
  'illacloud/illa-builder': p('internal-tools'),
  'strapi/strapi': p('headless-cms'), 'directus/directus': p('headless-cms'),
  'payloadcms/payload': p('headless-cms'), 'tryghost/ghost': p('headless-cms'),
  'wordpress/wordpress': p('headless-cms'), 'decaporg/decap-cms': p('headless-cms'),
  'hoppscotch/hoppscotch': p('api-clients'), 'kong/insomnia': p('api-clients'),
  'usebruno/bruno': p('api-clients'), 'httpie/cli': p('api-clients'),
  'laurent22/joplin': p('notes-knowledge'), 'logseq/logseq': p('notes-knowledge'),
  'appflowy-io/appflowy': p('notes-knowledge'), 'siyuan-note/siyuan': p('notes-knowledge'),
  'zadam/trilium': p('notes-knowledge'), 'outline/outline': p('notes-knowledge'),
  'toeverything/affine': p('notes-knowledge'), 'anyproto/anytype-ts': p('notes-knowledge'),
  'bookstackapp/bookstack': p('notes-knowledge'), 'marktext/marktext': p('notes-knowledge'),
  'zettlr/zettlr': p('notes-knowledge'), 'usememos/memos': p('notes-knowledge'),
  'keycloak/keycloak': p('auth-identity'), 'goauthentik/authentik': p('auth-identity'),
  'authelia/authelia': p('auth-identity'), 'zitadel/zitadel': p('auth-identity'),
  'casdoor/casdoor': p('auth-identity'), 'ory/kratos': p('auth-identity'),
  'supertokens/supertokens-core': p('auth-identity'), 'logto-io/logto': p('auth-identity'),
  'bitwarden/server': p('secrets-passwords'), 'dani-garcia/vaultwarden': p('secrets-passwords'),
  'hashicorp/vault': p('secrets-passwords'), 'infisical/infisical': p('secrets-passwords'),
  'keepassxreboot/keepassxc': p('secrets-passwords'),
  'kubernetes/kubernetes': p('container-platforms'), 'k3s-io/k3s': p('container-platforms'),
  'containers/podman': p('container-platforms'), 'rancher/rancher': p('container-platforms'),
  'portainer/portainer': p('container-platforms'), 'docker/compose': p('container-platforms'),
  'moby/moby': p('container-platforms'), 'kubernetes-sigs/kind': p('container-platforms'),
  'kubernetes/minikube': p('container-platforms'), 'hashicorp/nomad': p('container-platforms'),
  'derailed/k9s': p('container-platforms'), 'lensapp/lens': p('container-platforms'),
  'helm/helm': p('container-platforms'), 'istio/istio': p('container-platforms'),
  'apache/airflow': p('data-orchestration'), 'dagster-io/dagster': p('data-orchestration'),
  'prefecthq/prefect': p('data-orchestration'), 'airbytehq/airbyte': p('data-orchestration'),
  'dbt-labs/dbt-core': p('data-orchestration'), 'apache/spark': p('data-orchestration'),
  'apache/flink': p('data-orchestration'), 'apache/nifi': p('data-orchestration'),
  'spotify/luigi': p('data-orchestration'), 'mage-ai/mage-ai': p('data-orchestration'),
  'apache/dolphinscheduler': p('data-orchestration'),
  'apache/kafka': p('event-streaming'), 'redpanda-data/redpanda': p('event-streaming'),
  'nats-io/nats-server': p('event-streaming'), 'rabbitmq/rabbitmq-server': p('event-streaming'),
  'apache/pulsar': p('event-streaming'), 'emqx/emqx': p('event-streaming'),
  'apache/rocketmq': p('event-streaming'),
  'caddyserver/caddy': p('reverse-proxies'), 'traefik/traefik': p('reverse-proxies'),
  'nginx/nginx': p('reverse-proxies'), 'haproxy/haproxy': p('reverse-proxies'),
  'kong/kong': p('reverse-proxies'), 'apache/apisix': p('reverse-proxies'),
  'envoyproxy/envoy': p('reverse-proxies'), 'openresty/openresty': p('reverse-proxies'),
  'cloudflare/pingora': p('reverse-proxies'), 'nginxproxymanager/nginx-proxy-manager': p('reverse-proxies'),
  'fatedier/frp': p('network-tunnels'), 'tailscale/tailscale': p('network-tunnels'),
  'juanfont/headscale': p('network-tunnels'), 'netbirdio/netbird': p('network-tunnels'),
  'gravitl/netmaker': p('network-tunnels'), 'zerotier/zerotierone': p('network-tunnels'),
  'ehang-io/nps': p('network-tunnels'), 'rapiz1/rathole': p('network-tunnels'),
  'jellyfin/jellyfin': p('media-servers'), 'immich-app/immich': p('media-servers'),
  'photoprism/photoprism': p('media-servers'), 'navidrome/navidrome': p('media-servers'),
  'advplyr/audiobookshelf': p('media-servers'), 'xbmc/xbmc': p('media-servers'),
  'yt-dlp/yt-dlp': p('media-servers'),
  'home-assistant/core': p('home-automation'), 'esphome/esphome': p('home-automation'),
  'openhab/openhab-core': p('home-automation'), 'arendst/tasmota': p('home-automation'),
  'koenkk/zigbee2mqtt': p('home-automation'),
  'mattermost/mattermost': p('team-chat'), 'rocketchat/rocket.chat': p('team-chat'),
  'zulip/zulip': p('team-chat'), 'element-hq/element-web': p('team-chat'),
  'jitsi/jitsi-meet': p('team-chat'),
  'aquasecurity/trivy': p('security-tools'), 'gitleaks/gitleaks': p('security-tools'),
  'trufflesecurity/trufflehog': p('security-tools'), 'projectdiscovery/nuclei': p('security-tools'),
  'rapid7/metasploit-framework': p('security-tools'), 'semgrep/semgrep': p('security-tools'),
  'osquery/osquery': p('security-tools'), 'google/osv-scanner': p('security-tools'),
  'wazuh/wazuh': p('security-tools'), 'crowdsecurity/crowdsec': p('security-tools'),
  'minio/minio': p('object-storage'), 'seaweedfs/seaweedfs': p('object-storage'),
  'nextcloud/server': p('object-storage'), 'owncloud/core': p('object-storage'),
  'syncthing/syncthing': p('object-storage'), 'filebrowser/filebrowser': p('object-storage'),
  'rclone/rclone': p('object-storage'), 'restic/restic': p('object-storage'),
  'borgbackup/borg': p('object-storage'),
  'jenkinsci/jenkins': p('ci-cd'), 'argoproj/argo-cd': p('ci-cd'),
  'fluxcd/flux2': p('ci-cd'), 'harness/drone': p('ci-cd'),
  'woodpecker-ci/woodpecker': p('ci-cd'), 'earthly/earthly': p('ci-cd'),
  'alacritty/alacritty': p('terminal-tools'), 'kovidgoyal/kitty': p('terminal-tools'),
  'wez/wezterm': p('terminal-tools'), 'tmux/tmux': p('terminal-tools'),
  'ohmyzsh/ohmyzsh': p('terminal-tools'), 'starship/starship': p('terminal-tools'),
  'junegunn/fzf': p('terminal-tools'), 'burntsushi/ripgrep': p('terminal-tools'),
  'sharkdp/bat': p('terminal-tools'), 'sharkdp/fd': p('terminal-tools'),
  'ajeetdsouza/zoxide': p('terminal-tools'), 'htop-dev/htop': p('terminal-tools'),
  'fish-shell/fish-shell': p('terminal-tools'), 'nushell/nushell': p('terminal-tools'),
  'zellij-org/zellij': p('terminal-tools'),
  'electron/electron': p('desktop-app-frameworks'), 'tauri-apps/tauri': p('desktop-app-frameworks'),
  'wailsapp/wails': p('desktop-app-frameworks'),
  'flutter/flutter': p('mobile-frameworks'), 'facebook/react-native': p('mobile-frameworks'),
  'ionic-team/ionic-framework': p('mobile-frameworks'), 'expo/expo': p('mobile-frameworks'),
  'kivy/kivy': p('mobile-frameworks'), 'dotnet/maui': p('mobile-frameworks'),
  'nodejs/node': p('dev-toolchains'), 'denoland/deno': p('dev-toolchains'),
  'oven-sh/bun': p('dev-toolchains'), 'biomejs/biome': p('dev-toolchains'),
  'swc-project/swc': p('dev-toolchains'), 'vitejs/vite': p('dev-toolchains'),
  'webpack/webpack': p('dev-toolchains'), 'evanw/esbuild': p('dev-toolchains'),
  'rollup/rollup': p('dev-toolchains'), 'vercel/turborepo': p('dev-toolchains'),
  'pnpm/pnpm': p('dev-toolchains'), 'astral-sh/uv': p('dev-toolchains'),
  'astral-sh/ruff': p('dev-toolchains'), 'homebrew/brew': p('dev-toolchains'),
  'python-poetry/poetry': p('dev-toolchains'),
  // 2026-era agent ecosystem
  'openclaw/openclaw': p('agent-platforms'), 'nousresearch/hermes-agent': p('agent-platforms'),
  'deepseek-ai/deepseek-harness': p('agent-platforms'), 'lobehub/lobehub': p('agent-platforms'),
  'paperclipai/paperclip': p('agent-platforms'), 'modelcontextprotocol/servers': p('agent-platforms'),
  'obra/superpowers': p('agent-skills'), 'mattpocock/skills': p('agent-skills'),
  'affaan-m/ecc': p('agent-skills'), 'juliusbrussee/caveman': p('agent-skills'),
  'thedotmack/claude-mem': p('agent-skills'), 'colbymchenry/codegraph': p('agent-skills'),
  'pbakaus/impeccable': p('agent-skills'), 'github/spec-kit': p('agent-skills'),
  'farion1231/cc-switch': e('ai-coding'),
  'daytonaio/daytona': p('agent-sandboxes'), 'e2b-dev/e2b': p('agent-sandboxes'),
  'firecracker-microvm/firecracker': p('agent-sandboxes'),
  'deepseek-ai/deepseek-v3': p('open-models'), 'deepseek-ai/deepseek-r1': p('open-models'),
  'meta-llama/llama': p('open-models'), 'meta-llama/llama3': p('open-models'),
  'meta-llama/llama-models': p('open-models'), 'xai-org/grok-1': p('open-models'),
  'mistralai/mistral-inference': p('open-models'), 'openai/gpt-oss': p('open-models'),
  'qwenlm/qwen3': p('open-models'), 'google-deepmind/gemma': p('open-models'),
  'hiyouga/llamafactory': p('llm-finetuning'), 'unslothai/unsloth': p('llm-finetuning'),
  'axolotl-ai-cloud/axolotl': p('llm-finetuning'), 'huggingface/peft': p('llm-finetuning'),
  'microsoft/markitdown': p('doc-processing'), 'docling-project/docling': p('doc-processing'),
  'stirling-tools/stirling-pdf': p('doc-processing'), 'tesseract-ocr/tesseract': p('doc-processing'),
  'paddlepaddle/paddleocr': p('doc-processing'), 'opendatalab/mineru': p('doc-processing'),
  'vikparuchuri/marker': p('doc-processing'),
  // language/tooling/misc giants that defeat keyword rules
  'golang/go': p('programming-languages'), 'rust-lang/rust': p('programming-languages'),
  'python/cpython': p('programming-languages'), 'microsoft/typescript': p('programming-languages'),
  'swiftlang/swift': p('programming-languages'), 'jetbrains/kotlin': p('programming-languages'),
  'ziglang/zig': p('programming-languages'), 'elixir-lang/elixir': p('programming-languages'),
  'ladybirdbrowser/ladybird': p('browsers'), 'brave/brave-browser': p('browsers'),
  'zen-browser/desktop': p('browsers'),
  'twbs/bootstrap': e('frontend-frameworks'), 'tailwindlabs/tailwindcss': e('frontend-frameworks'),
  'fastapi/fastapi': p('backend-frameworks'), 'spring-projects/spring-boot': p('backend-frameworks'),
  'laravel/laravel': p('backend-frameworks'), 'rails/rails': p('backend-frameworks'),
  'django/django': p('backend-frameworks'), 'nestjs/nest': p('backend-frameworks'),
  'expressjs/express': p('backend-frameworks'), 'gin-gonic/gin': p('backend-frameworks'),
  'gofiber/fiber': p('backend-frameworks'), 'phoenixframework/phoenix': p('backend-frameworks'),
  'honojs/hono': p('backend-frameworks'),
  'excalidraw/excalidraw': p('design-tools'), 'penpot/penpot': p('design-tools'),
  'jgraph/drawio': p('design-tools'), 'jgraph/drawio-desktop': p('design-tools'),
  'tldraw/tldraw': p('design-tools'),
  'mrdoob/three.js': p('data-visualization'), 'd3/d3': p('data-visualization'),
  'binary-husky/gpt_academic': p('ai-chat-interfaces'),
  'localsend/localsend': p('object-storage'),
  'ffmpeg/ffmpeg': p('media-servers'), 'opencut-app/opencut': p('media-servers'),
  'rustdesk/rustdesk': p('remote-desktop'), 'genymobile/scrcpy': p('remote-desktop'),
  'apache/guacamole-server': p('remote-desktop'), 'ylianst/meshcentral': p('remote-desktop'),
  'eugeny/tabby': p('terminal-tools'),
  'nsa/ghidra': p('security-tools'), 'nationalsecurityagency/ghidra': p('security-tools'),
  'react/react-native': p('mobile-frameworks'),
  'clash-verge-rev/clash-verge-rev': p('network-tunnels'), '2dust/v2rayn': p('network-tunnels'),
  '2dust/v2rayng': p('network-tunnels'),
  'harry0703/moneyprinterturbo': p('image-generation'),
  'virattt/ai-hedge-fund': p('agent-platforms'),
  'gohugoio/hugo': p('static-site-generators'), 'jekyll/jekyll': p('static-site-generators'),
  'facebook/docusaurus': p('static-site-generators'), '11ty/eleventy': p('static-site-generators'),
  'hexojs/hexo': p('static-site-generators'), 'getzola/zola': p('static-site-generators'),
  'squidfunk/mkdocs-material': p('static-site-generators'), 'mkdocs/mkdocs': p('static-site-generators'),
}

// Ordered keyword rules — first match wins, so specific product families come before broad
// catch-alls (e.g. "vector database" before "database", "terminal/cli" dead last).
// `descOnly` rules ignore topics: sweeping topic:database / topic:cli would otherwise dump
// every swept repo into these broad buckets just because the swept topic is in its topic list.
const RULES: { re: RegExp; target: Target; descOnly?: boolean }[] = [
  { re: /coding agent|code assistant|ai pair.?programm|ai coding|autonomous (software )?engineer|copilot alternative|terminal-based agentic/, target: e('ai-coding') },
  { re: /vector (database|search engine|store)|embedding (database|store)|similarity search/, target: p('vector-databases') },
  { re: /run (llms?|large language models?|(ai )?models?) locally|local (llm|inference)|llm inference|inference (engine|server)|llama\.cpp|self-?hosted (llm|ai)\b|on-device (llm|ai)/, target: e('local-llm-runtimes') },
  { re: /chat (ui|interface|web ?ui) for|chatgpt (ui|clone|web)|ai chat (app|interface|client)/, target: p('ai-chat-interfaces') },
  { re: /claude code skill|agent(ic)? skills?\b|skills? framework|(ai|agent) harness|persistent context|agent memory|spec-?driven development|for (claude code|coding agents)|[a-z0-9]+-skills?\b/, target: p('agent-skills') },
  { re: /(ai|llm|autonomous) agents?\b|multi-?agent|agent (framework|orchestration|platform)|agentic (workflow|framework|app)|manage agents|agent operator|personal ai assistant/, target: p('agent-platforms') },
  { re: /ai-generated code|code (execution )?sandbox|sandbox(es)? for (ai|agents?)|microvm/, target: p('agent-sandboxes') },
  { re: /fine-?tun(e|ing)/, target: p('llm-finetuning') },
  { re: /llm (framework|orchestration|application|gateway|proxy|toolkit|app)|rag (framework|pipeline|engine)|retrieval-?augmented|prompt (engineering|management)|llmops/, target: p('llm-frameworks') },
  { re: /stable diffusion|text-?to-?image|image generation|diffusion model|text-?to-?video|video generation|face swap|deepfake/, target: p('image-generation') },
  { re: /\bocr\b|\bpdfs?\b|document (conversion|processing|parsing|intelligence)|documents? (into|to|ready for) (structured|markdown|gen ?ai)/, target: p('doc-processing') },
  { re: /web scrap|crawl(er|ing)\b|scraping/, target: e('web-scraping') },
  { re: /browser automation|end-?to-?end test|e2e test|web testing/, target: p('browser-automation') },
  { re: /git (server|hosting|service)|self-?hosted git|devops platform/, target: e('code-hosting') },
  { re: /project management|issue track(er|ing)|kanban|task manage/, target: e('project-management') },
  { re: /(user|customer|product) feedback|feature request|survey (platform|tool)|form builder/, target: e('product-feedback') },
  { re: /workflow automation|automation (platform|tool|engine)|zapier alternative|ifttt|durable execution/, target: p('workflow-automation') },
  { re: /observability|monitoring|\bapm\b|distributed tracing|log (management|aggregation|shipper)|metrics (collection|storage)|status page|uptime/, target: p('observability') },
  { re: /web analytics|product analytics|session replay|google analytics alternative/, target: p('product-analytics') },
  { re: /firebase alternative|backend[- ]as[- ]a[- ]service|\bbaas\b/, target: p('backend-platforms') },
  { re: /low-?code|no-?code|internal tools?|admin (panel|dashboard)|airtable alternative/, target: p('internal-tools') },
  { re: /headless cms|content management|\bcms\b|blogging platform/, target: p('headless-cms') },
  { re: /api (client|testing|debugg)|postman alternative|http client/, target: p('api-clients') },
  { re: /note-?taking|knowledge (base|management)|second brain|\bwiki\b|markdown (editor|notes)|notion alternative/, target: p('notes-knowledge') },
  { re: /identity (provider|management)|authentication|authorization server|single sign-?on|\bsso\b|\boauth2?\b|\biam\b/, target: p('auth-identity') },
  { re: /password manager|secrets? (manager|management)|bitwarden/, target: p('secrets-passwords') },
  { re: /search engine|full-?text search|search (server|platform)\b/, target: p('search-engines') },
  { re: /(code|text) editor|\bide\b/, target: p('code-editors') },
  { re: /machine learning|deep learning|neural network|computer vision|speech recognition/, target: p('ml-frameworks') },
  { re: /data (pipeline|integration|orchestration)|\betl\b|\belt\b|workflow (orchestrat|scheduler)|analytics engine/, target: p('data-orchestration') },
  { re: /\bdatabases?\b|\bdbms\b|key-?value store|time-?series|nosql|oltp|olap/, target: p('databases'), descOnly: true },
  { re: /message (queue|broker)|event stream|pub\/?sub|\bmqtt\b|streaming (data )?platform/, target: p('event-streaming') },
  { re: /reverse proxy|load balancer|api gateway|ingress controller|web server\b/, target: p('reverse-proxies') },
  { re: /\bvpn\b|wireguard|mesh network|tunnel(ing|s)?\b|expose (a )?local|zero-?trust network/, target: p('network-tunnels') },
  { re: /media (server|center)|photo (management|server|backup)|music (server|streaming)|video downloader|video editor|screen record|live streaming/, target: p('media-servers') },
  { re: /home automation|smart home|home assistant|\biot\b/, target: p('home-automation') },
  { re: /team (chat|communication)|slack alternative|instant messag|video conferenc|chat server/, target: p('team-chat') },
  { re: /vulnerabilit|penetration test|security (scanner|scanning|platform)|intrusion detection|\bsiem\b|secret (scanning|detection)|reverse engineering/, target: p('security-tools') },
  { re: /object storage|s3-?compatible|file (sync|sharing|storage|manager)|backup (tool|solution|program)/, target: p('object-storage') },
  { re: /continuous (integration|delivery|deployment)|ci\/cd|gitops|github actions/, target: p('ci-cd') },
  { re: /self-?hosted (paas|heroku)|heroku alternative|vercel alternative|netlify alternative|deploy(ment)? platform|serverless (platform|functions)/, target: e('edge-platforms') },
  { re: /kubernetes|\bk8s\b|container (orchestration|runtime|registry|management|images)|service mesh/, target: p('container-platforms') },
  { re: /static site generator|documentation (site|generator|website)/, target: p('static-site-generators') },
  { re: /mobile (app )?(framework|development)|cross-?platform mobile|ios and android/, target: p('mobile-frameworks') },
  { re: /build.{0,30}desktop app|desktop (apps?|applications?) (framework|using|with)/, target: p('desktop-app-frameworks') },
  { re: /(javascript|typescript|js|python) runtime|package manager|\bbundler\b|build (tool|system)|monorepo|linter|code formatter/, target: p('dev-toolchains') },
  { re: /game engine/, target: p('game-engines') },
  { re: /remote desktop|remote (access|control)|display and control/, target: p('remote-desktop') },
  { re: /whiteboard|diagram|design (tool|language|platform)|presentation framework|prototyp/, target: p('design-tools') },
  { re: /charting|\bcharts?\b|data visuali[sz]|animation (engine|library)|3d library|plotting/, target: p('data-visualization') },
  { re: /programming language/, target: p('programming-languages') },
  { re: /web browser\b|browser engine/, target: p('browsers') },
  { re: /front-?end|user interfaces?\b|ui (framework|library|components)|component library|design system|web components|css framework/, target: e('frontend-frameworks') },
  { re: /web (application )?framework|framework for building (web|apis?|http)|micro ?framework|server-?side|backend (framework|api)/, target: p('backend-frameworks') },
  { re: /linux distribution|\boperating system\b/, target: e('desktop-os') },
  { re: /terminal (emulator|multiplexer|ui|for)|\ba terminal\b|\bshell\b|command-?line|\bcli\b|\btui\b/, target: p('terminal-tools'), descOnly: true },
]

function classify(repo: SearchRepo): Target | null {
  const known = KNOWN_REPOS[repo.full_name.toLowerCase()]
  if (known) return known
  const hayDesc = `${repo.name} ${repo.description ?? ''}`.toLowerCase()
  const hay = `${hayDesc} ${repo.topics.join(' ')}`.toLowerCase()
  // Real-time/embedded OSes are not daily-driver desktop OSes — dodge the desktop-os rule.
  const embedded = /real-?time operating system|embedded|microcontroller|\brtos\b/.test(hay)
  for (const rule of RULES) {
    if (rule.re.test(rule.descOnly ? hayDesc : hay)) {
      if ('existing' in rule.target && rule.target.existing === 'desktop-os' && embedded) continue
      return rule.target
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Signals + coverage
// ---------------------------------------------------------------------------
function mcpMention(hay: string): boolean {
  return /(^|[^a-z])mcp([^a-z]|$)|model context protocol/.test(hay)
}

function cliMention(hay: string): boolean {
  return /\bcli\b|command-?line|terminal\b/.test(hay)
}

// Soft-404 guard: SPAs happily return 200 text/html for /llms.txt — only count non-HTML hits.
async function servesLlmsTxt(fullName: string, homepage: string | null): Promise<boolean> {
  const rawRes = await headRequest(`https://raw.githubusercontent.com/${fullName}/HEAD/llms.txt`, 'follow')
  if (rawRes?.ok) return true
  if (!homepage) return false
  let origin: string
  try {
    origin = new URL(homepage).origin
  } catch {
    return false
  }
  const res = await headRequest(`${origin}/llms.txt`, 'follow')
  if (!res?.ok) return false
  const contentType = res.headers.get('content-type') ?? ''
  return !contentType.includes('text/html')
}

function coveredKeys(): { repos: Set<string>; ids: Set<string> } {
  const repos = new Set<string>()
  const ids = new Set<string>()
  for (const category of readCategories()) {
    const products = readJson(ProductSchema.array(), path.join(DATA_DIR, category.id, 'products.json'))
    for (const product of products) {
      ids.add(product.id.toLowerCase())
      const github = product.urls.github
      if (!github) continue
      try {
        const parts = new URL(github).pathname.split('/').filter(Boolean)
        if (parts.length >= 2) repos.add(`${parts[0]}/${parts[1].replace(/\.git$/, '')}`.toLowerCase())
      } catch {
        // ignore malformed URLs
      }
    }
  }
  return { repos, ids }
}

// ---------------------------------------------------------------------------
// Output shapes
// ---------------------------------------------------------------------------
interface Candidate {
  repo: string
  name: string
  stars: number
  language: string | null
  homepage: string | null
  description: string | null
  license: string | null
  existingArena: string | null
  proposedArena: { id: string; name: string } | null
  signals: { llmsTxt: boolean; mcpMention: boolean; cliMention: boolean }
  alreadyCovered: boolean
}

function arenaLabel(c: Candidate): string {
  if (c.existingArena) return c.existingArena
  if (c.proposedArena) return `${c.proposedArena.name} (proposed: ${c.proposedArena.id})`
  return 'Unassigned'
}

function fmtStars(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function mdEscape(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()
}

function buildMarkdown(
  candidates: Candidate[],
  stats: { rawResults: number; unique: number; filtered: number; covered: number },
  categoriesById: Map<string, string>,
): string {
  const uncovered = candidates.filter((c) => !c.alreadyCovered)
  const top50 = uncovered.slice(0, 50)
  const groups = new Map<string, Candidate[]>()
  for (const c of top50) {
    const key = arenaLabel(c)
    const list = groups.get(key) ?? []
    list.push(c)
    groups.set(key, list)
  }

  // Ranked new-arena suggestions: uncovered candidate density x hand-set AI-era relevance.
  const byProposed = new Map<string, Candidate[]>()
  for (const c of uncovered) {
    if (!c.proposedArena) continue
    const list = byProposed.get(c.proposedArena.id) ?? []
    list.push(c)
    byProposed.set(c.proposedArena.id, list)
  }
  const ranked = [...byProposed.entries()]
    .map(([id, list]) => ({
      id,
      name: PROPOSED_ARENAS[id].name,
      aiRelevance: PROPOSED_ARENAS[id].aiRelevance,
      count: list.length,
      score: list.length * PROPOSED_ARENAS[id].aiRelevance,
      examples: list.slice(0, 4).map((c) => c.name),
    }))
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, 10)

  const lines: string[] = []
  lines.push('# OSS Coverage Sweep')
  lines.push('')
  lines.push(`Generated by \`pipeline/scripts/discover-oss.ts\` on ${new Date().toISOString().slice(0, 10)}. Discovery only — nothing here is added to an arena automatically.`)
  lines.push('')
  lines.push(`- GitHub search results swept: ${stats.rawResults} (${stats.unique} unique repos)`)
  lines.push(`- Usable software products after filtering: ${stats.filtered}`)
  lines.push(`- Already covered by an existing arena: ${stats.covered}`)
  lines.push(`- Full candidate list: \`rankings/oss-candidates.json\``)
  lines.push('')
  lines.push('## Top 50 not-yet-covered candidates by target arena')
  lines.push('')
  const sortedGroups = [...groups.entries()].sort((a, b) => b[1][0].stars - a[1][0].stars)
  for (const [label, list] of sortedGroups) {
    const existingName = categoriesById.get(label)
    lines.push(`### ${existingName ? `${existingName} (existing arena: ${label})` : label}`)
    lines.push('')
    lines.push('| Repo | Stars | Language | License | Signals | Description |')
    lines.push('| --- | ---: | --- | --- | --- | --- |')
    for (const c of list) {
      const signals = [c.signals.llmsTxt && 'llms.txt', c.signals.mcpMention && 'MCP', c.signals.cliMention && 'CLI']
        .filter(Boolean)
        .join(', ') || '—'
      lines.push(
        `| [${mdEscape(c.repo)}](https://github.com/${c.repo}) | ${fmtStars(c.stars)} | ${c.language ?? '—'} | ${c.license ?? '—'} | ${signals} | ${mdEscape((c.description ?? '').slice(0, 110))} |`,
      )
    }
    lines.push('')
  }
  lines.push('## Suggested new arenas (ranked)')
  lines.push('')
  lines.push('Ranked by uncovered candidate density × AI-era relevance (how much agentic/LLM-centric measurement the arena rewards).')
  lines.push('')
  lines.push('| # | Arena id | Name | Uncovered candidates | AI relevance | Score | Examples |')
  lines.push('| ---: | --- | --- | ---: | ---: | ---: | --- |')
  ranked.forEach((r, i) => {
    lines.push(`| ${i + 1} | \`${r.id}\` | ${r.name} | ${r.count} | ${r.aiRelevance} | ${r.score.toFixed(1)} | ${r.examples.join(', ')} |`)
  })
  lines.push('')
  lines.push(`_llms.txt is checked best-effort (HEAD, ${HEAD_TIMEOUT_MS}ms timeout) for the top ${LLMS_CHECK_LIMIT} candidates by stars; others default to false._`)
  lines.push('')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const categories = readCategories()
  const categoryIds = new Set(categories.map((c) => c.id))
  const categoriesById = new Map(categories.map((c) => [c.id, c.name]))
  // Fail fast on typos: every `existing` target must be a real arena id.
  for (const target of [...Object.values(KNOWN_REPOS), ...RULES.map((r) => r.target)]) {
    if ('existing' in target && !categoryIds.has(target.existing)) {
      throw new Error(`classifier references unknown arena id: ${target.existing}`)
    }
  }

  const { repos, rawResults } = await sweepRepos()
  console.log(`sweep done: ${rawResults} results, ${repos.length} unique repos (${ghRequests} gh requests)`)

  const notExcluded = repos.filter((r) => !isExcluded(r))
  // Product signal: homepage, or (budget-capped) GitHub releases check for the rest.
  const withHomepage = notExcluded.filter((r) => normalizeHomepage(r.homepage) !== null)
  const withoutHomepage = notExcluded
    .filter((r) => normalizeHomepage(r.homepage) === null)
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, RELEASE_CHECK_LIMIT)
  const releaseFlags = await mapLimit(withoutHomepage, HEAD_CONCURRENCY, (r) => hasReleases(r.full_name))
  const viaReleases = withoutHomepage.filter((_, i) => releaseFlags[i])
  const products = [...withHomepage, ...viaReleases].sort((a, b) => b.stargazers_count - a.stargazers_count)
  console.log(
    `filtered: ${repos.length - notExcluded.length} excluded as non-products, ` +
      `${withHomepage.length} with homepage, ${viaReleases.length}/${withoutHomepage.length} via releases signal -> ${products.length} candidates`,
  )

  const covered = coveredKeys()
  const llmsFlags = await mapLimit(products.slice(0, LLMS_CHECK_LIMIT), HEAD_CONCURRENCY, (r) =>
    servesLlmsTxt(r.full_name, normalizeHomepage(r.homepage)),
  )

  const candidates: Candidate[] = products.map((r, i) => {
    const target = classify(r)
    const hay = `${r.name} ${r.description ?? ''} ${r.topics.join(' ')}`.toLowerCase()
    const proposedId = target && 'proposed' in target ? target.proposed : null
    return {
      repo: r.full_name,
      name: r.name,
      stars: r.stargazers_count,
      language: r.language,
      homepage: normalizeHomepage(r.homepage),
      description: r.description,
      license: r.license === 'NOASSERTION' ? null : r.license,
      existingArena: target && 'existing' in target ? target.existing : null,
      proposedArena: proposedId ? { id: proposedId, name: PROPOSED_ARENAS[proposedId].name } : null,
      signals: {
        llmsTxt: i < LLMS_CHECK_LIMIT ? llmsFlags[i] : false,
        mcpMention: mcpMention(hay),
        cliMention: cliMention(hay),
      },
      alreadyCovered:
        covered.repos.has(r.full_name.toLowerCase()) || covered.ids.has(r.name.toLowerCase()),
    }
  })

  const outJson = path.join(DATA_DIR, 'oss-candidates.json')
  fs.writeFileSync(outJson, JSON.stringify(candidates, null, 2) + '\n')
  const coveredCount = candidates.filter((c) => c.alreadyCovered).length
  process.stdout.write(buildMarkdown(candidates, { rawResults, unique: repos.length, filtered: candidates.length, covered: coveredCount }, categoriesById))
  console.log(`wrote ${outJson} (${candidates.length} candidates, ${coveredCount} already covered)`)

  const uncovered = candidates.filter((c) => !c.alreadyCovered)
  console.log('\nTop 15 uncovered candidates:')
  for (const c of uncovered.slice(0, 15)) {
    console.log(`  ${fmtStars(c.stars).padStart(7)}  ${c.repo}  ->  ${arenaLabel(c)}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
