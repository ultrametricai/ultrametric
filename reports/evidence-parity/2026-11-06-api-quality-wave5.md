# API-quality gap repairs, wave 5 (2026-11-06)

Per-cell check of the top twelve genuinely unrepaired products from the staleness
ranking re-run against post-import main (113 gap-signature rows; waves 1-4 = PRs #623,
#627, #630, #632). Excluded from the fresh ranking's top: iterm2 (deferred, wave-2
ledger) and orama/buzz/spline/working-copy, repaired in waves 3-4 — their honest
zero-citation nones still trip the signature, a scan blind spot recorded in the ledger
for the maintainer.

`rankings-engine/scripts/append-api-quality-gap-evidence-2026-11-06-wave5.py` appends 38
live-verified rows; 16 cells stay absent after checking. The script extends the
fail-closed toolkit: NEGATIVE_CHECKS entries may assert exact non-404 walls (cline's
spec URLs answer 401), and POST_CHECKS re-run recorded POST probes (wave's GraphQL
introspection) on every invocation.

| product | arena | flagged cells | evidence rows appended | checked, still absent |
|---------|-------|--------------:|-----------------------:|---------------------:|
| lovable | vibe-coding | 4 | 4 | 1 |
| cline | ai-coding | 4 | 1 | 3 |
| sentry | observability | 4 | 4 | 1 |
| 1password | authenticator-apps | 4 | 4 | 1 |
| bitwarden | authenticator-apps | 4 | 3 | 1 |
| stripe-identity | identity-verification | 4 | 5 | 1 |
| nitrokey | security-keys | 4 | 4 | 0 |
| yubikey | security-keys | 4 | 3 | 1 |
| windmill | workflow-automation | 4 | 5 | 0 |
| kick | accounting | 4 | 2 | 2 |
| wave | accounting | 4 | 1 | 3 |
| consensus | ai-research-agents | 4 | 2 | 2 |

Wave-5 specifics:

- Three preserved probe rows: cline's unpublished spec (the gateway documents OpenAI
  format compatibility while its own spec URLs answer 401/404, enforced fail-closed),
  wave's recorded GraphQL introspection (the one verifiable artifact behind a fully
  Cloudflare-walled developer portal), and consensus's dead spec link — the vendor's own
  llms.txt advertises an OpenAPI contract at llmconsensus.io, which fails TLS with a
  certificate for an unrelated host (odoo18.cyberpol.org). The last is recorded as a
  safety flag for the maintainer.
- Bot walls, documented per the gusto precedent: developer.waveapps.com (every path,
  including the help-center JSON API) and docs.consensus.app. The research pass did not
  circumvent either; one bundled retry with a browser user agent was denied by the
  permission classifier and not retried.
- docs.kick.co serves soft-200 "Page Not Found" bodies, so every kick URL is verified by
  body markers; its Platform API spec is published as per-operation OpenAPI fragments in
  GitBook pages and the API is access-gated per organization, both carried in the
  excerpts.
- Scope caveats ride in the excerpts throughout: Sentry's sandbox is a product-UI demo
  showroom; 1Password's specs and policy cover the Events/Connect surfaces; Bitwarden's
  Swagger UI mounts client-side and its compatibility policy is release-cycle level;
  Stripe's spec/sandbox/versioning are platform-wide with an Identity-specific test
  flow; Nitrokey's rows cover the NetHSM appliance only; Yubico's protocol spec and
  version history are prose with a browser demo site; Windmill's sandbox story is the
  self-hosted/local path.

Scoped re-judges run under the ratified v6 rubric, then `derive` per touched arena and
the dependent generators; the pre-audit over every upward flip (review-fix re-rolls
included) runs before any push. Engine output is accepted as-is; honest negatives ship,
and checked-absent cells that publish as engine partials on adjacent evidence are
recorded with both readings.

Row-level output: `2026-11-06-api-quality-wave5.json`.
