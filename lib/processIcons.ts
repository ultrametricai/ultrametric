// Curated, salient icons for the founder-process corpus: one icon per PHASE, one per PROCESS
// (keyed by corpus task id — stable across title tweaks), and one per curated playbook (chain).
//
// Since 2026-09-30 (founder: "make our own custom geometric and colorized icons — use the
// current emoji picks as a semantic guide but make our unique icon set") these resolve to HOUSE
// ICON TOKENS, not emoji: `pi:<glyph>:<hue>` names a hand-authored geometric glyph in
// components/icons/ProcessIcon.tsx plus a per-AREA accent hue (related processes share a hue —
// money is emerald, formation/legal amber, compliance/ops/product sky, vc/software violet,
// people orange, growth fuchsia). components/IconChip.tsx detects the token and renders the
// SVG; any non-token value (arena emoji, theme emoji from lib/icons.ts) keeps rendering as
// text, so the two systems coexist. The old curated emoji survive as per-glyph fallback/alias
// data on the glyphs themselves (GLYPHS[id].emoji) — the semantic guide the set was drawn from.
//
// Hand-picked, not keyword-derived — each glyph should evoke the actual process (incorporate =
// civic columns, run payroll = money in motion, track runway = chart down, hire = handshake),
// and the site-wide rules from lib/icons.ts apply: same concept = same glyph everywhere (all
// three cap-table processes share the ownership pie), and every icon renders with a tooltip
// naming the concept (components/IconChip.tsx enforces the title).
//
// Coverage over the LIVE corpus is enforced by lib/__tests__/processIcons.test.ts: a new
// process, phase, or chain shipped without a curated icon — or a token naming a glyph that was
// never designed — is a test failure; that's the point. The full set renders for founder review
// at /experiments/icons (unlisted, noindex).
//
// Client-safe and pure (no node builtins, no React): imported from server pages and the
// ProcessesTable client component alike.

// ---------- The icon token scheme ----------

export const PROCESS_ICON_PREFIX = 'pi:'

// The house accent families (tailwind names; hexes live with the glyphs in
// components/icons/ProcessIcon.tsx). zinc is the neutral fallback tone.
export type IconHue = 'emerald' | 'amber' | 'sky' | 'violet' | 'fuchsia' | 'orange' | 'red' | 'zinc'

const HUES: ReadonlySet<string> = new Set(['emerald', 'amber', 'sky', 'violet', 'fuchsia', 'orange', 'red', 'zinc'])

// Compose a token. Kept private — the curated maps below are the only place tokens are minted.
const pi = (glyph: string, hue: IconHue): string => `${PROCESS_ICON_PREFIX}${glyph}:${hue}`

// Parse an icon value: `pi:<glyph>:<hue>` → { glyph, hue }, anything else (emoji, '') → null.
// An unknown hue falls back to zinc rather than failing — the glyph is the concept, the hue is
// decoration.
export function parseProcessIconToken(value: string): { glyph: string; hue: IconHue } | null {
  if (!value.startsWith(PROCESS_ICON_PREFIX)) return null
  const [glyph, hue] = value.slice(PROCESS_ICON_PREFIX.length).split(':')
  if (!glyph) return null
  return { glyph, hue: HUES.has(hue) ? (hue as IconHue) : 'zinc' }
}

// ---------- Phases ----------
// One accent hue per AREA, so a phase's processes read as a family in the tables and the DAG.

