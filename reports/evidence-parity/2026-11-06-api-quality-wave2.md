# API-quality gap repairs, wave 2 (2026-11-06)

Per-cell check of the next twelve products in the post-v6-migration staleness ranking
(144 gap-signature products, recomputed 2026-11-05; wave 1 landed in PR #623). The
signature: `agentic-public-api` full/partial while all four api-quality stories are
zero-evidence none.

iterm2 (terminals) ranks ahead of pipecat but is deferred: its `command-aware-features`
cell is a settled unsupported-churn case
(`reports/rubric-migration/2026-11-04-legacy-transitions.json`), and the evidence-keyed
judge cache cannot re-judge a product while leaving one cell untouched. It waits for a
settlement-aware pass; pipecat (the next ranked candidate) takes its slot.

Each of the 48 flagged cells was checked against the vendor's current authoritative
pages. `rankings-engine/scripts/append-api-quality-gap-evidence-2026-11-06.py` appends
40 live-verified evidence rows (fail-closed marker checks); 18 cells stay absent after
checking. Every row in the JSON carries `publishedVerdict` beside its evidence-check
disposition once judged; the two are reported separately (the PR #623 convention).

| product | arena | flagged cells | evidence rows appended | checked, still absent |
|---------|-------|--------------:|-----------------------:|---------------------:|
| aider | ai-coding | 4 | 1 | 3 |
| zep | ai-memory | 4 | 5 | 0 |
| statsig | feature-flags | 4 | 5 | 0 |
| paperspace | gpu-clouds | 4 | 2 | 3 |
| cerebras | inference-providers | 4 | 5 | 1 |
| deepinfra | inference-providers | 4 | 3 | 1 |
| groq | inference-providers | 4 | 3 | 2 |
| localai | local-llm-runtimes | 4 | 2 | 2 |
| smithery | mcp-infrastructure | 4 | 1 | 3 |
| otter | meeting-ai | 4 | 1 | 3 |
| pipecat | voice-agents | 4 | 7 | 0 |
| pinecone | vector-databases | 4 | 5 | 0 |

Wave-2 specifics worth reading before the diffs:

- Two preserved probe counter-checks record disabled interactive runners up front
  (cerebras, pinecone: the Mintlify playground is configured `"display":"simple"`, no
  "Try it"), the lesson of the PR #623 ollama finding.
- Smithery shut down its API, accounts/keys, CLI, and SDKs on 2026-10-31 (acquired by
  Arcade; it remains a public non-proxied MCP registry). The shutdown page is appended as
  context; all four api-quality cells ship as nones, and the product's other cells
  re-judge against the shutdown evidence.
- Otter's Enterprise-only Public API is documented in one help-center article whose HTML
  is Cloudflare-walled; the same host's public help-center JSON endpoint is the cited
  reachable source (the gusto bot-wall precedent).
- aider's vendor documents the absence itself ("The python scripting API is not
  officially supported or documented, and could change in future releases without
  providing backwards compatibility"); that disclaimer is the appended context row.
- Scope caveats ride in the excerpts: groq's OpenAPI document is embedded in the
  reference page payload, not published standalone; deepinfra's policy is model
  lifecycle, cited as such; pipecat's semver/deprecation discipline is framework-level
  while the Cloud REST API versions only by /v1 path; statsig's isolation is environment
  tiers and keys; zep's test isolation is per-graph cloning; pinecone's sandbox story is
  the Prism mock (Pinecone Local reached end of life 2026-10-07).

Scoped re-judges run under the ratified v6 rubric, then `derive` per touched arena and
the dependent generators. Engine output is accepted as-is; honest negatives ship. Four
checked-absent cells publish as engine partials on adjacent evidence (paperspace
interactive-docs and versioning, localai versioning, otter versioning); each ledger row
records both readings, the PR #623 browserbase convention.

Row-level output: `2026-11-06-api-quality-wave2.json`.
