# AFK handoff — process manifests

The contract between Ultrametric's founder-process corpus and **AFK** (the Ultrametric
agent-execution product that will actually RUN these processes). Ultrametric publishes each
process as a versioned, machine-readable **manifest**; AFK consumes the manifest URL and plans a
run from it. Nothing else crosses the boundary.

Code: `lib/processManifest.ts` (builder, tested in `lib/__tests__/processManifest.test.ts`),
served by `app/processes/[slug]/manifest.json/route.ts` and
`app/processes/chains/[chain]/manifest.json/route.ts`. Admin affordance:
`components/DoViaAfk.tsx`.

## URLs

- Per process: `{SITE_URL}/processes/{slug}/manifest.json`
  (e.g. `https://ultrametric.ai/processes/incorporate-c-corp/manifest.json`)
- Per chain (end-to-end playbook): `{SITE_URL}/processes/chains/{chain}/manifest.json`
  (e.g. `.../processes/chains/company-launch/manifest.json`)

Manifests are **public data** — the published corpus (`processes/corpus.json`,
`journeys/chains.json`) reshaped and resolved against the live arena leaderboards at build
time. There is no gating on the JSON; only the "Do via AFK" button is admin-gated. Every process
and chain page links its manifest in the public "For agents" footer.

## Schema (manifestVersion 1)

Process manifest:

```jsonc
{
  "manifestVersion": 1,
  "process": { "slug": "get-ein", "title": "Get EIN", "phase": "formation", "description": "…" },
  "manifestUrl": "https://ultrametric.ai/processes/get-ein/manifest.json",
  "steps": [
    {
      "id": "n1",
      "title": "Check name availability",
      "kind": "api",                 // 'api' | 'computer-use' | 'human'
      "route": "agent",              // the original corpus routing, kept for audit
      "toolCall": "company_data_get",// nullable
      "calls": [                     // recorded API/tool calls, verbatim from the corpus
        { "method": "GET /api/name-availability?state=DE&name={name}", "type": "rest", "description": "…" }
      ],
      "vendorOptions": [             // every vendor that can perform the step, canonical first.
                                     // Steps mapped to an arena (corpus optionsArenaId) list the
                                     // arena's CURRENT roster — top products by Overall score, resolved
                                     // at build time — then any curated extras; the list grows or
                                     // reorders as the live leaderboard moves (additive, non-breaking).
        {
          "vendor": "mercury",           // corpus vendor key (arena-derived entries use the product id)
          "name": "Mercury",
          "productId": "mercury",        // judged PA product id; null = untracked (honest chip)
          "arena": "startup-banking",    // null when untracked
          "agentReady": 92,              // arena agent-readiness score; null when unscored
          "mcpEndpoint": "https://mcp.mercury.com/mcp", // allowlisted (lib/mcpEndpoints.ts) or null
          "paProductUrl": "https://ultrametric.ai/arena/startup-banking/product/mercury"
        }
      ],
      "actionUrl": "https://…",      // optional: deep link to perform the step (forward-compat)
      "signupUrl": "https://…",      // optional: vendor signup page (forward-compat)
      "irreducible": "judgment or identity — work an agent shouldn't stand in for", // optional
      "approvalRequired": true,      // see side-effect policy below
      "riskLevel": "high",           // 'low' | 'medium' | 'high' | null
      "estimatedMinutes": 30,
      "async": false                 // true = a third-party wait; poll/watch, don't block a human
    }
  ],
  "provenance": {
    "source": "productarena",
    "url": "https://ultrametric.ai",
    "generatedFrom": "processes/corpus.json + journeys/chains.json …", // commit-agnostic: refetch, don't pin
    "license": "Ultrametric Data License (DATA-LICENSE) …"
  }
}
```

Chain manifest: same envelope, composing its processes in run order —

```jsonc
{
  "manifestVersion": 1,
  "chain": { "slug": "company-launch", "name": "Company launch", "tagline": "…", "manifestUrl": "…" },
  "processes": [ /* one { process, manifestUrl, steps } body per process, run order */ ],
  "provenance": { /* one provenance for the whole document */ }
}
```

