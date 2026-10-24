# Process step execution

Author `metadata.execution` for each actionable part and each method option. A default
option owns its assessment; alternatives require their own evidence. Reference parts
retain their graph meaning and resolve execution from the referenced process.

| Category | Meaning | Required evidence |
| --- | --- | --- |
| `agent-native` (Agent Native) | An agent performs the stated work through text, file or code tools, or a documented API/tool interface. | The authored scope for local work, or a primary source for the actual interface and operation. |
| `agent-computer-use` (Agent Computer Use) | An agent operates an evidenced browser or computer interface. | Documentation or recorded observation of the relevant interface, with its limits and any untested behavior. |
| `human-online` (Human Online) | A person performs the work through a digital service, document or remote communication channel. | The authored work and its human responsibility and medium. |
| `human-offline` (Human Offline) | A person performs physical work or attends in person. | The authored requirement for physical presence or action. |

A signature, human approval, jurisdiction, risk, reversibility, asynchronous wait and
credential requirement are separate properties. Preserve their fields and gates.
DAG kinds such as `action`, `choice` and `reference` describe graph structure independently.
An execution assessment does not grant permission or certify access in a user's environment.

## Assess the whole step

Read the title, guidance, option summary, retained sources and applicable method before
classifying. A documented mechanism can support a category without an end-to-end test
receipt. Record account access, untested behavior and method restrictions in the rationale;
use `reviewRequired` for a material unresolved limitation. A supported digital human path
does not establish Human Online by itself. Use Human Online when the authored work
requires the person to perform a decision, attestation, interaction or other human act
through a digital channel. Missing agent test receipts do not establish a human requirement.
A preparation tool does not establish execution of a filing, signing act or
external submission. A vendor list, historical route, audit prediction or hypothetical
API does not establish an agent interface. An API source for one provider does not prove
support for the other providers listed on the step. Verify the selected method before use.

Check the full operation sequence against the retained provider and method. Include
record updates, remote verification, export resource types and release steps when the
authored work requires them. Local preparation covers a step only when its deliverable
ends there. A human responsibility establishes the actor; an online category also needs
evidence of the digital channel. A written decision can be on paper or electronic.

For insufficient or mixed evidence, use `category: null`, `basis: "unresolved"` and
`reviewRequired: true`. Explain the missing actor, medium or interface in `rationale` and
retain evidence references. Null records an unresolved assessment; it adds no execution
category. Keep a partly tested interface review-gated and state the test's exact limits.
For a step combining online and physical work, retain the graph and record the ambiguity.

A documented sequence of browser controls can support Agent Computer Use without a
completed agent test. Cite the controls and operation, then distinguish untested execution
from missing evidence of the mechanism. Account access, scoped permission, subscription
requirements and human approval are preconditions; they do not turn mechanical browser
work into Human Online. Identity challenges and signatures require the responsible person's
participation at that point. If an indivisible step combines a required human act with
agent work and the category depends on the selected method, record the uncertainty.
Routine analysis and configuration choices can be agent work; a board vote, personal
attestation or interpersonal negotiation retains its human actor.

For Agent Native, `local-work` means the stated deliverable can be produced with supplied
inputs using text, file or code tools, including a repository calculation module.
`documented-interface` means the external operation is supported by a cited API, CLI or
MCP tool. Preserve the exact provider
and operation limits in the rationale; preparation alone does not establish external
execution, and an interface for one provider does not establish the other providers.

The assessment includes `category`, `basis`, `rationale`, `evidence` and `reviewRequired`.
Use `local-work` or `documented-interface` for Agent Native, `browser-evidence` for Agent
Computer Use, and `human-work` for either human category. Evidence references identify
public source URLs, recorded probes, or canonical JSON pointers containing the actual
work. Retain negative results and responsibility boundaries when adding new evidence.

## Generation and review

Content generation must emit an assessment for every actionable part and option. Preserve
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
requires assessments. Historical generated prompts remain stored and accessible through
the existing reader.
Newly generated prompts carry the assessment, which participates in the generation cache
key. Review wording contradictions individually; changing prompt availability requires
separate product review. Validate `approvalRequired` independently of category and keep
unresolved work explicitly unresolved in generation context. Presentation adoption is
deferred to a separate change; existing graph labels, symbols and signature display remain.
