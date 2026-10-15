// Agent-surface SLO check: keylessly pings every product's DOCUMENTED agent surfaces and
// appends one line per check to open-rankings/slo-history.jsonl (schema + uptime math in lib/slo.ts).
// "Documented" is deliberate — we only monitor surfaces we have previously observed to exist,
// so the down-list is a real outage list, never "product X never had an llms.txt":
//
//   llms-txt  — the URL from a positive probe-tier evidence item ("PROBE llms.txt: HTTP 200
//               at …", rankings-engine/stages/probe.ts) on the product's docs/site origin.
//   openapi   — likewise, the URL from a positive "PROBE openapi: HTTP 200" evidence item.
//   mcp       — the product's own remote MCP endpoint from the lib/mcpEndpoints.ts allowlist,
//               plus any endpoint a recorded handshake proof (open-rankings/*/proofs, lib/proofs.ts)
//               POSTed a `<jsonrpc initialize>` to (every recorded handshake answered 2xx/400/
//               401 — all alive — so proofs never seed the monitor with a never-existed URL).
//
// Each check: 8s timeout, ≤3 concurrent, GET for llms-txt/openapi, a JSON-RPC initialize POST
// for MCP. Up/down is status-class based (lib/slo.ts classifyUp): down only on timeout/network
// error, 404/410, or 5xx — an auth-gated MCP endpoint answering 401 is up by design.
//
// Keyless and cheap by construction: wired into .github/workflows/story-runner.yml before the
// PR step, so every 6-hour run grows a real uptime series. Run manually with
//   pnpm tsx rankings-engine/scripts/slo-check.ts
import fs from 'node:fs'
import path from 'node:path'
import { MCP_ENDPOINTS } from '../../lib/mcpEndpoints'
import { ProofIndexSchema } from '../../lib/proofs'
import { EvidenceSchema, ProductSchema } from '../../lib/schemas'
import { classifyUp, SLO_HISTORY_FILE, type SloEntry, type SloSurface } from '../../lib/slo'
import { DATA_DIR, readCategories, readJson } from '../paths'

const TIMEOUT_MS = 8_000
const MAX_CONCURRENT = 3
const USER_AGENT = 'Mozilla/5.0 (compatible; Ultrametric-SLO/1.0; +https://ultrametric.ai)'

interface Target {
  arena: string
  productId: string
  surface: SloSurface
  url: string
}

// Trailing-slash-insensitive dedupe key so the allowlist's "https://mcp.stripe.com/" and a
// proof's "https://mcp.stripe.com" count as one surface.
const normUrl = (url: string) => url.replace(/\/+$/, '')

