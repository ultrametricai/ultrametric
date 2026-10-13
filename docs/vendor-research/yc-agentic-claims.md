# YC W24→F26 as a vendor pipeline: who claims "agentic", and who has an agent surface

Research lane, fetched 2026-10-02. Founder ask (2026-10-02): deeper analysis of YC batches as
vendors, especially startups claiming to be agentic versions of things. Raw material only —
nothing here edits data/, rankings, or scores. Format follows ai-assistants-candidates.md.

## Methodology (dated)

- Source: https://yc-oss.github.io/api/companies/all.json (the keyless mirror from
  pipeline/yc-shared.ts), fetched **2026-10-02T21:33:55Z**, HTTP 200, 10,537,808 bytes,
  **6,267 companies** total. Window per the ask: **Winter 2024 → Fall 2026** (11 batches,
  codes W24 S24 F24 W25 X25 S25 F25 W26 X26 S26 F26) = **1,941 companies** in this snapshot.
  F26 is still filling (108 in this fetch vs 91 in data/yc-queue.json's 2026-09-25 run) — all
  F26 shares below are provisional.
- "Agentic claim" = case-insensitive word match on `agent|agents|agentic|autonomous(ly)|co?pilot`
  across one_liner + tags + industries + name. This is a *claims* filter, not a capability
  filter — that distinction is the point of §4.
- Prior decisions respected: data/yc-map.json (mappedArena), data/yc-queue.json (2026-09-25,
  862 candidates), data/yc-rejections.json (orgorg, vly-ai-2 — neither matches the agentic
  filter, so no conflict). Disagreements noted in §6.
- Agent-surface probes (§4): one-shot keyless GETs on 2026-10-02T21:37–21:39Z with a desktop
  Chrome UA — `/llms.txt`, `/llms-full.txt`, `/openapi.json`, `/docs`, plus homepage HTML
  grepped for `mcp` / `model context protocol` / `api`. Root domains only; docs subdomains
  (docs.*) were NOT probed — marked unverified where relevant. Soft-200s (200 serving an HTML
  app shell) are called out and do not count as a surface.

## 1. Aggregate finding: ~1 in 5 claims agentic, trending to ~1 in 3

**417 of 1,941 (21.5%)** companies in W24→F26 make an agentic claim. Per batch (claimants /
batch total, share — feed snapshot 2026-10-02):

| Batch | Claimants | Total | Share |
|---|---|---|---|
| W24 | 46 | 248 | 18.5% |
| S24 | 45 | 248 | 18.1% |
| F24 | 17 | 94 | 18.1% |
| W25 | 27 | 165 | 16.4% |
| X25 | 36 | 144 | 25.0% |
| S25 | 33 | 166 | 19.9% |
| F25 | 34 | 146 | 23.3% |
| W26 | 44 | 198 | 22.2% |
| X26 | 58 | 193 | 30.1% |
| S26 | 45 | 231 | 19.5% |
| F26 | 32 | 108 | 29.6% (batch still filling) |

Signal mix (overlapping): "agent(s)" 308, "agentic" 53, "autonomous" 52, "copilot" 15. 173 of
the 417 put the agent claim in the one-liner itself ("AI agents for/that/to …" or "agentic").
Vocabulary shift: "copilot" dies out (W24: 3 → S25/X26/S26/F26: 0) while "agentic" persists
(W26 peak: 11). The "copilot for X" era is over inside YC; it is "agents for X" now.

Of the 417 claimants: **59 already mapped** in yc-map.json, **60 already queued** in
yc-queue.json, **0 previously rejected** — roughly 300 agentic claimants have never been
looked at by our pipeline.

## 2. Analysis table (~55 rows, chosen for arena relevance)

Mapping key: (a) candidate for an existing arena id; (b) clusters into an arena gap (§3);
(c) not a vendor fit. One-liners verbatim from the 2026-10-02 feed, truncated at ~70 chars.
"queued x.xx" = already in yc-queue.json with that score; "rostered" = already in the arena's
products.json.

| Company | Batch | One-liner (verbatim) | Claim type | Mapping |
|---|---|---|---|---|
| Freestyle | S24 | The most powerful sandboxes for AI Agents | agentic sandboxes | (a) agent-sandboxes |
| Butter | W25 | Embedded Sandboxes for Agents | agentic sandboxes | (a) agent-sandboxes |
| Cua | X25 | Give every agent a cloud desktop | agentic cloud desktop | (a) agent-sandboxes (queued 0.19) |
| Dedalus Labs | S25 | Persistent computers for AI agents | agentic computers / MCP gateway | (a) mcp-infrastructure |
| Agent 37 | F26 | Persistent sandboxes for agents like hermes, openclaw, claude code | agentic sandboxes | (a) agent-sandboxes |
| Invo | W25 | infra for computer use agents | computer-use infra | (a) agent-sandboxes |
| Raindrop | W24 | Sentry for AI Agents | agentic Sentry | (a) llm-evals-observability |
| Laminar | S24 | Understand why your AI agent breaks. Iterate fast to fix it. | agent observability | (a) llm-evals-observability |
| Coval | S24 | Simulation & Evaluation that scales voice and chat AI agents | agent eval/sim | (a) llm-evals-observability |
| Hamming AI | S24 | Complete QA platform for voice agents | voice-agent QA | (a) llm-evals-observability |
| Sentrial | W26 | Datadog for Agent Reliability | agentic Datadog | (a) llm-evals-observability |
| Fulcrum | S25 | The agentic debugger for AI systems | agentic debugger | (a) llm-evals-observability |
| Duckie | W24 | Build AI Support Agents in Minutes | agentic support | (a) ai-support-agents |
| Minimal AI | S25 | AI Agents for E-commerce Customer Support | agentic support (vertical) | (a) ai-support-agents |
| Wordware | S24 | AI agents you can rely on | agent builder | (a) workflow-automation |
| Sim | X25 | Build autonomous AI agents for enterprise systems | agentic n8n (OSS) | (a) workflow-automation |
| Keystroke | W24 | An all-in-one platform for building internal agents & workflows | agent builder | (a) workflow-automation |
| Tracecat | W24 | Open-source agentic security automation platform | agentic Tines | (a) workflow-automation |
| CloudCruise | W24 | The developer platform for fast and reliable browser agents | browser-agent infra | (a) browser-agents |
| Kura AI | S24 | New State of the Art for Browser Agents | browser agent | (a) browser-agents |
| BrowserOS | S24 | The Open Source Agentic Browser | agentic Chrome (OSS) | (a) browser-agents (fit question: product is a browser, not infra) |
| Locus | F25 | Payment infrastructure for AI agents | agentic Stripe | (a) agentic-commerce |
| Codag | S26 | The AI gateway for cheaper, faster, permissioned agents. | agentic gateway | (a) model-gateways |
| dari.dev | F25 | The Routing Layer for AI Agents | agentic router | (a) model-gateways |
| Captain | W26 | Self-tuning file search for AI agents | agentic search infra | (a) search-infra |
| Terse | F26 | Durable state for AI agents | agentic durable state | (a) durable-workflows / ai-memory |
| OpenProse | X26 | An open-source operating system for reliable long-running agents | agent runtime (OSS) | (a) durable-workflows / agent-frameworks |
| IncidentFox | W26 | AI SRE agent that triages, coordinates, and fixes production incidents | agentic SRE | (a) incident-management |
| Financial Datasets | S26 | Connect your agents to the stock market | market data API for agents | (a) banking-data-apis (adjacent — market data, not bank data) |
| Vespper | F24 | The best DOCX MCP for agents to edit microsoft word documents | single-purpose MCP | (a) mcp-infrastructure (narrow) |
| Amorphic Labs | S26 | OpenRouter for Agent Tools | agentic OpenRouter (tools) | (a) mcp-infrastructure |
| Mem0 | S24 | The Memory layer for AI Agents | agent memory | (a) ai-memory — **rostered** (yc-map missed it, §6) |
| Browser Use | W25 | Agents that use the browser. | browser agent | (a) browser-agents — **rostered** (§6) |
| Retell AI | W24 | Supercharge Your Contact Center Operations with AI Phone Agents | voice agents | (a) voice-agents — **rostered** (§6) |
| Mastra | W25 | The Javascript framework for building AI agents, from the Gatsby devs | agent framework | (a) agent-frameworks — **rostered** (§6) |
| ByteAsk | F26 | The AI coding agent for C and C++ | agentic coding (vertical) | (a) ai-coding (queued 0.81 — top of queue, agree) |
| Alter | S25 | Privileged Access Management for AI Agents | agentic PAM | (b) agent-iam |
| Clawvisor | X26 | The Authorization Layer for AI Agents | agentic authz | (b) agent-iam |
| Multifactor | F25 | Zero-trust authentication, authorization, and auditing for AI agents | agentic zero-trust | (b) agent-iam (queued auth-platforms 0.37) |
| Salus | W26 | Guardrails to validate your agent's actions before they execute | agent guardrails | (b) agent-iam |
| Golf | X25 | Agentic AI Security and Governance | agent governance | (b) agent-iam |
| Wato | X26 | The control point for AI agents at work. | agent control plane | (b) agent-iam |
| Traceforce | S26 | CrowdStrike for AI Agents | agentic CrowdStrike | (b) agent-iam |
| Allowance | X26 | The spend control layer for AI agents | agent spend control | (b) agent-payments |
| Sponge | W26 | Financial infrastructure for the agent economy | agent finance infra | (b) agent-payments |
| Orthogonal | W26 | Agentic Payments for APIs | agent payments | (b) agent-payments |
| Maven | W26 | Payments Infrastructure for Conversational Agents | agent payments | (b) agent-payments |
| Agentcard | S26 | cards for AI agents | agentic card-issuing | (b) agent-payments |
| Osmosis | W25 | Reinforcement Learning (RL) for AI Agents | agent RL | (b) agent-training-environments |
| Polymath | W26 | Simulation environments to train & evaluate long-horizon AI agents | agent RL gyms | (b) agent-training-environments |
| Hue | F26 | Test agents in realistic worlds built from production usage | agent sim worlds | (b) agent-training-environments |
| Arga Labs | X26 | Real-world sandboxes to test and train AI agents | agent RL gyms | (b) agent-training-environments |
| The Prompting Company | S25 | We help products get discovered & used by AI agents. | AEO | (b) agent-discovery (AEO) |
| Scope | X26 | We help software companies get discovered and used by AI agents | AEO | (b) agent-discovery (AEO) |
| Armature | X26 | We get your product picked by coding agents. | AEO | (b) agent-discovery (AEO) |
| Unusual | F24 | Market to AI agents | AEO | (b) agent-discovery (AEO) |
| Bloom | X26 | The brand layer for agents. | AEO | (b) agent-discovery (AEO) |
| RentAHuman | X26 | Marketplace for AI agents to hire humans. | reverse labor market | (b) human-in-the-loop-for-agents |
| Humwork | X26 | Human experts as API for AI Agents | reverse labor market | (b) human-in-the-loop-for-agents |
| Inkbox | S26 | The identity and communication layer for AI agents | agent comms/identity | (b) agent-iam / comms |
| NanoCorp | W24 | Autonomous Companies Run by AI Working While You Sleep. | agentic company | (c) moonshot, no product surface to judge |
| The Company Company | F26 | The last agent your company will ever need. | agentic everything | (c) too underspecified to map |
| Tsenta | S26 | AI career agent that finds matching jobs & applies on your behalf | agentic job hunt | (c) consumer |
| Parallel | W24 | AI agents for healthcare admin | agentic back office | (c) vertical healthcare (one of ~25 healthcare-ops claimants) |
| Flowtel | W25 | The AI Voice agents for hotels | agentic concierge | (c) vertical hospitality |
| Domu Technology | S24 | AI Agents for collections | agentic collections | (c) vertical financial services |
| Splash Inc. | W25 | Autonomous patrol-boats for National Security | autonomous ≠ agentic | (c) hardware/defense — keyword noise |
| CellType | W26 | The agentic drug company. We simulate human biology. | agentic biotech | (c) not a software vendor arena |

## 3. Arena-gap clusters (the (b) rows, named)

1. **agent-iam / agent governance** (~10 cos: Alter, Clawvisor, Multifactor, Salus, Golf,
   Wato, Traceforce, Agentic Fabriq, Pentagon, truthsystems, Silmaril, Inkbox). Identity,
   authn/z, guardrails, and runtime policy *for agents* — distinct from auth-platforms
   (human auth) and security-scanners. Spans W24→S26; the densest and most arena-shaped gap.
2. **agent-payments** (~7 cos: Locus, Allowance, Sponge, Orthogonal, Maven, Agentcard,
   Gravy, plus IRBC already queued startup-banking). Cards, spend control, and money movement
   for agents. Our agentic-commerce arena is checkout *protocols* (stripe-agentic-commerce,
   x402, UCP); this cluster is the bank/card/ledger side. Locus fits agentic-commerce today;
   the rest argue for either widening that arena or a sibling.
3. **agent-training-environments (RL gyms)** (~10 cos: Osmosis, Polymath, Hue, Arga Labs,
   Abundant, Olam Labs, Ressl AI, Agnost AI, Anchorhead, Monte). Simulation environments and
   RL for training/evaluating agents — adjacent to agent-sandboxes (execution) and
   llm-evals-observability (monitoring) but neither. Clearly a 2025–26 wave.
4. **agent-discovery / AEO** (~8 cos: The Prompting Company, Scope, Armature, Unusual, Bloom,
   Manicule, Sitefire, Okibi). "SEO for the agentic web" — getting products discovered, picked,
   and used by agents. Meta for us: these vendors sell exactly the llms.txt/MCP surface our
   probes measure.
5. **human-in-the-loop-for-agents** (3 cos: RentAHuman, Humwork, Pluto). Agents hiring
   humans. Real pattern, too small/young for an arena yet — watchlist.
6. Honorable mention, not a gap: **"autonomous company" moonshots** (NanoCorp, Pazi, Naïve,
   MadeThis, Async, The Company Company, Zomma). Recurring YC bet since W24; none exposes a
   judgeable product surface (checked one-liners/sites only — unverified beyond that).

## 4. Rebrand vs real agent surface — keyless probes, 2026-10-02T21:37–21:39Z

28 domains probed (top candidates). Columns: llms.txt / llms-full.txt / openapi.json / docs
HTTP status (soft-200 = 200 serving an HTML shell, counted as none), homepage `mcp` hits.

| Company (domain) | llms.txt | llms-full | openapi.json | /docs | mcp hits | Verdict |
|---|---|---|---|---|---|---|
| Freestyle (freestyle.sh) | 200 (27.7KB) | 404 | **200 JSON (245KB)** | 200 | 0 | Full surface — best in sweep |
| Sim (sim.ai) | 200 (33.9KB) | 200 (**1.64MB**) | 404 | 404 | 7 | Strong |
| Locus (paywithlocus.com) | 200 (18.2KB) | 200 (1.16MB) | 404 | 404 | 9 | Strong |
| Captain (captain.dev) | 200 (4.8KB) | 200 (143KB) | 404 | 404 | 27 | Strong |
| Financial Datasets (financialdatasets.ai) | 200 (7.4KB) | 200 (9.7KB) | **200 JSON (318KB)** | 404 | 0 | Strong (API-first) |
| Cua (cua.ai) | 200 (7.9KB) | soft-200 | soft-200 | 200 | 11 | Strong |
| Raindrop (raindrop.ai) | 200 (1.6KB) | 404 | 404 | 200 | 11 | Strong |
| Codag (codag.ai) | 200 (2.7KB) | 200 (6.3KB) | 404 | 200 | 0 | Strong |
| Dedalus Labs (dedaluslabs.ai) | 200 (3.8KB) | 200 (6.6KB) | 404 | 404 | 9 | Good |
| Terse (useterse.ai) | 200 (4.2KB) | 200 (60KB) | soft-200 | soft-200 | 0 | Good |
| BrowserOS (browseros.com) | 200 (11.7KB) | 404 | 404 | 404 | 21 | Good |
| Duckie (duckie.ai) | 200 (9.6KB) | 404 | 404 | 404 | 2 | Good |
| AgentMuxer (agentmuxer.com) | 200 (6.6KB) | 404 | 404 | 404 | 1 | Good |
| Prompting Co. (promptingcompany.com) | 200 (3.4KB) | 404 | 404 | 404 | 2 | Good (eats own dog food) |
| Scope (tryscope.com) | 200 (3.9KB) | 404 | 404 | 404 | 1 | Good |
| Laminar (laminar.sh) | 404 | 404 | 404 | 200 (real docs) | 3 | Mid — docs, no llms.txt |
| Tracecat (tracecat.com) | 404 | 404 | 404 | 404 | **43** | Mid — MCP-heavy homepage; docs.tracecat.com unprobed/unverified |
| Vespper (vespper.com) | 404 | 404 | 404 | 404 | **38** | Mid — *sells* an MCP but publishes no keyless surface at root |
| Alter (alterauth.com) | 404 (empty) | 404 | 404 | 404 | 5 | Weak — MCP talk, no surface |
| IncidentFox (incidentfox.ai) | 404 | 404 | 404 | 404 | 3 | Weak |
| Coval (coval.dev→coval.ai) | 404 | 404 | 404 | 404 | 0 | Weak (homepage mentions API 8x; docs subdomain unverified) |
| Hamming (hamming.ai) | 404 | 404 | 404 | 404 | 0 | None |
| Osmosis (osmosis.ai) | 404 | 404 | 404 | 404 | 0 | None |
| CloudCruise (cloudcruise.com) | 404 | 404 | 404 | 404 | 0 | None |
| Wordware (wordware.ai) | 404 | 404 | 404 | 404 | 0 | None at root |
| Butter (butter.dev) | 404 | 404 | 404 | 404 | 0 | None — 2.5KB homepage |
| dari.dev | 404 | 404 | 404 | 404 | 0 | None — 1.3KB shell |
| Kura (trykura.com) | soft-200 | soft-200 | soft-200 | soft-200 | 0 | None — every path serves the same 1,550-byte shell; possibly dormant |

Headline: of 28 probed agentic claimants, **15 have a real llms.txt**, 3 have a real public
openapi.json or equivalent docs, and **9 have zero keyless agent surface at all**. "Claims
agentic, zero public agent surface" is a real and common state (~1 in 3 even among our
*hand-picked top* candidates; base rate across all 417 is certainly worse — unmeasured).

