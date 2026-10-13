# Opus 5.5 judge-migration status — live tracker

_Last updated 2026-10-01T22:10:04.745Z by the migration lane. Deleted when the migration doc (docs/JUDGE-MIGRATION-2026-09-30.md) supersedes it, or kept as the wave record._

| | |
|---|---|
| Arenas done / remaining | 94 ingested+committed / 0 in flight (of 94; ai-coding included in done) |
| Cells re-judged so far | 33,789 |
| Cumulative ingested spend | $570.84 (hard stop $800) |
| Projected fleet ingest total | ~$571 (+ interactive fallbacks + ~$10–25 uncertainty re-measure) |
| Fleet exact agreement vs sonnet-5 (running) | 75.5% (8,272 flips / 33,789 comparable cells) |
| Batch requests / interactive fallbacks | 32,753 / 18 |

Churn-policy flag: the no-new-evidence revert rule is deliberately NOT applied to this wave
(README §7); every flip is labeled `judge model migration` via the score-history `note`.
Protected human adjudications (18 cells) re-applied per docs/JUDGE-MIGRATION-2026-09-30-worklist.json.

## Ingested arenas

| Arena | cells | flips | exact agr. | spend |
|---|---|---|---|---|
| accounting | 583 | 117 | 79.9% | $9.16 |
| agent-frameworks | 459 | 125 | 72.8% | $8.95 |
| agent-sandboxes | 408 | 107 | 73.8% | $6.94 |
| agent-skills | 312 | 107 | 65.7% | $6.53 |
| agentic-commerce | 392 | 136 | 65.3% | $9.07 |
| ai-assistants | 520 | 108 | 79.2% | $9.47 |
| ai-code-review | 318 | 72 | 77.4% | $5.83 |
| ai-coding | 1036 | 265 | 74.4% | $0.00 |
| ai-memory | 342 | 68 | 80.1% | $6.91 |
| ai-research-agents | 258 | 69 | 73.3% | $3.98 |
| ai-search-apis | 250 | 64 | 74.4% | $4.21 |
| ai-support-agents | 318 | 65 | 79.6% | $5.38 |
| api-platforms | 285 | 82 | 71.2% | $5.82 |
| applicant-tracking | 260 | 51 | 80.4% | $3.66 |
| auth-platforms | 280 | 80 | 71.4% | $6.79 |
| authenticator-apps | 440 | 108 | 75.5% | $6.67 |
| backend-as-a-service | 204 | 39 | 80.9% | $4.47 |
| banking-as-a-service | 318 | 96 | 69.8% | $4.69 |
| banking-data-apis | 371 | 87 | 76.5% | $5.55 |
| billing-subscriptions | 371 | 64 | 82.7% | $5.89 |
| browser-agents | 364 | 93 | 74.5% | $5.81 |
| card-issuing | 265 | 71 | 73.2% | $3.99 |
| cloud-platforms | 196 | 49 | 75% | $3.62 |
| cloud-storage | 196 | 48 | 75.5% | $3.25 |
| code-hosting | 288 | 64 | 77.8% | $5.66 |
| compliance-automation | 324 | 63 | 80.6% | $5.32 |
| crm | 204 | 47 | 77% | $4.32 |
| customer-data-platforms | 255 | 57 | 77.6% | $4.99 |
| data-pipelines | 265 | 59 | 77.7% | $5.66 |
| data-warehouses | 216 | 44 | 79.6% | $6.04 |
| design-tools | 424 | 106 | 75% | $7.69 |
| desktop-os | 390 | 104 | 73.3% | $6.15 |
| docs-platforms | 265 | 68 | 74.3% | $5.22 |
| document-extraction | 318 | 75 | 76.4% | $5.29 |
| domain-registrars | 294 | 80 | 72.8% | $4.86 |
| durable-workflows | 318 | 68 | 78.6% | $6.51 |
| ecommerce-platforms | 270 | 58 | 78.5% | $4.65 |
| edge-platforms | 576 | 157 | 72.7% | $10.99 |
| email | 378 | 67 | 82.3% | $6.28 |
| email-apis | 260 | 54 | 79.2% | $4.68 |
| email-marketing | 348 | 66 | 81% | $5.34 |
| equity-management | 336 | 82 | 75.6% | $4.91 |
| error-tracking | 330 | 74 | 77.6% | $5.35 |
| expense-management | 265 | 46 | 82.6% | $4.53 |
| feature-flags | 270 | 57 | 78.9% | $4.88 |
| fraud-prevention | 270 | 68 | 74.8% | $3.81 |
| frontend-frameworks | 425 | 101 | 76.2% | $5.83 |
| frontier-models | 488 | 94 | 80.7% | $9.63 |
| game-engines | 456 | 110 | 75.9% | $8.85 |
| gpu-clouds | 270 | 89 | 67% | $5.03 |
| gpus | 344 | 106 | 69.2% | $5.68 |
| identity-verification | 318 | 83 | 73.9% | $4.84 |
| incident-management | 270 | 48 | 82.2% | $5.79 |
| inference-providers | 371 | 74 | 80.1% | $6.26 |
| infra-as-code | 216 | 63 | 70.8% | $3.76 |
| legal-ops | 378 | 153 | 59.5% | $5.70 |
| llm-evals-observability | 416 | 89 | 78.6% | $7.51 |
| local-llm-runtimes | 736 | 196 | 73.4% | $10.99 |
| marketplace-payments | 318 | 86 | 73% | $4.51 |
| mcp-infrastructure | 364 | 68 | 81.3% | $5.41 |
| meeting-ai | 270 | 72 | 73.3% | $4.76 |
| mobile-dev | 414 | 148 | 64.3% | $6.02 |
| mobile-payments | 208 | 50 | 76% | $3.36 |
| model-gateways | 350 | 92 | 73.7% | $6.19 |
| notes-knowledge | 330 | 71 | 78.5% | $5.94 |
| observability | 324 | 74 | 77.2% | $5.72 |
| package-managers | 324 | 102 | 68.5% | $6.61 |
| payments | 540 | 132 | 75.6% | $12.49 |
| payroll | 216 | 47 | 78.2% | $4.14 |
| processors | 352 | 75 | 78.7% | $5.52 |
| product-analytics | 212 | 52 | 75.5% | $4.98 |
| product-feedback | 260 | 44 | 83.1% | $3.52 |
| project-management | 498 | 133 | 73.3% | $9.17 |
| robotics-platforms | 270 | 86 | 68.1% | $4.65 |
| scheduling | 275 | 60 | 78.2% | $5.47 |
| search-infra | 265 | 69 | 74% | $5.40 |
| security-keys | 324 | 107 | 67% | $5.03 |
| security-scanners | 330 | 93 | 71.8% | $6.26 |
| self-hosted-assistants | 342 | 82 | 76% | $6.33 |
| serverless-databases | 336 | 71 | 78.9% | $7.32 |
| software-factory | 730 | 197 | 73% | $11.12 |
| sso-identity | 250 | 63 | 74.8% | $3.80 |
| stablecoin-payments | 318 | 77 | 75.8% | $4.94 |
| startup-banking | 518 | 128 | 75.3% | $9.30 |
| startup-law-firms | 840 | 236 | 71.9% | $12.11 |
| tax-automation | 318 | 86 | 73% | $4.82 |
| team-chat | 255 | 71 | 72.2% | $5.54 |
| terminals | 324 | 106 | 67.3% | $6.07 |
| vector-databases | 371 | 77 | 79.2% | $5.88 |
| vibe-coding | 312 | 68 | 78.2% | $5.36 |
| virtual-mailboxes | 200 | 53 | 73.5% | $2.56 |
| voice-agents | 549 | 94 | 82.9% | $9.35 |
| web-scraping | 768 | 144 | 81.3% | $11.13 |
| workflow-automation | 616 | 117 | 81% | $10.42 |

## Batches in flight

(none)