export const PHASE_ICONS: Record<string, { icon: string; emoji: string; blurb: string }> = {
  startup: { icon: pi('egg', 'emerald'), emoji: '🐣', blurb: 'validating the idea and forming the founding team' },
  formation: { icon: pi('columns', 'amber'), emoji: '🏛️', blurb: 'incorporating and standing up the company' },
  fundraising: { icon: pi('coin-stack', 'emerald'), emoji: '💰', blurb: 'raising money and managing equity' },
  vc: { icon: pi('unicorn', 'violet'), emoji: '🦄', blurb: 'forming, closing, and running a venture fund' },
  legal: { icon: pi('scales', 'amber'), emoji: '⚖️', blurb: 'contracts, IP, and legal paperwork' },
  compliance: { icon: pi('clipboard', 'sky'), emoji: '📋', blurb: 'filings, taxes, and staying compliant' },
  finance: { icon: pi('cash-flow', 'emerald'), emoji: '💸', blurb: 'banking, accounting, and money movement' },
  hr: { icon: pi('handshake', 'orange'), emoji: '🤝', blurb: 'hiring, payroll, and people ops' },
  operations: { icon: pi('gear', 'sky'), emoji: '⚙️', blurb: 'day-to-day tooling and internal ops' },
  product: { icon: pi('tools', 'sky'), emoji: '🛠️', blurb: 'standing up the product stack' },
  software: { icon: pi('laptop', 'violet'), emoji: '💻', blurb: 'the spec, build, review, ship loop' },
  sales: { icon: pi('handset', 'orange'), emoji: '📞', blurb: 'selling and invoicing customers' },
  growth: { icon: pi('chart-up', 'fuchsia'), emoji: '📈', blurb: 'marketing, subscriptions, and retention' },
}

export function phaseIcon(phase: string): string {
  return PHASE_ICONS[phase]?.icon ?? ''
}

// The legacy curated emoji for a phase — for text-only surfaces where SVG can't render
// (native <select> option labels, plain-text output). Everything visual takes phaseIcon().
export function phaseEmoji(phase: string): string {
  return PHASE_ICONS[phase]?.emoji ?? ''
}

// The REQUIRED tooltip for a phase icon — names the concept, per the site-wide icon rule.
export function phaseTooltip(phase: string): string {
  const entry = PHASE_ICONS[phase]
  return entry ? `${phase} — ${entry.blurb}` : phase
}

// ---------- Cadence ----------
// The one glyph for "this process recurs" (was the 🔁 emoji on the process-page cadence chip) —
// the same recurring loop the Explore menu's Process-rankings group wears (lib/arenaIcons.ts).
export const CADENCE_ICON = pi('cycle', 'sky')

// ---------- Urgency (situations) ----------
// House glyphs for the UrgencyChip tiers (founder 2026-10-02: the 🚨/⏰/🗓 emoji join the custom
// set). Glyph = the tier's old emoji concept, hue = the tier's existing semantic color: the
// siren for "within hours" (red), the overdue clock for "within days" (amber), the calendar for
// "within weeks" (sky). Keyed by the lib/processSim.ts Urgency tier names.
export const URGENCY_ICONS: Record<'hours' | 'days' | 'weeks', string> = {
  hours: pi('siren', 'red'), // 🚨
  days: pi('clock-alert', 'amber'), // ⏰
  weeks: pi('calendar', 'sky'), // 🗓
}

// ---------- Individual processes (keyed by corpus task id) ----------
// Glyph = the concept (was: the emoji), hue = the process's area. Comments carry the old emoji
// pick as the semantic guide each glyph was drawn from.

