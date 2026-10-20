import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ProofIndexEntry } from '../../lib/proofs'
import { upsertProofIndex, writeProofArtifact } from '../proof-io'
import { resolveCategories } from '../paths'
import { LOCAL_PROBES } from '../probes'
import type { LocalProbe } from '../probes/types'

// Local, keyless probe commands with replayable recordings ("proofs"). Where probe.ts checks
// what a vendor *publishes* (llms.txt, OpenAPI, docs), this stage checks what a vendor *ships*:
// it runs the product's own CLI on this machine — version prints, headless-mode help, real MCP
// stdio initialize handshakes — and, when UM_RECORD=1, captures the session through the BSD
// `script` pty recorder so the resulting transcript is a faithful terminal capture, published
// at open-rankings/<category>/proofs/ (layout + sanitization contract: lib/proofs.ts).
//
// Deliberately opt-in and side-effect-light:
//   - without UM_RECORD=1 it only runs the probes and prints pass/fail (a dry run);
//   - it never touches open-rankings/<category>/evidence/*.json — proof metadata lives in sidecar JSON
//     until the schema integration phase (docs/prove-it.md, phase 2), because lib/schemas.ts
//     is owned by another lane;
//   - probes only run for binaries already installed on PATH, and every child process gets a
//     minimal env (PATH/HOME/TERM only) so no local API keys can even reach the pty.
//
// Probe definitions live in rankings-engine/probes/<arena-id>.ts — one module per arena, assembled
// into LOCAL_PROBES by rankings-engine/probes/index.ts. Add or edit probes there, not here.

export type { LocalProbe } from '../probes/types'

// Children never see the parent env (which may hold API keys): PATH to find the binary, HOME
// because CLIs read their own config, TERM for the pty, NODE_ENV because Next's type
// augmentation makes it mandatory on ProcessEnv (and it's harmless). That's it.
function minimalEnv(): NodeJS.ProcessEnv {
  return { PATH: process.env.PATH, HOME: process.env.HOME, TERM: 'xterm-256color', NODE_ENV: 'production' }
}

function binAvailable(bin: string): boolean {
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    if (dir && fs.existsSync(path.join(dir, bin))) return true
  }
  return false
}

