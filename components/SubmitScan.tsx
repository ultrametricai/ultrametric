'use client'

import { useState } from 'react'
import { REPO } from '@/lib/site'

// The "test my product" box behind /submit. Calls the Cloudflare Worker's hardened quick-scan
// endpoint (see infra/cloudflare-proxy/worker.js: SSRF guards, capped reads, rate limits) which
// only ever GETs a fixed set of well-known paths on the submitted origin — nothing from the
// response is executed or rendered as HTML, and bad/internal URLs are rejected server-side.
const SCAN_ENDPOINT = 'https://ultrametric.ai/api/scan'

interface ScanResult {
  ok: boolean
  host?: string
  scannedAt?: string
  error?: string
  checks?: {
    llmsTxt: { found: boolean; bytes: number }
    openapi: { found: boolean }
    robots: { found: boolean; blocksAllAgents: boolean }
    homepage: { reachable: boolean; mentionsMcp: boolean; mentionsApi: boolean; mentionsCli: boolean; mentionsDocs: boolean }
  }
}

function CheckRow({ label, pass, detail }: { label: string; pass: boolean; detail: string }) {
  return (
    <li className="flex items-start gap-2 py-1.5">
      <span aria-hidden className={`font-mono ${pass ? 'text-emerald-400' : 'text-zinc-500'}`}>{pass ? '✓' : '—'}</span>
      <span>
        <span className="font-medium">{label}</span>
        <span className="ml-2 text-sm text-zinc-500">{detail}</span>
      </span>
    </li>
  )
}

export default function SubmitScan() {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runScan(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim() || busy) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const resp = await fetch(SCAN_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const json: ScanResult & { error?: string } = await resp.json()
      if (!resp.ok) {
        setError(json.error ?? `scan failed (${resp.status})`)
      } else {
        setResult(json)
      }
    } catch {
      setError('could not reach the scanner — try again in a moment')
    } finally {
      setBusy(false)
    }
  }

  const c = result?.checks
  const issueUrl = result?.host
    ? `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(`Submit a product: ${result.host}`)}&body=${encodeURIComponent(
        `Product URL: https://${result.host}\n\nQuick scan (${result.scannedAt ?? ''}):\n- llms.txt: ${c?.llmsTxt.found ? `yes (${c.llmsTxt.bytes} bytes)` : 'no'}\n- openapi.json: ${c?.openapi.found ? 'yes' : 'no'}\n- homepage mentions: ${[c?.homepage.mentionsMcp && 'MCP', c?.homepage.mentionsApi && 'API', c?.homepage.mentionsCli && 'CLI', c?.homepage.mentionsDocs && 'docs'].filter(Boolean).join(', ') || 'none detected'}\n\nSuggested ranking: <which ranking should this compete in?>\nWhy it belongs: <one or two lines>`,
      )}`
    : `https://github.com/${REPO}/issues/new?template=request-a-product.yml`

  return (
    <div className="space-y-6">
      <form onSubmit={runScan} className="flex flex-wrap items-center gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://yourproduct.com"
          aria-label="Product URL to scan"
          required
          className="min-w-0 flex-1 basis-64 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-400/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:opacity-50"
        >
          {busy ? 'Scanning…' : 'Test my product'}
        </button>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {result && !result.ok && (
        <p className="text-sm text-zinc-400">
          We couldn&rsquo;t reach <span className="font-mono">{result.host}</span> from our scanner
          — the site may block automated requests. You can still{' '}
          <a href={issueUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline decoration-emerald-400/40 hover:text-emerald-300">
            submit it for evaluation
          </a>.
        </p>
      )}

      {result?.ok && c && (
        <div className="rounded-2xl border border-zinc-800 p-5">
          <h2 className="font-display text-lg font-semibold">
            Quick scan: <span className="font-mono text-emerald-300">{result.host}</span>
          </h2>
          <ul className="mt-3 divide-y divide-zinc-800/60">
            <CheckRow label="llms.txt" pass={c.llmsTxt.found} detail={c.llmsTxt.found ? `served (${c.llmsTxt.bytes.toLocaleString()} bytes) — agents can read your docs index` : 'not served — the #1 quick win for agent visibility'} />
            <CheckRow label="OpenAPI spec" pass={c.openapi.found} detail={c.openapi.found ? 'machine-readable API spec at /openapi.json' : 'no spec at /openapi.json (it may live elsewhere — the full evaluation digs deeper)'} />
            <CheckRow label="MCP mentioned" pass={c.homepage.mentionsMcp} detail={c.homepage.mentionsMcp ? 'homepage references the Model Context Protocol' : 'no MCP mention on the homepage'} />
            <CheckRow label="API / CLI / docs signals" pass={c.homepage.mentionsApi || c.homepage.mentionsCli || c.homepage.mentionsDocs} detail={[c.homepage.mentionsApi && 'API', c.homepage.mentionsCli && 'CLI', c.homepage.mentionsDocs && 'docs'].filter(Boolean).join(' · ') || 'none detected on the homepage'} />
            <CheckRow label="Agents allowed" pass={c.robots.found && !c.robots.blocksAllAgents} detail={!c.robots.found ? 'no robots.txt found' : c.robots.blocksAllAgents ? 'robots.txt disallows everything — agents are locked out' : 'robots.txt does not block all agents'} />
          </ul>
          <p className="mt-4 text-xs text-zinc-500">
            This is a surface scan of well-known paths only. The full ranking evaluation crawls
            docs, collects community evidence, runs probes, and judges ~50 user stories.
          </p>
          <a
            href={issueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
          >
            Submit for full ranking evaluation →
          </a>
        </div>
      )}
    </div>
  )
}
