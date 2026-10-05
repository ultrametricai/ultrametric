'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import type { ComputerUseChoice } from '@/lib/shared-processes/computer-use'

export default function ComputerUseSelector({ options }: { options: ComputerUseChoice[] }) {
  const id = useId()
  const [selected, setSelected] = useState('')
  const choice = options.find(option => `${option.arenaId}/${option.productId}` === selected)
  if (!options.length) return null
  return <div className="space-y-1 text-sm text-zinc-400">
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <label htmlFor={id} title="Evidence-backed assistance for the mechanical work; required human approvals remain with the user.">Do this with computer use agent:</label>
      <select id={id} value={selected} onChange={event => setSelected(event.target.value)} className="min-h-9 min-w-0 max-w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200 focus-visible:outline-2 focus-visible:outline-emerald-300">
        <option value="">Choose agent</option>
        {options.map(option => <option key={`${option.arenaId}/${option.productId}`} value={`${option.arenaId}/${option.productId}`}>{option.name}</option>)}
      </select>
      {choice && <Link href={`/arena/${choice.arenaId}/product/${choice.productId}`} aria-label={`View ${choice.name} computer-use evidence`} title={`${choice.score.toFixed(0)}/100 on this step's mapped computer-use stories`} className="rounded-sm text-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-300">↗</Link>}
    </div>
  </div>
}
