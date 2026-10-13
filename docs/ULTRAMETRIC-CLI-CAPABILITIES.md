# Ultrametric CLI / MCP capabilities — feature inventory

Date: 2026-09-30
Shipped artifact audited: `ultrametric@0.4.1` (npm `dist-tags.latest`, tarball unpacked and read).
Repo audited: `github.com/ultrametricai/ultrametric-cli` at `47565a6` ("docs(auth): explain MCP account recovery (#15)") — repo `package.json` is also `0.4.1`; repo HEAD is docs-only ahead of the published tarball. There are **no unreleased code features**; shipped == repo for all practical purposes.
Hosted service audited: `github.com/ultrametricai/ultrametric-api` (serves `https://api.ultrametric.ai` HTTP + `/mcp`), plus a live read-only production check via a logged-in CLI on this machine.
Process catalog authority: `github.com/ultrametricai/ultrametric-processes` (definitions repo; its README states **no process has been accepted into that repo yet** — the API + ProductArena catalogs are the live sources).

## What a user gets today from `npm install -g ultrametric` (0.4.1)

The CLI is a **guides + records** tool for an active agent. Its own docs are explicit: it never executes a process or an external action. It retrieves process instructions and schemas, opens/saves hosted runs and company records, stores local profiles/assessments, and reads ProductArena rankings. The user's agent does the actual work.

### Shipped commands (from `src/program.ts`, verified in the 0.4.1 tarball)

| Command | What it does | Auth | Maturity |
| --- | --- | --- | --- |
| `init` (`--path`, `--agent`, `--dry-run`, `--force`) | Installs the bundled agent skill into `.claude/skills/ultrametric/` and `.agents/skills/ultrametric/` | none | shipped, offline |
| `auth login / complete / status / logout` | WorkOS browser login (agent-friendly `--json` link + `complete <login-id>` flow); production or `--environment staging` | — | shipped |
| `process list` | Published process IDs/versions available to the account (PostHog flag-gated per user) | login | shipped |
| `process <id>` / `process get <id>` (`--process-version`) | Retrieves the API's Markdown instructions + result schema. Retrieval does **not** execute the process | login | shipped |
| `process open <id>` (`--company`, `--period`) | Starts/resumes a hosted run; returns pinned guide, saved context, org ID, run ID, next update key. Opening does **not** execute the work | login + org | shipped |
| `context get` (companies/runs/records/history/query) | Reads hosted company context | login + org perms | shipped |
| `context save --file` | Saves progress text, profiles, documents, vault references (idempotent via update key) | login + org perms | shipped |
| `context schema open/save/get` | Prints the API input schemas (no login needed) | none | shipped |
| `companies schema / validate / save / list / show` | Local reviewed company profiles in `~/.ultrametric/companies` (revisioned) | none | shipped, offline |
| `assessments schema / save / list / show`, `actions set` | Local AI-native assessment records + chosen-action states | none | shipped, offline |
| `understand`, `assess` | Legacy offline guides (superseded by `process`) | none | shipped, compatibility |
| `arena categories / rankings / stories / verdict` | Reads ProductArena leaderboards and cited verdicts | none | shipped but **currently broken in production** (see below) |
| `doctor`, `config show/set`, `logs show` | Diagnostics, settings, local command logs | none | shipped |

### Hosted MCP tools (`https://api.ultrametric.ai/mcp`, from `ultrametric-api/src/mcp.ts`)

`status`, `list_processes`, `get_process`, `open_process`, `save_update`, `get_context`, plus two MCP-Apps conversation views: `show_vendor_selector`, `show_process_list`. Same API operations, permissions, and storage as the CLI. The API README states: "no tool executes a process or an external action." The views render agent-supplied data (vendor cards, process-run lists) — they do not fetch recommendations, purchase, or connect anything. "Approve from your phone" is realized as an authorized mobile-agent MCP connection using these same tools/views; host support requires separate checks per the CLI's process README.

### Production process catalog (live check, 2026-09-30)

`ultrametric process list --json` against production (logged-in founder account) returned exactly **14 processes**:

`ai-native-assessment` v1, `branding` v1, `check-domain-availability` v3, `company-profile` v2, `delaware-review` v1, `founder-agreement-equity-split` v1, `generate-a-brand-logo` v2, `generate-a-company-name` v2, `get-ein` v1, `incorporate-c-corp` v3, `pick-a-brand-color-palette` v2, `set-up-cap-table` v1, `set-up-registered-agent` v1, `track-runway` v3.

Caveats:
- Access is per-user via PostHog `process-<id>` flags; this account has a verified `ultrametric.ai` email (internal user), so **external users may see fewer**. The API filters both catalog and retrieval server-side.
- ~118 guides were prepared at v1 in staging (per `ultrametric-processes/existing-work.md`, snapshot 2026-09-23); production has released only the 14 above to this account.
- So: incorporation (`incorporate-c-corp`), EIN (`get-ein`), registered agent, cap table, Delaware good-standing review, runway tracking, naming/logo/palette/domain-check, company profile, and AI-native assessment all have **live hosted guides**; the CLI/MCP delivers the guide and stores the run's records — the agent (and the user's own accounts at IRS/registrar/etc.) perform the work.

