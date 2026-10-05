# Startup lore

Startup law distills principles the sources agree on. Lore is the other half: the
heuristics founders actually trade, held by schools that genuinely disagree with each
other. `registry.json` records those heuristics with provenance and keeps the
disagreements explicit.

Every entry carries the stance `claim`. A heuristic in this registry is one school's
belief about how to build a company, with a named author and a citable work behind it.
The registry takes no position on which school is right; the tension map is the content.

The episode layer lives separately: [`resources/LORE.md`](../resources/LORE.md) records
veracity-graded startup history, while this registry records the rules of thumb the
schools draw from it.

## Entry shape

Each record in `registry.json`:

| Field | Meaning |
| --- | --- |
| `id` | Stable kebab-case identifier |
| `heuristic` | The actionable rule, one sentence, a faithful paraphrase of the source |
| `school` | The tradition it comes from (`YC`, `lean`, `blitzscaling`, `bootstrapper`, `effectual`, `contrarian`, `classical`, `craft`) |
| `source` | `author`, `work`, `url`: the essay, book, or talk by the person who said it |
| `stance` | Always `claim`; a belief with provenance |
| `tensions` | Ids of heuristics it conflicts with; symmetric, and always across schools |
| `processIds` | Processes in [`processes/corpus.json`](../processes/corpus.json) the heuristic bears on |

`source.note` is optional and documents hosts that refuse automated fetches, together
with a reachable alternative where one exists.

## Tensions

The registry disagrees with itself on purpose. Launch-early claims sit against
polish-first claims, fundraise-and-blitzscale against bootstrap-and-stay-calm, focus
against many small bets, definite plans against hypothesis loops. Every tension is
recorded on both entries, and the gate fails if a tension is one-sided, dangling, or
drawn inside a single school.

## Contributing an entry

1. A source is required: a real, verifiable essay, book, or talk by the person the
   heuristic is attributed to. Check the URL resolves. If the host refuses automated
   fetches, keep the canonical URL and add a `source.note` with a reachable alternative.
   A fabricated URL or an invented quote is disqualifying; paraphrase faithfully, and if
   you quote, quote exactly.
2. Tension mapping is encouraged: find the entries your heuristic conflicts with and add
   the id on both sides. Tensions must cross schools.
3. Keep `stance` as `claim`, and keep the heuristic to one actionable sentence.
4. Point `processIds` at the corpus processes the heuristic bears on; every id must
   resolve.

Gate:

```bash
pnpm vitest run __tests__/lore-registry.test.ts --maxWorkers=2
```
