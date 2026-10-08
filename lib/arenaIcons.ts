// Curated house icons for the ARENAS (founder ask 2026-10-01: "we have icons we generated for
// processes that were custom but we have not applied to the rest of the site, ie the startup
// sim, the top bar menus") — the arena-side twin of lib/processIcons.ts, same token scheme.
//
// Every arena id maps to a `pi:<glyph>:<hue>` token naming a hand-authored geometric glyph in
// components/icons/ProcessIcon.tsx. Where an arena's concept already had a designed process
// glyph, it REUSES it (same concept = same glyph everywhere: startup-banking wears the same
// bank the "Open bank account" process wears, payroll the same money-in-motion, design-tools
// the same palette); concepts with no process twin got new glyphs drawn in the same design
// language (gpus, frontier-models, vector-databases, browser-agents, …).
//
// Hues follow data/arena-sections.json — one accent hue per SECTION so the Rankings menu reads
// in families, mirroring the per-AREA hues of the process set: money is emerald, security/legal
// amber, infra/data sky, AI/software violet, comms/people orange, commerce/growth fuchsia,
// hardware the neutral zinc.
//
// The legacy emoji picks stay in data/arena-icons.json as the semantic guides and for any
// text-only surface; everything visual resolves through arenaIcon() + IconChip/IconGlyph.
// Coverage is enforced by lib/__tests__/arenaIcons.test.ts: an arena shipped without a designed
// glyph — or a stale mapping — is a test failure; that's the point.
//
// Client-safe and pure (no node builtins, no React): imported from the server layout and
// client menus alike.

import type { IconHue } from '@/lib/processIcons'
import { PROCESS_ICON_PREFIX } from '@/lib/processIcons'

const pi = (glyph: string, hue: IconHue): string => `${PROCESS_ICON_PREFIX}${glyph}:${hue}`

// Section hues (data/arena-sections.json section id → hue). Exported for the gallery legend.
export const ARENA_SECTION_HUES: Record<string, IconHue> = {
  'ai-agents': 'violet',
  'models-inference': 'violet',
  hardware: 'zinc',
  'dev-tools': 'violet',
  'infra-ops': 'sky',
  'data-search': 'sky',
  'fintech-ops': 'emerald',
  'commerce-customers': 'fuchsia',
  'comms-productivity': 'orange',
  'security-legal': 'amber',
}

