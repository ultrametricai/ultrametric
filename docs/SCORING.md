# How to read an Ultrametric score

This page is for readers, not engineers — plain language, no jargon. If you want the technical
formulas and source code, see [METHODOLOGY.md](../METHODOLOGY.md).

## The short version

Every score on this site comes from a specific, citable claim about a product — a line from its
docs, its GitHub README, an independent forum post, or something we tested by hand. Nothing is
scored from "everybody knows Product X does this." If we didn't find a claim for it, the product
gets no credit for it, even if it's actually true and we just missed it. That's a deliberate
tradeoff: it means our scores are honest about what we checked, but it also means **scores skew
low compared to a product's real capability** — see "Why scores look low" below.

## What a verdict means

For every capability we track ("can a user do X with this product?"), each product gets one of
five verdicts:

- **Delivers it well (`full`)** — clear evidence the product does this, no major caveats.
- **Delivers it, with caveats (`partial`)** — it does this, but you need extra tools, it's
  limited, or it takes real effort to get there.
- **Contested (`disputed`)** — the vendor claims it works, but independent evidence (a forum
  post, a GitHub issue, a hands-on test) says otherwise. We show both sides.
- **No evidence (`none`)** — we found nothing saying the product does this. This is *not* the
  same as "the product definitely can't do this" — see "none vs. na" below.
- **Doesn't apply (`na`)** — this capability isn't a fair question for this kind of product at
  all, so it's excluded from scoring entirely (neither helps nor hurts).

## What the quality number (0–10) means

Every `full`/`partial`/`disputed` verdict also gets a quality score from 0 (barely counts) to 10
(best-in-class execution). It's not a vibe score — the judge grades against a fixed rubric, and
it reflects how complete and well-documented the capability is *in the evidence we found*, e.g.
a one-line mention scores lower than a page of docs with examples and edge cases covered.
`none` and `na` are always quality 0, since there's nothing to grade.

The rubric anchors:

| Quality | What it means |
|---|---|
| **10** | Best-in-class: every part of the capability is backed by strong evidence — in-depth official docs *and* independent or hands-on confirmation. Nothing material missing. |
| **9** | Fully delivers with rich documentation; exactly one minor gap (e.g. nobody independent has confirmed it yet). |
| **7** | Clearly delivers the core, but with real secondary gaps — parts thin, undocumented, or only implied. |
| **5** | Delivers about half of it, or only with substantial limitations/workarounds. |
| **3** | Minimal, glancing support — a single thin mention; most of it unevidenced. |
| **1–2** | Barely counts. |

And a transparency rule we enforce mechanically: **any score below 10 must say what's
missing.** The judge's rationale has to include a "missing for 10: …" clause naming the
specific missing capabilities or evidence — a verdict claiming "full support" at 8/10 with no
stated gap is rejected and re-judged. If you see a sub-10 score, the reason is written next
to it.

## Only on-topic evidence counts

A citation may only support — or count against — a verdict if it's actually *about* the
capability being judged. General negative buzz about a product (an unrelated security story,
pricing complaints, gripes about some other feature) is ignored entirely: it can't lower a
verdict, and the judge isn't allowed to cite it. A real example we fixed: a product's
sandboxing score was once dragged down by a forum thread about the vendor leaking its own
source code — bad news, but it says nothing about whether the product sandboxes agent
execution, so under the current judge it's inadmissible for that verdict. Negative evidence
still matters when it's on-topic (e.g. a hands-on post showing the sandbox doesn't actually
isolate anything) — that's exactly what the `disputed` verdict is for.

## `none` vs. `na`: the difference that matters most

This is the single most common source of confusion, and the mistake we're actively correcting
in this pass of the site.

- **`na` = wrong question.** The capability fundamentally doesn't apply to this kind of product.
  Example: "can I install this on my desktop" doesn't apply to a cloud API — there's no desktop
  install to grade. `na` cells are dropped from scoring entirely.
- **`none` = right question, no evidence found (yet).** The capability *could* apply, but we
  didn't find proof the product delivers it. `none` still counts against the product's score.

Getting this wrong in either direction breaks trust: marking something `na` when it actually
applies quietly hides a real weakness from the score; marking something `none` when it's really
`na` unfairly punishes a product for not doing something it was never supposed to do. A concrete
example we fixed: whether a product "ships an official MCP server" is the wrong question for a
coding *agent* (it doesn't serve tools to other agents — it consumes them), so we now score
agents on a separate "can it connect to MCP servers" story instead, and mark the "ships a server"
story `na` for them, not `none`.

## What "thin evidence" (`?` / low confidence) means

Alongside every verdict, we show a confidence level: high, medium, or low. Low confidence means
we only found one weak or indirect signal — take that verdict as a starting point, not a final
word. It's a flag to double-check, not proof the verdict is wrong.

## How the overall Overall score is built

Each product's score is a percentage: how much of its *applicable* (non-`na`) capability weight
it actually earned, given the verdicts and quality scores above. Bigger, more important
capabilities (a "core" story) count for more than nice-to-haves. A product that scores 40/100
isn't "40% as good as a perfect product" in some absolute sense — it earned 40% of the
evidence-backed credit available to it.

On top of the raw coverage score, we also publish a single **Overall score** (0–100) per product —
a blend of five angles, and the first two are easy to conflate so it's worth being precise:

- **agentReady = reach.** Does an agent have a *way in* at all — an MCP server, an official CLI,
  a documented public API, agent-parseable docs? This is a yes/no-shaped question about whether
  the door exists, not how nice the room behind it is.
- **apiQuality = quality of that surface, once the door exists.** Given that an agent can reach
  the product, how good is the experience — auth model (scoped API keys vs. only full-account
  login), rate limits, SDK/client coverage, how complete and current the docs are. A product can
  score high on reach (agentReady) and low on quality (apiQuality), or vice versa — they're
  deliberately independent axes, not a single "API-ness" score.

The other three angles: how open the product is (self-host, export, source), whether the
product itself acts agentically, and how deep its automation features go. It's meant to answer
one question: "how
ready is this product for a world where AI agents, not just humans, use it?" The exact weights
are a starting position we're open to arguing about — see "How to disagree" below.

## Why scores look low

Two honest reasons, not a bug:

1. **We only score what we can cite.** A product can be excellent and still score low here if
   its docs are thin, scattered, or hard to crawl — the judge can't credit a capability it never
   saw evidence for. A low score is often "we found weak evidence for this," not "this product
   is bad."
2. **`na` doesn't inflate anything.** We don't give partial credit for "this doesn't apply to
   you" — those cells are simply excluded, so a product's score reflects only the questions that
   were fair to ask it.

If a score looks wrong to you, it's very possible the evidence pack is thin, not that the
product is bad — which is exactly what the contest flow below is for.

## How to disagree

Every verdict on the site has a "⚑ contest" link that opens a prefilled GitHub issue — you fill
in the correct verdict and the evidence (a URL and quote) backing it up. A maintainer checks
your evidence against what's on file and, if it holds up, re-judges the product and updates the
score with a reference to your issue. See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full
flow, including how to add evidence yourself via a pull request.

Scores here are not meant to be the final word — they're meant to be arguable, in public, with
receipts.