## 5. Ranked: next vendors to judge (fit + surface + alive, probes 2026-10-02)

1. **Freestyle → agent-sandboxes** — llms.txt + 245KB openapi.json + real /docs; the fullest
   keyless surface in the sweep; direct e2b/daytona head-to-head.
2. **Sim → workflow-automation** — OSS agent-workflow builder; llms.txt + 1.6MB llms-full +
   MCP mentions; natural n8n/gumloop rival.
3. **Raindrop → llm-evals-observability** — "Sentry for AI Agents" is exactly the arena frame;
   llms.txt + docs 200.
4. **Cua → agent-sandboxes** — already queued at 0.19; probe evidence (llms.txt, docs, 11 MCP
   hits) says that score undersells it — recommend boost.
5. **Locus → agentic-commerce** — first YC-native agent-payments candidate with a real surface
   (llms.txt + 1.16MB llms-full); also anchors the agent-payments gap cluster.
6. **Dedalus Labs → mcp-infrastructure** — persistent agent computers / MCP gateway; llms.txt +
   llms-full, MCP-heavy homepage.
7. **Captain → search-infra** — agent-native file search; llms.txt + 143KB llms-full, 27 MCP
   mentions.
8. **Financial Datasets → banking-data-apis (adjacent)** — 318KB public openapi.json + llms.txt;
   strongest API story probed; needs an arena-fit call (market data vs bank data) first.
