import RankOrdinal from '@/components/RankOrdinal'
import { ordinal } from '@/lib/ordinal'

// Competition places follow the scoped underlying scores, before selection pinning.
// Equal scores share a place; name/coverage tie-breakers only order their rows.
export function scorePlace(score: number, scores: readonly number[]) {
  const place = 1 + scores.filter(value => value > score).length
  return ordinal(place)
}

export function CoveragePlace({ score, scores }: { score: number; scores: readonly number[] }) {
  const place = scorePlace(score, scores)
  const tied = scores.filter(value => value === score).length > 1
  return <RankOrdinal rank={1 + scores.filter(value => value > score).length} title={`${tied ? 'Joint ' : ''}${place} by underlying score in this scope; selection does not change placement.`} />
}

export default function CoverageScore({ score, title }: { score: number; title: string }) {
  return <span className="shrink-0 font-mono text-sm tabular-nums text-zinc-400" title={title}>{score.toFixed(0)}<span className="text-sm text-zinc-500">/100</span></span>
}