export const PROCESS_ICONS: Record<string, string> = {
  // Initial startup (emerald)
  startup_001: pi('flask', 'emerald'), // 🧪 Validate the idea
  startup_002: pi('pen-nib', 'emerald'), // 🖋️ Founder agreement & equity split
  // Formation (amber)
  form_001: pi('columns', 'amber'), // 🏛️ Incorporate C-Corp
  form_011: pi('bricks', 'amber'), // 🧱 Set up an LLC (the simpler building block)
  form_012: pi('butterfly', 'amber'), // 🦋 Convert an LLC to a C-Corp (the metamorphosis)
  form_002: pi('id-card', 'amber'), // 🆔 Get EIN
  form_005: pi('map', 'amber'), // 🗺️ Register state taxes
  qs_044: pi('mailbox', 'amber'), // 📬 Set up mailing address
  brand_001: pi('bulb', 'amber'), // 💡 Generate a company name
  brand_002: pi('palette', 'amber'), // 🎨 Generate a brand logo
  brand_003: pi('swatches', 'amber'), // 🌈 Pick a brand color palette
  domain_001: pi('search', 'amber'), // 🔍 Check domain availability
  domain_002: pi('globe', 'amber'), // 🌐 Buy a domain
  // Fundraising (emerald)
  fund_001: pi('sprout', 'emerald'), // 🌱 Raise pre-seed (SAFEs)
  fund_002: pi('briefcase', 'emerald'), // 💼 Close a priced equity round (the suits arrive)
  fund_003: pi('dollar', 'emerald'), // 💲 409A valuation
  fund_005: pi('folder', 'emerald'), // 📁 Set up a data room (the diligence folder)
  fund_004: pi('certificate', 'emerald'), // 🎟️ Issue stock options
  fund_006: pi('convert', 'emerald'), // 🔀 Convert SAFEs at the priced round
  fund_007: pi('paper-plane', 'emerald'), // 🛩 Apply to Y Combinator (the application goes out)
  // VC fund (violet — founder ask 2026-09-23: "a process area for VC processes")
  vc_001: pi('jar', 'violet'), // 🫙 Form a VC fund (the vehicle, stood up and ready to fill)
  vc_002: pi('bottle', 'violet'), // 🍾 Close the fund (the first-and-final close)
  vc_003: pi('atm', 'violet'), // 🏧 Run the fund back office (the money machine)
  qs_051: pi('pie', 'emerald'), // 🥧 Set up cap table (ownership pie)
  qs_052: pi('pie', 'emerald'), // 🥧 Update cap table
  qs_053: pi('pie', 'emerald'), // 🥧 Audit cap table
  // Legal (amber)
  legal_001: pi('hush', 'amber'), // 🤐 Send NDA
  legal_002: pi('registered', 'amber'), // ®️ File trademark
  legal_003: pi('copyright', 'amber'), // ©️ IP assignments
  legal_004: pi('contract', 'amber'), // 📑 Negotiate SaaS agreement
  qs_043: pi('suit', 'amber'), // 🕴️ Set up registered agent
  opp_012: pi('telescope', 'amber'), // 🔭 Monitor trademark / handle availability
  shutdown_001: pi('door', 'amber'), // 🚪 Shut down the company (closing the doors)
  // Compliance (sky)
  tax_001: pi('banknote', 'sky'), // 💵 File DE franchise tax
  tax_002: pi('receipt', 'sky'), // 🧾 File federal tax return
  tax_003: pi('postbox', 'sky'), // 📮 Issue 1099s
  ins_001: pi('umbrella', 'sky'), // ☂️ Get insurance quotes
  comp_001: pi('shield-check', 'sky'), // 🛡️ Start SOC 2 Type I
  qs_045: pi('dividers', 'sky'), // 🗂️ Review state registration
  qs_047: pi('calendar', 'sky'), // 📆 File state annual report (annual-filing calendar)
  scale_007: pi('key', 'sky'), // 🔑 SSO & access mgmt
  scale_011: pi('detective', 'sky'), // 🕵️ Vendor security review
  comp_010: pi('padlock', 'sky'), // 🔒 Publish privacy policy & DPA (privacy is the lock site-wide)
  comp_011: pi('scroll', 'sky'), // 📜 Board minutes cadence
  comp_002: pi('shield-check', 'sky'), // 🛡️ Complete SOC 2 Type II (same SOC 2 concept as comp_001)
  comp_013: pi('mask', 'sky'), // 🥷 Annual penetration test (the ethical intruder)
  comp_014: pi('form', 'sky'), // 📝 Answer a security questionnaire (the giant form)
  tax_010: pi('microscope', 'sky'), // 🔬 Claim the R&D tax credit (qualified research)
  tax_011: pi('cart', 'sky'), // 🛒 Sales tax nexus & registration (tax on the cart)
  // Finance (emerald)
  qs_021: pi('card', 'emerald'), // 💳 Connect a payment processor (canonical: Stripe)
  qs_023: pi('bank', 'emerald'), // 🏦 Open bank account
  qs_024: pi('card', 'emerald'), // 💳 Set up credit card
  qs_050: pi('chart-down', 'emerald'), // 📉 Track runway
  qs_073: pi('calculator', 'emerald'), // 🧮 Set up accounting
  fin_001: pi('banknote', 'emerald'), // 💵 Pay vendor invoices
  fin_002: pi('ledger', 'emerald'), // 📒 Bookkeeping close
  fin_003: pi('bar-chart', 'emerald'), // 📊 Board financial report
  scale_004: pi('receipt', 'emerald'), // 🧾 Expense management (receipts)
  scale_005: pi('tie', 'emerald'), // 👔 Board meeting prep
  opp_001: pi('tray-out', 'emerald'), // 📤 Send a wire or ACH payment
  opp_004: pi('return-arrow', 'emerald'), // ↩️ Issue a refund
  fin_010: pi('ruler', 'emerald'), // 📐 Annual budget & board approval (drawing up the plan)
  // HR (orange)
  qs_063: pi('cash-flow', 'orange'), // 💸 Set up payroll
  hr_001: pi('handshake', 'orange'), // 🤝 Hire first employee
  hr_002: pi('cash-flow', 'orange'), // 💸 Run payroll (same concept as qs_063)
  hr_003: pi('world', 'orange'), // 🌍 Hire intl contractor
  hr_004: pi('card-index', 'orange'), // 🗃️ Set up ATS
  hr_005: pi('person-out', 'orange'), // 👋 Offboard employee
  scale_001: pi('star', 'orange'), // ⭐ Performance reviews
  scale_002: pi('stethoscope', 'orange'), // 🩺 Set up benefits
  scale_003: pi('book-open', 'orange'), // 📖 Employee handbook
  scale_008: pi('tray-in', 'orange'), // 📥 Hiring pipeline
  opp_002: pi('hard-hat', 'orange'), // 👷 Add a contractor (1099)
  opp_007: pi('badge', 'orange'), // 🪪 Provision a workspace user (canonical: Google Workspace)
  team_001: pi('mail-heart', 'orange'), // 💌 Invite a teammate
  hr_010: pi('top-hat', 'orange'), // 🎩 Hire an executive (the top hat)
  hr_011: pi('passport', 'orange'), // 🛂 Sponsor a work visa (passport control)
  hr_012: pi('nest-egg', 'orange'), // 🪺 Set up a 401(k) (the nest egg)
  hr_013: pi('globe-pin', 'orange'), // 🌏 Hire abroad via an EOR (employment across the globe)
  // Operations (sky)
  qs_015: pi('cabinet', 'sky'), // 🗄️ Set up doc storage
  ops_001: pi('chat', 'sky'), // 💬 Set up team chat (canonical: Slack)
  ops_002: pi('ticket', 'sky'), // 🎫 Set up a project tracker (canonical: Linear)
  ops_003: pi('books', 'sky'), // 📚 Set up a team wiki (canonical: Notion)
  ops_004: pi('building', 'sky'), // 🏢 Set up company email & docs (canonical: Google Workspace)
  ops_005: pi('vault', 'sky'), // 🔐 Set up a password manager (canonical: 1Password)
  scale_006: pi('org-tree', 'sky'), // 🏗️ Multi-team structure
  scale_012: pi('target', 'sky'), // 🎯 Company OKRs (goals are the target site-wide)
  opp_005: pi('clipboard', 'sky'), // 📋 Create a project in your tracker (canonical: Asana)
  opp_008: pi('envelope', 'sky'), // ✉️ Draft and send an email (canonical: Gmail)
  opp_011: pi('envelope-route', 'sky'), // 📨 Set up email routing on your domain
  vendor_010: pi('plug', 'sky'), // 🔌 Connect a vendor or MCP server
  vendor_011: pi('compass', 'sky'), // 🧭 Contextual vendor selection (navigating the market)
  ops_013: pi('monitor', 'sky'), // 🖥️ Set up device management (the managed fleet)
  ops_014: pi('skyline', 'sky'), // 🏙️ Lease an office (the building downtown)
  // Software making (violet)
  sw_001: pi('ship', 'violet'), // 🚢 Ship a feature (ship it!)
  sw_002: pi('tag', 'violet'), // 🏷️ Cut a release (tag it)
  sw_010: pi('robot', 'violet'), // 🤖 Make the repo agent-ready
  sw_011: pi('code-check', 'violet'), // 🕵 Set up AI code review (canonical: CodeRabbit)
  prod_002: pi('cycle', 'violet'), // 🔄 Set up CI/CD
  prod_004: pi('siren', 'violet'), // 🚨 Set up error tracking (canonical: Sentry)
  // Product (sky)
  prod_001: pi('cloud', 'sky'), // ☁️ Set up cloud infrastructure (canonical: AWS)
  prod_003: pi('link', 'sky'), // 🔗 Set up custom domain
  prod_005: pi('funnel', 'sky'), // 🦔 Set up product analytics (canonical: PostHog)
  prod_006: pi('git-branch', 'sky'), // 🐙 Set up a code hosting org (canonical: GitHub)
  opp_009: pi('ticket', 'sky'), // 🎫 Create an issue from a task (same concept as ops_002)
  scale_009: pi('pager', 'sky'), // 📟 On-call & incidents (the pager)
  scale_010: pi('warehouse', 'sky'), // 🏭 Data warehouse & BI (the warehouse)
  prod_010: pi('extinguisher', 'sky'), // 🧯 Run an incident postmortem (after the fire is out)
  prod_011: pi('status-dot', 'sky'), // 🟢 Publish a status page & SLA (the uptime dot)
  prod_012: pi('phone', 'sky'), // 📱 Launch in the app stores
  // Sales (orange)
  sales_001: pi('contact-card', 'orange'), // 📇 Set up a CRM (canonical: HubSpot — rolodex)
  sales_002: pi('receipt', 'orange'), // 🧾 Send an invoice (canonical: Stripe)
  // Growth (fuchsia)
  growth_001: pi('repeat', 'fuchsia'), // 🔁 Set up subscription billing (canonical: Stripe)
  growth_002: pi('lifebuoy', 'fuchsia'), // 🛟 Churn save attempt (save the customer)
  growth_003: pi('megaphone', 'fuchsia'), // 📣 Set up email marketing (canonical: Mailchimp)
  growth_004: pi('headset', 'fuchsia'), // 🗨️ Set up customer support (canonical: Intercom)
  growth_005: pi('envelope-bolt', 'fuchsia'), // 📧 Set up transactional email (canonical: SendGrid)
  opp_003: pi('repeat', 'fuchsia'), // 🔁 Create a subscription product (same concept as growth_001)
  site_001: pi('wand', 'fuchsia'), // 🪄 Generate a website
  growth_010: pi('rocket', 'fuchsia'), // 🚀 Launch on Product Hunt & directories
  growth_011: pi('search', 'fuchsia'), // 🔎 SEO & content engine (search is the magnifier site-wide)
  growth_012: pi('paper-plane', 'fuchsia'), // 🛫 Outbound sales sequences (departures)
  growth_013: pi('gift', 'fuchsia'), // 🎁 Referral program (the reward)
  growth_014: pi('coin', 'fuchsia'), // 🪙 Roll out a pricing change (the coin flips)
  growth_015: pi('boomerang', 'fuchsia'), // 🪃 Run a win-back campaign (they come back)
  // Situations (founder 2026-10-01: reactive, trigger-driven records). The hue stays the
  // DOMAIN family's — a legal situation reads as legal (amber), a people situation as people
  // (orange) — so a situation sits recognizably inside its discipline while the 'Situations'
  // area groups them.
  sit_001: pi('stop', 'amber'), // 🛑 Respond to a cease-and-desist (the letter says stop)
  sit_002: pi('hourglass', 'orange'), // ⏳ Unstick a delayed US visa (the wait is the problem)
  sit_003: pi('shield-crack', 'sky'), // 🛡 Respond to a data breach (the shield, breached)
  sit_004: pi('envelope-alert', 'sky'), // 📨 Answer an IRS or state tax notice (the letter with the !)
  sit_005: pi('snowflake', 'emerald'), // ❄️ Frozen bank account / bank failure (the money, frozen)
  sit_006: pi('card-return', 'emerald'), // 💳 Chargeback or fraud spike (the charge pulled back)
  sit_007: pi('split', 'orange'), // 🔱 Co-founder departure (the paths diverge)
  sit_008: pi('gavel', 'amber'), // 🔨 Respond to a lawsuit (the court's instrument)
  sit_009: pi('envelope-alert', 'amber'), // 📨 Trademark office action (the examiner's letter — notice-letter concept, legal hue)
  sit_010: pi('clock-alert', 'sky'), // ⏰ DE franchise tax delinquency (the overdue clock)
  sit_011: pi('storm', 'sky'), // ⛈ DDoS attack or major outage (the storm hits the cloud)
  sit_012: pi('unplug', 'sky'), // 🔌 Migrate off a shutting-down vendor (the plug pulled)
  // Wave 3 (founder boost 2026-10-02) — same rule: domain hue, situation grouped by kind.
  sit_013: pi('unplug', 'emerald'), // 🔌 Processor account termination (the same pulled-plug concept as sit_012, money hue — the processor pulls YOURS)
  sit_014: pi('eye', 'sky'), // 👁 Security-vulnerability report (someone saw through the shield)
  sit_015: pi('padlock', 'sky'), // 🔒 Data-subject access request (privacy is the lock site-wide)
  sit_016: pi('phone', 'sky'), // 📱 App-store rejection/removal (the app-stores concept, interrupted)
  sit_017: pi('megaphone', 'fuchsia'), // 📣 Ad/platform account suspension (the marketing megaphone, muted)
  sit_018: pi('key', 'sky'), // 🔑 Domain or social account hijacked (the access-keys concept — stolen, then retaken)
  sit_019: pi('person-out', 'orange'), // 👋 Key employee resigns (the same offboarding concept as hr_005)
  sit_020: pi('chart-down', 'emerald'), // 📉 Term sheet pulled (the runway chart is suddenly the whole story)
  sit_021: pi('hard-hat', 'orange'), // 👷 Workplace injury (the safety hat — worn too late)
  sit_022: pi('envelope-alert', 'orange'), // 📨 Harassment complaint (the notice-letter concept, people hue)
}

