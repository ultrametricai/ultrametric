import Link from 'next/link'
import type { StepVendorCalls } from '@/lib/stepVendorCalls'

// Read-only documentation receipts; this disclosure neither invokes tools nor
// claims that the shared process has a verified execution integration.
export default function StepReceipts({ vendors }: { vendors: StepVendorCalls[] }) {
  if (!vendors.length) return null
  return <details className="min-w-0 text-sm text-zinc-400">
    <summary className="cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-zinc-300">Documented API calls ({vendors.reduce((count, vendor) => count + vendor.calls.length, 0)})</summary>
    <p className="mt-2 leading-relaxed">Calls recorded in vendor documentation for this source step. These receipts do not establish a configured or tested process integration.</p>
    <div className="mt-3 space-y-4">{vendors.map(vendor => <div key={`${vendor.arenaId}/${vendor.productId}`} className="space-y-2">
      <Link href={`/arena/${vendor.arenaId}/product/${vendor.productId}`} className="text-zinc-300 hover:text-emerald-300">{vendor.name}</Link>
      <ul className="space-y-3">{vendor.calls.map(call => <li key={`${call.type}:${call.method}`} className="space-y-1 [overflow-wrap:anywhere]">
        <code className="whitespace-pre-wrap text-sm text-zinc-300">{call.method}</code>
        {call.description && <p>{call.description}</p>}
        <a href={call.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-300 underline decoration-zinc-700 underline-offset-2">Documentation source</a>
      </li>)}</ul>
    </div>)}</div>
  </details>
}