export const ARENA_ICONS: Record<string, string> = {
  // AI & Agents (violet)
  'ai-coding': pi('robot', 'violet'), // 🤖 the coding agent
  'ai-assistants': pi('bulb', 'violet'), // 💡 the assistant's idea
  'self-hosted-assistants': pi('home-server', 'violet'), // 🦞 the rack at home
  'ai-research-agents': pi('telescope', 'violet'), // 🧪→🔭 looking far
  'ai-code-review': pi('code-check', 'violet'), // 🕵️ the reviewed diff
  'ai-support-agents': pi('headset', 'violet'), // 🎧 same concept as growth_004 support
  'agent-frameworks': pi('nodes', 'violet'), // 🤝 the agent graph
  'agent-sandboxes': pi('sandbox', 'violet'), // 📦 the isolated cube
  'agent-skills': pi('grad-cap', 'violet'), // 🎓 taught skills
  'browser-agents': pi('browser', 'violet'), // 🌐 the driven browser
  'ai-memory': pi('chip-ram', 'violet'), // 🗃️ the memory chip
  'voice-agents': pi('mic', 'violet'), // 🎙️ the microphone
  'mcp-infrastructure': pi('puzzle', 'violet'), // 🧩 the connecting piece
  'robotics-platforms': pi('mech-arm', 'violet'), // 🦾 same concept as agent-run-back-office
  // Models & Inference (violet)
  'frontier-models': pi('brain', 'violet'), // 🧠 the model brain
  'inference-providers': pi('speedo', 'violet'), // 🚀 tokens per second
  'model-gateways': pi('gateway', 'violet'), // 🚪 one arch, many models
  'local-llm-runtimes': pi('brain-box', 'violet'), // 🧠 the local mind
  'llm-evals-observability': pi('microscope', 'violet'), // 🔬 same concept as tax_010 research
  'gpu-clouds': pi('cloud-bolt', 'violet'), // 🎛️ compute in the cloud
  // Hardware (zinc)
  processors: pi('chip', 'zinc'), // 🔲 the CPU die
  gpus: pi('gpu', 'zinc'), // 🎮 the graphics card
  // Dev Tools (violet)
  'code-hosting': pi('git-branch', 'violet'), // 🗂️ same concept as prod_006 code hosting
  terminals: pi('terminal', 'violet'), // ⌨️ the prompt window
  'package-managers': pi('box', 'violet'), // 📦 the package
  'frontend-frameworks': pi('layout', 'violet'), // 🎨 the interface shell
  'mobile-dev': pi('phone', 'violet'), // 📱 same concept as prod_012 app stores
  'vibe-coding': pi('wand', 'violet'), // ✨ same magic as site_001 generate
  'software-factory': pi('factory', 'violet'), // 🏭 the production line
  'api-platforms': pi('plug', 'violet'), // 🔌 same concept as vendor_010 connect
  'docs-platforms': pi('books', 'violet'), // 📚 same concept as ops_003 wiki
  'desktop-os': pi('monitor', 'violet'), // 🖥️ same concept as ops_013 device mgmt
  'game-engines': pi('gamepad', 'violet'), // 🎮 the controller
  // Infra & Ops (sky)
  'edge-platforms': pi('bolt', 'sky'), // ⚡ compute at the edge
  'cloud-platforms': pi('cloud', 'sky'), // ☁️ same concept as prod_001 cloud infra
  'domain-registrars': pi('globe', 'sky'), // 🌐 same concept as domain_002 buy a domain
  'backend-as-a-service': pi('bricks', 'sky'), // 🧱 the building blocks
  'serverless-databases': pi('database', 'sky'), // 🗄️ the cylinder
  'infra-as-code': pi('crane', 'sky'), // 🏗️ infrastructure under construction
  'durable-workflows': pi('infinity', 'sky'), // 🔁 the run that survives
  'feature-flags': pi('flag', 'sky'), // 🚩 the flag
  observability: pi('eye', 'sky'), // 👁️ watching the system
  'incident-management': pi('pager', 'sky'), // 🚨 same concept as scale_009 on-call
  'error-tracking': pi('siren', 'sky'), // 🐛 same concept as prod_004 error tracking
  // Data & Search (sky)
  'data-warehouses': pi('warehouse', 'sky'), // 🏛️ same concept as scale_010 warehouse & BI
  'data-pipelines': pi('pipes', 'sky'), // 🔀 data flowing through
  'vector-databases': pi('vector', 'sky'), // 🧮 the embedding space
  'search-infra': pi('search', 'sky'), // 🔍 same magnifier as growth_011 SEO
  'ai-search-apis': pi('search-spark', 'sky'), // 🔎 the magnifier with the spark
  'web-scraping': pi('web', 'sky'), // 🕸️ the web itself
  'document-extraction': pi('doc-scan', 'sky'), // 📄 the scanned page
  'product-analytics': pi('funnel', 'sky'), // 🦔 same concept as prod_005 analytics
  // Fintech & Back Office (emerald)
  payments: pi('card', 'emerald'), // 💳 same concept as qs_021 payment processor
  'billing-subscriptions': pi('repeat', 'emerald'), // 🧾 same concept as growth_001 billing
  'fraud-prevention': pi('detective', 'emerald'), // 🕵️ the investigator
  'card-issuing': pi('card-stack', 'emerald'), // 🪪 the issued cards
  'tax-automation': pi('percent', 'emerald'), // 🧮 the tax percent
  'banking-as-a-service': pi('bank-platform', 'emerald'), // 🏦 the bank as a platform
  'marketplace-payments': pi('storefront', 'emerald'), // 🏪 the seller's shop
  'stablecoin-payments': pi('stablecoin', 'emerald'), // 🪙 the pegged coin
  'banking-data-apis': pi('link', 'emerald'), // 🔗 account linking
  'identity-verification': pi('passport', 'emerald'), // 🛂 same passport as hr_011
  'mobile-payments': pi('pos', 'emerald'), // 📲 the tap-to-pay terminal
  'startup-banking': pi('bank', 'emerald'), // 🏦 same concept as qs_023 open bank account
  'virtual-mailboxes': pi('mailbox', 'emerald'), // 📬 same concept as qs_044 mailing address
  accounting: pi('calculator', 'emerald'), // 🧾 same concept as qs_073 set up accounting
  payroll: pi('cash-flow', 'emerald'), // 💰 same concept as qs_063 payroll
  'applicant-tracking': pi('card-index', 'emerald'), // 🗂️ same concept as hr_004 ATS
  'equity-management': pi('pie', 'emerald'), // 📊 same ownership pie as the cap table
  'expense-management': pi('receipt', 'emerald'), // 💳 same receipts as scale_004
  // Commerce & Customers (fuchsia)
  'ecommerce-platforms': pi('cart', 'fuchsia'), // 🛒 same cart as tax_011
  'agentic-commerce': pi('shopping-bag', 'fuchsia'), // 🛍️ the agent's bag
  crm: pi('contact-card', 'fuchsia'), // 📇 same concept as sales_001 CRM
  'customer-data-platforms': pi('person-nodes', 'fuchsia'), // 🧲 the stitched customer
  'product-feedback': pi('chat-star', 'fuchsia'), // 💬 the rated bubble
  'email-marketing': pi('megaphone', 'fuchsia'), // 📣 same concept as growth_003
  // Comms & Productivity (orange)
  'team-chat': pi('chat', 'orange'), // 💭 same concept as ops_001 team chat
  email: pi('envelope', 'orange'), // ✉️ same concept as opp_008 send an email
  'email-apis': pi('envelope-bolt', 'orange'), // 📮 same concept as growth_005 transactional
  'meeting-ai': pi('waveform', 'orange'), // 🗓️ the recorded conversation
  scheduling: pi('calendar', 'orange'), // 📅 the calendar itself
  'project-management': pi('ticket', 'orange'), // 📋 same concept as ops_002 tracker
  'notes-knowledge': pi('note-pen', 'orange'), // 📝 the note being written
  'cloud-storage': pi('folder', 'orange'), // 📁 same folder as fund_005 data room
  'design-tools': pi('palette', 'orange'), // 🖌️ same palette as brand_002 logo
  'workflow-automation': pi('flow', 'orange'), // 🔁 the branching automation
  // Security & Legal (amber)
  'security-scanners': pi('shield-check', 'amber'), // 🛡️ the security shield
  'auth-platforms': pi('key', 'amber'), // 🔐 same key as scale_007 access mgmt
  'sso-identity': pi('badge', 'amber'), // 🪪 same badge as opp_007 provisioning
  'legal-ops': pi('scales', 'amber'), // ⚖️ same scales as the legal phase
  'startup-law-firms': pi('columns', 'amber'), // 🏛️ the firm's columns
  'startup-immigration': pi('passport', 'amber'), // 🗽 same passport as hr_011's visa sponsorship
  'government-services': pi('form', 'amber'), // 🏛️ the government form — same glyph comp_014 wears
  'compliance-automation': pi('clipboard', 'amber'), // 📋 same clipboard as the compliance phase
  'security-keys': pi('hardware-key', 'amber'), // 🗝️ the hardware key
  'authenticator-apps': pi('otp-code', 'amber'), // 🔢 the one-time code
}

