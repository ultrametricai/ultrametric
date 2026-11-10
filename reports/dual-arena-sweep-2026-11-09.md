# Dual-arena membership sweep, 2026-11-09

Maintainer-ordered sweep of the existing roster for second-arena membership. The test is the
identity-reuse precedent set (statsig in feature-flags and product-analytics; sentry in
error-tracking and observability; firstbase, stripe-atlas, and legalzoom across legal-ops and
registered-agents): a product joins a second arena when its documented capabilities are
on-axis there and the agentic-surface criterion holds. The adjacent JSON carries every pair
considered with its evidence pointer. Approved pairs were executed in this PR through the
standard scoped engine run; coordinator-review pairs are recorded for a maintainer-side
decision and were not executed.

## Approved and executed

| product | from | to | basis |
| --- | --- | --- | --- |
| posthog | product-analytics | feature-flags | full flag product: creation, targeting, rollouts, public API, MCP flag management (statsig precedent, reversed) |
| datadog | observability | llm-evals-observability | LLM/Agent Observability documented: traces, evaluations, dashboards, Python SDK with auto-instrumentation |
| linear | project-management | product-feedback | Customer Requests: feedback capture from six sources plus API, linked to issues, prioritization views; all plans |

The linear row carries a flag for the reviewer: `open-rankings/product-families.json` calls
Customer Requests a plan-gated feature rather than a product line; membership here tests the
Linear identity against the product-feedback stories, the same single-product pattern as
statsig.

## Coordinator review (recorded, not executed)

elastic → observability; sentry → llm-evals-observability; amplitude → feature-flags;
supabase → auth-platforms; github → project-management; gitlab → security-scanners;
hubspot → email-marketing; inngest → workflow-automation (restate, hatchet, dbos follow that
outcome); modal → gpu-clouds; next-js → frontend-frameworks (new identity); figma-make →
vibe-coding (new identity); notion → notes-knowledge. Each row in the JSON names what needs
verifying at review.

## Skipped or out of scope

notion → docs-platforms (developer docs-as-code arena; off-axis); vercel → ci-cd and
launchdarkly → experiments (no live arena; new rankings are a human decision);
stripe → billing-subscriptions and deepgram → voice-agents (already covered);
airwallex → expense-management (already in flight on scan PR #670); zapier →
durable-workflows (no checkpoint/exact-resume contract); notion-calendar → scheduling
(no agentic surface); ramp → fp-a (no modeling/forecasting surface); the Anthropic product
family (affiliated; second arenas are maintainer-only).
