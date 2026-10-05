import { ordinal } from '@/lib/ordinal'

export default function RankOrdinal({ rank, title }: { rank: number; title?: string }) {
  return <span className="w-9 shrink-0 font-mono text-sm tabular-nums text-zinc-500" title={title}>{ordinal(rank)}</span>
}
