import Link from 'next/link'
import ComputerUseLinks from './ComputerUseLinks'
import StepFlow, { StepFlowProvider } from './StepFlow'
import { computerUseForPart } from '@/lib/shared-processes/computer-use'
import { processBottomTables } from '@/lib/shared-processes/bottom-tables'
import ProcessBottomTables from './ProcessBottomTables'
import ExternalLinkMark from './ExternalLinkMark'
import StepMetadata, { SharedDocuments, hasSharedDocuments } from './StepMetadata'
import { PreviewGuidance, PreviewScope, ProviderScope } from './PreviewContent'
import { previewBriefs, previewContext } from '@/lib/shared-processes/preview-context'
import { referencedCatalog } from '@/lib/shared-processes/composed-preview'
import { ProcessOverview } from './ProcessViews'
import Image from 'next/image'
import type { ReactNode } from 'react'
import ProcessRunCTA from '@/components/process-start/ProcessRunCTA'
import { processStartTarget } from '@/lib/shared-processes/start'
import type { Note, Part, Reference, SharedRecord } from '@/lib/shared-processes/schema'
import { sharedPreviewHref } from '@/lib/shared-processes/reader'
import { isServiceCandidate, resolveServiceCandidates } from '@/lib/shared-processes/service-candidates'
import ServiceCandidates from './ServiceCandidates'
import { relatedProcesses } from '@/lib/shared-processes/related'
import { regionalDecision } from '@/lib/shared-processes/regions'
import { RegionalVariantProvider, RegionalVariantSelector, RegionalOption, RegionalOptions, RegionalDecisionTitle, RegionalStepAssessment, RegionalBaseResources } from './RegionalVariant'
import ProcessSummary from './ProcessSummary'
import { VendorSelectionProvider, SelectedCapability } from './VendorSelection'
import ProcessProviderSelector, { ProviderChoice } from './ProcessProviderSelector'
import type { ProcessProviderChoice } from '@/lib/shared-processes/provider-choice'
import StepComparisonTable from './StepComparisonTable'
import type { StepComparisons } from '@/lib/shared-processes/step-comparisons'
import { buildVendorPreview, type VendorPreview } from '@/lib/shared-processes/vendor-preview'

function HighRisk({ metadata }: { metadata: Record<string, unknown> }) {
  return metadata.riskLevel === 'high'
    ? <span className="py-1.5 text-sm font-medium text-red-300/90" title="Existing source risk assessment">High risk</span>
    : null
}

