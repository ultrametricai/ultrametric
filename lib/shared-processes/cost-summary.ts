import type { StepCost } from '@/lib/processes'

export function costSummary(cost: StepCost): string {
  if (cost.usd === null) return 'Varies'
  if (cost.kind === 'free') return 'Free'
  const amount = `$${cost.usd.toLocaleString('en-US')}`
  const note = cost.note ?? ''
  const minimum = /\bminimum\b/i.test(note) ? 'From ' : ''
  const unit = /\bannual fee\b/i.test(note) ? ' / year'
    : /\bmonthly fee\b/i.test(note) ? ' / month'
    : /\bper class\b/i.test(note) ? ' / class' : ''
  return `${minimum}${amount}${unit}`
}
