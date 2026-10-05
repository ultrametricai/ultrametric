'use client'

import Link from 'next/link'
import ExternalLinkMark from './ExternalLinkMark'
import ScoredProductRow from './ScoredProductRow'
import type { StepComparison, StepComparisonProduct } from '@/lib/shared-processes/step-comparisons'
import { vendorEvidenceHref } from '@/lib/shared-processes/coverage-links'
import { useRegionalVariant } from './RegionalVariant'
import { selectedVendor, useVendorSelection } from './VendorSelection'

function ProductRow({ product, selected, inherited, onSelect, scores }: { product: StepComparisonProduct; selected: boolean; inherited: boolean; onSelect?: () => void; scores: readonly number[] }) {
  return <ScoredProductRow scoreHref={vendorEvidenceHref(product.href, product.stories.map(story => story.id))} scores={scores} product={product} selected={selected} inherited={inherited} onSelect={onSelect} selectionLabel={`Use ${product.name} for this step`} evidenceLabel="story evidence" scoreTitle={`Story coverage ${product.score}/100 from this step's mapped stories`}>
      {product.stories.map(story => <details key={story.id} className="min-w-0">
        <summary className="cursor-pointer break-words leading-relaxed text-zinc-300"><Link href={`${product.href}#story-${story.id}`} className="rounded-sm text-zinc-300 hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-zinc-300">{story.title}</Link><span className="ml-2 text-zinc-500">{story.verdict} · {story.quality}/10 · weight {story.weight}</span></summary>
        <div className="mt-2 space-y-2 break-words leading-relaxed [overflow-wrap:anywhere]">
          <p>{story.rationale}</p>
          <p>Confidence: {story.confidence}</p>
          {story.evidence.length > 0 && <ul className="space-y-3">{story.evidence.map(source => <li key={source.id}>
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-zinc-300 underline underline-offset-4">{source.url}<ExternalLinkMark href={source.url} label={source.url} /></a>
            <p className="mt-1">{source.excerpt}</p>
            <p className="mt-1 text-zinc-500">{source.tier} · fetched {source.fetchedAt.slice(0, 10)}</p>
          </li>)}</ul>}
        </div>
      </details>)}
  </ScoredProductRow>
}

function ComparisonGroup({ comparison, choiceScope, parentChoiceScope, scope, bordered = true, arenaName, allowReset = true }: { comparison: StepComparison; choiceScope?: string; parentChoiceScope?: string; scope?: string; bordered?: boolean; arenaName?: string; allowReset?: boolean }) {
  const selection = useVendorSelection()
  const region = useRegionalVariant()
  const foreign = !!region?.decision && region.selected !== 'default'
  const overrideScope = scope && foreign ? `${scope}:regional:${region!.decision!.scope}:${region!.selected}` : scope
  const inheritedScope = foreign ? undefined : choiceScope
  if (!comparison.products.length) return null
  const hasOverride = !!overrideScope && !!selection && Object.hasOwn(selection.overrides, overrideScope)
  const processPick = inheritedScope ? selectedVendor(selection, inheritedScope, parentChoiceScope) : undefined
  const inheritedPick = comparison.products.find(product => product.id === processPick && product.score > 0 && product.stories.some(story => story.quality > 0))?.id
  const selectedId = hasOverride ? selection!.overrides[overrideScope!] : inheritedPick
  const inherited = !hasOverride && selectedId !== undefined
  const selected = comparison.products.find(product => product.id === selectedId && product.score > 0 && product.stories.some(story => story.quality > 0))
  const products = selected ? [selected, ...comparison.products.filter(product => product !== selected)] : comparison.products
  return <section aria-label="Step product comparison" className="space-y-2 border-t border-zinc-800/50 pt-3">
    <p className="text-sm text-zinc-400">{arenaName ?? 'Products'} · {comparison.storyCount} coverage stories</p>
    <div className={bordered ? "overflow-hidden rounded-2xl border border-zinc-800" : "overflow-hidden"}>
      <ul>{products.map((product) => <ProductRow scores={comparison.products.map(item => item.score)} key={product.id} product={product} selected={product.id === selectedId} inherited={inherited} onSelect={overrideScope && selection ? () => selection.override(overrideScope, product.id === selectedId ? null : product.id) : undefined} />)}</ul>
    </div>
    {allowReset && hasOverride && inheritedScope && <button type="button" onClick={() => selection?.override(overrideScope!, undefined)} className="text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-200">Use process choice</button>}

  </section>
}

export default function StepComparisonTable(props: { comparison: StepComparison; choiceScope?: string; parentChoiceScope?: string; scope?: string; bordered?: boolean }) {
  return <>
    <ComparisonGroup {...props} />
    {props.comparison.additionalComparisons?.map(comparison => <ComparisonGroup {...props} key={comparison.arenaId} comparison={comparison} arenaName={comparison.arenaName} allowReset={false} />)}
  </>
}
