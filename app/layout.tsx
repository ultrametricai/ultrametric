import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import AccountMenu from "@/components/AccountMenu";
import LogoWordmark from "@/components/fx/LogoWordmark";
import { FooterAttractor } from "@/components/fx/lazy";
import InstallBanner from "@/components/InstallBanner";
import InstallNavAction from "@/components/InstallNavAction";
import InstantTooltip from "@/components/InstantTooltip";
import ArenaMenu, { type ArenaMenuItem } from "@/components/ArenaMenu";
import MobileNav from "@/components/MobileNav";
import { OBJECTS_ITEMS, OBJECTS_LABEL } from "@/components/ObjectsNav";
import PostHogInit from "@/components/PostHogInit";
import { GLOBAL_RANKINGS, PROCESS_RANKINGS } from "@/components/RankingsNav";
import { loadArenaSections } from "@/lib/arenaSections";
import CommandPalette from "@/components/CommandPalette";
import GeoMark from "@/components/GeoMark";
import HeaderGeoControl from "@/components/HeaderGeoControl";
import { loadCategories } from "@/lib/data";
import { arenaIcon, EXPLORE_SECTION_ICONS, OVERALL_ICON } from "@/lib/arenaIcons";
import { loadIcpTypes } from "@/lib/icp";
import { DOCS_URL, REPO, SITE_URL } from "@/lib/site";

