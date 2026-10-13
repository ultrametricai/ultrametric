# ai-assistants roster candidates: dots, Grok Bot, Kimi, Perplexity Computer

Research lane, fetched 2026-10-01. Raw material for post-migration judging (Opus 5.5 judge
migration is mid-flight; nothing here edits data/, rankings, or scores). Evidence shapes follow
data/ai-assistants/evidence/*.json conventions (tier: claimed-docs / press / probe) but live here
in docs/ per the founder ask. Current roster for reference: chatgpt, claude, gemini, perplexity,
copilot, grok, muse, poke, martin, jo.

**Verdict line: all four are real, shipped products — none is vaporware.** Dots and Grok Bot are
weeks old; Kimi and Perplexity Computer have months of history. Instinct (researched separately,
see instinct.md) is real but invite-only.

---

## 1. dots (OpenAI) — REAL, launched 2026-09-29

Full capability map in [openai-dots.md](./openai-dots.md); summary for roster purposes:

- Always-on personal agents in ChatGPT, powered by GPT-6 Astra, own cloud computer + browser,
  reachable via ChatGPT/Slack/Teams/voice; first dot included on Pro (100/200/500, non-EEA/UK/CH)
  and Business Premium. — https://learn.chatgpt.com/docs/dots.md (fetched 2026-10-01, claimed-docs)
- Agent-readiness: excellent docs surface (llms.txt + .md pages at learn.chatgpt.com, probed 200
  text/markdown on 2026-10-01); no public API for dots themselves.
- Roster note: distinct product from ChatGPT (same vendor), like poke/martin are distinct from the
  frontier assistants. Judgeable from public docs today; hands-on requires a Pro 100+ seat outside
  the EEA — we qualify.

## 2. Grok Bot (xAI / "SpaceXAI") — REAL, launched 2026-08-11

- Maker: xAI — now branding as **SpaceXAI** ("Official SpaceXAI (xAI) developer documentation" is
  the literal first line of https://docs.x.ai/llms.txt, probed 200 text/plain on 2026-10-01).
- What it is: "AI teammates with names, jobs, and context that compounds over time, working on a
  persistent cloud computer" — each Bot gets a cloud computer with "a browser, filesystem, and
  terminal, so tasks finish in your real tools instead of as chat drafts."
  — https://x.ai/news/introducing-grok-bot (2026-08-11, fetched 2026-10-01, claimed-docs);
  https://x.ai/bot (indexed 2026-10-01)
- Capabilities (claimed-docs, https://docs.x.ai/grok-bot/overview fetched 2026-10-01): persistent
  memory/files/browser sessions per named Bot; multi-step work across apps; "Bots can reason, use
  connectors, work with files, and coordinate in parallel"; teach-a-task ("walk a Bot through a
  multi-step path once, and it can save the path as a skill"); inter-bot group chats; background
  cloud execution ("computers Bots work on run in Cursor's cloud" — note the xAI–Cursor tie-up);
  voice chat + dictation; approval gates ("drafts you approve before they are sent").
- Press framing: routines as cron-like triggers (time or events like a new Slack message/Git
  commit); multi-agent fleet, each agent with own cloud computer/memory.
  — https://interestingengineering.com/ai-robotics/xai-grok-bot-computer-agent and mindstudio.ai
  explainers (indexed 2026-10-01, press)
- Pricing/availability: "Grok Bot is now included with all SuperGrok, Cursor Pro, and Cursor Teams
  plans" with "its own usage, separate from your Grok and Cursor plans"; usage resets weekly.
  Clients on macOS, Windows, Linux, iOS, Android. Team Bots in public beta on Teams/Enterprise.
  — https://x.ai/news/grok-bot-more-plans (2026-08-26, fetched 2026-10-01, claimed-docs);
  https://x.ai/news/team-bots (indexed 2026-10-01)
- Agent-readiness: docs.x.ai has llms.txt (probed 200, 2026-10-01) and a grok-bot docs section;
  **no Grok Bot API/MCP surface found** in the overview docs (the x.ai API at api.x.ai is the model
  API, a different product). x.ai/llms.txt itself is 404 (probe 2026-10-01) — docs subdomain only.
- Roster note: distinct from the existing `grok` entry (chatbot). Same product shape as dots.

## 3. Kimi (Moonshot AI) — REAL, mature, fast-moving

- Maker: Moonshot AI (Beijing; global surface at kimi.com / platform.kimi.ai).
- Assistant app: kimi.com — "尽管问，或做个 Agent 任务" ("Ask anything, or create an Agent task");
  agent mode, deep research, PPT/doc generation, scheduled tasks, plugin system. Site currently
  leads with "K3 上线" (K3 launched). — https://www.kimi.com (fetched 2026-10-01, claimed-docs;
  served Chinese-language content to our fetcher)
- Model line (press + platform, fetched/indexed 2026-10-01): K2.5 (2026-01, vision via MoonViT,
  100-sub-agent swarm — InfoQ 2026-02); K2.6 (2026-04-20, open-weight 1T MoE, 256K context,
  Agent Swarm to 300 sub-agents / 4,000 coordinated steps, 12h+ autonomous runs — marktechpost
  2026-04-20); **K3** (announced 2026-07-16, open weights 2026-07-27: 2.8T params, 1M context,
  natively multimodal, tool-calling/terminal-first — geopolitechs/dev.to guides, indexed
  2026-10-01). Kimi Work local desktop agent reported 2026-06-12 (marktechpost).
- Developer platform (claimed-docs, https://platform.kimi.ai fetched 2026-10-01): K3 at
  $3.00/$15.00 per MTok in/out ($0.30 cache hit); K2.7 Code at $0.95/$4.00; K2.6 at $0.95/$4.00;
  official plug-and-play tools (Web Search, Memory, Code-Runner); **Kimi Code** CLI; OpenAI-
  compatible tool-call schemas per third-party guides (developersdigest.tech, indexed 2026-10-01).
- Agent-readiness probes (2026-10-01): kimi.com/llms.txt → 302 to / (**none**);
  platform.moonshot.ai 301-redirects to platform.kimi.ai, whose /llms.txt returns 200 but serves
  HTML (**soft-200, no real llms.txt**). Strong API/CLI story, weak llms.txt story.
- Roster note: the candidate is the **Kimi assistant** (kimi.com app) for ai-assistants; the K-series
  models are frontier-models/local-llm-runtimes material (open weights). Consumer pricing for the
  assistant app was not shown to our fetcher — open question (CN vs global pricing split likely).

## 4. Perplexity Computer (Perplexity) — REAL, launched 2026-02-25

- What it is: "a general-purpose AI agent that can complete virtually any task on your behalf" —
  multi-model orchestrator (19 models per launch press: Nano Banana images, Veo 3.1 video, Gemini
  deep research, Grok quick search) running long tasks in the background.
  — https://docs.perplexity.ai/docs/getting-started/integrations/computer-mcp-server.md (fetched
  2026-10-01, claimed-docs); Semafor 2026-02-25 + VentureBeat launch coverage (indexed 2026-10-01,
  press)
- Capabilities (claimed-docs, 2026-10-01): web search/browse incl. login-gated pages; Linux code
  sandbox; document/media creation; email + calendar management; task management; enterprise data
  analysis; "connect to 400+ services through a managed connector framework"; 200MB file uploads;
  thread-ID context for multi-step work.
- **MCP server (standout agent-readiness signal)**: endpoint
  `https://www.perplexity.ai/rest/computer/mcp`, OAuth 2.0 with a Perplexity account, "no API key
  is required," one-line install in Claude Code (`claude mcp add perplexity-computer`), Cursor,
  VS Code. "Computer usage is billed against your Perplexity account credits" (`insufficient_credits`
  error surface). — same docs page, fetched 2026-10-01.
- docs.perplexity.ai/llms.txt: 200 text/plain (probed 2026-10-01) — full markdown docs tree.
- Pricing/availability: launched for **Max ($200/mo)** subscribers (Semafor/VentureBeat,
  2026-02-25, press); MCP usage credit-billed. Variants since: Personal Computer (Ask 2026 conf,
  2026-03-11) and Portable Computer (fully local on NVIDIA DGX Spark/RTX Linux, 2026-08-25 —
  VentureBeat/SiliconANGLE, indexed 2026-10-01). www.perplexity.ai/computer itself returns 403 to
  our fetcher (Cloudflare; probe 2026-10-01) — use the docs subdomain for evidence.
- Roster note: existing `perplexity` evidence pack already cites the Computer MCP page
  (data/ai-assistants/evidence/perplexity.json, fetchedAt 2026-09-04). Decision needed: fold
  Computer into the perplexity entry vs. list as its own roster product. Its $200/mo gate, own MCP
  endpoint, and distinct product identity argue for a separate entry, mirroring dots-vs-chatgpt.

---

## Recommendation for the post-migration judging list

1. **Add dots (OpenAI)** — real, shipped, best-in-class docs surface; judge once Opus 5.5 lands.
2. **Add Grok Bot (xAI/SpaceXAI)** — real, shipped, broad plan availability; distinct from `grok`.
3. **Add Kimi (Moonshot)** — real and mature; assistant app is the ai-assistants candidate, models
   feed other arenas. Needs a pricing-page pass (global vs CN) before judging.
4. **Perplexity Computer** — real; recommend a **separate roster entry** rather than folding into
   `perplexity`, given its own MCP endpoint, pricing gate, and product line (Personal/Portable).
5. **Instinct** — real but invite-only with zero public agent surface and ToS-prohibited automation
   (see instinct.md). Candidate for the roster only if/when we obtain an invite for hands-on
   evidence; until then claims are unverifiable vendor/press material.
