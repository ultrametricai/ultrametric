# Workshop Ledger

A local utility that reads inventory JSON and writes a reorder CSV. This is a fictional working repository for an evaluation. It never connects to suppliers.

## Quick start

Use **Node.js 22 or newer**. There are no dependencies to install, build steps,
environment variables, credentials, or services to configure. From this directory:

```sh
node --version
node --test
node cli.mjs examples/inventory.json report.csv
```

The example writes this UTF-8 CSV to `report.csv`:

```csv
sku,available,order
"brake-pad",6,6
```

`report.csv` is ignored by Git. Choose a different disposable output path if you
need to keep an existing report: **the CLI overwrites its output file**. Input and
output paths are relative to the current working directory unless absolute; the
output's parent directory must already exist. Use distinct input and output paths.

If npm is available, `npm test` and
`npm run report -- examples/inventory.json report.csv` are equivalent shortcuts.

## Input and report contract

The input is a JSON array of inventory objects. See
[`examples/inventory.json`](examples/inventory.json) for a complete example.

| Field | Requirement |
| --- | --- |
| `sku` | String with at least one non-whitespace character; unique within the input |
| `onHand` | Nonnegative integer, in individual units |
| `reserved` | Nonnegative integer, no greater than `onHand` |
| `minimum` | Nonnegative integer target for available stock |
| `packSize` | Positive integer number of units per supplier pack |

All five fields are required. Additional fields are ignored. Quantities must be
JSON numbers, not strings. SKUs are preserved and compared exactly, including case
and surrounding whitespace.

For each item:

```text
available = onHand - reserved
shortage  = max(0, minimum - available)
order     = ceil(shortage / packSize) * packSize
```

The CSV contains only items with a positive order, in input order. Its columns are
always `sku,available,order`, with quantities in individual units. SKU values are
double-quoted and embedded quotes are doubled. Lines end with `\n`, including the
final line. An empty inventory or one needing no orders produces only
`sku,available,order\n`.

Users review the report and place orders manually. Product constraints are recorded
in [`docs/product-notes.txt`](docs/product-notes.txt).

## CLI behavior

```sh
node cli.mjs INPUT.json OUTPUT.csv
```

| Exit code | Meaning |
| --- | --- |
| `0` | Report written successfully; no stdout output |
| `2` | Missing input or output argument; usage printed to stderr |
| `1` | File read, JSON parse, inventory validation, or file write failed; error printed to stderr |

The CLI reads and validates all input before attempting to write the output. A
parse or validation error therefore leaves an existing output untouched. File
write errors use Node's filesystem diagnostics, which can vary by platform.

## Development

Coding agents should start with [`AGENTS.md`](AGENTS.md) for the code map and change
workflow. Stock rules and CSV formatting live in `lib/reorder.mjs`; `cli.mjs`
handles arguments and files. Tests use Node's built-in test runner:

```sh
node --test                           # full suite
node --test test/reorder.test.mjs     # rules and CSV
node --test test/cli.test.mjs         # CLI behavior
node --test --test-name-pattern='rounds shortage' test/reorder.test.mjs
```

CLI tests launch the current Node executable, create isolated fixtures under
`.tmp/`, and clean them up after each test. No network access is needed. There is
currently no separate linter, formatter, build, or hosted CI configuration.