Each embedded process carries its own `manifestUrl`, so an executor can re-fetch or re-run one
process of a chain independently.

### Step kinds (from the corpus route)

| corpus route | kind           | executor behavior |
|--------------|----------------|-------------------|
| `agent`      | `api`          | MCP-first: connect to a `vendorOptions[].mcpEndpoint` when one exists, else drive the recorded `calls` directly. |
| `form`       | `computer-use` | Manual portal/form work with no API path — a browser agent may drive it, always behind an approval gate, never autonomously. |
| `person`     | `human`        | A human (or a supervised computer-use agent, where the audit says the blocker is mechanical) — render as a checklist item. Steps also carrying `irreducible` must never be attempted by an agent at all: the reason string says why (judgment/identity work). Steps carrying `legalSignature: true` are the true human floor — a statute or counterparty requires a human signature/attestation; never attempt or work around them. |

### Side-effect policy (`approvalRequired`)

Any side-effectful step is `approvalRequired: true` and the executor must hold for explicit
human approval before running it:

1. an explicit corpus gate (`approvalRequired` on the DAG node) — always true;
2. any flagged risk (`riskLevel` medium or high) — always true;
3. every `computer-use` step (a browser agent acting on a real portal is side-effectful);
4. an `api` step whose recorded calls aren't all read-only (read detection:
   GET/head/list/search/read/retrieve/fetch/check/lookup/query/status verbs — see
   `stepApprovalRequired` in `lib/processManifest.ts`).

`human` steps are never machine-gated: the human is the actor.

## The contract (what AFK does with a manifest)

1. **Fetch** the manifest URL (always the live corpus — do not cache across runs; the
   provenance is deliberately commit-agnostic).
2. **Check `manifestVersion`** — refuse versions it doesn't know (see versioning rules).
3. **Plan a run**: steps in DAG order, vendor picked per step from `vendorOptions` (default =
   first entry, the corpus's canonical vendor; `agentReady` ranks the alternatives).
4. **Execute**:
   - `api` steps: MCP-first via the embedded `mcpEndpoint`; fall back to the recorded `calls`.
   - `computer-use` steps: browser agent, only behind the approval gate; `actionUrl`, when
     present, is the page to drive.
   - `human` / `irreducible` steps: human checklist items — surface, don't attempt.
5. **Gate**: pause before every `approvalRequired: true` step until a human approves.
6. **Waits**: `async: true` steps are third-party turnaround — watch/poll instead of parking a
   human on them.

## Versioning rules

- `manifestVersion` is a single integer, bumped **only on breaking changes**: removing or
  renaming a field, changing a field's type or meaning, changing the kind/approval semantics.
- **Additive changes do not bump the version** (new optional fields — `actionUrl` and
  `signupUrl` are examples already declared). Executors must ignore fields they don't know.
- Old versions are not served side-by-side: a manifest URL always serves the current version.
  AFK should hard-fail on a `manifestVersion` greater than what it understands, and log (not
  fail) on unknown extra fields.
- Bumps land as: builder + routes + this doc + tests in one commit, with a migration note here.

## Admin flag mechanics ("Do via AFK" button)

`components/DoViaAfk.tsx`, rendered on process pages and chain pages next to the header chips.
The **manifest is public; only this affordance is gated** — non-admins get nothing rendered
(no hidden markup, no trace in the static HTML, which never includes the button).

Admin means either:

- **Ory allowlist**: a logged-in session (`lib/session.ts` `useSession`) whose email appears in
  `NEXT_PUBLIC_ADMIN_EMAILS` — comma-separated, case-insensitive, inlined at build time.
  Default is unset, which admits nobody.
- **Founder's local switch**: `localStorage.setItem('pa-admin', '1')` in devtools shows the
  button on that device (reload the page — same-tab localStorage writes fire no storage event);
  `localStorage.removeItem('pa-admin')` hides it again. Purely a local testing convenience — it
  gates a button whose target data is public anyway.

Clicking the button opens
`https://app.ultrametric.ai/afk/run?manifest=<encodeURIComponent(manifest URL)>` in a new tab
**and** copies the manifest URL to the clipboard — the AFK run route may not exist yet, so the
copied URL is the reliable path while the remake lands.
