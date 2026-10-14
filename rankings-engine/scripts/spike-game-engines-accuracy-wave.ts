// Game-engines accuracy wave (2026-09-23, founder ask: "make the game-engine arena accurate").
// One budget-capped exhaustive pass over ONE game engine — the same crawl → extract → probe →
// judge → churn-settle loop as pipeline/scripts/spike-engine.ts's spikeProduct (whose exported
// churnDecision/discoverUrlsFromLlmsTxt this reuses verbatim), with the one extra step the
// stock pass lacks and this arena requires: `pnpm pipeline probe` wholesale-replaces probe-tier
// evidence, which would silently wipe the hand-recorded `*-probe-rt-*` runtime items
// (append-game-engines-runtime-probes.py documents "Run AFTER probe" for exactly this reason).
// Running the stock spikeProduct would therefore judge against an evidence pack missing its
// strongest runtime facts and the churn settle would be unable to restore the old verdicts
// (dangling rt citations). This driver re-runs the append script between probe and judge so
// every judge pass sees the full pack.
//
// Curated URL appends (all curl-verified live) happen BEFORE this runs — see the products.json
// diff in the same commit; this script only does llms.txt discovery on top, within the
// remaining budget, exactly like spike-engine (same-domain, live-200-verified, agent-surface
// tokens ranked first).
//
// Wave sequencing (learned live on the first product): the rt-item append touches unity,
// godot, AND unreal evidence in the same run, so `judge --product X` succeeds at judging X but
// its verdicts.json assembly step refuses while any OTHER touched product's cache is stale
// ("stale cached verdict ... re-run judge"). Mid-wave that staleness is EXPECTED — this driver
// treats exactly that assembly error as non-fatal in `--mid-wave` mode, and the wave finishes
// with one `judge --category game-engines` (full assembly) followed by
// settle-game-engines-accuracy-wave.ts, which applies spike-engine's churnDecision for every
// product against the pre-wave baseline (git HEAD).
//
// Usage: pnpm exec tsx pipeline/scripts/spike-game-engines-accuracy-wave.ts --product <id> --budget-urls <n> [--mid-wave]
// Requires ANTHROPIC_API_KEY (appending evidence without a same-run re-judge strands caches).
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { EvidenceSchema } from '../../lib/schemas'
import { DATA_DIR, ROOT, writeJson } from '../paths'
import { discoverUrlsFromLlmsTxt } from './spike-engine'

const ARENA = 'game-engines'
const TIMEOUT_MS = 10_000
const USER_AGENT = 'Mozilla/5.0 (compatible; Ultrametric-spike-engine/1.0; +https://ultrametric.ai)'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function fetchText(url: string): Promise<{ status: number; text: string } | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow', signal: controller.signal })
    const text = await res.text()
    clearTimeout(timer)
    return { status: res.status, text }
  } catch {
    return null
  }
}

function runStage(cmd: string, args: string[]): void {
  const res = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' })
  if (res.status !== 0) throw new Error(`spike-game-engines: \`${cmd} ${args.join(' ')}\` exited ${res.status}`)
}