export function processIcon(taskId: string): string {
  return PROCESS_ICONS[taskId] ?? ''
}

// ---------- Curated end-to-end playbooks (chains) ----------
// Hue = the area the playbook orbits; glyphs reuse process concepts where the chain shares one.

export const CHAIN_ICONS: Record<string, string> = {
  'name-the-company': pi('bulb', 'amber'), // 💡 the idea — validated (startup_001), then named (brand_001)
  'company-launch': pi('rocket', 'emerald'), // 🚀
  'set-up-the-office-stack': pi('building', 'sky'), // 🏢 same concept as ops_004 (the office)
  'raise-a-seed-round': pi('sprout', 'emerald'), // 🌱 same concept as fund_001 (the seed)
  'ship-v1': pi('ship', 'violet'), // 🚢 same concept as sw_001 (ship it)
  'mcp-native-stack': pi('plug', 'sky'), // 🔌 same concept as vendor_010 (the MCP connection)
  'launch-website': pi('globe', 'sky'), // 🌐
  'launch-on-product-hunt': pi('cat', 'fuchsia'), // 😺 the Product Hunt cat
  'ship-it-right': pi('ship', 'violet'), // 🛳️ the shipping lane — sw_001's ship run as a discipline
  'get-first-10-customers': pi('magnet', 'fuchsia'), // 🧲 pull the first customers in
  'get-paid': pi('banknote', 'emerald'), // 🤑
  'price-and-monetize': pi('coin', 'fuchsia'), // 🪙 same concept as growth_014 (the coin flips)
  'run-support-and-keep-customers': pi('lifebuoy', 'fuchsia'), // 🛟 same concept as growth_002
  'first-hire': pi('handshake', 'orange'), // 🤝
  'build-the-team': pi('people', 'orange'), // 👥 the team, plural — beyond first-hire's handshake
  'go-global': pi('world', 'orange'), // 🌍 same concept as hr_003 (work across the globe)
  'month-end-close': pi('ledger', 'emerald'), // 📒
  'agent-run-back-office': pi('mech-arm', 'emerald'), // 🦾 the mechanical arm — agents run the money loop
  'board-and-governance-rhythm': pi('tie', 'emerald'), // 👔 same concept as scale_005 (the boardroom)
  'tax-season': pi('calendar', 'sky'), // 📆 same concept as qs_047 (the annual-filing calendar)
  'set-up-compliance': pi('shield-check', 'sky'), // 🛡️ same concept as comp_001 (SOC 2 shield)
  'land-the-enterprise-deal': pi('castle', 'orange'), // 🏰 the enterprise castle, finally opened
  'go-fundraise-follow-on': pi('coin-stack', 'emerald'), // 💰 same concept as the fundraising phase
  'launch-a-vc-fund': pi('unicorn', 'violet'), // 🦄 same concept as the vc phase
}

export function chainIcon(chainId: string): string {
  return CHAIN_ICONS[chainId] ?? ''
}
