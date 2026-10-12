# Repository onboarding evaluation evidence

Both arms added useful local documentation and working CLI regression tests while preserving the original production code. The UM-enabled arm made zero MCP calls despite all six local fixture tools being connected. This is a natural-discovery miss; it cannot show the effect of the process guide. See the [independent review](independent-outcome-review.md) and [checks](independent-checks.json).

This is one author-visible synthetic case, executed control first on 2026-10-12. The operator inspected control before the UM match; the reviewer had access to the case and guide. The actual prompt was `make this repo easier for coding agents to work in`. No factual questions or follow-ups occurred. No scalar scores or aggregate estimates were produced.

## Inspect the evidence

The `inputs/` directory contains the original fictional company and repository source, verified against the frozen pre-run hashes. The `arms/` directories contain each actual final workspace, including unchanged files. This preserves the before/after comparison for the README and ignore rules as well as the newly created agent guide and CLI tests.

| Material | Control | UM-enabled |
|---|---|---|
| Agent instructions | [AGENTS.md](arms/without-um/repo/AGENTS.md) | [AGENTS.md](arms/with-um/repo/AGENTS.md) |
| Updated README | [README.md](arms/without-um/repo/README.md) | [README.md](arms/with-um/repo/README.md) |
| New CLI tests, inert copy | [CLI tests](arms/without-um/repo/test/cli.test.mjs.txt) | [CLI tests](arms/with-um/repo/test/cli.test.mjs.txt) |
| Independent test replay | [TAP output](without-um-independent-replay.tap.txt) | [TAP output](with-um-independent-replay.tap.txt) |

The [original README](inputs/repo/README.md), [product notes](inputs/repo/docs/product-notes.txt), [library](inputs/repo/lib/reorder.mjs.txt) and [original unit tests](inputs/repo/test/reorder.test.mjs.txt) show the starting contract. The [manifest](artifact-manifest.json) records SHA-256 hashes, roles, byte lengths and reconstruction paths for all files except itself. Shared parent-directory configuration is outside its scope.

The [curated transcript](transcript.json) retains actual user and assistant messages. The [metadata](metadata.json) records model, runtime, candidate revision, connected tools, zero MCP calls, artifact hashes and resource use. The guide associated with `sw_010` was available in the candidate catalog but was not retrieved.

## Observed outcome

Both arms add a source map, runnable verification commands, inventory/CSV contracts, CLI exit codes and human review boundaries. Their tests launch the real CLI with isolated local files and verify success and failure behavior. The CLI, stock library, package definition, original tests, examples and product notes are unchanged.

Independent copy replay passes: control 14 tests, UM-enabled 12 tests. Both README examples match the generated CSV and documentation links resolve in reconstructed workspaces. Test counts describe execution only. The control splits missing-argument cases and adds a reservation-invalid case; both packages provide meaningful CLI coverage. There is no guide-execution comparison behind these differences.

| Observed resource | Control | UM-enabled |
|---|---:|---:|
| Gross input + output tokens | 141,699 | 184,990 |
| Uncached input tokens | 23,305 | 14,955 |
| Native turn duration | About 209 seconds | About 212 seconds |

Gross totals include repeated cached input. More gross tokens here coexist with fewer uncached input tokens; neither establishes a dollar-cost or quality ranking.

## Reconstruct a disposable copy

All JavaScript module bytes are preserved in files ending `.mjs.txt`. This prevents the public repository's lint/test discovery from treating evaluation artifacts as its own code. Markdown content retains original path references, which resolve after reconstruction. The manifest maps every original file path; only names changed for inert storage.

From this bundle directory, the following standard-library Python snippet verifies the recorded hashes and reconstructs original filenames in a new temporary directory. It executes no JavaScript:

```python
from pathlib import Path
import hashlib, json, tempfile
bundle = Path.cwd()
manifest = json.loads((bundle / "artifact-manifest.json").read_text())
copy_root = Path(tempfile.mkdtemp(prefix="um-repo-evidence-"))
for entry in manifest["artifacts"]:
    if "reconstructionRoot" not in entry:
        continue
    data = (bundle / entry["path"]).read_bytes()
    assert hashlib.sha256(data).hexdigest() == entry["sha256"]
    target = copy_root / entry["reconstructionRoot"] / entry["reconstructionPath"]
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
print(copy_root)
```

Read the reconstructed code before executing it. From each reconstructed arm's `repo/` directory, run `node --test` and `node cli.mjs examples/inventory.json report.csv`. The latter overwrites that disposable output path. In the observed restricted macOS environment, the suite needed command-scoped `OPENSSL_CONF=/dev/null` because the sandbox blocked the system OpenSSL configuration. The independent replay used Node 24.21.0 with this override; no packages or network services were needed. [Reconstruction checks](reconstruction-checks.json) verify the bundled copies reproduce both successful suites and examples.

## Completion and limits

Completion here means local documentation and regression coverage. No fresh coding agent followed these instructions to implement another change. Git metadata and npm were absent; branch/PR workflow, hosted CI, deployment and minimum Node 22 compatibility were not tested. No content was submitted to an external service and no supplier order was placed.

The tested candidate revision was `110ff2631ac0adf37f5325c123391af643a4a7c5`; the model was `gpt-6-astra` at `xhigh`, default service tier. Local tool availability does not establish marketplace installation or production visibility. No guide retrieval, context read, process opening or update save occurred, so company-memory reuse remains untested.

Raw native logs, personal instructions/configuration, account identifiers, numeric credit balances, credentials and private endpoints are excluded. Source/output files retain their bytes; metadata and transcript are curated with explicit path/identifier redactions. No new performer run or original-output change was made for the independent review.
