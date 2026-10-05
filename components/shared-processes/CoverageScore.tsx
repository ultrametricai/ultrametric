// Competition places follow the scoped underlying scores, before selection pinning.
// Equal scores share a place; name/coverage tie-breakers only order their rows.
export function scorePlace(score: number, scores: readonly number[]) {
  const place = 1 + scores.filter(value => value > score).length
  const mod100 = place % 100
  const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[place % 10] ?? 'th')
  return `${place}${suffix}`
}

export function CoveragePlace({ score, scores }: { score: number; scores: readonly number[] }) {
  const place = scorePlace(score, scores)
  const tied = scores.filter(value => value === score).length > 1
  return <span className="ml-1.5 whitespace-nowrap text-xs font-semibold tabular-nums text-emerald-400" title={`${tied ? 'Joint ' : ''}${place} by underlying score in this scope; selection does not change placement.`}>{place}</span>
}

export default function CoverageScore({ score, title }: { score: number; title: string }) {
  return <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-400" title={title}>{score.toFixed(0)}<span className="text-[10px] text-zinc-500">/100</span></span>
}
