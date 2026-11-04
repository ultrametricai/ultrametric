## Evidence-parity repairs, wave 1 (2026-11-03)

Per-cell check of the top five products in the 2026-11-03 parity scan (re-run of
`rankings-engine/scripts/evidence-parity-scan.ts` against main). Each flagged cell was
checked against the vendor's current authoritative pages. Where the absence claim no
longer holds, a dated committed script appended live-verified evidence (verbatim
excerpts, fail-closed marker checks). Where it still holds, the check is recorded here
and the verdict is untouched.

| product | flagged cells | evidence appended | still absent | bot-walled |
|---------|--------------:|------------------:|-------------:|-----------:|
| gusto | 56 | 20 | 16 | 20 |
| vercel | 26 | 22 | 4 | 0 |
| vue | 29 | 21 | 8 | 0 |
| claude | 24 | 20 | 4 | 0 |
| gemini | 23 | 22 | 1 | 0 |

Scoped re-judges for every (product, arena) pair with appended evidence are queued, not
run: main moved the judge to PROMPT_VERSION v6 on 2026-11-03 and the rubric migration is
an explicit review event (ACCURACY.md), so re-rolling these cells under v6 while arena
peers sit on v5 verdicts awaits the maintainer ruling. The queue, with commands, is in
`2026-11-03-wave1-repairs.json` (`rejudgeQueue`). Verdicts, rankings, and derived files are
unchanged in this wave.

Bot-walled cells (gusto.com subdomains behind a Cloudflare challenge) are recorded with
the reachable substitutes that were checked; capabilities marketed only on walled pages
stay unrepaired rather than cited to unreachable URLs.
