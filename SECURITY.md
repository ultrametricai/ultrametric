# Security Policy

Ultrametric (ultrametric.ai) is a static, evidence-based comparison site. The deployed site serves
pre-computed data from `rankings/` — it does not accept user input that is executed, does not run
a database, and does not call any LLM API at build or request time (see README, "Pipeline
refresh workflow"). The pipeline that *produces* the data runs locally, out of band, and is
the more security-sensitive surface (it holds an `ANTHROPIC_API_KEY` and fetches third-party
URLs) — see below for what that means for reports.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security reports.**

Use [GitHub's private vulnerability reporting](../../security/advisories/new)
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
- The pipeline (`pipeline/`) — crawl, extract, normalize, collect-community, probe, judge,
  derive stages — including SSRF/injection risks from fetching third-party vendor pages, and
  handling of the `ANTHROPIC_API_KEY`.
- GitHub Actions workflows in `.github/workflows/` (e.g. `contest-check.yml`), including how
  they handle repository secrets and untrusted issue input.

Out of scope (report, but low priority): purely cosmetic UI bugs, and disagreement with a
judged verdict's *content* — that's not a security issue, see
[CONTRIBUTING.md](./CONTRIBUTING.md) for contesting a verdict instead.

## Disclosure

We ask for a reasonable window to investigate and ship a fix before any public disclosure —
in practice, aim for 90 days or sooner once a fix is out. We'll credit reporters (unless you'd
rather stay anonymous) in the fix commit/advisory.
