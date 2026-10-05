'use client'

import { useId, useState, type ReactNode } from 'react'
import Link from 'next/link'
import CoverageScore, { CoveragePlace } from './CoverageScore'
import ProductLogoView from '@/components/ProductLogoView'
import type { StepComparisonProduct } from '@/lib/shared-processes/step-comparisons'

export default function ScoredProductRow({ product, selected, inherited = false, onSelect, hidden = false, selectionLabel, evidenceLabel, scoreTitle, scores, showScore = true, profileLabel, children }: { product: Pick<StepComparisonProduct, "productId" | "name" | "hasLogo"> & { href: string | null; score: number | null }; selected: boolean; inherited?: boolean; onSelect?: () => void; hidden?: boolean; selectionLabel: string; evidenceLabel: string; scoreTitle: string; showScore?: boolean; scores: readonly number[]; profileLabel?: string; children?: ReactNode }) {
  const [expanded, setExpanded] = useState(false)
  const id = useId()
  return <li hidden={hidden} className="border-b border-zinc-800/70 last:border-b-0" data-selected-provider={selected || undefined}>
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-1.5 ${selected ? 'bg-zinc-900/60' : ''}`}>
      {onSelect && <button type="button" aria-label={selectionLabel} aria-pressed={selected} onClick={onSelect} className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:text-zinc-200"><span aria-hidden="true" className={`flex h-4 w-4 items-center justify-center rounded-full border text-[10px] ${selected ? 'border-emerald-400 text-emerald-300' : 'border-zinc-600'}`}>{selected ? '✓' : ''}</span></button>}
      <span className="flex min-w-0 grow basis-20 items-center gap-2">
        <ProductLogoView product={{ id: product.productId, name: product.name }} size={18} hasLogo={product.hasLogo} />
        <span className="min-w-0 break-words">{product.href ? <Link href={product.href} aria-label={profileLabel} className="text-sm font-medium text-zinc-100 hover:text-emerald-300">{product.name}</Link> : <span className="text-sm font-medium text-zinc-100">{product.name}</span>}{showScore && product.score !== null && <CoveragePlace score={product.score} scores={scores} />}</span>
      </span>
      {selected && <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400"><span aria-hidden="true" className="text-emerald-300">✓</span>{inherited ? 'Process choice' : 'Selected'}</span>}
      <span className="ml-auto flex shrink-0 items-center gap-3">
        {showScore && product.score !== null && <CoverageScore score={product.score} title={scoreTitle} />}
        {children && <button type="button" aria-label={`${expanded ? 'Hide' : 'Show'} ${product.name} ${evidenceLabel}`} aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(open => !open)} className="-my-1 flex h-7 w-7 items-center justify-center text-zinc-500 hover:text-zinc-100"><span aria-hidden="true" className={`text-[9px] transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span></button>}
      </span>
    </div>
    {expanded && children && <div id={id} role="region" aria-label={`${product.name} ${evidenceLabel}`} className="space-y-3 border-t border-zinc-800/50 bg-zinc-900/40 px-4 py-3 text-xs text-zinc-400">
      {children}
    </div>}
  </li>
}
