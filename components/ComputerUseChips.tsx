import Link from 'next/link'
import ProductLogoView from '@/components/ProductLogoView'
import { hasLogo } from '@/lib/logos'
import { computerUseOptions, type ComputerUseOption } from '@/lib/processRankings'

// The "🖥 could attempt it today" row for one MANUAL step (any non-agent route — founder
// 2026-09-18: "any time 'manual' is seen, see if we can do a computer use process for it"):
// the judged computer-use fleet (browser agents + assistants with judged computer-use
// verdicts), ranked by their verdicts on the step's committed story mapping
// (lib/processRankings.ts computerUseOptions). Honest by construction — the step KEEPS its
// form/manual/human routing; a vendor appears only with judged full/partial evidence, and the
// row renders nothing when no vendor clears that bar. Server component, shared by
// ProcessVerdict (the ceiling box) and ProcessDag (the step blocks).

// Compact verdict trace for a chip tooltip: "82/100 from 4 judged stories — full: …; partial: …".
function citeSummary(o: ComputerUseOption): string {
  const byVerdict = (kind: string) => o.cites.filter((c) => c.verdict === kind).map((c) => c.storyTitle)
  const parts: string[] = []
  const full = byVerdict('full')
  const partial = byVerdict('partial')
  if (full.length > 0) parts.push(`full: ${full.join('; ')}`)
  if (partial.length > 0) parts.push(`partial: ${partial.join('; ')}`)
  const rest = o.cites.length - full.length - partial.length
  if (rest > 0) parts.push(`${rest} not delivered`)
  return `${o.name} (${o.arenaName}) — ${o.score.toFixed(0)}/100 on this step's mapped computer-use stories · ${parts.join(' · ')}`
}

export default function ComputerUseChips({ taskId, nodeId }: { taskId: string; nodeId: string }) {
  const options = computerUseOptions(taskId, nodeId)
  if (options.length === 0) return null
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1.5">
      <span
        className="text-[10px] uppercase tracking-wide text-zinc-500"
        title="Judged computer-use agents (browser agents + assistants with judged computer-use verdicts) ranked by their verdicts on this step's mapped stories. The step stays manual — this is who could attempt the mechanical part."
      >
        🖥 could attempt it today:
      </span>
      {options.map((o) => (
        // The score is its own click-through to the judged verdicts behind it (founder
        // 2026-10-05); the chip body keeps opening the product page as before.
        <span
          key={`${o.arenaId}-${o.productId}`}
          className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900/60 py-0.5 pl-0.5 pr-2 text-[11px] text-zinc-300 transition hover:border-emerald-400/60"
        >
          <Link
            href={`/arena/${o.arenaId}/product/${o.productId}`}
            title={citeSummary(o)}
            className="inline-flex min-w-0 items-center gap-1.5 transition hover:text-emerald-300"
          >
            <ProductLogoView product={{ id: o.productId, name: o.name }} size={14} hasLogo={hasLogo(o.productId)} />
            <span className="truncate">{o.name}</span>
          </Link>
          <Link
            href={`/arena/${o.arenaId}/product/${o.productId}#story-verdicts`}
            title={`${o.score.toFixed(0)}/100 — open the judged story verdicts this score derives from`}
            className="font-mono text-[10px] tabular-nums text-emerald-400/80 transition hover:text-emerald-300"
          >{o.score.toFixed(0)}<span className="text-zinc-500">/100</span></Link>
        </span>
      ))}
      <span className="text-[10px] text-zinc-500">assisted, still human-owned</span>
    </span>
  )
}
