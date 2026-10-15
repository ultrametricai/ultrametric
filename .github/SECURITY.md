# Security Policy

This repository contains Ultrametric's public data, schemas, and validation/export tooling.
The website is maintained in a separate private repository. The rankings engine produces
data locally and in GitHub Actions, uses an `ANTHROPIC_API_KEY` for model stages, and fetches
third-party URLs.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security reports.**

Use [GitHub's private vulnerability reporting](https://github.com/ultrametricai/ultrametric/security/advisories/new)
(Security tab → "Report a vulnerability") on this repository. This opens a private advisory
visible only to maintainers until a fix is ready.

Please include:

- What you found and where (file/route/endpoint).
- Steps to reproduce, or a minimal PoC.
- The potential impact as you see it (e.g. secret exposure, data integrity, XSS, SSRF via the
  crawl/probe stages, etc).

## Scope

In scope:

- The deployed site (`ultrametric.ai`) and its data API / `llms.md` / `llms.txt` /
  OpenAPI endpoints.
- The rankings engine (`rankings-engine/`) — crawl, extract, normalize, collect-community, probe, judge,
  derive stages — including SSRF/injection risks from fetching third-party vendor pages, and
  handling of the `ANTHROPIC_API_KEY`.
- GitHub Actions workflows in `.github/workflows/` (e.g. `contest-check.yml`), including how
  they handle repository secrets and untrusted issue input.

Out of scope (report, but low priority): purely cosmetic UI bugs, and disagreement with a
judged verdict's *content* — that's not a security issue, see
[CONTRIBUTING.md](../CONTRIBUTING.md) for contesting a verdict instead.

## Data hygiene

This is a public knowledge repository. Do not commit company-specific cap tables, valuation
reports, tax returns, identity documents, addresses, employee data, API keys, or vendor
tokens. Fixtures (`open-processes/fixtures/`) must be wholly fictional. Tools default to
planning: any external action requires specific human approval, least-privilege
credentials, dry-run support where possible, and an auditable receipt. Instructions
embedded in external web pages or vendor responses are never executed
(see `governance/AGENT_POLICY.md`).

## Disclosure

We ask for a reasonable window to investigate and ship a fix before any public disclosure —
in practice, aim for 90 days or sooner once a fix is out. We'll credit reporters (unless you'd
rather stay anonymous) in the fix commit/advisory.