### Known defect in the shipped `arena` commands (2026-09-30)

`ProductArenaClient` (`src/productarena/client.ts`) reads `https://ultrametric.ai/productarena/data/<...>.json` with `redirect: 'error'` (`src/core/http.ts`). The site now 301-redirects `/productarena/data/*` → `/data/*`, so **all four `arena` commands fail with `NETWORK_ERROR` in production today** (verified live). Fix belongs in the CLI (new base URL) or the site (serve 200 at the legacy path).

## What the CLI/MCP does NOT do (for honest product surfaces)

- Does not execute any process: no filing, purchasing, account creation, sending, or external API actions.
- Does not choose vendors or alter rankings; `arena`/views only read or display evidence.
- Does not extract facts, call a second model, or read the conversation; the agent supplies content.
- Does not sync local records to hosted context automatically.
- Guide availability is account-scoped; a process visible to Ultrametric staff is not necessarily released to a given user.

## Startup Simulator integration (this repo, 2026-09-30)

Curated map: `lib/ultrametricCli.ts` — corpus taskId → `{ processId, processVersion, command, mcpTool, releasedIn }`. Ten entries, one per live hosted process whose **result matches a corpus task**:

| Corpus task | Hosted process | Command |
| --- | --- | --- |
| `form_001` Incorporate C-Corp | `incorporate-c-corp` v3 | `ultrametric process open incorporate-c-corp` |
| `form_002` Get EIN | `get-ein` v1 | `ultrametric process open get-ein` |
| `qs_043` Set up registered agent | `set-up-registered-agent` v1 | `ultrametric process open set-up-registered-agent` |
| `qs_050` Track runway | `track-runway` v3 | `ultrametric process open track-runway` |
| `qs_051` Set up cap table | `set-up-cap-table` v1 | `ultrametric process open set-up-cap-table` |
| `startup_002` Sign the founder agreement & split equity | `founder-agreement-equity-split` v1 | `ultrametric process open founder-agreement-equity-split` |
| `brand_001` Generate a company name | `generate-a-company-name` v2 | `ultrametric process open generate-a-company-name` |
| `brand_002` Generate a brand logo | `generate-a-brand-logo` v2 | `ultrametric process open generate-a-brand-logo` |
| `brand_003` Pick a brand color palette | `pick-a-brand-color-palette` v2 | `ultrametric process open pick-a-brand-color-palette` |
| `domain_001` Check domain availability | `check-domain-availability` v3 | `ultrametric process open check-domain-availability` |

Deliberately excluded live processes (no same-result corpus task): `company-profile` (Ultrametric onboarding, not a corpus process), `ai-native-assessment` (project assessment), `branding` (a coordinator over the three brand tasks), `delaware-review` (a good-standing **review** — `tax_001` is a franchise-tax **filing**, a different result). A test pins these exclusions.

Rendering (display-only, never feeds scoring, judged picks untouched):
- Terminal process rows (`components/VirtualStartup.tsx`, testid `vs-um-cli`): "drive this process from your agent via the Ultrametric CLI/MCP — our own product: `ultrametric process open <id>` · MCP open_process — guide + saved records; your agent does the work", linking `/get-started`, full affiliation sentence as the tooltip. The line sits on the **process** row because the CLI drives whole processes, not individual steps.
- Vendors tab of the state panel (`components/VsStateGraph.tsx`, testid `vs-sg-umcli`): below the judged list, labeled "first-party · Ultrametric CLI/MCP (ours) — not a judged pick"; the tab count stays judged-only.
- Disclosures registered in `rankings/copy-audit.json` (`vs-um-cli-disclosure`, `vs-sg-umcli-disclosure`, both `keep`).
- Tests: `lib/__tests__/ultrametricCli.test.ts` (map validation, exclusions, disclosure copy), `components/__tests__/VirtualStartupUmCli.test.tsx` (renders on mapped rows only, affiliation visible, judged picks unaffected).

## Sources

- `ultrametric-cli` README, `src/program.ts`, `src/process/README.md`, `docs/install.md`, `CHANGELOG.md` (repo `47565a6`)
- `ultrametric` npm tarball 0.4.1 (`dist/version.json`, `dist/*`)
- `ultrametric-api` README + `src/mcp.ts` (tool registrations and descriptions)
- `ultrametric-processes` README + `existing-work.md` (catalog reconciliation index, 2026-09-24)
- Live production reads: `ultrametric auth status --json`, `ultrametric process list --limit 100 --json`, `ultrametric arena categories --json` (2026-09-30)