// Same categorical wording as ProcessDag/StepMethodGeo; no numeric conversion.
const routeLabels: Record<string, { label: string; symbol: string; color: string }> = {
  agent: { label: 'Agent', symbol: '✦', color: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' },
  form: { label: 'Manual form', symbol: '▤', color: 'border-amber-400/25 bg-amber-400/10 text-amber-300' },
  person: { label: 'Human or computer use', symbol: '♙', color: 'border-sky-400/25 bg-sky-400/10 text-sky-300' },
}
function StepAssessment({ metadata, spaced = false, unverified = false }: { metadata: Record<string, unknown>; spaced?: boolean; unverified?: boolean }) {
  const route = typeof metadata.route === 'string' && Object.hasOwn(routeLabels, metadata.route)
    ? routeLabels[metadata.route] : null
  const assessment = route && metadata.legalSignature === true
    ? { label: 'Signature — legally human', symbol: '✎', color: 'border-violet-400/25 bg-violet-400/10 text-violet-300' } : route
  if (!assessment && metadata.riskLevel !== 'high' && metadata.reversibility !== 'irreversible') return null
  return <span className={`inline-flex max-w-full items-start justify-end gap-1 align-top sm:gap-2 ${spaced ? 'ml-3' : ''}`}>
    {metadata.route === 'agent' && metadata.legalSignature !== true && metadata.approvalRequired === true && <span className="py-1.5 text-sm font-medium text-amber-300" title="Source setting: a human approves before this agent-classified step runs">Needs approval</span>}
    {metadata.route === 'agent' && metadata.legalSignature !== true && metadata.approvalRequired === false && !unverified && <span className="py-1.5 text-sm text-zinc-400" title="Source setting: no approval gate; execution integration is not verified">Automatic</span>}
    <HighRisk metadata={metadata} />
    {metadata.reversibility === 'irreversible' && <span className="py-1.5 text-sm font-medium text-amber-300" title="Existing source reversibility assessment">Irreversible</span>}
    {assessment && <span className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-lg border px-2 py-1.5 text-sm font-medium leading-5 sm:gap-2 sm:px-3 ${assessment.color}`} title={unverified ? 'Legacy agent classification; no verified API or tool binding' : 'Existing source route assessment'}><span aria-hidden="true" data-route-symbol={assessment.symbol} className="shrink-0 text-lg leading-5 before:content-[attr(data-route-symbol)]" /><span className="min-w-0 [overflow-wrap:anywhere]">{assessment.label}</span></span>}
  </span>
}

function Prose({ children }: { children: string | null | undefined }) {
  return children ? <p className="whitespace-pre-line break-words leading-relaxed text-zinc-300">{children}</p> : null
}

function Guidance({ text }: { text: string | null | undefined }) {
  if (!text) return null
  const content = <p className="whitespace-pre-line break-words leading-relaxed text-zinc-400">{text}</p>
  return text.length > 280 || text.split('\n').length > 3
    ? <details className="text-sm text-zinc-400"><summary className="cursor-pointer py-1 hover:text-zinc-100">Guidance</summary><div className="mt-2">{content}</div></details>
    : content
}

function References({ references, separated = true }: { references: Reference[]; separated?: boolean }) {
  const urls = references.filter(ref => ref.kind === 'url')
  // Vendor/category associations are not human-facing citations. Candidate and
  // comparison tables own their profile links; retain all associations in source.
  if (!urls.length) return null
  return <ul aria-label="Related links" className={`min-w-0 space-y-2 ${separated ? 'border-t border-zinc-800/50 pt-3' : ''}`}>
    {urls.map((ref, index) => <li key={`url-${index}`} className="min-w-0">
      <a href={ref.url} target="_blank" rel="noopener noreferrer" className="break-words text-sm font-normal text-zinc-300 underline decoration-zinc-700 decoration-1 underline-offset-2 hover:text-zinc-100 hover:decoration-zinc-400 focus-visible:outline-2 focus-visible:outline-zinc-300 [overflow-wrap:anywhere]">{ref.title ?? ref.url}<ExternalLinkMark href={ref.url} label={ref.title ?? ref.url} /></a>
      {ref.description && <div className="mt-1"><Guidance text={ref.description} /></div>}
    </li>)}

  </ul>
}

function StepResources({ references, documents, hasDocuments }: { references: Reference[]; documents: ReactNode; hasDocuments: boolean }) {
  if (!references.some(ref => ref.kind === 'url') && !hasDocuments) return null
  return <details className="border-t border-zinc-800/50 pt-3 text-sm text-zinc-400">
    <summary className="cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-300">Resources</summary>
    <div data-step-resources className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] items-start gap-6">
    <References references={references} separated={false} />
    {documents}
    </div>
  </details>
}

function Notes({ notes }: { notes: Note[] }) {
  if (!notes.length) return null
  return <details className="text-sm text-zinc-400">
    <summary className="cursor-pointer py-1 hover:text-zinc-100">Notes ({notes.length})</summary>
    <div className="mt-2 space-y-3">{notes.map((note, index) => <div key={index}><Prose>{note.text}</Prose><References references={note.references ?? []} /></div>)}</div>
  </details>
}

// Explicit preview binding to the existing v1 24px Compare asset; no inferred fallback.
const stepIcons: Record<string, string> = { 'form_001:n1': '/step-icons/compare.svg' }

function anchor(scope: string, id: string) { return `${scope}:${id}` }

function Parts({ parts, records, scope, vendorPreview, processChoice, comparisons = {}, nested = false, sourceId = scope, ancestors = [] }: {
  parts: Part[]; records: SharedRecord[]; scope: string; vendorPreview?: VendorPreview; processChoice?: ProcessProviderChoice; comparisons?: StepComparisons; nested?: boolean; sourceId?: string; ancestors?: string[]
}) {
  return <StepFlow scope={scope}>
    {parts.map(part => {
      const isSourcePart = records.find(record => record.id === sourceId)?.parts.includes(part) === true
      const referenced = part.ref && !ancestors.includes(part.ref) && part.ref !== sourceId ? records.find(record => record.id === part.ref) : undefined
      const providerGroup = processChoice?.groups.find(group => group.partScope === anchor(scope, part.id))
      const comparison = comparisons[anchor(scope, part.id)]
      // The authored Clerky pricing context belongs to its provider details,
      // not a separate workflow method. Preserve the canonical option in source.
      const clerkyContext = sourceId === 'form_001' && part.id === 'n1' ? part.options.find(option => option.id === 'clerky-formation') : undefined
      const clerky = clerkyContext ? resolveServiceCandidates(part.references.filter(ref => ref.kind === 'vendor' && ref.id === 'clerky'))[0] : undefined
      const providerDetails = clerky && clerkyContext ? { [clerky.id]: <div className="space-y-3"><Prose>{clerkyContext.summary}</Prose><Notes notes={clerkyContext.notes} /><References references={clerkyContext.references} /></div> } : undefined
      const briefs = previewBriefs(part.metadata).flatMap(brief => resolveServiceCandidates([{ kind: 'vendor', id: brief.vendor, role: 'candidate' }]).map(candidate => ({ candidateId: candidate.id, guidance: brief.guidance })))
      const visibleOptions = part.options.filter(option => option !== clerkyContext)
      const icon = stepIcons[anchor(scope, part.id)]
      const jurisdictions = Array.isArray(part.metadata.jurisdictions) ? part.metadata.jurisdictions.filter((value): value is string => typeof value === 'string' && value.toLowerCase() !== 'multi') : []
      return <PreviewScope key={part.id} context={previewContext(part.metadata)} recordScope={scope}><article id={anchor(scope, part.id)} className={`min-w-0 scroll-mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 ${nested ? 'p-3 sm:p-4' : 'p-5 sm:p-6'}`}>
        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-start sm:gap-6">
        <h3 className="flex min-w-0 flex-1 items-start gap-2.5 break-words text-xl font-medium leading-snug text-zinc-100">{icon && <Image src={icon} alt="" width={24} height={24} className="mt-0.5 shrink-0" />}<span className="min-w-0 [overflow-wrap:anywhere]">{referenced ? <Link href={sharedPreviewHref(referenced.id, records)} className="rounded-sm hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-300">{part.title ?? referenced.title}</Link> : <RegionalDecisionTitle scope={anchor(scope, part.id)} title={part.title ?? part.id} />}</span></h3>
        <span className="min-w-0 max-w-full self-end text-right empty:hidden sm:max-w-[45%] sm:self-start">
        <RegionalStepAssessment scope={anchor(scope, part.id)} fallback={<StepAssessment metadata={part.metadata} unverified={`${sourceId}:${part.id}` === 'form_001:n3'} />} options={part.options.map(option => ({ id: option.id, assessment: <StepAssessment metadata={option.metadata} /> }))} />
        </span>
        </div>
        <div className="mt-3 space-y-3 text-sm empty:hidden">
          {part.when && <p className="text-zinc-400">When: {part.when}</p>}
          {jurisdictions.length > 0 && <p className="text-zinc-400">Jurisdictions: {jurisdictions.join(', ')}</p>}
          {/* The filing's selected regional option supplies its instructions; the
              source decision preamble only explains choosing a jurisdiction. */}
          <PreviewGuidance guidance={sourceId === 'form_001' && part.id === 'n4' ? null : part.guidance} briefs={briefs} scope={anchor(scope, part.id)} choiceScope={vendorPreview?.choiceScope ?? processChoice?.stepScopes[anchor(scope, part.id)]} parentChoiceScope={vendorPreview?.parentChoiceScope} />
          {isSourcePart && <ComputerUseLinks options={computerUseForPart(sourceId, part)} />}
          {sourceId === 'form_001' && part.id === 'n1' ? <><ProviderScope candidateId="legal-ops/stripe-atlas" choiceScope={vendorPreview?.choiceScope} parentChoiceScope={vendorPreview?.parentChoiceScope}><StepMetadata metadata={part.metadata} sourceId={sourceId} records={records} /></ProviderScope>{clerky && clerkyContext && <ProviderScope candidateId={clerky.id} choiceScope={vendorPreview?.choiceScope} parentChoiceScope={vendorPreview?.parentChoiceScope}><StepMetadata metadata={clerkyContext.metadata} sourceId={sourceId} records={records} /></ProviderScope>}</> : <StepMetadata metadata={part.metadata} sourceId={sourceId} records={records} />}
          {referenced && <div className="space-y-2">
            <Guidance text={referenced.summary} />
          </div>}
          <Notes notes={part.notes} />
          {referenced && <details open className="space-y-4 border-t border-zinc-800/50 pt-3">
            <summary className="cursor-pointer text-sm font-medium text-zinc-200">Steps in {referenced.title}</summary>
            {referenced.guidance && <Guidance text={referenced.guidance} />}
            <Parts parts={referenced.parts} records={records} scope={`${scope}:${part.id}:ref`} sourceId={referenced.id} vendorPreview={buildVendorPreview(referenced, `${scope}:${part.id}:ref`, processChoice?.stepScopes)} ancestors={[...ancestors, sourceId]} processChoice={processChoice} comparisons={comparisons} nested />
          </details>}
          {visibleOptions.length > 0 && <RegionalOptions scope={anchor(scope, part.id)}>
            {visibleOptions.map(option => <RegionalOption key={option.id} scope={anchor(scope, part.id)} optionId={option.id} id={anchor(anchor(scope, part.id), option.id)} heading={<>{option.title}<StepAssessment metadata={option.metadata} spaced /></>}>
                <PreviewGuidance guidance={option.summary} scope={anchor(anchor(scope, part.id), option.id)} />
                {isSourcePart && <ComputerUseLinks options={computerUseForPart(sourceId, part, option.id)} />}
                <StepMetadata metadata={option.metadata} sourceId={sourceId} records={records} />
                {option.when && <p className="text-zinc-400">When: {option.when}</p>}
                <Notes notes={option.notes} />
                {comparisons[anchor(anchor(scope, part.id), option.id)] ? <StepComparisonTable parentChoiceScope={vendorPreview?.parentChoiceScope} scope={anchor(anchor(scope, part.id), option.id)} comparison={comparisons[anchor(anchor(scope, part.id), option.id)]} choiceScope={vendorPreview?.choiceScope ?? processChoice?.stepScopes[anchor(anchor(scope, part.id), option.id)]} /> : vendorPreview && <SelectedCapability parentChoiceScope={vendorPreview?.parentChoiceScope} choiceScope={vendorPreview.choiceScope} evidence={vendorPreview.evidence[anchor(anchor(scope, part.id), option.id)] ?? []} />}
                <ServiceCandidates references={option.references} separated excludeIds={comparisons[anchor(anchor(scope, part.id), option.id)]?.products.map(product => product.id)} />
                <StepResources references={option.references.filter(ref => comparisons[anchor(anchor(scope, part.id), option.id)] || !isServiceCandidate(ref))} hasDocuments={hasSharedDocuments(option.metadata)} documents={<SharedDocuments metadata={option.metadata} />} />
                {(option.parts.length > 0 || option.links?.length) && <Parts parts={option.parts} records={records} scope={anchor(anchor(scope, part.id), option.id)} sourceId={sourceId} ancestors={ancestors} vendorPreview={vendorPreview} processChoice={processChoice} comparisons={comparisons} nested />}
            </RegionalOption>)}
          </RegionalOptions>}
          {providerGroup ? <ProviderChoice choice={providerGroup} /> : <ServiceCandidates details={providerDetails} references={part.references} separated excludeIds={comparison?.products.map(product => product.id)} choiceScope={vendorPreview?.choiceScope === anchor(scope, part.id) ? vendorPreview.choiceScope : processChoice?.groups.find(group => group.partScope === anchor(scope, part.id))?.scope} coverage={vendorPreview?.choiceScope === anchor(scope, part.id) ? vendorPreview.coverage : undefined} parentChoiceScope={vendorPreview?.choiceScope === anchor(scope, part.id) ? vendorPreview.parentChoiceScope : undefined} evidence={vendorPreview?.choiceScope === anchor(scope, part.id) ? vendorPreview.evidence : undefined} />}
          {comparison ? <StepComparisonTable parentChoiceScope={vendorPreview?.parentChoiceScope} scope={anchor(scope, part.id)} comparison={comparison} choiceScope={vendorPreview?.choiceScope ?? processChoice?.stepScopes[anchor(scope, part.id)]} /> : vendorPreview && <SelectedCapability parentChoiceScope={vendorPreview?.parentChoiceScope} choiceScope={vendorPreview.choiceScope} evidence={vendorPreview.evidence[anchor(scope, part.id)] ?? []} />}
          <RegionalBaseResources scope={anchor(scope, part.id)}><StepResources references={part.references.filter(ref => comparison || !isServiceCandidate(ref))} hasDocuments={hasSharedDocuments(part.metadata) || Boolean(clerkyContext && hasSharedDocuments(clerkyContext.metadata))} documents={sourceId === 'form_001' && part.id === 'n1' ? <><ProviderScope candidateId="legal-ops/stripe-atlas" choiceScope={vendorPreview?.choiceScope} parentChoiceScope={vendorPreview?.parentChoiceScope}><SharedDocuments metadata={part.metadata} /></ProviderScope>{clerky && clerkyContext && <ProviderScope candidateId={clerky.id} choiceScope={vendorPreview?.choiceScope} parentChoiceScope={vendorPreview?.parentChoiceScope}><SharedDocuments metadata={clerkyContext.metadata} /></ProviderScope>}</> : <SharedDocuments metadata={part.metadata} />} /></RegionalBaseResources>
        </div>
      </article></PreviewScope>
    })}
    {!parts.length && <p className="text-zinc-400">No parts specified.</p>}
  </StepFlow>
}

export default function SharedProcessReader({ record, records, supplementary, vendorPreview, comparisons, processChoice }: {
  record: SharedRecord
  records: SharedRecord[]
  supplementary?: ReactNode
  vendorPreview?: VendorPreview
  comparisons?: StepComparisons
  processChoice?: ProcessProviderChoice
}) {
  const icon = record.id === 'form_001' ? '/process-icons/incorporate.svg' : undefined
  const related = relatedProcesses(record, records)
  const phase = typeof record.metadata.phase === 'string' ? record.metadata.phase : record.kind
  return <RegionalVariantProvider key={record.id} decision={regionalDecision(record)}><VendorSelectionProvider key={record.id}><StepFlowProvider record={record} records={referencedCatalog(record, records)}><div className="min-w-0 space-y-6" data-shared-record={record.id}>
    <header className={`grid items-start gap-6 ${icon ? 'md:grid-cols-[minmax(0,1fr)_256px] md:gap-12' : ''}`}>
      <div className="min-w-0">
        <p className="text-sm uppercase tracking-widest text-zinc-400">
          <Link href="/processes/v2" className="hover:text-emerald-300">Processes</Link><span className="mx-1 text-zinc-600">/</span>{phase}
        </p>
        {icon && <Image src="/process-icons/incorporate-64.svg" alt="" width={64} height={64} className="mt-4 h-16 w-16 md:hidden" />}
        <h1 className="mt-4 break-words font-display text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">{record.title}</h1>
        {record.summary && <p className="mt-5 max-w-2xl whitespace-pre-line text-lg leading-relaxed text-zinc-400">{record.summary}</p>}
        <ProcessSummary record={record} records={referencedCatalog(record, records)} />
        {record.kind === 'process' && <ProcessRunCTA target={processStartTarget(record)} />}
      </div>
      {icon && <Image src={icon} alt="" width={256} height={256} priority className="hidden h-64 w-64 justify-self-end md:block" />}
    </header>
    <RegionalVariantSelector />
    <ProcessOverview processHrefs={Object.fromEntries(records.map(item => [item.id, sharedPreviewHref(item.id, records)]))} record={record} records={referencedCatalog(record, records)} />
    {processChoice && <ProcessProviderSelector choice={processChoice} />}
    {(record.when || record.guidance || record.outcomes.length > 0 || record.notes.length > 0) && <section aria-label="Process overview" className="space-y-4">
      {record.when && <p className="text-zinc-400">When: {record.when}</p>}
      <Prose>{record.guidance}</Prose>
      {record.outcomes.length > 0 && <div><h2 className="mb-3 text-xl font-medium">Outcomes</h2><ul className="list-disc space-y-2 pl-5 text-zinc-300">{record.outcomes.map(outcome => <li key={outcome}>{outcome}</li>)}</ul></div>}
      <Notes notes={record.notes} />
    </section>}
    {comparisons && Object.keys(comparisons).length > 0 && <details className="text-sm text-zinc-400">
      <summary className="cursor-pointer">How coverage scores work</summary>
      <p className="mt-2 max-w-2xl leading-relaxed">Scores measure the mapped stories, weighted by importance, assessed quality, and verdict. Stories can describe manual workflows or APIs; scores are not automation probabilities or confirmation of a complete service. Zero means no credited coverage in these assessments; not-applicable judgments are excluded. Product links and evidence controls do not change selections.</p>
    </details>}
    <section aria-label="Process parts" className="space-y-5">
      <h2 className="text-xl font-medium text-zinc-100">Process Steps</h2>
      <Parts parts={record.parts} records={records} scope={record.id} vendorPreview={vendorPreview} processChoice={processChoice} comparisons={comparisons} />
    </section>
    {supplementary}
    <ProcessBottomTables recordId={record.id} variants={processBottomTables(record, records)} />
    {related.length > 0 && <section aria-labelledby="related-processes-heading" className="space-y-4">
      <h2 id="related-processes-heading" className="text-xl font-medium text-zinc-100">Related processes</h2>
      <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">{related.map(other => <li key={other.id}><Link href={sharedPreviewHref(other.id, records)} className="block break-words px-4 py-3 text-zinc-200 hover:text-emerald-300">{other.title}</Link></li>)}</ul>
    </section>}
  </div></StepFlowProvider></VendorSelectionProvider></RegionalVariantProvider>
}
