# Agent-Ready Certification: the self-serve conformance suite

Prove-It ([`docs/PROVE-IT.md`](./PROVE-IT.md)) records claims one story at a time. Certification
is the complement: a **fixed, keyless conformance suite** that any vendor can run against their
own product in one command, covering the surfaces agents actually depend on. Passing earns a
**dated certification** with the machine-verifiable report attached — public, re-runnable by
anyone, and expiring after 180 days.

The current implementation: the suite is `ultrametric-cli certify` (the CLI lives in its own
repo; the maintainer-side implementation the weekly sweep runs is
`pipeline/scripts/certify.ts`), the
registry is `data/<arena>/certifications.json` (`CertificationSchema` in
`lib/certifications.ts`, loaded tolerant-optionally by `lib/data.ts`), the public listing is
[/certified](https://ultrametric.ai/certified), intake is the
[Certification](../.github/ISSUE_TEMPLATE/certification.yml) issue form, and badges come from
`scripts/generate-badges.mjs` (`<productId>-certified.svg`).

## 1. The suite

```
npx ultrametric-cli certify https://docs.your-product.com --report cert-report.json
```

Six checks, all keyless, read-only, and run from the operator's machine against public
surfaces (the same conventions as the pipeline's probe stage, `pipeline/stages/probe.ts`):

| check | passes when |
| --- | --- |
| `llms-txt` | `GET {origin}/llms.txt` → HTTP 200, non-HTML, **>100 bytes** |
| `docs-md` | sampled docs pages (up to 3 `.md` links from llms.txt, else `{path}.md` on the target URL) serve markdown, not an HTML app shell — ≥1 sample must pass; `skip` when there is nothing to sample |
| `openapi` | a valid OpenAPI document (string `openapi` version + `paths` object) at `/openapi.json`, `/swagger.json`, `/api/openapi.json`, or `/.well-known/openapi.json` |
| `mcp` | a JSON-RPC `initialize` POST gets **any protocol-shaped reply**: a JSON-RPC body (result *or* error, plain or SSE-framed), or a 401 carrying OAuth protected-resource metadata — a live server's auth challenge is itself proof the endpoint speaks MCP. Candidates: `{origin}/mcp`, `mcp.{apex}`, `mcp.{apex}/mcp`, or an explicit `--mcp <url>` |
| `robots` | `robots.txt` does **not** disallow everything for `User-agent: *` (a missing robots.txt passes — nothing is blocked) |
| `structured-errors` | a request to a deliberately nonexistent API path returns a **JSON** error (4xx/5xx), not an HTML error page. API root = `--api <url>`, else the OpenAPI spec's first absolute `servers[].url`; `skip` when no root is discoverable |

Levels:

- **Certified Agent-Ready** = `llms-txt` + (`mcp` **or** `openapi`) + `robots` all pass.
- **Certified Agent-Native** = every check passes (`structured-errors` may be `skip` only when
  it was genuinely inapplicable — a skip is never silently a pass anywhere else).

`--report cert-report.json` writes the machine-verifiable record: every check's status and
detail, plus per-request URL, HTTP status, byte count, sha256 response digest, and timestamp.
That file is what gets submitted, verified, and committed.

## 2. Verification + registry

Certification is claims-with-receipts, so the protocol is deliberately symmetrical:

1. **Vendor runs the suite** against their own product and gets `cert-report.json`.
2. **Vendor submits** it via the [Certification](../.github/ISSUE_TEMPLATE/certification.yml)
   issue form, including the exact command run. Domain verification uses the same methods as
   vendor responses (`docs/VENDOR-RESPONSES.md`): `domain-email`, `github-org`, or `dns-txt` —
   we certify products, so we verify the submitter speaks for the product's domain.
3. **A maintainer re-runs the identical command** from our side — the CLI makes that one
   command — and diffs the per-check statuses against the submitted report. Content digests
   will legitimately differ for dynamic bodies; the check statuses and level must match. A
   mismatch is discussed on the issue (transient flakes get one re-run), not papered over.
4. **On a match**, one PR commits: the registry entry in `data/<arena>/certifications.json`,
   the maintainer's re-run report at `data/<arena>/cert-reports/<productId>.json` (served at
   `/data/<arena>/cert-reports/<productId>.json` like every dataset file — that's the
   `reportUrl`), and the regenerated badge.

Registry entry shape (`lib/certifications.ts`):

```jsonc
{
  "productId": "stripe",
  "level": "agent-ready",              // or "agent-native"
  "date": "2026-09-08",                // the verified run date
  "reportUrl": "/data/payments/cert-reports/stripe.json",
  "initiatedBy": "vendor"              // or "maintainer" — see below
}
```

`initiatedBy: 'maintainer'` marks certifications we ran ourselves (to seed the program, or to
spot-check) — labeled distinctly on the site, never passed off as vendor submissions. The
earned level means the same thing either way; who ran the suite is part of the public record.

**Expiry: 180 days.** Agent surfaces rot. An expired certification simply stops being a
certification — the chip disappears, `/certified` moves it to "Lapsed", the committed report
remains in history. Re-certifying is running the same command again.

Only products already listed in a ranking can hold a registry entry (the loader enforces it).
Not listed yet? [Request the product](../.github/ISSUE_TEMPLATE/request-a-product.yml) first.

## 3. Badges + display

- **Product page**: an active certification renders as an emerald chip near the header —
  level, date, and a link to the committed report.
- **/certified**: the registry page — every certified product with level, dates, initiator,
  and report; lapsed certifications stay listed as the public record.
- **Badge**: `public/badges/<productId>-certified.svg` — the shield variant reading
  `CERTIFIED AGENT-READY · <year>` (or AGENT-NATIVE), hotlinkable like the score badges.

## 4. Honesty rules

- **The suite is the certification.** No judgment calls, no partial credit, no negotiated
  exceptions: the levels are pure functions of check statuses (`certificationLevel` in
  `pipeline/scripts/certify.ts`), and the code is public.
- **Failing runs are not secrets.** We don't publish a registry of failures (this program
  certifies, Prove-It disputes), but a maintainer re-run that contradicts a submitted report
  is discussed in the open, on the submission issue.
- **Our own products play by the same rules.** Anything Ultrametric ships that appears in an
  ranking (see `affiliation` in `products.json`) can only be certified through this exact
  protocol, marked `initiatedBy: 'maintainer'` with the report committed like anyone else's.
- **A certification is not a ranking.** It never moves an Overall score, a verdict, or a
  leaderboard position — it is a conformance statement about agent-facing surfaces on a given
  date, nothing more.
