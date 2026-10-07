# Founder asks — running tracker

Every founder request gets a row when made and a status update when merged+deployed.
Statuses: `open` · `in-lane (<topic>)` · `shipped YYYY-MM-DD` · `blocked (<on what>)`.
The orchestrator updates this file at every merge; anything `open` for >1 session is a bug.

## Open / in flight (2026-09-14)

| Ask | Status |
|---|---|
| Test the untested — the IRS as a vendor: government rails judged as an arena (overrides the dossier's no-arena recommendation) | in-lane (government-services) 2026-10-05 — 9 agencies (IRS, EFTPS, USCIS, USPTO, SAM.gov, DE DOC, CA SOS, NY DOS, TX SOS — TX from its published www pages only, robots on the filing host bans AI agents by name and is respected); Nevada excluded (bot-walled end to end), FinCEN BOI excluded (US-company obligation removed 2025/2026 rules), DOL FLAG excluded (wage data only; employer visa work lives in startup-immigration); keyless public pages only, no logins, no CAPTCHA interaction, no filings; evidence foundation docs/vendor-research/government-services-agenticness.md; Phase 2 GO 2026-10-07 (docs/vendor-research/government-agenticness-world.md §5) — +31 agencies to 40: six countries × four matched areas (UK/IN/DE/FR/PT/CA company registry, tax, IP office, immigration) + 7 US state registries spanning best-rail-to-most-closed (CO/FL/WA/NJ/OH/MN/VA; VA judged from its recorded robots walls alone, scoring near zero by design); 2 new stories (sandbox-available, foreign-founder-usable) judged across all 40; country/area product tags feed derived rollups (rollups.json, recompute-checked) and the arena page's country-rankings section — country overall = mean over the matched areas' judged agencies, per-area cross-country boards included |
| Startup-visa lawyer firms + visa-focused companies arena, especially YC cos, with a deeper YC-batch agentic-claims analysis | in-lane (startup-immigration) 2026-10-02 — 11 vendors (5 productized: Alma, Lighthouse, Casium, Plymouth Street, Deel Immigration ex-Legalpad; 6 firm-side incl. Founder Law ex-Alcorn, Siskind Susser, Green and Spiegel; YC by domain: Deel W19, LegalOS W26); Manifest Law excluded (bot-wall 403, iPostal1 precedent), Gale (YC W25) excluded (own llms.txt links all 404, one-page corpus); 25 manual stories across visa-strategy/petition-execution/timelines-fees/platform-experience; YC agentic-claims sweep shipped at docs/vendor-research/yc-agentic-claims.md (W24→F26: 417/1,941 = 21.5% claim agentic; ranked next-vendors list) |
| Startup lawyers arena with per-country rankings, Cooley to VLP for the US, rankings for IP issues | in-lane (startup-law-firms) 2026-09-30 — 15 firms (US 8 incl. Cooley+VLP; UK/DE/FR/IN via Bird & Bird, Osborne Clarke, YPOG, Gide, CAM, CMS IndusLaw, Trilegal); Wilson Sonsini + Taylor Wessing excluded (bot-wall keyless crawlers, iPostal1 precedent); 27 manual stories incl. 5-story ip-protection theme + ip-focused ICP lens; 74 vendor-geo rows; honest agent-readiness lows stand |
| Supabase in developer databases, compared against neon | in-lane (supabase-serverless-databases) 2026-09-23 — second arena membership for the canonical supabase product (gmail-in-email pattern), judged on all 56 serverless-databases stories: #2 aiEra 50.1 vs neon #1 56.1 (agentReady 63.2 vs 82.2); /vs/supabase-vs-neon and CompareRivals rows come from rankings.json automatically, nothing hand-built; 61 evidence items (45 docs + 8 community + 5 keyless probes + 3 recorded runtime probes), one spike (+19 llms.txt URLs), churn settled (5 evidence-driven flips kept, 13 reverted), na-harmonize flipped clickhouse+planetscale privacy-no-training na→none (neon holds partial) |
| Improvement run 1: mini horizontal DAG preview in "Who covers this process best" | in-lane (process-ux) |
| Improvement run 2: don't show the step's top vendor twice (canonical chip hides when it's #1 in the ranked row) | in-flight (orchestrator) |
| Improvement run 3: per-vendor evidence for "ranked for this step" — visible receipts per chip | in-lane (process-ux) |
| Improvement run 4: remove "The market options" section from process pages | in-flight (orchestrator) |
| Improvement run 5: remove "honestly/honest" wording from UI copy | in-flight (orchestrator) |
| Improvement run 6a: /stacks "editorial" label → "AI judgement" | in-flight (orchestrator) |
| Improvement run 6b: full-site evidence-driven review + repo currency check | queued |
| Improvement run 7: Pulley (retired) still appears in some tables (e.g. homepage processes view) — exclude from active tables | in-flight (orchestrator) |
| Improvement run 8: arena descriptions — one line each, rewritten/truncated, full width | shipped 2026-09-23 (93/93 rewritten, max 107 chars, supplier-neutral) |
| Improvement run 9: /account split — Account + My vendors as separate pages with a standard left sidebar | shipped 2026-09-23 (/account + /account/vendors + AccountNav sidebar) |
| API-score pill makes the header's API ✓ glyph redundant — drop the glyph when the score renders | shipped 2026-09-23 |
| Homepage tagline → "Open rankings for the AI era" (h1 + OG card og4.png + alt text) | shipped 2026-09-23 |
| Homepage title moves ABOVE the Companies\|Processes tabs | shipped 2026-09-23 |
| Homepage 'Products' as 3rd mode tab, replacing the include-all-products checkbox (legacy ?all=1 honored) | shipped 2026-09-23 |
| Evidence column at the end of the rankings tables (homepage mega-table + arena tables) → /score receipt | shipped 2026-09-23 |
| Supabase into serverless-databases (developer databases), judged vs neon | shipped 2026-09-23 — neon honestly #1 (56.1 vs 50.1, bands non-overlapping); /vs/neon-vs-supabase live |
| Grok (xAI) missing from frontier-models | shipped 2026-09-23 — judged #2 (40.2 ±4.9 vs claude 40.8, dead heat inside bands); best apiQuality in arena |
| /processes route-dots legend ("coloring is just not known by the user") | shipped 2026-09-23 |
| End-to-end playbooks rows clickable (whole-row link) | shipped 2026-09-23 |
| Playbooks review — "super super good and well figured out" | shipped 2026-09-23 (3 new chains: name-the-company, tax-season, land-the-enterprise-deal; 7 recomposed; route strip on chain pages) |
| Arenas button LEFT of Processes in the top nav | shipped 2026-09-23 |
| Rank-by presets on the same line as the filter | shipped 2026-09-23 |
| Vendor-page spike-depth flag (deep/surface, evidence-count-grounded, rule in tooltip) | shipped 2026-09-23 |
| VC processes area (fund formation → close → capital calls → fees → book investment) | shipped 2026-09-23 — vc_001/002/003 + launch-a-vc-fund playbook, corpus 122 processes, phase ceiling 45% |
| Homepage arena-card logos too bunched — spacing opened up | shipped 2026-09-23 |
| /ops access for any verified *@ultrametric.ai sign-in (WorkOS code = verification) | shipped 2026-09-23 |
| Grouped-arenas pages with UI into individual arenas (/arenas/[section]) | shipped-next-deploy 2026-09-23 |
| Main /arenas page — visual navigation of all arenas | shipped-next-deploy 2026-09-23 |
| Deep-table homepage: OSS/YC/MCP quick filters (?oss/?yc/?mcp) shipped; full-width move reverted same day by founder ask | shipped 2026-09-23 |
| Arenas as a homepage tab next to Processes (grid moved out of companies mode) | shipped-next-deploy 2026-09-23 |
| Keep deep-spiking until done | DONE 2026-09-23: never-spiked ZERO (60 products swept) + all 9 thinnest arenas deepened (53 products; id-verification 18→30.5, billing 26→43, banking-as-a-service 21.5→38.5); honest rank moves throughout; GAIA bias correction on 9950X3D |
| Deep spikes on ALL vendors (founder 2026-09-24 "get accurate here") | DONE 2026-09-24 — all 112 surface products spiked across 3 lanes; owner-product bias audits enforced (foreloop 6/9 favorable flips reverted, afk both reverted); hardware rule held (GAIA-class strips ×2) |
| 'Virtual Startup' — simulated startup journey, branching starting decisions, synthetic data, timeline mode | shipped-next-deploy 2026-09-23 — /virtual-startup: 16 decision combos over real chains, seeded synthetic artifacts all SIMULATED-chipped, day timeline from corpus estimates |
| Product-page Access/CLI-docs box info arch — top rail retired, doc chips inline in header secondary row | shipped-next-deploy 2026-09-23 |
| Showcase caption ('docs · captured … · view live') removed — provenance moves to the image tooltip | shipped-next-deploy 2026-09-23 |
| 'All phases' toggle → 'All areas' | shipped-next-deploy 2026-09-23 |
| Remove 'Startup processes, run by agents' heading on the homepage Processes tab | shipped-next-deploy 2026-09-23 |
| Homepage title + mode tabs aligned to the full-width left edge | superseded same-day — founder reverted the full-width table move entirely |
| Depth to 100%: never-spiked sweep A–L + M–Z, thin-arena depth wave (id-verification 18 → up) | in-lane (depth ×3) |
| Private /ops coverage dashboard + vendor-news watcher | shipped 2026-09-23 (needs NEXT_PUBLIC_ADMIN_EMAILS env or pa-admin localStorage to view) |
| Drop the 'commercial' tag on product pages — they're (almost) all commercial | shipped 2026-09-23 |
| 'Technologies' ranking set: abstract control surfaces as 'Control surfaces' | shipped 2026-09-23 — /technologies: 9 canonical surfaces ranked from fleet-wide judged data (API 87.6% top, MCP 64.4% +25 lift, built-in assistant honest −0.7 lift); 'Most mobile/visual' toggles honestly omitted (no fleet-wide judged mobile/visual stories yet) |
| Final-launch gap & depth audit ("find missing gaps, make sure we have the depth") | shipped 2026-09-22 — 5 waves: hygiene (sitemap/llms.txt/region flags/noindex/README); CI green again (side-by-side TS6 lint toolchain + Vercel pnpmfile fix) + judge-JSON flake root-caused + contest #52 answered (gusto 26.8→32.9) + runner artifacts cleared; process completeness (no empty vendor cells, 14 stub DAGs expanded, prompts fleet-wide 654/654 steps); depth burn-down (64 spikes: muse/motion/tilled/sift probes — sift #5→#3, floot #5→#3, honest declines kept; never-spiked 109→54); 4 new arenas (compliance-automation, applicant-tracking, domain-registrars, sso-identity — 38 process steps lit). Fleet: 89 arenas / 553 products / 31,575 verdicts / 119 processes / 933 probes. REMAINING founder clicks: CF AI-bot toggle, WorkOS redirect URI, landing PR #224; decisions: workspace-suites arena (34 steps/31 processes), poke spike + 54 queue entries continue via daily cron |
| Vendor lens: click a vendor on a process/chain → view the DAG via it | shipped 2026-09-21 — lens > stack > default resolution, per-page persistence, "✓ via" pinning, honest "not covered by X" gaps, coverage banner; chains share one lens across sections; SSR byte-identical without a lens |
| Product pages: processes they serve | shipped 2026-09-21 — reverse index (0.2s build, 1496 vendor×process appearances) from the same derivations as the process pages; 188 products gained the table, computer-use-only rows collapsed with counts; "serves N processes →" chip |
| Shareable view URLs (rank-by, processes mode, lens) | shipped 2026-09-21 — ?view / ?rank&dir&arena&all&q / ?order&phase&pq / ?via=arena:product; replaceState, defaults elided, URL wins over device prefs on shared links; personal data never in URLs |
| Explore: process rankings alongside company rankings | shipped 2026-09-21 — 🏢/🔁 labeled groups in the Explore menu + rankings footer; five process ranking pages (most-automatable, best-covered, riskiest, most-annoying, growth-drivers), each naming its exact derivation |
| Human steps: calm coloring + extract legally-required signatures | shipped 2026-09-21 — person steps sky "human or computer use" (red retired everywhere: DAG blocks, verdict box, index dots, legends, simulator); new `legalSignature` flag = the true human floor (13 nodes, violet "✍ signature — legally human", no workarounds/CU chips ever); 7 tasks split prep-vs-signature (bylaws+consent, founder SPAs, 83(b) sign-vs-mail ×2, term sheet, round consents, cap-table consent, notarized 1583, 8879-CORP jurat); mappings/audit/vendor-calls regenerated (155 audited steps) |
| Process pages change for the reader's selected vendor | shipped 2026-09-21 — client-side over the /mine serialization: per-step "✓ yours" chips + upgrade deltas, "you run X" leaderboard banner; static SEO HTML byte-identical for readers without a stack |
| API calls for the other vendors upfront on process steps | shipped 2026-09-21 — data/step-vendor-calls.json: 196 grounded calls / 91 steps / 54 vendors, every call carries a sourceUrl from the vendor's own evidence (84% of cells honestly empty); reader's pick pins first when set |
| Human steps: root cause + why computer use can't do it | shipped 2026-09-21 — data/human-step-audit.json covers all 147 non-agent steps (19 drivable / 55 assist / 44 policy-gate / 17 third-party-wait / 12 no-screen); CU chips suppressed where the blocker is authority/physics/waiting; per-step "why human" lines + verdict-box detail |
| Per-step agent prompts (pilot: set-up-transactional-email) | shipped 2026-09-21 — data/step-prompts.json (growth_005, 5 prompts): copy button, {{vendor}} resolves to reader's stack pick; human-gated steps prep-and-stop; endpoints only from grounded calls. Say the word to run the generator fleet-wide |
| Jeeves ("Jev") + competitor in rankings | shipped 2026-09-21 — startup-banking 5→7: Airwallex #3 (39.6), Jeeves #6 (25.4, beta MCP + webhooks judged full q8, thin API); YC S20 stamped |
| Ultrametric in appropriate arenas | shipped 2026-09-21 — AFK → workflow-automation #11/11 (12.1, honest pre-launch: no docs/API surface); Foreloop → product-feedback #3/4 (15.8) AFTER adversarial bias audit: 14 cells corrected (public-api full8→partial5 per claude-code precedent, ai-insights full7→partial6, 2 quality caps, 10 na→none denominator fix), audit notes durable in committed cache, README §9 updated |
| Pulley shutdown tag + never offer it | shipped 2026-09-21 — lib/shutdown.ts: "Closing" tag on every listing surface; excluded from stacks/step rankings/rosters/rivals/upgrade advice; readers running it get migrate-first advice |
| Muse.ai deep index | shipped 2026-09-21 — ai-assistants 8.3→17.3, #7/9: extremely agentic internally (Secure VM, self-built tools, approval cards; agenticApp 60.4, privacy fulls) but zero external API/MCP/CLI/SDK (agentReady 3.4, apiQuality 0); its browser-agent verdict displaces gemini in 2 CU chips |
| "gstack" + other automation toolsets, mapped into processes | partially shipped 2026-09-21 — workflow-automation 6→11: Activepieces #2 (41.4), Trigger.dev #3 (39.5), Gumloop #5 (34.4), Lindy #10 (23.0, MCP-only, no public API); 15 async watcher steps across 14 processes given the arena as a market via the committed mapper. **"gstack" unresolved — no such product found (gstack.com is parked); founder: which URL/name?** |
| Foreloop logo refresh from foreloop.com | shipped 2026-09-21 — current white two-tone loop mark (was the stale blue) |
| GH Actions ANTHROPIC_API_KEY entered | live 2026-09-21 — key verified end-to-end (story-runner dispatch ran 31min of real judging; failed on the known judge-JSON flake, retries on 6h schedule). PR-blocked fallback works (issues #49–51 carry pushed branches). Founder one-liners remaining: Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests" (classifier-blocked for me); spike-engine.yml schedule retirement is edited on disk awaiting commit |
| Processes on the homepage | proposed 2026-09-21 — recommended: compact section between Arenas and Leading battles (headline stat + ~6 cards: icon, title, ceiling bar, top vendor; "All processes →"); awaiting founder nod since the homepage layout is a standing founder call |
| README §9 ai-coding audit narrative predates later re-judge | open — follow-up: narrative overstates what current data shows (audit cells legitimately re-evaluated by 1bbb45bc3/dbe84d1ff); reword §9 to date-scope the claims |
| Processes corpus: key startup processes only + 5 orderings + realistic DAGs + YC playbooks | shipped 2026-09-18 — 106→97 (AFK artifacts removed, aliases kept), Founder-timeline/Regularity/Annoying/Risky/Growth presets, 22 DAGs rebuilt (Mercury bank-sim bug regression-pinned), 6 new chains (11 total) |
| Computer use on every 'manual' step | shipped 2026-09-18 — all 64 form-route steps + 69/83 person steps carry ranked judged computer-use attempts; label renamed "Human or computer use" |
| Persona icons on /stacks | shipped 2026-09-18 |
| Define your stack + upgraded advice; run processes with your stack; "Check my process" | shipped 2026-09-18 — account stack store (KV, watchlist pattern), /my-stack editor + advice (rank, Δ-to-leader, top-2 upgrades, stack score), personalized runs at noindexed /processes/<slug>/mine (public SEO pages untouched, per founder); needs wrangler deploy |
| Watchlist logos; ⋯ row menu with Flag on story tables | shipped 2026-09-18 |
| Sign up button top-right, standard UM WorkOS | shipped 2026-09-18 — visible to everyone (emerald pill; account chip + watchlist menu when signed in; pa-auth-test flag retired). NOTE: signup errors at WorkOS until the dashboard redirect URI is added — monitor armed, auto-confirms |
| US flag on US-centric processes | shipped 2026-09-18 — region:'us' on 15 processes (DE franchise tax, 409A, EIN, 1099s, state taxes, registered agent, 83(b)-citing founder agreement…); 🇺🇸 on index + detail pages with a tooltip |
| Rename "cells" → "product user stories" in user-facing copy | shipped 2026-09-18 — pipeline, methodology, score receipts, reports, rankings pages (18+ prose spots; code identifiers untouched) |
| Larger vendor logos on process chain steps | shipped 2026-09-18 (16→28px step blocks, 14→22px ranked options) |
| Share image says "Companies, ranked for the AI era" | shipped 2026-09-18 — regenerated as og3.png (cache-busting filename), metadata updated |
| ALL processes: key cross-arena vendors per step (chatgpt sites, poly, …) | shipped 2026-09-18 — 59 steps gained 249 cross-arena vendor entries (arena-tagged, same story-derived scores): launch-website now shows chatgpt:80 + claude:80 + framer:61 + figma + canva beside v0/lovable; Poly honestly excluded there (its publish-notes-website verdict is none) but ships on the Dropbox-import step where evidenced |
| Vercel bill: cut build-minute burn without slowing progress | shipped 2026-09-18 — prebuilt tested and ruled out (41 fn bundles / 12GB output exceeds upload limits); fix = batched cadence via scripts/deploy-prod.sh (git push per merge stays; production deploys ≤3/day, 2h soft floor, FORCE=1 override) |
| Remove "Rank #X of Y in <arena>" eyebrow on vendor pages (arenas strip already shows it) | shipped 2026-09-18 |
| typescript-eslint broken under TS 7 (repo-wide lint) | open — pre-existing from TS7 merge; needs typescript-eslint major or pin |
| Process + step rankings derived from vendors' judged stories (vendor-agnostic) | shipped 2026-09-18 — 291 step-story mappings (cached LLM pass, $single-digit); per-step ranked vendors with score pills + cite expandables; "Who covers this process best" leaderboard + best-per-step chain on every process page |
| Computer-use options (all capable vendors, judged evidence only) on "Temporarily human" steps | shipped 2026-09-18 — 32/36 irreducible steps got ranked "could attempt it today" chips (browser-agents roster + chatgpt/claude/copilot/gemini/martin/muse via judged CU stories; grok/poke/perplexity honestly excluded) |
| Internally-created GitHub issues auto-solved + update PRs fixed | shipped 2026-09-17 — 13 engine issues closed (4 branches merged per-product: rippling+tailscale wrong verdicts fixed, agent-skills + 4 mobile-dev refreshed, 3.6k history lines unioned); TypeScript 7 + Vitest 5 merged green; eslint 10 left open (upstream peer-dep dead-end, commented). Founder decision pending: disable story-runner/spike-engine GH workflows (orphan-branch problem) or enable "Actions can create PRs" in org settings |
| Signup/login live using the Ultrametric WorkOS key | blocked (founder, 1 min) — everything works except the dashboard redirect URI: AuthKit live-returns "Invalid Redirect URI" for https://ultrametric.ai/auth/callback. Dashboard → Redirects → add sign-in URI above + logout URI https://ultrametric.ai. Say "go live" after and the Log in button ships to everyone |
| "Irreducibly human" → "Temporarily human" on process verdicts | shipped 2026-09-17 |
| Install section: no boxes around brew/install commands | shipped 2026-09-17 |
| Homepage table: companies only + "Include all products of companies" toggle | shipped 2026-09-16 — 55 family sub-product rows hidden by default, checkbox reveals every line |
| Broaden processes: every step lists all key suppliers for the general function | in-lane (process-suppliers) |
| Finish the depth run: exhaustive scoring for ALL covered companies | in-flight — wave 2 launched over the full remaining queue |
| Map Mercury's products incl. mercury.com/books | shipped 2026-09-16 — Books line added to the Mercury family (live-verified: "AI-powered accounting software built into your bank account"); arena row decision delegated to the accounting spike lane |
| Accounting arena big spike | in-lane (accounting-spike) — roster expansion (FreshBooks/Zoho/Wave/Digits/Kick/Mercury Books candidates) + exhaustive passes on quickbooks/xero/pilot/puzzle |
| 24h Stripe-depth backfill over stale top of spike queue | in-flight 2026-09-16 — 8 parallel lanes × ~19 products (149 total; vercel/cloudflare/cursor excluded, owned by pending exhaustive lane); 68 freshly-passed products stamped done in queue |
| Daily spike-engine cron after backfill | running — local daily 04:23 job (session-scoped, 7-day expiry); DURABLE path = GitHub Actions .github/workflows/spike-engine.yml, needs founder to add ANTHROPIC_API_KEY repo secret |
| Hardware arenas: n/a on non-applicable sub-scores (agent-ready, API) keeping PA Score | shipped 2026-09-15 — naDimensions on processors+gpus; n/a pills/cells on vendor page + arena + everything tables |
| YC S09 pill wraps to two lines | shipped 2026-09-15 (whitespace-nowrap) |
| Product name column truncates too early | shipped 2026-09-15 (min-width raised on homepage + arena tables) |
| "Built-in AI assistant" pill breaks row height on /rankings/agentic | shipped 2026-09-15 — AI mode is its own column on agentic + ai-native rankings |
| Operating rhythm page + email-marketing arena + arenas strip on product pages | shipped 2026-09-15 (startup-rhythm lane merged) |
| Stripe engine: 3 new arenas (identity-verification, banking-data-apis, stablecoin-payments), 13 lines dispositioned, competitor spikes, /queue | shipped 2026-09-15 |
| "PA Score" label inside the pill on vendor page | shipped 2026-09-15 |
| /arena/processors description too long above fold | shipped 2026-09-15 (both hardware arena descriptions tightened to house style) |
| Stacks page: layer names clickable → their arena page | shipped 2026-09-15 |
| Make /rankings/most-connected comprehensive | open — queued (todo per founder) |
| Story-type icons left of story text on arena pages | shipped 2026-09-15 (theme icon per row) |
| Front page: "+" card in Arenas grid → suggest an arena via GitHub issue | shipped 2026-09-15 |
| Front-page scope dropdown: "All products" → "All arenas" | shipped 2026-09-15 |
| Arena icons in the front-page arena dropdown (same as top bar) | shipped 2026-09-18 — emoji icons prefix every option, matching the top-bar menu |
| Pulley possibly shut down — verify, mark closed, keep data | shipped 2026-09-15 — vendor notice: ceasing operations 2026-12-08, Carta migration; CLOSING badge, data kept |
| "⚿ auth 1 auth-gated probe" not useful above the fold | shipped 2026-09-15 (moved to page bottom) |
| Vendor pills: "Built-in AI XX/100", "Agent-ready XX/100" + click through to evidence log | shipped 2026-09-15 — /score per-vendor receipt pages (+439 pages), pills show /100 and deep-link |
| PA Score above fold → per-vendor transparent calculation page (not just generic methodology) | shipped 2026-09-15 — /arena/<a>/product/<p>/score shows the full arithmetic, PA recomputes exactly |
| Flag/Badge/Try demoted from top of vendor page; Try marked "Experimental" | shipped 2026-09-15 |
| "For agents" above-fold cell → bottom of vendor page | shipped 2026-09-15 |
| Compare head-to-head uses vendor logos | shipped 2026-09-15 |
| Stripe "Not yet judged (13)" products: find/create arenas and judge all | shipped 2026-09-15 — 3 judged in new arenas (Identity 3rd, Financial Connections 4th, Crypto last with preview gates costed); 4 covered in existing entries; 6 honestly not judgeable (reasons recorded) |
| Deep spikes on Stripe's nearest competitors — build an engine if multi-day | shipped 2026-09-15 — 8 competitors spiked (Airwallex #6→#2); spike-engine cron daily 04:23 UTC |
| Microterminal: actually live + sandboxed, not a replay | shipped 2026-09-15 — 316/649 proofs (49%, 48 arenas) re-runnable live via worker allowlist (manifest-keyed, no user input reaches fetch, 20/min/IP); rest honestly labeled recorded; section marked Experimental |
| Score trend → bottom of vendor page | shipped 2026-09-15 |
| User story table: filter by user type | shipped 2026-09-15 |
| Deep spike on Mercury and Rippling | queued in spike engine (Mercury already had the startup-banking exhaustive pass; both ranked in data/spike-priorities.json) |
| Business-model tags in user story table (free vs enterprise-only stories) | shipped 2026-09-15 (tier chips + tier filter — pricing-tier lane; coverage grows as evidence states gating) |
| Always-running probe/spike engine over top companies + visible queue | shipped 2026-09-15 — spike-engine.ts + daily cron + unlinked /queue page (staleness × popularity × priority) |
| Gifts URL + read rejection notes, fix gifts that will fail again | shipped 2026-09-15 — Homebrew retired (maintainer passed), vLLM disclosure body ready (founder: gh pr edit 56909 --body-file drafts/outreach/vllm/PR-BODY-v2.md), docusaurus on hold (competing PR #11958), gitea fixed (needs founder account+DCO); checklist hardened |
| Submit PA to directories for traffic; PA-specific Terms + Privacy building on ultrametric.ai TOS | shipped 2026-09-15 — 30-venue plan in drafts/growth/DIRECTORIES.md (2 awesome-list PRs ready for founder review); /terms extended + /privacy added (counsel review recommended) |
| WhatsApp preview sometimes shows old image — diagnose | shipped 2026-09-15 — root cause: app/opengraph-image.png overrode og2.png with a double-basePath 404 URL; removed |
| Do we need RSS? | answered 2026-09-15 — keep (see session notes) |
| Hardware arenas into top bar + menus, drop Experimental status | shipped 2026-09-15 — Hardware section in arena menu, /experiments pages are now spec annexes linking the arenas |
| Start WorkOS login work (account exists) | LIVE (test-gated) 2026-09-16 — client id committed, both secrets set, worker deployed; /auth/login 302s to AuthKit, /auth/me fails closed. Founder: verify dashboard redirect URIs, test via pa-auth-test flag, then say "go live" |
| Scrollbar tracks transparent, not white | shipped 2026-09-15 |
| Footer "Add your product" → actually goes to GitHub (CONTRIBUTING.md), scanner relabeled "Test your product" | shipped 2026-09-15 |
| Pricing tier (free/paid/enterprise) visible in user story table | shipped 2026-09-15 (tier chips + filter, pricing-tier lane) |
| Enterprise flag for sales-led vendors | shipped 2026-09-15 — 33 vendors live-verified and stamped (Adyen, Marqeta, Mangopay, Sierra, CoreWeave…); ~30 checked-and-rejected recorded |
| Remove /notes (Arena Notes) — not useful | shipped 2026-09-15 (route, lib, generator, drafts, feed merge all removed) |
| Clerky 0/100 — non-agentic or gap? | shipped 2026-09-15 — coverage gap: developers.clerky.com Partner API + llms.txt + mcp.clerky.com MCP were never crawled; PA 13.9→22.1, aiEra 0→14.0, agentReady 0→37.3 |
| Footer: drop "Test your product" (adding = testing) | shipped 2026-09-15 |
| Remove "?" chip next to table filter on main page | shipped 2026-09-15 |
| ALL YC batches covered for agentic/famous companies | shipped 2026-09-15 — full W16–F26 audit: 7 bring-ups (Deepgram W16, RevenueCat S18, SigNoz W21, LanceDB W22, Windmill S22, Context.dev S26, Maritime F26) + 14 domain-verified restamps (82 → 103 stamped products); every batch of the last 10 years covered or honestly recorded as no-arena-fit; coverage queue re-swept W16–F26 (784 candidates) |
| Bring hardware section (processors, GPUs) into the arenas | shipped 2026-09-15 — processors + gpus arenas (16 products, 696 verdicts); Ryzen AI Max+ best agentReady in CPUs, MI355X in GPUs; 9950X3D honest 0 aiEra |
| Arena for YubiKey-type hardware authenticators | shipped 2026-09-15 — security-keys: 6 products, 324 verdicts, 11 recorded probes; YubiKey #1 (ykman + YubiEnterprise API), Nitrokey #2 on open updatable firmware, Titan last (zero agent surface); Ledger evaluated and excluded (crypto wallet first — FIDO app is a 21-star side capability) |
| Arena for authenticator-type apps | shipped 2026-09-15 — authenticator-apps: 8 products, 440 verdicts, 14 recorded probes incl. two FULL keyless MCP handshakes (Bitwarden stdio, 1Password remote); Bitwarden #1, 1Password best agent-readiness (70.1); Authy/Google/Microsoft bottom on export lock-in + no programmatic surface |
| Game engines arena — Unity vs three.js, agenticness measured | shipped 2026-09-15 — game-engines: 8 products, 448 verdicts, 19 recorded probes; MCP landscape verified honestly (PlayCanvas = only official npm-published editor MCP; Unity official MCP in com.unity.ai.assistant, closed distribution; Godot/Unreal community-only); Unity runtime-fee history + Muse→"Unity's AI tools" rename cited from Unity's own pages; Babylon.js edges Phaser for #1 aiEra, Unreal last (source auth-gated, site 403s agents) |
| Remove "Experiment — not part of the evidence-judged arenas…" banner from /experiments pages | shipped 2026-09-15 |
| Remove "Evidence as of … · story coverage …" footer line on product pages | shipped 2026-09-15 |
| Move "Try it" section below "Products" (family) section on vendor pages | shipped 2026-09-15 |
| Move "For agents" (page-as-markdown / llms.txt) rail cell to bottom of product page | in-lane (startup-sim/page-order) — re-scoped 2026-09-14 |
| Move "Badge / embed score badge" rail cell to bottom of product page | in-lane (startup-sim/page-order) — re-scoped 2026-09-14 |
| Homepage title → "Companies, ranked for the AI era" + refresh share image | shipped 2026-09-14 |
| Tables rankable by OSS status | shipped 2026-09-14 |
| Compare link → fixed right end of row | shipped 2026-09-14 |
| YC pill in YC orange | shipped 2026-09-14 |
| 100 functional improvements | shipped 2026-09-14 (46 done, 54 catalogued in docs/FUNCTIONAL-100.md) |
| 50 growth ideas doc + execution start | shipped 2026-09-14 (doc) — execution rolling |
| Pricing-tier dimension on user stories (free/paid/enterprise) fleet-wide | shipped 2026-09-15 — 1,180 cells classified over 70 arenas (803 free/295 paid/82 enterprise), annotation-only, tier chips + filters + "what's free" lines live |
| Stripe-style exhaustive passes for major startups + hot repos (incl. buzz) | shipped 2026-09-17 — Buzz #5→#2 team-chat (40.4), Supabase #1 BaaS (56.3), Vercel #1 edge (45.1), Cursor #1 ai-coding (52.1), PostHog #1 analytics, Ramp #1 expense + overtakes Mercury in banking, Neon #1 serverless-db; 313 flips kept/~30 reverted; +23 probes (812), +5 MCP endpoints |
| Arenas for Stripe's 13 unjudged lines — judge all of Stripe's products | shipped 2026-09-15 — 3 new arenas (identity-verification, banking-data-apis, stablecoin-payments; 19 products, ~1,000 verdicts); Identity/Financial Connections/Crypto flipped page-only → judged; the other 10 lines stay honestly page-only with refreshed recorded reasons (Invoicing/RevRec inside Billing's entry, Managed Payments+Lemon Squeezy inside payments, Capital/Sigma/Data Pipeline/Directory/Projects/Climate not judgeable — each note says why) |
| Deep spikes on Stripe's nearest payments competitors (adyen, paypal, square, checkout-com, airwallex, paddle, polar, mollie) | shipped 2026-09-15 — one exhaustive spike-engine pass each: llms.txt-discovered URL expansion, re-crawl, re-judge, churn policy applied (flips kept only when citing new evidence ids) |
| Deep running engine always probing/spiking top companies, with a visible queue | shipped 2026-09-15 — pipeline/scripts/spike-engine.ts (rank + process modes, budget-capped, judge-cache- and churn-policy-respecting), .github/workflows/spike-engine.yml daily 04:23 UTC with the story-runner soft key gate, queue state in data/spike-queue.json rendered at the unlinked /queue page |
| Remaining payments arenas: card-issuing, tax-automation, banking-as-a-service, marketplace/payfac | shipped 2026-09-15 — 4 arenas, 23 products, 1,219 verdicts; Mangopay beats Stripe Connect in marketplace; Stripe Issuing #1 in issuing; TaxJar (Stripe-owned) last in tax |
| Payments roster expansion (Checkout.com, Mollie, Airwallex, Paddle, Lemon Squeezy, Polar) | shipped 2026-09-15 — 5 arena rows (Polar debuts #2 @ 42.9; Lemon Squeezy = Stripe family entry, acquired 2024 → Stripe Managed Payments) |
| Docusaurus gift PR | blocked (Meta CLA needs founder signature) |
| Greptile pre-review of gift PRs | blocked (needs Greptile installed on ultrametricai org — founder to confirm) |
| npm publishes (ultrametric-mcp, ultrametric-cli) + MCP registry submissions | superseded 2026-09-29 — the MCP/CLI packages moved to their own dedicated repo; publishes happen from there |
| Show HN + X thread launch | blocked (founder go + posting) |
| GitHub social preview upload (public/og2.png) | blocked (founder — repo Settings) |
| Google Search Console: add domain property for ultrametric.ai (DNS TXT), submit both sitemaps | blocked (founder Google account) |
| Cloudflare managed robots.txt blocks GPTBot/meta-externalagent at apex — disable AI-bot blocking | blocked (founder — CF dashboard, Security → Bots) |
| **URGENT post-cutover**: Vercel env NEXT_PUBLIC_SITE_URL still = "https://ultrametric.ai/productarena" — poisons og:url, sitemap.xml, RSS link, auth return_to on the LIVE site. Fix: `vercel env rm NEXT_PUBLIC_SITE_URL production` (code default is correct) then redeploy — or edit in dashboard. Classifier blocks me from secret-store writes | blocked (founder — Vercel env, 1 min) |
| **URGENT post-cutover**: WorkOS dashboard — redirect URI → https://ultrametric.ai/auth/callback, logout URI → https://ultrametric.ai (login 302 already sends the new redirect_uri; WorkOS will reject it until allowlisted) | blocked (founder — WorkOS dashboard) |
| Homepage main table: companies only — collapse multi-product families to the parent (one Stripe row) | open — inline now |
| Homepage ("Open rankings for the AI era", now at /overall): drop the 'MCP' toggle from the main table controls | shipped 2026-09-28 |
| gstack (Garry Tan) added to /stacks | shipped 2026-09-28 (top slot, attributed, roster gaps recorded) |
| GEO dimension: process geo-scope + IN/UK/EU vendor availability spikes | shipped 2026-09-28 (123 geoScopes, 31 country notes, 114 vendor-geo rows) |
| "Open startup repo" lift: cap-table engine + founder-ops corpus structure (stage 1) | shipped 2026-09-28 (lib/openstartup, /tools/cap-table, corpus tree + lib/founderOps.ts gates; stages 2–3 in docs/FOUNDER-OPS.md) |
| Virtual Startup: compact controls so terminal is above the fold | shipped 2026-09-28 |
| Sim round 7 (founder batch 2026-10-01): /virtual-startup → /startup-sim rename (worker 301, query-preserving), mobile GitHub mark, DAG flicker + setup-band overflow fixes, dropdowns names-only, new demo defaults (seed/cofounders/X launch/office/SOC 2/ChatGPT) with era-safe legacy replay, 'Apply to YC' checkbox + new fund_007 corpus process | shipped 2026-10-01 |
| Situations (founder 2026-10-01): reactive, trigger-driven founder processes — "e.g. your company has a C&D, or you want to get a visa and come to Silicon Valley but the visa is held up" | shipped 2026-10-01 — additive `kind: 'situation'` + trigger + urgency on the corpus schema (existing records byte-identical); 12 curated situations (C&D, stuck visa, data breach, IRS notice, bank freeze/failure, chargeback spike, co-founder departure, lawsuit, trademark office action, DE franchise-tax delinquency, DDoS/outage, vendor sunset), every step honestly routed with curl-verified primary sources; /processes 'Situations' area (kind-driven, last) + urgency chips + trigger subtitles; NO timeline slot (sorted after the timeline by urgency); 2 new dated rule cards (FRCP 12 answer deadline, USPTO office-action 3-month response) + primary sources; full totality (audit/step-stories/graph/icons/shared catalog) |
| Homepage revert: '/' = landing site again, product homepage at /overall, bare /productarena → /overall | shipped 2026-09-28 (worker) |
| Landing "ProductArena" header link went nowhere (browser-cached old 301) | shipped 2026-09-28 (worker rewrites landing hrefs → /overall; bare redirect now uncacheable 302) |
| VS: remove 'Simulated' chips from page top + improve top layout | in progress (founder 2026-09-28) |
| /stacks: gstack moved from top to bottom | in progress (founder 2026-09-28) |
| Top bar Arenas menu renders off-screen left | in progress (founder 2026-09-28) |
| "Simulate this playbook" section: too many nested boxes, tighten UI | in progress (founder 2026-09-28) |
| Try-it sandbox demo accounts (Stripe test key first) | blocked (founder provisions accounts) — lane building the mechanism |
| Include Ultrametric in the rankings (the official CLI/MCP being built at /v2) | in-lane (ultrametric-family) 2026-09-29 — honest outcome: **page-only, no judged entry**. Crawl-verified: npm ultrametric-cli + ultrametric-mcp 404 (unpublished, dedicated repo private), POST /mcp 410 (retired offering — recorded negative), data API live (categories.json/openapi.json/llms.txt all 200) but it's a single-source export of our own rankings (Stripe Sigma/Data Pipeline precedent) and self-judging our own platform would be self-refereeing. New `/family/ultrametric` (disclosure in tagline): Foreloop + AFK judged refs, Rankings & Data API + CLI/MCP + company-records npm `ultrametric` as page-only lines with recorded reasons; CLI/MCP flagged as the first mcp-infrastructure bring-up (with owner-product bias audit) once a live endpoint + published packages exist. Full decision table in docs/product-families.md Wave 4 |
| PA_SESSION_KEY → UM_SESSION_KEY secret migration (last PA_-named worker binding after the 2026-10-01 code de-PA pass; KV bindings already renamed with fallbacks). Clean path, zero downtime: 1) `wrangler secret put UM_SESSION_KEY` with the SAME value as the current secret (new value = everyone logged out), 2) lane changes worker.js `env?.PA_SESSION_KEY` reads to `env?.UM_SESSION_KEY \|\| env?.PA_SESSION_KEY` + deploy, 3) `wrangler secret delete PA_SESSION_KEY` later | blocked (founder — wrangler secret put, 1 min) |

## Shipped (recent — see git log for full history)

- Instant tooltips sitewide · Agent ceiling → "Current agent ceiling" · Built-in AI rename ·
  Login hidden until WorkOS ships · og2 share image · search prefix ranking · "none yet"
  evidence cells · story-table column-shift bug · arena identity in product eyebrow ·
  buyer-plain column tooltips · process "do it yourself ↗" links · vendor-neutral processes ·
  most-compared KV counter · /gifts review page · crawl4ai PR #2267 · vLLM PR #56909