// The Arenas menu's leading "Overall — every product ranked" entry (not an arena id).
export const OVERALL_ICON = pi('star', 'emerald') // ⭐ the cross-arena leaderboard

// The Explore menu's two labeled ranking groups (app/layout.tsx) — was 🏢 / 🔁 in the section
// names; now house glyphs so the top-bar menus wear the custom set end to end.
export const EXPLORE_SECTION_ICONS = {
  companyRankings: pi('building', 'sky'), // 🏢 same office as ops_004
  processRankings: pi('cycle', 'sky'), // 🔁 the recurring loop
} as const

// The mobile ☰ menu's destinations (components/MobileNav.tsx) — same vocabulary as the rest of
// the site: the sim is the flask (🧪 was its emoji), compare the scales, stacks the bricks.
export const MOBILE_NAV_ICONS: Record<string, string> = {
  '/arenas': pi('stadium', 'emerald'), // 🏟 the arenas themselves
  '/processes': pi('cycle', 'sky'), // 🔁
  '/situations': pi('siren', 'amber'), // 🚨 reactive, trigger-driven — amber: urgent, not an error
  '/technologies': pi('plug', 'sky'), // 🔌 same concept as vendor_010
  '/startup-sim': pi('flask', 'emerald'), // 🧪 same flask as startup_001
  '/stacks': pi('bricks', 'sky'), // 🧱
  '/compare': pi('scales', 'amber'), // ⚖ same scales as the legal phase
  '/global': pi('world', 'sky'), // 🌍 same world as hr_003
  '/methodology': pi('ruler', 'sky'), // 📐 same set square as fin_010
}

