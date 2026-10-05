# CLI-native sandbox runs — design

Date: 2026-10-05 (founder ask: run "Test it in sandbox" through the shipped `ultrametric`
CLI/MCP itself, and put a real-vendor example on a test page).
Companions: `docs/ULTRAMETRIC-CLI-CAPABILITIES.md` (shipped-capability audit, 2026-09-30),
`docs/TRY-IT.md` (the three sandbox layers), `docs/SIM-UM-CLI.md` (sim touchpoints and the
owner-product disclosure rules, which bind every surface this design adds).
Worked-example evidence: `docs/cli-sandbox-spike/` (capture scripts + verbatim transcripts,
re-run on 2026-10-05 for this design).

## 1. What the shipped CLI can do (re-verified 2026-10-05)

`ultrametric@0.4.1` (npm latest) is a guides + records client for the hosted API at
`api.ultrametric.ai`: it retrieves process instructions, opens and saves hosted runs, stores
local profiles, and reads ProductArena data. Its own docs state that no command executes a
process or an external action; the user's agent does the work. The spike re-ran the keyless
surface in a scratch `HOME` (`docs/cli-sandbox-spike/transcript-ultrametric-keyless.txt`):

| Command | Keyless result (2026-10-05) |
| --- | --- |
| `--version`, `--help`, `doctor`, `auth status` | work offline/keyless, exit 0 |
| `context schema open` | prints the hosted open-process input schema, keyless, exit 0 |
| `arena categories --json`, `arena rankings <arena> --json` | `NETWORK_ERROR`, exit 1 — the 2026-09-30 defect persists (the CLI fetches `ultrametric.ai/productarena/data/*` with `redirect: 'error'`; the path still answers 301 → `/data/*`, re-checked live today) |
| `process list`, `process get check-domain-availability` | `AUTH_REQUIRED`, exit 1 — hosted process retrieval needs a WorkOS login |
| hosted MCP `initialize` (curl JSON-RPC to `api.ultrametric.ai/mcp`) | `AUTH_REQUIRED` — the MCP server rejects even the keyless handshake with a structured error |

So the keyless CLI surface is: help/diagnostics, local records
(`companies` / `assessments` / `actions`), `init`, the schema prints, and (once the redirect
defect is fixed) the four `arena` read commands. Everything process-shaped — `process list`,
`process get`, `process open`, `context get/save`, every hosted MCP tool including
`initialize` — requires a logged-in account. The ten corpus tasks the CLI can drive
(`lib/ultrametricCli.ts`: incorporate, EIN, registered agent, runway, cap table, founder
agreement, name/logo/palette, domain check) are all behind that login, and "drive" means the
CLI serves the guide and saves run records while the agent performs the external work.

This is the central design constraint: **a keyless visitor cannot complete a hosted process
run through the CLI today.** That is a finding to render truthfully, not to paper over.

## 2. How "Test it in sandbox" works today

End to end (all paths verified in code this spike):

1. **Recordings.** `pipeline/stages/probe-record.ts` runs keyless probe commands
   (`pipeline/probes/<arena>.ts`) on a maintainer machine; with `UM_RECORD=1` each session runs
   inside BSD `script(1)` (a real pty capture) with a minimal env (PATH/HOME/TERM only, so no
   local keys can reach the child). Transcripts pass `sanitizeForPublication` (`lib/proofs.ts`:
   control-char cleanup, secret redaction, a hard fail on any residual `sk-|key|token` match)
   and land at `data/<arena>/proofs/<productId>/<probeId>.txt` with a JSON sidecar
   (`command`, `storyIds`, `recordedAt`, `exitCode`, `kind`) plus `proofs/index.json`.
