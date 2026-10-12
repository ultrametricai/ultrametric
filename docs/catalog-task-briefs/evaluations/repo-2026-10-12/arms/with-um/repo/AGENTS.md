# Working in Workshop Ledger

Workshop Ledger is a local JSON-to-CSV inventory utility. Keep changes small,
dependency-free where practical, and compatible with the existing report format.

## Start here

- Read `README.md` for setup, commands, and the input/output contract.
- Read `docs/product-notes.txt` before changing stock rules or report behavior.
- Use Node.js 22 or newer. There is no install, build, service, or credential setup.
- Run commands from the repository root. `node --test` is the baseline check;
  `npm test` runs the same suite when npm is available.

## Code map

| Path | Responsibility |
| --- | --- |
| `lib/reorder.mjs` | Pure inventory validation, reorder calculation, CSV serialization |
| `cli.mjs` | Arguments, file I/O, stderr messages, and exit codes |
| `test/reorder.test.mjs` | Stock-rule and CSV unit tests |
| `test/cli.test.mjs` | CLI integration tests using temporary local files |
| `examples/inventory.json` | Small runnable input fixture |
| `docs/product-notes.txt` | Product constraints |

## Preserve these behaviors

- JSON input and the three CSV columns `sku,available,order` stay compatible.
- Available stock is `onHand - reserved`. Round shortages up to complete packs;
  omit items that need no order and retain input order for the remaining rows.
- Reject invalid quantities and empty or duplicate SKUs. SKU comparison is exact;
  do not silently trim, normalize case, or coerce quantity strings into numbers.
- Quote SKU fields and escape embedded quotes in CSV. Empty reports still have
  the header and its newline.
- Keep the CLI exit codes: 0 for success, 2 for missing arguments, 1 for read,
  parse, validation, or write failures. Diagnostics go to stderr.
- Reports are reviewed by people; the utility does not contact suppliers or
  place orders. No network service or paid dependency is needed.

## Making and checking a change

1. Inspect the relevant code and tests before editing. Use ES modules (`.mjs`),
   built-in Node APIs, and the existing `node:test` / `node:assert/strict` style.
2. Keep business rules in `lib/reorder.mjs` and filesystem concerns in `cli.mjs`.
3. For behavior changes, add a focused regression test: rules/CSV in the unit
   suite, arguments/files/exit codes in the CLI suite. Documentation-only changes
   do not need new tests.
4. Run a focused suite while working, then the full suite before handoff:

   ```sh
   node --test test/reorder.test.mjs
   node --test test/cli.test.mjs
   node --test
   ```

5. For a manual smoke check, run
   `node cli.mjs examples/inventory.json report.csv` and compare with the README.
   This overwrites `report.csv`; use a disposable output path. Generated reports
   and `.tmp/` test files are ignored and should not be committed.
6. Update the README when changing user-visible behavior or development commands.
   Report the changes, checks actually run, and any remaining limitations.

There is no configured lint, formatter, build, or hosted CI workflow in this
checkout. Do not claim those checks passed. If the environment blocks a check,
report the error and distinguish it from a product failure.

In a restricted macOS sandbox, Node may fail before running tests because it
cannot read the system `openssl.cnf`. For that specific startup error, run this
local-only suite with `OPENSSL_CONF=/dev/null node --test` and report the workaround.
