# Startup lore

Lore: the heuristics founders actually trade, recorded as sourced claims from named schools
of thought, with the disagreements between schools kept explicit.

Every entry in `registry.json` is one school's belief about how to build a company, with a
named author and a citable work behind it. The registry takes no position on which school
is right; it records the conflicts between entries explicitly, on both sides. The episode
layer lives separately in
[`resources/LORE.md`](../resources/LORE.md) (veracity-graded startup history); this
registry records the rules of thumb the schools draw from it.

Each record carries: `id` (stable), `heuristic` (one actionable sentence, a faithful
paraphrase), `school` (`YC`, `lean`, `blitzscaling`, `bootstrapper`, `effectual`,
`contrarian`, `classical`, `craft`), `source` (author, work, URL), `stance` (always
`claim`), `tensions` (conflicting entry ids, symmetric and always across schools), and
`processIds` (the processes in [`processes/corpus.json`](../processes/corpus.json) it
bears on).

Contribute here:

1. A real, verifiable source is required: essay, book, or talk by the person the heuristic
   is attributed to, with a resolving URL (`source.note` documents hosts that refuse
   automated fetches, with a reachable alternative). A fabricated URL or invented quote is
   disqualifying.
2. Map the tensions: add the id on both sides, across schools.
3. One actionable sentence per heuristic; `stance` stays `claim`.
4. Every `processIds` entry must resolve.

Gate: `pnpm vitest run __tests__/lore-registry.test.ts --maxWorkers=2`.