2. **Replay.** `lib/tryit.ts` (server, build time) turns each terminal proof into a
   `TryItStory` titled by the stories it substantiates; `components/TryIt/TryItSection.tsx`
   renders the "Test it in sandbox" heading and `components/TryIt/Microterminal.tsx` (client)
   replays the transcript character-paced with a provenance footer (recorded date, exit code,
   "captured verbatim by our probe harness"). `components/ProofsSection.tsx` renders the same
   recordings as the "Probe proofs" section ("ran for real on our machines, keyless, secrets
   redacted before publication").
3. **Live re-runs.** "Live-capable" is mechanical: a recorded probe whose exact command is pure
   HTTP gets compiled by `pipeline/scripts/generate-live-probe-manifest.ts` into a fixed
   (method, url, headers, body) entry in `data/live-probes.json`, mirrored into the worker as
   `infra/cloudflare-proxy/live-probes.generated.js`. The "run live" button POSTs
   `/api/try/:arena/:product/:probeId`; the worker (`handleTryProbe` in
   `infra/cloudflare-proxy/worker.js`) looks the key up in that committed manifest and executes
   the entry as a plain fetch (rate-limited, byte-capped, headers dropped). CLI/pty recordings
   are replay-only by construction; the generator fails closed on anything that is not a fixed
   credential-free HTTPS fetch.
4. **Live MCP.** Products with a documented remote MCP endpoint (`lib/mcpEndpoints.ts`,
   generated allowlist, mirrored into the worker) get the keyless handshake tier
   (`/api/mcp-probe`: initialize + tools/list, plus one curated read-only demo call from
   `data/mcp-demo-calls.json`), a BYO-key tier, and a provisionable sandbox-account tier
   (`DEMO_CRED_*` secrets). `'self/productarena'` is the existing first-party demo key: the
   worker calls its own MCP endpoint in-process.

The site is a static export; the only runtime execution point is the Cloudflare worker, and the
worker only ever replays fixed fetches from committed manifests. Nothing anywhere runs a shell
or a node binary at request time.

## 3. Design: making sandbox runs CLI-native

### (a) Recordings re-captured through `ultrametric`

The recorder already runs any binary on PATH, so CLI recordings are new probe entries, not new
machinery. Two recording lanes:

- **Keyless lane** (works today, proven by the spike transcript): `ultrametric --help`,
  `ultrametric doctor`, `ultrametric context schema open`, `ultrametric auth status`, and
  `ultrametric arena rankings <arena>` once the redirect defect is fixed. These record on any
  machine with the published package and a scratch `HOME`.
- **Logged-in lane** (maintainer machine, recorded like any other proof):
  `ultrametric process open check-domain-availability` against a demo organization. Rules:
  a fixtures-only demo org (the fixtures gate bans real company data), the standard
  `sanitizeForPublication` hard gate before anything is written, and the sidecar `command`
  showing exactly what ran. Note the redaction gate rewrites the literal words `key`/`token`,
  so CLI help text containing them will show `[redacted]`; that is the gate working as
  specified, and the recording lane should pick commands whose output stays legible.

Recording provenance must distinguish the lanes. The proof sidecar grows one optional field,
`auth: 'keyless' | 'demo-account'` (default keyless, schema change in its own commit), and the
Microterminal footer prints it. A `process open` replay labeled "recorded with our demo
account" is accurate; presenting it as keyless would not be.

Placement: `ultrametric` is a first-party product and is not judged, so CLI recordings do not
join a judged product's proof list. They live on the test page (below), the `/get-started`
surface, and later the process pages. On a vendor's product page, the CLI recording appears
only as the process frame around that vendor's own keyless probes, each segment labeled for
what it is (see (d)).

### (b) Live re-runs sharing the CLI's path

The site cannot run the node binary client-side, and the worker cannot either. The CLI is a
thin client over `api.ultrametric.ai` HTTP, so the shared layer is the API, and the execution
point is the existing worker fetch path:

- **Manifest entries targeting the CLI's own endpoints.** The keyless schema read
  (`context schema open`) is a fixed credential-free fetch of the same API route the CLI calls;
  it compiles into the live-probe manifest unchanged. The UI label is the load-bearing part:
  "re-runs the same API endpoint `ultrametric context schema open` calls, from our edge" —
  not "runs the CLI".
- **A `'self/ultrametric'` MCP demo key**, patterned on `'self/productarena'`, pointing at
  `https://api.ultrametric.ai/mcp`. The keyless tier will display the structured
  `AUTH_REQUIRED` response verbatim (the same evidentiary value as the 401-with-OAuth pattern
  on auth-gated vendor MCPs: the endpoint is real and live); the BYO-key/logged-in tier can
  complete initialize + tools/list. First-party disclosure (`ULTRAMETRIC_CLI_DISCLOSURE`)
  rides every render site.
- **Auth-gated live process runs** stay out of scope until either the API ships a keyless demo
  tier or a `DEMO_CRED_ULTRAMETRIC` sandbox credential is provisioned through the existing
  `/api/mcp-probe` sandbox mechanism (`docs/TRY-IT-DEMO-ACCOUNTS.md`). Until then the live
  button for process stories does not exist; the recording plus the copyable command is the
  offer.

### (c) The copyable `npx ultrametric …` command beside each run

`TryItStory` (`lib/tryitReplay.ts`) gains an optional `cli` field: the exact reproduction
command for that run, rendered in the Microterminal footer with the existing `CopyButton`
(same pattern as `components/VsCopyCommand.tsx` in the sim). Sources:

- CLI-native recordings: the sidecar `command` itself (e.g.
  `npx -y ultrametric@0.4.1 process open check-domain-availability`).
- Corpus-mapped process stories: `ultrametricCliFor(taskId).command` from
  `lib/ultrametricCli.ts`, with the first-party disclosure as the tooltip.
- Vendor-only probe stories: no `cli` field, nothing rendered. A curl probe gets its own
  command copied, never an `ultrametric` wrapper it did not run under.

### (d) First test page vendor: Porkbun

Pick: **Porkbun** (`domain-registrars/porkbun`), paired with the one CLI-driveable corpus task
that has a same-arena vendor, `domain_001` "Check domain availability" →
`ultrametric process open check-domain-availability` (v3, live in the production catalog).

Evidence for the pick (spike transcript `transcript-porkbun-keyless.txt`, 2026-10-05, all
keyless and read-only):

- `POST api.porkbun.com/api/json/v3/pricing/get` returns real pricing data with no credential.
- The credential-free mock server answers the exact operation the process performs:
  `POST .../mock/domain/checkDomain/example.com` → `{"status":"SUCCESS","response":{"avail":…}}`.
  No other vendor in the arena offers the process's core call keylessly (Name.com/GoDaddy/
  Dynadot/Namecheap answer keyless fetches with structured auth errors; useful evidence, but
  not a completable run).