function collectTargets(): Target[] {
  const targets: Target[] = []
  for (const cat of readCategories()) {
    const dir = path.join(DATA_DIR, cat.id)
    const productsFile = path.join(dir, 'products.json')
    if (!fs.existsSync(productsFile)) continue
    const products = readJson(ProductSchema.array(), productsFile)

    // Proof-recorded MCP handshake endpoints, grouped by product.
    const proofMcpUrls = new Map<string, string[]>()
    const proofIndexFile = path.join(dir, 'proofs', 'index.json')
    if (fs.existsSync(proofIndexFile)) {
      for (const proof of readJson(ProofIndexSchema, proofIndexFile).proofs) {
        if (!proof.command.includes('<jsonrpc initialize>')) continue
        const m = proof.command.match(/-X POST (https:\/\/[^\s']+)/)
        if (!m) continue
        const list = proofMcpUrls.get(proof.productId)
        if (list) list.push(m[1])
        else proofMcpUrls.set(proof.productId, [m[1]])
      }
    }

    for (const p of products) {
      // llms-txt / openapi from positive probe evidence (the probe records the exact URL).
      const evidenceFile = path.join(dir, 'evidence', `${p.id}.json`)
      if (fs.existsSync(evidenceFile)) {
        for (const e of readJson(EvidenceSchema.array(), evidenceFile)) {
          if (e.tier !== 'probe') continue
          if (e.excerpt.startsWith('PROBE llms.txt: HTTP 200')) {
            targets.push({ arena: cat.id, productId: p.id, surface: 'llms-txt', url: e.url })
          } else if (e.excerpt.startsWith('PROBE openapi: HTTP 200')) {
            targets.push({ arena: cat.id, productId: p.id, surface: 'openapi', url: e.url })
          }
        }
      }

      // MCP: allowlist endpoint + proof-recorded ones, deduped.
      const seen = new Set<string>()
      const allowlisted = MCP_ENDPOINTS[`${cat.id}/${p.id}`]
      for (const url of [...(allowlisted ? [allowlisted] : []), ...(proofMcpUrls.get(p.id) ?? [])]) {
        if (seen.has(normUrl(url))) continue
        seen.add(normUrl(url))
        targets.push({ arena: cat.id, productId: p.id, surface: 'mcp', url })
      }
    }
  }
  // Belt-and-braces dedupe (a product could carry two identical positive probe items) and a
  // stable check/append order.
  const unique = new Map<string, Target>()
  for (const t of targets) unique.set(`${t.arena}/${t.productId}/${t.surface}/${normUrl(t.url)}`, t)
  return [...unique.values()].sort(
    (a, b) =>
      a.arena.localeCompare(b.arena) ||
      a.productId.localeCompare(b.productId) ||
      a.surface.localeCompare(b.surface) ||
      a.url.localeCompare(b.url),
  )
}

// A real initialize request, not a bare GET: streamable-HTTP MCP servers commonly 405 GETs but
// answer POSTs — with a 401 when auth-gated, which is exactly the "alive" signal we record.
const MCP_INIT_BODY = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'ultrametric-slo', version: '1.0' },
  },
})

async function checkStatus(t: Target): Promise<number> {
  try {
    const res = await fetch(
      t.url,
      t.surface === 'mcp'
        ? {
            method: 'POST',
            headers: {
              'User-Agent': USER_AGENT,
              'Content-Type': 'application/json',
              Accept: 'application/json, text/event-stream',
            },
            body: MCP_INIT_BODY,
            redirect: 'follow',
            signal: AbortSignal.timeout(TIMEOUT_MS),
          }
        : {
            headers: { 'User-Agent': USER_AGENT },
            redirect: 'follow',
            signal: AbortSignal.timeout(TIMEOUT_MS),
          },
    )
    // Never read the body — an MCP SSE stream would hang the worker. Cancel and move on.
    void res.body?.cancel().catch(() => {})
    return res.status
  } catch {
    return 0 // timeout / DNS / TLS / connection refused — no HTTP response at all
  }
}

async function run(): Promise<void> {
  const targets = collectTargets()
  console.log(`slo-check: ${targets.length} documented agent surfaces to check (≤${MAX_CONCURRENT} concurrent, ${TIMEOUT_MS / 1000}s timeout)`)

  const date = new Date().toISOString()
  const results: SloEntry[] = new Array(targets.length)
  let next = 0
  async function worker(): Promise<void> {
    while (next < targets.length) {
      const i = next++
      const t = targets[i]
      const status = await checkStatus(t)
      results[i] = { date, productId: t.productId, arena: t.arena, surface: t.surface, url: t.url, up: classifyUp(status), status }
    }
  }
  await Promise.all(Array.from({ length: MAX_CONCURRENT }, worker))

  const file = path.join(DATA_DIR, SLO_HISTORY_FILE)
  fs.appendFileSync(file, results.map((r) => JSON.stringify(r)).join('\n') + '\n')

  const down = results.filter((r) => !r.up)
  console.log(`slo-check: ${results.length - down.length} up, ${down.length} down → appended ${results.length} lines to ${path.relative(process.cwd(), file)}`)
  for (const r of down) {
    console.log(`  DOWN ${r.arena}/${r.productId} ${r.surface} ${r.url} (status ${r.status || 'timeout/error'})`)
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
