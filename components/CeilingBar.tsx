// Compact "agent ceiling" bar: the share of a process's steps an agent can run today.
// Emerald fill = agent-runnable share; the zinc remainder is the human/manual gap.
export default function CeilingBar({ pct, className = '' }: { pct: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-800" role="img" aria-label={`${pct}% of steps agent-runnable`}>
        <span className="block h-full rounded-full bg-emerald-400/80" style={{ width: `${pct}%` }} />
      </span>
      {/* Bare percentage (founder 2026-10-02: drop the word 'agent' — the aria-label and the
          column header carry the concept). */}
      <span className="whitespace-nowrap font-mono text-xs tabular-nums text-emerald-300">{pct}%</span>
    </span>
  )
}
