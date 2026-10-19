// Settle the 2026-10-15..19 radar reports against the committed seen-ledger (one-shot,
// committed with the wave it corrects, like the revert-churn-*-wave.ts scripts).
//
// The 2026-10-14 pipeline/ -> rankings-engine/ move left vendor-radar.ts reading and writing
// the ledger at the retired pipeline/radar-seen.json path: loadSeenLedger degraded to null,
// so the 10-15..19 scans re-reported already-seen candidates as new ("0 previously
// surfaced") and wrote their ledger updates to a path the workflow does not commit. The
// path constant is fixed in the same wave; this script replays the dedupe those five runs
// should have done, over the committed reports. Survivor records stay verbatim.
//
//   - Day by day (15 -> 19): a candidate whose key is already in the cumulative ledger is
//     dropped from the report and counted in skipped.alreadySeen; survivors keep their
//     recorded firstSeen (the honest date of the run that first reported them).
//   - The markdown is regenerated with the same buildMarkdown the scan uses.
//   - The day's triage file keeps only surviving candidates' dispositions.
//   - Survivors enter the ledger, written once with the last run's generatedAt.
//
// PLACEMENT_CORRECTIONS routes auto-approved dispositions to needs-human where the
// product's own description (fetched 2026-10-19) does not match the auto-approved arena's
// open-rankings/categories.json definition: criterion 1 requires that the product clearly
// belongs in one existing arena, and these placements rest on incidental keyword hits.
//
// Usage: pnpm tsx rankings-engine/scripts/radar-settle-2026-10-15-19.ts
import fs from 'node:fs'
import path from 'node:path'
import { writeJson } from '../paths'
import {
  REPORTS_DIR,
  SEEN_LEDGER_FILE,
  RadarReportSchema,
  SeenLedgerSchema,
  buildMarkdown,
  loadSeenLedger,
} from './vendor-radar'
import { TriageReportSchema, type Disposition } from './radar-triage'

const DATES = ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19']

// status/criterion/reason replacements, keyed by candidate key; evidence is appended.
const PLACEMENT_CORRECTIONS: Record<string, { reason: string; evidence: string[] }> = {
  'github:edenfunf/reelmimic': {
    reason:
      'queue review 2026-10-19: the repo describes an AI video style-transfer crew ("Show it a video you love. Get a new video in the same style."), not a pull-request code-review agent; the ai-code-review hits (review, reviews, code) are incidental. Needs a human arena decision.',
    evidence: [
      'github:edenfunf/reelmimic description (fetched 2026-10-19): "Show it a video you love. Get a new video in the same style. An AI crew (Claude Code or Codex) plans, builds and reviews it with you." — topics: ai-video, video-generation, style-transfer',
    ],
  },
  'domain:proa.so': {
    reason:
      'queue review 2026-10-19: Proa is a Rust web framework ("A batteries-included Rust web framework... multi-target rendering") and the frontend-frameworks definition scopes JavaScript UI frameworks and their toolchains. Needs a human arena decision.',
    evidence: [
      'https://proa.so/ meta description (fetched 2026-10-19): "A batteries-included Rust web framework built around a new programming model for composable, multi-target rendering."',
    ],
  },
  'domain:opusjake.ai': {
    reason:
      'queue review 2026-10-19: replica-skill is a Claude skill collection for cloning apps ("Eleven free Claude skills that clone any app"), not a pull-request code-review agent; the ai-code-review hits (bugs, fix) are incidental. Likely agent-skills; needs a human arena decision.',
    evidence: [
      'github:Jakeschincariol/replica-skill description (fetched 2026-10-19): "Eleven free Claude skills that clone any app: reverse-engineer it, rebuild it, test it for bugs, then fix what its users hate. Free, MIT." — topics: agent-skills, claude-code, app-clone',
    ],
  },
  'domain:getsill.app': {
    reason:
      'queue review 2026-10-19: sill is a Mac-to-iPhone/iPad screen-sharing app ("Any window from your Mac, live on your iPhone or iPad"), not a hardware FIDO2/WebAuthn authenticator; the security-keys hits (keys, touch) are incidental. Needs a human arena decision.',
    evidence: [
      'github:Saffsanity/sill description (fetched 2026-10-19): "Any window from your Mac, live on your iPhone or iPad. Touch, Apple Pencil, trackpad and keys. Free, open source, no servers." — topics: remote-desktop, screen-sharing, ios',
    ],
  },
  'domain:filee.sh': {
    reason:
      'queue review 2026-10-19: Filee is an offline desktop file converter ("Convert 244+ formats offline by drag & drop"), not a document AI API producing LLM-ready markdown/JSON; the document-extraction hits (document, pdf) are incidental. Needs a human arena decision.',
    evidence: [
      'github:KnifeLemon/Filee description (fetched 2026-10-19): "Free, open-source file converter. Convert 244+ formats offline by drag & drop — images, PDF, Word, Excel, PowerPoint, HWP/HWPX, video, audio, e-books and archives. No upload, no Office needed." — topics: file-converter, document-converter',
    ],
  },
  'github:onehumanbeing/esp32-iphone-agent': {
    reason:
      'queue review 2026-10-19: esp32-iphone-agent is a hardware computer-use rig ("Let an AI model use a real iPhone with a $7 ESP32"), not a framework/SDK for building LLM agents; the agent-frameworks hits (agent, llm, model) are incidental. Needs a human arena decision.',
    evidence: [
      'github:onehumanbeing/esp32-iphone-agent description (fetched 2026-10-19): "Let an AI model use a real iPhone with a $7 ESP32: AirPlay eyes, USB HID hands, any OpenAI-compatible vision model. No Mac, no developer account, no jailbreak." — topics: computer-use, esp32, usb-hid',
    ],
  },
}

