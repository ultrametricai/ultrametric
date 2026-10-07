import AgenticBadge from '@/components/AgenticBadge'
import AiEraBadge from '@/components/AiEraBadge'
import GeoMark from '@/components/GeoMark'
import ProductLogo from '@/components/ProductLogo'
import ScoreBar from '@/components/ScoreBar'
import type { CategoryData } from '@/lib/data'
import { stackCoverage } from '@/lib/stacks'

export default function StacksSection({ data }: { data: CategoryData }) {
  if (data.stacks.length === 0) return null
  const productById = new Map(data.products.map((p) => [p.id, p]))

  return (
    <div>
      {/* seed "stacks": same concept mark as the header's Stacks nav link. */}
      <h2 className="font-display leading-[1.1] mb-4 flex items-center gap-2 text-lg font-semibold">
        <GeoMark seed="stacks" title="Stacks — proven product combinations in this ranking" size={18} className="text-zinc-500" />
        Stacks
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {data.stacks.map((stack) => {
          const coverage = stackCoverage(stack, data)
          return (
            <div key={stack.id} className="rounded-xl border border-zinc-800 p-5">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-3">
                  {stack.productIds.map((pid) => (
                    <div key={pid} className="rounded-lg ring-2 ring-zinc-950">
                      <ProductLogo product={productById.get(pid)!} size={32} />
                    </div>
                  ))}
                </div>
                <h3 className="font-display leading-[1.1] font-semibold">{stack.name}</h3>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-400">Overall score</span>
                  <AiEraBadge value={coverage.aiEra} size="sm" href="/methodology#arena-score" />
                </div>
                <ScoreBar score={coverage.score} />
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    <AgenticBadge kind="agent-ready" value={coverage.agentReady} size="sm" href="/methodology#ai-era" />
                    <AgenticBadge kind="agentic-app" value={coverage.agenticApp} size="sm" href="/methodology#ai-era" />
                  </div>
                  <a
                    href="#story-matrix"
                    title="Which stories apply — the ranking's full What-we-tested table below"
                    className="text-xs text-zinc-400 underline decoration-zinc-800 underline-offset-2 transition hover:text-emerald-300"
                  >
                    {coverage.applicable}/{coverage.total} stories applicable
                  </a>
                </div>
              </div>
              <p className="mt-3 text-xs italic text-zinc-400">
                Composed coverage: best member per story. Stacks don&apos;t fight battles.
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
