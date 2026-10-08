# Ultrametric CLI/MCP self-evaluation — keyless probe sweep

Date: 2026-10-07 (founder ask: "self eval using the probe stuff we built, on the UM CLI/MCP;
find out what the best functions are that we do").
Subject: `ultrametric@0.4.1` (npm `dist-tags.latest`) and the hosted MCP at
`https://api.ultrametric.ai/mcp`.
Evidence: `docs/self-eval-probes/run-self-eval-keyless.sh` →
`docs/self-eval-probes/transcript-self-eval-keyless.txt`, a verbatim session with exit codes,
captured the same way the vendor spikes capture theirs (`docs/cli-sandbox-spike/`).
Companions: `docs/ULTRAMETRIC-CLI-CAPABILITIES.md` (shipped-capability audit),
`docs/CLI-SANDBOX-DESIGN.md` (sandbox design that first recorded the arena defect).

First-party disclosure: Ultrametric is our own product. This evaluation applies the same
keyless-probe discipline the arenas apply to vendors, with the negatives published. Nothing
here feeds a score or a leaderboard; `ultrametric` is not a judged product (see the
membership section).

## Method

Every command `ultrametric --help` enumerates was run keylessly, exactly as a visitor with no
account could, with `--data-dir` pointed at a scratch directory so no local login or settings
leak in (`doctor` in the transcript shows the scratch paths). The hosted MCP's keyless surface
was probed with the same JSON-RPC messages our Try-it probe sends vendors. Two deliberate
non-read interactions, both keyless by definition: `auth login --json` opened a short-lived
pending login (device-code style; the recorded user code expired minutes later, unapproved),
and `auth complete` checked it once. No credentials existed anywhere in the session; refusals
are recorded verbatim.

## Function leaderboard

Ranked by what the recorded evidence shows. "Recorded result" quotes or summarizes the
transcript; the transcript itself is the authority.

### Works keyless

| Function | Recorded result | Exit |
| --- | --- | --- |
| `context schema open` / `save` / `get` | Full hosted-API input schemas (JSON Schema 2020-12) printed with no login | 0 |
| `auth login --json` | Device-code login started: `status: "pending"`, verification URI + user code returned for agent completion, no browser required | 0 |
| `auth complete <login-id>` | One pending-login check: prints the verification URI, code, expiry, and retry guidance | 0 |
| `auth status` / `auth logout` | Clean state report ("Unauthenticated…") and logout | 0 |
| `understand --json` | Complete company-profile guide: instructions, template, result schema, agent-trial spec, offline | 0 |
| `assess --json` | Complete AI-readiness assessment: four-dimension rubric, readiness levels, steps, template, result schema, offline | 0 |
| `init --dry-run` | Previews the two `SKILL.md` installs (`.claude/skills/`, `.agents/skills/`) without writing | 0 |
| `companies schema` / `list` | Company-profile JSON Schema with a worked example; empty-store listing | 0 |
| `assessments schema` / `list` | Assessment JSON Schema; empty-store listing | 0 |
| `companies validate` / `save`, `assessments save` / `show`, `companies show` | Offline validator exercised on deliberately invalid input: structured per-field `VALIDATION` errors naming each violation | 3 |
| `actions set` | Offline argument validation: rejects a bad `--status` and enumerates the allowed states (`proposed, planned, in_progress, done, dismissed`) | 3 |
| `doctor` | Version, Node, storage/auth/settings/log paths, API endpoints | 0 |
| `config show` / `config set` | Settings read and write in the scratch data dir | 0 |
| `logs show` | Per-command diagnostics: name, exit code, duration | 0 |
| `--version` / `--help` | Version and the full command surface | 0 |

The exit-3 rows are the validators working: each run produced a structured, field-level error
report on bad input, offline, which is the function's job. A fully successful `companies save`
needs a schema-complete profile and `actions set` needs a previously saved assessment; neither
needs an account.

### Auth-gated (documented refusal recorded)

| Function | Recorded result | Exit |
| --- | --- | --- |
| `process list` | `Error [AUTH_REQUIRED]: API login is required.` | 1 |
| `process get <id>` | Same `AUTH_REQUIRED` refusal | 1 |
| `process open <id>` | Same `AUTH_REQUIRED` refusal | 1 |
| `context get --json` | `{"error":{"code":"AUTH_REQUIRED","message":"API login is required.",…}}` | 1 |
| `context save` | Fails locally first: `Error [USAGE]: required option '--file <path>' not specified`; the hosted save behind it requires login per the API docs | 3 |
| Hosted MCP `initialize` | HTTP 401, body `{"error":{"code":"AUTH_REQUIRED","message":"Sign in to continue."}}` | — |
| Hosted MCP `tools/list` | Same `AUTH_REQUIRED` body | — |
| Hosted MCP auth wall metadata | `WWW-Authenticate: Bearer resource_metadata="https://api.ultrametric.ai/.well-known/oauth-protected-resource"`; the well-known document answers 200 with `{"resource":"https://api.ultrametric.ai/mcp","authorization_servers":["https://auth.ultrametric.ai"],…}` | — |

### Broken

| Function | Recorded result | Exit | Cause and fix |
| --- | --- | --- | --- |
| `arena categories --json` | `{"error":{"code":"NETWORK_ERROR","message":"Could not reach ProductArena."}}` | 1 | The CLI fetches `ultrametric.ai/productarena/data/*` with `redirect: 'error'` and the worker 301s that path. Fixed in this repo (worker serves the legacy data path directly, commit "Worker: serve /productarena/data/* directly…"); takes effect when the coordinator deploys the worker. A CLI-side base-URL fix remains worthwhile independently. |
| `arena rankings <arena> --json` | Same `NETWORK_ERROR` | 1 | Same cause, same fix |
| `arena stories <arena> --json` | Same `NETWORK_ERROR` | 1 | Same cause, same fix |
| `arena verdict <arena> <product> <story> --json` | Same `NETWORK_ERROR` | 1 | Same cause, same fix |

## Summary

The keyless `ultrametric` surface is diagnostics, hosted-API schemas, a complete agent-driveable
device-code login flow, schema-validated local record stores, and two full offline guides. Every
process-shaped function (`process list/get/open`, `context get/save`) refuses without a login,
so a keyless visitor cannot retrieve or run a single hosted guide. The hosted MCP refuses even
the keyless `initialize` handshake. Measured against the tiers our own Try-it probe applies to
vendors: it does not reach the keyless-handshake tier (the tier where an MCP answers
`initialize` + `tools/list` without credentials, which several judged vendors and our own
`self/productarena` demo endpoint do reach), and it lands in the documented-auth-wall tier,
where it does carry the full RFC 9728 pattern (401, `WWW-Authenticate` with
`resource_metadata`, a live well-known document) that our probe credits vendor walls for. All
four `arena` commands fail in production because of our own redirect defect; the worker fix is
committed in this repo and the rows above stay classified broken until the deploy is verified.

## Best functions

The founder's question, answered from the evidence:

1. **`context schema open|save|get`** — the hosted API's input contracts, keyless. The cleanest
   "agent can integrate before signing in" function we ship, and the piece the sandbox design
   already picked as live-probe material.
2. **`auth login --json` + `auth complete`** — a device-code login built for agents: structured
   pending state, verification URI, user code, retry guidance. The transcript shows the whole
   flow working keylessly up to the approval step.
3. **`understand` / `assess`** — the largest keyless payloads: a complete company-profile guide
   and a four-dimension AI-readiness rubric with templates and result schemas, fully offline.
   A visitor gets real, usable content with no account.
4. **`companies` / `assessments` / `actions`** — local, revisioned, schema-enforced record
   stores whose validators return field-level errors. This is the records half of
   "guides + records" working without any hosted dependency.
5. **`doctor` / `logs show` / `config`** — diagnostics that state paths, endpoints, exit codes,
   and durations, which made this sweep itself easy to verify.
6. **`arena categories|rankings|stories|verdict`** — once the worker fix deploys, the best
   keyless data function: the evidence corpus readable from any shell. Today it is the defect
   row above.

## Gaps that matter most

1. **The `arena` defect** (fix committed, deploy pending). Until deployed, the one CLI surface
   that needs no account fails for every user.
2. **No keyless tier on the process surface.** `process get` of even one demo guide would let a
   visitor see the product's core value before login; today the recording of a refusal is the
   only keyless experience. Same conclusion the sandbox design reached from the vendor side.
3. **Hosted MCP refuses keyless `initialize`.** The wall is well-formed (RFC 9728), but a
   keyless `initialize` + `tools/list` with auth-gated `tools/call` would put the endpoint in
   the same tier our probe ranks vendor MCPs highest for, at no data exposure (tool metadata
   only).
4. **CLI base URL still points at the legacy path.** The worker fix makes the shipped CLI work;
   the next CLI release should fetch `/data/*` directly so the legacy path can someday retire.

## Arena membership

Framed for the founder; not executed here. Owner-product rules apply (disclosed, adversarially
audited, never favored), and the Instinct bring-up is the precedent that a thin probe surface
produces a low coverage grade and that the result publishes anyway.

- **Nearest existing arena:** `legal-ops` ("Startup Legal & Incorporation": Stripe Atlas,
  Clerky, Firstbase, LegalZoom…). The hosted processes overlap its ground (incorporation, EIN,
  registered agent, cap table), but those vendors execute filings and Ultrametric by design
  executes nothing: it serves guides and stores records while the user's agent does the work.
  Most execution-shaped story verdicts would come back `none`/`na`, and the auth-gated process
  surface would give the probe tier little to see, so the entry would score low for structural
  reasons the stories were not written to measure.
- **The alternative: none yet.** Keep `ultrametric` as the disclosed first-party product
  (current state: sim rows, `/get-started`, the planned `'self/ultrametric'` MCP demo key)
  until an arena exists whose stories measure agent-facing process guidance and record keeping
  against real competitors.
- **Recommendation:** none yet. If the founder wants it judged anyway, `legal-ops` with full
  disclosure is the defensible placement, entered with the expectation that this sweep's
  auth-gated findings become its public verdict rows, exactly as Instinct's invite wall became
  its D coverage grade.

## Proposed later surface

A `/self-eval` page (or a section on `/get-started`) replaying this sweep's transcript through
the existing Microterminal components with the first-party disclosure string, the same way
vendor proofs replay on product pages. The `auth: 'keyless'` sidecar provenance field from the
sandbox design applies unchanged. Not built this round; the founder should see this dossier
first.

## Post-deploy verification (worker fix)

After the coordinator deploys `infra/cloudflare-proxy`:

```sh
curl -sI https://ultrametric.ai/productarena/data/categories.json   # expect HTTP/2 200, content-type JSON
curl -sI https://ultrametric.ai/productarena/overall                # expect 301 -> https://ultrametric.ai/overall
npx -y ultrametric@0.4.1 arena categories --json                    # expect arena ids, exit 0
```

Then re-run `docs/self-eval-probes/run-self-eval-keyless.sh` so the broken rows can move up on
recorded evidence rather than by edit.

## Addendum (2026-10-08) — the docs site's agent surface

A positive found after the original sweep: the docs site at
<https://docs.ultrametric.ai> is keyless and agent-readable. It publishes an llms.txt index
(<https://docs.ultrametric.ai/llms.txt>) linking every page, and serves each page as markdown
at its own path with `.md` appended (for example
<https://docs.ultrametric.ai/quickstart.md>). Each cited URL answered HTTP 200 on the
addendum date, checked with `curl -s -o /dev/null -w "%{http_code}"`. This is a documentation
surface, not a data surface: the auth-gated classifications recorded above for the hosted
process and context functions are unchanged. The README's "Use it from an agent" section now
cites it alongside the other surfaces.
