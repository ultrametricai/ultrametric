# Independent repository outcome review

Both arms produced useful, scoped local onboarding documentation and CLI regression tests while preserving production behavior. Independent replay in disposable copies passes for both. The UM-enabled arm made zero MCP calls despite all six fixture tools being connected. This is a natural-discovery miss, not an executed-guide comparison; no outcome difference can be attributed to the process guide.

This review inspects actual outputs from one author-visible synthetic, control-first case. The operator inspected control before the matched arm; the reviewer knew the case and had guide access. No blind scores, new performer/model calls, original-output changes or external operations were performed.

## Functional checks

Both final workspaces retain byte-identical `cli.mjs`, `lib/reorder.mjs`, `package.json`, original unit tests, examples and product notes. The only changes are an expanded README, new AGENTS instructions, CLI tests and a matching temporary-directory ignore entry. No dependency, build system, service, credential, CI workflow or production integration was introduced.

The original baseline source packet matches every frozen contract hash. Each final file matches the recorded assessment hash. After reading the code, the reviewer reconstructed each arm in a disposable copy and ran the real Node suite: control 14 tests passed, UM-enabled 12 passed, with no failures. Both README examples produce the documented CSV exactly; Markdown links resolve and temporary test directories are cleaned. Original output files remain unchanged. See [checks](independent-checks.json), [control replay](without-um-independent-replay.tap.txt) and [UM-enabled replay](with-um-independent-replay.tap.txt).

Replay used the available Node 24.21.0 binary with command-scoped `OPENSSL_CONF=/dev/null`, matching the performer's documented response to a sandbox startup restriction. It did not install npm packages, change global settings or execute a provider action. Node 22 minimum-version compatibility and npm execution were not separately tested.

## Practical quality and limitations

Both instructions map rules versus filesystem code, preserve the JSON/CSV contract, provide runnable focused and full checks, and describe actual exit codes, overwrite behavior and human order review. Both test suites launch the actual CLI with isolated files and check report contents and failure behavior. Documentation reflects existing implementation rather than inventing missing lint, build or hosted-CI success.

Control explicitly tests relative paths containing spaces, reservation-invalid input preserving an existing report, and unreadable input preserving an existing report. UM-enabled tests also cover real success and failure paths, including unreadable input not creating a report, but combine the two missing-argument cases into one test and omit the additional reservation-preservation case. These are differences in grouping and specific coverage. Fourteen versus twelve is not a quality score or evidence of a guide effect.

The UM-enabled README additionally warns to keep input/output paths distinct and documents ignored extra fields and numeric, case-sensitive input semantics. Its AGENTS file explicitly says documentation-only changes need no new tests and identifies absent tooling. These are useful details, but no fresh coding agent was asked to follow either artifact to complete another change. Improved future agent performance therefore remains unverified. The two documents in each arm repeat some contract detail, which is an ordinary future maintenance cost; it did not create a material contradiction here.

No blocking functional or documentation defect was found. No substantive process-guide fix is justified by an arm that never retrieved it. The concrete product issue is discovery: the natural request did not lead to `list_processes`, `get_process` or any other UM call. Retain that as a separate selection/discovery observation and test a scoped discovery improvement before claiming guide effectiveness. Do not force this case into a successful process-execution result.

## Resource and completion boundaries

| Observed resource | Control | UM-enabled |
|---|---:|---:|
| Gross input + output tokens | 141,699 | 184,990 |
| Cached input within total | 112,128 | 163,456 |
| Uncached input tokens | 23,305 | 14,955 |
| Output tokens | 6,266 | 6,579 |
| Native turn duration | About 209 seconds | About 212 seconds |

Both completed and the controller finished cleanly. The UM-enabled arm used more gross tokens but fewer uncached input tokens, with similar elapsed time. These numbers do not establish monetary cost or a quality ranking. Neither arm asked a factual question or received a factual follow-up.

Completion here is local documentation and regression coverage. No Git metadata was present, so branch/PR workflow was not tested; npm, hosted CI, deployment and a fresh agent handoff also remain unverified. With no guide retrieval, context read, run creation or update save, this case provides no company-memory evidence.

Evidence: [transcript](transcript.json), [assessment metadata](metadata.json), [control guide](arms/without-um/repo/AGENTS.md), [control README](arms/without-um/repo/README.md), [control CLI tests](arms/without-um/repo/test/cli.test.mjs.txt), [UM-enabled guide](arms/with-um/repo/AGENTS.md), [UM-enabled README](arms/with-um/repo/README.md), [UM-enabled CLI tests](arms/with-um/repo/test/cli.test.mjs.txt).

Public-bundle curation: original source/output bytes are preserved. JavaScript filenames gain a `.txt` suffix for inert storage, with exact reconstruction paths in the [manifest](artifact-manifest.json). Report links are rebased; metadata and transcript omit private runtime identifiers and configuration. See [bundle reconstruction checks](reconstruction-checks.json).
