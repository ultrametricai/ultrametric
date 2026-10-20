// Depth runner CLI — deliberately outside rankings-engine/cli.ts so the depth suite can never block
// or destabilize the fast evidence-in/rankings-out loop (docs/agentic-depth-program.md, "Why a
// separate program"). It writes only dated snapshot directories under
// open-rankings/experiments/depth/ and touches no evidence, verdicts, or rankings.
//
//   pnpm run depth stripe                 live run -> open-rankings/experiments/depth/<date>-stripe/
//   pnpm run depth stripe --out <dir>     live run to an explicit directory
//   pnpm run depth stripe --replay <dir>  regrade recorded transcripts, diff against report.json

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, writeJson } from '../paths'
import type { DepthTranscript } from './arenabench'
import { DEPTH_TARGETS } from './checks'
import { buildReport, runDepth } from './runner'

function readFlag(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : undefined
}

function loadTranscripts(dir: string): { byCheck: Map<string, DepthTranscript>; robots: DepthTranscript[] } {
  const tdir = path.join(dir, 'transcripts')
  const byCheck = new Map<string, DepthTranscript>()
  const robots: DepthTranscript[] = []
  for (const file of fs.readdirSync(tdir).sort()) {
    if (!file.endsWith('.json')) continue
    const t = JSON.parse(fs.readFileSync(path.join(tdir, file), 'utf8')) as DepthTranscript
    if (t.checkId.startsWith('robots-')) robots.push(t)
    else byCheck.set(t.checkId, t)
  }
  return { byCheck, robots }
}

async function main() {
  const args = process.argv.slice(2)
  const targetId = args.find((a) => !a.startsWith('--') && a !== readFlag(args, '--replay') && a !== readFlag(args, '--out'))
  const target = targetId ? DEPTH_TARGETS[targetId] : undefined
  if (!target) {
    console.error(`usage: pnpm run depth <${Object.keys(DEPTH_TARGETS).join('|')}> [--out <dir>] [--replay <dir>]`)
    process.exit(1)
    return
  }

  const replayDir = readFlag(args, '--replay')
  if (replayDir) {
    const { byCheck, robots } = loadTranscripts(replayDir)
    const regraded = buildReport(target, byCheck, robots)
    const committed = JSON.parse(fs.readFileSync(path.join(replayDir, 'report.json'), 'utf8')) as unknown
    const same = JSON.stringify(regraded) === JSON.stringify(committed)
    console.log(`depth replay: ${replayDir} — ${same ? 'report reproduces exactly' : 'REPORT DRIFTED from recorded transcripts'}`)
    process.exit(same ? 0 : 1)
    return
  }

  const date = new Date().toISOString().slice(0, 10)
  const outDir = readFlag(args, '--out') ?? path.join(ROOT, 'open-rankings', 'experiments', 'depth', `${date}-${target.productId}`)
  const { report, transcripts } = await runDepth(target)
  for (const t of transcripts) {
    writeJson(path.join(outDir, 'transcripts', `${t.checkId}.json`), t)
  }
  writeJson(path.join(outDir, 'report.json'), report)
  for (const surface of report.surfaces) {
    const partial = surface.partial
      ? ` (L${surface.partial.level} partial: ${surface.partial.verified.length} verified, ${surface.partial.unverified.length} gated)`
      : ''
    console.log(`depth: ${target.productId} ${surface.surface} -> L${surface.rung}${partial}`)
    for (const c of surface.checks) console.log(`  ${c.outcome.padEnd(16)} L${c.level} ${c.checkId} — ${c.detail}`)
  }
  console.log(`depth: wrote ${outDir}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