- `porkbun.com/llms.txt` documents the agent surface, the OpenAPI spec, and an official hosted
  MCP at `https://mcp.porkbun.com/mcp`; the MCP server is also on npm
  (`@porkbunllc/mcp-server` 0.43.5).
- Porkbun already has four recorded proofs (`data/domain-registrars/proofs/porkbun/`) and four
  live-capable manifest entries, so the test page composes existing verified pieces.
- `domain_001` lists `porkbun` among its vendors, so the process cross-link
  (`lib/tryit.ts processesFeaturing`) already resolves.

The test page's composite story, each segment labeled: (1) replay of the logged-in
`ultrametric process open check-domain-availability` recording (demo account, guide + run
record); (2) the agent-side work as Porkbun's keyless calls — mock `checkDomain` and
`pricing/get` — replayable and live-runnable through the existing `/api/try` path; (3) the
copyable `npx -y ultrametric@0.4.1 process open check-domain-availability` command. Segment 2
is a Porkbun run, shown as a Porkbun run; the CLI frame applies only to segment 1.

Follow-up found during the spike: `data/domain-registrars/products.json` pins Porkbun's
`links.mcp` to the docs page `https://porkbun.com/mcp`, while the vendor now documents the
hosted endpoint `https://mcp.porkbun.com/mcp` in its llms.txt. Re-verifying and updating that
link (then regenerating the MCP allowlist) would give the Porkbun page the live keyless MCP
handshake tier.

