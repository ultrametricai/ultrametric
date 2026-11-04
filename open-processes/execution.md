# Process step execution

Author `metadata.execution` for each actionable part and each method option. A default
option owns its assessment; alternatives require their own evidence. Reference parts
retain their graph meaning and resolve execution from the referenced process.

| Category | Meaning | Required evidence |
| --- | --- | --- |
| `agent-native` (Agent Native) | An agent performs the stated work through text, file or code tools, or a documented API/tool interface. | The authored scope for local work, or a primary source for the actual interface and operation. |
| `agent-computer-use` (Agent Computer Use) | An agent operates an evidenced browser or computer interface. | Documentation or recorded observation of the relevant interface, with its limits and any untested behavior. |
| `human-online` (Human Online) | A person performs the work through a digital service, document or remote communication channel. | The authored digital work and the responsible person; use a conservative feasible digital method when automation is unestablished. |
| `human-offline` (Human Offline) | A person performs physical work or attends in person. | The physical action or in-person route required by the chosen feasible method. |

A signature, human approval, jurisdiction, risk, reversibility, asynchronous wait and
credential requirement are separate properties. Preserve their fields and gates.
DAG kinds such as `action`, `choice` and `reference` describe graph structure independently.
An execution assessment does not grant permission or certify access in a user's environment.

## Assess the whole step

Read the title, guidance, option summary, retained sources and applicable method before
classifying. Assign every canonical scope to one of the four categories. Choose the less
automated feasible method when alternatives remain open, and state the chosen method in
the rationale without rewriting the instructions or changing the graph.

Human Online covers a person completing ordinary digital work when automation of the
whole scope is unestablished, as well as personal decisions, attestations, signatures and
interactions through a digital channel. Remote discussion and shared documents are
feasible defaults for ordinary business reviews and conversations. They do not establish
that an agent can make the person's decision. Use Human Offline for actual physical work
or a supported in-person or paper route; missing API evidence alone is insufficient.
For a combined scope, account for required personal or physical acts in its classification.
Keep separately authored preparation and execution steps separate.

A documented mechanism can support an agent category without an end-to-end test receipt.
A documented sequence of browser controls can support Agent Computer Use; text, file and
code tools can support Agent Native for local deliverables. Cite the actual mechanism and
operation. Missing test receipts alone do not invalidate documented capability. Account
access, scoped permission, subscription requirements and approvals remain preconditions.
Personal identity challenges and signing acts stay with the responsible person.

Check the full operation sequence against the retained provider and method, including
record updates, resource-specific exports, remote verification and release when required.
A preparation tool does not establish execution of a filing, signing act or submission.
A vendor list, historical route, audit prediction or hypothetical API does not establish
an agent interface. Evidence for one provider does not establish its alternatives.
When whole-step automation is unestablished, use the feasible human method and record
`automationEvidence.status: "unverified"`. Retain the sources and relevant limitations.

Use `reviewRequired` for material method, access or evidence limitations. It is independent
of the execution category and is not a fifth category or a public label. Keep legal
eligibility, jurisdiction and accepted filing-method checks intact. A conservative paper
route is a classification choice, not a claim that paper is mandatory for every case.
If no feasible method exists for the authored work, report the exact impossible
requirement for content review rather than inventing a capability.

For waiting and follow-up steps, assess the authored work: checking status, answering
requests, retrieving the result and reconciling records. An institution's decision is a
completion condition, not evidence that the monitoring work requires a person. Establish
the actual monitoring and response channels. A title such as "App review" does not make
the company's step the store reviewer's adjudication.

Read the surrounding method when a signing step follows a specific electronic-envelope
workflow. Cite that canonical scope as well as the signing interface. Keep required
signers human. Where video and physical attendance are both permitted, classify the
conservative physical route and retain the alternative and its eligibility checks.

For Agent Native, `local-work` means the stated deliverable can be produced with supplied
inputs using text, file or code tools, including a repository calculation module.
`documented-interface` means the external operation is supported by a cited API or CLI.
Public assessments describe the method and factual capabilities without runtime bindings
or orchestration instructions. Preserve the exact provider
and operation limits in the rationale; preparation alone does not establish external
execution, and an interface for one provider does not establish the other providers.

The assessment includes `category`, `basis`, `rationale`, `evidence`, `reviewRequired`
and `automationEvidence`.
Use `local-work` or `documented-interface` for Agent Native, `browser-evidence` for Agent
Computer Use, and `human-work` for either human category. Evidence references identify
public source URLs, recorded probes, or canonical JSON pointers containing the actual
work. Retain negative results and responsibility boundaries when adding new evidence.

## Generation and review

`automationEvidence` records support for automation separately from the selected
category. `unverified` makes no claim that an agent can complete the whole step;
existing sources may still support individual operations. `documented` identifies
a supported local-work or interface mechanism without claiming a completed test.
`observed` requires the observed `scope`, an ISO UTC `observedAt` timestamp and a
`receipt` already present in `evidence`. The receipt must establish that observation;
a provider page or a proposed test is insufficient. A partial observation covers
only its stated scope. Approval and personal acts remain independent requirements.
Older imported assessments may omit this additive field. Preserve actual receipts
and limitations when evidence changes; do not manufacture a test result to classify.

Content generation must emit a non-null four-category assessment and automation evidence
status for every actionable part and option. Preserve
stable IDs, titles, descriptions, providers, documents, source evidence, links and graph
semantics. Classify from the actual work, then check each claim against its cited evidence.
Human decisions and signatures stay with the responsible person. Reassess alternatives
individually instead of inheriting the default method's capabilities or jurisdiction.

Run `pnpm shared:check`, `pnpm exec tsx scripts/shared-processes/execution-audit.ts`, and
the repository gates. The audit prints current scope/category counts and can write a full
review queue with `--output <path>`. Paid audits and prompt generation are separate runs;
a schema or content migration does not require invoking them.

## Compatibility

Canonical `metadata.route` and projected `route` retain their historical values.
They continue to support existing runtime consumers; they are deprecated for content
classification. Read `execution` for the evidenced category, basis and review state.
The old route can differ from the assessment and does not prove an executable interface.

Manifest version 2 adds optional `execution` alongside its existing executor `kind`.
The existing kind, routing and approval semantics remain unchanged. Existing consumers
may ignore optional fields. Content consumers use the assessment for labels and review
queues; executor policy changes require a separate reviewed contract change.
Published schemas accept older records without assessments; the canonical authoring check
requires a category and evidence status. Legacy null assessments remain importable but
fail canonical authoring validation. Historical generated prompts remain stored and accessible through
the existing reader.
Newly generated prompts carry the assessment, which participates in the generation cache
key. Review wording contradictions individually; changing prompt availability requires
separate product review. Validate `approvalRequired` independently of category and retain
method limitations and unverified automation in generation context. Presentation adoption is
deferred to a separate change; existing graph labels, symbols and signature display remain.
