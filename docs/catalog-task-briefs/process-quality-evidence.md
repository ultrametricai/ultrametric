# Process quality candidate and evidence

This change strengthens the selected founder/operator workflows in the canonical shared records. The audience follows [AGENTS.md](../../AGENTS.md): founder processes and founder operations, with engineering, security, finance and support owners joining particular steps. The ranking prioritizes useful bounded outcomes, existing executable work, reusable company context and inspectable demonstrations. It is an editorial selection, not a computed product ranking.

## Evidence boundary

The [recorded study overview](https://api.ultrametric.ai/internal/trials?trialId=3c1d557a-cbe6-4fd7-a644-4d8f4a970e35) covers 37 matched primary pairs. Actual guide retrieval occurred in every UM arm. The bounded scores had ceilings and showed no repeatable aggregate quality lift. They establish neither general equivalence nor a broad UM advantage. The later qualitative inspection was post-hoc, not an independent blinded experiment. Company-memory persistence was exercised; reduced human re-explanation across agents remains untested.

The links below require existing staff access. The original prompts, artifacts, rubrics and source/version provenance remain in their trials. Several tests retrieved a parent chain containing the selected subprocess; those results do not constitute standalone-process tests. The artifacts were reread for this candidate. No new performer trials or quality scores were produced for it. Static review and schema/graph checks establish narrower properties than useful agent execution.

The source baseline is public main `6b8b3d854f555e743bfd1c589f1ae1b57a0e1c61`. Public Git owns these records; private instructions remain API additions. This change leaves the migration, application, rankings and publication configuration outside its scope. It excludes the situation wording and UI changes in open PR #240. The preservation snapshot refresh covers only these records; previously preserved descriptions, source-reference prefixes, incorporation bindings and the import manifest remain intact.

## Ranked processes and implementation entry points

### 1. Track runway (`qs_050`; API `track-runway`)

**Run outcome:** “Show when cash gets tight and which hiring or spending decisions change it.” For a founder or finance operator approaching a commitment or monthly review. Deliver an editable transaction schedule, account reconciliation, base/downside cash forecast and a short decision note. Completion means a reopened artifact reproduces the balances and projections, with missing accounts, assumptions, first constraint and forecast horizon explicit.

**Company context and UM contribution:** Reuse dated account/currency scope, restricted funds, payroll, collections, commitments and hiring decisions. Reconcile corrected facts across the forecast and handoff. This connects company decisions to a repeatable calculation instead of giving a generic burn formula. Use supplied CSVs/statements or existing read-only banking/accounting access; Mercury/Brex/Relay are catalog candidates, not required purchases. Money movement and spending decisions remain with the authorized owner.

**Readiness and changes:** Existing guidance already separates financing/transfers and requests downside modeling. [`qs_050/n1–n3`](../../content/processes/records/qs_050.json) now specifies reconciliation, source rows, actual payment timing, full forecast horizon and intra-month liquidity checks. The latter fixes a static gap: positive month-end cash can conceal payroll falling due before collections. [Alder phase changes](https://api.ultrametric.ai/internal/trials?trialId=1d8ec1e9-81c9-4732-8fdc-2428f87f39ca) were handled correctly in both arms, including a changed reserve floor and installment schedule; this is supporting coverage, not a demonstrated model failure or unique UM benefit. Qualitative retest: conflicting dated sources, late collections and a temporary positive month followed by a commitment; inspect the saved model and the operator’s resulting decision.

### 2. Pick the right vendor for the task (`vendor_011`; API `vendor-011`)

**Run outcome:** “Compare viable options against our real workflow and bring back a purchase decision.” For an operator replacing a tool or adding a capability. Deliver requirements, source-linked options including the incumbent, whole-commitment costs, observed trial artifacts or explicit unrun tests, and a conditional recommendation. A decision-only run ends with the purchasing owner’s reviewable package; signing and rollout need separate evidence and scoped authority.

**Company context and UM contribution:** Current stack, essential requirements, usage, budget, sensitive data, exit needs and recovery tolerance drive the comparison and trial. Use current vendor docs/pricing and authorized test interfaces; no particular provider is required. Trial grants, charges, sensitive-data transfers, agreements and production rollout require their responsible owners.

**Readiness and changes:** The existing nine-step sequence provides a substantive starting point. [`vendor_011/n1–n5,n9`](../../content/processes/records/vendor_011.json) adds requirement-level evidence, eligible/ineligible/unknown distinctions, total term cost, negative permission and retry cases, verified output, and updating the recommendation after results. The [simple vendor test](https://api.ultrametric.ai/internal/trials?trialId=c5f4c779-0342-457c-b1ef-f62536f7cef1) had only one qualifying option in a supplied table; UM added useful failure checks but performed no vendor trial. [Brook’s correction](https://api.ultrametric.ai/internal/trials?trialId=dba5d039-e2fc-4844-83e1-a371231e5ebf) demonstrates both arms responding to a mandatory feature charge and a scoped retest; much of the acceptance protocol was already supplied. Retest open research with plausible alternatives, a changed quote and a real permitted task, preserving a possible “retain incumbent/no suitable choice” outcome.

### 3. Make the repo agent-ready (`sw_010`; API `make-the-repo-agent-ready`)

**Run outcome:** “Make this repo ready for an agent to fix and verify one real bug.” For a technical founder onboarding coding agents. Deliver verified setup/instructions, one-line checks, a bounded patch, command evidence and a fresh replay. Completion is task-specific: actual failure, fix and replay are inspectable; a missing fresh agent remains a stated gap.

**Company context and UM contribution:** Runtime, package manager, generated files, existing failures and standing permissions prevent invented setup and needless tooling. Local Git, runtime and checks suffice; skills and MCP connections are optional when a demonstrated task needs them. Installs or new grants outside authority, merge and deployment require the relevant owner.

**Readiness and changes:** [`sw_010/n1–n7`](../../content/processes/records/sw_010.json) already covered setup through a small fix. The candidate requires exit codes, a controlled failing check, fresh replay and a concrete handoff, while allowing unnecessary installation/connection steps to be skipped. These are static improvements; the earlier `ship-v1` bounded analytics task does not validate this outcome. Retest with a working small repository and a real bug, then give only the saved instructions and starting revision to a fresh reader.

### 4. Answer a security questionnaire (`comp_014`; API `answer-a-security-questionnaire`)

**Run outcome:** “Return this questionnaire with supported answers and the exact gaps reviewers need to resolve.” For a founder/security owner facing customer diligence. Deliver the original-format completed draft, question/evidence map and assigned review queue. Every question must be accounted for; unsupported mandatory answers keep final submission pending.

**Company context and UM contribution:** Versioned policies, actual controls, architecture, service scope, prior approvals and customer exceptions make reused answers factual. Use local document/spreadsheet tools and authorized evidence retrieval. Customer portals are optional until submission; even remote autosave discloses data and needs the appropriate authority.

**Readiness and changes:** [`comp_014/n1–n6`](../../content/processes/records/comp_014.json) adds row reconciliation, reopen checks, evidence scope/date, conflicts, truthful constrained Yes/No handling and stale-answer review. No selected primary pair directly tests this process; this is a static completion/verification improvement. Retest with mixed policies, a planned control, a report for another service and restricted attachments. Inspect both factual accuracy and preservation of the customer’s file format; no portal acceptance is inferred.

### 5. Roll out a pricing change (`growth_014`; API `roll-out-a-pricing-change`)

**Run outcome:** “Prepare the customer-by-customer pricing transition and show the billing and notice checks.” For a founder/billing operator changing an existing plan. Deliver a complete transition ledger, reproducible economics, provider previews or labeled simulations, recipient-ready notices and an execution/reconciliation handoff. Live completion requires authorized billing changes, required notice/acceptance evidence and actual invoice readback.

**Company context and UM contribution:** Subscription IDs, intervals/currencies, contract protections, exceptions, effective dates and communication authority connect the model to each actual customer. Use exports and calculation tools first, then the company’s billing provider and communication channel within authority. Local simulation does not establish tax/proration behavior.

**Readiness and changes:** [`growth_014/n1–n7,links`](../../content/processes/records/growth_014.json) adds exact cohorts, missing-input holds, previews, safe retries, recipient mapping and reconciliation. The [pricing pair](https://api.ultrametric.ai/internal/trials?trialId=ecc1c2a8-3bd5-4872-9000-0af0a2bb173f) correctly modeled protected and delayed cohorts in both arms, but both notices were internal cohort summaries lacking recipient-ready dates/contact/action details. Missing inputs should be identified, not invented. [Larch](https://api.ultrametric.ai/internal/trials?trialId=732d34b0-d822-4fe6-a208-e404e2a551e7) adds evidence for propagating corrected counts, minimum fees and dates through dependent artifacts. Static review found the graph ordered notices after migration; it now places notice before change and monitoring afterward. Retest exact customer notices, a held account, partial provider failure and an uncertain receipt before retry.

### 6. Migrate off a shutting-down vendor (`sit_012`; API `sit-012`)

**Run outcome:** “Preserve our data and prepare a verified route off this vendor before its deadline.” For an operator receiving an end-of-service notice. Deliver a raw export/manifest, integrity and restore evidence, replacement decision, migration ledger and cutover/recovery plan. Claim live migration only after actual synchronization, observation, approved cutover and business checks; cancellation/deletion require separate confirmation.

**Company context and UM contribution:** Shutdown versus export deadlines, data relationships, attachments, permissions, dependencies and retention obligations determine order and urgency. Use the vendor’s permitted export/import interfaces and cleared storage; replacement purchase, production switches and deletion need scoped owner decisions.

**Readiness and changes:** [`sit_012/n1–n7,links`](../../content/processes/records/sit_012.json) turns terse steps into preservation-first execution. Static review found both the original observation/cutover order and later write-loss risk; the candidate adds an authoritative writer, delta handling, final synchronization and post-switch recovery. Brook supplies related migration reasoning but no shutdown-migration execution proof. Retest a paginated export with a broken attachment, then a creation/edit/deletion after the initial snapshot. Verify restore, permissions and the final delta; do not simulate elapsed time and call it a completed observation window.

### 7. Run an incident postmortem (`prod_010`; API `run-an-incident-postmortem`)

**Run outcome:** “Turn this outage’s evidence into a reviewable timeline and useful corrective actions.” For an engineering founder or incident lead after containment. Deliver a source-linked postmortem, bounded impact calculations, competing causal explanations and prioritized action drafts with acceptance checks. Participant acceptance, tracker creation, fix implementation and customer publication are separate states.

**Company context and UM contribution:** Service ownership, logs, clocks, recovery signals, incident policy and prior actions support causal and operational continuity. Local analysis and authorized log/tracker reads suffice for a draft. Writing tickets or publishing communications follows existing scoped authority; owner commitments need actual acceptance.

**Readiness and changes:** [`prod_010/n1–n5`](../../content/processes/records/prod_010.json) strengthens evidence locators, denominator/time checks, uncertain causality and accepted-versus-proposed actions, and permits proportional asynchronous review. The [incident pair](https://api.ultrametric.ai/internal/trials?trialId=a3218fff-35a4-4697-b991-8bf19aac142a) kept failed attempts distinct from users and did not blame a nearby deployment without evidence; both did the core task correctly. Preserve this behavior, then retest conflicting clocks, recovery evidence and a draft action that cannot yet be executed.

### 8. Save a churning customer (`growth_002`; API `churn-save-attempt`)

**Run outcome:** “Prepare a remedy we can deliver, or carry out the customer’s cancellation within authority.” For a founder/support operator handling an actual churn signal. Deliver an account-specific response, supported remedy or cancellation package, exact commercial terms and verified state after any permitted action. A drafted offer does not establish retention.

**Company context and UM contribution:** Customer intent, subscription, entitlements, support history, available staffing, discount authority and renewal terms constrain the response. Use existing CRM/support/billing access or exports. Sends, concessions, cancellation and refunds need their own applicable authority.

**Readiness and changes:** [`growth_002/n1–n7,links`](../../content/processes/records/growth_002.json) gives firm cancellation a direct route, makes calls optional and requires billing readback. The [support repeat](https://api.ultrametric.ai/internal/trials?trialId=1a9b36e0-7600-455c-9876-36bf1e4fd2a5) promised daily updates until resolution without verified coverage; the candidate requires an owner/cadence the team can sustain. This was a support draft, not a failed retention execution; the control also proposed daily follow-up internally. Retest a firm cancellation and a separate customer seeking help; check that neither unsupported promises nor a required retention meeting appear.

### 9. Run outbound sales sequences (`growth_012`; API `outbound-sales-sequences`)

**Run outcome:** “Prepare a targeted sequence with verified recipients and working stop rules.” For a founder testing an offer with an appropriate audience. Deliver eligibility/suppression ledger, exact copy, sender/cadence, no-send test evidence and a campaign handoff. Delivery, responses, accepted meetings and customers require their own observations.

**Company context and UM contribution:** Positioning, offer proof, ICP, exclusions, sender, prior contacts and sales capacity affect list selection and progression. Use permitted sources plus the existing CRM/email/calendar tools; HubSpot/Calendly are catalog examples. Upload, activation and sends are distinct effects governed by exact recipient/copy/cadence authority.

**Readiness and changes:** [`growth_012/n1–n6,links`](../../content/processes/records/growth_012.json) adds row accounting, personalization and suppression failure tests, event reconciliation and uncertain-send handling. The [outbound pair](https://api.ultrametric.ai/internal/trials?trialId=2d856590-c199-480f-bc32-2b74401f5850) produced only three emails; UM follow-ups added useful details, while sender identity and cadence were absent in both arms. The supplied task itself was narrow. Static review also found no graph edges; dependencies and conditional meeting steps are now explicit. Retest natural prospecting through an inspectable campaign package, including opt-out, duplicate and late events, without counting drafts as customers.

### 10. Generate a website (`site_001`; API `generate-a-website`)

**Run outcome:** “Build an editable preview that lets visitors complete the main action.” For a founder creating or replacing a company site. Deliver source, identified preview and recorded visitor-journey checks. For a form, verify actual payload/receipt and failure behavior; for a link, verify its destination. Publication is separate.

**Company context and UM contribution:** Approved offer/pricing, audience language, assets/rights, required URLs and data destinations ground the artifact and avoid invented proof. Use local source/build tools and a permitted browser. Existing hosting/domain tools become relevant only for an authorized release; no new host purchase is required for a preview.

**Readiness and changes:** [`site_001/n1,n3,n2`](../../content/processes/records/site_001.json) requires editable output, version identity, appropriate functional/browser checks and release readback. The [website artifact pair](https://api.ultrametric.ai/internal/trials?trialId=4958539a-0d4f-4d62-9f9d-f7b39fd0b7bb) created HTML with an explicitly required placeholder CTA; the [second task](https://api.ultrametric.ai/internal/trials?trialId=f91fe107-9020-4eca-8ea1-46d691fd7ff2) corrected one unsupported sentence. Neither validated a working journey. Retest real navigation or local form behavior, invalid input and unavailable destination; missing browser access leaves those checks unverified.

## Alternatives and staged delivery

Naming and color selection remain useful onboarding components, but their supplied-list/contrast tasks provide less process-execution evidence. `get-first-10-customers` overstates what a bounded email package can deliver; the narrower outbound workflow has an inspectable intermediate outcome. `agent-run-back-office` spans several unrelated financial effects; a specific cash or invoice workflow is easier to validate. Broad `ship-v1`, `ship-it-right` and `launch-website` chains remain useful compositions, but their completed sub-artifacts do not establish release or business outcomes.

1. Review the canonical content, graph corrections and preserved source ownership in this PR. Run schema, import/preservation, graph, type, lint and aggregate tests on its final commit.
2. Execute a small natural-request pilot using the [workflow evaluation protocol](process-workflow-evaluation.md). Verify included-only billing, isolated account/filesystem, equivalent tools and the exact served candidate before launching. Start with attainable local outcomes; preserve actual questions, answers and outputs. Revise from observed failures, then independently inspect and retest.
3. Confirm intended catalog visibility and publication bindings in the API with the release owner. This PR changes source; it does not promote guides, change feature flags or verify that the account can discover every standalone process. Historical reads showed a difference between published standalone guides and the account-visible catalog.
4. Keep the set at the selected scope until the outcomes are comfortable to recommend from actual runs. The next 25 are deferred. Static correctness and a persuasive demo description alone do not meet that expansion criterion.