// The homepage mode tabs (components/HomeModes.tsx) — was 🏢/📦/🔁/🏟 emoji; now the same
// house glyphs the Explore menu and the mobile menu wear for the same concepts (founder
// 2026-10-02: "we still have the older icons in various places"). Products wears the package
// box in the tabs' neutral sky, distinct from the package-managers arena's violet box.
export const HOME_MODE_ICONS: Record<string, string> = {
  companies: pi('building', 'sky'), // 🏢 same office as EXPLORE_SECTION_ICONS.companyRankings
  products: pi('box', 'sky'), // 📦 the judged product lines
  processes: pi('cycle', 'sky'), // 🔁 same loop as EXPLORE_SECTION_ICONS.processRankings
  arenas: pi('stadium', 'emerald'), // 🏟 same stadium as MOBILE_NAV_ICONS['/arenas']
}

// The /technologies control-surface categories (lib/controlSurfaces.ts SURFACE_DEFS — founder
// 2026-10-08 house icon sweep: the per-surface emoji column markers join the custom set). All
// violet: control surfaces ARE the machine-access/AI family, and most reuse their arena twin's
// exact token (same concept = same mark, the SURFACE_DEFS comment's own rule). Totality over
// SURFACE_DEFS is enforced by lib/__tests__/arenaIcons.test.ts.
export const CONTROL_SURFACE_ICONS: Record<string, string> = {
  api: pi('plug', 'violet'), // 🔌 same plug as the api-platforms arena
  mcp: pi('puzzle', 'violet'), // 🧩 same piece as mcp-infrastructure
  'agent-docs': pi('books', 'violet'), // 📖 same books as docs-platforms
  headless: pi('gear', 'violet'), // ⚙️ the machine running without a UI
  'nl-commands': pi('chat', 'violet'), // 💬 talking to the product
  sdk: pi('box', 'violet'), // 📦 same package as package-managers
  assistant: pi('bulb', 'violet'), // 💡 same bulb as ai-assistants
  cli: pi('terminal', 'violet'), // ⌨️ same prompt as terminals
  webhooks: pi('bolt', 'violet'), // 🪝 no hook glyph was ever drawn — the bolt: the event firing at your endpoint
  'mobile-app': pi('phone', 'violet'), // 📱 same phone as mobile-dev
  'desktop-app': pi('monitor', 'violet'), // 🖥️ same monitor as desktop-os
  voice: pi('mic', 'violet'), // 🎙️ same microphone as voice-agents
  'browser-extension': pi('browser', 'violet'), // 🌐 same browser as browser-agents
}

// Icon token for an arena id ('' for an unknown id — callers render nothing, never a wrong
// concept; totality over the live categories is enforced by lib/__tests__/arenaIcons.test.ts).
export function arenaIcon(arenaId: string): string {
  return ARENA_ICONS[arenaId] ?? ''
}
