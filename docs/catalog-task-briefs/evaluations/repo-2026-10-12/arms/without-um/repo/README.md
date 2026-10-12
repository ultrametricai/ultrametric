# Workshop Ledger

A local utility that reads inventory JSON and writes a reorder CSV. This is a fictional working repository for an evaluation. It never connects to suppliers.

## Quick start

Use Node.js **22 or newer**. No dependency installation, build, credentials, or
network access is required. Run these commands from the repository root:

```sh
node --test
node cli.mjs examples/inventory.json report.csv
```

The example writes this exact report:

```csv
sku,available,order
"brake-pad",6,6
```

When npm is available, `npm test` and
`npm run report -- examples/inventory.json report.csv` are equivalent commands.

## Input and stock rules

The input is a JSON array of objects. Each object requires these fields:

| Field | Requirement |
| --- | --- |
| `sku` | Nonblank string, unique by exact value across the inventory |
| `onHand` | Nonnegative integer: total stock |
| `reserved` | Nonnegative integer, at most `onHand`: stock already committed |
| `minimum` | Nonnegative integer: target available stock |
| `packSize` | Positive integer: units in a supplier pack |

For example:

```json
[
  { "sku": "brake-pad", "onHand": 9, "reserved": 3, "minimum": 10, "packSize": 3 }
]
```

Available stock is `onHand - reserved`. The shortage is the amount needed to
reach `minimum`, or zero if enough stock is available. The order quantity rounds
that shortage up to a whole multiple of `packSize`. The example has 6 available
units, needs 4 more, and orders 6 units in two packs of 3.

SKUs retain their whitespace and case; uniqueness uses the original string.
An empty inventory is valid. Invalid entries reject the entire report.

## Output and CLI behavior

```sh
node cli.mjs INPUT.json OUTPUT.csv
```

- Paths are relative to the current working directory unless absolute. Quote
  paths containing spaces.
- The CSV columns are always `sku,available,order`. Only rows with a positive
  order quantity appear, in input order.
- SKU cells are always double-quoted; embedded quotes are doubled. Lines end
  with `\n`, including the last line. An empty report contains just the header
  and its newline.
- Success writes the file without printing the report to stdout. An existing
  output file is overwritten. The output's parent directory must already exist.
- Read, JSON parsing, and validation errors occur before the output is written.
- Exit codes are **0** for success, **2** for missing arguments, and **1** for
  read, parse, validation, or write errors. Usage and error messages go to stderr.

Review reports before placing orders manually. See
[product notes](docs/product-notes.txt) for the compatibility requirements.

## Development

Coding agents should start with [AGENTS.md](AGENTS.md), which maps the source
files, checks, and compatibility constraints. Stock rules and CSV serialization
live in `lib/reorder.mjs`; argument and file handling live in `cli.mjs`.

Tests use Node's built-in test runner and need no packages:

```sh
node --test test/reorder.test.mjs
node --test test/cli.test.mjs
node --test
```

CLI tests create isolated temporary directories under `test/` and remove them
afterward. They exercise actual process exit codes, file contents, and failure
behavior. Add regression coverage when changing these public contracts.