9. **Codag → model-gateways** — agent-permissioned AI gateway; llms.txt + llms-full + docs 200.
10. **Duckie → ai-support-agents** — llms.txt 200; W24 vintage (survived 2+ years); seventh
    roster seat next to parahelp.
11. **Terse → durable-workflows** — durable agent state; llms.txt + 60KB llms-full (ignore its
    soft-200 docs shell).
12. **BrowserOS → browser-agents** — OSS agentic browser, llms.txt + 21 MCP mentions; needs a
    roster-fit call (consumer browser vs agent infra arena framing).
13. **Laminar → llm-evals-observability** — real docs tree, active OSS; no llms.txt yet.
14. **AgentMuxer (Amorphic Labs) → mcp-infrastructure** — "OpenRouter for agent tools",
    llms.txt 200; very young (S26), re-check viability before judging.
15. **Coval → llm-evals-observability** — voice/chat agent sim is a roster hole, but keyless
    surface is weak; judge only after checking docs subdomain (unverified here).

## 6. Honest negatives & sweep disagreements

**Claims agentic, zero (or near-zero) public agent surface** (all probed 2026-10-02, root
domains only): Butter, Wordware, dari.dev, Kura, Hamming, Osmosis, CloudCruise, IncidentFox,
Alter, Vespper (ironic: its product *is* an MCP), Tracecat (43 MCP mentions on the homepage but
every probed path 404 — its docs likely live on an unprobed subdomain, unverified). None of
these should be judged on claims alone; the negatives are themselves evidence if any gets
rostered later.

