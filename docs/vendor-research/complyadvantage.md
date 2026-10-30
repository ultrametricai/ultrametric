# ComplyAdvantage vendor assessment

ComplyAdvantage is a candidate for the planned **Compliance Screening & AML** arena. Its published product and API documentation describe customer and company screening, sanctions and politically exposed person (PEP) checks, adverse-media screening, ongoing monitoring, transaction monitoring, payment screening, and case handling. The documented scope supports evaluating it for financial-crime operations. It does not establish an alternative to the security-control and audit-readiness products in the current Compliance Automation arena. Sources: [Mesh overview](https://docs.mesh.complyadvantage.com/docs/overview), [customer screening](https://complyadvantage.com/mesh/aml-customer-screening/), [company screening](https://complyadvantage.com/mesh/aml-company-screening/), [transaction monitoring](https://complyadvantage.com/mesh/transaction-monitoring-software/).

This is a public-document assessment, with public-document retrieval and API-schema inspection recorded in [the source log](complyadvantage-sources.json). The [interchange review record](../../open-rankings/reviews/compliance-screening--complyadvantage.json) remains `unreviewed`, with no authenticated test date or numerical rating. No customer screening, paid account, sandbox session, support interaction, or regulator filing was performed. No vendor relationship was established during this work; affiliation checks remain incomplete. Source ownership and access constraints are stated below.

## Arena placement

The arena definitions below come from the committed [category catalog](../../open-rankings/categories.json) and [arena roadmap](../../open-rankings/arena-roadmap.json). Placement is an editorial inference from those definitions and the cited product scope.

| Arena | Assessment | Evidence and inclusion boundary |
| --- | --- | --- |
| [Compliance Automation](https://ultrametric.ai/arena/compliance-automation) | Adjacent buyer need; exclude from the current ranked roster | This arena covers SOC 2, ISO 27001 and HIPAA control evidence, integrations and audits. ComplyAdvantage's [Mesh security section](https://complyadvantage.com/mesh/) lists its own certifications and security controls. A vendor's own attestation does not demonstrate a product that manages a customer's SOC 2 audit. No such customer workflow was established in the reviewed material. |
| Compliance Screening & AML, planned | Primary candidate | [Mesh documentation](https://docs.mesh.complyadvantage.com/docs/overview) describes screening, risk scores, cases and alerts. [Transaction monitoring](https://complyadvantage.com/mesh/transaction-monitoring-software/) adds configurable detection and investigation workflows. Keep the arena planned until its peer roster, stories and engine-produced evidence are ready. |
| [Identity Verification & KYC](https://ultrametric.ai/arena/identity-verification) | Partial fit, screening component | [Customer screening](https://complyadvantage.com/mesh/aml-customer-screening/) supports the watchlist and risk-screening part of KYC. This assessment did not establish native document authenticity checks or selfie liveness. Any later roster entry must preserve that narrower scope and judge the full existing story set. |
| [Payment Fraud Prevention](https://ultrametric.ai/arena/fraud-prevention) | Reconsider with evidence; do not add on marketing alone | The [Fraud Detection page](https://complyadvantage.com/mesh/fraud-detection/) explicitly lists card-not-present fraud, card testing and merchant-acquirer fraud alongside bank-payment fraud. The roadmap's previous blanket exclusion on bank-rail scope is therefore too narrow. Public material reviewed here does not establish comparable merchant-checkout integration, decision latency, chargeback economics or measured outcomes against the arena's peers. |
| [Online Payments](https://ultrametric.ai/arena/payments), [Banking as a Service](https://ultrametric.ai/arena/banking-as-a-service), [Stablecoin Payments](https://ultrametric.ai/arena/stablecoin-payments) | Supporting integration candidate | The [integration page](https://complyadvantage.com/integration/) describes connecting screening and monitoring to payment and banking platforms. This is evidence of a risk-control component, without establishing payment acceptance, bank-account provision or stablecoin settlement as ComplyAdvantage products. |
| [Auth & Identity](https://ultrametric.ai/arena/auth-platforms) | Exclude from the ranked roster | The arena covers application sign-in, sessions and access control. The [Mesh overview](https://docs.mesh.complyadvantage.com/docs/overview) establishes customer-risk screening; it does not establish an application-authentication product. |

## Functional fit and implementation

For a regulated fintech onboarding customers and reviewing financial activity, the documented functions form a coherent workflow: create a customer, select a screening configuration, run screening, inspect alerts and cases, and continue monitoring. The [getting-started guide](https://docs.mesh.complyadvantage.com/docs/getting-started) requires screening configuration with the compliance or risk team. Implementation work therefore includes list selection, data mapping, escalation policy, analyst ownership and subsequent tuning. A public API does not remove those decisions.

Company screening describes checking business entities against risk information and tracking changes. It does not, by itself, establish a complete business-registry verification or beneficial-ownership discovery workflow in every country. Those capabilities need their own scenario and source checks. Source: [Company Screening](https://complyadvantage.com/mesh/aml-company-screening/).

The [transaction-monitoring page](https://complyadvantage.com/mesh/transaction-monitoring-software/) describes configurable rules, sandbox rule evaluation, review stages, reporting support and CSV export of input and derived rule/alert data. These are vendor claims awaiting a tenant test. Validate the exact reporting jurisdiction, data model and subscription entitlement before relying on any filing or export workflow.

## Agent and API access

The public Mesh surface is suitable for a scoped technical evaluation. The [documentation index](https://docs.mesh.complyadvantage.com/llms.txt), Markdown guides and downloadable [OpenAPI schema](https://docs.mesh.complyadvantage.com/openapi/mesh-api.json) were retrieved without credentials. The schema parsed as OpenAPI and includes customer, case, audit, export and webhook operations. This establishes an inspectable interface; endpoint execution and permissions remain untested. The [Postman guide](https://docs.mesh.complyadvantage.com/docs/postman-and-openapi-schema) also links a collection.

New Mesh integrations use an access key and secret to obtain a bearer token through `/v3/token`. The documentation describes configurable API-credential permissions and expiry, a fixed token lifetime, and generating a replacement token rather than refreshing one. Keep this distinct from the older [CSOM API reference](https://docs.complyadvantage.com/), which uses a `Token` authorization header. Sources: [Mesh getting started](https://docs.mesh.complyadvantage.com/docs/getting-started), [Mesh token reference](https://docs.mesh.complyadvantage.com/reference/createtokenv3).

Webhook delivery can produce duplicates. Consumers must deduplicate by the documented message identifier, persist work before acknowledging it, and handle retries. Signing is opt-in per account and requires contacting support; its availability should be verified before rollout. Source: [Mesh webhooks](https://docs.mesh.complyadvantage.com/docs/webhooks).

Rate limits differ between Mesh and the older API reference. Use the [Mesh rate-limiting guide](https://docs.mesh.complyadvantage.com/docs/rate-limiting) and the contracted account limit when sizing an integration. Retry behavior, throughput and recovery after an outage still need a tenant test.

The public [agentic-workflows page](https://complyadvantage.com/mesh/agentic-workflows/) describes automatic remediation, explanations and escalation. Its automation and productivity figures are supplier claims, with no independently reproduced benchmark in this assessment. The Starter-specific restrictions below are material when evaluating those claims. No official MCP server or CLI was established from the reviewed documentation; that is a research gap rather than a finding that neither exists.

## Commercial terms

The [Starter Plan page](https://complyadvantage.com/starter-plan/) advertises Essentials from **$99/month with annual billing**, with a **$119** monthly-billing entry tier. Agentic Starter advertises **$149/month with annual billing** or **$179** with monthly billing at the entry tier. Prices depend on monitored-entity allowance; one-off screens also consume volume, and overages apply. The page's annual table heading is ambiguous, so confirm invoice total, currency, taxes and entitlements in the order form. These are advertised amounts, not an observed invoice or enterprise quote.

The same Starter FAQ says a team first assigns a case to an agent; the agent acts on profiles and leaves the final case decision to the team. Starter agent configuration is standardized and cannot be customized. Treat broader claims of configurable autonomous workflows as plan-dependent. Source: [Starter Plan, Agentic FAQs](https://complyadvantage.com/starter-plan/).

The [pricing page](https://complyadvantage.com/pricing/) places transaction monitoring and payment screening in the enterprise offering with price on application. A screening entry price cannot establish total cost for those products. A comparison needs setup and data-mapping costs, recurring volume, overages, analyst effort, implementation support, export access and termination terms. Support quality and actual implementation effort remain untested.

## Geography, security and portability

The [Mesh webhook documentation](https://docs.mesh.complyadvantage.com/docs/webhooks) lists regional infrastructure for Europe, the US, Canada and Australia. These are infrastructure observations. They do not establish buyer eligibility, legal sufficiency, local registry coverage or data-residency guarantees for every country served from them.

For UK, Singapore, Canada, Australia, Germany, France, India and Estonia rollout work, keep vendor availability unresolved until each scenario establishes contracting eligibility, relevant screening lists, local name and script matching, historical coverage, language support, update behavior, data transfer terms and the appropriate reporting workflow. No `available` country rows were added from this assessment.

The [Mesh product page](https://complyadvantage.com/mesh/) claims SOC 2 Type II, ISO 27001, encryption and role-based permissions. Reports, certification scope, penetration-test evidence and a customer DPA were not inspected. The [privacy notice](https://complyadvantage.com/privacy-notice/) discusses international transfers and distinguishes roles in processing. Obtain the tenant's hosting and subprocessor terms rather than inferring them from a regional URL or a website privacy statement.

The downloadable [API schema](https://docs.mesh.complyadvantage.com/openapi/mesh-api.json) exposes audit and export resources, and the transaction-monitoring source describes CSV export. A complete exit remains untested: export customer identifiers, monitoring state, cases, analyst decisions, attachments, rule versions and audit history; reconcile them in another system; then verify retention and deletion behavior. Proprietary risk-data licensing and contractual restrictions also need review before assuming portability.

## Comparison and validation work

The existing AML roadmap names Unit21, Sardine, Alloy, Hummingbird, Salv and Flagright as possible peers. That list is a research queue. Each candidate needs independently checked scope and the same scenario definitions before engine scoring. [Flagright's public introduction](https://docs.flagright.com/guides/overview/introduction) provides an API-first compliance comparison surface; Unit21's docs entry redirected to login in this check, so no Unit21 capability conclusion is drawn from it.

| Evaluation | Evidence needed |
| --- | --- |
| Screening quality | Vendor-approved synthetic fixtures for aliases, names across scripts, near matches, known negatives, sanctions, PEPs and adverse media; measured recall and false-positive workload against labelled expected outcomes. |
| Ongoing monitoring | Controlled change events, polling reconciliation, duplicate and delayed webhooks, signature configuration, replay handling and recovery from missed notifications. |
| Transaction and payment controls | Representative synthetic events, rule versioning and backtests, measured latency, timeout behavior and explicit decisions about when a payment is held or released. |
| Agent remediation | Known true positives and borderline cases, profile versus case actions, assignment requirements, overrides, audit reasons, policy changes and plan-specific configuration. Measure incorrect clearance as well as throughput. |
| Access and isolation | Least-privilege credentials, independent revocation, cross-tenant isolation and authorization failures for restricted audit, export and mutation operations. |
| Exit and failure recovery | Paginated exports, completeness reconciliation, checkpointed retries, restore/import trial and contractual deletion/retention evidence. |

Any later ranked bring-up should run the scoped evidence pipeline and retain negative and unsupported results. The present assessment changes the roadmap's overly broad fraud exclusion and records the evidence needed for evaluation. Existing scores and product rosters remain unchanged.

## Retrieval limits

The website's marketing pages were readable through the web reader, while direct scripted GETs returned access-denied responses. Those differing outcomes are preserved in the source log. Mesh Markdown pages and the API schema were directly reachable. The linked transaction-monitoring demo API documentation was reachable by direct GET after the web reader failed to fetch it. These checks establish document access only; they provide no evidence of authenticated API behavior or contracted service availability.
