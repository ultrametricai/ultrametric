// Re-triage of the two approved-pending 2026-10-23 candidates, Munito AI (issue #434) and
// ObsessionDB (issue #431), ahead of their bring-ups (one-shot, committed with the wave it
// records, like radar-retriage-issue-378.ts).
//
// Why a re-triage: the scan-day records carried two data problems the #434 audit flagged.
//
//   - Munito AI's radar triage auto-approved it into agent-frameworks on generic lexical hits
//     (agent, model, sdks, agents), and its docs-surface receipt resolved to a stylesheet asset
//     (https://munito.ai/assets/docs-DacSO4We.css) — the findDocsLink bug fixed alongside this
//     script. The same day's yc-coverage triage classified the company inference-providers
//     (its YC launch title: "Open-model inference provider for Europe, private by default")
//     but scored 2 lexical hits, below the MIN_FIT_HITS=3 floor. The live surfaces settle the
//     placement: munito.ai/llms.txt and docs.munito.ai describe a hosted inference cloud
//     serving open-weight models over OpenAI- and Anthropic-compatible chat-completions
//     endpoints — the inference-providers definition verbatim, and not an agent framework.
//
//   - ObsessionDB was auto-approved into data-warehouses by the yc triage; this run re-verifies
//     that disposition live before the bring-up lands, as the issue requires.
//
// Both candidates replay the mechanical criteria checks from the committed yc-queue entries
// (the same radarReportFromQueue hand-off the weekly lane triages), live. Statuses stay the
// mechanical outcomes; the review decision recorded in each reason (and on issues #434/#431) is
// the human review that resolves a routing the lexical floor cannot. Bring-up still runs the
// standard scoped engine pipeline, and the bring-up PR review confirms the arena against its
// definition, per docs/VENDOR-RADAR.md.
//
// Usage: pnpm tsx rankings-engine/scripts/radar-retriage-issues-434-431.ts
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, readCategories, writeJson } from '../paths'
import { REPORTS_DIR } from './vendor-radar'
import { YcQueueSchema, radarReportFromQueue } from './yc-coverage-queue'
import { TriageReportSchema, buildTriageMarkdown, realTriageIo, triageCandidate, type Disposition, type TriageIo } from './radar-triage'

const QUEUE_PATH = path.join(ROOT, 'open-rankings', 'yc-queue.json')

const DECISIONS: Record<string, { arena: string; note: string; receipts: string[] }> = {
  'domain:munito.ai': {
    arena: 'inference-providers',
    note: 'review decision 2026-10-23 (issue #434): the radar’s agent-frameworks placement was lexical only and its docs receipt resolved to a CSS asset; the live product surface is a hosted open-model inference cloud with OpenAI- and Anthropic-compatible chat-completions base URLs, the inference-providers definition. A ranking-fit routing below the lexical floor is resolved by this recorded review; the bring-up PR review confirms the arena against its definition.',
    receipts: ['https://docs.munito.ai/', 'https://munito.ai/llms.txt'],
  },
  'domain:obsessiondb.com': {
    arena: 'data-warehouses',
    note: 'review decision 2026-10-23 (issue #431): placement confirmed against the arena definition — ObsessionDB is fully managed hosting for the ClickHouse SQL analytics engine (its llms.txt: "the official ClickHouse engine on a rebuilt storage layer with compute–storage separation") and self-describes as a real-time data warehouse; MotherDuck (managed DuckDB) is the rostered precedent for managed hosting of an OSS analytics engine in this arena.',
    receipts: ['https://obsessiondb.com/llms.txt'],
  },
}

// A dated, citable receipt line for a supplementary live fetch: status, content type, and the
// first heading-ish line of a plain-text body (what the surface says it is).
async function receiptLine(io: TriageIo, url: string): Promise<string> {
  const res = await io.fetchPage(url)
  const ct = res.contentType ? `, ${res.contentType}` : ''
  const firstLine = res.html
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0)
  const quote = res.status === 200 && firstLine && !firstLine.startsWith('<') ? `, first line: ${JSON.stringify(firstLine.slice(0, 160))}` : ''
  return `${url} — HTTP ${res.status}${ct}${quote} (fetched ${new Date().toISOString().slice(0, 10)})`
}

async function main(): Promise<void> {
  const categories = readCategories()
  const existingArenas = new Set(categories.map((c) => c.id))
  const arenaDefinitions = new Map<string, string>(categories.map((c) => [c.id, c.description]))
  const io = realTriageIo()

  const queue = YcQueueSchema.parse(JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8')))
  const report = radarReportFromQueue(queue, '2026-10-23')
  const dispositions: Disposition[] = []

  for (const [key, decision] of Object.entries(DECISIONS)) {
    const original = report.candidates.find((c) => c.key === key)
    if (!original) throw new Error(`candidate ${key} not found in the committed yc-queue hand-off`)
    const queued = original.matchedArenas.find((m) => m.arena === decision.arena)
    if (!queued) throw new Error(`${key} carries no committed fit record for ${decision.arena}`)
    const d = await triageCandidate(original, existingArenas, io, arenaDefinitions)
    const receipts = await Promise.all(decision.receipts.map((u) => receiptLine(io, u)))
    const definition = arenaDefinitions.get(decision.arena)
    dispositions.push({
      ...d,
      arena: decision.arena,
      reason: `${d.reason}; ${decision.note}`,
      evidence: [
        `arena-definition ${decision.arena}: ${JSON.stringify(definition)} (committed fit record: ${queued.hits} lexical hits, yc-classify 'classified')`,
        // The mechanical run's own arena-definition line (same definition, keywordless lexical
        // match) would repeat the line above; keep its fetch receipts only.
        ...d.evidence.filter((e) => !e.startsWith('arena-definition ')),
        ...receipts,
      ],
    })
  }

  const triage = TriageReportSchema.parse({
    _comment:
      'Generated by rankings-engine/scripts/radar-retriage-issues-434-431.ts — live re-verification of the two approved-pending 2026-10-23 candidates (Munito AI, issue #434; ObsessionDB, issue #431) from the committed yc-queue hand-off, ahead of their bring-ups. Statuses are the mechanical criteria outcomes; the review decision recorded in each reason (and on the issues) resolves placement. Bring-up still runs the standard scoped engine pipeline.',
    generatedAt: new Date().toISOString(),
    policy: 'policies/AGENT_POLICY.md#vendor-radar-candidate-approval',
    dispositions,
  })
  const out = path.join(REPORTS_DIR, '2026-10-23-issues-434-431-retriage.json')
  writeJson(out, triage)
  const markdown = buildTriageMarkdown(triage)
  fs.writeFileSync(out.replace(/\.json$/, '.md'), markdown + '\n')
  console.log(markdown)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