**yc-map.json undercounts tracked vendors.** 9 agentic claimants are already in arena rosters
but carry `mappedArena: null` in data/yc-map.json: Mastra (agent-frameworks), Mem0 (ai-memory),
Undermind (ai-research-agents), Parahelp (ai-support-agents), Browser Use (browser-agents),
Reducto (document-extraction), AgentMail (email), Retell AI (voice-agents), Gumloop
(workflow-automation). Likely cause: the map matches by website domain (yc-shared.ts
normalizeDomain) but arena products.json entries store no website, so the matcher can't see
them. Worth a pipeline fix; until then, treat mappedArena=null as "unknown", not "untracked".

**Queue agreements/disagreements.** ByteAsk's 0.81 top-of-queue score holds up. Cua (0.19)
looks underscored given its probe results (above). Several yc-queue entries carry obviously
wrong arena labels from the classifier (e.g. fixa → "ecommerce-platforms" for a voice-agent
eval tool; Grep AI, Agent Relay, InsForge → "ecommerce-platforms") — the queue's arena field
should be treated as a hint, not a decision.

**Unverified / open items.** docs.* subdomains unprobed for all 28 (root-domain probes only).
Klavis AI (X25) — previously known for MCP servers — now one-lines as "High Quality Coding &
Agentic Data for AI labs"; apparent pivot away from MCP infra, feed one-liner only, unverified.
All "autonomous company" cluster capabilities unverified. F26 counts provisional (batch
filling: 91 → 108 companies between 2026-09-25 and 2026-10-02 fetches).
