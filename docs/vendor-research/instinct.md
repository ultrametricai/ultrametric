# Vendor research: Instinct (Spear Street Technology, Inc.)

**Status: JUDGED (2026-10-02).** Previously HELD (invite-only, ToS bars probing). The founder
asked for it in (2026-10-02); it was brought up and judged under the ToS-respecting methodology
below. Judged result: **#14 of 15** in ai-assistants (aiEra 15.1, band 15.1–18.6; agentReady 2.0,
band 2–7), coverage grade **D** — the honest consequence of a near-zero probe tier.

## ToS-respecting methodology (2026-10-02 bring-up)

Instinct's ToS prohibits automated access to the Services ("any robot, spider, crawlers,
scraper"), and the product is invite-only, so the usual hands-on/probe ladder is unavailable.
The bring-up therefore used ONLY:

1. **robots.txt check FIRST** (single fetch, 2026-10-02): https://instinct.com/robots.txt serves
   200 text/plain, last-modified 2026-10-02, and allows ALL user-agents on ALL paths (named
   Allow:/ blocks for Googlebot/Bingbot/Applebot/OAI-SearchBot/ChatGPT-User/PerplexityBot/
   Claude-SearchBot/Claude-User, plus default `User-agent: * / Allow: /`), pointing at
   sitemap.xml. This explicit crawler grant — the vendor's own machine-readable permission
   signal — is what sanctioned step 2.
2. **Standard single-fetch crawl of public pages only** (the pipeline's identified
   Ultrametric/1.0 UA): homepage, /terms, /privacy-policy. No path-fishing (no /llms.txt,
   /openapi.json, /docs guesses), no re-probing of the 2026-10-01 findings, no app.instinct.com
   access, no invite-wall circumvention. The sitemap (single fetch) declares exactly one URL —
   the homepage — recorded as probe-tier evidence that the vendor's declared public crawl
   surface has no docs/API/pricing pages.
3. **Third-party sources for everything else**: TechCrunch 2026-08-24 privacy investigation
   (named sources: Peter Yang, Claire Vo, Alex Cohen, Katie Jacobs Stanton, Jesse Middleton),
   TechCrunch 2026-09-28 Series C, a first-person invited-user week-long writeup
   (aibyaakash.com), two genuine HN threads (49689664 — The Atlantic credit-card piece;
   49937498 — Ask HN first-person reports), and a hands-on comparative review (top5apps.ai).
   cybernews.com 403'd the fetcher (recorded, skipped). HN name-search is pure pollution
   (AMD Instinct GPUs etc.) — curated seeds carried the pack.

Final evidence pack: 37 items — 16 claimed-docs, 19 community, 2 probe (robots.txt +
sitemap.xml, the only direct HTTP observations, both crawler-facing metadata files published
for automated consumption). Judged by the standard stage (claude-opus-5-5/v4), 52 cells;
incumbents byte-identical via the judge cellHash cache. Capability claims that only an
invite-holder could verify stay claimed-docs/community tier, and the D coverage grade and wide
bands say so — that is the grading system working as designed.

---

