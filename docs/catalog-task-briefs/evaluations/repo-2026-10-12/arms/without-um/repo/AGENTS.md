# Working in Workshop Ledger

This repository is a local inventory-to-CSV utility. Read `README.md` for the
input/output contract and `docs/product-notes.txt` for product constraints.

## Setup and verification

- Run commands from the repository root (the directory containing `package.json`).
- Use Node.js 22 or newer. There are no dependencies, install steps, build steps,
  credentials, or services to configure.
- Run the full suite with `node --test`. `npm test` is equivalent when npm is
  available; npm is not required.
- For focused work, run `node --test test/reorder.test.mjs` or
  `node --test test/cli.test.mjs`, then run the full suite before handing off.
- To try the example, run `node cli.mjs examples/inventory.json report.csv`.
  This overwrites `report.csv`, which is ignored by Git. Expected output is in
  `README.md`.
- If a restricted macOS environment fails before tests start with an OpenSSL
  configuration permission error, use `OPENSSL_CONF=/dev/null node --test` for
  this local, offline suite. Keep the override scoped to the command.

## Where to work

| File | Responsibility |
| --- | --- |
| `lib/reorder.mjs` | Inventory validation, reorder calculation, CSV serialization; no file I/O |
| `cli.mjs` | Positional arguments, JSON/file I/O, diagnostics, exit codes |
| `test/reorder.test.mjs` | Unit tests for inventory rules and CSV escaping |
| `test/cli.test.mjs` | CLI regression tests using real child processes and temporary files |
| `examples/inventory.json` | Small runnable input fixture |
| `docs/product-notes.txt` | Product requirements |

## Compatibility constraints

- Keep the JSON input and the three CSV columns (`sku,available,order`)
  compatible unless the task explicitly calls for a contract change.
- Quantities are nonnegative integers, `packSize` is positive, and `reserved`
  cannot exceed `onHand`. Available stock excludes reservations; shortages round
  up to whole supplier packs. Omit items requiring no order.
- SKUs must be nonblank strings and unique by exact value. Do not silently trim
  or change their case. Preserve input order in the report.
- Quote SKU cells and escape embedded double quotes. Preserve the CSV header
  and trailing newline, including for an empty report.
- Preserve CLI exit codes: 0 for success, 2 for missing arguments, 1 for read,
  parse, validation, or write failures. Diagnostics go to stderr.
- Invalid input must fail before writing the report. The CLI may overwrite an
  existing report on success; it does not create missing parent directories.
- Reports are reviewed by people, who place orders manually. Keep the tool local;
  supplier integrations, credentials, and paid dependencies are outside its scope.

## Change workflow

- Use plain JavaScript ES modules (`.mjs`) and Node built-ins, matching the existing
  code. Keep stock rules in the library and file handling in the CLI.
- Add a regression test when changing behavior or fixing a bug. Prefer public
  input/output assertions; CLI tests should use `process.execPath`, isolated
  temporary files, and cleanup so they work without a shell or global node path.
- Update the README and examples when a change affects their documented behavior.
  Do not add tooling or dependencies solely to make a small change.
- Run the relevant checks and report what changed, which commands passed, and
  any checks that could not run. Keep generated reports and temporary files out
  of changes.
