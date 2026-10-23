// Supersession auto-close for the recurring generator workflows (vendor-radar daily,
// yc-coverage weekly, accuracy-engine weekly). When a generator files its new issue (or report
// PR), this closes the generator's previous still-open items of the same kind with a comment
// naming the successor, so the open queue always has exactly one live head per generator.
//
// What may be closed:
//   - issues: the generator's recurring issue is replaced by each run's successor (the record
//     itself lives in the committed reports, not the issue), so older open ones close.
//   - PRs: ONLY when the newer PR fully regenerates the older PR's content. That holds for
//     accuracy-engine's weekly report PR (open-rankings/staleness-report.json is rewritten whole
//     every run). It does NOT hold for vendor-radar scan PRs — the seen-ledger
//     (vendor-radar.ts assembleCandidates skips every key in rankings-engine/radar-seen.json) makes
//     daily reports ADDITIVE, each dated report holding only candidates absent from every
//     earlier one — nor for yc-coverage lane PRs, which carry additive dated triage reports.
//     Those workflows never invoke this script with --kind pr.
//
// Closing is the only mutation here. The script never merges anything; merges stay human.
//
//   pnpm tsx rankings-engine/scripts/close-superseded.ts --kind issue --successor 123 \
//     --title-prefix "vendor-radar: needs-human candidates" [--title-prefix "vendor-radar: candidates"]
import { execFileSync } from 'node:child_process'
import { z } from 'zod'

export const GhItemSchema = z.object({ number: z.number(), title: z.string() })
export type GhItem = z.infer<typeof GhItemSchema>

export type Kind = 'issue' | 'pr'

// Runs `gh <args>` and returns stdout. Injectable so tests exercise the selection and the exact
// close invocations without a network or a gh binary.
export type GhRunner = (args: string[]) => string

export function realGhRunner(): GhRunner {
  return (args) => execFileSync('gh', args, { encoding: 'utf8' })
}

// The still-open items the successor replaces: title starts with one of the generator's
// prefixes, and the item is not the successor itself. Oldest first, for a stable close order.
export function pickSuperseded(openItems: GhItem[], prefixes: string[], successor: number): GhItem[] {
  return openItems
    .filter((item) => item.number !== successor && prefixes.some((p) => item.title.startsWith(p)))
    .sort((a, b) => a.number - b.number)
}

// Issue and PR numbers share one namespace on GitHub, so "#successor" resolves either way.
export function supersessionComment(kind: Kind, successor: number): string {
  return kind === 'pr'
    ? `Superseded by #${successor}, which fully regenerates this PR's content. Closed automatically by the generator workflow; merges stay human.`
    : `Superseded by #${successor}. Closed automatically by the generator workflow; the dispositions recorded here stay in the committed reports.`
}

export function closeSuperseded(opts: { kind: Kind; prefixes: string[]; successor: number; run: GhRunner }): GhItem[] {
  const { kind, prefixes, successor, run } = opts
  const listed = run([kind, 'list', '--state', 'open', '--limit', '100', '--json', 'number,title'])
  const openItems = GhItemSchema.array().parse(JSON.parse(listed))
  const stale = pickSuperseded(openItems, prefixes, successor)
  for (const item of stale) {
    run([kind, 'close', String(item.number), '--comment', supersessionComment(kind, successor)])
  }
  return stale
}

// --- CLI ----------------------------------------------------------------------------------------

export interface CliArgs {
  kind: Kind
  successor: number
  prefixes: string[]
}

export function parseArgs(argv: string[]): CliArgs {
  let kind: Kind | undefined
  let successor: number | undefined
  const prefixes: string[] = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--kind') {
      const v = argv[++i]
      if (v !== 'issue' && v !== 'pr') throw new Error(`--kind must be issue or pr, got: ${v}`)
      kind = v
    } else if (argv[i] === '--successor') {
      successor = Number(argv[++i])
    } else if (argv[i] === '--title-prefix') {
      const v = argv[++i]
      if (!v) throw new Error('--title-prefix needs a value')
      prefixes.push(v)
    } else {
      throw new Error(`unknown argument: ${argv[i]}`)
    }
  }
  if (!kind || prefixes.length === 0 || successor === undefined || !Number.isInteger(successor) || successor <= 0) {
    throw new Error(
      'usage: pnpm tsx rankings-engine/scripts/close-superseded.ts --kind issue|pr --successor <number> --title-prefix "<prefix>" [--title-prefix "<prefix>" ...]',
    )
  }
  return { kind, successor, prefixes }
}

function main(argv: string[]): void {
  const args = parseArgs(argv)
  const closed = closeSuperseded({ ...args, run: realGhRunner() })
  if (closed.length === 0) {
    console.log(`close-superseded: no open ${args.kind}s match ${args.prefixes.map((p) => JSON.stringify(p)).join(', ')} besides #${args.successor} — nothing to close`)
  } else {
    for (const item of closed) console.log(`close-superseded: closed ${args.kind} #${item.number} (${item.title}) — superseded by #${args.successor}`)
  }
}

if (require.main === module) {
  try {
    main(process.argv.slice(2))
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