Research lane, fetched 2026-10-01. Evidence pack raw material below (pre-judging state;
the 2026-10-01 probe rows were NOT re-run on 2026-10-02 — see methodology above).
All URLs below were fetched on 2026-10-01 unless noted; tiers follow the evidence-pack convention
(`claimed-docs` = vendor's own pages, `press` = third-party reporting, `probe` = direct HTTP observation).

## Which "Instinct"?

The founder's ask was ambiguous in principle, but in practice there is one dominant candidate:
**Instinct, the invite-only consumer personal AI assistant from Spear Street Technology, Inc.
(San Francisco), at instinct.com** — the most talked-about personal-AI launch of August–September 2026,
with a $1B Series C at a $10B valuation announced 2026-09-28. No other AI vendor named "Instinct"
surfaced in searches with comparable recency or relevance (the nearest distractors: *instinctools,
a software-services firm; AMD's "Instinct" GPU line, which is a hardware SKU, not a vendor).
This doc maps the Spear Street product. If the founder meant AMD Instinct accelerators, that is
gpus-arena territory and a different workstream — say the word.

## What it is

- Personal AI assistant you **text or call** — "a personal assistant that understands what you're
  working on and what's important to you." It connects to "your applications and devices" (email,
  messaging, screen, audio, location) and takes action: "following up on threads you've dropped,
  proactively calling or texting you, arranging a ride to the airport, booking a handyman."
  — https://instinct.com (homepage, fetched 2026-10-01, claimed-docs)
- Legal entity: **Spear Street Technology, Inc. d/b/a Instinct**; Terms effective 2026-08-26; service
  defined as "Website (instinct.com and subdomains), Mac OS application, and mobile applications";
  18+ only; mandatory arbitration. — https://instinct.com/terms (fetched 2026-10-01, claimed-docs)
- Founder/CEO: **Noah Shinn**. Launched invite-only in **August 2026**. Operates via SMS/texting and
  phone calls; TechCrunch reports "no mobile app yet" (2026-09-28) — note the tension with the Terms'
  "Mac OS application, and mobile applications" language (Terms may be forward-looking).
  — https://techcrunch.com/2026/09/28/viral-ai-agent-instinct-raises-1b-series-c-at-a-10b-valuation/
  (fetched 2026-10-01, press)

## Capabilities (as claimed/reported)

| Capability | Evidence | Tier |
|---|---|---|
| Text/call interface, no new app to learn | instinct.com homepage, 2026-10-01 | claimed-docs |
| End-to-end task execution: booking travel/restaurants, purchases, bill pay, subscription cancellation, research, groceries | TechCrunch 2026-09-28 (fetched 2026-10-01) | press |
| Uses its own phone number and computer to complete requests | TechCrunch 2026-09-28 | press |
| "Concierge" for phone calls; "trusted person network" (coordination between users' agents) | TechCrunch 2026-09-28 | press |
| Proactive outreach (calls/texts you first) | instinct.com homepage, 2026-10-01 | claimed-docs |
| Device integration: email, messaging, screen, audio, location | instinct.com homepage meta description, 2026-10-01 | claimed-docs |

## Funding / traction

- **Series C: $1B at $10B valuation** (Sequoia, Benchmark, Coatue), announced 2026-09-28 — weeks after
  launch. Company has not shared user numbers. Earlier round reported at ~$350M / $2.5B valuation
  within weeks of first invites. — TechCrunch 2026-09-28 (fetched 2026-10-01, press)
- Invite scarcity: invites reportedly resold on eBay for ~$300.
  — https://www.eesel.ai/blog/instinct-ai-pricing (post dated 2026-09-29, fetched 2026-10-01, press)

## Pricing

- **No public pricing.** Free for invited beta users; no pricing page exists ("Instinct AI costs $0
  today, and there is no published price"). Terms reserve the right to charge ("You may be required
  to pay us fees to access or use certain features"; "all payments are non-refundable"). Reported
  business-model direction: affiliate/commerce take-rate on purchases users make through it.
  — instinct.com/terms (2026-10-01, claimed-docs); eesel.ai pricing post 2026-09-29 (fetched
  2026-10-01, press)
- Negative finding: **no pricing page** — https://instinct.com/pricing returns the homepage SPA
  (probe, 2026-10-01).

## Agent-readiness signals (probed 2026-10-01)

| Probe | Result | Reading |
|---|---|---|
| https://instinct.com/llms.txt | HTTP 200 but serves the homepage HTML (SPA catch-all) | **No llms.txt** (soft-200) |
| https://instinct.com/docs | 200, homepage HTML | **No public docs** |
| https://instinct.com/pricing | 200, homepage HTML | **No pricing page** |
| https://instinct.com/api, /openapi.json, /.well-known/ai-plugin.json | 200, homepage HTML | **No API surface discovered** |
| Homepage/ToS mention of API, MCP, CLI | none | **No developer surface** |
| ToS automated-access clause | prohibits "any robot, spider, crawlers, scraper … or queries that intercepts, 'mines,' scrapes, extracts, or otherwise accesses the Services" and "automation software (bots)" | **Actively hostile to third-party agents** |

Caveat on the soft-200s: every path on instinct.com returns 200 with the homepage document, so
absence-of-404 proves nothing; the positive finding is that no path serves machine-readable content.

Summary: Instinct is an **agent, not an agent platform**. It consumes other products' surfaces;
it exposes none of its own. Zero agent-readiness by Product Arena's usual signals (no llms.txt, no
OpenAPI, no MCP, no docs site, no CLI), and its ToS forbids automated access outright.

## Arena fit

**ai-assistants.** It is a consumer personal assistant in the same product shape as roster members
poke, martin, and jo (messaging-native personal agents). It is not a frontier model, not an API
platform, not a browser-agent SDK. No new arena needed.

## Open questions

- Invite-only: we cannot run hands-on probes or Try-It flows without an invite; all capability claims
  are vendor-marketing or press until then.
- Privacy posture: initial privacy policy "raised concerns due to overreach, requiring updates"
  (TechCrunch 2026-09-28) — worth a dated re-read of the privacy policy before judging.
- Whether the macOS app (named in ToS) is shipping or forward-looking.
- User numbers: undisclosed.