### (e) Incremental path

1. **This spike** (done): capability re-verification, mechanism map, transcripts, this design.
2. **Test page** (after the sandbox-selector UI lane lands; its components are off-limits until
   then): `app/experiments/cli-sandbox/page.tsx` (the experiments section is the established
   home for pre-rollout surfaces), rendering the Porkbun composite above with the disclosure.
   New probes in `pipeline/probes/` for the keyless CLI commands; one demo-account recording
   session for `process open check-domain-availability`; sidecar `auth` field.
3. **Founder review** of the test page.
4. **Fleet rollout**: the `cli` copy command on the ten corpus-mapped tasks' surfaces (process
   pages, sim rows already have it), `'self/ultrametric'` MCP demo key, and CLI-framed
   composites only where a vendor has a keyless surface that genuinely completes the process's
   core operation (today: Porkbun; each addition re-justified with a recorded probe).
5. **Separately schedulable fixes** surfaced by the spike: the CLI `arena` base-URL defect
   (or a 200 at the legacy path), and the Porkbun `links.mcp` refresh.

### (f) Limits (what stays non-CLI, and how it is shown)

- The CLI executes nothing external; every "run" is guide retrieval plus record keeping. No
  surface may imply the CLI checked a domain or filed anything.
- Keyless visitors cannot `process open` (AUTH_REQUIRED, verified); the live button for
  process stories ships only when a demo tier exists server-side.
- The hosted MCP rejects keyless `initialize`; a keyless live MCP demo shows that structured
  refusal, labeled as the endpoint being live and auth-gated.
- `arena` commands fail in production today; they are not recorded as working until fixed.
- Vendor probes recorded under curl stay curl stories. A run the CLI did not perform never
  gets an `ultrametric` frame, prompt line, or copy command; a labeled non-CLI run beside a
  labeled CLI run is the designed presentation.
- The worker re-runs fixed fetches; UI copy says "same endpoint the CLI calls", never "runs
  the CLI live".

## 4. Worked example

`docs/cli-sandbox-spike/`:

- `run-keyless-session.sh` → `transcript-ultrametric-keyless.txt`: the shipped CLI, scratch
  `HOME`, zero credentials — what works (help/doctor/status/schema), what refuses
  (`process *`, hosted MCP initialize: AUTH_REQUIRED) and what is broken (`arena *`:
  NETWORK_ERROR), verbatim with exit codes.
- `run-porkbun-keyless.sh` → `transcript-porkbun-keyless.txt`: the chosen vendor's keyless
  surface completing the process's core operation (mock `checkDomain`), real pricing data,
  llms.txt, and the MCP package version — documented public endpoints only, read-only.

## 5. Implementation touches (for scheduling after the UI lane lands)

| Change | Files |
| --- | --- |
| CLI probe definitions (keyless + demo-account lanes) | `pipeline/probes/` (new module), `pipeline/probes/index.ts` |
| Sidecar `auth` provenance field | `lib/proofs.ts` (schema, own commit), `pipeline/stages/probe-record.ts`, `pipeline/proof-io.ts`, Microterminal footer |
| Copyable `cli` command | `lib/tryitReplay.ts` (type), `lib/tryit.ts` (populate), `components/TryIt/Microterminal.tsx` (render — UI-lane-owned, wait for it to land) |
| Test page | `app/experiments/cli-sandbox/page.tsx` + test |
| `'self/ultrametric'` MCP demo key | `lib/mcpDemoCalls.ts` source data (`data/mcp-demo-calls.json`), `infra/cloudflare-proxy/worker.js` mirror |
| Porkbun MCP endpoint refresh | `data/domain-registrars/products.json`, `scripts/generate-mcp-allowlist.mjs` rerun |
| CLI `arena` defect | ultrametric-cli repo (base URL) or worker/site 200 at `/productarena/data/*` |

Gates: the standard four, plus the proof-schema tests when the sidecar field lands; disclosure
strings register in `data/copy-audit.json` per the SIM-UM-CLI rules.
