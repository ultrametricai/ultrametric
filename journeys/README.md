# Journeys

Multi-process founder paths, each chaining existing processes into a
founder-visible playbook (incorporate and launch, the VC raise, month-end close, the
agent-run back office).

A chain in `chains.json` is deliberately thin: an id, a name, a one-line tagline, and an
ordered list of process IDs that must already exist in `processes/corpus.json`; chains
never invent steps. The real `company-launch` record:

```json
{
  "id": "company-launch",
  "name": "Company launch",
  "tagline": "Incorporate, get the EIN, put the founders and cap table on paper, open the bank account, turn on payroll and the books.",
  "taskIds": ["form_001", "form_002", "qs_051", "startup_002", "qs_023", "qs_063", "qs_073"]
}
```

How the site consumes this directory: `lib/processes.ts` `loadChains()` cross-checks every
`taskId`; chain pages render at `/processes/chains/<id>` with the member step graphs
stitched in order; the startup simulator (`/startup-sim`) drives a simulated company
through these chains; and the ⌘K palette surfaces each chain by the phrases people type
("raise a seed round") via `data/search-aliases.json`.

Contribute here:

- **A new chain** — link existing process IDs into a founder-visible path (a
  country-specific incorporation sequence, a wind-down, a first-enterprise-deal path).
- **Fixes to an existing chain** — reordering, a missing leg, a better description, with
  the reasoning in the PR.

Gate: `pnpm test` (`lib/__tests__/processes.test.ts` cross-checks every chain).
