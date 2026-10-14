import type { Story } from '../lib/schemas'

// Every canonical lens story is by definition comparable across ALL software products — that is
// exactly what makes it canon — so scope: 'global' is stamped here at the source rather than in
// each data file. normalize.ts's assembleTaxonomy spreads these objects verbatim, so any newly
// assembled taxonomy inherits the tag; already-committed stories.json files are backfilled by
// pipeline/scripts/tag-story-scopes.ts (whose first rule is canonical → global, so both paths
// agree). Cache-safe: judge.ts's cellHash never reads `scope` (only storyId + title + evidence
// + promptVersion), so stamping this can never trigger a re-judge.
function withGlobalScope(stories: Story[]): Story[] {
  return stories.map((s) => ({ ...s, scope: 'global' as const }))
}

// Canonical agenticness stories, injected verbatim by normalize into every category's
// taxonomy — never LLM-authored. Ids, titles, and weights are fixed by spec §3 and must
// stay identical across all categories.
export const AGENTIC_STORIES: Story[] = withGlobalScope([
  {
    id: 'agentic-public-api',
    persona: 'ai-native',
    title: 'As an AI-native user, I can drive the product through a documented public API',
    theme: 'agenticness',
    group: 'agent-access',
    weight: 3,
  },
  {
    id: 'agentic-official-cli',
    persona: 'ai-native',
    title: 'As an AI-native user, I can use an official CLI',
    theme: 'agenticness',
    group: 'agent-access',
    weight: 2,
  },
  {
    id: 'agentic-mcp-server',
    persona: 'ai-native',
    title: 'As an AI-native user, I can connect an agent via an official MCP server',
    theme: 'agenticness',
    group: 'agent-access',
    weight: 3,
  },
  {
    id: 'agentic-mcp-client',
    persona: 'ai-native',
    title: 'As an AI-native user, I can plug MCP servers into this product so it can use their tools',
    theme: 'agenticness',
    group: 'agent-access',
    weight: 3,
  },
  {
    id: 'agentic-webhooks',
    persona: 'ai-native',
    title: 'As an AI-native user, I can subscribe to events via webhooks',
    theme: 'agenticness',
    group: 'agent-access',
    weight: 2,
  },
  {
    id: 'agentic-sdks',
    persona: 'ai-native',
    title: 'As an AI-native user, I can build against official SDKs',
    theme: 'agenticness',
    group: 'agent-access',
    weight: 2,
  },
  {
    id: 'agentic-agent-docs',
    persona: 'ai-native',
    title: 'As an AI-native user, I can point an agent at llms.txt or agent-oriented docs',
    theme: 'agenticness',
    group: 'agent-access',
    weight: 2,
  },
  {
    id: 'agentic-scoped-keys',
    persona: 'ai-native',
    title: 'As an AI-native user, I can issue scoped/least-privilege API credentials for an agent',
    theme: 'agenticness',
    group: 'agent-access',
    weight: 2,
  },
  {
    id: 'agentic-headless',
    persona: 'ai-native',
    title: 'As an AI-native user, I can run the product headlessly / in CI for automation',
    theme: 'agenticness',
    group: 'agent-access',
    weight: 2,
  },
])

// Canonical agentic-features stories — same injection contract as AGENTIC_STORIES above, but
// scored as a separate group ("does the product act agentically itself" vs "can your agent
// drive it"). Ids, titles, and weights are fixed and must stay identical across all categories.
export const AGENTIC_FEATURE_STORIES: Story[] = withGlobalScope([
  {
    id: 'agentic-builtin-assistant',
    persona: 'ai-native',
    title: 'As an AI-native user, I can delegate tasks to a built-in AI assistant inside the product',
    theme: 'agenticness',
    group: 'agentic-features',
    weight: 3,
  },
  {
    id: 'agentic-autonomous-automation',
    persona: 'ai-native',
    title: 'As an AI-native user, I can set up automations that run autonomously in the background',
    theme: 'agenticness',
    group: 'agentic-features',
    weight: 2,
  },
  {
    id: 'agentic-nl-commands',
    persona: 'ai-native',
    title: 'As an AI-native user, I can operate the product with natural-language commands',
    theme: 'agenticness',
    group: 'agentic-features',
    weight: 2,
  },
  {
    id: 'agentic-ai-insights',
    persona: 'ai-native',
    title: 'As an AI-native user, I can get AI-generated insights and suggestions from my data inside the product',
    theme: 'agenticness',
    group: 'agentic-features',
    weight: 2,
  },
])