async function main(): Promise<void> {
  const productId = arg('--product')
  const budget = Number(arg('--budget-urls') ?? 12)
  if (!productId || !Number.isFinite(budget) || budget < 0) {
    throw new Error('usage: spike-game-engines-accuracy-wave.ts --product <id> --budget-urls <n>')
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('spike-game-engines: needs ANTHROPIC_API_KEY (a pass appends evidence and must re-judge in the same run)')
  }

  const arenaDir = path.join(DATA_DIR, ARENA)
  const productsFile = path.join(arenaDir, 'products.json')
  // Raw read where this writes back — zod .parse() strips unknown keys (spike-engine's rule).
  const products = JSON.parse(fs.readFileSync(productsFile, 'utf8')) as Array<{
    id: string
    urls: { site?: string; docs?: string; extra?: string[] }
  }>
  const product = products.find((p) => p.id === productId)
  if (!product) throw new Error(`spike-game-engines: unknown product ${productId}`)

  const evidenceFile = path.join(arenaDir, 'evidence', `${productId}.json`)

  // Pre-pass evidence ids, for the +N summary only — the churn BASELINE is the pre-wave git
  // HEAD state, applied once by settle-game-engines-accuracy-wave.ts after the last product.
  const oldEvidence = EvidenceSchema.array().parse(JSON.parse(fs.readFileSync(evidenceFile, 'utf8')))
  const oldEvidenceIds = new Set(oldEvidence.map((e) => e.id))

  // 1. llms.txt discovery on the docs origin (curated URLs were appended before this run and
  //    count against the budget: only the remainder may be discovered).
  const notes: string[] = []
  const urlsAdded: string[] = []
  const docsUrl = product.urls.docs ?? product.urls.site
  if (docsUrl && budget > 0) {
    const origin = new URL(docsUrl).origin
    const llms = await fetchText(`${origin}/llms.txt`)
    if (llms && llms.status === 200 && /^#|\]\(http/m.test(llms.text)) {
      const existing = new Set<string>([...(product.urls.extra ?? []), product.urls.site ?? '', product.urls.docs ?? ''])
      const candidates = discoverUrlsFromLlmsTxt(llms.text, docsUrl, existing, budget)
      for (const url of candidates) {
        const live = await fetchText(url)
        if (live && live.status === 200 && live.text.trim().length > 0) urlsAdded.push(url)
      }
      if (urlsAdded.length === 0) notes.push('llms.txt live; no new same-domain URLs beyond the crawled surface')
    } else {
      notes.push(`no llms.txt on ${origin} (recorded absence)`)
    }
  }
  if (urlsAdded.length > 0) {
    product.urls.extra = [...(product.urls.extra ?? []), ...urlsAdded]
    writeJson(productsFile, products)
    console.log(`spike-game-engines: ${productId} discovered ${urlsAdded.length} url(s) from llms.txt`)
  }

  // 2. Pipeline stages — with the rt-item re-append between probe and judge (see header).
  runStage('pnpm', ['exec', 'tsx', 'pipeline/cli.ts', 'crawl', '--category', ARENA, '--product', productId])
  runStage('pnpm', ['exec', 'tsx', 'pipeline/cli.ts', 'extract', '--category', ARENA, '--product', productId])
  runStage('pnpm', ['exec', 'tsx', 'pipeline/cli.ts', 'probe', '--category', ARENA, '--product', productId])
  runStage('python3', ['pipeline/scripts/append-game-engines-runtime-probes.py'])
  const midWave = process.argv.includes('--mid-wave')
  const judge = spawnSync('pnpm', ['exec', 'tsx', 'pipeline/cli.ts', 'judge', '--category', ARENA, '--product', productId], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  process.stdout.write(judge.stdout ?? '')
  process.stderr.write(judge.stderr ?? '')
  if (judge.status !== 0) {
    const staleAssembly = /stale cached verdict for/.test(`${judge.stdout}\n${judge.stderr}`)
    if (!(midWave && staleAssembly)) {
      throw new Error(`spike-game-engines: judge --product ${productId} exited ${judge.status}`)
    }
    console.log('spike-game-engines: assembly stale on OTHER touched products — expected mid-wave, continuing.')
  }

  const newEvidence = EvidenceSchema.array().parse(JSON.parse(fs.readFileSync(evidenceFile, 'utf8')))
  const evidenceAdded = newEvidence.filter((e) => !oldEvidenceIds.has(e.id)).length
  console.log(
    `spike-game-engines: ${productId} — +${urlsAdded.length} discovered urls, +${evidenceAdded} evidence. ${notes.join('; ')}`,
  )
  console.log(
    'spike-game-engines: after the LAST product run `judge --category game-engines`, then ' +
      'settle-game-engines-accuracy-wave.ts, then na-harmonize + derive + intervals.',
  )
}

main()
  .then(() => setImmediate(() => process.exit(0))) // same kept-alive-session force-exit as pipeline/cli.ts
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
