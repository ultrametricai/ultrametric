# Vendor research: dots (OpenAI)

Research lane, fetched 2026-10-01. Evidence pack raw material — no judging, no rankings edits.
Verified: **dots is a real, shipped OpenAI product**, announced at DevDay on 2026-09-29.
Primary documentation lives at learn.chatgpt.com and is fully agent-readable (llms.txt + .md pages).

## What it is

- "Your dot is an always-on agent that keeps work moving across your tools and projects. You can keep
  talking to it while it works, and it reaches out with results or decisions that need you."
  "Powered by GPT-6 Astra, your dot lives in the cloud and has its own computer and browser. … It can
  research, analyze data, prepare documents, and build software."
  — https://learn.chatgpt.com/docs/dots.md (fetched 2026-10-01, claimed-docs)
- Launch announcement: https://openai.com/index/introducing-dots/ (exists per search index; direct
  fetch returned **HTTP 403** on 2026-10-01 — openai.com blocks our fetcher, a repeat of the known
  openai.com fetch gotcha, not evidence of absence). Marketing framing from the indexed copy:
  "remarkably capable, always-on agents built to handle everything," ecosystem of plugins connecting
  to "over 4,000 apps."
- Press confirmation of launch date/model: TechCrunch, 2026-09-29 — personal agentic assistant
  powered by GPT-6 Astra; "Over time, we envision teams of Dots working together on your behalf."
  — https://techcrunch.com/2026/09/29/openai-launches-dots-its-bubbly-agentic-avatar/ (fetched
  2026-10-01, press)

## Capabilities (primary docs, fetched 2026-10-01)

All from https://learn.chatgpt.com/docs/dots.md and subpages unless noted:

- **Always-on / between-conversation work**: "Your dot works between conversations. It tracks
  progress, works out what needs to happen next, and follows through as things change." Can
  self-schedule ("decide when to pause and wake up") and "use background agents to work on several
  things in parallel."
- **Own cloud computer + browser**, with human takeover: "open its computer and select **Take over**,"
  then "Return control."
- **Local computer connection** (one personal computer at a time, ChatGPT desktop app must be open):
  dot can "work with that computer's files, apps, and tasks while it's available"; can "create local
  Work or Codex threads and control existing local Codex threads" — i.e., dots drive Codex.
  — https://learn.chatgpt.com/docs/enterprise/cloud-local-access (fetched 2026-10-01)
- **Channels**: same dot reachable in ChatGPT (desktop + mobile app), **Slack** (DM or channel
  mention), **Microsoft Teams**, and **voice calls**; "changing where you talk to it doesn't start a
  new dot or reset its memory." SMS "coming soon" per press (TechCrunch 2026-09-29).
- **Plugins**: uses the ChatGPT plugin ecosystem "with their connected accounts and existing
  permissions" (Gmail, Drive, GitHub examples in docs; "over 4,000 apps" per launch copy).
- **Memory**: draws on conversation, ChatGPT memory, and "its own saved notes about your preferences,
  decisions, and ongoing work" that persist across channels; proactive research is read-only.
- **Identity/persona**: named dot with handle (e.g. @tibo-alfred), customizable avatar — the "bubbly
  agentic avatar" angle (TechCrunch 2026-09-29).
- **Safety/controls**: "Built-in safeguards, your existing ChatGPT app permissions, and automatic
  approval checks apply from the start. Before an action affects your accounts or shares information,
  review determines whether your dot can proceed, needs your approval, or must hand a step over to
  you." Controls page covers custom rules, permission management, stop/delete.
  — https://learn.chatgpt.com/docs/dots/controls.md (listed in llms.txt, 2026-10-01)

## Availability & pricing (primary docs + press, 2026-10-01)

- From dots.md "Access" section (claimed-docs): **Pro 100, Pro 200, Pro 500** — "for users over 18
  outside the European Economic Area, United Kingdom, and Switzerland"; **Business Premium** —
  "rolling out worldwide." Rolling out gradually; desktop-first setup (mobile web unsupported).
- Usage: "Conversations with your dot don't count toward your ChatGPT usage limits. Tasks your dot
  starts or manages in Work or Codex count toward those products' usage limits as usual. Your plan
  includes an allowance for deeper work, with extended limits for the first month after launch."
- First dot included at no extra charge on eligible plans; **no price yet for additional dots** —
  "In the future, you'll be able to add more dots, and scale the output of each dot" (unpriced).
  Cheapest path: Pro 100 at $100/mo; Business Premium ~$100/user/mo annual, $125 monthly.
  — https://www.eesel.ai/blog/openai-dots-pricing (post 2026-09-30, fetched 2026-10-01, press)
- EEA Pro exclusion independently corroborated by user reports:
  https://community.openai.com/t/dots-looks-exactly-like-what-i-need-but-it-s-unavailable-for-pro-users-in-the-eea/1402170
  (seen in search index 2026-10-01).
- Enterprise beta constraints: "dots do not support data residency or inference residency";
  unavailable for FedRAMP workspaces, EKM workspaces, and UAE inference-residency workspaces; HIPAA
  workspaces eligible. — https://learn.chatgpt.com/docs/enterprise/cloud-local-access (2026-10-01).

## Agent-readiness signals (probed 2026-10-01)

| Signal | Result |
|---|---|
| llms.txt | **Yes** — https://learn.chatgpt.com/llms.txt (307 → /docs/llms.txt, 200 text/plain, ~31KB) with a dedicated "Dots" section: dots.md, computers-and-apps.md, controls.md, getting-started.md, channels.md, tasks-and-memory.md |
| Markdown docs | **Yes** — every page serves .md (verified: /docs/dots.md returns text/markdown, 200) |
| Public API for dots | **None found.** dots is a ChatGPT-surface product; developer agent-building lives in AgentKit/Responses API/Agents SDK at developers.openai.com, which is adjacent but not dots itself. developers.openai.com dots-related pages 308-redirect into learn.chatgpt.com |
| MCP | Dots consume ChatGPT's plugin/MCP ecosystem; no dots-as-MCP-server surface found |
| CLI | None for dots (Codex CLI is a separate product dots can drive) |

## Arena fit

**ai-assistants** — as a roster candidate alongside ChatGPT itself (same vendor, distinct product:
always-on delegated agent vs. conversational assistant; precedent: grok and GrokBot at xAI, or
Perplexity vs. Perplexity Computer). It is not frontier-models (that's GPT-6 Astra) and not
agent-frameworks (that's AgentKit).

## Open questions

- Additional-dot pricing and per-dot scaling price: announced as future, unpriced (2026-10-01).
- Hard limits of the "allowance for deeper work" after the first-month extended limits lapse.
- SMS channel timing (press says "coming soon").
- Whether dots get an API/programmatic surface (nothing today).