function shellQuote(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`
}

interface RunOutcome {
  transcript: string
  exitCode: number
}

// Waits for natural exit or terminates at timeoutMs (SIGTERM, then SIGKILL). Long-running
// server probes are EXPECTED to be terminated — see LocalProbe.longRunning.
function waitForExit(child: ReturnType<typeof spawn>, timeoutMs: number): Promise<{ code: number | null; killed: boolean }> {
  return new Promise((resolve) => {
    let killed = false
    const term = setTimeout(() => {
      killed = true
      child.kill('SIGTERM')
      setTimeout(() => child.kill('SIGKILL'), 2_000).unref()
    }, timeoutMs)
    child.on('exit', (code) => {
      clearTimeout(term)
      resolve({ code, killed })
    })
    child.on('error', () => {
      clearTimeout(term)
      resolve({ code: 127, killed })
    })
  })
}

// UM_RECORD=1 path: run the probe inside a `script(1)` pty so the transcript is a real
// terminal capture. BSD script tcgetattr()s its stdin, which must therefore be a plain fd
// (here /dev/null), never a node socketpair — so stdin payloads are piped INSIDE the pty via
// `sh -c '{ cat payload; sleep 6; } | cmd'` (the sleep keeps stdin open long enough for the
// server to answer before EOF).
async function runRecorded(probe: LocalProbe, tmpDir: string): Promise<RunOutcome> {
  const outFile = path.join(tmpDir, `${probe.productId}-${probe.probeId}.raw`)
  let argv: string[]
  if (probe.stdinPayload) {
    const payloadFile = path.join(tmpDir, `${probe.productId}-${probe.probeId}.stdin`)
    fs.writeFileSync(payloadFile, probe.stdinPayload)
    const inner = `{ cat ${shellQuote(payloadFile)}; sleep 6; } | ${probe.argv.map(shellQuote).join(' ')}`
    argv = ['/usr/bin/script', '-q', '-t', '0', outFile, 'sh', '-c', inner]
  } else {
    argv = ['/usr/bin/script', '-q', '-t', '0', outFile, ...probe.argv]
  }
  const devNull = fs.openSync('/dev/null', 'r')
  const child = spawn(argv[0], argv.slice(1), { env: minimalEnv(), stdio: [devNull, 'ignore', 'ignore'] })
  const { code, killed } = await waitForExit(child, probe.timeoutMs)
  fs.closeSync(devNull)
  const transcript = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : ''
  return { transcript, exitCode: exitCodeFor(probe, transcript, code, killed) }
}

// Dry-run path (no UM_RECORD): same probes, plain stdout/stderr capture, nothing written.
async function runPlain(probe: LocalProbe): Promise<RunOutcome> {
  const child = spawn(probe.argv[0], probe.argv.slice(1), { env: minimalEnv(), stdio: ['pipe', 'pipe', 'pipe'] })
  let out = ''
  child.stdout?.on('data', (d: Buffer) => { out += d.toString() })
  child.stderr?.on('data', (d: Buffer) => { out += d.toString() })
  if (probe.stdinPayload) child.stdin?.write(probe.stdinPayload)
  else child.stdin?.end()
  const { code, killed } = await waitForExit(child, probe.timeoutMs)
  return { transcript: out, exitCode: exitCodeFor(probe, out, code, killed) }
}

function exitCodeFor(probe: LocalProbe, transcript: string, code: number | null, killed: boolean): number {
  if (probe.longRunning) return probe.expect.test(transcript) ? 0 : 1
  if (killed || code === null) return 124
  return code
}

export async function runProbeRecord({ category, product }: { category?: string; product?: string }): Promise<void> {
  const record = (process.env.UM_RECORD ?? process.env.PA_RECORD) === '1' // PA_RECORD: deprecated pre-rename spelling
  if (record && (process.platform !== 'darwin' || !fs.existsSync('/usr/bin/script'))) {
    throw new Error('UM_RECORD=1 requires the BSD script(1) pty recorder (macOS)')
  }
  if (!record) console.log('probe-record: dry run (set UM_RECORD=1 to write recordings)')

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-probe-record-'))
  try {
    for (const cat of resolveCategories(category)) {
      const probes = (LOCAL_PROBES[cat.id] ?? []).filter((p) => !product || p.productId === product)
      const entries: ProofIndexEntry[] = []
      for (const probe of probes) {
        if (!binAvailable(probe.bin)) {
          console.log(`probe-record: ${cat.id}/${probe.productId}/${probe.probeId} — skipped (${probe.bin} not on PATH)`)
          continue
        }
        const outcome = record ? await runRecorded(probe, tmpDir) : await runPlain(probe)
        const passed = probe.expect.test(outcome.transcript)
        console.log(
          `probe-record: ${cat.id}/${probe.productId}/${probe.probeId} — ${passed ? 'PASS' : 'FAIL'} (exit ${outcome.exitCode})`,
        )
        if (!record) continue
        const entry: ProofIndexEntry = {
          probeId: probe.probeId,
          productId: probe.productId,
          storyIds: probe.storyIds,
          command: probe.displayCommand,
          recordedAt: new Date().toISOString(),
          exitCode: outcome.exitCode,
          kind: 'terminal',
          file: `${probe.productId}/${probe.probeId}.txt`,
        }
        // Failed probes are still published — a claim that doesn't reproduce is a finding,
        // not a gap (docs/prove-it.md).
        writeProofArtifact(cat.id, entry, { content: `$ ${probe.displayCommand}\n${outcome.transcript}` })
        entries.push(entry)
      }
      if (record && entries.length > 0) upsertProofIndex(cat.id, entries)
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}