// Canonical openness stories — same injection contract as AGENTIC_STORIES above, scored as
// their own theme ("openness"). Ids, titles, and weights are fixed and must stay identical
// across all categories.
export const OPENNESS_STORIES: Story[] = withGlobalScope([
  {
    id: 'openness-self-host',
    persona: 'ai-native',
    title: 'As an AI-native user, I can self-host the core product',
    theme: 'openness',
    group: 'openness',
    weight: 3,
  },
  {
    id: 'openness-full-export',
    persona: 'ai-native',
    title: 'As an AI-native user, I can export all of my data in open formats and leave',
    theme: 'openness',
    group: 'openness',
    weight: 3,
  },
  {
    id: 'openness-api-parity',
    persona: 'ai-native',
    title: 'As an AI-native user, I can do everything through the API that I can do in the UI',
    theme: 'openness',
    group: 'openness',
    weight: 2,
  },
  {
    id: 'openness-open-license',
    persona: 'ai-native',
    title: "As an AI-native user, I can read the product's source under an open license",
    theme: 'openness',
    group: 'openness',
    weight: 2,
  },
])

// Canonical automation-depth stories — same injection contract as AGENTIC_STORIES above,
// scored as their own theme ("automation-depth"). Ids, titles, and weights are fixed and must
// stay identical across all categories.
export const AUTOMATION_STORIES: Story[] = withGlobalScope([
  {
    id: 'automation-rules-engine',
    persona: 'ai-native',
    title: 'As an AI-native user, I can define rules that trigger actions automatically on events',
    theme: 'automation-depth',
    group: 'automation-depth',
    weight: 3,
  },
  {
    id: 'automation-scheduled-jobs',
    persona: 'ai-native',
    title: 'As an AI-native user, I can schedule recurring jobs or workflows',
    theme: 'automation-depth',
    group: 'automation-depth',
    weight: 2,
  },
  {
    id: 'automation-bulk-operations',
    persona: 'ai-native',
    title: 'As an AI-native user, I can perform bulk operations across many items at once',
    theme: 'automation-depth',
    group: 'automation-depth',
    weight: 2,
  },
  {
    id: 'automation-versioned-workflows',
    persona: 'ai-native',
    title: 'As an AI-native user, I can version, review, and roll back my automations',
    theme: 'automation-depth',
    group: 'automation-depth',
    weight: 1,
  },
])

// Canonical API-quality stories — same injection contract as AGENTIC_STORIES above, scored as
// their own group ("api-quality") under the "agenticness" theme (agent-access is "can an agent
// reach the product at all"; api-quality is "how good is that surface once you're there"). Ids,
// titles, and weights are fixed and must stay identical across all categories.
export const API_QUALITY_STORIES: Story[] = withGlobalScope([
  {
    id: 'api-interactive-docs',
    persona: 'ai-native',
    title: 'As an AI-native user, I can explore an interactive API reference with runnable examples',
    theme: 'agenticness',
    group: 'api-quality',
    weight: 2,
  },
  {
    id: 'api-machine-spec',
    persona: 'ai-native',
    title: 'As an AI-native user, I can download a machine-readable API spec (OpenAPI or equivalent)',
    theme: 'agenticness',
    group: 'api-quality',
    weight: 2,
  },
  {
    id: 'api-versioning-policy',
    persona: 'ai-native',
    title: 'As an AI-native user, I can rely on versioned APIs with a documented deprecation policy',
    theme: 'agenticness',
    group: 'api-quality',
    weight: 2,
  },
  {
    id: 'api-sandbox',
    persona: 'ai-native',
    title: 'As an AI-native user, I can test against a sandbox environment without touching production data',
    theme: 'agenticness',
    group: 'api-quality',
    weight: 1,
  },
])

// Canonical privacy-posture stories — same injection contract as AGENTIC_STORIES above,
// scored as their own theme ("privacy-posture"). Ids, titles, and weights are fixed and must
// stay identical across all categories.
export const PRIVACY_STORIES: Story[] = withGlobalScope([
  {
    id: 'privacy-telemetry-optout',
    persona: 'ai-native',
    title: 'As an AI-native user, I can opt out of telemetry and usage tracking',
    theme: 'privacy-posture',
    group: 'privacy-posture',
    weight: 2,
  },
  {
    id: 'privacy-data-residency',
    persona: 'ai-native',
    title: 'As an AI-native user, I can choose where my data is stored (region/residency)',
    theme: 'privacy-posture',
    group: 'privacy-posture',
    weight: 2,
  },
  {
    id: 'privacy-retention-controls',
    persona: 'ai-native',
    title: 'As an AI-native user, I can control data retention and deletion',
    theme: 'privacy-posture',
    group: 'privacy-posture',
    weight: 2,
  },
  {
    id: 'privacy-no-training',
    persona: 'ai-native',
    title: 'As an AI-native user, I can prevent my data from being used to train AI models',
    theme: 'privacy-posture',
    group: 'privacy-posture',
    weight: 3,
  },
])