function applyCorrection(d: Disposition): Disposition {
  const c = PLACEMENT_CORRECTIONS[d.key]
  if (!c || d.status !== 'auto-approved') return d
  return {
    ...d,
    status: 'needs-human',
    criterion: 'ranking-fit',
    reason: c.reason,
    evidence: [...d.evidence, ...c.evidence],
    bringup: null,
  }
}

function main(): void {
  const ledger = loadSeenLedger()
  if (!ledger) throw new Error(`no committed seen-ledger at ${SEEN_LEDGER_FILE}`)
  const cumulative = new Map(ledger.seen.map((s) => [s.key, s]))
  let lastGeneratedAt = ledger.updatedAt

  for (const date of DATES) {
    const reportPath = path.join(REPORTS_DIR, `${date}.json`)
    const report = RadarReportSchema.parse(JSON.parse(fs.readFileSync(reportPath, 'utf8')))
    const survivors = report.candidates.filter((c) => !cumulative.has(c.key))
    const dropped = report.candidates.length - survivors.length
    const settled = RadarReportSchema.parse({
      ...report,
      skipped: { ...report.skipped, alreadySeen: report.skipped.alreadySeen + dropped },
      candidates: survivors,
    })
    writeJson(reportPath, settled)
    fs.writeFileSync(path.join(REPORTS_DIR, `${date}.md`), buildMarkdown(settled) + '\n')

    const triagePath = path.join(REPORTS_DIR, `${date}-triage.json`)
    const triage = TriageReportSchema.parse(JSON.parse(fs.readFileSync(triagePath, 'utf8')))
    const keep = new Set(survivors.map((c) => c.key))
    writeJson(
      triagePath,
      TriageReportSchema.parse({
        ...triage,
        dispositions: triage.dispositions.filter((d) => keep.has(d.key)).map(applyCorrection),
      }),
    )

    for (const c of survivors) {
      cumulative.set(c.key, { key: c.key, name: c.name, firstSeen: c.firstSeen, sources: c.sources.map((s) => s.url) })
    }
    lastGeneratedAt = report.generatedAt
    console.log(`radar-settle: ${date} — ${survivors.length} kept, ${dropped} re-reported candidates dropped as already seen`)
  }

  writeJson(
    SEEN_LEDGER_FILE,
    SeenLedgerSchema.parse({
      _comment: ledger._comment,
      updatedAt: lastGeneratedAt,
      seen: [...cumulative.values()].sort((a, b) => a.key.localeCompare(b.key)),
    }),
  )
  console.log(`radar-settle: seen-ledger now ${cumulative.size} entries (updatedAt ${lastGeneratedAt})`)
}

main()
