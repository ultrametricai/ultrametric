import type { Metadata } from 'next'
import SubmitScan from '@/components/SubmitScan'

export const metadata: Metadata = {
  title: 'Test my product — Ultrametric',
  description:
    'Paste your product URL for an instant agent-readiness quick scan (llms.txt, OpenAPI, MCP signals), then submit it for a full evidence-based ranking evaluation.',
}

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display leading-[1.1] text-3xl font-bold tracking-tight">Test my product</h1>
        <p className="mt-3 text-zinc-400">
          Paste a product URL and we&rsquo;ll run an instant agent-readiness quick scan — the
          same well-known-path checks our pipeline probes first. Then submit it to compete in a
          ranking with a full evidence-based evaluation.
        </p>
      </div>
      <SubmitScan />
      <p className="text-xs text-zinc-500">
        The scanner only fetches a fixed set of public, well-known paths (llms.txt, openapi.json,
        robots.txt, homepage) with strict limits — it never executes anything from the target,
        rejects internal or non-public addresses, and is rate-limited.
      </p>
      <p className="text-sm text-zinc-400">
        Prefer a PR? You can add your product directly: one entry in{' '}
        <code className="text-zinc-300">data/&lt;arena&gt;/products.json</code> gets you in, and
        the URLs you list are the entire corpus our judge ever sees — so include your API
        reference, rate-limit and deprecation pages. The exact entry shape, why each URL matters,
        and how to probe well (llms.txt, OpenAPI at a conventional path, a remote MCP server at{' '}
        <code className="text-zinc-300">mcp.&lt;your-domain&gt;</code>, keyless <code className="text-zinc-300">.md</code> docs
        mirrors) are in{' '}
        <a
          href="https://github.com/ultrametricai/ultrametric/blob/main/CONTRIBUTING.md#3-add-your-product"
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-400 underline decoration-emerald-400/40 hover:text-emerald-300"
        >
          CONTRIBUTING.md &sect; Add your product
        </a>
        .
      </p>
    </div>
  )
}
