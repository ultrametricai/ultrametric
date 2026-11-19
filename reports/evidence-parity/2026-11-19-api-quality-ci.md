# API-quality gap repairs, scheduled wave (2026-11-19)

offline staleness scan 2026-11-19T00:19:22.537Z: 47 gap rows after ledger suppression. 1 evidence rows appended after fail-closed live verification; 48 cells withheld (never guessed) and still flagged for a research wave.

| product | arena | evidence rows appended | withheld |
|---------|-------|-----------------------:|---------:|
| mastra-code | ai-coding | 0 | 4 |
| mastra-knowledge | ai-memory | 0 | 4 |
| authy | authenticator-apps | 0 | 4 |
| quo | business-phone | 0 | 4 |
| alloy | compliance-screening | 0 | 4 |
| colorado-sos | government-services | 0 | 4 |
| cra | government-services | 0 | 4 |
| gst-india | government-services | 0 | 4 |
| bentolabs | llm-evals-observability | 1 | 3 |
| shopify-pos | mobile-payments | 0 | 4 |
| signoz | observability | 0 | 4 |
| trello | project-management | 0 | 5 |

Routed to the needs-human issue instead of this wave:

- **product-feedback/foreloop** — Ultrametric's own product: two human-adjudicated cells await the maintainer ruling (wave-7 ledger, reports/evidence-parity/2026-11-06-api-quality-wave7.json). Its repair lands after that ruling as its own disclosed, bias-audited PR.

Deferred:

- **terminals/iterm2** — Settled unsupported-churn cell (wave-2 ledger, reports/evidence-parity/2026-11-06-api-quality-wave2.json). Deferred until a settlement-aware pass exists so a repair cannot resurrect reverted churn.