// Short labels used inside the Rankings dropdown (the arenas) alongside full names.
const NAV_LABELS: Record<string, string> = {
  "desktop-os": "OS",
  "startup-banking": "Banking",
  "project-management": "PM",
  "web-scraping": "Scraping",
  "mobile-dev": "Mobile AI dev",
  "code-hosting": "Git",
  "ai-coding": "AI",
  "edge-platforms": "Edge",
  "frontend-frameworks": "Frontend",
  "local-llm-runtimes": "Local LLM",
  "payroll": "Payroll",
  "mobile-payments": "POS",
  "payments": "Payments",
  "billing-subscriptions": "Billing",
  "fraud-prevention": "Fraud",
  "card-issuing": "Issuing",
  "tax-automation": "Tax",
  "banking-as-a-service": "BaaS",
  "marketplace-payments": "Payfac",
  "identity-verification": "KYC",
  "banking-data-apis": "Bank Data",
  "stablecoin-payments": "Stablecoins",
  "accounting": "Accounting",
  "security-scanners": "Security",
  "infra-as-code": "IaC",
  "vibe-coding": "Vibe coding",
  "model-gateways": "Gateways",
  "llm-evals-observability": "LLM Evals",
  "ai-search-apis": "AI Search",
  "agent-frameworks": "Agent SDKs",
  "agent-sandboxes": "Sandboxes",
  "product-analytics": "Analytics",
  "crm": "CRM",
  "terminals": "Terminals",
  "legal-ops": "Legal",
  "robotics-platforms": "Robotics",
  "package-managers": "Pkg managers",
  "vector-databases": "Vector DBs",
  "inference-providers": "Inference",
  "auth-platforms": "Auth",
  "workflow-automation": "Workflows",
  "observability": "Observability",
  "error-tracking": "Errors",
  "expense-management": "Expenses",
  "mcp-infrastructure": "MCP infra",
  "browser-agents": "Browser agents",
  "ai-memory": "Memory",
  "voice-agents": "Voice",
  "notes-knowledge": "Notes",
  "meeting-ai": "Meetings",
  "gpu-clouds": "GPU clouds",
  "feature-flags": "Flags",
  "serverless-databases": "Databases",
  "search-infra": "Search",
  "scheduling": "Scheduling",
  "design-tools": "Design",
  "agent-skills": "Skills",
  "data-warehouses": "Warehouses",
  "email": "Email",
  "email-apis": "Email APIs",
  "virtual-mailboxes": "Virtual mail",
  "incident-management": "Incidents",
  "docs-platforms": "Docs",
  "data-pipelines": "Pipelines",
  "ecommerce-platforms": "E-commerce",
  "customer-data-platforms": "CDPs",
  "durable-workflows": "Durable exec",
  "ai-support-agents": "Support AI",
  "ai-code-review": "Code review",
  "document-extraction": "Doc extraction",
  "equity-management": "Equity",
  "agentic-commerce": "Agent commerce",
  "processors": "CPUs",
  "gpus": "GPUs",
  "security-keys": "Security keys",
  "authenticator-apps": "2FA apps",
  "game-engines": "Game engines",
  "self-hosted-assistants": "Self-hosted AI",
  "email-marketing": "Email Mktg",
  "frontier-models": "Frontier models",
  "compliance-automation": "Compliance",
  "applicant-tracking": "ATS",
  "domain-registrars": "Registrars",
  "sso-identity": "SSO / IdP",
  "cloud-storage": "Cloud storage",
  "cloud-platforms": "Clouds",
  "startup-law-firms": "Law firms",
  "startup-immigration": "Immigration",
  "government-services": "Gov services",
};

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-WWC2ZJRDCB";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: {
    types: { "application/rss+xml": `${SITE_URL}/feed.xml` },
  },
  title: "Ultrametric",
  description:
    "Automation for the startup — step-by-step founder processes your agent can run, agent-tested tool rankings, open startup logic, and a simulator that runs a company's first year.",
  openGraph: {
    title: "Ultrametric",
    description: "Automation for the startup: agent-runnable founder processes, agent-tested tool rankings, and the open startup repo.",
    url: SITE_URL,
    siteName: "Ultrametric",
    type: "website",
    images: [{ url: `${SITE_URL}/og5.png`, width: 1200, height: 630, alt: "Ultrametric — open rankings for the AI era" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ultrametric",
    description: "Automation for the startup: agent-runnable founder processes, agent-tested tool rankings, and the open startup repo.",
    images: [`${SITE_URL}/og5.png`],
  },
};

// Site-level structured data: tells crawlers what this site is and who publishes it. Per-page
// ItemList/Product JSON-LD lives on the arena/product/vs pages; this is the umbrella node.
const SITE_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Ultrametric",
  url: SITE_URL,
  description:
    "The unbiased, evidence-based rankings for software in the AI era. Products judged on real user stories with a citation behind every verdict.",
  publisher: { "@type": "Organization", name: "Ultrametric", url: "https://ultrametric.ai" },
});

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const categories = loadCategories();
  const icpTypes = loadIcpTypes();
  // The Rankings dropdown's curated sections (data/arena-sections.json): every arena appears in
  // exactly one section (enforced by lib/__tests__/arenaSections.test.ts), so grouping is a pure
  // regrouping of `categories` — nothing is added or lost.
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  // The Overall (all-products) rankings view leads the Rankings dropdown (founder 2026-09-29) —
  // it's the cross-arena leaderboard the per-arena entries below drill into.
  const arenaMenuSections = [
    { name: "", items: [{ id: "overall", name: "Overall — every product ranked", label: "all rankings", icon: OVERALL_ICON, href: "/overall" }] },
    ...loadArenaSections().map((section) => ({
    name: section.name,
    items: section.arenaIds.flatMap((id): ArenaMenuItem[] => {
      const c = categoryById.get(id);
      return c
        ? [{ id: c.id, name: c.name, label: NAV_LABELS[c.id] ?? "", icon: arenaIcon(c.id) }]
        : [];
    }),
    })),
  ];
  // The ⌘K palette index is NOT built or passed here anymore: as client-component props it was
  // serialized into every prerendered page (~160 KB × ~4 artifacts × ~7k pages ≈ 4.5 GB of
  // .next/server/app, and 160 KB of every page's wire HTML — docs/BUILD-SIZE.md problem 2).
  // It is now built once by the force-static /search-index.json route (lib/search-entries.ts)
  // and fetched by CommandPalette on first open.

  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@700,900&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100 antialiased">
        {/* PostHog analytics (founder 2026-09-23, company account) — no-ops unless
            NEXT_PUBLIC_POSTHOG_KEY is set at build time; see components/PostHogInit.tsx. */}
        <PostHogInit />
        {/* Keyboard/screen-reader escape hatch: the header carries ~30 tab stops (two dropdown
            menus, tool links, search) on every page. Visually hidden until focused. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:border focus:border-emerald-400/60 focus:bg-zinc-950 focus:px-4 focus:py-2 focus:text-sm focus:text-emerald-300"
        >
          Skip to content
        </a>
        <header className="border-b border-zinc-800">
          {/* ONE line at every width (founder bug 2026-10-08: the mobile bar wrapped to double
              height and the wrapped-left ☰ pushed its right-anchored panel off-screen). The row
              carries NO wrapping classes: flex-nowrap at all widths, and below sm every member
              is compact — the wordmark's first-glyph mark (LogoWordmark), icon-only search
              (CommandPalette), the icon-only GitHub mark, ☰, and the account links. */}
          <div className="mx-auto flex max-w-7xl flex-nowrap items-center justify-between gap-x-3 px-3 py-3 sm:gap-x-4 sm:px-5 sm:py-4">
            <div className="flex shrink-0 items-center gap-2">
              {/* One top-bar standard sitewide (founder 2026-09-29): the landing's wordmark SVG
                  leads the product bar too, so ultrametric.ai/ and the product pages share the
                  same header. Links home (the landing). Carries the landing nav's restored
                  hover effect — Julia-set canvas + shine sweep masked to the letterforms
                  (components/fx/LogoWordmark.tsx), identical on every page. */}
              <LogoWordmark />
            </div>
            {/* Primary IA: Rankings (the arenas — the product; label renamed from Arenas,
                founder 2026-10-07), Objects (the object registries: Situations, Artifacts,
                Open documents — founder 2026-10-08), Explore (every secondary view: global
                leaderboards, buyer lenses, methodology/pipeline/proofs/MCP), then the tools,
                GitHub, and search. One menu for all secondary destinations instead of the old
                Rankings + Lenses dropdowns + a Methodology link. */}
            <nav className="flex flex-nowrap items-center gap-2 text-sm text-zinc-400 sm:flex-wrap sm:gap-6">
              {/* Founder 2026-09-29: Virtual Startup leads the nav, LEFT of the Rankings menu.
                  Founder 2026-09-23: it sits LEFT of Processes. Founder 2026-09-24: the dropdowns
                  and buttons are desktop-only — mobile gets the ☰ MobileNav. */}
              <Link
                href="/startup-sim"
                className="hidden shrink-0 items-center gap-1.5 text-sm text-zinc-300 transition hover:text-emerald-300 sm:flex"
              >
                Open Startup Sim
              </Link>
              <span className="hidden sm:block">
                <ArenaMenu sections={arenaMenuSections} searchable />
              </span>
              <Link
                href="/processes"
                className="hidden shrink-0 items-center gap-1.5 text-sm text-zinc-300 transition hover:text-emerald-300 sm:flex"
              >
                Processes
              </Link>
              {/* Objects (founder 2026-10-08): one dropdown for the object registries —
                  Situations (which gave up its 2026-10-02 top-level slot to this menu),
                  Artifacts, and Open documents. Same ArenaMenu idiom as Rankings/Explore, so
                  the trigger weight and the open/close behavior match; the item list and the
                  label are the single source in components/ObjectsNav.ts, mirrored by the ☰
                  panel's labeled group. */}
              <span className="hidden sm:block">
                <ArenaMenu title={OBJECTS_LABEL} items={OBJECTS_ITEMS} />
              </span>
              {/* Technologies moved back under Explore → More views (founder 2026-09-29,
                  reversing the 2026-09-24 top-level entry). */}
              {/* geo: every Explore destination wears its deterministic concept mark
                  (components/GeoMark.tsx), the same mark it wears on its own page header. */}
              {/* Founder 2026-09-21: the ranking entries come in TWO labeled groups so it's
                  never ambiguous what is a company ranking and what is a process ranking. Both
                  lists are the single sources of truth in components/RankingsNav.tsx — the
                  header menu, the /rankings/* cross-link footer, and each page's GeoMark all
                  derive from them. Groups say "leaderboards" since the Arenas menu became
                  Rankings (founder 2026-10-07) — two "rankings" labels in one header were
                  ambiguous; see components/RankingsNav.tsx GROUPS. */}
              <span className="hidden sm:block">
              <ArenaMenu
                title="Explore"
                geo
                sections={[
                  {
                    // House glyphs instead of the old 🏢/🔁 emoji (founder 2026-10-01: apply
                    // the custom icon set to the top-bar menus).
                    name: "Company leaderboards",
                    icon: EXPLORE_SECTION_ICONS.companyRankings,
                    items: GLOBAL_RANKINGS.map((r) => ({ id: r.id, name: r.name, label: "companies", href: r.href })),
                  },
                  {
                    name: "Process leaderboards",
                    icon: EXPLORE_SECTION_ICONS.processRankings,
                    items: PROCESS_RANKINGS.map((r) => ({ id: r.id, name: r.name, label: "processes", href: r.href })),
                  },
                  {
                    name: "More views",
                    items: [
                      { id: "global", name: "Capability adoption", label: "stats", href: "/global" },
                      { id: "technologies", name: "Technologies (control surfaces)", label: "stats", href: "/technologies" },
                      { id: "missing", name: "Missing startups", label: "gaps", href: "/missing" },
                      { id: "operating-rhythm", name: "Operating rhythm", label: "processes", href: "/processes/operating-rhythm" },
                      { id: "icp", name: `ICP lenses (${icpTypes.length})`, label: "lenses", href: "/icp" },
                      { id: "yc", name: "YC batches", label: "ranking", href: "/yc" },
                      { id: "integrations", name: "Integration graph", label: "graph", href: "/integrations" },
                      { id: "stacks", name: "Stacks", label: "tool", href: "/stacks" },
                      { id: "compare", name: "Compare", label: "tool", href: "/compare" },
                      { id: "my-stack", name: "My Stack", label: "tool", href: "/my-stack" },
                      { id: "stack-battle", name: "Battle of the stacks", label: "tool", href: "/stacks/battle" },
                      { id: "predictions", name: "Predictions", label: "forecasts", href: "/predictions" },
                      { id: "reports", name: "Weekly reports", label: "history", href: "/reports" },
                      { id: "methodology", name: "Methodology", label: "docs", href: "/methodology" },
                      { id: "pipeline", name: "Testing pipeline", label: "docs", href: "/pipeline" },
                      { id: "proofs", name: "Recorded proofs", label: "docs", href: "/proofs" },
                      { id: "certified", name: "Certified Agent-Ready", label: "program", href: "/certified" },
                    ],
                  },
                ]}
              />
              </span>
              {/* The three tools + the power view each wear their GeoMark (same seed as their
                  page headers/sections), hidden on the smallest screens to keep the row tight. */}
              {/* /everything is deliberately unlisted (founder call: "don't show the everything
                  page") — the route stays alive so old links don't 404, but nothing links to it. */}
              <InstallNavAction />
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden shrink-0 items-center text-sm text-zinc-300 transition hover:text-emerald-300 sm:flex"
              >
                Docs
              </a>
              {/* Icon-only chip (founder 2026-10-08: drop the word "GitHub" — the mark alone;
                  supersedes the 2026-10-04 label-only form, which itself dropped the star
                  count). The accessible name survives as the aria-label, same destination. */}
              <a
                href={`https://github.com/${REPO}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ultrametric on GitHub"
                className="hidden shrink-0 items-center rounded-lg border border-zinc-800 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-emerald-400/60 hover:text-emerald-300 sm:flex"
              >
                <svg viewBox="0 0 16 16" width={14} height={14} fill="currentColor" aria-hidden>
                  <path
                    fillRule="evenodd"
                    d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
                  />
                </svg>
              </a>
              {/* Mobile repo mark (founder 2026-10-01: "the GitHub icon is missing top-right on
                  mobile") — the star chip above is desktop-only (hidden sm:flex), so below sm a
                  compact icon-only mark keeps the repo one tap away without crowding the
                  ☰/search/account cluster: no border chip, no star count, just the mark. */}
              <a
                href={`https://github.com/${REPO}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ultrametric on GitHub"
                className="flex shrink-0 items-center p-1 text-zinc-300 transition hover:text-emerald-300 sm:hidden"
              >
                <svg viewBox="0 0 16 16" width={18} height={18} fill="currentColor" aria-hidden>
                  <path
                    fillRule="evenodd"
                    d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
                  />
                </svg>
              </a>
              {/* THE sitewide country control (founder 2026-10-07: "move this into the top bar
                  so the user can set their country or default to global, then we don't need it
                  per page") — compact flag-or-globe trigger at nav weight, next to the ⌘K/
                  account cluster. Desktop-only here; the MobileNav panel carries the same
                  control below sm. Reads/writes the one ?geo=/pa-geo preference
                  (lib/geoPreference.ts); 🌐 Global framing server-rendered, so the US-default
                  static HTML stays byte-identical. */}
              <span className="hidden sm:block">
                <HeaderGeoControl />
              </span>
              <CommandPalette />
              <MobileNav />
              {/* Account corner (components/AccountMenu.tsx): a quiet "Log in" link for
                  anonymous readers, an initial chip (menu: Watchlist + Log out) once a WorkOS
                  session exists. The Watchlist link lives inside the chip menu, so the header
                  is unchanged for logged-out readers. */}
              <AccountMenu />
            </nav>
          </div>
        </header>
        {/* w-full + min-w-0: body is a column flex container, so without min-w-0 this flex
            item's automatic minimum width tracks its content's min-content width — wide tables
            inside overflow-x-auto wrappers would push the whole page wider than the viewport
            on phones instead of scrolling inside their wrapper. The landing homepage
            (app/home) breaks out of this box full-bleed with a w-screen wrapper — the
            scrollbar-gutter overflow that 100vw implies is clipped at the viewport by the
            html { overflow-x: clip } rule in globals.css (clipping here on main would cut the
            full-bleed hero at the 7xl box on wide screens). */}
        <main id="main" className="mx-auto w-full min-w-0 max-w-7xl px-5 py-10">{children}</main>
        {/* Sitewide install banner (founder 2026-09-29): the /v2 bottom module — the CLI/MCP
            product's three install methods — closes every content page, above the footer. */}
        <InstallBanner />
        {/* Sitewide footer — the landing site's footer, ported here as THE standard footer
            (founder 2026-09-29: one footer sitewide, like the top bar). Structure/copy follow
            the landing: wordmark + tagline, © + the made-from icons, and the landing link row
(𝕏 / Privacy / Terms → /tos; Company processes/Foreloop/Rankings dropped 2026-09-29). Per
            founder: no RSS link, no /changelog link. The landing's strange-attractor canvas is
            RESTORED (founder 2026-09-29: "the homepage has lost its animations") — it plots over
            the graph-paper grid exactly as on the landing (components/fx/FooterAttractorCanvas
            .tsx, lazily mounted client-only). The copyright/icon popup animations stay dropped. */}
        <footer className="relative border-t border-zinc-800 py-16 sm:py-24">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                'linear-gradient(90deg, rgb(161 161 170) 1px, transparent 1px), linear-gradient(0deg, rgb(161 161 170) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              WebkitMaskImage: 'radial-gradient(34% 70% at 50% 52%, black, transparent)',
              maskImage: 'radial-gradient(34% 70% at 50% 52%, black, transparent)',
            }}
            aria-hidden
          />
          {/* The attractor canvas plots over the grid; the top fade (as on the landing) keeps
              the point cloud from butting against the footer's border-t. */}
          <FooterAttractor />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-zinc-950 to-transparent" aria-hidden />
          <div className="relative z-10 mx-auto max-w-7xl px-5">
            <div className="mb-8">
              {/* eslint-disable-next-line @next/next/no-img-element -- static svg wordmark */}
              <img src="/ultrametric-wordmark.svg" alt="Ultrametric logo" className="h-4 w-auto" loading="lazy" />
              <p className="mt-1 text-sm text-zinc-500">Applied intelligence for companies and beyond.</p>
            </div>
            <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
              <div className="flex flex-col gap-1 text-sm text-zinc-500">
                <div className="flex flex-wrap items-center gap-1">
                  <span>© 2026 Ultrametric.</span>
                  {/* The "Made from <city icons>" sign-off removed (founder 2026-10-02). */}
                </div>
                {/* One muted disclaimer line sitewide, nothing louder (founder liability pass
                    2026-10-02); the full exclusions live at /terms, which this links. */}
                <p className="text-xs text-zinc-500">
                  Research content — not legal, tax, or financial advice. See{' '}
                  <Link href="/terms" className="underline decoration-zinc-800 transition-colors hover:text-zinc-400">
                    terms
                  </Link>
                  .
                </p>
              </div>
              {/* flex-wrap: at narrow widths (375px) an unwrapped link row is wider than the
                  viewport and becomes the page's only source of horizontal scroll. */}
              <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-zinc-500">
                <a
                  href="https://x.com/ultrametricai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-zinc-300"
                >
                  𝕏
                </a>
                <a
                  href="https://discord.com/invite/3aHky836qP"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-zinc-300"
                >
                  Discord
                </a>
                {/* The open startup repo (founder 2026-09-30): GitHub mark + label in the
                    footer link row, same destination as the header's star chip. */}
                <a
                  href={`https://github.com/${REPO}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 transition-colors hover:text-zinc-300"
                >
                  <svg viewBox="0 0 16 16" width={14} height={14} fill="currentColor" aria-hidden>
                    <path
                      fillRule="evenodd"
                      d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
                    />
                  </svg>
                  GitHub ↗
                </a>
                <Link href="/about" className="transition-colors hover:text-zinc-300">
                  About
                </Link>
                <a
                  href={DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-zinc-300"
                >
                  Docs
                </a>
                <Link href="/privacy" className="transition-colors hover:text-zinc-300">
                  Privacy
                </Link>
                <Link href="/tos" className="transition-colors hover:text-zinc-300">
                  Terms
                </Link>
              </div>
            </div>
          </div>
        </footer>
        <InstantTooltip />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: SITE_JSONLD }} />
        {GA_ID && (
          // Google Analytics 4 — the site-wide ultrametric.ai property (G-WWC2ZJRDCB);
          // NEXT_PUBLIC_GA_ID overrides if this app ever gets its own property.
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config','${GA_ID}');`,
              }}
            />
          </>
        )}
        {process.env.NEXT_PUBLIC_CF_BEACON_TOKEN && (
          // Cloudflare Web Analytics — cookieless, only rendered once the beacon token env var
          // is set (create one in the Cloudflare dash → Web Analytics, then add the env to
          // Vercel and redeploy). Until then this is inert.
          <script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: process.env.NEXT_PUBLIC_CF_BEACON_TOKEN })}
          />
        )}
      </body>
    </html>
  );
}
